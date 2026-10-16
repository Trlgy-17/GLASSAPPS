/**
 * Parser dan Formatter Rupiah Putra Glass
 * Aturan:
 * - Selalu simpan dan olah sebagai integer rupiah.
 * - Titik hanya pemisah ribuan, tidak pernah desimal.
 * - "1.300.000", "1300000", "Rp 1.300.000" -> integer 1300000.
 * - Kosong/whitespace -> kembalikan defaultVal (misal harga list).
 * - "6" -> integer 6 (ditolak sebagai di bawah batas nego, bukan diubah jadi 6 juta).
 */

export function parseRupiah(
  raw: string | number | null | undefined,
  defaultVal?: number
): number | undefined {
  if (raw === undefined || raw === null) {
    return defaultVal;
  }

  if (typeof raw === 'number') {
    if (isNaN(raw)) return defaultVal;
    return Math.round(raw);
  }

  const trimmed = raw.trim();
  if (trimmed === '') {
    return defaultVal;
  }

  // Buang semua karakter non-digit
  const digitsOnly = trimmed.replace(/\D/g, '');
  if (digitsOnly === '') {
    return defaultVal;
  }

  const parsed = parseInt(digitsOnly, 10);
  return isNaN(parsed) ? defaultVal : parsed;
}

export function formatRupiah(val: number): string {
  if (isNaN(val)) return 'Rp0';
  return `Rp${Math.round(val).toLocaleString('id-ID')}`;
}

export function formatRupiahDigits(val: number): string {
  if (isNaN(val)) return '0';
  return Math.round(val).toLocaleString('id-ID');
}
