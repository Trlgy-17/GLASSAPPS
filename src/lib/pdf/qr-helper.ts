import 'server-only';
import QRCode from 'qrcode';

const qrCache = new Map<string, string>();

/**
 * Generate QR code PNG data URL di server untuk dokumen PDF penawaran
 * Error correction level: M, margin: 0 sesuai spesifikasi teknis
 * Dilengkapi in-memory cache per maps_url untuk performa maksimal
 */
export async function generateQrPngDataUrl(url: string): Promise<string> {
  if (!url || typeof url !== 'string') {
    return '';
  }
  if (qrCache.has(url)) {
    return qrCache.get(url)!;
  }
  const dataUrl = await QRCode.toDataURL(url, {
    errorCorrectionLevel: 'M',
    margin: 0,
    width: 256,
  });
  qrCache.set(url, dataUrl);
  return dataUrl;
}
