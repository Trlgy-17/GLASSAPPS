/**
 * Jalur DNS cadangan ke Supabase, KHUSUS komputer lokal.
 *
 * Sebagian ISP rumahan mengacaukan DNS *.supabase.co, sehingga server lokal
 * (npm run dev, tes, skrip) gagal menghubungi Supabase. Patch ini memaksa
 * host Supabase ke satu alamat IP tetap.
 *
 * Di server produksi (next build / next start, NODE_ENV=production) patch ini
 * TIDAK aktif: VPS memakai DNS normal, dan IP tetap bisa berubah atau tidak
 * terjangkau (misalnya VPS tanpa IPv6), yang akan membuat aplikasi gagal total.
 *
 * Pengaturan lewat .env.local (opsional):
 *   SUPABASE_DNS_PATCH=0      matikan patch walau di lokal
 *   SUPABASE_DNS_PATCH=1      paksa aktif walau NODE_ENV=production (jangan di VPS)
 *   SUPABASE_DNS_PATCH_IP=... ganti alamat IP tujuan (IPv4 atau IPv6)
 */
const dns = require('dns');
const net = require('net');

const SUPABASE_HOST = 'rdjzejhbebwufqjgcgkd.supabase.co';
const DEFAULT_IP = '2606:4700::6812:260a';

function shouldPatch(env) {
  const flag = (env.SUPABASE_DNS_PATCH || '').trim();
  if (flag === '0') return false;
  if (flag === '1') return true;
  return env.NODE_ENV !== 'production';
}

function patchTarget(env) {
  const ip = (env.SUPABASE_DNS_PATCH_IP || '').trim();
  const address = ip && net.isIP(ip) ? ip : DEFAULT_IP;
  return { address, family: net.isIP(address) };
}

if (shouldPatch(process.env) && !dns.lookup.__putraGlassPatched) {
  const origLookup = dns.lookup;
  const target = patchTarget(process.env);

  const patched = function (hostname, options, callback) {
    if (typeof options === 'function') {
      callback = options;
      options = {};
    }
    if (hostname === SUPABASE_HOST) {
      if (options && options.all) {
        return callback(null, [{ address: target.address, family: target.family }]);
      }
      return callback(null, target.address, target.family);
    }
    return origLookup(hostname, options, callback);
  };
  patched.__putraGlassPatched = true;
  dns.lookup = patched;
}

module.exports = { shouldPatch, patchTarget, SUPABASE_HOST, DEFAULT_IP };
