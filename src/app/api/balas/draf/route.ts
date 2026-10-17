import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { draftReply, MODEL_EMBEDDING, getAIClient } from '@/lib/ai/provider';
import { checkAiRateLimit } from '@/lib/ai/rate-limiter';
import { defaultPriceBookV1 } from '@/lib/pricing/default-price-book';

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const adminClient = createAdminClient();

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

  // Cek peran user
  const { data: userData } = await adminClient
    .from('users')
    .select('nama, peran')
    .eq('id', user.id)
    .single();

  if (userData?.peran !== 'admin') {
    return NextResponse.json({ error: 'Hanya admin yang boleh membuat draf balasan' }, { status: 403 });
  }

  const rateLimit = await checkAiRateLimit(user.id, 'draf', 20);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: `Terlalu banyak permintaan AI. Batas 20/menit. Coba lagi dalam ${rateLimit.retryAfterSec} detik.` },
      { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfterSec) } }
    );
  }

  const contentLength = Number(req.headers.get('content-length') || '0');
  if (contentLength > 15 * 1024 * 1024) {
    return NextResponse.json({ error: 'Ukuran request terlalu besar (maksimal 15 MB)' }, { status: 413 });
  }

  try {
    const body = await req.json();
    const { transkrip_messages, lead, kanal, kalkulator_output_json, arahan_admin } = body;

    // Jalankan pengambilan Buku Harga dan pemuatan Kartu Memori KB secara paralel
    const clientMessages = (transkrip_messages || [])
      .filter((m: { pengirim: string }) => m.pengirim === 'klien')
      .slice(-3)
      .map((m: { teks: string }) => m.teks)
      .join(' ');

    const [pbRowRes, memoriKasus] = await Promise.all([
      adminClient.from('price_books').select('*').eq('aktif', true).single(),
      (async () => {
        if (!clientMessages.trim()) return [];
        try {
          const ai = getAIClient();
          const embedRes = await ai.models.embedContent({
            model: MODEL_EMBEDDING,
            contents: clientMessages,
          });
          const queryEmbedding = embedRes.embeddings?.[0]?.values;
          if (queryEmbedding && queryEmbedding.length > 0) {
            const { data: matched } = await adminClient.rpc('match_kartu_memori', {
              query_embedding: queryEmbedding,
              match_threshold: 0.5,
              match_count: 3,
            });
            if (matched && matched.length > 0) {
              return matched.map((km: { ringkasan: string; balasan_final: string; hasil: string }) => ({
                ringkasan: km.ringkasan,
                teks_final: km.balasan_final,
                hasil: km.hasil,
              }));
            }
          }
        } catch (err) {
          console.warn('Gagal mencari memori kasus serupa:', err);
        }
        return [];
      })(),
    ]);

    const priceBook = pbRowRes.data?.data_json || defaultPriceBookV1;

    const drafResult = await draftReply(
      {
        priceBook,
        namaAdmin: userData?.nama || 'Admin',
        lead: {
          nama: lead?.nama || '',
          kota: lead?.kota || '',
          zona: lead?.zona || 'luar_kota',
          segmen: lead?.segmen || 'B2C',
          status: lead?.status || 'aktif',
          keberatanTerakhir: lead?.keberatan_terakhir,
        },
        kalkulatorOutputJson: kalkulator_output_json,
        transkripMessages: transkrip_messages || [],
        memoriKasus,
        kanal: kanal || 'whatsapp',
        arahanAdmin: arahan_admin,
      },
      priceBook
    );

    return NextResponse.json({ success: true, draf: drafResult });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
