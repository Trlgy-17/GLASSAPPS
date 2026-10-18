import { createRequire } from 'module';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const { shouldPatch, patchTarget, DEFAULT_IP } = require('./patch-dns.js') as {
  shouldPatch: (env: Record<string, string | undefined>) => boolean;
  patchTarget: (env: Record<string, string | undefined>) => { address: string; family: number };
  DEFAULT_IP: string;
};

describe('patch-dns', () => {
  it('aktif di lokal (dev, tes, skrip)', () => {
    expect(shouldPatch({ NODE_ENV: 'development' })).toBe(true);
    expect(shouldPatch({ NODE_ENV: 'test' })).toBe(true);
    expect(shouldPatch({})).toBe(true);
  });

  it('tidak aktif di produksi (VPS)', () => {
    expect(shouldPatch({ NODE_ENV: 'production' })).toBe(false);
  });

  it('bisa dimatikan atau dipaksa lewat SUPABASE_DNS_PATCH', () => {
    expect(shouldPatch({ NODE_ENV: 'development', SUPABASE_DNS_PATCH: '0' })).toBe(false);
    expect(shouldPatch({ NODE_ENV: 'production', SUPABASE_DNS_PATCH: '1' })).toBe(true);
  });

  it('memakai IP pengganti hanya jika valid', () => {
    expect(patchTarget({})).toEqual({ address: DEFAULT_IP, family: 6 });
    expect(patchTarget({ SUPABASE_DNS_PATCH_IP: '104.18.38.10' })).toEqual({ address: '104.18.38.10', family: 4 });
    expect(patchTarget({ SUPABASE_DNS_PATCH_IP: 'bukan-ip' })).toEqual({ address: DEFAULT_IP, family: 6 });
  });
});
