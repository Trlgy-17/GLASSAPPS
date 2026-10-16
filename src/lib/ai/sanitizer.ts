/**
 * Modul Penyamaran Data Pribadi (PII Sanitizer)
 * Digunakan pada mode teks manual sebelum dikirim ke model AI Gemini.
 * Menyamarkan:
 * - Nomor HP (08xx / +62xx) -> [nomor]
 * - Nomor rekening bank -> [rekening]
 * - Email -> [email]
 * - Alamat lengkap (nama jalan + nomor / RT / RW / blok) -> [alamat]
 * Catatan: Nama kota tetap dipertahankan karena diperlukan untuk kalkulasi ongkos kirim.
 */

export function sanitizePII(text: string): string {
  if (!text) return '';

  let sanitized = text;

  // 1. Email
  sanitized = sanitized.replace(
    /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/gi,
    '[email]'
  );

  // 2. Nomor Rekening Bank (misal: BCA 1234567890, No. Rek 9876543210)
  sanitized = sanitized.replace(
    /\b(?:bca|mandiri|bni|bri|cimb|seabank|rekening|rek|norek)\b\s*[:.-]?\s*\d{6,16}\b/gi,
    '[rekening]'
  );

  // 3. Nomor HP (+62 / 08... dengan format spasi/dash/titik)
  sanitized = sanitized.replace(
    /(?:\+?62[\s.-]*|0)8[0-9]{1,3}[\s.-]?[0-9]{3,4}[\s.-]?[0-9]{3,5}\b/gi,
    '[nomor]'
  );

  // 4. Alamat Lengkap (Jl. / Jalan / Gang / Komplek sampai koma atau 'di [kota]')
  sanitized = sanitized.replace(
    /(?:\b(?:jalan|gang|komplek|perumahan)\b|\bjl\.?|\bgg\.?)\s+[^,\n]+?(?=\s+di\b|,\s*|\n|$)/gi,
    '[alamat]'
  );
  return sanitized;
}
