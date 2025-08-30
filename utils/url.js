const { URL } = require('url');

function normalizeUrl(input) {
  try {
    const url = new URL(input);
    // Lowercase host
    url.host = url.host.toLowerCase();
    // Remove default ports
    if ((url.protocol === 'http:' && url.port === '80') || (url.protocol === 'https:' && url.port === '443')) {
      url.port = '';
    }
    // Remove tracking params
    const params = url.searchParams;
    const toDelete = [];
    params.forEach((_, key) => {
      const k = key.toLowerCase();
      if (k.startsWith('utm_') || k === 'gclid' || k === 'fbclid' || k === 'ref') {
        toDelete.push(key);
      }
    });
    toDelete.forEach(k => params.delete(k));
    url.search = params.toString();
    // Remove trailing slash for path except root
    if (url.pathname !== '/' && url.pathname.endsWith('/')) {
      url.pathname = url.pathname.slice(0, -1);
    }
    return url.toString();
  } catch (e) {
    return input;
  }
}

module.exports = { normalizeUrl };


