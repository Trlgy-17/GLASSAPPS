import fs from 'fs';
import path from 'path';
import { GoogleGenAI, Type, ThinkingLevel } from '@google/genai';
import { defaultPriceBookV1 } from '../pricing/default-price-book';
import { hitungPenawaran } from '../pricing/pricing';
import { formatRupiah } from '../pricing/format-rupiah';
import { PriceBookData } from '@/types/pricing';
import { buildPrompts, BuildPromptParams } from './prompt-builder';
import { validateRupiahInDraft, validateMarketplaceGuards, validateForbiddenPhrases, extractAllRupiahNumbers, detectBrokenSentence } from './validator';
import { createAdminClient } from '../supabase/server';
import {
  parseDraftChain,
  executeWithHedgingAndFallback,
  calculateEstimatedCostRupiah,
  formatModelDisplayName,
  ChainTarget,
} from './fallback-chain';

// 1. Model Configuration dari Environment
export const MODEL_FAST = process.env.GEMINI_MODEL_FAST || 'gemini-3.5-flash-lite';
export const MODEL_MAIN = process.env.GEMINI_MODEL_MAIN || 'gemini-3.6-flash';
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
  provider?: 'gemini';
  alasan_pindah?: string | null;
  biaya_perkiraan?: number;
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
    const inTok = data.token_in || 0;
    const outTok = data.token_out || 0;
    const resolvedCost =
      data.biaya_perkiraan !== undefined
        ? data.biaya_perkiraan
        : calculateEstimatedCostRupiah(data.model, inTok, outTok);
    await supabase.from('ai_log').insert({
      model: data.model,
      endpoint: data.endpoint,
      provider: data.provider || 'gemini',
      alasan_pindah: data.alasan_pindah || null,
      biaya_perkiraan: resolvedCost,
      langkah: data.langkah || data.endpoint,
      token_in: inTok,
      token_out: outTok,
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
  discrepancy_warning?: string | null;
  rekening_kosong?: boolean;
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
  options?: { onStreamChunk?: (chunkText: string) => void },
  targetModel?: string
): Promise<{ draf: DraftReplyOutput; durationMs: number; modelUsed: string }> {
  await checkDailyQuota();
  const t0 = Date.now();
  const ai = getAIClient();

  const revisionSystemPrompt = `
Kamu adalah sales Putra Glass. Tugasmu HANYA merevisi draf WhatsApp sebelumnya berdasarkan instruksi: "${params.instruksiRevisi}".
ATURAN MUTLAK KEAMANAN:
- DILARANG KERAS mengubah harga, memberi diskon baru, memotong harga, atau menyebut batas wewenang owner.
- Pertahankan seluruh angka rupiah sah yang ada di draf sebelumnya persis apa adanya.
- Jangan pernah mengeluarkan penanda placeholder [[...]].
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

  const modelToUse = targetModel || MODEL_FAST;
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

  // Bersihkan penanda [[...]] yang mungkin tersisa
  if (Array.isArray(parsed.draf)) {
    parsed.draf.forEach((d) => {
      if (Array.isArray(d.bubbles)) {
        d.bubbles = d.bubbles.map((b) => b.replace(/\[\[.*?\]\]/g, ''));
      }
    });
  }

  const allBubbles: string[] = [];
  (parsed.draf || []).forEach((d) => (d.bubbles || []).forEach((b) => allBubbles.push(b)));

  // Validasi Rupiah, Marketplace Guard, dan Frasa Terlarang
  const calculatedNumbers = params.calculatedNumbers || [];
  const rupiahVal = validateRupiahInDraft(allBubbles, calculatedNumbers, calculatedNumbers);
  const marketplaceVal = validateMarketplaceGuards(params.kanal || 'whatsapp', allBubbles);
  const forbiddenVal = validateForbiddenPhrases(allBubbles);

  const hasErrors = !rupiahVal.valid || !marketplaceVal.valid || !forbiddenVal.valid;
  const allErrors = [...rupiahVal.errors, ...marketplaceVal.errors, ...forbiddenVal.errors];

  parsed.angka_dipakai = rupiahVal.numbersFound || calculatedNumbers;
  parsed.angka_tidak_terverifikasi = !rupiahVal.valid;
  if (hasErrors) {
    parsed.catatan_internal = (parsed.catatan_internal ? parsed.catatan_internal + ' | ' : '') + allErrors.join('; ');
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
  klienLanjutan?: { nomor: string; total: number; tanggal: string; nama: string };
  onStreamChunk?: (chunk: string) => void;
}

export interface UnifiedDraftResult {
  extraction: ExtractionOutput;
  draf: DraftReplyOutput;
  provider: 'gemini';
  modelUsed: string;
  alasanPindah?: string | null;
  inputTokens: number;
  outputTokens: number;
  biayaPerkiraan: number;
  durasiMs: number;
  ttftMs: number;
  calculatedNumbers: number[];
  discrepancyWarning: string | null;
  rekeningKosong: boolean;
  perluOwner: boolean;
  alasanPerluOwner: string;
  langkahBerikutnya: string;
}

export async function executeUnifiedDraft(params: UnifiedDraftParams): Promise<UnifiedDraftResult> {
  await checkDailyQuota();
  const t0 = Date.now();
  const ai = getAIClient();
  const thinkingLvl = params.thinkingLevel ?? ThinkingLevel.MINIMAL;

  // Modularisasi KB berdasarkan maksud (intent) klien untuk memangkas token input & mempercepat TTFT
  const chatLower = (params.pastedText || '').toLowerCase();
  const isMarketplace = params.overrideKanal === 'tiktok' || params.overrideKanal === 'shopee';
  const isNego = /mahal|kemahalan|diskon|kurang|potongan|nego|budget|anggaran|toko sebelah|murah|promo/.test(chatLower);
  const isGaransi = /garansi|pecah|rusak|mati|tukar|retak|unboxing|asuransi|aman|komplain/.test(chatLower);
  const isMerek = /merek|merk|brand|asahi|mulia|agc|pabrik/.test(chatLower);
  const isOngkir = /ongkir|kirim|ekspedisi|kargo|alamat|kota|bandung|surabaya|jakarta|timika|balikpapan/.test(chatLower);
  const isFollowup = /jadi deh|transfer|rekening|invoice|no rek|pesan sekarang|antrean|dp ke mana/.test(chatLower) || Boolean(params.klienLanjutan);

  const docPdf = params.priceBook.dokumen_pdf;
  const hasRekening = Boolean(docPdf?.bank_nomor && docPdf.bank_nomor.trim() && docPdf.bank_nomor !== '[belum diisi]');
  const rekeningRule = hasRekening
    ? `- Rekening pembayaran resmi: Bank ${docPdf?.bank_nama} nomor ${docPdf?.bank_nomor} a.n. ${docPdf?.bank_atas_nama}.`
    : `- Rekening resmi belum diatur di Pengaturan. JANGAN PERNAH MENGARANG nomor rekening atau bank! Tulis persis: "nomor rekening saya kirimkan sebentar ya Kak".`;

  const merekRule = isMerek
    ? `- PERTANYAAN MEREK KACA: Jawab spesifikasi resminya (kaca cermin datar grade 1 tebal 5 mm, tepi bevel 10 mm keliling standar resmi) + "untuk merek saya cek dulu ke tim produksi ya Kak". DILARANG KERAS menyebut atau mengiyakan nama merek kaca (ASAHI, Mulia, AGC, Guardian)!`
    : '';

  const negoRule = isNego
    ? `- TANGGA NEGO: Gali spesifikasi pembanding, lalu tawarkan opsi hemat: paket LED 1 warna basic (saklar biasa), tanpa sandblast, atau ukuran sedikit lebih kecil. JANGAN PERNAH menawarkan potongan harga atau bagi ongkir sendiri! Jika klien minta potongan/diskon/bagi ongkir, jawab: "saya bantu cek dulu ke tim ya Kak" dan set "perlu_owner": true.`
    : '';

  const ongkirRule = isOngkir
    ? `- PENGIRIMAN:
  * Jika area Bandung Raya (Bandung, Cimahi, Kab. Bandung, Bandung Barat): Selain menyebutkan ongkir Bandung [[ONGKIR]], SELALU tawarkan opsi: "atau bisa juga diambil langsung ke workshop kami di Bandung ya Kak (ongkir Rp0)".
  * Jika kota tanpa zona di buku harga (misal Timika Papua): sampaikan "Untuk estimasi ongkos kirim ke [Kota] akan dicek dan dihitung oleh admin kargo kami ya Kak." tanpa menyebut angka!
  * Klien minta ongkir dibagi dua (50:50): JANGAN setuju, jawab "saya bantu cek dulu ke tim ya Kak" dan set "perlu_owner": true.`
    : '';

  const garansiRule = isGaransi
    ? `- GARANSI & SYARAT KLAIM: Garansi resmi 7 hari pengiriman (pecah/retak perjalanan) + 3 bulan fungsi kelistrikan LED & touchscreen. Syarat klaim WAJIB disebut: video unboxing utuh tanpa cut, foto resi, dan dilaporkan maksimal 7 hari setelah barang sampai. DILARANG janji "ganti baru tanpa ribet", tim teknisi akan memverifikasi video terlebih dahulu.`
    : `- Garansi resmi: 7 hari fisik pengiriman + 3 bulan fungsi kelistrikan LED & touchscreen.`;

  const marketplaceRule = isMarketplace
    ? `- ATURAN KANAL MARKETPLACE (${params.overrideKanal}): DILARANG KERAS memuat nomor WhatsApp, nomor telepon, nomor rekening bank, atau link/ajakan transaksi di luar platform!`
    : '';

  const unifiedSystemPrompt = `
Kamu adalah Senior Sales & CS Putra Glass (cermin LED custom premium di Bandung).
Tugasmu: Analisis chat klien dan susun draf balasan WhatsApp/DM.

FAKTA DASAR PRODUK:
- Kaca cermin datar grade 1 tebal 5 mm (jernih, bebas bayangan ganda, BUKAN cermin cembung).
- Tepi bevel 10 mm keliling STANDAR RESMI kami pada semua produk cermin (bukan opsi tambahan berbayar).
- 2 Mode Pilihan:
  A. Mode "Produk Jadi" (SKU Katalog): Touchscreen (TC) / Sensor Tangan (ST) / Baterai (BT).
  B. Mode "Custom" (Bebas ukuran): LED 3 Warna Premium (touchscreen kabel) / Sensor Tangan + Baterai / LED 1 Warna Basic (saklar).

${rekeningRule}
${merekRule}
${negoRule}
${ongkirRule}
${garansiRule}
${marketplaceRule}

Keluarkan blok SPEC di paling awal:
<!--SPEC-->
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

Keluarkan blok DRAFT balasan:
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
- WAJIB memakai penanda persis: [[HARGA_1]], [[ONGKIR]], [[TOTAL]], [[DP]], [[PELUNASAN]].
- Server kami yang akan menghitung nominal resmi dan mengganti penanda secara otomatis.
- Frasa terlarang: "ASAHI", "Mulia", "AGC", "cembung", "diskon", "potongan", "promo", "khusus hari ini", "gratis", "ganti baru tanpa ribet", "dijamin", "100%", "adaptor SNI", "spare part secara gratis", "tidak akan rusak".
`;

  const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [];
  if (params.klienLanjutan && params.klienLanjutan.total > 0) {
    parts.push({
      text: `KONTEKS PENAWARAN KLIEN SEBELUMNYA:
Nomor Penawaran: ${params.klienLanjutan.nomor}
Nama Klien: ${params.klienLanjutan.nama}
Total Penawaran: [[TOTAL]] (DP 50%: [[DP]], Pelunasan: [[PELUNASAN]])
Tanggal: ${params.klienLanjutan.tanggal}
Petunjuk Khusus: Ini adalah lanjutan percakapan untuk penawaran ${params.klienLanjutan.nomor}. Klien sudah memiliki penawaran resmi. Gunakan penanda [[TOTAL]] dan [[DP]] untuk menyebutkan total pembayaran dan nominal DP 50%.`,
    });
  }
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

  // Eksekusi via Fallback Chain & Hedging 4 detik (Gemini Chain)
  const defaultChain = parseDraftChain();
  const draftChain = params.modelName
    ? [
        { provider: 'gemini' as const, model: params.modelName },
        ...defaultChain.filter((t) => t.model !== params.modelName),
      ]
    : defaultChain;

  const hedgingRes = await executeWithHedgingAndFallback<string>({
    chain: draftChain,
    hedgingTimeoutMs: 4000,
    executeFn: async (target, signal, onChunk) => {
      const stream = await ai.models.generateContentStream({
        model: target.model,
        contents: parts,
        config: {
          systemInstruction: { parts: [{ text: unifiedSystemPrompt }] },
          thinkingConfig: { thinkingLevel: thinkingLvl },
          maxOutputTokens: 1500,
        },
      });

      let text = '';
      let inTokens = 0;
      let outTokens = 0;
      for await (const chunk of stream) {
        if (signal.aborted) {
          throw new Error('Permintaan dibatalkan oleh sinyal abort');
        }
        const chunkText = chunk.text || '';
        text += chunkText;
        onChunk(chunkText);
        if (chunk.usageMetadata) {
          inTokens = chunk.usageMetadata.promptTokenCount || inTokens;
          outTokens = chunk.usageMetadata.candidatesTokenCount || outTokens;
        }
      }
      return {
        result: text,
        inputTokens: inTokens,
        outputTokens: outTokens,
      };
    },
    onStreamChunk: params.onStreamChunk,
  });

  const accumulated = hedgingRes.result;
  const modelUsed = hedgingRes.winner.model;
  const provider = 'gemini' as const;
  const ttftMs = hedgingRes.ttftMs;
  const durasiMs = hedgingRes.totalMs;

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
  let discrepancyWarning: string | null = null;

  // 1. KASUS TERHUBUNG PENAWARAN TERSIMPAN: Pakai snapshot harga, JANGAN hitung ulang!
  if (params.klienLanjutan && params.klienLanjutan.total > 0) {
    const snapTotal = params.klienLanjutan.total;
    const snapDp = Math.ceil(snapTotal / 2000) * 1000;
    const snapPelunasan = snapTotal - snapDp;
    totalStr = `*${formatRupiah(snapTotal)}*`;
    dpStr = `*${formatRupiah(snapDp)}*`;
    pelunasanStr = `*${formatRupiah(snapPelunasan)}*`;
    harga1Str = `*${formatRupiah(snapTotal)}*`;
    calculatedNumbers.push(snapTotal, snapDp, snapPelunasan);

    // Deteksi perbedaan jika chat menyebut nominal berbeda dari snapshot
    if (params.pastedText) {
      const numbersInChat = extractAllRupiahNumbers(params.pastedText);
      const diffNumber = numbersInChat.find((num: number) => num !== snapTotal && num !== snapDp && num !== snapPelunasan && num > 100000);
      if (diffNumber) {
        discrepancyWarning = `Peringatan: Angka di percakapan (${formatRupiah(diffNumber)}) berbeda dengan snapshot penawaran tersimpan (${params.klienLanjutan.nomor}: ${formatRupiah(snapTotal)})!`;
      }
    }
  } else {
    const hasDimensions = it && (it.panjang_cm || it.ukuran_1_cm) && (it.lebar_cm || it.ukuran_2_cm);
    if (hasDimensions) {
      try {
        const pCm = it.panjang_cm || it.ukuran_1_cm;
        const lCm = it.lebar_cm || it.ukuran_2_cm;

        // Aturan Zona Ongkir: hanya sebut nominal jika kota cocok dengan zona di buku harga
        const rawKota = (extractedSpec.kota || '').toLowerCase();
        const isBandungRaya = /bandung|cimahi/.test(rawKota);
        const isKnownLuarKota = /surabaya|jakarta|semarang|yogyakarta|jogja|malang|solo|bekasi|tangerang|depok|bogor|bali|denpasar|medan|balikpapan|makassar|palembang|lampung/.test(rawKota);

        const zonaKirim = isBandungRaya ? 'dalam_kota' : 'luar_kota';
        const sebutOngkir = isBandungRaya || isKnownLuarKota;

        const hitung = hitungPenawaran(
          {
            items: [
              {
                bentuk_kode: it.bentuk || 'rectangle',
                panjang_mm: Math.round(pCm * 10),
                lebar_mm: Math.round(lCm * 10),
                lampu: it.lampu === '1_warna' ? '1_warna' : '3_warna',
                kontrol: typeof it.kontrol === 'string' ? (it.kontrol as 'touchscreen' | 'sensor' | 'baterai') : 'touchscreen',
                frame: typeof it.frame === 'string' ? (it.frame as 'tanpa' | 'hpl' | 'aluminium') : 'tanpa',
                antifog: Boolean(it.antifog),
                sandblast: { pakai: Boolean(it.sandblast) },
                qty: it.qty || 1,
              },
            ],
            zona: zonaKirim,
            perlu_pasang: Boolean(extractedSpec.perlu_pasang),
            segmen: extractedSpec.segmen === 'B2B' ? 'B2B' : 'B2C',
          },
          params.priceBook
        );

        harga1Str = `*${formatRupiah(hitung.subtotal_cermin)}*`;
        calculatedNumbers.push(hitung.subtotal_cermin);

        if (sebutOngkir) {
          ongkirStr = `*${formatRupiah(hitung.ongkir.list)}*${isBandungRaya ? '' : ' (include packing kayu aman)'}`;
          totalStr = `*${formatRupiah(hitung.total)}*`;
          dpStr = `*${formatRupiah(hitung.dp_50)}*`;
          pelunasanStr = `*${formatRupiah(hitung.pelunasan)}*`;
          calculatedNumbers.push(hitung.ongkir.list, hitung.total, hitung.dp_50, hitung.pelunasan);
        } else {
          ongkirStr = extractedSpec.kota
            ? `akan dicek dan dihitung oleh admin kargo kami untuk area ${extractedSpec.kota}`
            : 'sesuai lokasi tujuan';
          totalStr = `*${formatRupiah(hitung.subtotal_cermin)}* (belum termasuk ongkir)`;
          dpStr = `*${formatRupiah(hitung.dp_50)}*`;
          pelunasanStr = `*${formatRupiah(hitung.pelunasan)}*`;
          calculatedNumbers.push(hitung.dp_50, hitung.pelunasan);
        }
      } catch (calcErr) {
        console.warn('Gagal hitung pricing.ts:', calcErr);
      }
    }
  }

  // Ekstrak blok DRAFT
  let draftJson: any = null;
  const draftMatch =
    accumulated.match(/<!--\s*DRAFT\s*-->([\s\S]*?)<!--\s*\/DRAFT\s*-->/i) ||
    accumulated.match(/```json\s*<!--\s*DRAFT\s*-->([\s\S]*?)<!--\s*\/DRAFT\s*-->/i);
  if (draftMatch) {
    try {
      draftJson = JSON.parse(draftMatch[1].trim());
    } catch {}
  }

  if (!draftJson) {
    try {
      const cleanJson = accumulated
        .replace(/<!--\s*SPEC\s*-->[\s\S]*?<!--\s*\/SPEC\s*-->/gi, '')
        .replace(/<!--[\s\S]*?-->/g, '')
        .replace(/```json/gi, '')
        .replace(/```/g, '')
        .trim();
      draftJson = JSON.parse(cleanJson);
    } catch {
      const cleanFallbackText = accumulated
        .replace(/<!--\s*SPEC\s*-->[\s\S]*?<!--\s*\/SPEC\s*-->/gi, '')
        .replace(/<!--[\s\S]*?-->/g, '')
        .replace(/```[a-z]*[\s\S]*?```/gi, '')
        .trim();
      draftJson = {
        ringkasan_situasi: 'Draf respon klien',
        tahap: 'kualifikasi',
        keberatan: [],
        draf: [{ label: 'Dorong DP', bubbles: [cleanFallbackText || 'Halo Kak, ada yang bisa kami bantu terkait cermin Putra Glass?'] }],
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

  let rupiahValidation = validateRupiahInDraft(allBubbles, calculatedNumbers, calculatedNumbers);
  let marketplaceValidation = validateMarketplaceGuards(params.overrideKanal || extractedSpec.kanal || 'whatsapp', allBubbles);
  let forbiddenValidation = validateForbiddenPhrases(allBubbles);
  let sentenceCheck = detectBrokenSentence(allBubbles);

  // Auto-rewrite otomatis SEKALI di latar belakang jika draf melanggar SOP atau kalimat terpotong
  if (!rupiahValidation.valid || !marketplaceValidation.valid || !forbiddenValidation.valid || sentenceCheck.isBroken) {
    const issues = [
      ...rupiahValidation.errors,
      ...marketplaceValidation.errors,
      ...forbiddenValidation.errors,
      ...(sentenceCheck.isBroken && sentenceCheck.reason ? [sentenceCheck.reason] : []),
    ];

    try {
      const rewriteUserPrompt = `DRAF SEBELUMNYA:
${allBubbles.join('\n\n')}

DRAF DI ATAS DITOLAK KARENA PELANGGARAN ATURAN:
${issues.map((s) => `- ${s}`).join('\n')}

Tulis ulang draf balasan di atas dengan memperbaiki seluruh pelanggaran tersebut.
Peraturan mutlak perbaikan:
1. JANGAN PERNAH menyebut nama merek kaca apa pun (ASAHI, Mulia, AGC). Jika ditanya merek kaca, tulis persis: "untuk merek saya cek dulu ke tim produksi ya Kak".
2. JANGAN PERNAH menawarkan diskon, potongan harga, gratis, promo, atau bagi ongkir sendiri. Jika klien meminta diskon/bagi ongkir, jawab: "saya bantu cek dulu ke tim ya Kak" dan set "perlu_owner": true.
3. Pastikan setiap kalimat selesai tuntas tanpa kata menggantung.
4. Gunakan penanda harga [[HARGA_1]], [[ONGKIR]], [[TOTAL]], [[DP]], [[PELUNASAN]].

Keluarkan HANYA JSON blok DRAFT:
<!--DRAFT-->
{
  "ringkasan_situasi": "Draf perbaikan otomatis",
  "tahap": "${draftJson.tahap || 'penawaran'}",
  "keberatan": [],
  "segmen_terdeteksi": "${draftJson.segmen_terdeteksi || 'b2c'}",
  "data_kurang": [],
  "draf": [{"label": "Draf Perbaikan", "bubbles": ["...", "..."]}],
  "catatan_internal": "Auto-rewrite diterapkan",
  "perlu_owner": ${Boolean(draftJson.perlu_owner)},
  "alasan_perlu_owner": "${draftJson.alasan_perlu_owner || ''}",
  "langkah_berikutnya": "..."
}
<!--/DRAFT-->`;

      const rewriteRes = await ai.models.generateContent({
        model: modelUsed,
        contents: [{ role: 'user', parts: [{ text: rewriteUserPrompt }] }],
        config: {
          thinkingConfig: { thinkingLevel: ThinkingLevel.MINIMAL },
          maxOutputTokens: 800,
        },
      });
      const rewriteTxt = rewriteRes.text || '';
      const matchRewr = rewriteTxt.match(/<!--DRAFT-->([\s\S]*?)<!--\/DRAFT-->/) || rewriteTxt.match(/```json([\s\S]*?)```/);
      if (matchRewr) {
        const cleanRewr = (matchRewr[1] || rewriteTxt).replace(/<!--[\s\S]*?-->/g, '').trim();
        const parsedRewr = JSON.parse(cleanRewr);
        if (Array.isArray(parsedRewr.draf)) {
          parsedRewr.draf.forEach((d: any) => {
            if (Array.isArray(d.bubbles)) {
              d.bubbles = d.bubbles.map(replacePlaceholders);
            }
          });
          const newBubbles: string[] = [];
          parsedRewr.draf.forEach((d: any) => (d.bubbles || []).forEach((b: string) => newBubbles.push(b)));

          const newRupiah = validateRupiahInDraft(newBubbles, calculatedNumbers, calculatedNumbers);
          const newMkt = validateMarketplaceGuards(params.overrideKanal || extractedSpec.kanal || 'whatsapp', newBubbles);
          const newForb = validateForbiddenPhrases(newBubbles);
          const newSent = detectBrokenSentence(newBubbles);

          if (newRupiah.valid && newMkt.valid && newForb.valid && !newSent.isBroken) {
            draftJson = parsedRewr;
            allBubbles.length = 0;
            allBubbles.push(...newBubbles);
            rupiahValidation = newRupiah;
            marketplaceValidation = newMkt;
            forbiddenValidation = newForb;
            sentenceCheck = newSent;
          }
        }
      }
    } catch (e) {
      console.warn('[AI Pipeline] Auto-rewrite gagal, mempertahankan draf awal:', e);
    }
  }

  const isFallbackModel = modelUsed !== MODEL_MAIN;
  const isRekeningKosong = !params.priceBook.dokumen_pdf?.bank_nomor || params.priceBook.dokumen_pdf.bank_nomor.trim() === '' || params.priceBook.dokumen_pdf.bank_nomor === '[belum diisi]';

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
    is_fallback: isFallbackModel,
    ms_ttft: ttftMs,
    angka_tidak_terverifikasi: !rupiahValidation.valid || !marketplaceValidation.valid || !forbiddenValidation.valid,
    error_validasi_angka: rupiahValidation.errors,
    pelanggaran_marketplace: marketplaceValidation.errors,
    frasa_terlarang_ditemukan: forbiddenValidation.errors,
    discrepancy_warning: discrepancyWarning,
    rekening_kosong: isRekeningKosong,
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
  await logAICall({
    model: modelUsed,
    provider,
    endpoint: 'unifiedDraft',
    langkah: 'draf_terpadu',
    alasan_pindah: hedgingRes.alasanPindah,
    token_in: hedgingRes.inputTokens,
    token_out: hedgingRes.outputTokens,
    biaya_perkiraan: hedgingRes.biayaPerkiraan,
    durasi_ms: durasiMs,
    ms_ttft: ttftMs,
    status: 'success',
    metadata: {
      is_fallback: isFallbackModel,
      rekening_kosong: isRekeningKosong,
      perlu_owner: Boolean(draftJson.perlu_owner),
      angka_tidak_terverifikasi: finalDraftOutput.angka_tidak_terverifikasi,
      alasan_pindah: hedgingRes.alasanPindah,
    },
  });

  return {
    extraction: finalExtraction,
    draf: finalDraftOutput,
    provider,
    modelUsed,
    alasanPindah: hedgingRes.alasanPindah,

    inputTokens: hedgingRes.inputTokens,
    outputTokens: hedgingRes.outputTokens,
    biayaPerkiraan: hedgingRes.biayaPerkiraan,
    durasiMs,
    ttftMs,
    calculatedNumbers,
    discrepancyWarning,
    rekeningKosong: isRekeningKosong,
    perluOwner: Boolean(draftJson.perlu_owner),
    alasanPerluOwner: draftJson.alasan_perlu_owner || '',
    langkahBerikutnya: draftJson.langkah_berikutnya || '',
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

export async function summarizeMemory(
  params: MemoryParams
): Promise<{ kartu_id: string; durationMs: number }> {
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
    const rawResText = res.text || '';

    const parsed = JSON.parse(rawResText || '{}');
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
