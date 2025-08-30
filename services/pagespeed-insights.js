// services/pagespeed-insights.js - PageSpeed Insights API integration with 24h caching
const fetch = require('node-fetch');
const crypto = require('crypto');

class PageSpeedInsights {
  constructor(options = {}) {
    this.enabled = process.env.USE_PSI_METRICS === 'true';
    this.apiKey = null; // Will be loaded securely from Google Secret Manager
    this.cache = new Map(); // In-memory cache (could be Redis in production)
    this.cacheWindow = options.cacheWindowMs || 24 * 60 * 60 * 1000; // 24 hours
    this.baseUrl = 'https://www.googleapis.com/pagespeedonline/v5/runPagespeed';
    this.secretsManager = null;
    
    if (this.enabled) {
      console.log('[PSI] Enabled - loading API key from Secret Manager');
    } else {
      console.log('[PSI] Disabled - set USE_PSI_METRICS=true to enable');
    }
  }

  /**
   * Initialize and get API key from Google Secret Manager
   */
  async initializeApiKey() {
    if (!this.secretsManager) {
      const { secretsManager } = require('../utils/secrets');
      this.secretsManager = secretsManager;
    }

    if (!this.apiKey) {
      try {
        this.apiKey = await this.secretsManager.getPageSpeedApiKey();
        console.log(`[PSI] API key loaded${this.apiKey ? ' successfully' : ' - using rate limited access'}`);
      } catch (error) {
        console.warn(`[PSI] Failed to load API key: ${error.message}`);
        // Fallback to environment variable for local development
        this.apiKey = process.env.PAGESPEED_API_KEY;
      }
    }
    
    return this.apiKey;
  }

  /**
   * Get PageSpeed Insights data with caching
   */
  async getInsights(url, options = {}) {
    if (!this.enabled) return null;

    try {
      // Initialize API key from Secret Manager
      await this.initializeApiKey();
      
      const cacheKey = this.getCacheKey(url, options);
      
      // Check cache first
      const cached = this.getFromCache(cacheKey);
      if (cached) {
        console.log(`[PSI] Cache hit for ${this.getDomain(url)}`);
        return { ...cached, cached: true };
      }

      console.log(`[PSI] Fetching fresh data for ${this.getDomain(url)}`);
      
      // Build API request
      const params = new URLSearchParams({
        url,
        strategy: options.strategy || 'mobile'
      });

      // Add multiple categories properly
      const categories = (options.categories || 'performance,seo,accessibility').split(',');
      categories.forEach(category => {
        params.append('category', category.trim());
      });

      if (this.apiKey) {
        params.append('key', this.apiKey);
      }

      const apiUrl = `${this.baseUrl}?${params}`;
      
      // Make API request with timeout
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 60000); // 60s timeout for complex sites

      const response = await fetch(apiUrl, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'SEO-Audit-Tool/2.1.0 (+https://attentionisallyouneed.app)'
        }
      });

      clearTimeout(timeout);

      if (!response.ok) {
        throw new Error(`PSI API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      const processed = this.processInsights(data);
      
      // Cache the result
      this.setCache(cacheKey, processed);
      
      console.log(`[PSI] Fresh data cached for ${this.getDomain(url)}`);
      return { ...processed, cached: false };

    } catch (error) {
      console.error(`[PSI] Failed to get insights for ${this.getDomain(url)}:`, {
        name: error?.name,
        message: error?.message,
        code: error?.code,
        stack: error?.stack?.split('\n').slice(0, 3)
      });
      
      // Return null for downstream handling, but don't fail the entire audit
      return null;
    }
  }

  /**
   * Process raw PSI data into our format
   */
  processInsights(rawData) {
    const lhr = rawData.lighthouseResult;
    
    const processed = {
      url: rawData.id,
      timestamp: new Date().toISOString(),
      
      // Performance metrics
      performance: {
        score: Math.round((lhr.categories?.performance?.score || 0) * 100),
        metrics: {
          fcp: lhr.audits?.['first-contentful-paint']?.displayValue || 'N/A',
          lcp: lhr.audits?.['largest-contentful-paint']?.displayValue || 'N/A',
          fid: lhr.audits?.['max-potential-fid']?.displayValue || 'N/A',
          cls: lhr.audits?.['cumulative-layout-shift']?.displayValue || 'N/A',
          speedIndex: lhr.audits?.['speed-index']?.displayValue || 'N/A',
          tbt: lhr.audits?.['total-blocking-time']?.displayValue || 'N/A'
        },
        // Core Web Vitals status
        coreWebVitals: {
          fcp: this.getMetricStatus(lhr.audits?.['first-contentful-paint']?.score),
          lcp: this.getMetricStatus(lhr.audits?.['largest-contentful-paint']?.score),
          cls: this.getMetricStatus(lhr.audits?.['cumulative-layout-shift']?.score),
          fid: this.getMetricStatus(lhr.audits?.['max-potential-fid']?.score)
        }
      },

      // SEO data
      seo: lhr.categories?.seo ? {
        score: Math.round((lhr.categories.seo.score || 0) * 100),
        audits: this.extractSEOAudits(lhr.audits)
      } : null,

      // Accessibility data  
      accessibility: lhr.categories?.accessibility ? {
        score: Math.round((lhr.categories.accessibility.score || 0) * 100),
        audits: this.extractA11yAudits(lhr.audits)
      } : null,

      // Performance opportunities
      opportunities: this.extractOpportunities(lhr.audits),

      // Technical details
      environment: {
        userAgent: lhr.environment?.userAgent,
        networkThrottling: lhr.environment?.throttling?.requestLatencyMs,
        emulatedDevice: lhr.environment?.hostUserAgent
      }
    };

    return processed;
  }

  /**
   * Extract performance opportunities from audits
   */
  extractOpportunities(audits) {
    const opportunities = [];
    
    const opportunityAudits = [
      'unused-css-rules',
      'unused-javascript',
      'modern-image-formats',
      'offscreen-images',
      'render-blocking-resources',
      'unminified-css',
      'unminified-javascript',
      'server-response-time',
      'redirects'
    ];

    opportunityAudits.forEach(auditId => {
      const audit = audits?.[auditId];
      if (audit && audit.score < 1 && audit.details?.overallSavingsMs > 50) {
        opportunities.push({
          title: audit.title,
          description: audit.description,
          impact: audit.details.overallSavingsMs,
          score: audit.score
        });
      }
    });

    // Sort by impact (highest first)
    return opportunities
      .sort((a, b) => b.impact - a.impact)
      .slice(0, 10); // Top 10 opportunities
  }

  /**
   * Extract SEO audit results
   */
  extractSEOAudits(audits) {
    const seoAudits = [];
    
    const importantSEOAudits = [
      'document-title',
      'meta-description', 
      'link-text',
      'image-alt',
      'hreflang',
      'canonical'
    ];

    importantSEOAudits.forEach(auditId => {
      const audit = audits?.[auditId];
      if (audit) {
        seoAudits.push({
          id: auditId,
          title: audit.title,
          description: audit.description,
          score: audit.score,
          passed: audit.score >= 0.9
        });
      }
    });

    return seoAudits;
  }

  /**
   * Extract accessibility audit results
   */
  extractA11yAudits(audits) {
    const a11yAudits = [];
    
    const importantA11yAudits = [
      'color-contrast',
      'image-alt',
      'button-name',
      'link-name',
      'document-title'
    ];

    importantA11yAudits.forEach(auditId => {
      const audit = audits?.[auditId];
      if (audit) {
        a11yAudits.push({
          id: auditId,
          title: audit.title,
          description: audit.description,
          score: audit.score,
          passed: audit.score >= 0.9
        });
      }
    });

    return a11yAudits;
  }

  // Helper methods
  getCacheKey(url, options) {
    const key = `${url}-${JSON.stringify(options)}`;
    return crypto.createHash('md5').update(key).digest('hex');
  }

  getFromCache(key) {
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < this.cacheWindow) {
      return cached.data;
    }
    // Cleanup expired entry
    if (cached) {
      this.cache.delete(key);
    }
    return null;
  }

  setCache(key, data) {
    this.cache.set(key, {
      data,
      timestamp: Date.now()
    });

    // Simple cache size management (keep last 1000 entries)
    if (this.cache.size > 1000) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
  }

  getDomain(url) {
    try {
      return new URL(url).hostname;
    } catch {
      return 'invalid-url';
    }
  }

  getMetricStatus(score) {
    if (score >= 0.9) return 'good';
    if (score >= 0.5) return 'needs-improvement';
    return 'poor';
  }

  /**
   * Clear cache (for testing/management)
   */
  clearCache() {
    const size = this.cache.size;
    this.cache.clear();
    console.log(`[PSI] Cache cleared: ${size} entries removed`);
    return size;
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    const now = Date.now();
    let valid = 0;
    let expired = 0;

    for (const [key, entry] of this.cache) {
      if (now - entry.timestamp < this.cacheWindow) {
        valid++;
      } else {
        expired++;
      }
    }

    return {
      totalEntries: this.cache.size,
      validEntries: valid,
      expiredEntries: expired,
      cacheWindowHours: this.cacheWindow / (60 * 60 * 1000)
    };
  }
}

module.exports = { PageSpeedInsights };