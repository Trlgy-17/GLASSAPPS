export interface CompanySettings {
  id?: string;
  alamat_workshop: string;
  maps_url: string;
  bank: string;
  no_rekening: string;
  nama_rekening: string;
  whatsapp: string;
  instagram: string;
  tiktok: string;
  updated_at?: string;
  updated_by?: string | null;
}

export const DEFAULT_SETTINGS: CompanySettings = {
  id: 'general',
  alamat_workshop: 'Jalan Nasional III, RT.3/RW.4, Citatah, Kec. Cipatat, Kabupaten Bandung Barat, Jawa Barat 40554',
  maps_url: 'https://maps.app.goo.gl/EfXTbzY7PCQ4TPUn6',
  bank: 'BCA',
  no_rekening: '2782484011',
  nama_rekening: 'Septiani Sitrulroaeni',
  whatsapp: '+62 812-3753-3173',
  instagram: 'putraglass.id',
  tiktok: 'putraglass_',
};
