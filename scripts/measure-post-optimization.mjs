import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { chromium } from '@playwright/test';
import './patch-dns.js';

// Muat .env.local
const envPath = path.resolve(process.cwd(), '.env.local');
const env = {};
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, 'utf8')
    .split('\n')
    .forEach((line) => {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
        const idx = trimmed.indexOf('=');
        env[trimmed.slice(0, idx).trim()] = trimmed.slice(idx + 1).trim();
      }
    });
}

if (!env.TEST_ADMIN_EMAIL || !env.TEST_ADMIN_PASSWORD || !env.TEST_OWNER_EMAIL || !env.TEST_OWNER_PASSWORD) {
  throw new Error('TEST_ADMIN_* atau TEST_OWNER_* belum diisi di .env.local');
}

const lhDir = path.resolve(process.cwd(), '.lighthouse');
if (!fs.existsSync(lhDir)) {
  fs.mkdirSync(lhDir, { recursive: true });
}

async function getCookies() {
  const browser = await chromium.launch({ headless: true });

  // Admin Cookie
  const adminCtx = await browser.newContext({ baseURL: 'http://localhost:3000' });
  const adminPage = await adminCtx.newPage();
  await adminPage.goto('/login');
  await adminPage.fill('#email', env.TEST_ADMIN_EMAIL);
  await adminPage.fill('#password', env.TEST_ADMIN_PASSWORD);
  await adminPage.click('button[type="submit"]');
  await adminPage.waitForURL('**/balas', { timeout: 15000 });
  const adminCookies = await adminCtx.cookies();
  const adminCookieStr = adminCookies.map((c) => `${c.name}=${c.value}`).join('; ');

  // Owner Cookie
  const ownerCtx = await browser.newContext({ baseURL: 'http://localhost:3000' });
  const ownerPage = await ownerCtx.newPage();
  await ownerPage.goto('/login');
  await ownerPage.fill('#email', env.TEST_OWNER_EMAIL);
  await ownerPage.fill('#password', env.TEST_OWNER_PASSWORD);
  await ownerPage.click('button[type="submit"]');
  await ownerPage.waitForURL('**/dasbor', { timeout: 15000 });
  const ownerCookies = await ownerCtx.cookies();
  const ownerCookieStr = ownerCookies.map((c) => `${c.name}=${c.value}`).join('; ');

  await browser.close();
  return { adminCookieStr, ownerCookieStr };
}

async function main() {
  console.log('Mengambil cookie sesi login admin & owner...');
  const { adminCookieStr, ownerCookieStr } = await getCookies();

  const pages = [
    { name: '/login', url: 'http://localhost:3000/login', role: 'anon' },
    { name: '/balas (balas-chat)', url: 'http://localhost:3000/balas', role: 'admin' },
    { name: '/penawaran/baru (kalkulator)', url: 'http://localhost:3000/penawaran/baru', role: 'admin' },
    { name: '/penawaran', url: 'http://localhost:3000/penawaran', role: 'admin' },
    { name: '/pengaturan/buku-harga', url: 'http://localhost:3000/pengaturan/buku-harga', role: 'admin' },
    { name: '/dasbor (owner)', url: 'http://localhost:3000/dasbor', role: 'owner' },
  ];

  const results = [];

  for (const p of pages) {
    const cookie = p.role === 'owner' ? ownerCookieStr : p.role === 'admin' ? adminCookieStr : '';
    const headers = cookie ? JSON.stringify({ Cookie: cookie }) : '';

    // 1. Mobile
    const mobileFile = path.join(lhDir, `lh-post-${p.name.replace(/[^a-zA-Z0-9]/g, '_')}-mobile.json`);
    const extraHeaderFlag = headers ? ` --extra-headers=${JSON.stringify(headers)}` : '';
    try {
      execSync(
        `npx lighthouse ${p.url} --output=json --output-path=${mobileFile} --chrome-flags="--headless" --form-factor=mobile --throttling-method=simulate${extraHeaderFlag}`,
        { stdio: 'pipe' }
      );
      const mData = JSON.parse(fs.readFileSync(mobileFile, 'utf8'));
      const mScore = Math.round(mData.categories.performance.score * 100);
      const mLcp = mData.audits['largest-contentful-paint'].displayValue;
      const mTbt = mData.audits['total-blocking-time'].displayValue;
      const mCls = mData.audits['cumulative-layout-shift'].displayValue;

      // 2. Desktop
      const desktopFile = path.join(lhDir, `lh-post-${p.name.replace(/[^a-zA-Z0-9]/g, '_')}-desktop.json`);
      execSync(
        `npx lighthouse ${p.url} --output=json --output-path=${desktopFile} --chrome-flags="--headless" --preset=desktop${extraHeaderFlag}`,
        { stdio: 'pipe' }
      );
      const dData = JSON.parse(fs.readFileSync(desktopFile, 'utf8'));
      const dScore = Math.round(dData.categories.performance.score * 100);
      const dLcp = dData.audits['largest-contentful-paint'].displayValue;
      const dTbt = dData.audits['total-blocking-time'].displayValue;
      const dCls = dData.audits['cumulative-layout-shift'].displayValue;

      results.push({
        page: p.name,
        mScore,
        mLcp,
        mTbt,
        mCls,
        dScore,
        dLcp,
        dTbt,
        dCls,
      });
      console.log(
        `✓ ${p.name} | Mobile: Score ${mScore}, LCP ${mLcp}, TBT ${mTbt}, CLS ${mCls} | Desktop: Score ${dScore}, LCP ${dLcp}, TBT ${dTbt}, CLS ${dCls}`
      );
    } catch (err) {
      console.error(`✗ Error measuring ${p.name}:`, err.message);
    }
  }

  fs.writeFileSync('docs/post-optimization-lighthouse.json', JSON.stringify(results, null, 2));
  console.log('\n=== PENGUKURAN SESUDAH OPTIMASI SELESAI ===');
  console.table(results);
}

main().catch(console.error);
