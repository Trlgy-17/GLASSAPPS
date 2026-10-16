import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { draftReply, MODEL_EMBEDDING } from '@/lib/ai/provider';
import { GoogleGenAI } from '@google/genai';
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

  try {
    const body = await req.json();
    const { transkrip_messages, lead, kanal, kalkulator_output_json, arahan_admin } = body;

    // Ambil buku harga aktif
    const { data: pbRow } = await adminClient
      .from('price_books')
      .select('*')
      .eq('aktif', true)
      .single();

    const priceBook = pbRow?.data_json || defaultPriceBookV1;

    // Ambil 3 kartu memori yang paling relevan via RPC match_kartu_memori
    let memoriKasus: Array<{ ringkasan: string; teks_final: string; hasil: string }> = [];
    const clientMessages = (transkrip_messages || [])
      .filter((m: { pengirim: string }) => m.pengirim === 'klien')
      .slice(-3)
      .map((m: { teks: string }) => m.teks)
      .join(' ');

    if (clientMessages.trim()) {
      try {
        const apiKey = process.env.GEMINI_API_KEY;
        if (apiKey) {
          const ai = new GoogleGenAI({ apiKey });
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
              memoriKasus = matched.map((km: { ringkasan: string; balasan_final: string; hasil: string }) => ({
                ringkasan: km.ringkasan,
                teks_final: km.balasan_final,
                hasil: km.hasil,
              }));
            }
          }
        }
      } catch (err) {
        console.warn('Gagal mencari memori kasus serupa:', err);
      }
    }

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
