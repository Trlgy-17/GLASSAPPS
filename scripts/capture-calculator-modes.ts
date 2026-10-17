import { chromium } from '@playwright/test';
import path from 'path';
import fs from 'fs';

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

const adminEmail = process.env.TEST_ADMIN_EMAIL;
const adminPassword = process.env.TEST_ADMIN_PASSWORD;

if (!adminEmail || !adminPassword) {
  throw new Error('TEST_ADMIN_EMAIL atau TEST_ADMIN_PASSWORD belum diisi di .env.local');
}

async function capture() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
  });
  const page = await context.newPage();

  // Login as admin
  await page.goto('http://localhost:3000/login');
  await page.fill('#email', adminEmail);
  await page.fill('#password', adminPassword);
  await page.click('button[type="submit"]');
  await page.waitForURL('**/balas', { timeout: 15000 });

  // Navigasi ke /penawaran/baru
  await page.goto('http://localhost:3000/penawaran/baru');
  await page.waitForSelector('#label-total-penawaran');

  // 1. Screenshot Mode Produk Jadi (SKU)
  await page.click('button:has-text("Produk Jadi (SKU)")');
  await page.waitForTimeout(500);
  const outSku = path.resolve('docs/screenshot-kalkulator-mode-produk-jadi.png');
  await page.screenshot({ path: outSku, fullPage: true });
  console.log('✓ Screenshot Mode Produk Jadi disimpan:', outSku);

  // 2. Screenshot Mode Custom Ukuran
  await page.click('button:has-text("Custom Ukuran")');
  await page.waitForTimeout(500);
  const outCustom = path.resolve('docs/screenshot-kalkulator-mode-custom.png');
  await page.screenshot({ path: outCustom, fullPage: true });
  console.log('✓ Screenshot Mode Custom Ukuran disimpan:', outCustom);

  await browser.close();
}

capture();
