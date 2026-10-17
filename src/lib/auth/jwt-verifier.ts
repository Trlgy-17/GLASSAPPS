import { jwtVerify } from 'jose/jwt/verify';
import { createRemoteJWKSet } from 'jose/jwks/remote';
import type { JWTVerifyGetKey, JWTPayload } from 'jose';

let _jwks: JWTVerifyGetKey | null = null;

function getJWKS(): JWTVerifyGetKey {
  if (!_jwks) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://rdjzejhbebwufqjgcgkd.supabase.co';
    const jwksUrl = new URL(`${supabaseUrl}/auth/v1/.well-known/jwks.json`);
    _jwks = createRemoteJWKSet(jwksUrl, {
      cacheMaxAge: 10 * 60 * 1000,
    });
  }
  return _jwks;
}

export interface VerifiedJwtClaims extends JWTPayload {
  sub: string;
  email?: string;
  user_metadata?: {
    nama?: string;
    peran?: string;
    is_test?: boolean;
  };
  app_metadata?: {
    role?: string;
    claims_admin?: boolean;
  };
}

/**
 * Verifikasi tanda tangan kriptografis token JWT terhadap Supabase JWKS (ES256 / Ed25519)
 * Melempar error jika tanda tangan salah, token dipalsukan, payload dimanipulasi, atau expired.
 */
export async function verifySupabaseJwt(token: string): Promise<VerifiedJwtClaims> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const JWKS = getJWKS();

  const { payload } = await jwtVerify(token, JWKS, {
    issuer: supabaseUrl ? `${supabaseUrl}/auth/v1` : undefined,
    audience: 'authenticated',
  });

  return payload as VerifiedJwtClaims;
}
