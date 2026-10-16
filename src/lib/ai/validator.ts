/**
 * Validator Angka dan Guard Marketplace untuk Draf Balasan AI
 * Memastikan AI tidak mengarang angka rupiah dan mematuhi aturan platform TikTok/Shopee.
 */

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  numbersFound?: number[];
}

/**
 * Mengekstrak seluruh nominal rupiah dari teks (mendukung Rp1.750.000, Rp 1.750.000,-, 1,75 jt, dll)
 */
export function extractAllRupiahNumbers(text: string): number[] {
  const numbers: number[] = [];

  // 1. Format "X jt" atau "X,Y jt" / "X juta"
  const jtRegex = /(\d+(?:[,\.]\d+)?)\s*(?:jt|juta)\b/gi;
  let jtMatch;
  while ((jtMatch = jtRegex.exec(text)) !== null) {
    const rawVal = jtMatch[1].replace(',', '.');
    const parsedNum = Math.round(parseFloat(rawVal) * 1_000_000);
    if (!isNaN(parsedNum) && parsedNum > 0) {
      numbers.push(parsedNum);
    }
  }

  // 2. Format "Rp..." (misal Rp1.750.000, Rp 1.750.000,-, Rp. 1.750.000)
  const rpRegex = /Rp\.?\s*([0-9\.]+)(?:,-)?/gi;
  let rpMatch;
  while ((rpMatch = rpRegex.exec(text)) !== null) {
    const digitsOnly = rpMatch[1].replace(/\./g, '');
    const parsedNum = parseInt(digitsOnly, 10);
    if (!isNaN(parsedNum) && parsedNum > 0) {
      numbers.push(parsedNum);
    }
  }

  return numbers;
}

/**
 * Memvalidasi bahwa setiap angka rupiah di draf:
 * 1. Terdaftar di array angka_dipakai keluaran AI.
 * 2. Berasal dari angka sah hasil kalkulator (pricing.ts).
 */
export function validateRupiahInDraft(
  bubbles: string[],
  angkaDipakai: number[],
  angkaSahKalkulator: number[]
): ValidationResult {
  const errors: string[] = [];
  const fullText = bubbles.join(' ');
  const numbersFound = extractAllRupiahNumbers(fullText);

  // Set angka sah dari kalkulator
  const validAllowedSet = new Set<number>(angkaSahKalkulator);
  const angkaDipakaiSet = new Set<number>(angkaDipakai);

  // Periksa setiap angka di teks
  for (const num of numbersFound) {
    if (!angkaDipakaiSet.has(num)) {
      errors.push(
        `Angka Rp${num.toLocaleString('id-ID')} muncul di teks bubble tetapi tidak tercatat di angka_dipakai AI`
      );
    }
    if (!validAllowedSet.has(num)) {
      errors.push(
        `Angka Rp${num.toLocaleString('id-ID')} tidak ditemukan dalam daftar angka sah kalkulator (kemungkinan salah hitung/karang)`
      );
    }
  }

  // Periksa setiap angka_dipakai
  for (const num of angkaDipakai) {
    if (!validAllowedSet.has(num)) {
      errors.push(
        `angka_dipakai Rp${num.toLocaleString('id-ID')} tidak cocok dengan output resmi mesin harga`
      );
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    numbersFound,
  };
}

/**
 * Guardrail Kebijakan Marketplace (TikTok / Shopee):
 * Menolak nomor WhatsApp/telepon, nomor rekening, link eksternal, dan ajakan transaksi luar.
 */
export function validateMarketplaceGuards(
  platform: string,
  bubbles: string[]
): ValidationResult {
  const errors: string[] = [];
  const normalizedPlatform = (platform || '').toLowerCase();

  // Hanya periksa jika platform adalah tiktok atau shopee
  if (normalizedPlatform !== 'tiktok' && normalizedPlatform !== 'shopee') {
    return { valid: true, errors: [] };
  }

  const fullText = bubbles.join(' ');

  // 1. Kasus Nomor WA / Telepon (+62 / 08... dengan minimal 9 digit)
  const phoneRegex = /(?:\+?62|08)[0-9\s.-]{8,15}/i;
  if (phoneRegex.test(fullText)) {
    errors.push('Terdeteksi nomor telepon/WhatsApp pada draf untuk kanal marketplace');
  }

  // 2. Kasus Rekening Bank (BCA, Mandiri, BNI, BRI, Seabank, no rekening)
  const bankRegex = /\b(?:bca|mandiri|bni|bri|cimb|seabank|rekening|rek|norek)\b.*?(\d{5,})/i;
  if (bankRegex.test(fullText)) {
    errors.push('Terdeteksi informasi nomor rekening bank pada draf untuk kanal marketplace');
  }

  // 3. Kasus Link Luar / Tautan URL (http, https, www, .com, .id, wa.me, bit.ly, dll)
  const linkRegex = /(?:https?:\/\/|www\.|wa\.me\/|bit\.ly\/|[a-zA-Z0-9-]+\.(?:com|id|me|co|net|org))\b/i;
  if (linkRegex.test(fullText)) {
    errors.push('Terdeteksi tautan/link luar pada draf untuk kanal marketplace');
  }

  // 4. Kasus Ajakan Transaksi di Luar Platform
  const outsideInviteRegex = /\b(?:transaksi di luar|chat wa|hubungi wa|pindah wa|order lewat wa|order manual|dm wa|japri|kirim wa)\b/i;
  if (outsideInviteRegex.test(fullText)) {
    errors.push('Terdeteksi ajakan bertransaksi di luar platform pada draf untuk kanal marketplace');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Guardrail Frasa Terlarang:
 * Menolak frasa over-promising seperti "100%", "dijamin pasti", "tidak akan rusak", atau template CS kaku.
 */
export function validateForbiddenPhrases(bubbles: string[]): ValidationResult {
  const errors: string[] = [];
  const fullText = bubbles.join(' ').toLowerCase();

  const forbiddenList = [
    '100%',
    'dijamin pasti',
    'tidak akan rusak',
    'terima kasih telah menghubungi kami',
    'kami sangat senang',
    'jangan ragu untuk',
    'solusi terbaik untuk kebutuhan anda',
    'berkualitas tinggi dan terpercaya',
  ];

  for (const phrase of forbiddenList) {
    if (fullText.includes(phrase)) {
      errors.push(`Draf memuat frasa terlarang: "${phrase}"`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
