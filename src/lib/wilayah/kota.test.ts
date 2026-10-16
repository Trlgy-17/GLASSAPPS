import { describe, it, expect } from 'vitest';
import {
  searchKota,
  detectZonaByKota,
  normalizeCityName,
  matchKotaFromText,
  KOTA_INDONESIA,
} from './kota';

describe('Utilitas Wilayah Kota Indonesia', () => {
  it('Memiliki tepat 514 kabupaten dan kota dari 38 provinsi', () => {
    expect(KOTA_INDONESIA.length).toBe(514);
    const uniqueProvinces = new Set(KOTA_INDONESIA.map((k) => k.provinsi));
    expect(uniqueProvinces.size).toBe(38);
  });

  it('Pencarian "surabaya" mengembalikan Kota Surabaya di urutan pertama', () => {
    const results = searchKota('surabaya');
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].nama).toBe('Kota Surabaya');
    expect(results[0].provinsi).toBe('Jawa Timur');
  });

  it('Pencarian toleran salah ketik ringan "surbaya" -> Kota Surabaya', () => {
    const results = searchKota('surbaya');
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].nama).toBe('Kota Surabaya');
  });

  it('Pencarian "kab bandung barat" mengabaikan "kab" dan mencocokkan Kab. Bandung Barat', () => {
    const results = searchKota('kab bandung barat');
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].nama).toBe('Kab. Bandung Barat');
    expect(results[0].kode).toBe('32.17');
  });

  it('Pencarian "cimahi" mengembalikan Kota Cimahi', () => {
    const results = searchKota('cimahi');
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].nama).toBe('Kota Cimahi');
    expect(results[0].kode).toBe('32.77');
  });

  it('Pencarian "jayapura" menemukan Kota Jayapura atau Kab. Jayapura di Papua', () => {
    const results = searchKota('jayapura');
    expect(results.length).toBeGreaterThan(0);
    const names = results.map((r) => r.nama);
    expect(names).toContain('Kota Jayapura');
  });

  it('Pencarian singkatan "SBY" tidak wajib cocok dan tidak error', () => {
    const results = searchKota('SBY');
    expect(Array.isArray(results)).toBe(true);
  });

  it('Pencarian kota fiktif "Wakanda" menghasilkan array kosong', () => {
    const results = searchKota('Wakanda');
    expect(results).toEqual([]);
  });

  it('Deteksi Zona: Kota Bandung, Kab. Bandung, Kab. Bandung Barat, Kota Cimahi -> dalam_kota', () => {
    expect(detectZonaByKota('32.73')).toBe('dalam_kota');
    expect(detectZonaByKota('32.04')).toBe('dalam_kota');
    expect(detectZonaByKota('32.17')).toBe('dalam_kota');
    expect(detectZonaByKota('32.77')).toBe('dalam_kota');

    expect(detectZonaByKota('Kota Bandung')).toBe('dalam_kota');
    expect(detectZonaByKota('Bandung')).toBe('dalam_kota');
    expect(detectZonaByKota('Kab. Bandung Barat')).toBe('dalam_kota');
    expect(detectZonaByKota('Kota Cimahi')).toBe('dalam_kota');
  });

  it('Deteksi Zona: Kota lain -> luar_kota', () => {
    expect(detectZonaByKota('Kota Surabaya')).toBe('luar_kota');
    expect(detectZonaByKota('35.78')).toBe('luar_kota');
    expect(detectZonaByKota('Kota Jakarta Selatan')).toBe('luar_kota');
    expect(detectZonaByKota('Kota Jayapura')).toBe('luar_kota');
    expect(detectZonaByKota('Kota Medan')).toBe('luar_kota');
  });

  it('matchKotaFromText: "Bandung" langsung memilih Kota Bandung secara pasti (confident)', () => {
    const match = matchKotaFromText('Bandung');
    expect(match.isConfident).toBe(true);
    expect(match.matchedKota?.kode).toBe('32.73');
    expect(match.matchedKota?.nama).toBe('Kota Bandung');
  });

  it('matchKotaFromText: teks ambigu atau parsial memunculkan kandidat untuk konfirmasi admin', () => {
    const match = matchKotaFromText('Selatan');
    expect(match.candidates.length).toBeGreaterThan(0);
  });
});
