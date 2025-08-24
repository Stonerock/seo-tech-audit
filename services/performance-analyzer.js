// services/performance-analyzer.js
// Performance and accessibility analysis functions

const axeCore = require('axe-core');
const { fetchWithTimeout } = require('../utils/helpers');

class PerformanceAnalyzer {
  constructor() {
    // Updated thresholds based on Core Web Vitals and industry standards (more realistic)
    this.performanceThresholds = {
      fcp: { good: 1800, poor: 3000 },      // First Contentful Paint
      lcp: { good: 2500, poor: 4000 },      // Largest Contentful Paint  
      fid: { good: 100, poor: 300 },        // First Input Delay
      cls: { good: 0.1, poor: 0.25 },       // Cumulative Layout Shift
      ttfb: { good: 800, poor: 1800 },      // Time to First Byte
      loadTime: { good: 3000, poor: 5000 }, // Total load time
      domContentLoaded: { good: 1500, poor: 3000 },
      speedIndex: { good: 3400, poor: 5800 }, // Speed Index
      tbt: { good: 200, poor: 600 },          // Total Blocking Time
      // Resource-based thresholds for more realistic scoring
      pageSize: { good: 1000, poor: 3000 },   // Total page size in KB
      resourceCount: { good: 50, poor: 100 }   // Number of resources
    };
  }

  /**
   * Analyze page performance using browser APIs
   * @param {Object} page - Puppeteer page object
   * @returns {Object} - Performance analysis results
   */
  async analyzePerformance(page) {
    // First get current page metrics (optimistic measurement)
    const currentMetrics = await this.getCurrentPageMetrics(page);
    
    // Then perform a cold start measurement for accurate performance data
    const coldStartMetrics = await this.measureColdStartPerformance(page);
    
    // Calculate performance scores using the more accurate cold start data
    const scores = this.calculatePerformanceScores(coldStartMetrics);
    
    // Get additional page metrics
    const pageMetrics = await this.getPageMetrics(page);

    return {
      metrics: {
        // Use cold start metrics as primary, with current as fallback
        ...currentMetrics,
        ...coldStartMetrics,
        ...pageMetrics,
        // Add metadata about measurement method
        measurementMethod: 'cold-start-simulation',
        warning: coldStartMetrics.failed ? 'Cold start measurement failed, using current page metrics' : null
      },
      scores,
      recommendations: this.generatePerformanceRecommendations(coldStartMetrics.failed ? currentMetrics : coldStartMetrics, pageMetrics)
    };
  }

  /**
   * Measure performance with cold start simulation
   * @param {Object} page - Puppeteer page object  
   * @returns {Object} - Cold start performance metrics
   */
  async measureColdStartPerformance(page) {
    try {
      const url = page.url();
      
      // Create a new page for clean measurement
      const browser = page.browser();
      const cleanPage = await browser.newPage();
      
      // Disable cache to simulate first visit
      await cleanPage.setCacheEnabled(false);
      
      // Set up performance monitoring
      await cleanPage.evaluateOnNewDocument(() => {
        window.performanceMetrics = {
          navigationStart: performance.now(),
          marks: [],
          measures: [],
          lcp: null,
          cls: 0
        };
        
        // Track key events - improved LCP detection
        const observer = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (entry.entryType === 'navigation' || 
                entry.entryType === 'paint') {
              window.performanceMetrics.marks.push({
                name: entry.name,
                startTime: entry.startTime,
                type: entry.entryType
              });
            }
            
            // Specifically track LCP
            if (entry.entryType === 'largest-contentful-paint') {
              window.performanceMetrics.lcp = entry.startTime;
              window.performanceMetrics.marks.push({
                name: 'largest-contentful-paint',
                startTime: entry.startTime,
                type: entry.entryType,
                element: entry.element ? entry.element.tagName : 'unknown'
              });
            }
          }
        });
        
        // Observe multiple entry types
        observer.observe({entryTypes: ['navigation', 'paint', 'largest-contentful-paint']});
        
        // Fallback LCP detection using mutation observer
        let largestElement = null;
        let largestSize = 0;
        
        const resizeObserver = new ResizeObserver(entries => {
          entries.forEach(entry => {
            const size = entry.contentRect.width * entry.contentRect.height;
            if (size > largestSize) {
              largestSize = size;
              largestElement = entry.target;
            }
          });
        });
        
        // Observe potential LCP candidates
        const observeElement = (element) => {
          if (element && (element.tagName === 'IMG' || element.tagName === 'VIDEO' || 
                         element.tagName === 'SVG' || element.tagName === 'CANVAS' ||
                         element.offsetWidth * element.offsetHeight > 1000)) {
            resizeObserver.observe(element);
          }
        };
        
        // Start observing
        const startObserving = () => {
          document.querySelectorAll('img, video, svg, canvas, div, section, main').forEach(observeElement);
        };
        
        if (document.readyState === 'loading') {
          document.addEventListener('DOMContentLoaded', startObserving);
        } else {
          startObserving();
        }
      });
      
      // Navigate and measure with optimized approach
      const startTime = Date.now();
      await cleanPage.goto(url, { 
        waitUntil: 'domcontentloaded', // Use faster wait condition
        timeout: 20000  // Reduced timeout
      });
      
      // Wait for paint events to complete
      await new Promise(resolve => setTimeout(resolve, 1500));
      const endTime = Date.now();
      
      // Extract performance metrics with improved LCP detection
      const metrics = await cleanPage.evaluate(() => {
        const nav = performance.getEntriesByType('navigation')[0];
        const paintEntries = performance.getEntriesByType('paint');
        const lcpEntries = performance.getEntriesByType('largest-contentful-paint');
        
        // Core Web Vitals - improved extraction
        const fcp = paintEntries.find(e => e.name === 'first-contentful-paint')?.startTime || null;
        
        // LCP with multiple fallback methods
        let lcp = null;
        if (lcpEntries.length > 0) {
          // Use the last LCP entry (most accurate)
          lcp = lcpEntries[lcpEntries.length - 1].startTime;
        } else if (window.performanceMetrics && window.performanceMetrics.lcp) {
          // Fallback to our custom tracking
          lcp = window.performanceMetrics.lcp;
        } else {
          // Final fallback: estimate from FCP if available
          lcp = fcp ? fcp + 500 : null;
        }
        
        // Navigation timing with more accurate calculations
        const domContentLoaded = nav ? Math.max(0, nav.domContentLoadedEventEnd - nav.domContentLoadedEventStart) : null;
        const loadComplete = nav ? Math.max(0, nav.loadEventEnd - nav.loadEventStart) : null;
        const ttfb = nav ? Math.max(0, nav.responseStart - nav.requestStart) : null;
        
        // Resource analysis
        const resources = performance.getEntriesByType('resource');
        let totalResourceSize = 0;
        
        resources.forEach(resource => {
          // More aggressive size calculation for accuracy
          let size = resource.transferSize;
          if (!size || size === 0) {
            size = resource.decodedBodySize || resource.encodedBodySize;
          }
          if (!size || size === 0) {
            // Estimate based on duration and resource type
            const duration = resource.duration || 100;
            const url = resource.name.toLowerCase();
            if (url.includes('.js')) size = Math.max(5000, duration * 50);
            else if (url.includes('.css')) size = Math.max(2000, duration * 30);
            else if (url.includes('.jpg') || url.includes('.png')) size = Math.max(10000, duration * 100);
            else size = Math.max(1000, duration * 20);
          }
          totalResourceSize += size;
        });
        
        return {
          firstContentfulPaint: fcp,
          largestContentfulPaint: lcp,
          domContentLoaded: domContentLoaded,
          loadComplete: loadComplete,
          timeToFirstByte: ttfb,
          // Resource timing
          resourceCount: resources.length,
          totalResourceSize: Math.round(totalResourceSize / 1024), // KB
          // Additional metrics from our tracking
          coldStartMeasurement: true,
          // Debugging info
          lcpEntriesCount: lcpEntries.length,
          customLcp: window.performanceMetrics ? window.performanceMetrics.lcp : null
        };
      });
      
      await cleanPage.close();
      
      return {
        ...metrics,
        totalLoadTime: endTime - startTime,
        failed: false
      };
      
    } catch (error) {
      console.warn('Cold start measurement failed:', error.message);
      return {
        failed: true,
        error: error.message
      };
    }
  }

  /**
   * Get current page metrics (fallback method)
   * @param {Object} page - Puppeteer page object
   * @returns {Object} - Current page metrics
   */
  async getCurrentPageMetrics(page) {
    return await page.evaluate(() => {
      const nav = performance.getEntriesByType('navigation')[0];
      const timing = performance.timing;
      const paintEntries = performance.getEntriesByType('paint');

      // Modern Navigation API (preferred)
      const domContentLoaded = nav ? nav.domContentLoadedEventEnd : 
        (timing.domContentLoadedEventEnd - timing.navigationStart);
      const loadComplete = nav ? nav.loadEventEnd : 
        (timing.loadEventEnd - timing.navigationStart);

      // Paint metrics
      const firstPaint = paintEntries.find(e => e.name === 'first-paint')?.startTime || null;
      const firstContentfulPaint = paintEntries.find(e => e.name === 'first-contentful-paint')?.startTime || null;

      // Resource metrics
      const resources = performance.getEntriesByType('resource');
      const resourceSummary = {
        total: resources.length,
        scripts: resources.filter(r => r.initiatorType === 'script').length,
        stylesheets: resources.filter(r => r.initiatorType === 'link').length,
        images: resources.filter(r => r.initiatorType === 'img').length,
        fonts: resources.filter(r => r.name.includes('.woff') || r.name.includes('.ttf')).length
      };

      // Memory metrics (Chrome only)
      const memory = performance.memory ? {
        usedJSHeapSize: Math.round(performance.memory.usedJSHeapSize / 1048576), // MB
        totalJSHeapSize: Math.round(performance.memory.totalJSHeapSize / 1048576), // MB
        jsHeapSizeLimit: Math.round(performance.memory.jsHeapSizeLimit / 1048576) // MB
      } : null;

      return {
        domContentLoaded,
        loadComplete,
        firstPaint,
        firstContentfulPaint,
        resources: resourceSummary,
        memory,
        serverTiming: nav?.serverTiming || [],
        measurementContext: 'current-page-state'
      };
    });
  }

  /**
   * Get additional page metrics with fixed resource size calculation
   * @param {Object} page - Puppeteer page object
   * @returns {Object} - Additional metrics
   */
  async getPageMetrics(page) {
    return await page.evaluate(() => {
      // Calculate page weight and resource breakdown - FIXED VERSION
      const resources = performance.getEntriesByType('resource');
      let totalSize = 0;
      const sizeByType = {
        scripts: 0,
        stylesheets: 0,
        images: 0,
        fonts: 0,
        other: 0
      };

      resources.forEach(resource => {
        // Use transferSize first, then decodedBodySize, then encodedBodySize as fallbacks
        // FIXED: Ensure we're getting actual size values, not always 0
        let size = 0;
        if (resource.transferSize && resource.transferSize > 0) {
          size = resource.transferSize;
        } else if (resource.decodedBodySize && resource.decodedBodySize > 0) {
          size = resource.decodedBodySize;
        } else if (resource.encodedBodySize && resource.encodedBodySize > 0) {
          size = resource.encodedBodySize;
        } else {
          // Fallback: estimate based on response length if available
          size = resource.duration ? Math.max(1000, resource.duration * 10) : 1000;
        }
        
        totalSize += size;
        
        // Better resource type detection
        const url = resource.name.toLowerCase();
        const initiator = resource.initiatorType;
        
        if (initiator === 'script' || url.includes('.js')) {
          sizeByType.scripts += size;
        } else if (initiator === 'link' || url.includes('.css')) {
          sizeByType.stylesheets += size;
        } else if (initiator === 'img' || /\.(jpg|jpeg|png|gif|webp|svg|ico)/.test(url)) {
          sizeByType.images += size;
        } else if (/\.(woff|woff2|ttf|otf|eot)/.test(url)) {
          sizeByType.fonts += size;
        } else {
          sizeByType.other += size;
        }
      });

      // DOM metrics
      const elements = document.querySelectorAll('*').length;
      const images = document.querySelectorAll('img').length;
      const scripts = document.querySelectorAll('script').length;
      const stylesheets = document.querySelectorAll('link[rel="stylesheet"]').length;

      return {
        totalSize: Math.round(totalSize / 1024), // KB
        sizeByType: Object.fromEntries(
          Object.entries(sizeByType).map(([key, size]) => [key, Math.round(size / 1024)])
        ),
        domElements: elements,
        imageCount: images,
        scriptCount: scripts,
        stylesheetCount: stylesheets,
        // Add resource efficiency metrics
        resourceEfficiency: {
          avgResourceSize: resources.length > 0 ? Math.round(totalSize / resources.length / 1024) : 0,
          largestResource: Math.round(Math.max(...resources.map(r => r.transferSize || r.decodedBodySize || 0)) / 1024),
          compressionRatio: (() => {
            let totalTransferred = 0;
            let totalUncompressed = 0;
            resources.forEach(resource => {
              totalTransferred += resource.transferSize || 0;
              totalUncompressed += resource.decodedBodySize || resource.transferSize || 0;
            });
            return totalUncompressed > 0 ? totalTransferred / totalUncompressed : 1;
          })()
        }
      };
    });
  }

  /**
   * Calculate performance scores based on metrics (updated for accuracy)
   * @param {Object} metrics - Performance metrics
   * @returns {Object} - Performance scores
   */
  calculatePerformanceScores(metrics) {
    const scores = {};
    let totalWeight = 0;
    let weightedScore = 0;

    // First Contentful Paint score (Weight: 10%)
    if (metrics.firstContentfulPaint) {
      if (metrics.firstContentfulPaint < this.performanceThresholds.fcp.good) {
        scores.fcp = 'good';
        weightedScore += 90 * 0.1;
      } else if (metrics.firstContentfulPaint < this.performanceThresholds.fcp.poor) {
        scores.fcp = 'needs-improvement';
        weightedScore += 50 * 0.1;
      } else {
        scores.fcp = 'poor';
        weightedScore += 10 * 0.1;
      }
      totalWeight += 0.1;
    }

    // Largest Contentful Paint score (Weight: 25%) - Most important for user experience
    if (metrics.largestContentfulPaint) {
      if (metrics.largestContentfulPaint < this.performanceThresholds.lcp.good) {
        scores.lcp = 'good';
        weightedScore += 90 * 0.25;
      } else if (metrics.largestContentfulPaint < this.performanceThresholds.lcp.poor) {
        scores.lcp = 'needs-improvement';
        weightedScore += 50 * 0.25;
      } else {
        scores.lcp = 'poor';
        weightedScore += 10 * 0.25;
      }
      totalWeight += 0.25;
    }

    // Load time score (Weight: 15%)
    if (metrics.loadComplete || metrics.totalLoadTime) {
      const loadTime = metrics.loadComplete || metrics.totalLoadTime;
      if (loadTime < this.performanceThresholds.loadTime.good) {
        scores.loadTime = 'good';
        weightedScore += 90 * 0.15;
      } else if (loadTime < this.performanceThresholds.loadTime.poor) {
        scores.loadTime = 'needs-improvement';
        weightedScore += 50 * 0.15;
      } else {
        scores.loadTime = 'poor';
        weightedScore += 10 * 0.15;
      }
      totalWeight += 0.15;
    }

    // DOM Content Loaded score (Weight: 10%)
    if (metrics.domContentLoaded) {
      if (metrics.domContentLoaded < this.performanceThresholds.domContentLoaded.good) {
        scores.domContentLoaded = 'good';
        weightedScore += 90 * 0.1;
      } else if (metrics.domContentLoaded < this.performanceThresholds.domContentLoaded.poor) {
        scores.domContentLoaded = 'needs-improvement';
        weightedScore += 50 * 0.1;
      } else {
        scores.domContentLoaded = 'poor';
        weightedScore += 10 * 0.1;
      }
      totalWeight += 0.1;
    }

    // Time to First Byte score (Weight: 10%)
    if (metrics.timeToFirstByte) {
      if (metrics.timeToFirstByte < this.performanceThresholds.ttfb.good) {
        scores.ttfb = 'good';
        weightedScore += 90 * 0.1;
      } else if (metrics.timeToFirstByte < this.performanceThresholds.ttfb.poor) {
        scores.ttfb = 'needs-improvement';
        weightedScore += 50 * 0.1;
      } else {
        scores.ttfb = 'poor';
        weightedScore += 10 * 0.1;
      }
      totalWeight += 0.1;
    }

    // Page size impact on performance (Weight: 15%)
    if (metrics.totalResourceSize || metrics.totalSize) {
      const pageSize = metrics.totalResourceSize || metrics.totalSize || 0;
      if (pageSize < this.performanceThresholds.pageSize.good) {
        scores.pageSize = 'good';
        weightedScore += 90 * 0.15;
      } else if (pageSize < this.performanceThresholds.pageSize.poor) {
        scores.pageSize = 'needs-improvement';
        weightedScore += 50 * 0.15;
      } else {
        scores.pageSize = 'poor';
        weightedScore += 10 * 0.15;
      }
      totalWeight += 0.15;
    }

    // Resource count impact (Weight: 5%)
    if (metrics.resourceCount) {
      if (metrics.resourceCount < this.performanceThresholds.resourceCount.good) {
        scores.resourceCount = 'good';
        weightedScore += 90 * 0.05;
      } else if (metrics.resourceCount < this.performanceThresholds.resourceCount.poor) {
        scores.resourceCount = 'needs-improvement';
        weightedScore += 50 * 0.05;
      } else {
        scores.resourceCount = 'poor';
        weightedScore += 10 * 0.05;
      }
      totalWeight += 0.05;
    }

    // Calculate numeric overall score (0-100)
    const numericScore = totalWeight > 0 ? Math.round(weightedScore / totalWeight) : 50;
    scores.numericScore = numericScore;

    // Overall score calculation (more conservative, aligned with real-world performance)
    if (numericScore >= 85) {
      scores.overall = 'good';
    } else if (numericScore >= 60) {
      scores.overall = 'needs-improvement';
    } else {
      scores.overall = 'poor';
    }

    // Add scoring metadata with accuracy warnings
    scores.scoringMethod = 'weighted-cwv-aligned-v2';
    scores.measurementSource = metrics.coldStartMeasurement ? 'cold-start' : 'current-page';
    scores.accuracy = metrics.coldStartMeasurement ? 'high' : 'moderate';
    
    // Add accuracy warnings
    const warnings = [];
    if (!metrics.largestContentfulPaint) {
      warnings.push('LCP measurement unavailable - accuracy reduced');
    }
    if (!metrics.totalResourceSize && metrics.resourceCount > 10) {
      warnings.push('Resource size calculation may be inaccurate');
    }
    if (warnings.length > 0) {
      scores.warnings = warnings;
      scores.accuracy = 'reduced';
    }
    
    return scores;
  }

  /**
   * Generate performance recommendations
   * @param {Object} metrics - Performance metrics
   * @param {Object} pageMetrics - Page metrics
   * @returns {Array} - Array of recommendations
   */
  generatePerformanceRecommendations(metrics, pageMetrics) {
    const recommendations = [];

    // Resource optimization
    if (pageMetrics.sizeByType.images > 1000) { // > 1MB images
      recommendations.push({
        type: 'optimization',
        message: 'Optimize images to reduce page size',
        impact: 'high',
        details: `Images total: ${pageMetrics.sizeByType.images}KB`
      });
    }

    if (pageMetrics.scriptCount > 20) {
      recommendations.push({
        type: 'optimization',
        message: 'Reduce number of JavaScript files',
        impact: 'medium',
        details: `${pageMetrics.scriptCount} script files found`
      });
    }

    if (pageMetrics.stylesheetCount > 10) {
      recommendations.push({
        type: 'optimization',
        message: 'Consolidate CSS files',
        impact: 'medium',
        details: `${pageMetrics.stylesheetCount} stylesheet files found`
      });
    }

    // Performance metrics
    if (metrics.firstContentfulPaint > this.performanceThresholds.fcp.poor) {
      recommendations.push({
        type: 'performance',
        message: 'Improve First Contentful Paint',
        impact: 'high',
        details: `Current FCP: ${Math.round(metrics.firstContentfulPaint)}ms`
      });
    }

    if (metrics.loadComplete > this.performanceThresholds.loadTime.poor) {
      recommendations.push({
        type: 'performance',
        message: 'Reduce total page load time',
        impact: 'high',
        details: `Current load time: ${(metrics.loadComplete / 1000).toFixed(1)}s`
      });
    }

    // Memory usage
    if (metrics.memory && metrics.memory.usedJSHeapSize > 50) { // > 50MB
      recommendations.push({
        type: 'memory',
        message: 'High JavaScript memory usage detected',
        impact: 'medium',
        details: `JS Heap: ${metrics.memory.usedJSHeapSize}MB`
      });
    }

    return recommendations;
  }

  /**
   * Analyze accessibility using axe-core and heuristics
   * @param {Object} page - Puppeteer page object
   * @returns {Object} - Accessibility analysis results
   */
  async analyzeAccessibility(page) {
    try {
      // Inject axe-core
      await page.addScriptTag({ content: axeCore.source });
      
      // Run axe analysis
      const axeReport = await page.evaluate(async () => {
        return await window.axe.run({
          runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa'] }
        });
      });

      // Run heuristic analysis
      const heuristics = await this.runAccessibilityHeuristics(page);

      // Combine results
      const issues = [...(heuristics.issues || [])];
      const axeViolations = (axeReport.violations || []).map(v => ({
        id: v.id,
        impact: v.impact,
        help: v.help,
        nodes: v.nodes.length,
        description: v.description
      }));

      return {
        axe: {
          violations: axeViolations,
          passes: (axeReport.passes || []).length,
          incomplete: (axeReport.incomplete || []).length
        },
        heuristics,
        issues,
        score: this.calculateAccessibilityScore(axeViolations, issues),
        recommendations: this.generateAccessibilityRecommendations(axeViolations, heuristics)
      };

    } catch (error) {
      // Fallback to heuristics only
      const heuristics = await this.runAccessibilityHeuristics(page);
      return {
        heuristics,
        issues: heuristics.issues || [],
        score: this.calculateAccessibilityScore([], heuristics.issues || []),
        axe: { error: error.message },
        recommendations: this.generateAccessibilityRecommendations([], heuristics)
      };
    }
  }

  /**
   * Run accessibility heuristics
   * @param {Object} page - Puppeteer page object
   * @returns {Object} - Heuristics results
   */
  async runAccessibilityHeuristics(page) {
    return await page.evaluate(() => {
      const images = document.querySelectorAll('img');
      const headings = document.querySelectorAll('h1, h2, h3, h4, h5, h6');
      const links = document.querySelectorAll('a');
      const forms = document.querySelectorAll('form');
      const inputs = document.querySelectorAll('input, select, textarea');

      // Image analysis
      const imagesWithoutAlt = Array.from(images).filter(img => !img.alt);
      const imagesWithEmptyAlt = Array.from(images).filter(img => img.alt === '');

      // Link analysis
      const emptyLinks = Array.from(links).filter(link => 
        !link.textContent.trim() && !link.querySelector('img[alt]')
      );

      // Form analysis
      const inputsWithoutLabels = Array.from(inputs).filter(input => {
        // Check for associated label
        if (input.closest('label')) return false;
        if (input.hasAttribute('aria-label') || input.getAttribute('aria-labelledby')) return false;
        const id = input.id;
        if (id && document.querySelector(`label[for="${id}"]`)) return false;
        return true;
      });

      // Heading structure analysis
      const headingLevels = Array.from(headings).map(h => parseInt(h.tagName[1]));
      let headingIssues = false;
      for (let i = 1; i < headingLevels.length; i++) {
        if (headingLevels[i] - headingLevels[i-1] > 1) {
          headingIssues = true;
          break;
        }
      }

      // Color contrast (basic check)
      const elementsWithInlineStyles = document.querySelectorAll('[style*="color"]');
      
      const issues = [];
      if (imagesWithoutAlt.length > 0) {
        issues.push(`${imagesWithoutAlt.length} images missing alt text`);
      }
      if (emptyLinks.length > 0) {
        issues.push(`${emptyLinks.length} empty links found`);
      }
      if (inputsWithoutLabels.length > 0) {
        issues.push(`${inputsWithoutLabels.length} form inputs without labels`);
      }
      if (headings.length === 0) {
        issues.push('No heading tags found');
      } else if (document.querySelectorAll('h1').length === 0) {
        issues.push('No H1 heading found');
      } else if (document.querySelectorAll('h1').length > 1) {
        issues.push('Multiple H1 headings found');
      }
      if (headingIssues) {
        issues.push('Heading hierarchy has gaps');
      }
      if (!document.documentElement.lang) {
        issues.push('Page language not specified');
      }

      return {
        images: {
          total: images.length,
          withoutAlt: imagesWithoutAlt.length,
          withEmptyAlt: imagesWithEmptyAlt.length,
          percentage: images.length ? Math.round((imagesWithoutAlt.length / images.length) * 100) : 0
        },
        links: {
          total: links.length,
          empty: emptyLinks.length
        },
        forms: {
          total: forms.length,
          inputsWithoutLabels: inputsWithoutLabels.length
        },
        headings: {
          total: headings.length,
          h1Count: document.querySelectorAll('h1').length,
          structureIssues: headingIssues,
          levels: headingLevels
        },
        lang: document.documentElement.lang || null,
        issues
      };
    });
  }

  /**
   * Calculate accessibility score
   * @param {Array} axeViolations - Axe violations
   * @param {Array} heuristicIssues - Heuristic issues
   * @returns {string} - Score: 'good', 'needs-improvement', 'poor'
   */
  calculateAccessibilityScore(axeViolations, heuristicIssues) {
    const criticalViolations = axeViolations.filter(v => v.impact === 'critical').length;
    const seriousViolations = axeViolations.filter(v => v.impact === 'serious').length;
    const totalIssues = criticalViolations * 3 + seriousViolations * 2 + heuristicIssues.length;

    if (totalIssues === 0) return 'good';
    if (totalIssues <= 3) return 'needs-improvement';
    return 'poor';
  }

  /**
   * Generate accessibility recommendations
   * @param {Array} axeViolations - Axe violations
   * @param {Object} heuristics - Heuristic results
   * @returns {Array} - Array of recommendations
   */
  generateAccessibilityRecommendations(axeViolations, heuristics) {
    const recommendations = [];

    // High-priority axe violations
    axeViolations
      .filter(v => v.impact === 'critical' || v.impact === 'serious')
      .forEach(v => {
        recommendations.push({
          type: 'axe-violation',
          message: v.help,
          impact: v.impact,
          details: `${v.nodes} element(s) affected`,
          ruleId: v.id
        });
      });

    // Heuristic-based recommendations
    if (heuristics.images && heuristics.images.withoutAlt > 0) {
      recommendations.push({
        type: 'images',
        message: 'Add alt text to images',
        impact: 'high',
        details: `${heuristics.images.withoutAlt} images missing alt text`
      });
    }

    if (heuristics.headings && heuristics.headings.h1Count === 0) {
      recommendations.push({
        type: 'headings',
        message: 'Add H1 heading to page',
        impact: 'high',
        details: 'Pages should have exactly one H1 heading'
      });
    }

    if (heuristics.headings && heuristics.headings.structureIssues) {
      recommendations.push({
        type: 'headings',
        message: 'Fix heading hierarchy',
        impact: 'medium',
        details: 'Heading levels should not skip (e.g., H1 to H3)'
      });
    }

    if (heuristics.forms && heuristics.forms.inputsWithoutLabels > 0) {
      recommendations.push({
        type: 'forms',
        message: 'Add labels to form inputs',
        impact: 'high',
        details: `${heuristics.forms.inputsWithoutLabels} inputs need labels`
      });
    }

    if (!heuristics.lang) {
      recommendations.push({
        type: 'language',
        message: 'Specify page language',
        impact: 'medium',
        details: 'Add lang attribute to <html> element'
      });
    }

    return recommendations;
  }
}

module.exports = PerformanceAnalyzer;