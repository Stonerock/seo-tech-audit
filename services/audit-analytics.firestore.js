// services/audit-analytics.firestore.js
// Analytics and dataset building for continuous product improvement

const { initializeApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

class AuditAnalytics {
  constructor() {
    try {
      // Initialize Firebase Admin (uses GOOGLE_APPLICATION_CREDENTIALS)
      this.app = initializeApp();
      this.db = getFirestore();
      this.enabled = true;
      console.log('[ANALYTICS] Firestore analytics enabled');
    } catch (error) {
      console.warn('[ANALYTICS] Firestore unavailable, analytics disabled:', error.message);
      this.enabled = false;
    }
  }

  /**
   * Store audit result for analytics and dataset building
   * Creates rich dataset for product improvement
   */
  async recordAuditResult(jobId, url, result, metadata = {}) {
    if (!this.enabled) return;

    try {
      const urlHash = this.hashUrl(url);
      const domain = new URL(url).hostname;
      const timestamp = Date.now();

      // 1. Site registry - Track all sites we've audited
      await this.db.collection('sites').doc(urlHash).set({
        url,
        domain,
        firstAuditedAt: timestamp,
        lastAuditedAt: timestamp,
        totalAudits: 1,
        
        // Latest scores for quick queries
        latestScores: {
          seo: result.tests?.seo?.score || 0,
          performance: result.tests?.performance?.score || 0,
          accessibility: result.tests?.accessibility?.score || 0,
          aeo: result.tests?.aeo?.score || 0,
          overall: this.calculateOverallScore(result)
        },

        // Site characteristics for ML features
        characteristics: {
          hasJS: result.mode === 'two-pass',
          cms: this.detectCMS(result),
          industry: this.classifyIndustry(domain),
          size: this.estimateSiteSize(result)
        },

        updatedAt: timestamp
      }, { merge: true });

      // 2. Audit history - Time series data
      await this.db.collection('audit_history').add({
        jobId,
        urlHash,
        url,
        domain,
        timestamp,
        
        // Full audit results for analysis
        scores: {
          seo: result.tests?.seo?.score || 0,
          performance: result.tests?.performance?.score || 0,
          accessibility: result.tests?.accessibility?.score || 0,
          aeo: result.tests?.aeo?.score || 0,
          overall: this.calculateOverallScore(result)
        },

        // Technical metadata
        mode: result.mode,
        executionTime: result.executionTime,
        browserless: metadata.usedBrowserless || false,
        
        // Issue patterns for ML training
        issues: this.extractIssuePatterns(result),
        
        // Performance metrics
        metrics: {
          responseTime: result.tests?.performance?.metrics?.responseTime,
          fcp: result.tests?.performance?.metrics?.fcp,
          lcp: result.tests?.performance?.metrics?.lcp,
          cls: result.tests?.performance?.metrics?.cls
        },

        // SEO signals
        seoSignals: {
          hasTitle: !!result.tests?.seo?.title,
          hasDescription: !!result.tests?.seo?.description,
          h1Count: result.tests?.seo?.h1Count || 0,
          imageAltMissing: result.tests?.seo?.imageAltMissing || 0
        }
      });

      // 3. Daily aggregates for dashboards
      const dateKey = new Date(timestamp).toISOString().split('T')[0];
      await this.updateDailyStats(dateKey, domain, result);

      console.log(`[ANALYTICS] Recorded audit data for ${domain}`);
      
    } catch (error) {
      console.error('[ANALYTICS] Failed to record audit:', error.message);
    }
  }

  /**
   * Get insights for product improvement
   */
  async getProductInsights() {
    if (!this.enabled) return null;

    try {
      // Common failure patterns
      const failurePatterns = await this.db.collection('audit_history')
        .where('scores.overall', '<', 50)
        .limit(100)
        .get();

      // Top performing sites for benchmarks
      const topSites = await this.db.collection('sites')
        .orderBy('latestScores.overall', 'desc')
        .limit(20)
        .get();

      // Industry performance comparison
      const industryStats = await this.getIndustryBenchmarks();

      return {
        totalSitesAudited: (await this.db.collection('sites').count().get()).data().count,
        commonIssues: this.analyzeFailurePatterns(failurePatterns.docs),
        benchmarks: topSites.docs.map(doc => ({
          domain: doc.data().domain,
          scores: doc.data().latestScores
        })),
        industryStats
      };

    } catch (error) {
      console.error('[ANALYTICS] Failed to get insights:', error.message);
      return null;
    }
  }

  /**
   * Get performance benchmarks by industry
   */
  async getIndustryBenchmarks() {
    const industries = ['ecommerce', 'media', 'saas', 'education', 'other'];
    const benchmarks = {};

    for (const industry of industries) {
      try {
        const sites = await this.db.collection('sites')
          .where('characteristics.industry', '==', industry)
          .orderBy('latestScores.overall', 'desc')
          .limit(50)
          .get();

        if (!sites.empty) {
          const scores = sites.docs.map(doc => doc.data().latestScores.overall);
          benchmarks[industry] = {
            count: scores.length,
            median: this.median(scores),
            p90: this.percentile(scores, 90),
            average: Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
          };
        }
      } catch (error) {
        console.warn(`[ANALYTICS] Failed to get ${industry} benchmarks:`, error.message);
      }
    }

    return benchmarks;
  }

  /**
   * Update daily aggregated statistics
   */
  async updateDailyStats(dateKey, domain, result) {
    const statsRef = this.db.collection('daily_stats').doc(dateKey);
    
    await this.db.runTransaction(async (transaction) => {
      const doc = await transaction.get(statsRef);
      const existing = doc.data() || {
        date: dateKey,
        totalAudits: 0,
        averageScores: { seo: 0, performance: 0, accessibility: 0, aeo: 0 },
        uniqueDomains: new Set(),
        issueFrequency: {}
      };

      existing.totalAudits += 1;
      existing.uniqueDomains.add(domain);
      
      // Update rolling averages
      const scores = {
        seo: result.tests?.seo?.score || 0,
        performance: result.tests?.performance?.score || 0,
        accessibility: result.tests?.accessibility?.score || 0,
        aeo: result.tests?.aeo?.score || 0
      };

      for (const [key, score] of Object.entries(scores)) {
        existing.averageScores[key] = Math.round(
          (existing.averageScores[key] * (existing.totalAudits - 1) + score) / existing.totalAudits
        );
      }

      transaction.set(statsRef, {
        ...existing,
        uniqueDomains: existing.uniqueDomains.size, // Convert Set to number for Firestore
        updatedAt: Date.now()
      });
    });
  }

  // Helper methods
  hashUrl(url) {
    return require('crypto').createHash('md5').update(url).digest('hex');
  }

  calculateOverallScore(result) {
    const scores = [
      result.tests?.seo?.score || 0,
      result.tests?.performance?.score || 0,
      result.tests?.accessibility?.score || 0,
      result.tests?.aeo?.score || 0
    ].filter(s => s > 0);

    return scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
  }

  detectCMS(result) {
    // Simple CMS detection based on audit results
    const html = result.tests?.metadata?.html || '';
    if (html.includes('wp-content')) return 'wordpress';
    if (html.includes('shopify')) return 'shopify';
    if (html.includes('wix')) return 'wix';
    return 'unknown';
  }

  classifyIndustry(domain) {
    // Simple industry classification - can be enhanced with ML
    if (domain.includes('shop') || domain.includes('store')) return 'ecommerce';
    if (domain.includes('news') || domain.includes('blog')) return 'media';
    if (domain.includes('app') || domain.includes('saas')) return 'saas';
    if (domain.includes('edu') || domain.includes('university')) return 'education';
    return 'other';
  }

  estimateSiteSize(result) {
    // Estimate based on page load time, resources, etc.
    const responseTime = result.tests?.performance?.metrics?.responseTime || 0;
    if (responseTime > 3000) return 'large';
    if (responseTime > 1500) return 'medium';
    return 'small';
  }

  extractIssuePatterns(result) {
    const issues = [];
    
    if (result.tests?.seo) {
      const seo = result.tests.seo;
      if (!seo.title) issues.push('missing_title');
      if (!seo.description) issues.push('missing_meta_description');
      if (seo.h1Count !== 1) issues.push('h1_issues');
    }

    if (result.tests?.performance) {
      const perf = result.tests.performance;
      if (perf.metrics?.responseTime > 3000) issues.push('slow_response');
      if (perf.score < 50) issues.push('poor_performance');
    }

    return issues;
  }

  analyzeFailurePatterns(docs) {
    const patterns = {};
    
    docs.forEach(doc => {
      const data = doc.data();
      data.issues?.forEach(issue => {
        patterns[issue] = (patterns[issue] || 0) + 1;
      });
    });

    return Object.entries(patterns)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10)
      .map(([issue, count]) => ({ issue, count }));
  }

  median(arr) {
    const sorted = [...arr].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  }

  percentile(arr, p) {
    const sorted = [...arr].sort((a, b) => a - b);
    const index = (p / 100) * (sorted.length - 1);
    if (Math.floor(index) === index) {
      return sorted[index];
    } else {
      const lower = sorted[Math.floor(index)];
      const upper = sorted[Math.ceil(index)];
      return lower + (upper - lower) * (index - Math.floor(index));
    }
  }
}

module.exports = { AuditAnalytics };