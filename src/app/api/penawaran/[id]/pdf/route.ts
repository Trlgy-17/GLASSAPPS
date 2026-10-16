import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const adminClient = createAdminClient();

  const { data: penawaran, error } = await adminClient
    .from('penawaran')
    .select('pdf_path, status, nomor')
    .eq('id', id)
    .single();

  if (error || !penawaran) {
    return NextResponse.json({ error: 'Penawaran tidak ditemukan' }, { status: 404 });
  }


  const { data: signedData, error: signErr } = await adminClient.storage
    .from('penawaran-pdf')
    .createSignedUrl(penawaran.pdf_path, 3600);

  if (signErr || !signedData?.signedUrl) {
    return NextResponse.json({ error: 'Gagal membuat tautan unduh PDF' }, { status: 500 });
  }

  return NextResponse.redirect(signedData.signedUrl);
}
