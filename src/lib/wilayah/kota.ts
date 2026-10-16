import kotaData from '@/data/kota-indonesia.json';

export interface WilayahKota {
  kode: string;
  nama: string;
  provinsi: string;
}

export const KOTA_INDONESIA: WilayahKota[] = kotaData as WilayahKota[];

/**
 * Daftar semua 514 kota yang dikelompokkan per provinsi (38 provinsi)
 */
export interface ProvinsiGroup {
  provinsi: string;
  cities: WilayahKota[];
}

export function getAllCitiesGroupedByProvinsi(): ProvinsiGroup[] {
  const map = new Map<string, WilayahKota[]>();
  for (const kota of KOTA_INDONESIA) {
    if (!map.has(kota.provinsi)) {
      map.set(kota.provinsi, []);
    }
    map.get(kota.provinsi)!.push(kota);
  }

  const groups: ProvinsiGroup[] = [];
  for (const [provinsi, cities] of map.entries()) {
    groups.push({
      provinsi,
      cities,
    });
  }
  return groups;
}

/**
 * Daftar kode wilayah dan nama wilayah untuk Dalam Kota (Bandung Raya)
 * 32.73: Kota Bandung
 * 32.04: Kab. Bandung
 * 32.17: Kab. Bandung Barat
 * 32.77: Kota Cimahi
 */
export const DALAM_KOTA_CODES = new Set(['32.73', '32.04', '32.17', '32.77']);

/**
 * Normalisasi teks pencarian:
 * - lowercase & trim
 * - hapus awalan "kota", "kabupaten", "kab."
 * - hapus tanda baca titik/koma/strip
 */
export function normalizeCityName(input: string): string {
  return input
    .toLowerCase()
    .replace(/[.,\-_/]/g, ' ')
    .replace(/\b(kabupaten|kab|kota)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Hitung Levenshtein Distance sederhana untuk toleransi typo ringan
 */
export function levenshteinDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;

  const d: number[][] = [];
  for (let i = 0; i <= m; i++) {
    d[i] = [i];
  }
  for (let j = 0; j <= n; j++) {
    d[0][j] = j;
  }

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(
        d[i - 1][j] + 1, // deletion
        d[i][j - 1] + 1, // insertion
        d[i - 1][j - 1] + cost // substitution
      );
    }
  }

  return d[m][n];
}

/**
 * Deteksi zona berdasarkan kode wilayah atau nama kota:
 * Bandung Raya (Kota Bandung, Kab. Bandung, Kab. Bandung Barat, Kota Cimahi) -> 'dalam_kota'
 * Lainnya -> 'luar_kota'
 */
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

/**
 * Cari kota dari database lokal dengan substring match (awalan & bagian kata) serta fuzzy matching
 */
export function searchKota(query: string, limit = 20): WilayahKota[] {
  const rawTrimmed = query.trim().toLowerCase();
  if (!rawTrimmed) return [];

  const normQuery = normalizeCityName(rawTrimmed);
  if (!normQuery) return [];

  interface ScoredKota {
    kota: WilayahKota;
    score: number;
  }

  const results: ScoredKota[] = [];

  for (const kota of KOTA_INDONESIA) {
    const rawNama = kota.nama.toLowerCase();
    const normNama = normalizeCityName(rawNama);
    const provNama = kota.provinsi.toLowerCase();

    // 1. Exact match setelah normalisasi
    if (normNama === normQuery) {
      results.push({ kota, score: 100 });
      continue;
    }

    // 2. Exact match dari nama asli (termasuk awalan Kota/Kab)
    if (rawNama === rawTrimmed) {
      results.push({ kota, score: 95 });
      continue;
    }

    // 3. Prefix match nama bersih (misal "sura" -> Surabaya, Surakarta; "band" -> Bandung)
    if (normNama.startsWith(normQuery)) {
      results.push({ kota, score: 85 - (normNama.length - normQuery.length) });
      continue;
    }

    // 4. Substring match nama bersih (misal "mal" -> Kota Malang, Kab. Malang)
    if (normNama.includes(normQuery)) {
      results.push({ kota, score: 70 });
      continue;
    }

    // 5. Raw nama prefix match (misal "kota sura")
    if (rawNama.startsWith(rawTrimmed) || rawNama.includes(rawTrimmed)) {
      results.push({ kota, score: 65 });
      continue;
    }

    // 6. Match provinsi (misal "bali" -> Kota Denpasar dll)
    if (provNama.includes(normQuery) || provNama.startsWith(normQuery)) {
      results.push({ kota, score: 50 });
      continue;
    }

    // 7. Fuzzy match untuk salah ketik ringan (misal "surbaya" -> "surabaya")
    if (normQuery.length >= 4) {
      const dist = levenshteinDistance(normQuery, normNama);
      const maxDist = normQuery.length <= 5 ? 1 : 2;
      if (dist <= maxDist) {
        results.push({ kota, score: 60 - dist * 10 });
        continue;
      }

      // Coba per kata di nama kota
      const words = normNama.split(' ');
      let wordMatched = false;
      for (const w of words) {
        if (w.length >= 4) {
          const wDist = levenshteinDistance(normQuery, w);
          if (wDist <= 1) {
            results.push({ kota, score: 55 });
            wordMatched = true;
            break;
          }
        }
      }
      if (wordMatched) continue;
    }
  }

  // Urutkan berdasarkan score tertinggi
  results.sort((a, b) => b.score - a.score);

  return results.slice(0, limit).map((r) => r.kota);
}

/**
 * Mencari kota teratas untuk pencocokan teks otomatis dari AI
 */
export function matchKotaFromText(rawText: string): {
  matchedKota: WilayahKota | null;
  candidates: WilayahKota[];
  isConfident: boolean;
} {
  const suggestions = searchKota(rawText, 5);
  if (suggestions.length === 0) {
    return {
      matchedKota: null,
      candidates: [],
      isConfident: false,
    };
  }

  const top = suggestions[0];
  const normQuery = normalizeCityName(rawText);
  const normTop = normalizeCityName(top.nama);

  // Jika query persis "bandung" -> pilih Kota Bandung (kode 32.73)
  if (normQuery === 'bandung') {
    const kotaBandung = suggestions.find((s) => s.kode === '32.73') || top;
    return {
      matchedKota: kotaBandung,
      candidates: suggestions.slice(0, 3),
      isConfident: true,
    };
  }

  const isExact = normQuery === normTop;
  return {
    matchedKota: isExact ? top : (suggestions.length === 1 ? top : null),
    candidates: suggestions.slice(0, 3),
    isConfident: isExact,
  };
}
