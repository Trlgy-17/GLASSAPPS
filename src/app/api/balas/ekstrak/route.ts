import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { extractScreenshot } from '@/lib/ai/provider';
import { checkAiRateLimit, validateScreenshotsServer } from '@/lib/ai/rate-limiter';
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
  const rateLimit = await checkAiRateLimit(user.id, 'ekstrak', 20);
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
    const { screenshots, pasted_text } = body;

    const validated = validateScreenshotsServer(screenshots);
    if (!validated.valid) {
      return NextResponse.json({ error: validated.error }, { status: 400 });
    }

    const sanitizedScreenshots = validated.data.map((s) => ({
      base64: s.base64.replace(/^data:image\/\w+;base64,/, ''),
      mimeType: s.mimeType,
    }));
    const result = await extractScreenshot(sanitizedScreenshots, pasted_text);
    return NextResponse.json({ success: true, extraction: result });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
