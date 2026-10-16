import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { summarizeMemory } from '@/lib/ai/provider';

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
    .select('peran')
    .eq('id', user.id)
    .single();

  if (userData?.peran !== 'admin') {
    return NextResponse.json({ error: 'Hanya admin yang boleh menandai terkirim dan menyimpan memori' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { lead_id, transkrip_text, draf_ai_text, balasan_final_text, persen_edit, hasil, alasan_gagal } = body;

    if (!balasan_final_text || !transkrip_text) {
      return NextResponse.json({ error: 'Parameter transkrip dan balasan final wajib diisi' }, { status: 400 });
    }

    const { kartu_id } = await summarizeMemory({
      leadId: lead_id,
      transkripText: transkrip_text,
      drafAiText: draf_ai_text || '',
      balasanFinalText: balasan_final_text,
      persenEdit: typeof persen_edit === 'number' ? persen_edit : 0,
      hasil: hasil || 'belum_ada',
      alasanGagal: alasan_gagal,
    });

    return NextResponse.json({ success: true, kartu_id });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
