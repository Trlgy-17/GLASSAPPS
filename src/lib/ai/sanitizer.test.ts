import { describe, it, expect } from 'vitest';
import { sanitizePII } from './sanitizer';

describe('PII Sanitizer (sanitizer.ts)', () => {
  it('1. Menyamarkan nomor HP format 08xx dan +62xx menjadi [nomor]', () => {
    const text1 = 'Hubungi saya di 081234567890 ya Kak.';
    expect(sanitizePII(text1)).toBe('Hubungi saya di [nomor] ya Kak.');

    const text2 = 'No WA saya +62 812-3456-7890.';
    expect(sanitizePII(text2)).toBe('No WA saya [nomor].');
  });

  it('2. Menyamarkan nomor rekening bank menjadi [rekening]', () => {
    const text = 'Transfer DP ke BCA 1234567890 atau Mandiri: 9876543210 ya.';
    expect(sanitizePII(text)).toBe('Transfer DP ke [rekening] atau [rekening] ya.');
  });

  it('3. Menyamarkan alamat email menjadi [email]', () => {
    const text = 'Kirim penawaran ke email budi.santoso@gmail.com.';
    expect(sanitizePII(text)).toBe('Kirim penawaran ke email [email].');
  });

  it('4. Menyamarkan alamat lengkap menjadi [alamat]', () => {
    const text1 = 'Alamat kirim: Jl. Sukajadi No. 45 RT 02 RW 05, Bandung.';
    expect(sanitizePII(text1)).toBe('Alamat kirim: [alamat], Bandung.');

    const text2 = 'Kirim ke Komplek Permata Blok B No. 12 di Surabaya.';
    expect(sanitizePII(text2)).toBe('Kirim ke [alamat] di Surabaya.');
  });

  it('5. Mempertahankan nama kota (Surabaya, Bandung) untuk perhitungan ongkir', () => {
    const text = 'Halo Kak, saya di Surabaya mau pesan cermin 60x80 cm kirim dari Bandung.';
    const sanitized = sanitizePII(text);
    expect(sanitized).toContain('Surabaya');
    expect(sanitized).toContain('Bandung');
  });
});
