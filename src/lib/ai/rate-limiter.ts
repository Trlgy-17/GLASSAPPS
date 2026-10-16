import { createAdminClient } from '@/lib/supabase/server';

/**
 * Penyimpanan Rate Limiter AI terdistribusi (tabel public.ai_rate_limits di Supabase)
 * Memastikan batasan 20 request/menit per user tetap konsisten di multi-instance / serverless deployment.
 */
interface RateLimitEntry {
  timestamps: number[];
}

const userCallBuckets = new Map<string, RateLimitEntry>();

function checkInMemoryRateLimit(
  userId: string,
  limitPerMinute = 20
): { allowed: boolean; remaining: number; retryAfterSec?: number } {
  const now = Date.now();
  const windowMs = 60_000;
  const cutoff = now - windowMs;

  const entry = userCallBuckets.get(userId) || { timestamps: [] };
  entry.timestamps = entry.timestamps.filter((t) => t > cutoff);

  if (entry.timestamps.length >= limitPerMinute) {
    const oldest = entry.timestamps[0];
    const retryAfterSec = Math.ceil((oldest + windowMs - now) / 1000);
    return {
      allowed: false,
      remaining: 0,
      retryAfterSec: Math.max(1, retryAfterSec),
    };
  }

  entry.timestamps.push(now);
  userCallBuckets.set(userId, entry);

  return {
    allowed: true,
    remaining: limitPerMinute - entry.timestamps.length,
  };
}

export async function checkAiRateLimit(
  userId: string,
  endpoint = 'balas',
  limitPerMinute = 20
): Promise<{ allowed: boolean; remaining: number; retryAfterSec?: number }> {
  try {
    const adminClient = createAdminClient();
    const { data, error } = await adminClient.rpc('check_and_record_ai_rate_limit', {
      p_user_id: userId,
      p_endpoint: endpoint,
      p_limit: limitPerMinute,
      p_window_seconds: 60,
    });

    if (!error && data && typeof data === 'object') {
      const resp = data as Record<string, unknown>;
      return {
        allowed: Boolean(resp.allowed),
        remaining: Number(resp.remaining || 0),
        retryAfterSec: typeof resp.retry_after_sec === 'number' ? resp.retry_after_sec : undefined,
      };
    }
  } catch (err) {
    console.warn('[RateLimiter] Fallback ke in-memory:', err);
  }

  return checkInMemoryRateLimit(userId, limitPerMinute);
}

const ALLOWED_MIME_TYPES: Record<string, true> = {
  'image/jpeg': true,
  'image/jpg': true,
  'image/png': true,
  'image/webp': true,
};

const MAX_SCREENSHOT_BYTES = 10 * 1024 * 1024; // 10 MB per image
// Base64 encoding expands bytes by ~4/3
const MAX_BASE64_LEN = Math.ceil((MAX_SCREENSHOT_BYTES * 4) / 3) + 1024;

export interface ValidatedScreenshot {
  base64: string;
  mimeType: string;
}

export function validateScreenshotsServer(
  rawScreenshots: unknown
): { valid: boolean; error?: string; data: ValidatedScreenshot[] } {
  if (!rawScreenshots) {
    return { valid: true, data: [] };
  }

  if (!Array.isArray(rawScreenshots)) {
    return { valid: false, error: 'Format screenshot harus berupa array', data: [] };
  }

  if (rawScreenshots.length > 5) {
    return {
      valid: false,
      error: 'Maksimal 5 screenshot per permintaan (diterima: ' + rawScreenshots.length + ')',
      data: [],
    };
  }

  const cleaned: ValidatedScreenshot[] = [];

  for (let i = 0; i < rawScreenshots.length; i++) {
    const item = rawScreenshots[i];
    if (!item || typeof item !== 'object') {
      return { valid: false, error: `Screenshot #${i + 1} tidak valid`, data: [] };
    }

    const { base64, mimeType } = item as { base64?: unknown; mimeType?: unknown };

    if (typeof mimeType !== 'string' || !ALLOWED_MIME_TYPES[mimeType.toLowerCase()]) {
      return {
        valid: false,
        error: `Screenshot #${i + 1}: Tipe berkas "${mimeType}" tidak didukung. Hanya JPEG, PNG, dan WebP yang diizinkan.`,
        data: [],
      };
    }

    if (typeof base64 !== 'string' || !base64.trim()) {
      return { valid: false, error: `Screenshot #${i + 1}: Data gambar kosong`, data: [] };
    }

    if (base64.length > MAX_BASE64_LEN) {
      return {
        valid: false,
        error: `Screenshot #${i + 1}: Ukuran gambar melebihi batas 10 MB`,
        data: [],
      };
    }

    cleaned.push({
      base64: base64.trim(),
      mimeType: mimeType.toLowerCase(),
    });
  }

  return { valid: true, data: cleaned };
}
