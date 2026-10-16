import { describe, it, expect } from 'vitest';
import {
  searchKota,
  detectZonaByKota,
  normalizeCityName,
  matchKotaFromText,
  getAllCitiesGroupedByProvinsi,
  KOTA_INDONESIA,
} from './kota';

describe('Utilitas Wilayah Kota Indonesia', () => {
  it('Memiliki tepat 514 kabupaten dan kota dari 38 provinsi', () => {
    expect(KOTA_INDONESIA.length).toBe(514);
    const uniqueProvinces = new Set(KOTA_INDONESIA.map((k) => k.provinsi));
    expect(uniqueProvinces.size).toBe(38);
  });

  it('getAllCitiesGroupedByProvinsi mengelompokkan 514 kota ke dalam 38 provinsi', () => {
    const groups = getAllCitiesGroupedByProvinsi();
    expect(groups.length).toBe(38);
    const totalCount = groups.reduce((acc, g) => acc + g.cities.length, 0);
    expect(totalCount).toBe(514);
  });

  it('Pencarian "sura" memunculkan Kota Surabaya dan Kota Surakarta', () => {
    const results = searchKota('sura');
    expect(results.length).toBeGreaterThan(0);
    const names = results.map((r) => r.nama);
    expect(names).toContain('Kota Surabaya');
    expect(names).toContain('Kota Surakarta');
  });

  it('Pencarian "mal" memunculkan Kota Malang dan Kab. Malang', () => {
    const results = searchKota('mal');
    expect(results.length).toBeGreaterThan(0);
    const names = results.map((r) => r.nama);
    expect(names).toContain('Kota Malang');
    expect(names).toContain('Kab. Malang');
  });

  it('Pencarian "Desa Sukamaju" tidak cocok dengan kota mana pun (hasil kosong)', () => {
    const results = searchKota('Desa Sukamaju');
    expect(results).toEqual([]);
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

  it('Pencarian "jayapura" menemukan Kota Jayapura di Papua', () => {
    const results = searchKota('jayapura');
    expect(results.length).toBeGreaterThan(0);
    const names = results.map((r) => r.nama);
    expect(names).toContain('Kota Jayapura');
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
    expect(detectZonaByKota('Kota Jayapura')).toBe('luar_kota');
  });

  it('matchKotaFromText: "Bandung" langsung memilih Kota Bandung secara pasti (confident)', () => {
    const match = matchKotaFromText('Bandung');
    expect(match.isConfident).toBe(true);
    expect(match.matchedKota?.kode).toBe('32.73');
    expect(match.matchedKota?.nama).toBe('Kota Bandung');
  });
});
