import { NextRequest, NextResponse, after } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import {
  executeUnifiedDraft,
  logAICall,
  MODEL_MAIN,
  ScreenshotInput,
} from '@/lib/ai/provider';
import { defaultPriceBookV1 } from '@/lib/pricing/default-price-book';
import { sanitizePII } from '@/lib/ai/sanitizer';
import { checkAiRateLimit, validateScreenshotsServer } from '@/lib/ai/rate-limiter';
import { ThinkingLevel } from '@google/genai';
export async function POST(req: NextRequest) {
  const tTotalStart = Date.now();
  const supabase = await createClient();
  const adminClient = createAdminClient();

  // 1. Autentikasi Admin
  const tAuth0 = Date.now();
  let user = (await supabase.auth.getUser()).data.user;
  if (!user) {
    const authHeader = req.headers.get('authorization');
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.replace('Bearer ', '');
      const { data: tokenUser } = await adminClient.auth.getUser(token);
      user = tokenUser.user;
    }
  }

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: userData } = await adminClient
    .from('users')
    .select('nama, peran')
    .eq('id', user.id)
    .single();

  if (userData?.peran !== 'admin') {
    return NextResponse.json({ error: 'Hanya admin yang boleh memproses balasan chat' }, { status: 403 });
  }
  const durasiAuth = Date.now() - tAuth0;

  // Periksa batas request per user (20 request / menit)
  const rateLimit = await checkAiRateLimit(user.id, 'proses', 20);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: `Terlalu banyak permintaan AI. Batas 20/menit. Coba lagi dalam ${rateLimit.retryAfterSec} detik.` },
      { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfterSec) } }
    );
  }

  // Periksa ukuran body request (maksimal 15 MB)
  const contentLength = Number(req.headers.get('content-length') || '0');
  if (contentLength > 15 * 1024 * 1024) {
    return NextResponse.json({ error: 'Ukuran request terlalu besar (maksimal 15 MB)' }, { status: 413 });
  }

  try {
    const body = await req.json();
    const { screenshots, pasted_text, override_kanal, arahan_admin, model_name, thinking_level, klien_lanjutan } = body;
    const sanitizedPastedText = pasted_text ? sanitizePII(pasted_text) : '';

    // Validasi screenshot di server (tipe file MIME & ukuran)
    const validated = validateScreenshotsServer(screenshots);
    if (!validated.valid) {
      return NextResponse.json({ error: validated.error }, { status: 400 });
    }

    if (validated.data.length === 0 && (!sanitizedPastedText || !sanitizedPastedText.trim())) {
      return NextResponse.json(
        { error: 'Tempel screenshot chat (Ctrl+V) atau masukkan teks chat terlebih dahulu' },
        { status: 400 }
      );
    }

    // 2. Baca Buku Harga Aktif dari DB
    const tDb0 = Date.now();
    const { data: pbRow } = await adminClient
      .from('price_books')
      .select('*')
      .eq('aktif', true)
      .single();

    const priceBook = pbRow?.data_json || defaultPriceBookV1;
    const durasiDbRead = Date.now() - tDb0;

    // Bersihkan format screenshot dari data yang sudah tervalidasi
    const sanitizedScreenshots: ScreenshotInput[] = validated.data.map((s) => ({
      base64: s.base64.replace(/^data:image\/\w+;base64,/, ''),
      mimeType: s.mimeType,
    }));
    // 3. SATU PANGGILAN TERPADU DRAF PERTAMA (Multimodal SPEC + DRAFT)
    const tModel0 = Date.now();
    const resolvedThinkingLevel =
      thinking_level === 'minimal'
        ? ThinkingLevel.MINIMAL
        : thinking_level === 'medium'
        ? ThinkingLevel.MEDIUM
        : ThinkingLevel.LOW;

    const unifiedRes = await executeUnifiedDraft({
      screenshots: sanitizedScreenshots,
      pastedText: sanitizedPastedText,
      overrideKanal: override_kanal,
      arahanAdmin: arahan_admin,
      priceBook,
      modelName: model_name,
      thinkingLevel: resolvedThinkingLevel,
      klienLanjutan: klien_lanjutan,
    });
    const durasiModel = Date.now() - tModel0;
    const durasiTotal = Date.now() - tTotalStart;
    // 4. Cek apakah nama klien atau nomor PG-Q cocok dengan penawaran 30 hari terakhir (jika belum memakai klien_lanjutan)
    let matchedPenawaran: Record<string, unknown> | null = null;
    if (!klien_lanjutan) {
      try {
        const extractedName = (unifiedRes.extraction?.nama_klien || '').trim();
        const pgqMatch = sanitizedPastedText.match(/PG-Q-\d{4}-[A-Z0-9-]+/i);
        const pgqNomor = pgqMatch ? pgqMatch[0].toUpperCase() : null;

        if (
          (extractedName &&
            extractedName.length >= 2 &&
            !/^(klien|kak|kakak|ibu|bapak|pak|bu|admin)$/i.test(extractedName)) ||
          pgqNomor
        ) {
          const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString();
          const { data: recentQuotes } = await adminClient
            .from('penawaran')
            .select(
              'id, nomor, total_nilai, created_at, status, kanal, items_json, ringkasan_json, leads!inner(id, nama, kota, zona, segmen)'
            )
            .gte('created_at', thirtyDaysAgo)
            .order('created_at', { ascending: false })
            .limit(40);

          if (recentQuotes && recentQuotes.length > 0) {
            const normTargetName = extractedName.replace(/^\[TES\]\s*/i, '').trim().toLowerCase();
            const matchingRows = (recentQuotes as Array<Record<string, unknown>>).filter((q) => {
              if (pgqNomor && String(q.nomor || '').toUpperCase() === pgqNomor) return true;
              if (!normTargetName) return false;
              const leads = (q.leads || {}) as Record<string, unknown>;
              const leadName = String(leads.nama || '')
                .replace(/^\[TES\]\s*/i, '')
                .trim()
                .toLowerCase();
              return leadName === normTargetName || (leadName.length >= 3 && leadName.includes(normTargetName));
            });

            if (matchingRows.length > 0) {
              const latest = matchingRows[0];
              const leads = (latest.leads || {}) as Record<string, unknown>;
              const ringkasan = (latest.ringkasan_json || {}) as Record<string, unknown>;
              const items = Array.isArray(latest.items_json)
                ? (latest.items_json as Array<Record<string, unknown>>)
                : [];
              const createdMs = new Date(latest.created_at as string).getTime();
              const diffDays = Math.floor((Date.now() - createdMs) / 86400000);
              const waktuLalu =
                diffDays <= 0 ? 'hari ini' : diffDays === 1 ? '1 hari lalu' : `${diffDays} hari lalu`;

              matchedPenawaran = {
                id: latest.id as string,
                nomor: latest.nomor as string,
                nama_klien: (leads.nama as string) || 'Klien',
                kota: (leads.kota as string) || (ringkasan.kota_klien as string) || '',
                zona: (leads.zona as string) || 'luar_kota',
                segmen: (leads.segmen as string) || 'B2C',
                total_nilai: Number(latest.total_nilai || ringkasan.total || 0),
                tanggal: new Date(latest.created_at as string).toLocaleDateString('id-ID', {
                  day: 'numeric',
                  month: 'short',
                }),
                waktu_lalu: waktuLalu,
                other_quotes_count: Math.max(0, matchingRows.length - 1),
                status: latest.status as string,
                spesifikasi: items[0] || null,
              };
            }
          }
        }
      } catch (matchErr) {
        console.warn('Gagal memeriksa kecocokan penawaran lama:', matchErr);
      }
    }

    // 5. Server-Timing Header per Tahap
    const serverTiming = [
      `auth;dur=${durasiAuth}`,
      `db_read;dur=${durasiDbRead}`,
      `prompt_build;dur=2`,
      `model_ttft;dur=${unifiedRes.ttftMs}`,
      `model_total;dur=${durasiModel}`,
      `validasi;dur=1`,
      `total;dur=${durasiTotal}`,
    ].join(', ');

    const responsePayload = {
      success: true,
      extraction: unifiedRes.extraction,
      draf: unifiedRes.draf,
      matched_penawaran: matchedPenawaran,
      model_used: unifiedRes.modelUsed,
      provider: unifiedRes.provider,
      alasan_pindah: unifiedRes.alasanPindah || null,
      biaya_perkiraan: unifiedRes.biayaPerkiraan || 0,
      durasi: {
        ttft_ms: unifiedRes.ttftMs,
        model_total_ms: durasiModel,
        total_ms: durasiTotal,
      },
    };
    const response = NextResponse.json(responsePayload, {
      headers: {
        'Server-Timing': serverTiming,
      },
    });

    // 5. Simpan ke DB secara Asinkron SETELAH respons dikirim (after() - non-blocking)
    after(async () => {
      try {
        await logAICall({
          model: unifiedRes.modelUsed,
          provider: unifiedRes.provider,
          alasan_pindah: unifiedRes.alasanPindah || null,
          biaya_perkiraan: unifiedRes.biayaPerkiraan || 0,
          token_in: unifiedRes.inputTokens || 0,
          token_out: unifiedRes.outputTokens || 0,
          endpoint: 'processUnifiedDraft',
          langkah: 'draf',
          durasi_ms: unifiedRes.durasiMs,
          ms_ttft: unifiedRes.ttftMs,
          status: 'success',
          metadata: {
            durasi_auth_ms: durasiAuth,
            durasi_db_read_ms: durasiDbRead,
            durasi_model_ms: durasiModel,
            durasi_total_ms: durasiTotal,
            kanal: unifiedRes.extraction.platform,
            alasan_pindah: unifiedRes.alasanPindah,
          },
        });
      } catch (logErr) {
        console.warn('Gagal mencatat ai_log background:', logErr);
      }
    });

    return response;
  } catch (err: unknown) {
    const rawMsg = err instanceof Error ? err.message : String(err);
    let userFriendlyMsg = rawMsg;
    if (rawMsg.includes('{') || rawMsg.includes('JSON')) {
      userFriendlyMsg = 'Server AI sedang sibuk. Screenshot & catatan tetap tersimpan, klik Coba Lagi.';
    }
    return NextResponse.json({ error: userFriendlyMsg }, { status: 500 });
  }
}
