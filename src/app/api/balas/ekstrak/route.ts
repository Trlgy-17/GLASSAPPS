import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { extractScreenshot } from '@/lib/ai/provider';

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

  // Cek peran user (hanya admin)
  const { data: userData } = await adminClient
    .from('users')
    .select('peran')
    .eq('id', user.id)
    .single();

  if (userData?.peran !== 'admin') {
    return NextResponse.json({ error: 'Hanya admin yang boleh melakukan ekstraksi chat' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { screenshots, pasted_text } = body;

    const rawScreenshots = Array.isArray(screenshots) ? screenshots : [];
    if (rawScreenshots.length > 5) {
      return NextResponse.json({ error: 'Maks. 5 screenshot per permintaan' }, { status: 400 });
    }

    const sanitizedScreenshots = rawScreenshots.map((s: { base64: string; mimeType?: string }) => ({
      base64: s.base64.replace(/^data:image\/\w+;base64,/, ''),
      mimeType: s.mimeType || 'image/jpeg',
    }));

    const result = await extractScreenshot(sanitizedScreenshots, pasted_text);
    return NextResponse.json({ success: true, extraction: result });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
