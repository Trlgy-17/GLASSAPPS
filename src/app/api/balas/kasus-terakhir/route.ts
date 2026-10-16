import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';

function formatRelativeDaysAgo(createdAtStr: string): string {
  const createdMs = new Date(createdAtStr).getTime();
  const diffDays = Math.floor((Date.now() - createdMs) / 86400000);
  if (diffDays <= 0) return 'hari ini';
  if (diffDays === 1) return '1 hari lalu';
  return `${diffDays} hari lalu`;
}

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
      { error: 'Hanya admin yang boleh mengakses riwayat kasus balas chat' },
      { status: 403 }
    );
  }

  const { searchParams } = new URL(req.url);
  const queryText = searchParams.get('q')?.trim().toLowerCase() || '';
  const includeTest = searchParams.get('include_test') === 'true';

  try {
    // Ambil penawaran 30 hari terakhir (atau jika pencarian manual, ambil sampai 50 terbaru lalu saring)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString();

    let dbQuery = adminClient
      .from('penawaran')
      .select(
        'id, nomor, total_nilai, created_at, status, kanal, items_json, ringkasan_json, leads!inner(id, nama, kota, zona, segmen)'
      )
      .gte('created_at', thirtyDaysAgo)
      .order('created_at', { ascending: false })
      .limit(50);

    if (!includeTest) {
      dbQuery = dbQuery.not('leads.nama', 'ilike', '[TES]%').not('nomor', 'ilike', '%TEST%');
    }

    const { data: quotes, error } = await dbQuery;
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const rawRows = (quotes || []) as Array<Record<string, unknown>>;

    // Filter sesuai kata kunci pencarian (nama klien / nomor PG-Q / kota)
    const filteredRows = rawRows.filter((q) => {
      const ringkasan = (q.ringkasan_json || {}) as Record<string, unknown>;
      if (!includeTest && ringkasan.is_test === true) return false;

      if (!queryText) return true;
      const leads = (q.leads || {}) as Record<string, unknown>;
      const nomor = String(q.nomor || '').toLowerCase();
      const nama = String(leads.nama || '').toLowerCase();
      const kota = String(leads.kota || ringkasan.kota_klien || '').toLowerCase();

      return (
        nomor.includes(queryText) ||
        nama.includes(queryText) ||
        kota.includes(queryText)
      );
    });

    // Deduplikasi berdasarkan klien (lead_id atau nama klien lowercase):
    // Satu klien yang punya beberapa penawaran -> tampil penawaran TERBARU saja, dengan info "(+N penawaran lain)"
    const clientQuoteCounts = new Map<string, number>();
    const deduplicatedRows: Array<Record<string, unknown>> = [];

    for (const q of filteredRows) {
      const leads = (q.leads || {}) as Record<string, unknown>;
      const cleanName = String(leads.nama || 'Klien')
        .replace(/^\[TES\]\s*/i, '')
        .trim()
        .toLowerCase();
      const clientKey = cleanName || String(leads.id || q.id);

      const prevCount = clientQuoteCounts.get(clientKey) || 0;
      clientQuoteCounts.set(clientKey, prevCount + 1);

      if (prevCount === 0) {
        deduplicatedRows.push({ ...q, _clientKey: clientKey });
      }
    }

    const formatted = deduplicatedRows.slice(0, 5).map((q) => {
      const leads = (q.leads || {}) as Record<string, unknown>;
      const ringkasan = (q.ringkasan_json || {}) as Record<string, unknown>;
      const items = Array.isArray(q.items_json)
        ? (q.items_json as Array<Record<string, unknown>>)
        : [];
      const totalCountForClient = clientQuoteCounts.get(q._clientKey as string) || 1;
      const otherQuotesCount = Math.max(0, totalCountForClient - 1);

      return {
        id: q.id as string,
        nomor: q.nomor as string,
        nama_klien: (leads.nama as string) || 'Klien',
        kota: (leads.kota as string) || (ringkasan.kota_klien as string) || '',
        zona: (leads.zona as string) || 'luar_kota',
        segmen: (leads.segmen as string) || 'B2C',
        total_nilai: Number(q.total_nilai || ringkasan.total || 0),
        dp_50: Number(ringkasan.dp_50 || Math.ceil(Number(q.total_nilai || 0) / 2000) * 1000),
        pelunasan: Number(
          ringkasan.pelunasan ||
            Number(q.total_nilai || 0) - Math.ceil(Number(q.total_nilai || 0) / 2000) * 1000
        ),
        tanggal: new Date(q.created_at as string).toLocaleDateString('id-ID', {
          day: 'numeric',
          month: 'short',
        }),
        waktu_lalu: formatRelativeDaysAgo(q.created_at as string),
        other_quotes_count: otherQuotesCount,
        status: q.status as string,
        spesifikasi: items[0] || null,
      };
    });

    return NextResponse.json({ success: true, kasus_terakhir: formatted });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
