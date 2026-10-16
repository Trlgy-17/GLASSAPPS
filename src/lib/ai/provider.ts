import fs from 'fs';
import path from 'path';
import { GoogleGenAI, Type, ThinkingLevel } from '@google/genai';
import { defaultPriceBookV1 } from '../pricing/default-price-book';
import { hitungPenawaran } from '../pricing/pricing';
import { formatRupiah } from '../pricing/format-rupiah';
import { PriceBookData } from '@/types/pricing';
import { buildPrompts, BuildPromptParams } from './prompt-builder';
import { validateRupiahInDraft, validateMarketplaceGuards, validateForbiddenPhrases } from './validator';
import { createAdminClient } from '../supabase/server';

// 1. Model Configuration dari Environment
export const MODEL_FAST = process.env.GEMINI_MODEL_FAST || 'gemini-3.5-flash-lite';
export const MODEL_MAIN = process.env.GEMINI_MODEL_MAIN || 'gemini-3.8-flash';
export const MODEL_PRO = process.env.GEMINI_MODEL_PRO || 'gemini-4-argon';
export const MODEL_FALLBACK = process.env.GEMINI_MODEL_FALLBACK || 'gemini-3.6-flash';
export const MODEL_EMBEDDING = 'gemini-embedding-001';
export const MAX_REQUESTS_PER_DAY = parseInt(process.env.AI_MAX_REQUESTS_PER_DAY || '300', 10);

export const DRAFT_MODELS = (
  process.env.GEMINI_DRAFT_MODELS || 'gemini-3.8-flash,gemini-3.6-flash,gemini-3.5-flash-lite'
)
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

// =========================================================================
// CIRCUIT BREAKER IN-MEMORY
// Model yang gagal 2x dalam 5 menit dilewati selama 5 menit
// =========================================================================
interface CircuitBreakerEntry {
  failures: number[];
  openUntil: number;
}
const circuitBreakers = new Map<string, CircuitBreakerEntry>();

export function isModelAvailable(model: string): boolean {
  if (model === MODEL_PRO && process.env.GEMINI_PRO_ENABLED === 'false') {
    return false;
  }
  const entry = circuitBreakers.get(model);
  if (!entry) return true;
  return Date.now() > entry.openUntil;
}

export function recordModelFailure(model: string): void {
  const now = Date.now();
  const fiveMinAgo = now - 5 * 60 * 1000;
  const entry = circuitBreakers.get(model) || { failures: [], openUntil: 0 };
  entry.failures = entry.failures.filter((t) => t > fiveMinAgo);
  entry.failures.push(now);

  if (entry.failures.length >= 2) {
    entry.openUntil = now + 5 * 60 * 1000;
    console.warn(`[Circuit Breaker] Model ${model} gagal 2x dalam 5 menit. Dilewati selama 5 menit.`);
  }
  circuitBreakers.set(model, entry);
}

export function recordModelSuccess(model: string): void {
  circuitBreakers.delete(model);
}

// Inisialisasi GoogleGenAI SDK
function getAIClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY tidak ditemukan di environment (.env.local)');
  }
  return new GoogleGenAI({ apiKey });
}

// Cek Batas Harian Permintaan AI (Dihitung per request API, reset ~14.00 WIB)
async function checkDailyQuota(): Promise<{ count: number; warning80: boolean }> {
  if (process.env.NODE_ENV === 'test' && !process.env.RUN_LIVE_AI_TESTS) {
    return { count: 0, warning80: false };
  }
  const supabase = createAdminClient();
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const { count, error } = await supabase
    .from('ai_log')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', startOfDay.toISOString());

  const currentCount = count || 0;
  if (!error && currentCount >= MAX_REQUESTS_PER_DAY) {
    throw new Error('Kuota AI gratis hari ini habis, lanjut besok jam 14.00 WIB atau pakai Kalkulator manual.');
  }

  const warning80 = currentCount >= Math.floor(MAX_REQUESTS_PER_DAY * 0.8);
  return { count: currentCount, warning80 };
}

// Audit Logger ke tabel ai_log (Mencatat SETIAP percobaan, TANPA isi chat)
export async function logAICall(data: {
  model: string;
  endpoint: string;
  langkah?: string;
  token_in?: number;
  token_out?: number;
  durasi_ms: number;
  ms_ttft?: number;
  attempt?: number;
  status: 'success' | 'error' | 'rate_limit' | 'timeout' | 'aborted';
  error_code?: string;
  error_message?: string;
  metadata?: Record<string, unknown>;
}) {
  if (process.env.NODE_ENV === 'test' && !process.env.RUN_LIVE_AI_TESTS) {
    return;
  }
  try {
    const supabase = createAdminClient();
    await supabase.from('ai_log').insert({
      model: data.model,
      endpoint: data.endpoint,
      langkah: data.langkah || data.endpoint,
      token_in: data.token_in || 0,
      token_out: data.token_out || 0,
      durasi_ms: data.durasi_ms,
      ms_ttft: data.ms_ttft,
      attempt: data.attempt || 1,
      status: data.status,
      error_code: data.error_code,
      error_message: data.error_message,
      metadata: data.metadata,
    });
  } catch (err) {
    console.warn('Gagal mencatat ai_log:', err);
  }
}

/**
 * Mesin Eksekusi AI dengan Transisi Cepat (503/overloaded langsung pindah ke fallback)
 */
export async function executeWithRetryAndFallback<T>(
  primaryModel: string,
  fallbackModel: string,
  endpoint: string,
  fn: (modelToUse: string) => Promise<T>
): Promise<{ result: T; modelUsed: string; isFallback: boolean; durationMs: number }> {
  await checkDailyQuota();
  const t0 = Date.now();

  const isTransientError = (err: unknown): boolean => {
    const msg = (err instanceof Error ? err.message : String(err)).toLowerCase();
    return (
      msg.includes('503') ||
      msg.includes('unavailable') ||
      msg.includes('429') ||
      msg.includes('resource_exhausted') ||
      msg.includes('overloaded')
    );
  };

  // Coba model pertama
  try {
    const result = await fn(primaryModel);
    const durationMs = Date.now() - t0;
    await logAICall({ model: primaryModel, endpoint, durasi_ms: durationMs, status: 'success' });
    return { result, modelUsed: primaryModel, isFallback: false, durationMs };
  } catch (err: unknown) {
    if (!isTransientError(err)) {
      throw err;
    }
    // REVISI #3: Jika 503/overloaded -> JANGAN retry model yang sama. Langsung pindah ke model berikutnya.
    recordModelFailure(primaryModel);
    await logAICall({
      model: primaryModel,
      endpoint,
      durasi_ms: Date.now() - t0,
      status: 'error',
      error_code: '503',
      error_message: String(err),
    });
  }

  // Coba fallback model
  try {
    const result = await fn(fallbackModel);
    const durationMs = Date.now() - t0;
    await logAICall({ model: fallbackModel, endpoint, durasi_ms: durationMs, status: 'success' });
    return { result, modelUsed: fallbackModel, isFallback: true, durationMs };
  } catch (err: unknown) {
    recordModelFailure(fallbackModel);
    await logAICall({
      model: fallbackModel,
      endpoint,
      durasi_ms: Date.now() - t0,
      status: 'error',
      error_code: '503',
      error_message: String(err),
    });
    throw new Error('Server AI sedang sibuk. Screenshot & catatan tetap tersimpan, klik Coba Lagi.');
  }
}

// =========================================================================
// 2. MODUL A2: EKSTRAKSI SCREENSHOT
// =========================================================================
export interface ScreenshotInput {
  base64: string;
  mimeType: string;
}

export interface ExtractionOutput {
  nama_klien: string | null;
  platform: string;
  pesan: Array<{ pengirim: string; waktu: string | null; teks: string }>;
  waktu_pesan_terakhir_klien: string | null;
  kota: string | null;
  zona: 'dalam_kota' | 'luar_kota' | 'tidak_diketahui';
  items: Array<{
    bentuk: string | null;
    ukuran_1_cm: number | null;
    ukuran_2_cm: number | null;
    satuan_tidak_jelas: boolean;
    lampu: '3_warna' | '1_warna' | null;
    kontrol: string | null;
    frame: string | null;
    antifog: boolean | null;
    sandblast: { pakai: boolean | null; lebar_cm: number | null; jarak_tepi_cm: number | null };
    qty: number;
  }>;
  perlu_pasang: boolean | null;
  indikasi_b2b: string | null;
  bagian_tidak_terbaca: string[];
  catatan: string;
}

export async function extractScreenshot(
  screenshots: ScreenshotInput[],
  pastedText?: string
): Promise<{ extraction: ExtractionOutput; durationMs: number }> {
  await checkDailyQuota();
  const t0 = Date.now();
  const ai = getAIClient();

  const promptPath = path.resolve(process.cwd(), 'prompts/screenshot-extraction.md');
  let promptText = fs.readFileSync(promptPath, 'utf8');
  promptText = promptText.replace('{{kota_dalam_kota}}', 'Bandung, Cimahi, Kab. Bandung, KBB');

  const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [];
  parts.push({ text: promptText });

  if (pastedText && pastedText.trim()) {
    parts.push({ text: `\nTEKS TAMBAHAN DARI CLIPBOARD:\n${pastedText}` });
  }

  screenshots.slice(0, 5).forEach((sc) => {
    parts.push({
      inlineData: {
        mimeType: sc.mimeType,
        data: sc.base64,
      },
    });
  });

  try {
    const res = await ai.models.generateContent({
      model: MODEL_FAST,
      contents: parts,
      config: {
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        responseMimeType: 'application/json',
      },
    });

    const durationMs = Date.now() - t0;
    const raw = res.text || '{}';
    const parsed = JSON.parse(raw) as ExtractionOutput;

    await logAICall({
      model: MODEL_FAST,
      endpoint: 'extractScreenshot',
      langkah: 'ekstraksi',
      durasi_ms: durationMs,
      status: 'success',
    });

    return { extraction: parsed, durationMs };
  } catch (err: unknown) {
    const durationMs = Date.now() - t0;
    const errMsg = err instanceof Error ? err.message : String(err);
    await logAICall({
      model: MODEL_FAST,
      endpoint: 'extractScreenshot',
      langkah: 'ekstraksi',
      durasi_ms: durationMs,
      status: 'error',
      error_message: errMsg,
    });
    throw err;
  }
}

// =========================================================================
// 3. MODUL A3: DRAF BALASAN (HEDGED PARALLEL RACING STREAMING)
// =========================================================================
export interface DraftBubble {
  label: string;
  bubbles: string[];
}

export interface DraftReplyOutput {
  ringkasan_situasi: string;
  tahap: string;
  keberatan: string[];
  segmen_terdeteksi: string;
  data_kurang: string[];
  draf: DraftBubble[];
  angka_dipakai: number[];
  catatan_internal: string;
  perlu_owner: boolean;
  alasan_perlu_owner: string;
  langkah_berikutnya: string;
  angka_tidak_terverifikasi?: boolean;
  error_validasi_angka?: string[];
  pelanggaran_marketplace?: string[];
  frasa_terlarang_ditemukan?: string[];
  model_used?: string;
  is_fallback?: boolean;
  ms_ttft?: number;
}

/**
 * Menjalankan streaming draf dengan Hedging (Batas waktu 8 detik per percobaan):
 * - Urutan model dari DRAFT_MODELS (dilewati jika circuit breaker open).
 * - Jika 503/overloaded -> JANGAN retry model yang sama, langsung pindah ke model berikutnya.
 * - Jika token pertama belum tiba dalam 8 detik -> mulai model berikutnya secara paralel.
 * - Model yang pertama kali menghasilkan token memenangkan eksekusi, yang lain di-abort.
 */
export async function draftReply(
  params: BuildPromptParams,
  priceBook: PriceBookData,
  options?: {
    modeTeliti?: boolean;
    onStreamChunk?: (chunkText: string) => void;
  }
): Promise<{ draf: DraftReplyOutput; durationMs: number; modelUsed: string; isFallback: boolean }> {
  await checkDailyQuota();
  const tTotalStart = Date.now();
  const ai = getAIClient();
  const { systemInstruction, userContext } = buildPrompts(params);

  // Ambil angka sah kalkulator
  const calculatedSahNumbers: number[] = [];
  if (params.kalkulatorOutputJson) {
    try {
      const parsedCalc = JSON.parse(params.kalkulatorOutputJson);
      if (parsedCalc.total) calculatedSahNumbers.push(parsedCalc.total);
      if (parsedCalc.dp_50) calculatedSahNumbers.push(parsedCalc.dp_50);
      if (parsedCalc.subtotal_cermin) calculatedSahNumbers.push(parsedCalc.subtotal_cermin);
      if (parsedCalc.ongkir_list) calculatedSahNumbers.push(parsedCalc.ongkir_list);
      if (parsedCalc.ongkir_batas_admin) calculatedSahNumbers.push(parsedCalc.ongkir_batas_admin);
    } catch {
      // Ignored
    }
  }

  // Siapkan kandidat model yang tersedia (lewati jika circuit breaker open)
  const candidateModels = DRAFT_MODELS.filter(isModelAvailable);
  if (candidateModels.length === 0) {
    candidateModels.push(MODEL_FALLBACK); // fallback darurat
  }

  let winningModel = '';
  let winningText = '';
  let winningTtft = 0;
  let isFallbackUsed = false;
  let attemptNumber = 0;

  // Hedged Runner Loop
  for (const modelName of candidateModels) {
    attemptNumber++;
    const tModelStart = Date.now();
    let receivedFirstToken = false;
    let modelTtft = 0;

    try {
      // Controller untuk membatalkan jika hedging terpicu
      const controller = new AbortController();

      // Timer 8 detik: jika token pertama belum tiba, loop lanjut ke model berikutnya secara paralel
      const { promise: hedgeTimeoutPromise, resolve: resolveHedgeTimeout } = Promise.withResolvers<boolean>();
      const hedgeTimer = setTimeout(() => resolveHedgeTimeout(true), 8000);

      const streamPromise = (async () => {
        const stream = await ai.models.generateContentStream({
          model: modelName,
          contents: [{ role: 'user', parts: [{ text: userContext }] }],
          config: {
            systemInstruction: { parts: [{ text: systemInstruction }] },
            thinkingConfig: { thinkingLevel: options?.modeTeliti ? ThinkingLevel.MEDIUM : ThinkingLevel.LOW },
            maxOutputTokens: 1500,
          },
        });

        let accumulated = '';
        for await (const chunk of stream) {
          const txt = chunk.text || '';
          if (!receivedFirstToken && txt.trim().length > 0) {
            receivedFirstToken = true;
            modelTtft = Date.now() - tModelStart;
            clearTimeout(hedgeTimer);
          }
          accumulated += txt;
          if (options?.onStreamChunk) {
            options.onStreamChunk(txt);
          }
        }
        return accumulated;
      })();

      // Jalankan stream dan hedge timer
      const raceResult = await Promise.race([
        streamPromise.then((text) => ({ kind: 'completed' as const, text })),
        hedgeTimeoutPromise.then(() => ({ kind: 'hedged' as const })),
      ]);

      clearTimeout(hedgeTimer);

      if (raceResult.kind === 'completed') {
        winningModel = modelName;
        winningText = raceResult.text;
        winningTtft = modelTtft || (Date.now() - tModelStart);
        isFallbackUsed = modelName !== DRAFT_MODELS[0];
        recordModelSuccess(modelName);

        const durationMs = Date.now() - tModelStart;
        await logAICall({
          model: modelName,
          endpoint: 'draftReply',
          langkah: 'draf',
          durasi_ms: durationMs,
          ms_ttft: winningTtft,
          attempt: attemptNumber,
          status: 'success',
        });
        break;
      } else {
        // Token pertama belum tiba dalam 8 detik -> catat timeout dan mulai model berikutnya!
        console.warn(`[Hedging] Model ${modelName} belum menghasilkan token dalam 8 detik. Memulai model berikutnya...`);
        await logAICall({
          model: modelName,
          endpoint: 'draftReply',
          langkah: 'draf',
          durasi_ms: 8000,
          attempt: attemptNumber,
          status: 'timeout',
          error_message: 'Hedged timeout 8000ms',
        });
        // Lanjut ke model berikutnya dalam kandidat
        continue;
      }
    } catch (err: unknown) {
      const durationMs = Date.now() - tModelStart;
      const errMsg = err instanceof Error ? err.message : String(err);
      console.warn(`Model ${modelName} gagal (${errMsg}). Jangan menunggu, langsung pindah ke model berikutnya.`);

      recordModelFailure(modelName);
      await logAICall({
        model: modelName,
        endpoint: 'draftReply',
        langkah: 'draf',
        durasi_ms: durationMs,
        attempt: attemptNumber,
        status: 'error',
        error_code: errMsg.includes('503') ? '503' : errMsg.includes('429') ? '429' : 'ERR',
        error_message: errMsg,
      });

      // Jangan retry model yang sama! Lanjut ke model berikutnya
      continue;
    }
  }

  if (!winningText) {
    throw new Error('Server AI sedang sibuk. Screenshot & catatan tetap tersimpan, klik Coba Lagi.');
  }

  // Parse JSON
  let parsed: DraftReplyOutput;
  try {
    const cleanJson = winningText.replace(/```json/gi, '').replace(/```/g, '').trim();
    parsed = JSON.parse(cleanJson) as DraftReplyOutput;
  } catch {
    throw new Error('Gagal mem-parse JSON hasil keluaran draf AI');
  }

  // Validasi Angka, Marketplace, dan Frasa Terlarang di Server
  const allBubbles: string[] = [];
  (parsed.draf || []).forEach((d) => (d.bubbles || []).forEach((b) => allBubbles.push(b)));

  const rupiahValidation = validateRupiahInDraft(allBubbles, parsed.angka_dipakai || [], calculatedSahNumbers);
  const marketplaceValidation = validateMarketplaceGuards(params.kanal, allBubbles);
  const forbiddenValidation = validateForbiddenPhrases(allBubbles);

  if (!rupiahValidation.valid || !marketplaceValidation.valid || !forbiddenValidation.valid) {
    parsed.angka_tidak_terverifikasi = true;
    parsed.error_validasi_angka = rupiahValidation.errors;
    parsed.pelanggaran_marketplace = marketplaceValidation.errors;
    parsed.frasa_terlarang_ditemukan = forbiddenValidation.errors;
  }

  const durationMs = Date.now() - tTotalStart;

  return {
    draf: {
      ...parsed,
      model_used: winningModel,
      is_fallback: isFallbackUsed,
      ms_ttft: winningTtft,
    },
    durationMs,
    modelUsed: winningModel,
    isFallback: isFallbackUsed,
  };
}

// =========================================================================
// 4. REVISI CEPAT (1 PANGGILAN KILAT, THINKING MINIMAL, MAX TOKENS 800)
// =========================================================================
export interface FastRevisionParams {
  previousDraftText: string;
  instruksiRevisi: string;
  calculatedNumbers: number[];
  kanal: string;
}

export async function executeFastRevision(
  params: FastRevisionParams,
  options?: { onStreamChunk?: (chunkText: string) => void }
): Promise<{ draf: DraftReplyOutput; durationMs: number; modelUsed: string }> {
  await checkDailyQuota();
  const t0 = Date.now();
  const ai = getAIClient();

  // Prompt kilat 1-shot khusus revisi
  const revisionSystemPrompt = `
Kamu adalah sales Putra Glass. Tugasmu HANYA merevisi draf WhatsApp sebelumnya berdasarkan instruksi: "${params.instruksiRevisi}".
Pertahankan seluruh angka rupiah sah yang ada di draf sebelumnya. Jangan menambah spek baru.
Keluarkan HANYA JSON valid:
{
  "ringkasan_situasi": "Revisi cepat",
  "tahap": "penawaran",
  "keberatan": [],
  "segmen_terdeteksi": "b2c",
  "data_kurang": [],
  "draf": [{"label": "Revisi: ${params.instruksiRevisi}", "bubbles": ["...", "..."]}],
  "angka_dipakai": [],
  "catatan_internal": "Revisi cepat diterapkan",
  "perlu_owner": false,
  "alasan_perlu_owner": "",
  "langkah_berikutnya": "Kirim draf revisi ke klien"
}
`;

  const userContent = `DRAF SEBELUMNYA:\n${params.previousDraftText}\n\nINSTRUKSI REVISI:\n${params.instruksiRevisi}`;

  // Gunakan model tercepat dengan thinkingLevel MINIMAL untuk latensi <= 3 detik
  const modelToUse = MODEL_FAST;
  let accumulated = '';
  let firstTokenMs = 0;
  let gotFirst = false;

  const stream = await ai.models.generateContentStream({
    model: modelToUse,
    contents: [{ role: 'user', parts: [{ text: userContent }] }],
    config: {
      systemInstruction: { parts: [{ text: revisionSystemPrompt }] },
      thinkingConfig: { thinkingLevel: ThinkingLevel.MINIMAL },
      maxOutputTokens: 800,
    },
  });

  for await (const chunk of stream) {
    const txt = chunk.text || '';
    if (!gotFirst && txt.trim().length > 0) {
      gotFirst = true;
      firstTokenMs = Date.now() - t0;
    }
    accumulated += txt;
    if (options?.onStreamChunk) {
      options.onStreamChunk(txt);
    }
  }

  const durationMs = Date.now() - t0;

  let parsed: DraftReplyOutput;
  try {
    const cleanJson = accumulated.replace(/```json/gi, '').replace(/```/g, '').trim();
    parsed = JSON.parse(cleanJson) as DraftReplyOutput;
  } catch {
    throw new Error('Gagal memproses draf revisi');
  }

  await logAICall({
    model: modelToUse,
    endpoint: 'fastRevision',
    langkah: 'revisi',
    durasi_ms: durationMs,
    ms_ttft: firstTokenMs,
    status: 'success',
  });

  return {
    draf: {
      ...parsed,
      model_used: modelToUse,
      ms_ttft: firstTokenMs,
    },
    durationMs,
    modelUsed: modelToUse,
  };
}

// =========================================================================
// 4B. SATU PANGGILAN TERPADU DRAF PERTAMA (SPEC + BALASAN DENGAN PENANDA)
// =========================================================================
export interface UnifiedDraftParams {
  screenshots: ScreenshotInput[];
  pastedText?: string;
  overrideKanal?: string;
  arahanAdmin?: string;
  priceBook: PriceBookData;
  modelName?: string;
  thinkingLevel?: ThinkingLevel;
  onStreamChunk?: (chunk: string) => void;
}

export interface UnifiedDraftResult {
  extraction: ExtractionOutput;
  draf: DraftReplyOutput;
  modelUsed: string;
  durasiMs: number;
  ttftMs: number;
  calculatedNumbers: number[];
}

export async function executeUnifiedDraft(params: UnifiedDraftParams): Promise<UnifiedDraftResult> {
  await checkDailyQuota();
  const t0 = Date.now();
  const ai = getAIClient();
  const candidateModels = params.modelName
    ? [params.modelName, MODEL_FAST]
    : DRAFT_MODELS.filter(isModelAvailable);
  if (candidateModels.length === 0) {
    candidateModels.push(MODEL_FAST);
  }
  const thinkingLvl = params.thinkingLevel ?? ThinkingLevel.MINIMAL;
  const unifiedSystemPrompt = `
Kamu adalah Senior Sales & CS Putra Glass (cermin LED custom premium di Bandung).
Tugasmu:
1. Analisis teks dan/atau screenshot chat klien.
2. PENTING - ATURAN 2 MODE KONTROL (JANGAN TERTUKAR):
   - Mode "Produk Jadi" (SKU Katalog standar): Kontrol = Touchscreen (TC) / Sensor Tangan (ST) / Baterai (BT).
   - Mode "Custom" (Ukuran bebas per m2): Paket = LED 3 Warna Premium (touchscreen kabel) / Sensor Tangan + Baterai (rechargeable) / LED 1 Warna Basic (saklar).
   - Jika klien belum jelas memilih ukuran/model, tanyakan: "Mau model jadi (ukuran katalog) atau custom ukuran sesuai ruangan Kak?".
3. Keluarkan blok SPEC di paling awal:
{
  "nama_klien": "Nama klien jika ada, atau null",
  "kota": "Nama kota jika ada, atau null",
  "kanal": "${params.overrideKanal || 'whatsapp'}",
  "segmen": "B2C",
  "items": [
    {
      "bentuk": "rectangle | round | arch | oval | capsule | custom",
      "panjang_cm": 60,
      "lebar_cm": 80,
      "satuan_tidak_jelas": false,
      "lampu": "3_warna | 1_warna",
      "kontrol": "touchscreen | touchscreen_baterai | sensor | sensor_baterai | saklar",
      "frame": "tanpa | aluminium | hpl",
      "antifog": false,
      "sandblast": false,
      "qty": 1
    }
  ],
  "perlu_pasang": false,
  "catatan": "Kebutuhan klien / ringkasan"
}
<!--/SPEC-->

3. Setelah itu keluarkan blok DRAFT balasan:
<!--DRAFT-->
{
  "ringkasan_situasi": "1-2 kalimat untuk admin",
  "tahap": "kualifikasi | penawaran | nego | siap_dp",
  "keberatan": [],
  "segmen_terdeteksi": "b2c",
  "data_kurang": [],
  "draf": [
    {
      "label": "Dorong DP",
      "bubbles": [
        "Halo Kak! Untuk cermin ukuran cerminnya harganya [[HARGA_1]].",
        "Ongkirnya [[ONGKIR]]. Jadi totalnya [[TOTAL]], dengan DP 50% [[DP]].",
        "Rencananya mau dipasang di area mana Kak?"
      ]
    }
  ],
  "catatan_internal": "...",
  "perlu_owner": false,
  "alasan_perlu_owner": "",
  "langkah_berikutnya": "..."
}
<!--/DRAFT-->

ATURAN HARGA MUTLAK:
- DILARANG KERAS menulis angka rupiah langsung (jangan tulis Rp840.000, 1.295.000, dll).
- WAJIB memakai penanda persis:
  [[HARGA_1]] untuk harga cermin
  [[ONGKIR]] untuk ongkos kirim
  [[PASANG]] untuk pasang (jika ada)
  [[TOTAL]] untuk total penawaran
  [[DP]] untuk DP 50%
  [[PELUNASAN]] untuk pelunasan 50%
- Server kami yang akan menghitung nominal resmi dan mengganti penanda secara otomatis.
- Jika ukuran belum diketahui, jangan menebak ukuran. Cukup tanyakan ukuran yang dibutuhkan.
- Frasa terlarang: "100%", "dijamin pasti", "tidak akan rusak", "terima kasih telah menghubungi kami", "kami sangat senang", "solusi terbaik untuk kebutuhan anda".
- Garansi resmi: 7 hari untuk pecah/retak perjalanan atau tidak sesuai + 3 bulan fungsi kelistrikan LED & touchscreen, berlaku baik untuk diambil sendiri maupun dikirim via ekspedisi.
- Lokasi workshop: hanya sebut jika ada di Pengaturan (workshop kami di Bandung; jika klien tanya alamat lengkap, infokan admin akan konfirmasi titik jemput).
`;

  const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [];
  if (params.pastedText && params.pastedText.trim()) {
    parts.push({ text: `CHAT KLIEN:\n${params.pastedText}` });
  }
  if (params.arahanAdmin && params.arahanAdmin.trim()) {
    parts.push({ text: `ARAHAN ADMIN:\n${params.arahanAdmin}` });
  }
  params.screenshots.slice(0, 5).forEach((sc) => {
    parts.push({
      inlineData: {
        mimeType: sc.mimeType,
        data: sc.base64,
      },
    });
  });

  if (parts.length === 0) {
    parts.push({ text: 'Halo Putra Glass' });
  }

  let accumulated = '';
  let ttftMs = 0;
  let gotFirst = false;
  let modelUsed = '';

  for (const modelToTry of candidateModels) {
    try {
      modelUsed = modelToTry;
      const stream = await ai.models.generateContentStream({
        model: modelToTry,
        contents: parts,
        config: {
          systemInstruction: { parts: [{ text: unifiedSystemPrompt }] },
          thinkingConfig: { thinkingLevel: thinkingLvl },
          maxOutputTokens: 1500,
        },
      });

      accumulated = '';
      for await (const chunk of stream) {
        const txt = chunk.text || '';
        if (!gotFirst && txt.trim().length > 0) {
          gotFirst = true;
          ttftMs = Date.now() - t0;
        }
        accumulated += txt;
        if (params.onStreamChunk) {
          params.onStreamChunk(txt);
        }
      }
      if (accumulated.trim().length > 0) {
        break; // Berhasil!
      }
    } catch (tryErr) {
      console.warn(`Model ${modelToTry} gagal:`, tryErr);
      recordModelFailure(modelToTry);
      if (modelToTry === candidateModels[candidateModels.length - 1]) {
        throw tryErr;
      }
    }
  }

  const durasiMs = Date.now() - t0;

  // Ekstrak blok SPEC
  let extractedSpec: any = {};
  const specMatch =
    accumulated.match(/<!--\s*SPEC\s*-->([\s\S]*?)<!--\s*\/SPEC\s*-->/i) ||
    accumulated.match(/```json\s*<!--\s*SPEC\s*-->([\s\S]*?)<!--\s*\/SPEC\s*-->/i);

  if (specMatch) {
    try {
      extractedSpec = JSON.parse(specMatch[1].trim());
    } catch {}
  }

  // Fallback jika model tidak membungkus SPEC atau gagal parse
  if (!extractedSpec.items || extractedSpec.items.length === 0) {
    const rawJsonMatch = accumulated.match(/\{[\s\S]*?"items"[\s\S]*?\}/);
    if (rawJsonMatch) {
      try {
        extractedSpec = JSON.parse(rawJsonMatch[0].trim());
      } catch {}
    }
  }

  // Ekstrak dimensi darurat dari teks jika SPEC kosong
  let it = extractedSpec.items?.[0];
  if (!it && params.pastedText) {
    const dimMatch = params.pastedText.match(/(\d+)\s*(?:x|×)\s*(\d+)/i);
    const diaMatch = params.pastedText.match(/diameter\s*(\d+)/i) || params.pastedText.match(/D(\d+)/i);
    if (dimMatch) {
      it = {
        panjang_cm: Number(dimMatch[1]),
        lebar_cm: Number(dimMatch[2]),
        bentuk: params.pastedText.toLowerCase().includes('oval') ? 'oval' : 'rectangle',
        lampu: params.pastedText.toLowerCase().includes('1 warna') ? '1_warna' : '3_warna',
        kontrol: params.pastedText.toLowerCase().includes('sensor') ? 'sensor' : 'touchscreen',
        sandblast: params.pastedText.toLowerCase().includes('sandblast'),
      };
    } else if (diaMatch) {
      it = {
        panjang_cm: Number(diaMatch[1]),
        lebar_cm: Number(diaMatch[1]),
        bentuk: 'round',
        lampu: '3_warna',
        kontrol: 'touchscreen',
        sandblast: params.pastedText.toLowerCase().includes('sandblast'),
      };
    }
  }

  if (!extractedSpec.kota && params.pastedText) {
    if (/bandung|cimahi/i.test(params.pastedText)) extractedSpec.kota = 'Bandung';
    else if (/surabaya/i.test(params.pastedText)) extractedSpec.kota = 'Surabaya';
    else if (/jakarta/i.test(params.pastedText)) extractedSpec.kota = 'Jakarta';
  }

  let harga1Str = '(belum bisa kami hitung karena ukuran belum ada, boleh infokan rencana ukuran berapa cm Kak?)';
  let ongkirStr = 'sesuai lokasi tujuan';
  let totalStr = '(akan kami hitung setelah ukuran pasti)';
  let dpStr = '(50% setelah total fix)';
  let pelunasanStr = '(50% saat cermin siap kirim)';
  const calculatedNumbers: number[] = [];

  const hasDimensions = it && (it.panjang_cm || it.ukuran_1_cm) && (it.lebar_cm || it.ukuran_2_cm);
  if (hasDimensions) {
    try {
      const pCm = it.panjang_cm || it.ukuran_1_cm;
      const lCm = it.lebar_cm || it.ukuran_2_cm;
      const hitung = hitungPenawaran(
        {
          items: [
            {
              bentuk_kode: it.bentuk || 'rectangle',
              panjang_mm: Math.round(pCm * 10),
              lebar_mm: Math.round(lCm * 10),
              lampu: it.lampu === '1_warna' ? '1_warna' : '3_warna',
              kontrol: typeof it.kontrol === 'string' ? (it.kontrol as any) : 'touchscreen',
              frame: typeof it.frame === 'string' ? (it.frame as any) : 'tanpa',
              antifog: Boolean(it.antifog),
              sandblast: { pakai: Boolean(it.sandblast) },
              qty: it.qty || 1,
            },
          ],
          zona: extractedSpec.kota && /bandung|cimahi/i.test(extractedSpec.kota) ? 'dalam_kota' : 'luar_kota',
          perlu_pasang: Boolean(extractedSpec.perlu_pasang),
          segmen: extractedSpec.segmen === 'B2B' ? 'B2B' : 'B2C',
        },
        params.priceBook
      );

      harga1Str = `*${formatRupiah(hitung.subtotal_cermin)}*`;
      ongkirStr = `*${formatRupiah(hitung.ongkir.list)}*`;
      totalStr = `*${formatRupiah(hitung.total)}*`;
      dpStr = `*${formatRupiah(hitung.dp_50)}*`;
      pelunasanStr = `*${formatRupiah(hitung.pelunasan)}*`;

      calculatedNumbers.push(hitung.subtotal_cermin, hitung.ongkir.list, hitung.total, hitung.dp_50, hitung.pelunasan);
    } catch (calcErr) {
      console.warn('Gagal hitung pricing.ts:', calcErr);
    }
  }

  // Ekstrak blok DRAFT
  let draftJson: any = null;
  const draftMatch = accumulated.match(/<!--DRAFT-->([\s\S]*?)<!--\/DRAFT-->/);
  if (draftMatch) {
    try {
      draftJson = JSON.parse(draftMatch[1].trim());
    } catch {}
  }

  if (!draftJson) {
    try {
      const cleanJson = accumulated.replace(/<!--[\s\S]*?-->/g, '').replace(/```json/gi, '').replace(/```/g, '').trim();
      draftJson = JSON.parse(cleanJson);
    } catch {
      draftJson = {
        ringkasan_situasi: 'Draf respon klien',
        tahap: 'kualifikasi',
        keberatan: [],
        draf: [{ label: 'Dorong DP', bubbles: [accumulated.replace(/<!--[\s\S]*?-->/g, '').trim()] }],
      };
    }
  }

  // Gantikan seluruh placeholder [[...]] dengan nominal resmi atau pertanyaan klarifikasi
  const replacePlaceholders = (text: string): string => {
    return text
      .replace(/\[\[HARGA_1\]\]/g, harga1Str)
      .replace(/\[\[HARGA_2\]\]/g, harga1Str)
      .replace(/\[\[ONGKIR\]\]/g, ongkirStr)
      .replace(/\[\[PASANG\]\]/g, '')
      .replace(/\[\[TOTAL\]\]/g, totalStr)
      .replace(/\[\[DP\]\]/g, dpStr)
      .replace(/\[\[PELUNASAN\]\]/g, pelunasanStr)
      .replace(/\[\[.*?\]\]/g, '');
  };

  if (Array.isArray(draftJson.draf)) {
    draftJson.draf.forEach((d: any) => {
      if (Array.isArray(d.bubbles)) {
        d.bubbles = d.bubbles.map(replacePlaceholders);
      }
    });
  }

  const allBubbles: string[] = [];
  (draftJson.draf || []).forEach((d: any) => (d.bubbles || []).forEach((b: string) => allBubbles.push(b)));

  const rupiahValidation = validateRupiahInDraft(allBubbles, calculatedNumbers, calculatedNumbers);
  const marketplaceValidation = validateMarketplaceGuards(params.overrideKanal || extractedSpec.kanal || 'whatsapp', allBubbles);
  const forbiddenValidation = validateForbiddenPhrases(allBubbles);

  const finalDraftOutput: DraftReplyOutput = {
    ringkasan_situasi: draftJson.ringkasan_situasi || 'Kualifikasi',
    tahap: draftJson.tahap || 'kualifikasi',
    keberatan: draftJson.keberatan || [],
    segmen_terdeteksi: draftJson.segmen_terdeteksi || 'b2c',
    data_kurang: draftJson.data_kurang || [],
    draf: draftJson.draf || [],
    angka_dipakai: calculatedNumbers,
    catatan_internal: draftJson.catatan_internal || '',
    perlu_owner: Boolean(draftJson.perlu_owner),
    alasan_perlu_owner: draftJson.alasan_perlu_owner || '',
    langkah_berikutnya: draftJson.langkah_berikutnya || 'Kirim penawaran ke klien',
    model_used: modelUsed,
    ms_ttft: ttftMs,
    angka_tidak_terverifikasi: !rupiahValidation.valid || !marketplaceValidation.valid || !forbiddenValidation.valid,
    error_validasi_angka: rupiahValidation.errors,
    pelanggaran_marketplace: marketplaceValidation.errors,
    frasa_terlarang_ditemukan: forbiddenValidation.errors,
  };

  const finalExtraction: ExtractionOutput = {
    nama_klien: extractedSpec.nama_klien || null,
    platform: params.overrideKanal || extractedSpec.kanal || 'whatsapp',
    pesan: [{ pengirim: 'klien', waktu: null, teks: params.pastedText || '(screenshot chat)' }],
    waktu_pesan_terakhir_klien: null,
    kota: extractedSpec.kota || null,
    zona: extractedSpec.kota && /bandung|cimahi/i.test(extractedSpec.kota) ? 'dalam_kota' : 'luar_kota',
    items: [
      {
        bentuk: it?.bentuk || 'rectangle',
        ukuran_1_cm: it?.panjang_cm || it?.ukuran_1_cm || null,
        ukuran_2_cm: it?.lebar_cm || it?.ukuran_2_cm || null,
        satuan_tidak_jelas: Boolean(it?.satuan_tidak_jelas),
        lampu: it?.lampu || '3_warna',
        kontrol: it?.kontrol || 'touchscreen',
        frame: it?.frame || 'tanpa',
        antifog: Boolean(it?.antifog),
        sandblast: { pakai: Boolean(it?.sandblast), lebar_cm: null, jarak_tepi_cm: null },
        qty: it?.qty || 1,
      },
    ],
    perlu_pasang: Boolean(extractedSpec.perlu_pasang),
    indikasi_b2b: extractedSpec.segmen === 'B2B' ? 'B2B' : null,
    bagian_tidak_terbaca: [],
    catatan: extractedSpec.catatan || '',
  };

  return {
    extraction: finalExtraction,
    draf: finalDraftOutput,
    modelUsed: modelUsed,
    durasiMs,
    ttftMs,
    calculatedNumbers,
  };
}

// =========================================================================
// 5. MODUL C: KARTU MEMORI & EMBEDDING
// =========================================================================
export interface MemoryParams {
  leadId?: string;
  transkripText: string;
  drafAiText: string;
  balasanFinalText: string;
  persenEdit: number;
  hasil: 'DP' | 'nego' | 'gagal' | 'belum_ada';
  alasanGagal?: string;
}

export async function summarizeMemory(params: MemoryParams): Promise<{ kartu_id: string; durationMs: number }> {
  await checkDailyQuota();
  const t0 = Date.now();
  const ai = getAIClient();
  const promptPath = path.resolve(process.cwd(), 'prompts/memory-card.md');
  const promptTemplate = fs.readFileSync(promptPath, 'utf8');

  const inputText = `
${promptTemplate}

INPUT:
<transkrip>${params.transkripText}</transkrip>
<draf_ai>${params.drafAiText}</draf_ai>
<balasan_final>${params.balasanFinalText}</balasan_final>
<persen_edit>${params.persenEdit}%</persen_edit>
<hasil>${params.hasil}</hasil>
<alasan_gagal>${params.alasanGagal || '-'}</alasan_gagal>
`;

  try {
    const res = await ai.models.generateContent({
      model: MODEL_FAST,
      contents: inputText,
      config: {
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        responseMimeType: 'application/json',
      },
    });

    const parsed = JSON.parse(res.text || '{}');
    const kartu = parsed.kartu_memori || {};

    const textToEmbed = `${kartu.situasi || ''} ${Array.isArray(kartu.keberatan) ? kartu.keberatan.join(' ') : ''}`;
    const embedRes = await ai.models.embedContent({
      model: MODEL_EMBEDDING,
      contents: textToEmbed,
    });

    const embeddingValues = embedRes.embeddings?.[0]?.values || [];
    const supabase = createAdminClient();

    const { data, error } = await supabase
      .from('kartu_memori')
      .insert({
        lead_id: params.leadId || null,
        ringkasan: kartu.situasi || 'Ringkasan percakapan',
        keberatan: kartu.keberatan || [],
        tahap: kartu.tahap || 'kualifikasi',
        langkah_admin: kartu.langkah_admin || '',
        hasil: params.hasil,
        alasan_gagal: params.alasanGagal || null,
        balasan_final: params.balasanFinalText,
        embedding: embeddingValues.length > 0 ? embeddingValues : null,
        aktif: true,
      })
      .select('id')
      .single();

    if (error) throw error;
    const durationMs = Date.now() - t0;

    await logAICall({
      model: MODEL_FAST,
      endpoint: 'summarizeMemory',
      langkah: 'memori',
      durasi_ms: durationMs,
      status: 'success',
    });

    return { kartu_id: data.id, durationMs };
  } catch (err: unknown) {
    const durationMs = Date.now() - t0;
    const errMsg = err instanceof Error ? err.message : String(err);
    await logAICall({
      model: MODEL_FAST,
      endpoint: 'summarizeMemory',
      langkah: 'memori',
      durasi_ms: durationMs,
      status: 'error',
      error_message: errMsg,
    });
    throw err;
  }
}
