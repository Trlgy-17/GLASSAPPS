import QRCode from 'qrcode';

/**
 * Generate QR code PNG data URL di server untuk dokumen PDF penawaran
 * Error correction level: M, margin: 0 sesuai spesifikasi teknis
 */
export async function generateQrPngDataUrl(url: string): Promise<string> {
  if (!url || typeof url !== 'string') {
    return '';
  }
  return QRCode.toDataURL(url, {
    errorCorrectionLevel: 'M',
    margin: 0,
    width: 256,
  });
}
