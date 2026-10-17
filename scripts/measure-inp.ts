import fs from 'fs';
import { chromium } from '@playwright/test';
import './patch-dns.js';
import { ADMIN_EMAIL, ADMIN_PASSWORD } from '../tests/e2e/helpers';

async function main() {
  console.log('=== PENGUKURAN INP (INTERACTION TO NEXT PAINT) DENGAN PERFORMANCE OBSERVER ===');

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    baseURL: 'http://localhost:3000',
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
  });
  const page = await context.newPage();

  // Injeksi PerformanceObserver untuk event timing (INP)
  await page.addInitScript(() => {
    (window as any).__inpEvents = [];
    try {
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          const e = entry as any;
          if (e.interactionId || e.duration > 0) {
            (window as any).__inpEvents.push({
              name: e.name,
              entryType: e.entryType,
              duration: Math.round(e.duration),
              processingStart: Math.round(e.processingStart - e.startTime),
              processingEnd: Math.round(e.processingEnd - e.processingStart),
            });
          }
        }
      });
      (observer as any).observe({ type: 'event', buffered: true, durationThreshold: 0 });
    } catch {}
  });

  // Login
  await page.goto('/login');
  await page.fill('#email', ADMIN_EMAIL);
  await page.fill('#password', ADMIN_PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL('**/balas');

  // 1. Pengukuran INP saat mengetik di Kalkulator (/penawaran/baru)
  console.log('\n1. Menguji INP saat mengetik di Kalkulator...');
  await page.goto('/penawaran/baru');
  await page.waitForSelector('h1:has-text("Kalkulator Penawaran")');

  // Bersihkan log event sebelum interaksi
  await page.evaluate(() => {
    (window as any).__inpEvents = [];
  });

  // Ketik nama klien dan ukuran panjang/lebar
  const tStartCalc = Date.now();
  await page.fill('#input-nama-klien', 'Budi Santoso');
  await page.fill('input[value="60"]', '75');
  await page.fill('input[value="80"]', '95');
  const tEndCalc = Date.now();

  await page.waitForTimeout(500);

  const calcEvents = await page.evaluate(() => (window as any).__inpEvents || []);
  const maxCalcDuration = calcEvents.reduce((max: number, e: any) => Math.max(max, e.duration || 0), 0);
  const avgCalcDuration =
    calcEvents.length > 0
      ? Math.round(calcEvents.reduce((acc: number, e: any) => acc + (e.duration || 0), 0) / calcEvents.length)
      : 0;

  console.log(`- Total interaksi ketik: ${calcEvents.length} event`);
  console.log(`- INP Maksimum Kalkulator: ${maxCalcDuration} ms (Target: <= 200 ms)`);
  console.log(`- Rata-rata Durasi Event: ${avgCalcDuration} ms`);

  // 2. Pengukuran INP saat klik "Buat Draf" di /balas
  console.log('\n2. Menguji INP saat klik "Buat Draf" di /balas...');
  await page.goto('/balas');
  await page.waitForSelector('h1:has-text("Balas Chat")');
  await page.fill('textarea', 'Halo tanya harga cermin bulat diameter 60 cm');

  await page.evaluate(() => {
    (window as any).__inpEvents = [];
  });

  await page.click('#btn-buat-draf');
  await page.waitForTimeout(1000);

  const draftEvents = await page.evaluate(() => (window as any).__inpEvents || []);
  const maxDraftDuration = draftEvents.reduce((max: number, e: any) => Math.max(max, e.duration || 0), 0);
  const avgDraftDuration =
    draftEvents.length > 0
      ? Math.round(draftEvents.reduce((acc: number, e: any) => acc + (e.duration || 0), 0) / draftEvents.length)
      : 0;

  console.log(`- Total interaksi tombol: ${draftEvents.length} event`);
  console.log(`- INP Maksimum Buat Draf: ${maxDraftDuration} ms (Target: <= 200 ms)`);
  console.log(`- Rata-rata Durasi Event: ${avgDraftDuration} ms`);

  const results = {
    kalkulator: {
      maxInpMs: maxCalcDuration,
      avgDurationMs: avgCalcDuration,
      status: maxCalcDuration <= 200 ? 'PASS' : 'WARN',
    },
    buatDraf: {
      maxInpMs: maxDraftDuration,
      avgDurationMs: avgDraftDuration,
      status: maxDraftDuration <= 200 ? 'PASS' : 'WARN',
    },
  };

  fs.writeFileSync('docs/hasil-pengukuran-inp.json', JSON.stringify(results, null, 2));

  await browser.close();
}

main().catch(console.error);
