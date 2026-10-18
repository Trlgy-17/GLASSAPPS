/**
 * Peran pengguna aplikasi CS. Hanya dua nilai yang sah.
 * Profil yang hilang atau berisi nilai lain dianggap TIDAK punya akses
 * (fail-closed), bukan otomatis dianggap admin.
 */
export type Peran = 'admin' | 'owner';

export function toPeran(value: unknown): Peran | null {
  return value === 'admin' || value === 'owner' ? value : null;
}

export const PESAN_AKUN_TIDAK_TERDAFTAR =
  'Akun ini belum terdaftar sebagai admin atau owner. Hubungi owner Putra Glass.';
