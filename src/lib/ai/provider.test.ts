import { describe, it, expect, vi } from 'vitest';
import { executeWithRetryAndFallback } from './provider';

describe('AI Retry & Fallback Engine (provider.ts)', () => {
  it('1. Error 503 pada model utama langsung pindah ke model cadangan tanpa retry berulang', async () => {
    let callCountPrimary = 0;
    let callCountFallback = 0;

    const mockFn = vi.fn(async (modelToUse: string) => {
      if (modelToUse === 'primary-model') {
        callCountPrimary++;
        throw new Error('503 Service Unavailable');
      }
      if (modelToUse === 'fallback-model') {
        callCountFallback++;
        return { status: 'success_from_fallback' };
      }
      throw new Error('Unknown model');
    });

    const res = await executeWithRetryAndFallback(
      'primary-model',
      'fallback-model',
      'testEndpoint',
      mockFn
    );

    // Sesuai Revisi #3: 503/overloaded langsung pindah tanpa retry model yang sama
    expect(callCountPrimary).toBe(1);
    expect(callCountFallback).toBe(1);
    expect(res.isFallback).toBe(true);
    expect(res.modelUsed).toBe('fallback-model');
    expect(res.result).toEqual({ status: 'success_from_fallback' });
  }, 10000);

  it('2. Jika semua model dan retry gagal, melempar pesan ramah tanpa JSON mentah', async () => {
    const mockAllFail = vi.fn(async () => {
      throw new Error('503 Service Unavailable: {"error": {"code": 503, "raw": "down"}}');
    });

    await expect(
      executeWithRetryAndFallback('primary-model', 'fallback-model', 'testEndpoint', mockAllFail)
    ).rejects.toThrow('Server AI sedang sibuk. Screenshot & catatan tetap tersimpan, klik Coba Lagi.');
  }, 10000);

  it('3. Error non-transien (bukan 503/429) langsung dilempar dengan pesan jelas tanpa retry berulang', async () => {
    let callCount = 0;
    const mockValidationFail = vi.fn(async () => {
      callCount++;
      throw new Error('Validasi gambar gagal');
    });

    await expect(
      executeWithRetryAndFallback('primary-model', 'fallback-model', 'testEndpoint', mockValidationFail)
    ).rejects.toThrow('Validasi gambar gagal');

    // Langsung gagal tanpa retry
    expect(callCount).toBe(1);
  });
});
