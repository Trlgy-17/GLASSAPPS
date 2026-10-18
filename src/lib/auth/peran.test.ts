import { describe, it, expect } from 'vitest';
import { toPeran } from './peran';

describe('toPeran (fail-closed)', () => {
  it('menerima admin dan owner', () => {
    expect(toPeran('admin')).toBe('admin');
    expect(toPeran('owner')).toBe('owner');
  });
  it('menolak profil kosong atau nilai asing', () => {
    expect(toPeran(undefined)).toBeNull();
    expect(toPeran(null)).toBeNull();
    expect(toPeran('')).toBeNull();
    expect(toPeran('superadmin')).toBeNull();
    expect(toPeran('Admin')).toBeNull();
  });
});
