import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { getPeriode } from '@/lib/closing-period';
import { toPeran, PESAN_AKUN_TIDAK_TERDAFTAR } from '@/lib/auth/peran';
import {
  buildPenawaranWorkbook,
  PenawaranExportRow,
  STATUS_LABEL,
} from '@/lib/excel/penawaran-export';

export const dynamic = 'force-dynamic';

const MAX_ROWS = 5000;

interface LeadRel {
  nama?: string | null;
  kota?: string | null;
  no_wa?: string | null;
}
interface UserRel {
  nama?: string | null;
}
interface PenawaranDbRow {
  nomor: string;
  status: string;
  kanal: string | null;
  total_nilai: number | null;
  valid_until: string | null;
  created_at: string | null;
  deal_at: string | null;
  alasan_batal: string | null;
  leads?: LeadRel | LeadRel[] | null;
  users?: UserRel | UserRel[] | null;
}

function firstRel<T>(rel: T | T[] | null | undefined): T | undefined {
  if (Array.isArray(rel)) return rel[0];
  return rel ?? undefined;
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
    .select('peran, nama')
    .eq('id', user.id)
    .single();

  const userRole = toPeran(userData?.peran);
  if (!userRole) {
    return NextResponse.json({ error: PESAN_AKUN_TIDAK_TERDAFTAR }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const search = searchParams.get('search')?.trim() || '';
  const status = searchParams.get('status')?.trim() || '';
  const periodeParam = searchParams.get('periode')?.trim();
  const followupOnly = searchParams.get('followup_only') === 'true';
  const includeTest = searchParams.get('include_test') === 'true';

  const currentPeriod = getPeriode();
  let activePeriod = currentPeriod;
  if (periodeParam && periodeParam !== 'all') {
    activePeriod = getPeriode(`${periodeParam}-10`);
  }

  let query = adminClient
    .from('penawaran')
    .select(
      'nomor, status, kanal, total_nilai, valid_until, created_at, deal_at, alasan_batal, leads!inner(nama, kota, no_wa), users:created_by(nama)'
    );

  if (!includeTest) {
    query = query.not('leads.nama', 'ilike', '[TES]%').not('nomor', 'ilike', '%TEST%');
  }

  // Filter soft delete (daftar dihapus hanya untuk owner)
  if (status === 'dihapus') {
    if (userRole !== 'owner') {
      return NextResponse.json(
        { error: 'Hanya owner yang dapat mengekspor daftar penawaran yang dihapus' },
        { status: 403 }
      );
    }
    query = query.not('deleted_at', 'is', null);
  } else {
    query = query.is('deleted_at', null);
  }

  if (status && status !== 'all' && status !== 'dihapus') {
    query = query.eq('status', status);
  }

  if (followupOnly) {
    const twoDaysAgo = new Date(Date.now() - 2 * 86400000).toISOString();
    query = query.eq('status', 'terkirim').lte('updated_at', twoDaysAgo);
  }

  if (periodeParam !== 'all') {
    query = query
      .gte('created_at', activePeriod.startDateIso)
      .lte('created_at', activePeriod.endDateIso);
  }

  if (search) {
    query = query.ilike('nomor', `%${search}%`);
  }

  const { data, error } = await query
    .order('created_at', { ascending: false })
    .limit(MAX_ROWS);

  if (error) {
    console.error('[api/penawaran/export]', error.message);
    return NextResponse.json(
      { error: 'Terjadi kesalahan di server. Coba lagi sebentar lagi.' },
      { status: 500 }
    );
  }

  const rows: PenawaranExportRow[] = ((data || []) as PenawaranDbRow[]).map((d) => {
    const lead = firstRel(d.leads);
    const pembuat = firstRel(d.users);
    return {
      nomor: d.nomor,
      tanggal: d.created_at,
      status: d.status,
      kanal: d.kanal,
      namaKlien: lead?.nama ?? '',
      kota: lead?.kota ?? '',
      noWa: lead?.no_wa ?? '',
      adminPembuat: pembuat?.nama ?? '',
      totalNilai: d.total_nilai || 0,
      berlakuSampai: d.valid_until,
      tglDeal: d.deal_at,
      alasanBatal: d.alasan_batal,
    };
  });

  const periodeNama = periodeParam === 'all' ? 'Semua periode' : activePeriod.nama;
  const statusLabel = status && status !== 'all' ? STATUS_LABEL[status] || status : undefined;

  const buffer = await buildPenawaranWorkbook(rows, {
    perusahaan: 'Putra Glass',
    periodeNama,
    dieksporOleh: userData?.nama || user.email || 'Staf Putra Glass',
    statusFilter: statusLabel,
  });

  const stamp = new Date()
    .toLocaleString('sv-SE', { timeZone: 'Asia/Jakarta' })
    .replace(/[: ]/g, '-')
    .slice(0, 16);
  const periodeSlug = periodeParam === 'all' ? 'semua' : activePeriod.key;
  const filename = `Penawaran-PutraGlass-${periodeSlug}-${stamp}.xlsx`;

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  });
}
