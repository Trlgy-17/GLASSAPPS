import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { getClaudeInactiveState } from '@/lib/ai/anthropic-provider';
import { getGeminiDailyQuotaExhaustedUntil, parseDraftChain } from '@/lib/ai/fallback-chain';

export async function GET(req: NextRequest) {
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

  const { data: userData } = await adminClient
    .from('users')
    .select('peran')
    .eq('id', user.id)
    .single();

  if (userData?.peran !== 'admin') {
    return NextResponse.json(
      { error: 'Hanya admin yang boleh mengakses ringkasan pemakaian AI' },
      { status: 403 }
    );
  }

  try {
    // Hitung awal hari ini di zona waktu Asia/Jakarta (WIB, UTC+7)
    const now = new Date();
    const wibFormatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Jakarta',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour12: false,
    });
    const dateStr = wibFormatter.format(now); // YYYY-MM-DD
    const todayStartWib = new Date(`${dateStr}T00:00:00.000+07:00`).toISOString();

    const { data: logs, error } = await adminClient
      .from('ai_log')
      .select('id, provider, model, token_in, token_out, biaya_perkiraan, status, endpoint, created_at')
      .gte('created_at', todayStartWib);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const rows = logs || [];

    let geminiCount = 0;
    let geminiCost = 0;
    let geminiTokensIn = 0;
    let geminiTokensOut = 0;

    let anthropicCount = 0;
    let anthropicCost = 0;
    let anthropicTokensIn = 0;
    let anthropicTokensOut = 0;

    for (const row of rows) {
      const prov = (row.provider || '').toLowerCase();
      const isAnthropic = prov === 'anthropic' || (row.model || '').toLowerCase().includes('claude');
      const cost = Number(row.biaya_perkiraan || 0);
      const inTok = Number(row.token_in || 0);
      const outTok = Number(row.token_out || 0);

      if (isAnthropic) {
        anthropicCount++;
        anthropicCost += cost;
        anthropicTokensIn += inTok;
        anthropicTokensOut += outTok;
      } else {
        geminiCount++;
        geminiCost += cost;
        geminiTokensIn += inTok;
        geminiTokensOut += outTok;
      }
    }

    const totalCount = geminiCount + anthropicCount;
    const totalCost = Math.round((geminiCost + anthropicCost) * 100) / 100;

    return NextResponse.json({
      success: true,
      ringkasan_harian: {
        tanggal: dateStr,
        total_draf: totalCount,
        total_biaya_rp: totalCost,
        gemini: {
          draf_count: geminiCount,
          token_in: geminiTokensIn,
          token_out: geminiTokensOut,
          biaya_rp: Math.round(geminiCost * 100) / 100,
          quota_exhausted_until: getGeminiDailyQuotaExhaustedUntil(),
        },
        anthropic: {
          draf_count: anthropicCount,
          token_in: anthropicTokensIn,
          token_out: anthropicTokensOut,
          biaya_rp: Math.round(anthropicCost * 100) / 100,
          status: getClaudeInactiveState(),
        },
        active_chain: parseDraftChain(),
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
