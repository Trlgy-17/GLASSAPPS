import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

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

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const adminEmail = process.env.TEST_ADMIN_EMAIL || 'admin@putraglass.com';
const adminPassword = process.env.TEST_ADMIN_PASSWORD || '***REMOVED***';

async function runLeakAudit() {
  console.log('================================================================');
  console.log('🔍 AUDIT KEBOCORAN RAHASIA OWNER PADA HTML, RSC PAYLOAD & API JSON');
  console.log('================================================================\n');

  const supabase = createClient(supabaseUrl, anonKey);
  const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({
    email: adminEmail,
    password: adminPassword,
  });

  if (authErr || !authData.session) {
    console.error('❌ Gagal login admin:', authErr?.message);
    process.exit(1);
  }

  const token = authData.session.access_token;
  const cookieHeader = `sb-access-token=${token}; sb-refresh-token=${authData.session.refresh_token}`;
  const baseUrl = 'http://localhost:3000';

  const TARGETS = [
    { url: `${baseUrl}/penawaran/baru`, desc: 'HTML /penawaran/baru' },
    { url: `${baseUrl}/penawaran/baru?_rsc=1`, desc: 'RSC Payload /penawaran/baru' },
    { url: `${baseUrl}/balas`, desc: 'HTML /balas' },
    { url: `${baseUrl}/balas?_rsc=1`, desc: 'RSC Payload /balas' },
    { url: `${baseUrl}/pengaturan/buku-harga`, desc: 'HTML /pengaturan/buku-harga' },
    { url: `${baseUrl}/pengaturan/buku-harga?_rsc=1`, desc: 'RSC Payload /pengaturan/buku-harga' },
    { url: `${baseUrl}/api/buku-harga`, desc: 'API JSON /api/buku-harga' },
    { url: `${baseUrl}/api/dasbor?periode=bulan_ini`, desc: 'API JSON /api/dasbor' },
    { url: `${baseUrl}/api/penawaran?page=1&limit=25`, desc: 'API JSON /api/penawaran' },
  ];

  const FORBIDDEN_PATTERNS = [
    { name: 'batas_owner', regex: /batas_owner/i },
    { name: 'net B2B (1350000)', regex: /1350000|1\.350\.000/ },
    { name: 'floor ongkir rahasia owner (375000)', regex: /375000|375\.000/ },
  ];

  let totalViolations = 0;

  for (const target of TARGETS) {
    try {
      const res = await fetch(target.url, {
        headers: {
          Authorization: `Bearer ${token}`,
          Cookie: cookieHeader,
          Accept: target.url.includes('?_rsc=') ? 'text/x-component' : target.url.includes('/api/') ? 'application/json' : 'text/html',
        },
      });

      const body = await res.text();
      let targetViolations = 0;

      for (const pat of FORBIDDEN_PATTERNS) {
        if (pat.regex.test(body)) {
          console.error(`❌ BOCOR PADA ${target.desc}: Ditemukan pola rahasia "${pat.name}"!`);
          targetViolations++;
          totalViolations++;
        }
      }

      if (targetViolations === 0) {
        console.log(`✓ Bersih: ${target.desc} (Status: ${res.status}, Ukuran: ${body.length} bytes, 0 kebocoran)`);
      }
    } catch (e: unknown) {
      console.error(`❌ Gagal mengambil ${target.desc}:`, e instanceof Error ? e.message : String(e));
      totalViolations++;
    }
  }

  console.log('\n================================================================');
  if (totalViolations === 0) {
    console.log('🎉 HASIL AUDIT KEBOCORAN: 0 TEMUAN RAHASIA (100% AMAN)');
    console.log('================================================================');
  } else {
    console.error(`❌ AUDIT GAGAL: Ditemukan ${totalViolations} kebocoran rahasia owner!`);
    console.log('================================================================');
    process.exit(1);
  }
}

runLeakAudit();
