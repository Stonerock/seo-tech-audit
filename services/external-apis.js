// services/external-apis.js
// External API integrations for comprehensive performance analysis

const { default: lighthouse } = require('lighthouse');
const chromeLauncher = require('chrome-launcher');
const { fetchWithTimeout } = require('../utils/helpers');
const { logger } = require('../utils/logger');

class ExternalAPIsService {
  constructor() {
    this.timeouts = {
      lighthouse: 60000,  // 1 minute
      psi: 30000,         // 30 seconds
      wpt: 15000          // 15 seconds
    };
  }

  /**
   * Run Lighthouse analysis
   * @param {string} url - URL to analyze
   * @param {Object} options - Lighthouse options
   * @returns {Object|null} - Lighthouse results or null if disabled/failed
   */
  async runLighthouse(url, options = {}) {
    const shouldRun = process.env.LIGHTHOUSE === '1' || options.lighthouse;
    if (!shouldRun) {
      logger.info('Lighthouse analysis skipped (not enabled)');
      return null;
    }

    let chrome = null;
    try {
      logger.info('Starting Lighthouse analysis', { url });
      
      // Launch Chrome
      chrome = await chromeLauncher.launch({
        chromeFlags: ['--headless', '--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
      });

      // Configure Lighthouse
      const lighthouseOptions = {
        logLevel: 'error',
        output: 'json',
        onlyCategories: ['performance', 'accessibility', 'seo', 'best-practices'],
        port: chrome.port,
        ...options.lighthouseConfig
      };

      // Run Lighthouse
      const runnerResult = await lighthouse(url, lighthouseOptions);
      
      if (!runnerResult || !runnerResult.lhr) {
        throw new Error('Invalid Lighthouse results');
      }

      const { lhr } = runnerResult;
      
      // Extract key metrics and scores
      const results = {
        scores: {
          performance: Math.round((lhr.categories.performance?.score || 0) * 100),
          accessibility: Math.round((lhr.categories.accessibility?.score || 0) * 100),
          seo: Math.round((lhr.categories.seo?.score || 0) * 100),
          bestPractices: Math.round((lhr.categories['best-practices']?.score || 0) * 100)
        },
        metrics: {
          firstContentfulPaint: lhr.audits['first-contentful-paint']?.numericValue || null,
          largestContentfulPaint: lhr.audits['largest-contentful-paint']?.numericValue || null,
          firstMeaningfulPaint: lhr.audits['first-meaningful-paint']?.numericValue || null,
          speedIndex: lhr.audits['speed-index']?.numericValue || null,
          totalBlockingTime: lhr.audits['total-blocking-time']?.numericValue || null,
          cumulativeLayoutShift: lhr.audits['cumulative-layout-shift']?.numericValue || null
        },
        audits: {
          // Key performance audits
          unusedCssRules: lhr.audits['unused-css-rules']?.details?.overallSavingsBytes || 0,
          unusedJavaScript: lhr.audits['unused-javascript']?.details?.overallSavingsBytes || 0,
          renderBlockingResources: lhr.audits['render-blocking-resources']?.details?.overallSavingsMs || 0,
          // Accessibility audits
          colorContrast: lhr.audits['color-contrast']?.score || null,
          imageAlt: lhr.audits['image-alt']?.score || null,
          // SEO audits
          metaDescription: lhr.audits['meta-description']?.score || null,
          httpStatusCode: lhr.audits['http-status-code']?.score || null
        },
        opportunities: this.extractLighthouseOpportunities(lhr),
        diagnostics: this.extractLighthouseDiagnostics(lhr)
      };

      await chrome.kill();
      
      logger.info('Lighthouse analysis completed successfully', { 
        url, 
        performanceScore: results.scores.performance 
      });
      
      return results;

    } catch (error) {
      logger.error('Lighthouse analysis failed', { url, error: error.message });
      
      if (chrome) {
        try {
          await chrome.kill();
        } catch (killError) {
          logger.error('Failed to kill Chrome process', killError);
        }
      }
      
      return {
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Run PageSpeed Insights analysis
   * @param {string} url - URL to analyze
   * @returns {Object|null} - PSI results or null if API key not provided
   */
  async runPageSpeedInsights(url) {
    const apiKey = process.env.PSI_API_KEY;
    if (!apiKey) {
      logger.info('PageSpeed Insights skipped (no API key)');
      return null;
    }

    try {
      logger.info('Running PageSpeed Insights analysis', { url });
      
      const endpoint = `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(url)}&key=${apiKey}&strategy=mobile`;
      const response = await fetchWithTimeout(endpoint, this.timeouts.psi);
      
      if (!response.ok) {
        throw new Error(`PSI API returned ${response.status}`);
      }
      
      const data = await response.json();
      const lighthouse = data.lighthouseResult || {};
      
      const results = {
        score: lighthouse.categories?.performance?.score ? 
               Math.round(lighthouse.categories.performance.score * 100) : null,
        link: `https://pagespeed.web.dev/report?url=${encodeURIComponent(url)}`,
        metrics: {
          fcp: lighthouse.audits?.['first-contentful-paint']?.numericValue || null,
          lcp: lighthouse.audits?.['largest-contentful-paint']?.numericValue || null,
          cls: lighthouse.audits?.['cumulative-layout-shift']?.numericValue || null,
          speedIndex: lighthouse.audits?.['speed-index']?.numericValue || null
        },
        fieldData: data.loadingExperience || null,
        originFallback: data.originLoadingExperience || null
      };

      logger.info('PageSpeed Insights completed', { 
        url, 
        score: results.score 
      });
      
      return results;

    } catch (error) {
      logger.error('PageSpeed Insights failed', { url, error: error.message });
      return {
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Trigger WebPageTest analysis
   * @param {string} url - URL to analyze
   * @returns {Object|null} - WPT test info or null if API key not provided
   */
  async runWebPageTest(url) {
    const apiKey = process.env.WPT_API_KEY;
    if (!apiKey) {
      logger.info('WebPageTest skipped (no API key)');
      return null;
    }

    const location = process.env.WPT_LOCATION || 'eu-west-1';

    try {
      logger.info('Triggering WebPageTest', { url, location });
      
      const endpoint = `https://www.webpagetest.org/runtest.php?url=${encodeURIComponent(url)}&k=${apiKey}&location=${encodeURIComponent(location)}&f=json`;
      const response = await fetchWithTimeout(endpoint, this.timeouts.wpt);
      
      if (!response.ok) {
        throw new Error(`WPT API returned ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data.statusCode !== 200) {
        throw new Error(`WPT Error: ${data.statusText}`);
      }
      
      const testId = data.data?.testId;
      const userUrl = data.data?.userUrl;
      const jsonUrl = data.data?.jsonUrl;

      if (!testId) {
        throw new Error('No test ID returned from WebPageTest');
      }

      logger.info('WebPageTest triggered successfully', { 
        url, 
        testId, 
        userUrl 
      });

      return {
        testId,
        userUrl,
        jsonUrl,
        location,
        status: 'triggered',
        message: 'Test started - results available via userUrl'
      };

    } catch (error) {
      logger.error('WebPageTest failed', { url, error: error.message });
      return {
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Poll WebPageTest results (optional - for getting actual metrics)
   * @param {string} jsonUrl - JSON results URL from WPT
   * @returns {Object|null} - WPT metrics or null if not ready
   */
  async pollWebPageTestResults(jsonUrl) {
    if (!jsonUrl) return null;

    try {
      logger.info('Polling WebPageTest results', { jsonUrl });
      
      const response = await fetchWithTimeout(jsonUrl, this.timeouts.wpt);
      if (!response.ok) return null;
      
      const data = await response.json();
      
      // Check if test is complete
      if (data.statusCode !== 200 || !data.data?.runs) {
        return { status: 'pending', message: 'Test still running' };
      }

      // Extract metrics from first view of first run
      const firstRun = data.data.runs['1']?.firstView;
      if (!firstRun) return null;

      const metrics = {
        ttfb: firstRun.TTFB || null,
        fcp: firstRun.firstContentfulPaint || null,
        lcp: firstRun.largestContentfulPaint || null,
        loadTime: firstRun.loadTime || null,
        fullyLoaded: firstRun.fullyLoaded || null,
        speedIndex: firstRun.SpeedIndex || null,
        bytesIn: firstRun.bytesIn || null,
        requests: firstRun.requests || null
      };

      logger.info('WebPageTest results retrieved', { 
        jsonUrl, 
        ttfb: metrics.ttfb 
      });

      return {
        status: 'complete',
        metrics,
        summary: data.data.summary,
        testId: data.data.testId
      };

    } catch (error) {
      logger.error('Failed to poll WebPageTest results', { 
        jsonUrl, 
        error: error.message 
      });
      return null;
    }
  }

  /**
   * Extract Lighthouse opportunities for optimization
   * @param {Object} lhr - Lighthouse results
   * @returns {Array} - Array of optimization opportunities
   */
  extractLighthouseOpportunities(lhr) {
    const opportunities = [];
    const auditKeys = [
      'unused-css-rules',
      'unused-javascript',
      'render-blocking-resources',
      'uses-optimized-images',
      'uses-webp-images',
      'offscreen-images',
      'reduce-unused-css',
      'minify-css',
      'minify-js'
    ];

    auditKeys.forEach(key => {
      const audit = lhr.audits[key];
      if (audit && audit.details && audit.details.overallSavingsMs > 0) {
        opportunities.push({
          id: key,
          title: audit.title,
          description: audit.description,
          savingsMs: audit.details.overallSavingsMs,
          savingsBytes: audit.details.overallSavingsBytes || 0
        });
      }
    });

    return opportunities;
  }

  /**
   * Extract Lighthouse diagnostics
   * @param {Object} lhr - Lighthouse results
   * @returns {Array} - Array of diagnostic information
   */
  extractLighthouseDiagnostics(lhr) {
    const diagnostics = [];
    const diagnosticKeys = [
      'total-blocking-time',
      'cumulative-layout-shift',
      'server-response-time',
      'interactive',
      'mainthread-work-breakdown'
    ];

    diagnosticKeys.forEach(key => {
      const audit = lhr.audits[key];
      if (audit) {
        diagnostics.push({
          id: key,
          title: audit.title,
          description: audit.description,
          displayValue: audit.displayValue,
          numericValue: audit.numericValue,
          score: audit.score
        });
      }
    });

    return diagnostics;
  }

  /**
   * Run all external analyses
   * @param {string} url - URL to analyze
   * @param {Object} options - Analysis options
   * @returns {Object} - Combined external analysis results
   */
  async runExternalAnalysis(url, options = {}) {
    try {
      logger.info('Starting external analysis', { url, options });

      // Run analyses in parallel where possible
      const [lighthouseResults, psiResults, wptResults] = await Promise.all([
        this.runLighthouse(url, options),
        this.runPageSpeedInsights(url),
        this.runWebPageTest(url)
      ]);

      // If WPT was triggered and we want to wait for results
      let wptMetrics = null;
      if (wptResults && wptResults.jsonUrl && options.waitForWPT) {
        // Wait a bit for test to start
        await new Promise(resolve => setTimeout(resolve, 10000));
        wptMetrics = await this.pollWebPageTestResults(wptResults.jsonUrl);
      }

      const results = {
        lighthouse: lighthouseResults,
        psi: psiResults,
        wpt: wptResults,
        wptMetrics: wptMetrics,
        timestamp: new Date().toISOString()
      };

      logger.info('External analysis completed', { 
        url,
        lighthouse: !!lighthouseResults,
        psi: !!psiResults,
        wpt: !!wptResults
      });

      return results;

    } catch (error) {
      logger.error('External analysis failed', { url, error: error.message });
      return {
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }
}

module.exports = ExternalAPIsService;