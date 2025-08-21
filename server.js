// server.js - SEO Audit Backend Server
// Tallenna tämä tiedosto nimellä: server.js

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const puppeteer = require('puppeteer');
const cheerio = require('cheerio');
const fetch = require('node-fetch');
const xml2js = require('xml2js');
const path = require('path');
const axeCore = require('axe-core');
const lighthouse = require('lighthouse');
const chromeLauncher = require('chrome-launcher');
const rateLimit = require('express-rate-limit');

const app = express();
const PORT = process.env.PORT ? Number(process.env.PORT) : 3001;

app.use(cors());
app.use(express.json());

// Serve static frontend (index.html, etc.) from project root
app.use(express.static(__dirname));
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Cache välttääksemme turhia pyyntöjä
const cache = new Map();

// Helper: Fetch with timeout
async function fetchWithTimeout(url, timeout = 5000) {
  // Support Node 16 where global AbortController may be missing
  let AbortControllerImpl = global.AbortController;
  try {
    if (!AbortControllerImpl) {
      AbortControllerImpl = require('abort-controller');
    }
  } catch (_) {
    AbortControllerImpl = null;
  }

  const controller = AbortControllerImpl ? new AbortControllerImpl() : null;
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  
  try {
    const response = await fetch(url, { 
      signal: controller ? controller.signal : undefined,
      headers: {
        'User-Agent': 'SEO-Audit-Tool/1.0'
      }
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

// Helper: Inspect response headers for CDN/cache hints
async function getHeadersInfo(url) {
  try {
    const response = await fetchWithTimeout(url, 8000);
    const headers = response.headers;
    const headerObj = {};
    headers.forEach((value, key) => { headerObj[key.toLowerCase()] = value; });

    function detectCdn(h) {
      const headerString = JSON.stringify(h).toLowerCase();
      if (h['cf-ray'] || h['cf-cache-status'] || headerString.includes('cloudflare')) return 'Cloudflare';
      if (h['x-amz-cf-pop'] || h['x-cache']?.includes('cloudfront')) return 'AWS CloudFront';
      if (h['x-vercel-id']) return 'Vercel';
      if (h['x-fastly-request-id'] || headerString.includes('fastly')) return 'Fastly';
      if (h['akamai-grn'] || headerString.includes('akamai')) return 'Akamai';
      if (h['server']?.toLowerCase().includes('varnish')) return 'Varnish (possible Fastly)';
      return null;
    }

    const cdn = detectCdn(headerObj);
    const cacheStatus = headerObj['x-cache'] || headerObj['cf-cache-status'] || headerObj['x-cache-status'] || null;
    return {
      status: response.status,
      cdn,
      cacheStatus,
      server: headerObj['server'] || null,
      via: headerObj['via'] || null,
      headers: headerObj
    };
  } catch (error) {
    return { error: error.message };
  }
}

// Optional: Google PageSpeed Insights API
async function runPageSpeedInsights(url) {
  const apiKey = process.env.PSI_API_KEY;
  if (!apiKey) return null;
  try {
    const endpoint = `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(url)}&key=${apiKey}&strategy=mobile`;
    const r = await fetchWithTimeout(endpoint, 30000);
    if (!r.ok) throw new Error(`PSI HTTP ${r.status}`);
    const data = await r.json();
    const lighthouse = data.lighthouseResult || {};
    return {
      score: lighthouse.categories ? lighthouse.categories.performance?.score : null,
      lcp: lighthouse.audits?.['largest-contentful-paint']?.numericValue || null,
      fcp: lighthouse.audits?.['first-contentful-paint']?.numericValue || null,
      tbt: lighthouse.audits?.['total-blocking-time']?.numericValue || null,
      cls: lighthouse.audits?.['cumulative-layout-shift']?.numericValue || null,
      link: `https://pagespeed.web.dev/report?url=${encodeURIComponent(url)}`
    };
  } catch (error) {
    return { error: error.message };
  }
}

// Optional: WebPageTest trigger (returns URLs to view results)
async function runWebPageTest(url) {
  const apiKey = process.env.WPT_API_KEY;
  if (!apiKey) return null;
  const location = process.env.WPT_LOCATION || 'eu-west-1';
  try {
    const endpoint = `https://www.webpagetest.org/runtest.php?url=${encodeURIComponent(url)}&k=${apiKey}&location=${encodeURIComponent(location)}&f=json`;
    const r = await fetchWithTimeout(endpoint, 15000);
    if (!r.ok) throw new Error(`WPT HTTP ${r.status}`);
    const data = await r.json();
    const testId = data?.data?.testId || null;
    const userUrl = data?.data?.userUrl || null;
    const jsonUrl = data?.data?.jsonUrl || null;
    return { testId, userUrl, jsonUrl };
  } catch (error) {
    return { error: error.message };
  }
}

// Poll WebPageTest result JSON and extract key metrics (if jsonUrl provided)
async function pollWebPageTest(jsonUrl) {
  if (!jsonUrl) return null;
  try {
    for (let i = 0; i < 10; i++) {
      const r = await fetchWithTimeout(jsonUrl, 10000);
      if (!r.ok) throw new Error(`WPT poll HTTP ${r.status}`);
      const data = await r.json();
      const status = data?.statusText || '';
      if (/complete|finished/i.test(status)) {
        const run = data?.data?.runs?.[1]?.firstView || data?.data?.median?.firstView || null;
        if (!run) return { status };
        return {
          status,
          ttfb: run.TTFB || null,
          fcp: run.firstContentfulPaint || run['firstContentfulPaint'] || null,
          lcp: run['chromeUserTiming.LargestContentfulPaint'] || null,
          loadTime: run.loadTime || null,
          location: data?.data?.location || null,
          summary: data?.data?.summary || null
        };
      }
      await new Promise(r => setTimeout(r, 3000));
    }
    return { status: 'timeout' };
  } catch (e) {
    return { error: e.message };
  }
}

// Pääreitti: Analysoi sivusto
const auditLimiter = rateLimit({ windowMs: 60 * 1000, max: 10 });

app.post('/api/audit', auditLimiter, async (req, res) => {
  const { url, lighthouse: lhFlag } = req.body || {};
  
  if (!url) {
    return res.status(400).json({ error: 'URL vaaditaan' });
  }
  // Basic URL validation
  try {
    const u = new URL(url);
    if (!['http:', 'https:'].includes(u.protocol)) {
      return res.status(400).json({ error: 'Virheellinen URL-protokolla' });
    }
  } catch (_) {
    return res.status(400).json({ error: 'Virheellinen URL' });
  }
  
  // Tarkista cache
  if (cache.has(url)) {
    const cached = cache.get(url);
    if (Date.now() - cached.timestamp < 300000) { // 5 min cache
      console.log(`📦 Returning cached results for ${url}`);
      return res.json(cached.data);
    }
  }
  
  console.log(`🔍 Starting audit for ${url}`);
  
  let browser;
  try {
    const results = {
      url,
      timestamp: new Date().toISOString(),
      tests: {}
    };
    
    // 1. Käynnistä Puppeteer
    console.log('🚀 Launching Puppeteer...');
    browser = await puppeteer.launch({ 
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const page = await browser.newPage();
    await page.setUserAgent('SEO-Audit-Tool/1.0 (Compatible)');
    
    // Lataa sivu
    console.log('📄 Loading page...');
    const response = await page.goto(url, { 
      waitUntil: 'networkidle2',
      timeout: 30000 
    });
    
    const html = await page.content();
    const $ = cheerio.load(html);
    
    // 2. Schema.org testit
    console.log('🔍 Testing Schema.org...');
    results.tests.schema = await testSchema($, page);
    try {
      const schemaIssues = validateSchemaRequired(results.tests.schema.schemas || []);
      if (schemaIssues.length) {
        results.tests.schema.requiredIssues = schemaIssues;
      }
    } catch (_) {}
    
    // 3. JSON-LD
    console.log('🔍 Testing JSON-LD...');
    results.tests.jsonld = await testJsonLD($);
    
    // 4. Metadata
    console.log('🔍 Testing Metadata...');
    results.tests.metadata = await testMetadata($);
    
    // 5. Performance metrics (Puppeteer)
    console.log('⚡ Testing Performance...');
    results.tests.performance = await testPerformance(page);
    
    // 6. Accessibility (axe-core + heuristics)
    console.log('♿ Testing Accessibility...');
    results.tests.accessibility = await testAccessibility(page);
    
    // 7. SEO basics
    console.log('🎯 Testing SEO Basics...');
    results.tests.seo = await testSEOBasics($, url);
    
    // 8. External files
    console.log('📁 Testing External Files...');
    results.tests.files = await testExternalFiles(url);

    // 9. Headers & CDN heuristics
    console.log('🌐 Inspecting headers...');
    results.tests.headers = await getHeadersInfo(url);

    // 10. External performance hooks (optional)
    console.log('🧪 External performance hooks...');
    const [psi, wpt] = await Promise.all([
      runPageSpeedInsights(url),
      runWebPageTest(url)
    ]);
    results.tests.external = {};
    if (psi) results.tests.external.psi = psi;
    if (wpt) {
      results.tests.external.wpt = wpt;
      if (wpt.jsonUrl) {
        console.log('⏳ Polling WPT results...');
        results.tests.external.wptMetrics = await pollWebPageTest(wpt.jsonUrl);
      }
    }

    // 11. AI Readiness (robots/llms/X-Robots-Tag)
    console.log('🤖 Testing AI Readiness...');
    results.tests.ai = await testAIReadiness(url, results.tests.headers, $);

    // 12. Optional Lighthouse (env LIGHTHOUSE=1 or request flag)
    const shouldRunLH = (process.env.LIGHTHOUSE === '1') || Boolean(lhFlag);
    if (shouldRunLH) {
      console.log('💡 Running Lighthouse (optional)...');
      results.tests.lighthouse = await runLighthouse(url);
    }
    
    await browser.close();
    console.log('✅ Audit complete!');
    
    // Tallenna cacheen
    cache.set(url, {
      timestamp: Date.now(),
      data: results
    });
    
    res.json(results);
    
  } catch (error) {
    console.error('❌ Audit error:', error);
    if (browser) await browser.close();
    res.status(500).json({ 
      error: 'Auditointi epäonnistui', 
      details: error.message 
    });
  }
});

// Test: Schema.org
async function testSchema($, page) {
  const schemas = [];
  
  // Etsi JSON-LD schemat
  $('script[type="application/ld+json"]').each((i, elem) => {
    try {
      const raw = $(elem).html();
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        parsed.forEach(item => schemas.push(item));
      } else if (parsed && Array.isArray(parsed['@graph'])) {
        parsed['@graph'].forEach(item => schemas.push(item));
      } else {
        schemas.push(parsed);
      }
    } catch (e) {
      console.error('Invalid JSON-LD:', e);
    }
  });
  
  // Etsi mikrodata
  const hasItemscope = $('[itemscope]').length > 0;
  
  // Etsi RDFa
  const hasRDFa = $('[typeof]').length > 0;
  
  return {
    found: schemas.length > 0 || hasItemscope || hasRDFa,
    jsonLdCount: schemas.length,
    types: schemas
      .flatMap(s => {
        const t = s && s['@type'];
        if (!t) return [];
        return Array.isArray(t) ? t : [t];
      })
      .filter(Boolean),
    hasMicrodata: hasItemscope,
    hasRDFa: hasRDFa,
    schemas: schemas.slice(0, 5) // Limit for response size
  };
}

// Validate required fields for common types
function validateSchemaRequired(schemas) {
  const issues = [];
  const asArray = Array.isArray(schemas) ? schemas : [schemas];
  const flatten = asArray.flatMap(s => Array.isArray(s['@graph']) ? s['@graph'] : [s]);
  for (const s of flatten) {
    const type = Array.isArray(s['@type']) ? s['@type'][0] : s['@type'];
    if (!type) continue;
    if (type === 'WebPage') {
      if (!s.name && !s.headline) issues.push('WebPage: name/headline puuttuu');
      if (!s.url) issues.push('WebPage: url puuttuu');
    }
    if (type === 'Article' || type === 'NewsArticle' || type === 'BlogPosting') {
      if (!s.headline) issues.push('Article: headline puuttuu');
      if (!s.datePublished) issues.push('Article: datePublished puuttuu');
      if (!s.author) issues.push('Article: author puuttuu');
    }
    if (type === 'FAQPage') {
      const hasQuestions = Array.isArray(s.mainEntity) && s.mainEntity.every(q => q['@type'] === 'Question' && q.acceptedAnswer);
      if (!hasQuestions) issues.push('FAQPage: mainEntity/Question/acceptedAnswer puuttuu');
    }
  }
  return issues;
}

// Test: JSON-LD
async function testJsonLD($) {
  const jsonldScripts = $('script[type="application/ld+json"]');
  const results = [];

  const normalize = (item) => ({
    valid: true,
    type: Array.isArray(item && item['@type']) ? item['@type'].join(',') : (item && item['@type']) || 'Unknown',
    context: (item && item['@context']) || null
  });

  jsonldScripts.each((i, elem) => {
    try {
      const content = $(elem).html();
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed)) {
        parsed.forEach(p => results.push(normalize(p)));
      } else if (parsed && Array.isArray(parsed['@graph'])) {
        parsed['@graph'].forEach(p => results.push(normalize(p)));
      } else {
        results.push(normalize(parsed));
      }
    } catch (error) {
      results.push({ valid: false, error: error.message });
    }
  });

  return {
    found: results.length > 0,
    count: results.length,
    items: results
  };
}

// Test: Metadata
async function testMetadata($) {
  const meta = {
    title: $('title').text() || null,
    description: $('meta[name="description"]').attr('content') || null,
    keywords: $('meta[name="keywords"]').attr('content') || null,
    
    // Open Graph
    og: {
      title: $('meta[property="og:title"]').attr('content') || null,
      description: $('meta[property="og:description"]').attr('content') || null,
      image: $('meta[property="og:image"]').attr('content') || null,
      url: $('meta[property="og:url"]').attr('content') || null,
      type: $('meta[property="og:type"]').attr('content') || null
    },
    
    // Twitter Cards
    twitter: {
      card: $('meta[name="twitter:card"]').attr('content') || null,
      title: $('meta[name="twitter:title"]').attr('content') || null,
      description: $('meta[name="twitter:description"]').attr('content') || null,
      image: $('meta[name="twitter:image"]').attr('content') || null
    },
    
    // Other important meta
    viewport: $('meta[name="viewport"]').attr('content') || null,
    robots: $('meta[name="robots"]').attr('content') || null,
    canonical: $('link[rel="canonical"]').attr('href') || null,
    favicon: $('link[rel="icon"], link[rel="shortcut icon"]').attr('href') || null
  };
  
  // Validation
  const issues = [];
  if (!meta.title) issues.push('Title puuttuu');
  if (meta.title && meta.title.length > 60) issues.push('Title liian pitkä (>60 merkkiä)');
  if (!meta.description) issues.push('Meta description puuttuu');
  if (meta.description && meta.description.length > 160) issues.push('Description liian pitkä (>160 merkkiä)');
  if (!meta.viewport) issues.push('Viewport meta puuttuu (mobiilioptimointia varten)');
  
  return {
    ...meta,
    issues
  };
}

// Test: Performance
async function testPerformance(page) {
  const metrics = await page.evaluate(() => {
    const nav = performance.getEntriesByType('navigation')[0];
    const timing = performance.timing;
    const paintEntries = performance.getEntriesByType('paint');

    const domContentLoaded = nav ? nav.domContentLoadedEventEnd : (timing.domContentLoadedEventEnd - timing.navigationStart);
    const loadComplete = nav ? nav.loadEventEnd : (timing.loadEventEnd - timing.navigationStart);

    return {
      domContentLoaded,
      loadComplete,
      firstPaint: paintEntries.find(e => e.name === 'first-paint')?.startTime || null,
      firstContentfulPaint: paintEntries.find(e => e.name === 'first-contentful-paint')?.startTime || null,
      resources: performance.getEntriesByType('resource').length,
      memory: performance.memory ? {
        usedJSHeapSize: Math.round(performance.memory.usedJSHeapSize / 1048576),
        totalJSHeapSize: Math.round(performance.memory.totalJSHeapSize / 1048576)
      } : null
    };
  });
  
  // Lighthouse simulation (simplified)
  const score = {
    fcp: metrics.firstContentfulPaint < 1800 ? 'good' : metrics.firstContentfulPaint < 3000 ? 'needs-improvement' : 'poor',
    loadTime: metrics.loadComplete < 3000 ? 'good' : metrics.loadComplete < 5000 ? 'needs-improvement' : 'poor'
  };
  
  return {
    metrics,
    score
  };
}

// Test: Accessibility (axe-core + heuristics)
async function testAccessibility(page) {
  try {
    await page.addScriptTag({ content: axeCore.source });
    const axeReport = await page.evaluate(async () => {
      return await window.axe.run({
        runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa'] }
      });
    });

    const heuristics = await page.evaluate(() => {
      const images = document.querySelectorAll('img');
      const headings = document.querySelectorAll('h1, h2, h3, h4, h5, h6');
      const links = document.querySelectorAll('a');
      const forms = document.querySelectorAll('form');
      const imagesWithoutAlt = Array.from(images).filter(img => !img.alt);
      const emptyLinks = Array.from(links).filter(link => !link.textContent.trim() && !link.querySelector('img[alt]'));
      const inputs = document.querySelectorAll('input, select, textarea');
      const inputsWithoutLabels = Array.from(inputs).filter(input => {
        if (input.closest('label')) return false;
        if (input.hasAttribute('aria-label') || input.getAttribute('aria-labelledby')) return false;
        const id = input.id;
        if (id && document.querySelector(`label[for="${id}"]`)) return false;
        return true;
      });
      const headingLevels = Array.from(headings).map(h => parseInt(h.tagName[1]));
      let headingIssues = false;
      for (let i = 1; i < headingLevels.length; i++) {
        if (headingLevels[i] - headingLevels[i-1] > 1) { headingIssues = true; break; }
      }
      return {
        images: { total: images.length, withoutAlt: imagesWithoutAlt.length, percentage: images.length ? Math.round((imagesWithoutAlt.length / images.length) * 100) : 0 },
        links: { total: links.length, empty: emptyLinks.length },
        forms: { total: forms.length, inputsWithoutLabels: inputsWithoutLabels.length },
        headings: { total: headings.length, h1Count: document.querySelectorAll('h1').length, structureIssues: headingIssues },
        lang: document.documentElement.lang || null
      };
    });

    const issues = [];
    if (heuristics.images.withoutAlt > 0) issues.push(`${heuristics.images.withoutAlt} kuvaa ilman alt-tekstiä`);
    if (heuristics.links.empty > 0) issues.push(`${heuristics.links.empty} tyhjää linkkiä`);
    if (heuristics.forms.inputsWithoutLabels > 0) issues.push(`${heuristics.forms.inputsWithoutLabels} lomakekenttää ilman labeliä`);
    if (heuristics.headings.h1Count === 0) issues.push('H1-otsikko puuttuu');
    if (heuristics.headings.h1Count > 1) issues.push('Useita H1-otsikoita');
    if (heuristics.headings.structureIssues) issues.push('Otsikkohierarkiassa hyppyjä');
    if (!heuristics.lang) issues.push('Lang-attribuutti puuttuu');

    return {
      axe: {
        violations: (axeReport.violations || []).map(v => ({ id: v.id, impact: v.impact, help: v.help, nodes: v.nodes.length })),
        passes: (axeReport.passes || []).length,
        incomplete: (axeReport.incomplete || []).length
      },
      ...heuristics,
      issues,
      score: ((axeReport.violations || []).length + issues.length) === 0 ? 'good' : (((axeReport.violations || []).length + issues.length) <= 3 ? 'needs-improvement' : 'poor')
    };
  } catch (e) {
    // Fallback to heuristics only
    const results = await page.evaluate(() => {
      const images = document.querySelectorAll('img');
      const headings = document.querySelectorAll('h1, h2, h3, h4, h5, h6');
      const links = document.querySelectorAll('a');
      const forms = document.querySelectorAll('form');
      const imagesWithoutAlt = Array.from(images).filter(img => !img.alt);
      const emptyLinks = Array.from(links).filter(link => !link.textContent.trim() && !link.querySelector('img[alt]'));
      const inputs = document.querySelectorAll('input, select, textarea');
      const inputsWithoutLabels = Array.from(inputs).filter(input => {
        if (input.closest('label')) return false;
        if (input.hasAttribute('aria-label') || input.getAttribute('aria-labelledby')) return false;
        const id = input.id;
        if (id && document.querySelector(`label[for="${id}"]`)) return false;
        return true;
      });
      const headingLevels = Array.from(headings).map(h => parseInt(h.tagName[1]));
      let headingIssues = false;
      for (let i = 1; i < headingLevels.length; i++) {
        if (headingLevels[i] - headingLevels[i-1] > 1) { headingIssues = true; break; }
      }
      return {
        images: { total: images.length, withoutAlt: imagesWithoutAlt.length, percentage: images.length ? Math.round((imagesWithoutAlt.length / images.length) * 100) : 0 },
        links: { total: links.length, empty: emptyLinks.length },
        forms: { total: forms.length, inputsWithoutLabels: inputsWithoutLabels.length },
        headings: { total: headings.length, h1Count: document.querySelectorAll('h1').length, structureIssues: headingIssues },
        lang: document.documentElement.lang || null
      };
    });
    const issues = [];
    if (results.images.withoutAlt > 0) issues.push(`${results.images.withoutAlt} kuvaa ilman alt-tekstiä`);
    if (results.links.empty > 0) issues.push(`${results.links.empty} tyhjää linkkiä`);
    if (results.forms.inputsWithoutLabels > 0) issues.push(`${results.forms.inputsWithoutLabels} lomakekenttää ilman labeliä`);
    if (results.headings.h1Count === 0) issues.push('H1-otsikko puuttuu');
    if (results.headings.h1Count > 1) issues.push('Useita H1-otsikoita');
    if (results.headings.structureIssues) issues.push('Otsikkohierarkiassa hyppyjä');
    if (!results.lang) issues.push('Lang-attribuutti puuttuu');
    return { ...results, issues, score: issues.length === 0 ? 'good' : issues.length <= 2 ? 'needs-improvement' : 'poor', axe: { error: e.message } };
  }
}

// Test: SEO Basics
async function testSEOBasics($, url) {
  const urlObj = new URL(url);
  
  return {
    // URL checks
    https: urlObj.protocol === 'https:',
    wwwRedirect: null, // Would need to test both versions
    
    // Content checks
    h1: $('h1').length,
    h1Text: $('h1').first().text() || null,
    
    // Internal/External links
    internalLinks: $(`a[href^="/"], a[href^="${urlObj.origin}"]`).length,
    externalLinks: $('a[href^="http"]:not([href^="' + urlObj.origin + '"])').length,
    
    // Text content
    wordCount: $('body').text().split(/\s+/).filter(w => w.length > 0).length,
    
    // Social links
    socialLinks: {
      facebook: $('a[href*="facebook.com"]').length > 0,
      twitter: $('a[href*="twitter.com"], a[href*="x.com"]').length > 0,
      linkedin: $('a[href*="linkedin.com"]').length > 0,
      instagram: $('a[href*="instagram.com"]').length > 0
    }
  };
}

// Test: External Files
async function testExternalFiles(url) {
  const urlObj = new URL(url);
  const results = {};
  
  // Test robots.txt
  try {
    const robotsUrl = `${urlObj.origin}/robots.txt`;
    const robotsResponse = await fetchWithTimeout(robotsUrl);
    results.robots = {
      exists: robotsResponse.ok,
      url: robotsUrl,
      size: robotsResponse.ok ? robotsResponse.headers.get('content-length') : null
    };
    
    if (robotsResponse.ok) {
      const robotsText = await robotsResponse.text();
      results.robots.hasSitemap = robotsText.includes('Sitemap:');
      results.robots.hasUserAgent = robotsText.includes('User-agent:');
    }
  } catch (error) {
    results.robots = { exists: false, error: error.message };
  }
  
  // Test sitemap.xml
  try {
    const sitemapUrl = `${urlObj.origin}/sitemap.xml`;
    const sitemapResponse = await fetchWithTimeout(sitemapUrl);
    results.sitemap = {
      exists: sitemapResponse.ok,
      url: sitemapUrl
    };
    
    if (sitemapResponse.ok) {
      const sitemapText = await sitemapResponse.text();
      const parser = new xml2js.Parser();
      const sitemapData = await parser.parseStringPromise(sitemapText);
      
      if (sitemapData.urlset) {
        results.sitemap.urlCount = sitemapData.urlset.url ? sitemapData.urlset.url.length : 0;
      } else if (sitemapData.sitemapindex) {
        results.sitemap.isSitemapIndex = true;
        results.sitemap.sitemapCount = sitemapData.sitemapindex.sitemap ? sitemapData.sitemapindex.sitemap.length : 0;
      }
    }
  } catch (error) {
    results.sitemap = { exists: false, error: error.message };
  }
  
  // Test RSS feed
  try {
    const rssUrl = `${urlObj.origin}/feed/`;
    const rssResponse = await fetchWithTimeout(rssUrl);
    results.rss = {
      exists: rssResponse.ok,
      url: rssUrl
    };
  } catch (error) {
    results.rss = { exists: false };
  }
  
  // Test llms.txt
  try {
    const llmsUrl = `${urlObj.origin}/llms.txt`;
    const llmsResponse = await fetchWithTimeout(llmsUrl);
    results.llms = {
      exists: llmsResponse.ok,
      url: llmsUrl
    };
    if (llmsResponse.ok) {
      const txt = await llmsResponse.text();
      // naive basic info
      const lines = txt.split(/\r?\n/).filter(Boolean).length;
      results.llms.lines = lines;
      results.llms.hasSitemap = /sitemap/i.test(txt);
      results.llms.hasFaq = /faq/i.test(txt);
      results.llms.hasDocs = /docs|documentation/i.test(txt);
    }
  } catch (error) {
    results.llms = { exists: false };
  }
  
  return results;
}

// AI Readiness: robots for AI bots, X-Robots-Tag, and overall score
async function testAIReadiness(url, headersInfo, $) {
  const urlObj = new URL(url);
  const aiBots = [
    'GPTBot',
    'CCBot',
    'ClaudeBot',
    'anthropic-ai',
    'PerplexityBot',
    'Google-Extended',
    'Applebot-Extended',
    'bingbot'
  ];

  const out = {
    robots: { url: `${urlObj.origin}/robots.txt`, allows: {}, exists: null },
    xRobotsTag: null,
    recommendations: [],
    score: 100
  };

  // robots.txt parse
  try {
    const r = await fetchWithTimeout(out.robots.url, 8000);
    out.robots.exists = r.ok;
    if (r.ok) {
      const txt = await r.text();
      const lower = txt.toLowerCase();
      for (const bot of aiBots) {
        const botKey = bot.toLowerCase();
        const hasUserAgent = lower.includes(`user-agent: ${botKey}`);
        // Heuristic: if bot not specified, assume wildcard applies
        const wildcardDisallowAll = /user-agent:\s*\*([\s\S]*?)disallow:\s*\//i.test(lower) && !/allow:\s*\//i.test(lower);
        out.robots.allows[bot] = hasUserAgent ? !new RegExp(`user-agent:\\s*${botKey}[\\s\\S]*?disallow:\\s*/`, 'i').test(lower) : !wildcardDisallowAll;
      }
      if (!/sitemap:/i.test(txt)) {
        out.recommendations.push('Add Sitemap reference to robots.txt');
        out.score -= 5;
      }
    } else {
      out.recommendations.push('Add robots.txt allowing AI crawlers');
      out.score -= 10;
    }
  } catch (e) {
    out.recommendations.push('robots.txt not reachable');
    out.score -= 10;
  }

  // X-Robots-Tag from headers
  if (headersInfo && headersInfo.headers) {
    const xrt = headersInfo.headers['x-robots-tag'] || null;
    out.xRobotsTag = xrt;
    if (xrt && /(noai|noimageai|nosnippet)/i.test(xrt)) {
      out.recommendations.push('Remove restrictive X-Robots-Tag for AI (noai/noimageai/nosnippet)');
      out.score -= 10;
    }
  }

  // Meta robots on page
  try {
    const metaRobots = $('meta[name="robots"]').attr('content') || '';
    if (/noindex|nosnippet/i.test(metaRobots)) {
      out.recommendations.push('Avoid page-level noindex/nosnippet for AI discoverability');
      out.score -= 10;
    }
  } catch (_) {}

  // Clamp score
  if (out.score < 0) out.score = 0;
  return out;
}

// Build llms.txt content using heuristics
async function generateLlmsTxt(url) {
  const urlObj = new URL(url);
  const origin = urlObj.origin;

  // Fetch homepage and try to extract useful links
  let homepageHtml = '';
  try {
    const r = await fetchWithTimeout(origin, 10000);
    homepageHtml = r.ok ? await r.text() : '';
  } catch (_) {}
  const $home = cheerio.load(homepageHtml || '');
  const linkHrefs = new Set();
  $home('a[href]').each((_, a) => {
    const href = $home(a).attr('href');
    if (!href) return;
    try {
      const abs = new URL(href, origin).href;
      if (abs.startsWith(origin)) linkHrefs.add(abs);
    } catch {}
  });

  // Heuristic important sections
  const pick = (regex) => Array.from(linkHrefs).find(h => regex.test(h));
  const docs = pick(/docs|documentation|developer|api/i);
  const faq = pick(/faq/i);
  const blog = pick(/blog|news/i);
  const about = pick(/about|company|meist|yritys|tietoa/i);
  const contact = pick(/contact|yhteys|ota-yhteytta|support/i);
  const glossary = pick(/glossary|sanasto/i);

  const sitemapXml = `${origin}/sitemap.xml`;

  const lines = [];
  lines.push(`# llms.txt - Guidance for AI crawlers`);
  lines.push(`# Origin: ${origin}`);
  lines.push('');
  lines.push(`# Priority sources`);
  if (docs) lines.push(`include: ${docs}`);
  if (faq) lines.push(`include: ${faq}`);
  if (blog) lines.push(`include: ${blog}`);
  if (glossary) lines.push(`include: ${glossary}`);
  if (about) lines.push(`include: ${about}`);
  if (contact) lines.push(`include: ${contact}`);
  lines.push('');
  lines.push(`# Sitemaps`);
  lines.push(`sitemap: ${sitemapXml}`);
  lines.push('');
  lines.push(`# Reading guidance`);
  lines.push(`policy: summarize allowed; cite sources; respect robots directives`);
  lines.push(`format: prefer HTML main content; ignore cookie banners and navigation`);
  lines.push('');
  lines.push(`# Licensing`);
  lines.push(`license: CC BY 4.0 unless stated otherwise`);
  lines.push('');
  lines.push(`# Notes`);
  lines.push(`note: prioritize up-to-date documentation and FAQs`);

  return lines.join('\n');
}

// Optional Lighthouse runner
async function runLighthouse(url) {
  let chrome = null;
  try {
    chrome = await chromeLauncher.launch({ chromeFlags: ['--headless', '--no-sandbox'] });
    const options = { logLevel: 'error', output: 'json', onlyCategories: ['performance', 'accessibility', 'seo'], port: chrome.port };
    const runnerResult = await lighthouse(url, options);
    const lhr = runnerResult.lhr;
    return {
      scores: {
        performance: lhr.categories.performance?.score ?? null,
        accessibility: lhr.categories.accessibility?.score ?? null,
        seo: lhr.categories.seo?.score ?? null
      },
      metrics: {
        lcp: lhr.audits['largest-contentful-paint']?.numericValue ?? null,
        fcp: lhr.audits['first-contentful-paint']?.numericValue ?? null,
        tbt: lhr.audits['total-blocking-time']?.numericValue ?? null,
        cls: lhr.audits['cumulative-layout-shift']?.numericValue ?? null
      },
      link: `https://pagespeed.web.dev/report?url=${encodeURIComponent(url)}`
    };
  } catch (e) {
    return { error: e.message };
  } finally {
    if (chrome) await chrome.kill();
  }
}

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    server: 'SEO Audit Backend',
    version: '1.0.0',
    cache: cache.size
  });
});

// Clear cache endpoint
app.post('/api/cache/clear', (req, res) => {
  cache.clear();
  res.json({ message: 'Cache cleared' });
});

// Sitemap-based audit - analyzes entire site based on sitemap.xml
app.post('/api/sitemap-audit', auditLimiter, async (req, res) => {
  const { url, maxUrls } = req.body || {};
  
  if (!url) {
    return res.status(400).json({ error: 'URL vaaditaan' });
  }
  
  try {
    const u = new URL(url);
    if (!['http:', 'https:'].includes(u.protocol)) {
      return res.status(400).json({ error: 'Virheellinen URL-protokolla' });
    }
  } catch (_) {
    return res.status(400).json({ error: 'Virheellinen URL' });
  }
  
  console.log(`🗺️ Starting sitemap audit for ${url}`);
  
  try {
    // 1. Fetch sitemap.xml
    const sitemapUrl = `${new URL(url).origin}/sitemap.xml`;
    const sitemapResponse = await fetchWithTimeout(sitemapUrl, 15000);
    
    if (!sitemapResponse.ok) {
      return res.status(400).json({ 
        error: 'Sitemap not found', 
        details: `${sitemapUrl} returned ${sitemapResponse.status}` 
      });
    }
    
    const sitemapText = await sitemapResponse.text();
    const parser = new xml2js.Parser();
    const sitemapData = await parser.parseStringPromise(sitemapText);
    
    // Extract URLs from sitemap
    let urls = [];
    if (sitemapData.urlset && sitemapData.urlset.url) {
      urls = sitemapData.urlset.url.map(entry => {
        return typeof entry.loc === 'string' ? entry.loc : entry.loc[0];
      });
    } else if (sitemapData.sitemapindex && sitemapData.sitemapindex.sitemap) {
      // Handle sitemap index - fetch first few sitemaps
      const sitemapUrls = sitemapData.sitemapindex.sitemap.slice(0, 3).map(entry => {
        return typeof entry.loc === 'string' ? entry.loc : entry.loc[0];
      });
      
      for (const smUrl of sitemapUrls) {
        try {
          const subResponse = await fetchWithTimeout(smUrl, 10000);
          if (subResponse.ok) {
            const subText = await subResponse.text();
            const subData = await parser.parseStringPromise(subText);
            if (subData.urlset && subData.urlset.url) {
              const subUrls = subData.urlset.url.map(entry => {
                return typeof entry.loc === 'string' ? entry.loc : entry.loc[0];
              });
              urls = urls.concat(subUrls);
            }
          }
        } catch (e) {
          console.warn(`Failed to fetch sub-sitemap ${smUrl}:`, e.message);
        }
      }
    }
    
    if (!urls.length) {
      return res.status(400).json({ 
        error: 'No URLs found in sitemap', 
        details: 'Sitemap exists but contains no URLs' 
      });
    }
    
    // Limit URLs (configurable via environment or request)
    const defaultMax = process.env.SITEMAP_MAX_URLS ? parseInt(process.env.SITEMAP_MAX_URLS) : 50;
    const requestedMax = maxUrls ? parseInt(maxUrls) : defaultMax;
    const finalMax = Math.min(requestedMax, 200); // Hard limit of 200 for performance
    const originalCount = urls.length;
    
    if (urls.length > finalMax) {
      urls = urls.slice(0, finalMax);
      console.log(`📄 Found ${originalCount} URLs in sitemap, analyzing first ${finalMax} (max: ${requestedMax}, hard limit: 200)`);
    } else {
      console.log(`📄 Found ${urls.length} URLs to analyze`);
    }
    
    // 2. Analyze each URL
    const results = {
      totalUrls: urls.length,
      totalUrlsInSitemap: originalCount,
      schemaIssues: 0,
      missingSchemas: 0,
      avgScore: 0,
      byContentType: {},
      pages: []
    };
    
    let browser;
    try {
      browser = await puppeteer.launch({ 
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });
      
      let totalScore = 0;
      
      for (let i = 0; i < urls.length; i++) {
        const pageUrl = urls[i];
        console.log(`🔍 Analyzing ${i + 1}/${urls.length}: ${pageUrl}`);
        
        let pageData = {
          url: pageUrl,
          contentType: 'unknown',
          title: null,
          hasRecommendedSchema: false,
          recommendedSchema: null,
          currentSchema: null,
          issues: [],
          score: 0
        };
        
        try {
          const page = await browser.newPage();
          await page.setUserAgent('SEO-Audit-Tool/1.0 (Sitemap-Crawler)');
          
          const response = await page.goto(pageUrl, { 
            waitUntil: 'networkidle2',
            timeout: 15000 
          });
          
          if (!response.ok) {
            pageData.issues.push(`HTTP ${response.status()}`);
            await page.close();
            results.pages.push(pageData);
            continue;
          }
          
          const html = await page.content();
          const $ = cheerio.load(html);
          
          // Get basic page info
          pageData.title = $('title').text() || null;
          
          // Detect content type
          pageData.contentType = detectContentType(pageUrl, $);
          
          // Get current schema
          pageData.currentSchema = getCurrentSchema($);
          
          // Get recommended schema
          pageData.recommendedSchema = getRecommendedSchema(pageData.contentType, $);
          
          // Check if has recommended schema
          pageData.hasRecommendedSchema = hasSchemaType(pageData.currentSchema, pageData.recommendedSchema);
          
          // Calculate score
          let score = 100;
          if (!pageData.hasRecommendedSchema && pageData.recommendedSchema) {
            score -= 50;
            pageData.issues.push(`Missing ${pageData.recommendedSchema} schema`);
            results.missingSchemas++;
          }
          
          // Check for schema validation issues
          const schemaValidation = validatePageSchema($, pageData.recommendedSchema);
          if (schemaValidation.issues.length > 0) {
            score -= schemaValidation.issues.length * 10;
            pageData.issues = pageData.issues.concat(schemaValidation.issues);
            results.schemaIssues += schemaValidation.issues.length;
          }
          
          pageData.score = Math.max(0, score);
          totalScore += pageData.score;
          
          await page.close();
          
        } catch (error) {
          pageData.issues.push(`Analysis failed: ${error.message}`);
          console.warn(`Failed to analyze ${pageUrl}:`, error.message);
        }
        
        // Group by content type
        if (!results.byContentType[pageData.contentType]) {
          results.byContentType[pageData.contentType] = [];
        }
        results.byContentType[pageData.contentType].push(pageData);
        
        results.pages.push(pageData);
      }
      
      results.avgScore = Math.round(totalScore / urls.length);
      
      await browser.close();
      
    } catch (error) {
      if (browser) await browser.close();
      throw error;
    }
    
    console.log(`✅ Sitemap audit complete! Avg score: ${results.avgScore}%`);
    res.json(results);
    
  } catch (error) {
    console.error('❌ Sitemap audit error:', error);
    res.status(500).json({ 
      error: 'Sitemap audit failed', 
      details: error.message 
    });
  }
});

// Content type detection based on URL patterns and page content
function detectContentType(url, $) {
  const urlLower = url.toLowerCase();
  const title = $('title').text().toLowerCase();
  const h1 = $('h1').first().text().toLowerCase();
  const bodyText = $('body').text().toLowerCase();
  
  // Blog/Article patterns
  if (urlLower.includes('/blog/') || urlLower.includes('/article/') || 
      urlLower.includes('/news/') || urlLower.includes('/post/') ||
      title.includes('blog') || h1.includes('article')) {
    return 'article';
  }
  
  // Product pages
  if (urlLower.includes('/product/') || urlLower.includes('/item/') ||
      urlLower.includes('/shop/') || urlLower.includes('/buy/') ||
      bodyText.includes('add to cart') || bodyText.includes('price') ||
      $('meta[property="product:price"]').length > 0) {
    return 'product';
  }
  
  // FAQ pages
  if (urlLower.includes('/faq') || urlLower.includes('/questions') ||
      title.includes('faq') || title.includes('questions') ||
      $('h2, h3').filter((i, el) => $(el).text().includes('?')).length > 3) {
    return 'faq';
  }
  
  // Contact pages
  if (urlLower.includes('/contact') || urlLower.includes('/yhteys') ||
      title.includes('contact') || title.includes('yhteys') ||
      $('input[type="email"]').length > 0 && $('textarea').length > 0) {
    return 'contact';
  }
  
  // About pages
  if (urlLower.includes('/about') || urlLower.includes('/tietoa') ||
      urlLower.includes('/meist') || title.includes('about') ||
      title.includes('tietoa') || title.includes('meist')) {
    return 'about';
  }
  
  // Service pages
  if (urlLower.includes('/service') || urlLower.includes('/palvelu') ||
      title.includes('service') || title.includes('palvelu')) {
    return 'service';
  }
  
  // Event pages
  if (urlLower.includes('/event') || urlLower.includes('/tapahtum') ||
      $('time[datetime]').length > 0 || 
      bodyText.includes('date:') || bodyText.includes('time:')) {
    return 'event';
  }
  
  // Job/Career pages
  if (urlLower.includes('/job') || urlLower.includes('/career') ||
      urlLower.includes('/recruitment') || urlLower.includes('/työ') ||
      title.includes('job') || title.includes('career')) {
    return 'job';
  }
  
  // Homepage
  if (url === new URL(url).origin || url === new URL(url).origin + '/' ||
      urlLower.endsWith('/') && url.split('/').length <= 4) {
    return 'homepage';
  }
  
  // Default
  return 'webpage';
}

// Get current schema types from page
function getCurrentSchema($) {
  const schemas = [];
  
  $('script[type="application/ld+json"]').each((i, elem) => {
    try {
      const content = $(elem).html();
      const parsed = JSON.parse(content);
      
      const extractTypes = (obj) => {
        if (!obj) return;
        
        if (obj['@type']) {
          const type = Array.isArray(obj['@type']) ? obj['@type'] : [obj['@type']];
          schemas.push(...type);
        }
        
        if (Array.isArray(obj['@graph'])) {
          obj['@graph'].forEach(extractTypes);
        } else if (Array.isArray(obj)) {
          obj.forEach(extractTypes);
        }
      };
      
      extractTypes(parsed);
    } catch (e) {
      // Invalid JSON-LD
    }
  });
  
  return schemas.join(', ') || null;
}

// Get recommended schema based on content type
function getRecommendedSchema(contentType, $) {
  switch (contentType) {
    case 'article':
      return 'Article'; // or BlogPosting, NewsArticle
    case 'product':
      return 'Product';
    case 'faq':
      return 'FAQPage';
    case 'contact':
      return 'ContactPage';
    case 'about':
      return 'AboutPage';
    case 'service':
      return 'Service';
    case 'event':
      return 'Event';
    case 'job':
      return 'JobPosting';
    case 'homepage':
      return 'WebSite'; // or Organization
    case 'webpage':
    default:
      return 'WebPage';
  }
}

// Check if page has the recommended schema type
function hasSchemaType(currentSchema, recommendedSchema) {
  if (!currentSchema || !recommendedSchema) return false;
  
  const current = currentSchema.toLowerCase().split(', ');
  const recommended = recommendedSchema.toLowerCase();
  
  // Direct match
  if (current.includes(recommended)) return true;
  
  // Alternative matches
  if (recommended === 'article') {
    return current.some(s => ['article', 'blogposting', 'newsarticle'].includes(s));
  }
  
  if (recommended === 'webpage') {
    return current.some(s => ['webpage', 'website'].includes(s));
  }
  
  return false;
}

// Validate schema completeness for the page
function validatePageSchema($, recommendedSchema) {
  const issues = [];
  
  if (!recommendedSchema) return { issues };
  
  try {
    $('script[type="application/ld+json"]').each((i, elem) => {
      const content = $(elem).html();
      const parsed = JSON.parse(content);
      
      const validateSchema = (obj, type) => {
        if (!obj || !obj['@type']) return;
        
        const objType = Array.isArray(obj['@type']) ? obj['@type'][0] : obj['@type'];
        if (objType !== type) return;
        
        // Common validation rules
        switch (type) {
          case 'Article':
          case 'BlogPosting':
          case 'NewsArticle':
            if (!obj.headline) issues.push('Article missing headline');
            if (!obj.datePublished) issues.push('Article missing datePublished');
            if (!obj.author) issues.push('Article missing author');
            break;
            
          case 'Product':
            if (!obj.name) issues.push('Product missing name');
            if (!obj.offers) issues.push('Product missing offers');
            break;
            
          case 'FAQPage':
            if (!obj.mainEntity || !Array.isArray(obj.mainEntity)) {
              issues.push('FAQPage missing mainEntity array');
            } else {
              obj.mainEntity.forEach((q, idx) => {
                if (!q['@type'] || q['@type'] !== 'Question') {
                  issues.push(`FAQ item ${idx + 1} not a Question`);
                }
                if (!q.acceptedAnswer) {
                  issues.push(`FAQ item ${idx + 1} missing acceptedAnswer`);
                }
              });
            }
            break;
            
          case 'WebPage':
            if (!obj.name && !obj.headline) issues.push('WebPage missing name/headline');
            if (!obj.url) issues.push('WebPage missing url');
            break;
        }
      };
      
      if (Array.isArray(parsed)) {
        parsed.forEach(item => validateSchema(item, recommendedSchema));
      } else if (parsed['@graph']) {
        parsed['@graph'].forEach(item => validateSchema(item, recommendedSchema));
      } else {
        validateSchema(parsed, recommendedSchema);
      }
    });
  } catch (e) {
    // Invalid JSON-LD structure
  }
  
  return { issues };
}

// Generate llms.txt from a URL (no Puppeteer needed)
app.post('/api/llms/generate', async (req, res) => {
  try {
    const { url } = req.body || {};
    if (!url) return res.status(400).json({ error: 'URL vaaditaan' });
    const u = new URL(url);
    if (!['http:', 'https:'].includes(u.protocol)) return res.status(400).json({ error: 'Virheellinen URL-protokolla' });

    const text = await generateLlmsTxt(url);
    res.type('text/plain').send(text);
  } catch (e) {
    res.status(500).json({ error: 'llms.txt generointi epäonnistui', details: e.message });
  }
});

app.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════╗
║       SEO Audit Backend Server         ║
╠════════════════════════════════════════╣
║  Status: ✅ Running                    ║
║  Port: ${PORT}                            ║
║  URL: http://localhost:${PORT}            ║
╠════════════════════════════════════════╣
║  Endpoints:                            ║
║  POST /api/audit     - Run audit       ║
║  GET  /api/health    - Health check    ║
║  POST /api/cache/clear - Clear cache   ║
╚════════════════════════════════════════╝

👉 Next: Open index.html in your browser
  `);
});