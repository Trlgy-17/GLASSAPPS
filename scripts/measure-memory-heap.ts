import { chromium } from '@playwright/test';
import { ADMIN_EMAIL, ADMIN_PASSWORD } from '../tests/e2e/helpers';

async function main() {
  console.log('=== PENGUJIAN MEMORI HEAP (20x DRAFT + 20x GANTI HALAMAN) ===');

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ baseURL: 'http://localhost:3000' });
  const page = await context.newPage();

  const cdp = await context.newCDPSession(page);
  await cdp.send('Performance.enable');
  async function getHeapSizeKb(): Promise<number> {
    try {
      await cdp.send('HeapProfiler.collectGarbage');
    } catch {}
    const { metrics } = await cdp.send('Performance.getMetrics');
    const heapMetric = metrics.find((m) => m.name === 'JSHeapUsedSize');
    return heapMetric ? Math.round(heapMetric.value / 1024) : 0;
  }

  // 1. Login
  await page.goto('/login');
  await page.fill('#email', ADMIN_EMAIL);
  await page.fill('#password', ADMIN_PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL('**/balas');
  // 1. Kunjungi halaman awal untuk memuat runtime awal
  await page.goto('/balas');
  await page.waitForSelector('textarea');
  await page.waitForTimeout(1000);
  const initialHeapKb = await getHeapSizeKb();
  console.log(`Initial Heap (Setelah rute awal termuat & GC): ${initialHeapKb} KB (${(initialHeapKb / 1024).toFixed(2)} MB)`);
  // 2. Loop 20x draft teks + ganti halaman
  const routes = ['/balas', '/penawaran/baru', '/penawaran', '/pengaturan/buku-harga'];

  for (let i = 1; i <= 20; i++) {
    // A. Interaksi draf di /balas
    await page.goto('/balas');
    await page.waitForSelector('textarea');
    await page.fill('textarea', `Simulasi pesan teks draf ke-${i} untuk pengujian stabilitas memori.`);
    await page.click('#btn-buat-draf');
    await page.waitForTimeout(500);

    // B. Ganti halaman
    const nextRoute = routes[i % routes.length];
    await page.goto(nextRoute);
    await page.waitForTimeout(300);

    if (i % 5 === 0) {
      const currentHeap = await getHeapSizeKb();
      console.log(`Iterasi ${i}/20 - Heap: ${currentHeap} KB (${(currentHeap / 1024).toFixed(2)} MB)`);
    }
  }

  // 3. Kembali ke /balas dan ukur final heap
  await page.goto('/balas');
  await page.waitForTimeout(2000);

  const finalHeapKb = await getHeapSizeKb();
  const increasePercent = (((finalHeapKb - initialHeapKb) / initialHeapKb) * 100).toFixed(1);

  console.log(`\nFinal Heap: ${finalHeapKb} KB (${(finalHeapKb / 1024).toFixed(2)} MB)`);
  console.log(`Kenaikan Heap: ${increasePercent}% (Target: < 30%)`);

  if (Number(increasePercent) < 30) {
    console.log('✅ UJI MEMORI LULUS: Heap tidak naik > 30%!');
  } else {
    console.warn('⚠️ Kenaikan heap melebihi 30%');
  }

  await browser.close();
}

main().catch((err) => {
  console.error('Error memory test:', err);
  process.exit(1);
});
