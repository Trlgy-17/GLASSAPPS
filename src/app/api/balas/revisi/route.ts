import { NextRequest, NextResponse, after } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { executeFastRevision, logAICall } from '@/lib/ai/provider';

export async function POST(req: NextRequest) {
  const tTotalStart = Date.now();
  const supabase = await createClient();
  const adminClient = createAdminClient();

  // Autentikasi Admin
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
    .select('peran')
    .eq('id', user.id)
    .single();

  if (userData?.peran !== 'admin') {
    return NextResponse.json({ error: 'Hanya admin yang boleh merevisi draf' }, { status: 403 });
  }
  const durasiAuth = Date.now() - tAuth0;

  try {
    const body = await req.json();
    const { previous_draft_text, instruksi_revisi, calculated_numbers, kanal } = body;

    if (!previous_draft_text || !instruksi_revisi) {
      return NextResponse.json(
        { error: 'Draf sebelumnya dan instruksi revisi wajib diisi' },
        { status: 400 }
      );
    }

    // 1 Panggilan kilat saja: thinkingLevel MINIMAL, maxOutputTokens 800
    const tModel0 = Date.now();
    const result = await executeFastRevision({
      previousDraftText: previous_draft_text,
      instruksiRevisi: instruksi_revisi,
      calculatedNumbers: calculated_numbers || [],
      kanal: kanal || 'whatsapp',
    });
    const durasiModel = Date.now() - tModel0;
    const durasiTotal = Date.now() - tTotalStart;

    // Server-Timing Header
    const serverTiming = [
      `auth;dur=${durasiAuth}`,
      `model_ttft;dur=${result.draf.ms_ttft || 0}`,
      `model_total;dur=${durasiModel}`,
      `total;dur=${durasiTotal}`,
    ].join(', ');

    const response = NextResponse.json(
      {
        success: true,
        draf: result.draf,
        durasi_ms: durasiTotal,
        model_used: result.modelUsed,
      },
      {
        headers: {
          'Server-Timing': serverTiming,
        },
      }
    );

    // Non-blocking log persistence
    after(async () => {
      try {
        await logAICall({
          model: result.modelUsed,
          endpoint: 'fastRevision',
          langkah: 'revisi',
          durasi_ms: durasiTotal,
          ms_ttft: result.draf.ms_ttft,
          status: 'success',
          metadata: {
            instruksi: instruksi_revisi,
            durasi_auth_ms: durasiAuth,
            durasi_model_ms: durasiModel,
          },
        });
      } catch (logErr) {
        console.warn('Background log error:', logErr);
      }
    });

    return response;
  } catch (err: unknown) {
    const rawMsg = err instanceof Error ? err.message : String(err);
    let userFriendlyMsg = rawMsg;
    if (rawMsg.includes('{') || rawMsg.includes('JSON')) {
      userFriendlyMsg = 'Gagal merevisi draf. Coba klik tombol revisi lagi.';
    }
    return NextResponse.json({ error: userFriendlyMsg }, { status: 500 });
  }
}
