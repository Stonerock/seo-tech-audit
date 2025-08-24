// services/audit-orchestrator.js
// Main orchestrator for coordinating all audit services

const puppeteer = require('puppeteer');
const cheerio = require('cheerio');
const SEOAnalyzer = require('./seo-analyzer');
const AIAnalyzer = require('./ai-analyzer');
const PerformanceAnalyzer = require('./performance-analyzer');
const BotPolicyAnalyzer = require('./bot-policy-analyzer');
const ExternalAPIsService = require('./external-apis');
const { fetchWithTimeout, normalizeHeaders } = require('../utils/helpers');
const { validateAuditUrl, validateAuditOptions } = require('../utils/validation');

class AuditOrchestrator {
  constructor(options = {}) {
    this.seoAnalyzer = new SEOAnalyzer();
    this.aiAnalyzer = new AIAnalyzer();
    this.performanceAnalyzer = new PerformanceAnalyzer();
    this.botPolicyAnalyzer = new BotPolicyAnalyzer();
    this.externalAPIs = new ExternalAPIsService();
    
    this.defaultOptions = {
      timeout: 30000,
      includeExternal: true,
      lighthouse: false,
      aiAnalysis: true,
      multiBotAnalysis: true
    };
    
    this.puppeteerOptions = {
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    };
  }

  /**
   * Run complete audit for a URL
   * @param {string} url - URL to audit
   * @param {Object} options - Audit options
   * @returns {Object} - Complete audit results
   */
  async runFullAudit(url, options = {}) {
    const startTime = Date.now();
    
    // Validate inputs
    const urlValidation = validateAuditUrl(url);
    if (!urlValidation.isValid) {
      throw new Error(`Invalid URL: ${urlValidation.errors.join(', ')}`);
    }

    const optionsValidation = validateAuditOptions(options);
    if (!optionsValidation.isValid) {
      throw new Error(`Invalid options: ${optionsValidation.errors.join(', ')}`);
    }

    const mergedOptions = { ...this.defaultOptions, ...optionsValidation.sanitized };
    
    let browser = null;
    try {
      // Initialize results structure
      const results = {
        url,
        timestamp: new Date().toISOString(),
        processingTime: null,
        tests: {},
        metadata: {
          version: '2.0.0',
          options: mergedOptions
        }
      };

      console.log(`🚀 Starting audit for ${url}`);
      
      // Launch browser
      browser = await puppeteer.launch(this.puppeteerOptions);
      const page = await browser.newPage();
      await page.setUserAgent('SEO-Audit-Tool/2.0 (Compatible)');
      
      // Load page
      console.log('📄 Loading page...');
      const response = await page.goto(url, { 
        waitUntil: 'networkidle2',
        timeout: mergedOptions.timeout 
      });
      
      const html = await page.content();
      const $ = cheerio.load(html);

      // Get headers information
      console.log('🌐 Analyzing headers...');
      const headersInfo = await this.getHeadersInfo(url);
      results.tests.headers = headersInfo;

      // Run analyses in parallel where possible
      console.log('🔍 Running core analyses...');
      const [schemaResults, metadataResults] = await Promise.all([
        this.testSchema($),
        this.seoAnalyzer.testMetadata($)
      ]);

      results.tests.schema = schemaResults;
      results.tests.metadata = metadataResults;

      // SEO Analysis
      console.log('🎯 Analyzing SEO...');
      results.tests.seo = await this.seoAnalyzer.analyzeSEOBasics($, url);

      // Performance Analysis
      console.log('⚡ Analyzing performance...');
      results.tests.performance = await this.performanceAnalyzer.analyzePerformance(page);

      // Accessibility Analysis
      console.log('♿ Analyzing accessibility...');
      results.tests.accessibility = await this.performanceAnalyzer.analyzeAccessibility(page);

      // External files (robots.txt, sitemap.xml, etc.)
      console.log('📁 Testing external files...');
      results.tests.files = await this.seoAnalyzer.testExternalFiles(url);

      // AI Readiness Analysis
      console.log('🤖 Analyzing AI readiness...');
      results.tests.ai = await this.seoAnalyzer.testAIReadiness(url, headersInfo, $);

      // Multi-Bot Analysis
      if (mergedOptions.multiBotAnalysis) {
        console.log('🤖🔍 Running multi-bot policy analysis...');
        results.tests.multiBot = await this.botPolicyAnalyzer.analyzeMultiBotAccess(url);
      }

      // Advanced AI Analysis (if enabled)
      if (mergedOptions.aiAnalysis) {
        console.log('🧠 Running advanced AI analysis...');
        results.tests.aiAdvanced = await this.aiAnalyzer.analyzeAIReadiness($, results.tests, url);
      }

      // AI Surfaces Readiness Score
      console.log('🎯 Computing AI Surfaces readiness...');
      results.tests.aiSurfaces = await this.computeAISurfaces($, results.tests);

      await browser.close();
      browser = null;

      // External APIs Analysis (after browser is closed to free resources)
      if (mergedOptions.includeExternal || mergedOptions.lighthouse) {
        console.log('🌐 Running external analysis...');
        results.tests.external = await this.externalAPIs.runExternalAnalysis(url, {
          lighthouse: mergedOptions.lighthouse,
          waitForWPT: false // Don't wait for WebPageTest completion to avoid long delays
        });
        
        // If Lighthouse was run, also add it to a separate lighthouse field for compatibility
        if (results.tests.external && results.tests.external.lighthouse) {
          results.tests.lighthouse = results.tests.external.lighthouse;
        }
      }

      // Calculate processing time
      results.processingTime = Date.now() - startTime;
      
      console.log(`✅ Audit complete in ${results.processingTime}ms`);
      return results;

    } catch (error) {
      console.error('❌ Audit error:', error);
      if (browser) {
        await browser.close();
      }
      throw error;
    }
  }

  /**
   * Get headers information including CDN detection
   * @param {string} url - URL to analyze
   * @returns {Object} - Headers analysis
   */
  async getHeadersInfo(url) {
    try {
      const response = await fetchWithTimeout(url, 8000);
      const headers = normalizeHeaders(response.headers);

      const { detectCdn } = require('../utils/helpers');
      const cdn = detectCdn(headers);
      const cacheStatus = headers['x-cache'] || headers['cf-cache-status'] || headers['x-cache-status'] || null;

      return {
        status: response.status,
        cdn,
        cacheStatus,
        server: headers['server'] || null,
        via: headers['via'] || null,
        headers,
        contentType: headers['content-type'] || null,
        contentLength: headers['content-length'] || null,
        lastModified: headers['last-modified'] || null,
        etag: headers['etag'] || null
      };
    } catch (error) {
      return { error: error.message };
    }
  }

  /**
   * Test Schema.org markup
   * @param {Object} $ - Cheerio DOM object
   * @returns {Object} - Schema analysis results
   */
  async testSchema($) {
    const schemas = [];
    
    // Extract JSON-LD schemas
    $('script[type="application/ld+json"]').each((i, elem) => {
      try {
        // Use text() to avoid HTML-encoded quotes and entities
        const raw = ($(elem).text() || '').trim();
        if (!raw) return;

        // Clean comments and CDATA wrappers
        let cleaned = raw
          .replace(/<!--[\s\S]*?-->/g, '')
          .replace(/\/\*<!\[CDATA\[\*\//g, '')
          .replace(/\/\*\]\]>\*\//g, '')
          .trim();

        let parsed = null;
        try {
          parsed = JSON.parse(cleaned);
        } catch (_) {
          // Remove trailing commas
          const noTrailingCommas = cleaned.replace(/,\s*([}\]])/g, '$1');
          try {
            parsed = JSON.parse(noTrailingCommas);
          } catch (_) {
            // Multiple root objects concatenated
            const asArray = `[${noTrailingCommas.replace(/}\s*{/, '},{')}]`;
            parsed = JSON.parse(asArray);
          }
        }

        if (Array.isArray(parsed)) {
          parsed.forEach(item => schemas.push(item));
        } else if (parsed && Array.isArray(parsed['@graph'])) {
          parsed['@graph'].forEach(item => schemas.push(item));
        } else {
          schemas.push(parsed);
        }
      } catch (e) {
        console.warn('Invalid JSON-LD:', e.message);
      }
    });
    
    // Check for microdata
    const hasItemscope = $('[itemscope]').length > 0;
    
    // Check for RDFa
    const hasRDFa = $('[typeof]').length > 0;
    
    // Extract schema types
    const types = schemas
      .flatMap(s => {
        const t = s && s['@type'];
        if (!t) return [];
        return Array.isArray(t) ? t : [t];
      })
      .filter(Boolean);

    // Validate required fields
    const requiredIssues = this.validateSchemaRequired(schemas);
    
    return {
      found: schemas.length > 0 || hasItemscope || hasRDFa,
      jsonLdCount: schemas.length,
      types: [...new Set(types)], // Remove duplicates
      hasMicrodata: hasItemscope,
      hasRDFa: hasRDFa,
      schemas: schemas.slice(0, 5), // Limit for response size
      requiredIssues,
      score: this.calculateSchemaScore(schemas, types, requiredIssues)
    };
  }

  /**
   * Validate required fields for common schema types
   * @param {Array} schemas - Array of schema objects
   * @returns {Array} - Array of validation issues
   */
  validateSchemaRequired(schemas) {
    const issues = [];
    const asArray = Array.isArray(schemas) ? schemas : [schemas];
    const flatten = asArray.flatMap(s => Array.isArray(s['@graph']) ? s['@graph'] : [s]);
    
    for (const s of flatten) {
      const type = Array.isArray(s['@type']) ? s['@type'][0] : s['@type'];
      if (!type) continue;
      
      switch (type) {
        case 'WebPage':
          if (!s.name && !s.headline) issues.push('WebPage: name/headline missing');
          if (!s.url) issues.push('WebPage: url missing');
          break;
          
        case 'Article':
        case 'NewsArticle':
        case 'BlogPosting':
          if (!s.headline) issues.push(`${type}: headline missing`);
          if (!s.datePublished) issues.push(`${type}: datePublished missing`);
          if (!s.author) issues.push(`${type}: author missing`);
          break;
          
        case 'FAQPage':
          const hasQuestions = Array.isArray(s.mainEntity) && 
            s.mainEntity.every(q => q['@type'] === 'Question' && q.acceptedAnswer);
          if (!hasQuestions) issues.push('FAQPage: mainEntity/Question/acceptedAnswer missing');
          break;
          
        case 'Product':
          if (!s.name) issues.push('Product: name missing');
          if (!s.offers) issues.push('Product: offers missing');
          break;
          
        case 'Organization':
          if (!s.name) issues.push('Organization: name missing');
          break;
      }
    }
    
    return issues;
  }

  /**
   * Calculate schema score
   * @param {Array} schemas - Schema objects
   * @param {Array} types - Schema types
   * @param {Array} issues - Validation issues
   * @returns {number} - Score from 0-100
   */
  calculateSchemaScore(schemas, types, issues) {
    let score = 0;
    
    // Base score for having schemas
    if (schemas.length > 0) score += 30;
    
    // Bonus for multiple useful schema types
    const usefulTypes = ['Article', 'WebPage', 'Organization', 'Person', 'Product', 'FAQPage', 'HowTo'];
    const foundUsefulTypes = types.filter(t => usefulTypes.includes(t)).length;
    score += Math.min(40, foundUsefulTypes * 10);
    
    // Deduct for missing required fields
    score -= Math.min(30, issues.length * 5);
    
    // Bonus for comprehensive implementation
    if (schemas.length >= 3 && issues.length === 0) score += 30;
    
    return Math.max(0, Math.min(100, score));
  }

  /**
   * Compute AI Surfaces Readiness Score
   * @param {Object} $ - Cheerio DOM object
   * @param {Object} tests - Test results
   * @returns {Object} - AI surfaces readiness analysis
   */
  async computeAISurfaces($, tests) {
    const weights = {
      answerClarity: 25,
      structuredData: 20,
      extractableFacts: 20,
      citations: 15,
      recency: 10,
      technical: 10
    };

    // Language detection
    const pageLangRaw = (tests.accessibility?.lang || $('html').attr('lang') || '').toLowerCase();
    const lang = pageLangRaw.slice(0, 2);
    const bodyText = ($('body').text() || '').toLowerCase();

    // Language-specific keywords
    const qTerms = {
      fi: ['mikä on', 'miten', 'ohje', 'ukk', 'kysymys'],
      sv: ['vad är', 'hur man', 'vanliga frågor', 'faq'],
      en: ['what is', 'how to', 'faq', 'use case', 'benefit'],
      de: ['was ist', 'wie man', 'faq', 'anwendungsfall'],
      ja: ['とは', '使い方', 'よくある質問']
    };

    const langSafe = (k) => (k in qTerms ? k : 'en');
    const any = (text, arr) => arr.some(t => text.includes(t));

    // Answer Clarity
    const answerClarity = (() => {
      const h1 = $('h1').length;
      const faqs = $('script[type="application/ld+json"]').filter((_, el) => 
        /FAQPage/.test($(el).html() || '')).length;
      const qText = any(bodyText, qTerms[langSafe(lang)]);
      
      let score = 0;
      if (h1 >= 1) score += 40;
      if (faqs > 0) score += 40;
      if (qText) score += 20;
      return score;
    })();

    // Structured Data
    const structuredData = (() => {
      const types = tests.schema?.types?.length || 0;
      const issues = (tests.schema?.requiredIssues || []).length;
      let base = Math.min(100, types * 15);
      base -= Math.min(40, issues * 10);
      return Math.max(0, base);
    })();

    // Extractable Facts
    const extractableFacts = (() => {
      let score = 0;
      const hasMeta = Boolean(tests.metadata?.title && tests.metadata?.description);
      const og = tests.metadata?.og || {};
      const hasOG = Boolean(og.title || og.description || og.image);
      const dl = $('dl dt, dl dd').length > 2;
      
      if (hasMeta) score += 40;
      if (hasOG) score += 40;
      if (dl) score += 20;
      return score;
    })();

    // Citations
    const citations = (() => {
      const external = $('a[href^="http"]').length;
      const rels = $('a[rel~="nofollow"], a[rel~="noopener"]').length;
      let score = 0;
      
      if (external > 3) score += 60;
      else if (external > 0) score += 40;
      if (rels > 2) score += 20;
      else if (rels > 0) score += 10;
      
      return Math.min(100, score);
    })();

    // Recency
    const recency = (() => {
      let score = 0;
      const hasDates = /202[3-9]|202[0-9]-\d{2}-\d{2}/.test(bodyText);
      const jsonLdDates = $('script[type="application/ld+json"]').filter((_, el) => 
        /(datePublished|dateModified)/.test($(el).html() || '')).length;
      
      if (hasDates) score += 50;
      if (jsonLdDates) score += 50;
      return Math.min(100, score);
    })();

    // Technical
    const technical = (() => {
      let score = 0;
      if (tests.seo?.https) score += 30;
      if (tests.files?.robots?.exists) score += 20;
      if (tests.files?.sitemap?.exists) score += 20;
      if (tests.headers?.cdn) score += 15;
      
      const perfOK = tests.performance?.scores?.overall === 'good';
      if (perfOK) score += 15;
      
      return Math.min(100, score);
    })();

    const subs = { answerClarity, structuredData, extractableFacts, citations, recency, technical };
    const total = Object.entries(weights).reduce((sum, [metric, weight]) => {
      return sum + (subs[metric] * (weight / 100));
    }, 0);

    const score = Math.round(total);
    const grade = score >= 90 ? 'A' : score >= 80 ? 'B' : score >= 70 ? 'C' : score >= 60 ? 'D' : 'F';

    const recommendations = [];
    if (answerClarity < 60) recommendations.push('Improve answer structure: add H1, FAQ/Q&A sections');
    if (structuredData < 60) recommendations.push('Expand schema markup and fix required fields');
    if (extractableFacts < 60) recommendations.push('Add extractable facts (meta/OG, definition lists)');
    if (citations < 60) recommendations.push('Add more citations and source links');
    if (recency < 60) recommendations.push('Update published/modified dates');
    if (technical < 60) recommendations.push('Improve technical foundation (HTTPS, robots, sitemap)');

    return { score, grade, weights, subs, recommendations };
  }
}

module.exports = AuditOrchestrator;