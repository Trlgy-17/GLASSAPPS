import { describe, it, expect } from 'vitest';
import {
  extractAllRupiahNumbers,
  validateRupiahInDraft,
  validateMarketplaceGuards,
} from './validator';

describe('AI Output Validator (validator.ts)', () => {
  describe('1. Ekstraksi dan Validasi Angka Rupiah di Draf Balasan', () => {
    it('1a. Ekstraksi format variatif: "Rp1.750.000", "Rp 1.750.000,-", dan "1,75 jt"', () => {
      const text1 = 'Untuk cermin ukuran ini harganya Rp1.750.000 ya Kak.';
      expect(extractAllRupiahNumbers(text1)).toEqual([1_750_000]);

      const text2 = 'Total biayanya Rp 1.750.000,- sudah termasuk packing kayu.';
      expect(extractAllRupiahNumbers(text2)).toEqual([1_750_000]);

      const text3 = 'Harga cermin mulai dari 1,75 jt untuk varian premium.';
      expect(extractAllRupiahNumbers(text3)).toEqual([1_750_000]);

      const text4 = 'Total Rp2.590.000 dengan DP 50% sebesar Rp1.295.000 ya Kak.';
      expect(extractAllRupiahNumbers(text4)).toEqual([2_590_000, 1_295_000]);
    });

    it('1b. Angka Cocok Sempurna: valid = true', () => {
      const bubbles = [
        'Halo Kak, untuk custom cermin 60x80 cm harganya Rp840.000 ya.',
        'Totalnya jadi Rp2.590.000 dengan DP Rp1.295.000.',
      ];
      const angkaDipakai = [840_000, 2_590_000, 1_295_000];
      const angkaSahKalkulator = [840_000, 2_590_000, 1_295_000, 1_300_000];

      const res = validateRupiahInDraft(bubbles, angkaDipakai, angkaSahKalkulator);
      expect(res.valid).toBe(true);
      expect(res.errors).toHaveLength(0);
    });

    it('1c. Salah 1 Digit: misal "Rp1.750.001" vs "Rp1.750.000" -> ditolak', () => {
      const bubbles = ['Harganya Rp1.750.001 ya Kak.'];
      const angkaDipakai = [1_750_001];
      const angkaSahKalkulator = [1_750_000];

      const res = validateRupiahInDraft(bubbles, angkaDipakai, angkaSahKalkulator);
      expect(res.valid).toBe(false);
      expect(res.errors[0]).toContain('tidak ditemukan dalam daftar angka sah kalkulator');
    });

    it('1d. Angka di Teks Tak Ada di angka_dipakai: misal sebut "Rp200.000" tapi lupa dicatat AI -> ditolak', () => {
      const bubbles = [
        'Harganya Rp1.750.000 dan ada tambahan Rp200.000 ya.',
      ];
      // AI hanya mencatat 1.750.000 di array angka_dipakai
      const angkaDipakai = [1_750_000];
      const angkaSahKalkulator = [1_750_000, 200_000];

      const res = validateRupiahInDraft(bubbles, angkaDipakai, angkaSahKalkulator);
      expect(res.valid).toBe(false);
      expect(res.errors.some((e) => e.includes('tidak tercatat di angka_dipakai AI'))).toBe(true);
    });

    it('1e. Format "1,75 jt" divalidasi cocok dengan nilai integer 1.750.000', () => {
      const bubbles = ['Bisa diambil dengan harga 1,75 jt ya Kak.'];
      const angkaDipakai = [1_750_000];
      const angkaSahKalkulator = [1_750_000];

      const res = validateRupiahInDraft(bubbles, angkaDipakai, angkaSahKalkulator);
      expect(res.valid).toBe(true);
      expect(res.numbersFound).toEqual([1_750_000]);
    });
  });

  describe('2. Guardrail Kebijakan Marketplace (TikTok / Shopee)', () => {
    it('2a. Kasus Nomor WA/Telepon pada TikTok -> ditolak', () => {
      const bubbles = ['Halo Kak, silakan hubungi 081234567890 untuk info detail ya.'];
      const res = validateMarketplaceGuards('tiktok', bubbles);
      expect(res.valid).toBe(false);
      expect(res.errors[0]).toContain('nomor telepon/WhatsApp');
    });

    it('2b. Kasus Nomor Rekening Bank pada Shopee -> ditolak', () => {
      const bubbles = ['Bisa transfer DP ke rekening BCA 1234567890 a.n. Putra Glass ya.'];
      const res = validateMarketplaceGuards('shopee', bubbles);
      expect(res.valid).toBe(false);
      expect(res.errors[0]).toContain('rekening bank');
    });

    it('2c. Kasus Link Eksternal pada TikTok -> ditolak', () => {
      const bubbles = ['Portofolio lengkap bisa cek di https://instagram.com/putraglass.id ya Kak.'];
      const res = validateMarketplaceGuards('tiktok', bubbles);
      expect(res.valid).toBe(false);
      expect(res.errors[0]).toContain('tautan/link luar');
    });

    it('2d. Kasus Ajakan Transaksi di Luar Platform pada Shopee -> ditolak', () => {
      const bubbles = ['Biar lebih murah kita transaksi di luar ya Kak, chat wa langsung.'];
      const res = validateMarketplaceGuards('shopee', bubbles);
      expect(res.valid).toBe(false);
      expect(res.errors[0]).toContain('ajakan bertransaksi di luar platform');
    });

    it('2e. Pesan Bersih pada Marketplace -> lolos', () => {
      const bubbles = [
        'Halo Kak, produk ini ready siap dikirim.',
        'Silakan langsung checkout melalui etalase Shopee ya Kak.',
      ];
      const res = validateMarketplaceGuards('shopee', bubbles);
      expect(res.valid).toBe(true);
      expect(res.errors).toHaveLength(0);
    });

    it('2f. Nomor WA dan Rekening DIPERBOLEHKAN untuk kanal WhatsApp & Instagram', () => {
      const bubbles = [
        'Kirim bukti transfer ke WhatsApp kami di 081234567890 ya Kak.',
        'Rekening BCA 1234567890 a.n. Putra Glass.',
      ];
      const resWA = validateMarketplaceGuards('whatsapp', bubbles);
      expect(resWA.valid).toBe(true);

      const resIG = validateMarketplaceGuards('instagram', bubbles);
      expect(resIG.valid).toBe(true);
    });
  });
});
