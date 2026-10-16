import { formatRupiah } from '@/lib/pricing/format-rupiah';
import {
  setClaudeInactive,
  getClaudeInactiveState,
  resetClaudeInactive,
} from './anthropic-provider';

export interface ChainTarget {
  provider: 'gemini' | 'anthropic';
  model: string;
}

export interface HedgingExecutionResult<T> {
  result: T;
  winner: ChainTarget;
  alasanPindah: string | null;
  ttftMs: number;
  totalMs: number;
  claudeWarning?: string | null;
  inputTokens: number;
  outputTokens: number;
  biayaPerkiraan: number;
}

// In-memory status quota harian Gemini
let _geminiDailyQuotaExhaustedUntil: number | null = null;

export function getGeminiDailyQuotaExhaustedUntil(): number | null {
  if (_geminiDailyQuotaExhaustedUntil && Date.now() > _geminiDailyQuotaExhaustedUntil) {
    _geminiDailyQuotaExhaustedUntil = null;
  }
  return _geminiDailyQuotaExhaustedUntil;
}

export function setGeminiDailyQuotaExhausted(): number {
  const resetDate = calculateNextQuotaResetWib();
  _geminiDailyQuotaExhaustedUntil = resetDate.getTime();
  return _geminiDailyQuotaExhaustedUntil;
}

export function resetGeminiDailyQuota(): void {
  _geminiDailyQuotaExhaustedUntil = null;
}

/**
 * Hitung waktu reset kuota harian Gemini (± 14.30 / 15.00 WIB, ~14 jam ke depan)
 */
export function calculateNextQuotaResetWib(): Date {
  const now = new Date();
  // Reset harian Gemini terjadi setiap pukul 14:00 - 15:00 WIB (00:00 PST)
  // Set durasi minimal 14 jam ke depan
  return new Date(now.getTime() + 14 * 3600 * 1000);
}

/**
 * Parsing chain string:
 * e.g. "gemini:gemini-3.6-flash,anthropic:claude-haiku-5-5,gemini:gemini-3.5-flash-lite"
 */
export function parseDraftChain(chainStr?: string): ChainTarget[] {
  const raw =
    chainStr ||
    process.env.AI_DRAFT_CHAIN ||
    'gemini:gemini-3.6-flash,anthropic:claude-haiku-5-5,gemini:gemini-3.5-flash-lite';

  const parts = raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  const targets: ChainTarget[] = [];
  for (const part of parts) {
    if (part.includes(':')) {
      const [prov, mdl] = part.split(':');
      const cleanProv = prov.trim().toLowerCase() === 'anthropic' ? 'anthropic' : 'gemini';
      targets.push({ provider: cleanProv, model: mdl.trim() });
    } else {
      const cleanProv = part.toLowerCase().includes('claude') ? 'anthropic' : 'gemini';
      targets.push({ provider: cleanProv, model: part.trim() });
    }
  }

  return targets.length > 0
    ? targets
    : [
        { provider: 'gemini', model: 'gemini-3.6-flash' },
        { provider: 'anthropic', model: 'claude-haiku-5-5' },
        { provider: 'gemini', model: 'gemini-3.5-flash-lite' },
      ];
}

/**
 * Hitung perkiraan biaya dalam mata uang Rupiah
 * Kurs acuan $1 = Rp16.000
 */
export function calculateEstimatedCostRupiah(
  provider: 'gemini' | 'anthropic',
  model: string,
  tokenIn: number,
  tokenOut: number
): number {
  const USD_TO_IDR = 16000;
  if (provider === 'anthropic') {
    // Claude Haiku 5.5: $0.80 / 1M input, $4.00 / 1M output
    const costUsd = (tokenIn * 0.8 + tokenOut * 4.0) / 1000000;
    return Math.round(costUsd * USD_TO_IDR * 100) / 100;
  }

  const lowerModel = model.toLowerCase();
  if (lowerModel.includes('lite') || lowerModel.includes('flash-lite')) {
    // Gemini 3.5 Flash Lite: $0.075 / 1M input, $0.30 / 1M output
    const costUsd = (tokenIn * 0.075 + tokenOut * 0.3) / 1000000;
    return Math.round(costUsd * USD_TO_IDR * 100) / 100;
  }

  // Gemini 3.6 Flash: $0.15 / 1M input, $0.60 / 1M output
  const costUsd = (tokenIn * 0.15 + tokenOut * 0.6) / 1000000;
  return Math.round(costUsd * USD_TO_IDR * 100) / 100;
}

/**
 * Periksa apakah target provider saat ini tersedia untuk dipanggil
 */
export function checkTargetAvailability(target: ChainTarget): {
  available: boolean;
  skipReason?: string;
  claudeWarning?: string;
} {
  if (target.provider === 'gemini') {
    const exhaustedUntil = getGeminiDailyQuotaExhaustedUntil();
    if (exhaustedUntil && Date.now() < exhaustedUntil && target.model === 'gemini-3.6-flash') {
      return {
        available: false,
        skipReason: '429_daily_exhausted',
      };
    }
  }

  if (target.provider === 'anthropic') {
    const state = getClaudeInactiveState();
    if (!state.active && state.message) {
      return {
        available: false,
        skipReason: state.reason || 'claude_inactive',
        claudeWarning: state.message,
      };
    }
  }

  return { available: true };
}

/**
 * Analisis error dari pemanggilan provider untuk menentukan tindakan fallback
 */
export function classifyProviderError(
  target: ChainTarget,
  err: any
): {
  isRetryableOnSameProvider: boolean;
  switchReason: string;
  claudeWarning?: string;
} {
  const errMsg = String(err?.message || err || '').toLowerCase();
  const status = Number(err?.status || err?.statusCode || 0);

  // 1. Error Gemini Kuota Harian (429 Resource Exhausted)
  if (target.provider === 'gemini') {
    if (status === 429 || errMsg.includes('resource_exhausted') || errMsg.includes('quota')) {
      const isDaily =
        errMsg.includes('perday') ||
        errMsg.includes('per_day') ||
        errMsg.includes('daily') ||
        errMsg.includes('day');
      if (isDaily) {
        setGeminiDailyQuotaExhausted();
      }
      return {
        isRetryableOnSameProvider: false,
        switchReason: '429',
      };
    }
    if (status === 503 || errMsg.includes('503') || errMsg.includes('overloaded') || errMsg.includes('unavailable')) {
      return {
        isRetryableOnSameProvider: false,
        switchReason: '503',
      };
    }

    if (errMsg.includes('timeout') || errMsg.includes('deadline')) {
      return {
        isRetryableOnSameProvider: false,
        switchReason: 'timeout',
      };
    }
  }

  // 2. Error Anthropic (Claude)
  if (target.provider === 'anthropic') {
    // 400 Saldo habis: "Your credit balance is too low to access the Anthropic API"
    if (
      (status === 400 && errMsg.includes('credit balance')) ||
      errMsg.includes('plans & billing') ||
      errMsg.includes('balance is too low')
    ) {
      const msg = 'AI cadangan (Claude) tidak aktif: cek saldo/API key.';
      setClaudeInactive('saldo', msg);
      return {
        isRetryableOnSameProvider: false,
        switchReason: 'saldo_habis',
        claudeWarning: msg,
      };
    }

    // 401 API Key kedaluwarsa atau salah
    if (status === 401 || errMsg.includes('invalid x-api-key') || errMsg.includes('authentication_error')) {
      const msg = 'API key Claude kedaluwarsa atau salah. Ganti di .env lalu restart aplikasi.';
      setClaudeInactive('key_invalid', msg);
      return {
        isRetryableOnSameProvider: false,
        switchReason: '401',
        claudeWarning: msg,
      };
    }

    // 529 / 503 Overloaded
    if (status === 529 || status === 503 || errMsg.includes('529') || errMsg.includes('overloaded')) {
      return {
        isRetryableOnSameProvider: false,
        switchReason: '529',
      };
    }

    // 429 Rate limit evaluasi
    if (status === 429 || errMsg.includes('rate limit')) {
      return {
        isRetryableOnSameProvider: false,
        switchReason: '429',
      };
    }

    if (errMsg.includes('timeout') || errMsg.includes('abort')) {
      return {
        isRetryableOnSameProvider: false,
        switchReason: 'timeout',
      };
    }
  }

  return {
    isRetryableOnSameProvider: false,
    switchReason: status ? String(status) : 'error',
  };
}

/**
 * Runner terpadu dengan Hedging 4 detik & Fallback Chain
 */
export async function executeWithHedgingAndFallback<T>(params: {
  chain?: ChainTarget[];
  executeFn: (
    target: ChainTarget,
    signal: AbortSignal,
    onChunk: (chunk: string) => void
  ) => Promise<{
    result: T;
    inputTokens?: number;
    outputTokens?: number;
  }>;
  onStreamChunk?: (chunk: string) => void;
  hedgingTimeoutMs?: number; // default 4000 ms
}): Promise<HedgingExecutionResult<T>> {
  const chain = params.chain || parseDraftChain();
  const hedgingMs = params.hedgingTimeoutMs ?? 4000;
  let lastClaudeWarning: string | null = null;
  let lastReason: string | null = null;

  // Saring target yang tersedia
  const availableTargets: Array<{ target: ChainTarget; skipReason?: string }> = [];
  for (const t of chain) {
    const avail = checkTargetAvailability(t);
    if (avail.available) {
      availableTargets.push({ target: t });
    } else {
      if (avail.claudeWarning) lastClaudeWarning = avail.claudeWarning;
      if (avail.skipReason && !lastReason) lastReason = avail.skipReason;
    }
  }

  if (availableTargets.length === 0) {
    // Jika seluruh target tersaring, tetap coba target di chain (fallback safety)
    for (const t of chain) {
      availableTargets.push({ target: t });
    }
  }

  // Coba target berurutan dengan hedging jika ada target cadangan
  for (let i = 0; i < availableTargets.length; i++) {
    const primary = availableTargets[i].target;
    const secondary = i + 1 < availableTargets.length ? availableTargets[i + 1].target : null;

    const primaryController = new AbortController();
    const secondaryController = secondary ? new AbortController() : null;

    let primaryGotToken = false;
    let primaryTtft = 0;
    const t0 = Date.now();

    const primaryPromise = (async () => {
      return params.executeFn(primary, primaryController.signal, (chunk) => {
        if (!primaryGotToken) {
          primaryGotToken = true;
          primaryTtft = Date.now() - t0;
        }
        params.onStreamChunk?.(chunk);
      });
    })();

    // Tangkap rejection secara lokal agar tidak menimbulkan unhandled rejection di Node runtime
    const safePrimaryPromise = primaryPromise
      .then((res) => ({ type: 'primary_done' as const, res }))
      .catch((err) => ({ type: 'primary_error' as const, err }));

    // Jika tidak ada target berikutnya atau hedging dimatikan
    if (!secondary || hedgingMs <= 0) {
      const outcome = await safePrimaryPromise;
      if (outcome.type === 'primary_done') {
        const totalMs = Date.now() - t0;
        const inTok = outcome.res.inputTokens || 0;
        const outTok = outcome.res.outputTokens || 0;
        return {
          result: outcome.res.result,
          winner: primary,
          alasanPindah: lastReason,
          ttftMs: primaryTtft || totalMs,
          totalMs,
          claudeWarning: lastClaudeWarning,
          inputTokens: inTok,
          outputTokens: outTok,
          biayaPerkiraan: calculateEstimatedCostRupiah(primary.provider, primary.model, inTok, outTok),
        };
      } else {
        primaryController.abort();
        const classified = classifyProviderError(primary, outcome.err);
        lastReason = classified.switchReason;
        if (classified.claudeWarning) lastClaudeWarning = classified.claudeWarning;
        continue;
      }
    }

    // Ada target cadangan -> Pasang Timer Hedging
    let hedgingTimer: any;
    const hedgingTimerPromise = new Promise<{ type: 'hedging_timeout' }>((resolve) => {
      hedgingTimer = setTimeout(() => {
        if (!primaryGotToken) {
          resolve({ type: 'hedging_timeout' });
        }
      }, hedgingMs);
    });

    safePrimaryPromise.finally(() => clearTimeout(hedgingTimer));

    const race1 = await Promise.race([safePrimaryPromise, hedgingTimerPromise]);

    if (race1.type === 'primary_done') {
      clearTimeout(hedgingTimer);
      const totalMs = Date.now() - t0;
      const inTok = race1.res.inputTokens || 0;
      const outTok = race1.res.outputTokens || 0;
      return {
        result: race1.res.result,
        winner: primary,
        alasanPindah: lastReason,
        ttftMs: primaryTtft || totalMs,
        totalMs,
        claudeWarning: lastClaudeWarning,
        inputTokens: inTok,
        outputTokens: outTok,
        biayaPerkiraan: calculateEstimatedCostRupiah(primary.provider, primary.model, inTok, outTok),
      };
    }

    if (race1.type === 'primary_error') {
      clearTimeout(hedgingTimer);
      primaryController.abort();
      const classified = classifyProviderError(primary, race1.err);
      lastReason = classified.switchReason;
      if (classified.claudeWarning) lastClaudeWarning = classified.claudeWarning;

      // Primary langsung error -> panggil secondary langsung tanpa tunggu hedging
      try {
        const tSec0 = Date.now();
        const secRes = await params.executeFn(secondary, secondaryController!.signal, (chunk) => {
          params.onStreamChunk?.(chunk);
        });
        const totalMs = Date.now() - t0;
        const inTok = secRes.inputTokens || 0;
        const outTok = secRes.outputTokens || 0;
        return {
          result: secRes.result,
          winner: secondary,
          alasanPindah: lastReason,
          ttftMs: Date.now() - tSec0,
          totalMs,
          claudeWarning: lastClaudeWarning,
          inputTokens: inTok,
          outputTokens: outTok,
          biayaPerkiraan: calculateEstimatedCostRupiah(secondary.provider, secondary.model, inTok, outTok),
        };
      } catch (secErr: any) {
        secondaryController?.abort();
        const classifiedSec = classifyProviderError(secondary, secErr);
        lastReason = classifiedSec.switchReason;
        if (classifiedSec.claudeWarning) lastClaudeWarning = classifiedSec.claudeWarning;
        i++; // lewati secondary yang gagal
        continue;
      }
    }

    // Hedging timeout (4 detik token belum datang) -> Jalankan secondary secara paralel
    lastReason = 'hedging_4s';
    let secondaryTtft = 0;
    let secondaryGotToken = false;
    const tSecondary0 = Date.now();

    const secondaryPromise = (async () => {
      return params.executeFn(secondary, secondaryController!.signal, (chunk) => {
        if (!secondaryGotToken) {
          secondaryGotToken = true;
          secondaryTtft = Date.now() - tSecondary0;
        }
        params.onStreamChunk?.(chunk);
      });
    })();

    const safeSecondaryPromise = secondaryPromise
      .then((res) => ({ winner: 'secondary' as const, res }))
      .catch((err) => ({ winner: 'secondary_error' as const, err }));

    const winnerRace = await Promise.race([
      safePrimaryPromise.then((o) =>
        o.type === 'primary_done'
          ? ({ winner: 'primary' as const, res: o.res })
          : ({ winner: 'primary_error' as const, err: o.err })
      ),
      safeSecondaryPromise,
    ]);

    if (winnerRace.winner === 'primary') {
      secondaryController?.abort();
      const totalMs = Date.now() - t0;
      const inTok = winnerRace.res.inputTokens || 0;
      const outTok = winnerRace.res.outputTokens || 0;
      return {
        result: winnerRace.res.result,
        winner: primary,
        alasanPindah: 'hedging_resolved_primary',
        ttftMs: primaryTtft || totalMs,
        totalMs,
        claudeWarning: lastClaudeWarning,
        inputTokens: inTok,
        outputTokens: outTok,
        biayaPerkiraan: calculateEstimatedCostRupiah(primary.provider, primary.model, inTok, outTok),
      };
    } else if (winnerRace.winner === 'secondary') {
      primaryController.abort();
      const totalMs = Date.now() - t0;
      const inTok = winnerRace.res.inputTokens || 0;
      const outTok = winnerRace.res.outputTokens || 0;
      return {
        result: winnerRace.res.result,
        winner: secondary,
        alasanPindah: 'hedging_4s',
        ttftMs: secondaryTtft || totalMs,
        totalMs,
        claudeWarning: lastClaudeWarning,
        inputTokens: inTok,
        outputTokens: outTok,
        biayaPerkiraan: calculateEstimatedCostRupiah(secondary.provider, secondary.model, inTok, outTok),
      };
    } else if (winnerRace.winner === 'primary_error') {
      const classified = classifyProviderError(primary, winnerRace.err);
      lastReason = classified.switchReason;
      if (classified.claudeWarning) lastClaudeWarning = classified.claudeWarning;

      const secOutcome = await safeSecondaryPromise;
      if (secOutcome.winner === 'secondary') {
        const totalMs = Date.now() - t0;
        const inTok = secOutcome.res.inputTokens || 0;
        const outTok = secOutcome.res.outputTokens || 0;
        return {
          result: secOutcome.res.result,
          winner: secondary,
          alasanPindah: lastReason,
          ttftMs: secondaryTtft || totalMs,
          totalMs,
          claudeWarning: lastClaudeWarning,
          inputTokens: inTok,
          outputTokens: outTok,
          biayaPerkiraan: calculateEstimatedCostRupiah(secondary.provider, secondary.model, inTok, outTok),
        };
      } else {
        secondaryController?.abort();
        const classifiedSec = classifyProviderError(secondary, secOutcome.err);
        lastReason = classifiedSec.switchReason;
        if (classifiedSec.claudeWarning) lastClaudeWarning = classifiedSec.claudeWarning;
        i++;
        continue;
      }
    } else {
      // secondary_error -> tunggu primary
      const classifiedSec = classifyProviderError(secondary, (winnerRace as any).err);
      if (classifiedSec.claudeWarning) lastClaudeWarning = classifiedSec.claudeWarning;

      const priOutcome = await safePrimaryPromise;
      if (priOutcome.type === 'primary_done') {
        const totalMs = Date.now() - t0;
        const inTok = priOutcome.res.inputTokens || 0;
        const outTok = priOutcome.res.outputTokens || 0;
        return {
          result: priOutcome.res.result,
          winner: primary,
          alasanPindah: lastReason,
          ttftMs: primaryTtft || totalMs,
          totalMs,
          claudeWarning: lastClaudeWarning,
          inputTokens: inTok,
          outputTokens: outTok,
          biayaPerkiraan: calculateEstimatedCostRupiah(primary.provider, primary.model, inTok, outTok),
        };
      } else {
        primaryController.abort();
        const classifiedPri = classifyProviderError(primary, priOutcome.err);
        lastReason = classifiedPri.switchReason;
        i++;
        continue;
      }
    }
  }

  throw new Error(
    lastClaudeWarning ||
      'Server AI sedang sibuk. Screenshot & catatan tetap tersimpan, klik Coba Lagi.'
  );
}
