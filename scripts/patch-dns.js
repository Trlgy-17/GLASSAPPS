const dns = require('dns');
const origLookup = dns.lookup;

dns.lookup = function (hostname, options, callback) {
  if (typeof options === 'function') {
    callback = options;
    options = {};
  }
  if (hostname === 'rdjzejhbebwufqjgcgkd.supabase.co') {
    if (options && options.all) {
      return callback(null, [{ address: '2606:4700::6812:260a', family: 6 }]);
    }
    return callback(null, '2606:4700::6812:260a', 6);
  }
  return origLookup(hostname, options, callback);
};
