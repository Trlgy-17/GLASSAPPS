import fs from 'fs';
import path from 'path';
import { Page, expect } from '@playwright/test';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Muat .env.local
const envPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach((line) => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
      const idx = trimmed.indexOf('=');
      const key = trimmed.slice(0, idx).trim();
      const val = trimmed.slice(idx + 1).trim();
      process.env[key] = val;
    }
  });
}

export const ADMIN_EMAIL = process.env.TEST_ADMIN_EMAIL || 'admin@putraglass.com';
export const ADMIN_PASSWORD = process.env.TEST_ADMIN_PASSWORD || '***REMOVED***';
export const OWNER_EMAIL = process.env.TEST_OWNER_EMAIL || 'owner@putraglass.com';
export const OWNER_PASSWORD = process.env.TEST_OWNER_PASSWORD || '***REMOVED***';

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
export const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

let _serviceClient: SupabaseClient | null = null;
export function getServiceClient(): SupabaseClient {
  if (!_serviceClient) {
    _serviceClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  }
  return _serviceClient;
}

export async function loginAsAdmin(page: Page) {
  await page.goto('/login');
  await page.fill('#email', ADMIN_EMAIL);
  await page.fill('#password', ADMIN_PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL('**/balas', { timeout: 15000 });
}

export async function loginAsOwner(page: Page) {
  await page.goto('/login');
  await page.fill('#email', OWNER_EMAIL);
  await page.fill('#password', OWNER_PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL('**/dasbor', { timeout: 15000 });
}

export async function getAuthToken(email: string, pass: string): Promise<string> {
  const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const { data, error } = await client.auth.signInWithPassword({
    email,
    password: pass,
  });
  if (error || !data.session) {
    throw new Error(`Gagal login untuk ${email}: ${error?.message}`);
  }
  return data.session.access_token;
}
