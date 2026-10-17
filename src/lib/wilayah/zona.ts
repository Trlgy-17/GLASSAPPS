/**
 * Modul Zona & Normalisasi Nama Kota Ringan
 * Tanpa memuat 514 baris kota-indonesia.json ke bundle JS awal
 */

export const DALAM_KOTA_CODES = new Set(['32.73', '32.04', '32.17', '32.77']);

export function normalizeCityName(input: string): string {
  return input
    .toLowerCase()
    .replace(/[.,\-_/]/g, ' ')
    .replace(/\b(kabupaten|kab|kota)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function detectZonaByKota(kodeOrNama?: string | null): 'dalam_kota' | 'luar_kota' {
  if (!kodeOrNama) return 'luar_kota';
  const clean = kodeOrNama.trim();

  // Cek apakah berupa kode wilayah
  if (DALAM_KOTA_CODES.has(clean)) {
    return 'dalam_kota';
  }

  const normalized = normalizeCityName(clean);

  // Cocokkan nama spesifik Bandung Raya
  if (
    normalized === 'bandung' ||
    normalized === 'bandung barat' ||
    normalized === 'cimahi' ||
    normalized.includes('bandung') ||
    normalized.includes('cimahi')
  ) {
    return 'dalam_kota';
  }

  return 'luar_kota';
}
