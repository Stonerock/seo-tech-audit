const express = require('express');
const fetch = require('node-fetch');
let puppeteer = null;
try {
  puppeteer = require('puppeteer-core');
} catch (_) {}

const router = express.Router();

function makeWsEndpoint(base, token) {
  const u = new URL(base);
  if (u.protocol.startsWith('http')) u.protocol = 'wss:';
  const tokenParams = [...u.searchParams.keys()].filter(k => k === 'token');
  if (token && tokenParams.length === 0) u.searchParams.set('token', token);
  if (tokenParams.length > 1) throw new Error('duplicate token param');
  return u.toString();
}

router.get('/browserless', async (req, res) => {
  const base = process.env.BROWSERLESS_WS || 'wss://chrome.browserless.io';
  const token = process.env.BROWSERLESS_TOKEN || '';
  const endpoint = makeWsEndpoint(base, token);

  const meta = {
    node: process.version,
    arch: process.arch,
    endpoint: endpoint.replace(token, '***'),
    hasToken: Boolean(token),
  };

  if (!puppeteer) {
    return res.status(500).json({ ok: false, error: 'puppeteer-core-not-installed', meta });
  }

  try {
    const browser = await puppeteer.connect({ browserWSEndpoint: endpoint, timeout: 45000 });
    const page = await browser.newPage();
    page.setDefaultNavigationTimeout(45000);
    await page.goto('https://example.com', { waitUntil: 'domcontentloaded' });
    const title = await page.title();
    await browser.close();
    return res.json({ ok: true, title, meta });
  } catch (err) {
    const details = {
      name: err?.name,
      message: String(err?.message || err),
      stack: err?.stack?.split('\n').slice(0, 6),
      code: err?.code,
      meta,
    };
    return res.status(502).json({ ok: false, error: 'puppeteer-connect-failed', details });
  }
});

router.get('/http', async (req, res) => {
  const target = 'https://production-sfo.browserless.io';
  const start = Date.now();
  try {
    const r = await fetch(target, { method: 'HEAD', timeout: 5000 });
    return res.json({ ok: true, status: r.status, ms: Date.now() - start });
  } catch (err) {
    return res.status(502).json({ ok: false, error: String(err?.message || err), ms: Date.now() - start });
  }
});

// HTTP connectivity probe
router.get('/probe/http', async (req, res) => {
  const https = require('https');
  const start = Date.now();
  
  const options = {
    hostname: 'chrome.browserless.io',
    port: 443,
    path: '/',
    method: 'HEAD',
    timeout: 10000
  };

  const request = https.request(options, (response) => {
    const latency = Date.now() - start;
    res.json({
      ok: true,
      status: response.statusCode,
      headers: response.headers,
      latency: `${latency}ms`
    });
  });

  request.on('error', (err) => {
    const latency = Date.now() - start;
    res.status(502).json({
      ok: false,
      error: err.message,
      code: err.code,
      latency: `${latency}ms`
    });
  });

  request.on('timeout', () => {
    request.destroy();
    const latency = Date.now() - start;
    res.status(502).json({
      ok: false,
      error: 'timeout',
      latency: `${latency}ms`
    });
  });

  request.end();
});

module.exports = router;