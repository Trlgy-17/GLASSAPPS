export interface ChainTarget {
  provider: 'gemini';
  model: string;
}

export interface HedgingExecutionResult<T> {
  result: T;
  winner: ChainTarget;
  alasanPindah: string | null;
  ttftMs: number;
  totalMs: number;
  inputTokens: number;
  outputTokens: number;
  biayaPerkiraan: number;
}

// In-memory status kuota harian per model Gemini
// model -> timestamp reset (ms)
const _modelDailyQuotaExhausted = new Map<string, number>();

export function isModelDailyQuotaExhausted(model: string): boolean {
  const until = _modelDailyQuotaExhausted.get(model);
  if (!until) return false;
  if (Date.now() > until) {
    _modelDailyQuotaExhausted.delete(model);
    return false;
  }
  return true;
}

export function setModelDailyQuotaExhausted(model: string): number {
  const resetDate = calculateNextQuotaResetWib();
  const resetMs = resetDate.getTime();
  _modelDailyQuotaExhausted.set(model, resetMs);
  return resetMs;
}

export function resetAllDailyQuota(): void {
  _modelDailyQuotaExhausted.clear();
}

export function getDailyQuotaStatus(): Record<string, number> {
  const status: Record<string, number> = {};
  for (const [mdl, until] of _modelDailyQuotaExhausted.entries()) {
    if (Date.now() <= until) {
      status[mdl] = until;
    }
  }
  return status;
}

/**
 * Hitung waktu reset kuota harian Gemini (± 14.30 / 15.00 WIB, ~14 jam ke depan)
 */
export function calculateNextQuotaResetWib(): Date {
  const now = new Date();
  return new Date(now.getTime() + 14 * 3600 * 1000);
}

/**
 * Format nama display model untuk UI
 */
export function formatModelDisplayName(modelName?: string | null): string {
  if (!modelName) return 'Gemini 3.6 Flash';
  const lower = modelName.toLowerCase();
  if (lower.includes('3.8')) return 'Gemini 3.8 Flash';
  if (lower.includes('3.6')) return 'Gemini 3.6 Flash';
  if (lower.includes('3.5') || lower.includes('lite')) return 'Gemini 3.5 Flash Lite';
  return modelName;
}

/**
 * Parsing chain string:
 * Default: gemini:gemini-3.6-flash,gemini:gemini-3.8-flash,gemini:gemini-3.5-flash-lite
 */
export function parseDraftChain(chainStr?: string): ChainTarget[] {
  const raw =
    chainStr ||
    process.env.AI_DRAFT_CHAIN ||
    'gemini:gemini-3.6-flash,gemini:gemini-3.8-flash,gemini:gemini-3.5-flash-lite';

  const parts = raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  const targets: ChainTarget[] = [];
  for (const part of parts) {
    const clean = part.replace(/^gemini:/i, '').trim();
    if (clean) {
      targets.push({ provider: 'gemini', model: clean });
    }
  }

  return targets.length > 0
    ? targets
    : [
        { provider: 'gemini', model: 'gemini-3.6-flash' },
        { provider: 'gemini', model: 'gemini-3.8-flash' },
        { provider: 'gemini', model: 'gemini-3.5-flash-lite' },
      ];
}

/**
 * Hitung perkiraan biaya model Gemini dalam Rupiah ($1 = Rp16.000)
 */
export function calculateEstimatedCostRupiah(
  model: string,
  tokenIn: number,
  tokenOut: number
): number {
  const USD_TO_IDR = 16000;
  const lower = model.toLowerCase();

  if (lower.includes('lite') || lower.includes('flash-lite')) {
    // Gemini 3.5 Flash Lite: $0.075 / 1M in, $0.30 / 1M out
    const costUsd = (tokenIn * 0.075 + tokenOut * 0.3) / 1000000;
    return Math.round(costUsd * USD_TO_IDR * 100) / 100;
  }

  if (lower.includes('3.8')) {
    // Gemini 3.8 Flash: $0.20 / 1M in, $0.80 / 1M out
    const costUsd = (tokenIn * 0.2 + tokenOut * 0.8) / 1000000;
    return Math.round(costUsd * USD_TO_IDR * 100) / 100;
  }

  // Gemini 3.6 Flash / default: $0.15 / 1M in, $0.60 / 1M out
  const costUsd = (tokenIn * 0.15 + tokenOut * 0.6) / 1000000;
  return Math.round(costUsd * USD_TO_IDR * 100) / 100;
}

/**
 * Periksa apakah target model saat ini tersedia untuk dipanggil
 */
export function checkTargetAvailability(target: ChainTarget): {
  available: boolean;
  skipReason?: string;
} {
  if (isModelDailyQuotaExhausted(target.model)) {
    return {
      available: false,
      skipReason: '429_daily_exhausted',
    };
  }
  return { available: true };
}

/**
 * Analisis error dari pemanggilan model Gemini untuk menentukan tindakan fallback
 */
export function classifyProviderError(
  target: ChainTarget,
  err: any
): {
  isRetryableOnSameProvider: boolean;
  switchReason: string;
} {
  const errMsg = String(err?.message || err || '').toLowerCase();
  const status = Number(err?.status || err?.statusCode || 0);

  if (status === 429 || errMsg.includes('resource_exhausted') || errMsg.includes('quota')) {
    const isDaily =
      errMsg.includes('perday') ||
      errMsg.includes('per_day') ||
      errMsg.includes('daily') ||
      errMsg.includes('day') ||
      status === 429;
    if (isDaily) {
      setModelDailyQuotaExhausted(target.model);
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

  return {
    isRetryableOnSameProvider: false,
    switchReason: status ? String(status) : 'error',
  };
}

export const AI_ALL_EXHAUSTED_MESSAGE =
  'AI sedang penuh. Ketik balasan manual atau pakai Kalkulator.';

/**
 * Runner terpadu rantai model Gemini dengan Hedging 4 detik
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
  let lastReason: string | null = null;

  // Saring target yang tidak terkena kuota harian
  const availableTargets: Array<{ target: ChainTarget; skipReason?: string }> = [];
  for (const t of chain) {
    const avail = checkTargetAvailability(t);
    if (avail.available) {
      availableTargets.push({ target: t });
    } else if (avail.skipReason && !lastReason) {
      lastReason = avail.skipReason;
    }
  }

  // Jika semua target tersaring karena kuota harian, tetap coba model fallback terakhir
  if (availableTargets.length === 0) {
    for (const t of chain) {
      availableTargets.push({ target: t });
    }
  }

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

    const safePrimaryPromise = primaryPromise
      .then((res) => ({ type: 'primary_done' as const, res }))
      .catch((err) => ({ type: 'primary_error' as const, err }));

    // Jika tidak ada target cadangan atau hedging dinonaktifkan
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
          inputTokens: inTok,
          outputTokens: outTok,
          biayaPerkiraan: calculateEstimatedCostRupiah(primary.model, inTok, outTok),
        };
      } else {
        primaryController.abort();
        const classified = classifyProviderError(primary, outcome.err);
        lastReason = classified.switchReason;
        continue;
      }
    }

    // Ada target cadangan -> Pasang Timer Hedging 4 detik
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
        inputTokens: inTok,
        outputTokens: outTok,
        biayaPerkiraan: calculateEstimatedCostRupiah(primary.model, inTok, outTok),
      };
    }

    if (race1.type === 'primary_error') {
      clearTimeout(hedgingTimer);
      primaryController.abort();
      const classified = classifyProviderError(primary, race1.err);
      lastReason = classified.switchReason;

      // Primary langsung error (503/429/timeout) -> langsung jalankan secondary tanpa tunggu 4 dtk
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
          inputTokens: inTok,
          outputTokens: outTok,
          biayaPerkiraan: calculateEstimatedCostRupiah(secondary.model, inTok, outTok),
        };
      } catch (secErr: any) {
        secondaryController?.abort();
        const classifiedSec = classifyProviderError(secondary, secErr);
        lastReason = classifiedSec.switchReason;
        i++; // lewati secondary yang gagal
        continue;
      }
    }

    // Hedging timeout 4 detik -> jalankan secondary paralel
    lastReason = 'timeout';
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
        inputTokens: inTok,
        outputTokens: outTok,
        biayaPerkiraan: calculateEstimatedCostRupiah(primary.model, inTok, outTok),
      };
    } else if (winnerRace.winner === 'secondary') {
      primaryController.abort();
      const totalMs = Date.now() - t0;
      const inTok = winnerRace.res.inputTokens || 0;
      const outTok = winnerRace.res.outputTokens || 0;
      return {
        result: winnerRace.res.result,
        winner: secondary,
        alasanPindah: 'timeout',
        ttftMs: secondaryTtft || totalMs,
        totalMs,
        inputTokens: inTok,
        outputTokens: outTok,
        biayaPerkiraan: calculateEstimatedCostRupiah(secondary.model, inTok, outTok),
      };
    } else if (winnerRace.winner === 'primary_error') {
      const classified = classifyProviderError(primary, winnerRace.err);
      lastReason = classified.switchReason;

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
          inputTokens: inTok,
          outputTokens: outTok,
          biayaPerkiraan: calculateEstimatedCostRupiah(secondary.model, inTok, outTok),
        };
      } else {
        secondaryController?.abort();
        const classifiedSec = classifyProviderError(secondary, secOutcome.err);
        lastReason = classifiedSec.switchReason;
        i++;
        continue;
      }
    } else {
      const classifiedSec = classifyProviderError(secondary, (winnerRace as any).err);
      lastReason = classifiedSec.switchReason;

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
          inputTokens: inTok,
          outputTokens: outTok,
          biayaPerkiraan: calculateEstimatedCostRupiah(primary.model, inTok, outTok),
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

  const err: any = new Error(AI_ALL_EXHAUSTED_MESSAGE);
  err.code = 'ALL_EXHAUSTED';
  throw err;
}
