import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { getDailyQuotaStatus, parseDraftChain } from '@/lib/ai/fallback-chain';

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

    let totalCount = 0;
    let totalCost = 0;
    let totalTokensIn = 0;
    let totalTokensOut = 0;

    const perModelStats: Record<string, { count: number; cost: number; token_in: number; token_out: number }> = {};

    for (const row of rows) {
      const model = row.model || 'gemini-3.6-flash';
      const cost = Number(row.biaya_perkiraan || 0);
      const inTok = Number(row.token_in || 0);
      const outTok = Number(row.token_out || 0);

      totalCount++;
      totalCost += cost;
      totalTokensIn += inTok;
      totalTokensOut += outTok;

      if (!perModelStats[model]) {
        perModelStats[model] = { count: 0, cost: 0, token_in: 0, token_out: 0 };
      }
      perModelStats[model].count++;
      perModelStats[model].cost += cost;
      perModelStats[model].token_in += inTok;
      perModelStats[model].token_out += outTok;
    }

    return NextResponse.json({
      success: true,
      ringkasan_harian: {
        tanggal: dateStr,
        total_draf: totalCount,
        total_biaya_rp: Math.round(totalCost * 100) / 100,
        token_in: totalTokensIn,
        token_out: totalTokensOut,
        per_model: perModelStats,
        quota_status: getDailyQuotaStatus(),
        active_chain: parseDraftChain(),
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
