import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const adminCookie = fs.existsSync('docs/admin-cookie.txt')
  ? fs.readFileSync('docs/admin-cookie.txt', 'utf8').trim()
  : '';
const ownerCookie = fs.existsSync('docs/owner-cookie.txt')
  ? fs.readFileSync('docs/owner-cookie.txt', 'utf8').trim()
  : '';

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
  const cookie = p.role === 'owner' ? ownerCookie : p.role === 'admin' ? adminCookie : '';
  const headers = cookie ? JSON.stringify({ Cookie: cookie }) : '';

  // 1. Mobile
  const mobileFile = `docs/lh-${p.name.replace(/[^a-zA-Z0-9]/g, '_')}-mobile.json`;
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
    const desktopFile = `docs/lh-${p.name.replace(/[^a-zA-Z0-9]/g, '_')}-desktop.json`;
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

fs.writeFileSync('docs/baseline-lighthouse.json', JSON.stringify(results, null, 2));
console.log('\n=== BASELINE LIGHTHOUSE SELESAI ===');
console.table(results);
