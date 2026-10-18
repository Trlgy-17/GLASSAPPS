import { describe, it, expect } from 'vitest';
import { verifySupabaseJwt } from './jwt-verifier';
import fs from 'fs';
import path from 'path';

const ENV_PATH = path.resolve(process.cwd(), '.env.local');
const HAS_ENV = fs.existsSync(ENV_PATH);

function getEnvCredentials() {
  if (!HAS_ENV) return {} as Record<string, string>;
  const envContent = fs.readFileSync(path.resolve(process.cwd(), '.env.local'), 'utf8');
  const env: Record<string, string> = {};
  envContent.split('\n').forEach((line) => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
      const idx = trimmed.indexOf('=');
      env[trimmed.slice(0, idx).trim()] = trimmed.slice(idx + 1).trim();
    }
  });
  return env;
}

// Tes integrasi: butuh .env.local dan koneksi ke Supabase. Dilewati otomatis bila tidak ada.
describe.skipIf(!HAS_ENV)('Verifikasi Kriptografis Token JWT Supabase via JWKS', () => {
  let validToken = '';
  const env = getEnvCredentials();

  it('1. Token asli dari Supabase Auth lolos verifikasi tanda tangan kriptografis', async () => {
    const loginRes = await fetch(`${env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({
        email: env.TEST_ADMIN_EMAIL,
        password: env.TEST_ADMIN_PASSWORD,
      }),
    });

    const loginJson = await loginRes.json();
    validToken = loginJson.access_token;
    expect(validToken).toBeTruthy();

    const claims = await verifySupabaseJwt(validToken);
    expect(claims.sub).toBeTruthy();
    expect(claims.aud).toBe('authenticated');
  });

  it('2. Token palsu dengan tanda tangan sembarangan DITOLAK (signature verification failed)', async () => {
    expect(validToken).toBeTruthy();
    const fakeToken = validToken.slice(0, -12) + 'fakeSignature!';

    await expect(verifySupabaseJwt(fakeToken)).rejects.toThrow();
  });

  it('3. Token dengan role diubah manual (tampered payload) DITOLAK secara kriptografis', async () => {
    expect(validToken).toBeTruthy();
    const parts = validToken.split('.');
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));

    // Manipulasi role dari admin menjadi owner
    payload.user_metadata = { ...payload.user_metadata, peran: 'owner' };
    const tamperedPayloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const tamperedToken = `${parts[0]}.${tamperedPayloadB64}.${parts[2]}`;

    // Signature tidak lagi cocok dengan payload baru -> HARUS melempar error
    await expect(verifySupabaseJwt(tamperedToken)).rejects.toThrow();
  });

  it('4. Token kedaluwarsa (expired) DITOLAK', async () => {
    expect(validToken).toBeTruthy();
    const parts = validToken.split('.');
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));

    // Buat exp di masa lalu (10 menit lalu)
    payload.exp = Math.floor(Date.now() / 1000) - 600;
    const expiredPayloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const expiredToken = `${parts[0]}.${expiredPayloadB64}.${parts[2]}`;

    await expect(verifySupabaseJwt(expiredToken)).rejects.toThrow();
  });
});
