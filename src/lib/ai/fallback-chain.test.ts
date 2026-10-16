import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  parseDraftChain,
  executeWithHedgingAndFallback,
  setGeminiDailyQuotaExhausted,
  resetGeminiDailyQuota,
  getGeminiDailyQuotaExhaustedUntil,
  calculateEstimatedCostRupiah,
  ChainTarget,
} from './fallback-chain';
import {
  setClaudeInactive,
  resetClaudeInactive,
  getClaudeInactiveState,
} from './anthropic-provider';

describe('AI Fallback Chain Engine (Gemini & Claude Auto-Fallback)', () => {
  beforeEach(() => {
    resetGeminiDailyQuota();
    resetClaudeInactive();
  });

  it('1. Parsing AI_DRAFT_CHAIN dari string konfigurasi ke target chain yang valid', () => {
    const chain = parseDraftChain(
      'gemini:gemini-3.6-flash,anthropic:claude-haiku-5-5,gemini:gemini-3.5-flash-lite'
    );
    expect(chain.length).toBe(3);
    expect(chain[0]).toEqual({ provider: 'gemini', model: 'gemini-3.6-flash' });
    expect(chain[1]).toEqual({ provider: 'anthropic', model: 'claude-haiku-5-5' });
    expect(chain[2]).toEqual({ provider: 'gemini', model: 'gemini-3.5-flash-lite' });
  });

  it('2. Simulasi Gemini 503 (Overloaded) -> Langsung pindah ke Claude tanpa retry di Gemini', async () => {
    const callLog: string[] = [];
    const chain: ChainTarget[] = [
      { provider: 'gemini', model: 'gemini-3.6-flash' },
      { provider: 'anthropic', model: 'claude-haiku-5-5' },
    ];

    const res = await executeWithHedgingAndFallback({
      chain,
      hedgingTimeoutMs: 4000,
      executeFn: async (target) => {
        callLog.push(`${target.provider}:${target.model}`);
        if (target.provider === 'gemini') {
          const err: any = new Error('503 Service Unavailable: Model is overloaded');
          err.status = 503;
          throw err;
        }
        return {
          result: 'Draf dari Claude Haiku',
          inputTokens: 500,
          outputTokens: 150,
        };
      },
    });

    expect(callLog).toEqual(['gemini:gemini-3.6-flash', 'anthropic:claude-haiku-5-5']);
    expect(res.winner).toEqual({ provider: 'anthropic', model: 'claude-haiku-5-5' });
    expect(res.alasanPindah).toBe('503');
    expect(res.result).toBe('Draf dari Claude Haiku');
  });

  it('3. Simulasi Gemini 429 Kuota Harian Habis -> Tandai tidak tersedia sampai reset kuota & panggilan berikutnya langsung lewati Gemini', async () => {
    const chain: ChainTarget[] = [
      { provider: 'gemini', model: 'gemini-3.6-flash' },
      { provider: 'anthropic', model: 'claude-haiku-5-5' },
    ];

    // Panggilan pertama: Gemini 429
    const callLog1: string[] = [];
    const res1 = await executeWithHedgingAndFallback({
      chain,
      hedgingTimeoutMs: 4000,
      executeFn: async (target) => {
        callLog1.push(`${target.provider}:${target.model}`);
        if (target.provider === 'gemini') {
          const err: any = new Error('Resource has been exhausted (e.g. check quota). PerDay limit reached.');
          err.status = 429;
          throw err;
        }
        return { result: 'Draf pertama dari Claude' };
      },
    });

    expect(res1.winner.provider).toBe('anthropic');
    expect(res1.alasanPindah).toBe('429');
    expect(getGeminiDailyQuotaExhaustedUntil()).not.toBeNull();

    // Panggilan kedua: Gemini langsung dilewati tanpa dicoba
    const callLog2: string[] = [];
    const res2 = await executeWithHedgingAndFallback({
      chain,
      hedgingTimeoutMs: 4000,
      executeFn: async (target) => {
        callLog2.push(`${target.provider}:${target.model}`);
        return { result: 'Draf kedua langsung dari Claude' };
      },
    });

    expect(callLog2).toEqual(['anthropic:claude-haiku-5-5']);
    expect(res2.winner.provider).toBe('anthropic');
  });

  it('4. Simulasi Hedging 4 Detik: Gemini lambat (>4 dtk) -> Claude dipanggil paralel & yang selesai duluan menang', async () => {
    vi.useFakeTimers();
    try {
      const chain: ChainTarget[] = [
        { provider: 'gemini', model: 'gemini-3.6-flash' },
        { provider: 'anthropic', model: 'claude-haiku-5-5' },
      ];

      const callLog: string[] = [];

      const executionPromise = executeWithHedgingAndFallback({
        chain,
        hedgingTimeoutMs: 4000,
        executeFn: async (target, signal) => {
          callLog.push(`${target.provider}:${target.model}`);
          if (target.provider === 'gemini') {
            // Gemini menggantung sampai sinyal abort
            return new Promise((_, reject) => {
              signal.addEventListener('abort', () => reject(new Error('Aborted by hedging')));
            });
          } else {
            // Claude langsung menjawab
            return { result: 'Draf Claude Cepat Menang' };
          }
        },
      });

      // Majukan timer deterministik 4001ms untuk memicu hedging tanpa jeda wall-clock
      await vi.advanceTimersByTimeAsync(4001);

      const res = await executionPromise;
      expect(res.winner.provider).toBe('anthropic');
      expect(res.result).toBe('Draf Claude Cepat Menang');
      expect(res.alasanPindah).toBe('hedging_4s');
      expect(callLog).toContain('gemini:gemini-3.6-flash');
      expect(callLog).toContain('anthropic:claude-haiku-5-5');
    } finally {
      vi.useRealTimers();
    }
  });

  it('5. Simulasi Claude 529 (Overloaded) -> Pindah ke target berikutnya (Gemini 3.5 Flash Lite)', async () => {
    const chain: ChainTarget[] = [
      { provider: 'anthropic', model: 'claude-haiku-5-5' },
      { provider: 'gemini', model: 'gemini-3.5-flash-lite' },
    ];

    const res = await executeWithHedgingAndFallback({
      chain,
      hedgingTimeoutMs: 4000,
      executeFn: async (target) => {
        if (target.provider === 'anthropic') {
          const err: any = new Error('529 Overloaded: Claude is temporarily overloaded');
          err.status = 529;
          throw err;
        }
        return { result: 'Draf dari Gemini Lite' };
      },
    });

    expect(res.winner).toEqual({ provider: 'gemini', model: 'gemini-3.5-flash-lite' });
    expect(res.alasanPindah).toBe('529');
    expect(res.result).toBe('Draf dari Gemini Lite');
  });

  it('6. Simulasi Saldo Claude Habis (Credit Balance Too Low) -> Claude dinonaktifkan, muncul banner admin, pindah ke Gemini', async () => {
    const chain: ChainTarget[] = [
      { provider: 'anthropic', model: 'claude-haiku-5-5' },
      { provider: 'gemini', model: 'gemini-3.6-flash' },
    ];

    const res = await executeWithHedgingAndFallback({
      chain,
      hedgingTimeoutMs: 4000,
      executeFn: async (target) => {
        if (target.provider === 'anthropic') {
          const err: any = new Error(
            '400 {"type":"error","error":{"type":"invalid_request_error","message":"Your credit balance is too low to access the Anthropic API. Please go to Plans & Billing to upgrade or purchase credits."}}'
          );
          err.status = 400;
          throw err;
        }
        return { result: 'Draf aman dari Gemini' };
      },
    });

    const claudeState = getClaudeInactiveState();
    expect(claudeState.active).toBe(false);
    expect(claudeState.reason).toBe('saldo');
    expect(claudeState.message).toContain('AI cadangan (Claude) tidak aktif: cek saldo/API key.');

    expect(res.winner.provider).toBe('gemini');
    expect(res.claudeWarning).toBe('AI cadangan (Claude) tidak aktif: cek saldo/API key.');
    expect(res.result).toBe('Draf aman dari Gemini');
  });

  it('7. Simulasi API Key Claude Kedaluwarsa / Salah (401) -> Banner minta ganti di .env, pindah ke Gemini', async () => {
    const chain: ChainTarget[] = [
      { provider: 'anthropic', model: 'claude-haiku-5-5' },
      { provider: 'gemini', model: 'gemini-3.6-flash' },
    ];

    const res = await executeWithHedgingAndFallback({
      chain,
      hedgingTimeoutMs: 4000,
      executeFn: async (target) => {
        if (target.provider === 'anthropic') {
          const err: any = new Error('401 authentication_error: invalid x-api-key');
          err.status = 401;
          throw err;
        }
        return { result: 'Draf dari Gemini' };
      },
    });

    const claudeState = getClaudeInactiveState();
    expect(claudeState.active).toBe(false);
    expect(claudeState.reason).toBe('key_invalid');
    expect(claudeState.message).toContain('API key Claude kedaluwarsa atau salah. Ganti di .env lalu restart aplikasi.');

    expect(res.winner.provider).toBe('gemini');
    expect(res.claudeWarning).toContain('API key Claude kedaluwarsa atau salah');
  });

  it('8. Jika semua provider gagal -> Melempar pesan ramah tanpa error JSON mentah', async () => {
    const chain: ChainTarget[] = [
      { provider: 'gemini', model: 'gemini-3.6-flash' },
      { provider: 'anthropic', model: 'claude-haiku-5-5' },
    ];

    await expect(
      executeWithHedgingAndFallback({
        chain,
        hedgingTimeoutMs: 4000,
        executeFn: async (target) => {
          throw new Error('503 Service Unavailable');
        },
      })
    ).rejects.toThrow(/Server AI sedang sibuk/);
  });

  it('9. Penghitungan estimasi biaya Rupiah akurat per provider dan model', () => {
    // Claude Haiku 5.5: 1.000 in, 500 out -> ($0.80*1k + $4.00*0.5k)/1M = $0.0028 -> ~Rp44.8
    const costClaude = calculateEstimatedCostRupiah('anthropic', 'claude-haiku-5-5', 1000, 500);
    expect(costClaude).toBeGreaterThan(40);
    expect(costClaude).toBeLessThan(50);

    // Gemini 3.5 Flash Lite: 1.000 in, 500 out -> ($0.075*1k + $0.30*0.5k)/1M = $0.000225 -> ~Rp3.6
    const costGeminiLite = calculateEstimatedCostRupiah('gemini', 'gemini-3.5-flash-lite', 1000, 500);
    expect(costGeminiLite).toBeGreaterThan(3);
    expect(costGeminiLite).toBeLessThan(5);
  });
});
