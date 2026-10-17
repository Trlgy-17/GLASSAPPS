import { unstable_cache } from 'next/cache';
import { createAdminClient } from '@/lib/supabase/server';
import { CompanySettings, DEFAULT_SETTINGS } from '@/types/settings';

async function fetchCompanySettingsFromDb(): Promise<CompanySettings> {
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from('settings')
      .select('*')
      .eq('id', 'general')
      .single();

    if (error || !data) {
      return DEFAULT_SETTINGS;
    }

    return {
      id: data.id,
      alamat_workshop: data.alamat_workshop || DEFAULT_SETTINGS.alamat_workshop,
      maps_url: data.maps_url || DEFAULT_SETTINGS.maps_url,
      bank: data.bank || DEFAULT_SETTINGS.bank,
      no_rekening: data.no_rekening || DEFAULT_SETTINGS.no_rekening,
      nama_rekening: data.nama_rekening || DEFAULT_SETTINGS.nama_rekening,
      whatsapp: data.whatsapp || DEFAULT_SETTINGS.whatsapp,
      instagram: data.instagram || DEFAULT_SETTINGS.instagram,
      tiktok: data.tiktok || DEFAULT_SETTINGS.tiktok,
      updated_at: data.updated_at,
      updated_by: data.updated_by,
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export const getCompanySettings = unstable_cache(
  fetchCompanySettingsFromDb,
  ['company_settings_cache'],
  { tags: ['company_settings'], revalidate: 3600 }
);
