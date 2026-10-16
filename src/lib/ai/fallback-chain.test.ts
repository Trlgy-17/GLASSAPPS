import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  parseDraftChain,
  executeWithHedgingAndFallback,
  setModelDailyQuotaExhausted,
  resetAllDailyQuota,
  isModelDailyQuotaExhausted,
  calculateEstimatedCostRupiah,
  formatModelDisplayName,
  AI_ALL_EXHAUSTED_MESSAGE,
  ChainTarget,
} from './fallback-chain';

describe('AI Fallback Chain Engine (Rantai Gemini Murni)', () => {
  beforeEach(() => {
    resetAllDailyQuota();
  });

  it('1. Parsing AI_DRAFT_CHAIN dari string konfigurasi ke target chain Gemini yang valid', () => {
    const chain = parseDraftChain(
      'gemini:gemini-3.6-flash,gemini:gemini-3.8-flash,gemini:gemini-3.5-flash-lite'
    );
    expect(chain.length).toBe(3);
    expect(chain[0]).toEqual({ provider: 'gemini', model: 'gemini-3.6-flash' });
    expect(chain[1]).toEqual({ provider: 'gemini', model: 'gemini-3.8-flash' });
    expect(chain[2]).toEqual({ provider: 'gemini', model: 'gemini-3.5-flash-lite' });
  });

  it('2. Simulasi Gemini 503 (Overloaded) -> Langsung pindah ke model berikutnya tanpa retry', async () => {
    const callLog: string[] = [];
    const chain: ChainTarget[] = [
      { provider: 'gemini', model: 'gemini-3.6-flash' },
      { provider: 'gemini', model: 'gemini-3.8-flash' },
    ];

    const res = await executeWithHedgingAndFallback({
      chain,
      hedgingTimeoutMs: 4000,
      executeFn: async (target) => {
        callLog.push(`${target.provider}:${target.model}`);
        if (target.model === 'gemini-3.6-flash') {
          const err: any = new Error('503 Service Unavailable: Model is overloaded');
          err.status = 503;
          throw err;
        }
        return {
          result: 'Draf dari Gemini 3.8 Flash',
          inputTokens: 500,
          outputTokens: 150,
        };
      },
    });

    expect(callLog).toEqual(['gemini:gemini-3.6-flash', 'gemini:gemini-3.8-flash']);
    expect(res.winner).toEqual({ provider: 'gemini', model: 'gemini-3.8-flash' });
    expect(res.alasanPindah).toBe('503');
    expect(res.result).toBe('Draf dari Gemini 3.8 Flash');
  });

  it('3. Simulasi 429 Kuota Harian pada model tertentu -> Model itu dilewati sampai reset & panggilan berikutnya langsung pakai model kedua', async () => {
    const chain: ChainTarget[] = [
      { provider: 'gemini', model: 'gemini-3.6-flash' },
      { provider: 'gemini', model: 'gemini-3.5-flash-lite' },
    ];

    // Panggilan pertama: gemini-3.6-flash terkena 429
    const callLog1: string[] = [];
    const res1 = await executeWithHedgingAndFallback({
      chain,
      hedgingTimeoutMs: 4000,
      executeFn: async (target) => {
        callLog1.push(target.model);
        if (target.model === 'gemini-3.6-flash') {
          const err: any = new Error('Resource has been exhausted (e.g. check quota). PerDay limit reached.');
          err.status = 429;
          throw err;
        }
        return { result: 'Draf dari Gemini 3.5 Flash Lite' };
      },
    });

    expect(res1.winner.model).toBe('gemini-3.5-flash-lite');
    expect(res1.alasanPindah).toBe('429');
    expect(isModelDailyQuotaExhausted('gemini-3.6-flash')).toBe(true);

    // Panggilan kedua: gemini-3.6-flash langsung dilewati tanpa dicoba
    const callLog2: string[] = [];
    const res2 = await executeWithHedgingAndFallback({
      chain,
      hedgingTimeoutMs: 4000,
      executeFn: async (target) => {
        callLog2.push(target.model);
        return { result: 'Draf kedua langsung dari Gemini 3.5 Flash Lite' };
      },
    });

    expect(callLog2).toEqual(['gemini-3.5-flash-lite']);
    expect(res2.winner.model).toBe('gemini-3.5-flash-lite');
  });

  it('4. Simulasi Hedging 4 Detik: Model pertama lambat (>4 dtk) -> Model kedua dipanggil paralel & yang selesai duluan menang', async () => {
    vi.useFakeTimers();
    try {
      const chain: ChainTarget[] = [
        { provider: 'gemini', model: 'gemini-3.6-flash' },
        { provider: 'gemini', model: 'gemini-3.8-flash' },
      ];

      const callLog: string[] = [];

      const executionPromise = executeWithHedgingAndFallback({
        chain,
        hedgingTimeoutMs: 4000,
        executeFn: async (target, signal) => {
          callLog.push(target.model);
          if (target.model === 'gemini-3.6-flash') {
            return new Promise((_, reject) => {
              signal.addEventListener('abort', () => reject(new Error('Aborted by hedging')));
            });
          } else {
            return { result: 'Draf dari Gemini 3.8 Flash Cepat' };
          }
        },
      });

      // Majukan timer fake 4001ms
      await vi.advanceTimersByTimeAsync(4001);

      const res = await executionPromise;
      expect(res.winner.model).toBe('gemini-3.8-flash');
      expect(res.result).toBe('Draf dari Gemini 3.8 Flash Cepat');
      expect(res.alasanPindah).toBe('timeout');
      expect(callLog).toContain('gemini-3.6-flash');
      expect(callLog).toContain('gemini-3.8-flash');
    } finally {
      vi.useRealTimers();
    }
  });

  it('5. Jika semua model habis / gagal -> Melempar pesan "AI sedang penuh. Ketik balasan manual atau pakai Kalkulator."', async () => {
    const chain: ChainTarget[] = [
      { provider: 'gemini', model: 'gemini-3.6-flash' },
      { provider: 'gemini', model: 'gemini-3.8-flash' },
    ];

    await expect(
      executeWithHedgingAndFallback({
        chain,
        hedgingTimeoutMs: 4000,
        executeFn: async () => {
          throw new Error('503 Service Unavailable');
        },
      })
    ).rejects.toThrow(AI_ALL_EXHAUSTED_MESSAGE);
  });

  it('6. Format display nama model Gemini bersih dan tepat', () => {
    expect(formatModelDisplayName('gemini-3.6-flash')).toBe('Gemini 3.6 Flash');
    expect(formatModelDisplayName('gemini-3.8-flash')).toBe('Gemini 3.8 Flash');
    expect(formatModelDisplayName('gemini-3.5-flash-lite')).toBe('Gemini 3.5 Flash Lite');
  });

  it('7. Penghitungan estimasi biaya Rupiah akurat per model Gemini', () => {
    // Gemini 3.5 Flash Lite: 1.000 in, 500 out -> ($0.075*1k + $0.30*0.5k)/1M = $0.000225 -> ~Rp3.6
    const costLite = calculateEstimatedCostRupiah('gemini-3.5-flash-lite', 1000, 500);
    expect(costLite).toBeGreaterThan(3);
    expect(costLite).toBeLessThan(5);

    // Gemini 3.6 Flash: 1.000 in, 500 out -> ($0.15*1k + $0.60*0.5k)/1M = $0.00045 -> ~Rp7.2
    const cost36 = calculateEstimatedCostRupiah('gemini-3.6-flash', 1000, 500);
    expect(cost36).toBeGreaterThan(7);
    expect(cost36).toBeLessThan(8);

    // Gemini 3.8 Flash: 1.000 in, 500 out -> ($0.20*1k + $0.80*0.5k)/1M = $0.0006 -> ~Rp9.6
    const cost38 = calculateEstimatedCostRupiah('gemini-3.8-flash', 1000, 500);
    expect(cost38).toBeGreaterThan(9);
    expect(cost38).toBeLessThan(11);
  });
});
