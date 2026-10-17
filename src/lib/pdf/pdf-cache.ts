interface CachedPdf {
  buffer: Buffer;
  timestamp: number;
}

const _cache = new Map<string, CachedPdf>();
const MAX_CACHE_SIZE = 50;
const TTL_MS = 24 * 60 * 60 * 1000; // 24 jam

/**
 * Simpan buffer PDF di memori server untuk pengiriman instan (≤ 50 ms)
 */
export function setCachedPdf(idOrNumber: string, buffer: Buffer): void {
  if (_cache.size >= MAX_CACHE_SIZE) {
    const oldestKey = _cache.keys().next().value;
    if (oldestKey) _cache.delete(oldestKey);
  }
  _cache.set(idOrNumber, { buffer, timestamp: Date.now() });
}

/**
 * Ambil buffer PDF dari memori server jika tersedia
 */
export function getCachedPdf(idOrNumber: string): Buffer | null {
  const item = _cache.get(idOrNumber);
  if (!item) return null;
  if (Date.now() - item.timestamp > TTL_MS) {
    _cache.delete(idOrNumber);
    return null;
  }
  return item.buffer;
}
