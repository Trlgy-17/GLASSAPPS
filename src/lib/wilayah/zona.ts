import { ZonaPengirimanConfig, ZonaPengirimanId } from '@/types/pricing';

/**
 * Modul Zona & Rumus Hitungan Kargo J&T (FastTrack & MaxTrack)
 * Berdasarkan daftar tarif resmi J&T Cargo Jawa Barat
 */

export const DALAM_KOTA_CODES = new Set(['32.73', '32.04', '32.17', '32.77']);

export const DAFTAR_ZONA_PENGIRIMAN: ZonaPengirimanConfig[] = [
  {
    id: 'dalam_kota',
    nama: 'Bandung Raya (Dalam Kota)',
    sla: '1-3 hari',
    isPulauJawa: true,
    fastTrackPerKg: 2500,
    maxTrack100PerKg: 1750,
    maxTrack300PerKg: 1625,
    maxTrack500PerKg: 1375,
    keterangan: 'Workshop Bandung (opsi ambil sendiri Rp0)',
  },
  {
    id: 'jawa_barat',
    nama: 'Jawa Barat (Luar Bandung Raya)',
    sla: '1-4 hari',
    isPulauJawa: true,
    fastTrackPerKg: 2500,
    maxTrack100PerKg: 1750,
    maxTrack300PerKg: 1625,
    maxTrack500PerKg: 1375,
  },
  {
    id: 'dki_jakarta',
    nama: 'DKI Jakarta',
    sla: '1-3 hari',
    isPulauJawa: true,
    fastTrackPerKg: 3000,
    maxTrack100PerKg: 1875,
    maxTrack300PerKg: 1750,
    maxTrack500PerKg: 1500,
  },
  {
    id: 'banten',
    nama: 'Banten',
    sla: '1-4 hari',
    isPulauJawa: true,
    fastTrackPerKg: 3000,
    maxTrack100PerKg: 1875,
    maxTrack300PerKg: 1750,
    maxTrack500PerKg: 1500,
  },
  {
    id: 'jawa_tengah',
    nama: 'Jawa Tengah (Semarang, Solo, dll.)',
    sla: '1-3 hari',
    isPulauJawa: true,
    fastTrackPerKg: 3500,
    maxTrack100PerKg: 2250,
    maxTrack300PerKg: 2000,
    maxTrack500PerKg: 1750,
  },
  {
    id: 'di_yogyakarta',
    nama: 'DI Yogyakarta',
    sla: '1-3 hari',
    isPulauJawa: true,
    fastTrackPerKg: 3500,
    maxTrack100PerKg: 2250,
    maxTrack300PerKg: 2000,
    maxTrack500PerKg: 1750,
  },
  {
    id: 'jawa_timur',
    nama: 'Jawa Timur (Surabaya, dll.)',
    sla: '1-3 hari',
    isPulauJawa: true,
    fastTrackPerKg: 4000,
    maxTrack100PerKg: 2500,
    maxTrack300PerKg: 2250,
    maxTrack500PerKg: 2000,
  },
  {
    id: 'bandar_lampung',
    nama: 'Bandar Lampung',
    sla: '3-5 hari',
    isPulauJawa: false,
    fastTrackPerKg: 4000,
  },
  {
    id: 'palembang',
    nama: 'Palembang',
    sla: '3-5 hari',
    isPulauJawa: false,
    fastTrackPerKg: 4500,
  },
  {
    id: 'denpasar',
    nama: 'Denpasar (Bali)',
    sla: '4-6 hari',
    isPulauJawa: false,
    fastTrackPerKg: 5500,
  },
  {
    id: 'pekanbaru',
    nama: 'Pekanbaru',
    sla: '4-6 hari',
    isPulauJawa: false,
    fastTrackPerKg: 7000,
  },
  {
    id: 'medan',
    nama: 'Medan',
    sla: '5-7 hari',
    isPulauJawa: false,
    fastTrackPerKg: 7700,
  },
  {
    id: 'makassar',
    nama: 'Makassar',
    sla: '11-13 hari',
    isPulauJawa: false,
    fastTrackPerKg: 8500,
  },
  {
    id: 'pontianak',
    nama: 'Pontianak',
    sla: '10-12 hari',
    isPulauJawa: false,
    fastTrackPerKg: 10000,
  },
  {
    id: 'banjarmasin',
    nama: 'Banjarmasin',
    sla: '9-11 hari',
    isPulauJawa: false,
    fastTrackPerKg: 11000,
  },
  {
    id: 'manado',
    nama: 'Manado',
    sla: '17-19 hari',
    isPulauJawa: false,
    fastTrackPerKg: 16250,
  },
  {
    id: 'luar_kota',
    nama: 'Luar Kota / Luar Pulau Lainnya',
    sla: 'Estimasi Kargo',
    isPulauJawa: false,
    fastTrackPerKg: 4000,
    keterangan: 'Cek admin kargo',
  },
];

export function getZonaPengiriman(zonaId?: string | null): ZonaPengirimanConfig {
  if (!zonaId) return DAFTAR_ZONA_PENGIRIMAN[0];
  const found = DAFTAR_ZONA_PENGIRIMAN.find((z) => z.id === zonaId);
  return found || DAFTAR_ZONA_PENGIRIMAN.find((z) => z.id === 'luar_kota') || DAFTAR_ZONA_PENGIRIMAN[0];
}

export function normalizeCityName(input: string): string {
  return input
    .toLowerCase()
    .replace(/[.,\-_/]/g, ' ')
    .replace(/\b(kabupaten|kab|kota)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Deteksi zona biner untuk leads & AI prompt: 'dalam_kota' | 'luar_kota'
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
 * Deteksi zona pengiriman lengkap (17 zona J&T Cargo) dari kode wilayah atau nama kota
 */
export function detectZonaPengiriman(kodeOrNama?: string | null): ZonaPengirimanId {
  if (!kodeOrNama) return 'dalam_kota';
  const clean = kodeOrNama.trim();

  // Cek kode wilayah spesifik Bandung Raya
  if (DALAM_KOTA_CODES.has(clean)) {
    return 'dalam_kota';
  }

  // Cek prefix kode wilayah (BPS / Kemendagri)
  if (clean.startsWith('31.')) return 'dki_jakarta';
  if (clean.startsWith('36.')) return 'banten';
  if (clean.startsWith('34.')) return 'di_yogyakarta';
  if (clean.startsWith('33.')) return 'jawa_tengah';
  if (clean.startsWith('35.')) return 'jawa_timur';
  if (clean.startsWith('32.')) return 'jawa_barat';
  if (clean.startsWith('18.')) return 'bandar_lampung';
  if (clean.startsWith('16.')) return 'palembang';
  if (clean.startsWith('51.')) return 'denpasar';
  if (clean.startsWith('14.')) return 'pekanbaru';
  if (clean.startsWith('12.')) return 'medan';
  if (clean.startsWith('73.')) return 'makassar';
  if (clean.startsWith('61.')) return 'pontianak';
  if (clean.startsWith('63.')) return 'banjarmasin';
  if (clean.startsWith('71.')) return 'manado';

  const n = normalizeCityName(clean);

  // 1. Dalam Kota (Bandung Raya & Cimahi)
  if (n.includes('bandung') || n.includes('cimahi')) {
    return 'dalam_kota';
  }

  // 2. DKI Jakarta
  if (n.includes('jakarta') || n.includes('jaksel') || n.includes('jaktim') || n.includes('jakbar') || n.includes('jakpus') || n.includes('jakut')) {
    return 'dki_jakarta';
  }

  // 3. Banten
  if (n.includes('tangerang') || n.includes('serang') || n.includes('cilegon') || n.includes('lebak') || n.includes('pandeglang') || n.includes('banten')) {
    return 'banten';
  }

  // 4. DI Yogyakarta
  if (n.includes('yogyakarta') || n.includes('jogja') || n.includes('sleman') || n.includes('bantul') || n.includes('gunungkidul') || n.includes('kulon progo')) {
    return 'di_yogyakarta';
  }

  // 5. Jawa Tengah
  if (
    n.includes('semarang') ||
    n.includes('solo') ||
    n.includes('surakarta') ||
    n.includes('magelang') ||
    n.includes('pekalongan') ||
    n.includes('tegal') ||
    n.includes('salatiga') ||
    n.includes('klaten') ||
    n.includes('kudus') ||
    n.includes('jepara') ||
    n.includes('cilacap') ||
    n.includes('banyumas') ||
    n.includes('purwokerto') ||
    n.includes('jawa tengah') ||
    n.includes('jateng')
  ) {
    return 'jawa_tengah';
  }

  // 6. Jawa Timur
  if (
    n.includes('surabaya') ||
    n.includes('malang') ||
    n.includes('sidoarjo') ||
    n.includes('gresik') ||
    n.includes('kediri') ||
    n.includes('jember') ||
    n.includes('banyuwangi') ||
    n.includes('pasuruan') ||
    n.includes('mojokerto') ||
    n.includes('madiun') ||
    n.includes('jawa timur') ||
    n.includes('jatim')
  ) {
    return 'jawa_timur';
  }

  // 7. Jawa Barat luar Bandung
  if (
    n.includes('bogor') ||
    n.includes('depok') ||
    n.includes('bekasi') ||
    n.includes('cirebon') ||
    n.includes('sukabumi') ||
    n.includes('karawang') ||
    n.includes('purwakarta') ||
    n.includes('subang') ||
    n.includes('indramayu') ||
    n.includes('sumedang') ||
    n.includes('garut') ||
    n.includes('tasikmalaya') ||
    n.includes('ciamis') ||
    n.includes('kuningan') ||
    n.includes('majalengka') ||
    n.includes('banjar') ||
    n.includes('pangandaran') ||
    n.includes('cianjur') ||
    n.includes('jawa barat') ||
    n.includes('jabar')
  ) {
    return 'jawa_barat';
  }

  // Luar Jawa FastTrack
  if (n.includes('lampung')) return 'bandar_lampung';
  if (n.includes('palembang')) return 'palembang';
  if (n.includes('denpasar') || n.includes('bali') || n.includes('badung')) return 'denpasar';
  if (n.includes('pekanbaru') || n.includes('riau')) return 'pekanbaru';
  if (n.includes('medan') || n.includes('deli serdang')) return 'medan';
  if (n.includes('makassar')) return 'makassar';
  if (n.includes('pontianak')) return 'pontianak';
  if (n.includes('banjarmasin') || n.includes('banjarbaru')) return 'banjarmasin';
  if (n.includes('manado') || n.includes('minahasa')) return 'manado';

  return 'luar_kota';
}

/**
 * Hitung tarif per kg & identifikasi tier layanan kargo (FastTrack vs MaxTrack)
 */
export function hitungTarifKargo(
  zonaId: string | undefined,
  beratKg: number,
  configLogistik?: {
    tarif_per_kg_dalam_kota?: number;
    tarif_per_kg_luar_kota?: number;
  }
): {
  tarifPerKg: number;
  layanan: string;
  sla: string;
  zonaNama: string;
  isMaxTrack: boolean;
} {
  const z = getZonaPengiriman(zonaId);

  // Jika owner menimpa secara manual di konfigurasi buku harga
  if (zonaId === 'dalam_kota' && configLogistik?.tarif_per_kg_dalam_kota && configLogistik.tarif_per_kg_dalam_kota !== 25000) {
    return {
      tarifPerKg: configLogistik.tarif_per_kg_dalam_kota,
      layanan: 'FastTrack',
      sla: z.sla,
      zonaNama: z.nama,
      isMaxTrack: false,
    };
  }

  // Khusus Pulau Jawa: Evaluasi MaxTrack (>= 100 kg)
  if (z.isPulauJawa && beratKg >= 100) {
    if (beratKg > 500 && z.maxTrack500PerKg) {
      return {
        tarifPerKg: z.maxTrack500PerKg,
        layanan: 'MaxTrack (>500kg)',
        sla: z.sla,
        zonaNama: z.nama,
        isMaxTrack: true,
      };
    }
    if (beratKg > 300 && z.maxTrack300PerKg) {
      return {
        tarifPerKg: z.maxTrack300PerKg,
        layanan: 'MaxTrack (>300kg)',
        sla: z.sla,
        zonaNama: z.nama,
        isMaxTrack: true,
      };
    }
    if (z.maxTrack100PerKg) {
      return {
        tarifPerKg: z.maxTrack100PerKg,
        layanan: 'MaxTrack (>100kg)',
        sla: z.sla,
        zonaNama: z.nama,
        isMaxTrack: true,
      };
    }
  }

  // FastTrack (< 100 kg atau luar Pulau Jawa)
  return {
    tarifPerKg: z.fastTrackPerKg,
    layanan: 'FastTrack',
    sla: z.sla,
    zonaNama: z.nama,
    isMaxTrack: false,
  };
}
