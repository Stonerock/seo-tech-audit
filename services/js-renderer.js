// services/js-renderer.js
// JavaScript renderer with Browserless.io integration for Cloud deployment

const { logger } = require('../utils/logger');
const fetch = require('node-fetch');

// Add Playwright import at the top
const { chromium } = require('playwright-core');

class JavaScriptRenderer {
    constructor() {
        // Security: Build endpoint from separate env vars, never expose token to client
        this.browserlessToken = process.env.BROWSERLESS_TOKEN || null;
        this.browserlessBaseUrl = process.env.BROWSERLESS_URL || 'https://chrome.browserless.io'; // Configurable endpoint
        this.useBrowserless = !!this.browserlessToken; // Use Browserless if we have a token
        
        // Local Playwright fallback
        this.browser = null;
        this.isInitialized = false;
        
        // Tuned timeouts for production stability
        this.maxPageAge = 30000; // 30 seconds max page lifetime
        this.requestTimeout = 60000; // 60 second timeout for complex pages
        this.maxRetries = 3; // Retry failed requests
        
        // Rate limiting and circuit breaker
        this.requestCount = 0;
        this.errorCount = 0;
        this.circuitOpen = false;
        this.lastErrorTime = 0;
        
        if (this.useBrowserless) {
            logger.info('Using Browserless.io for JavaScript rendering (production mode)');
        } else {
            logger.info('Using local Playwright for JavaScript rendering (development mode)');
        }
    }

    async initialize() {
        if (this.isInitialized && this.browser) {
            return;
        }

        try {
            logger.info('Initializing lightweight headless browser...');
            
            // Launch Chromium with optimized flags for serverless/lightweight usage
            this.browser = await chromium.launch({
                headless: true,
                args: [
                    '--headless=new',
                    '--disable-dev-shm-usage',
                    '--disable-background-timer-throttling',
                    '--disable-renderer-backgrounding',
                    '--no-sandbox',
                    '--no-zygote',
                    '--single-process',
                    '--js-flags=--lazy',
                    '--blink-settings=imagesEnabled=false',
                    '--disable-extensions',
                    '--disable-plugins',
                    '--disable-background-networking',
                    '--disable-background-timer-throttling',
                    '--disable-client-side-phishing-detection',
                    '--disable-default-apps',
                    '--disable-hang-monitor',
                    '--disable-popup-blocking',
                    '--disable-prompt-on-repost',
                    '--disable-sync',
                    '--disable-translate',
                    '--disable-ipc-flooding-protection',
                    '--memory-pressure-off',
                    '--max_old_space_size=256'
                ]
            });

            this.isInitialized = true;
            logger.info('Headless browser initialized successfully');
        } catch (error) {
            logger.error('Failed to initialize headless browser:', error);
            throw error;
        }
    }

    async renderPage(url, options = {}) {
        // Circuit breaker: if too many errors recently, fail fast
        if (this.circuitOpen) {
            const timeSinceLastError = Date.now() - this.lastErrorTime;
            if (timeSinceLastError < 60000) { // 1 minute circuit breaker
                throw new Error('Circuit breaker open: too many recent errors');
            } else {
                this.circuitOpen = false; // Reset circuit breaker
                this.errorCount = 0;
            }
        }

        // Rate limiting check
        this.requestCount++;
        logger.info(`JS rendering request #${this.requestCount} for ${url}`);

        if (this.useBrowserless) {
            return this.renderPageWithBrowserlessRetry(url, options);
        } else {
            return this.renderPageWithPlaywright(url, options);
        }
    }

    async renderPageWithBrowserlessRetry(url, options = {}) {
        let lastError;
        
        for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
            try {
                // Exponential backoff with jitter
                if (attempt > 1) {
                    const baseDelay = Math.pow(2, attempt - 1) * 100; // 100ms, 200ms, 400ms
                    const jitter = Math.random() * 100;
                    const delay = baseDelay + jitter;
                    logger.info(`Retry attempt ${attempt} after ${Math.round(delay)}ms`);
                    await new Promise(resolve => setTimeout(resolve, delay));
                }

                const result = await this.renderPageWithBrowserless(url, options);
                
                // Success: reset error tracking
                if (this.errorCount > 0) {
                    this.errorCount = 0;
                    logger.info('Error count reset after successful request');
                }
                
                return result;

            } catch (error) {
                lastError = error;
                this.errorCount++;
                this.lastErrorTime = Date.now();
                
                logger.warn(`Browserless attempt ${attempt} failed:`, error.message);
                
                // Open circuit breaker if too many errors
                if (this.errorCount >= 5) {
                    this.circuitOpen = true;
                    logger.error('Circuit breaker opened: too many consecutive errors');
                }

                // Don't retry on certain errors (rate limiting, auth errors)
                if (error.message.includes('429') || error.message.includes('401') || error.message.includes('403')) {
                    logger.error('Non-retryable error, failing immediately:', error.message);
                    break;
                }
            }
        }

        throw lastError || new Error('All retry attempts failed');
    }

    async renderPageWithBrowserless(url, options = {}) {
        const analysisType = options.includePerformance ? 'lighthouse' : 'content';
        
        try {
            logger.info(`Running ${analysisType} analysis for: ${url} (via Browserless.io)`);
            
            if (options.includePerformance) {
                return this.runLighthouseAnalysis(url, options);
            } else {
                return this.runContentAnalysis(url, options);
            }
        } catch (error) {
            logger.error(`Browserless.io ${analysisType} analysis failed for ${url}:`, error);
            throw error;
        }
    }

    async runContentAnalysis(url, options = {}) {
        const browserlessScript = `
            async ({ page }) => {
                // Set small viewport
                await page.setViewportSize({ width: 1200, height: 800 });
                
                // Block resource-heavy content for faster content analysis
                await page.route('**/*', (route) => {
                    const resourceType = route.request().resourceType();
                    const requestUrl = route.request().url();
                    
                    // Block images, fonts, media, stylesheets for content-only analysis
                    if (['image', 'font', 'media', 'stylesheet'].includes(resourceType)) {
                        return route.abort();
                    }
                    
                    // Block tracking URLs
                    const trackingPatterns = [
                        /google-analytics\\.com/,
                        /googletagmanager\\.com/,
                        /facebook\\.net/,
                        /doubleclick\\.net/,
                        /analytics/,
                        /tracking/
                    ];
                    if (trackingPatterns.some(pattern => pattern.test(requestUrl))) {
                        return route.abort();
                    }
                    
                    // Allow document, xhr, fetch, script
                    if (['document', 'xhr', 'fetch', 'script'].includes(resourceType)) {
                        return route.continue();
                    }
                    
                    route.abort();
                });

                // Navigate to page
                const response = await page.goto("${url}", {
                    waitUntil: 'domcontentloaded',
                    timeout: 15000
                });

                // Wait for JS execution
                await page.waitForTimeout(2000);

                // Analyze JavaScript usage
                const jsAnalysis = await page.evaluate(() => {
                    const frameworks = {
                        react: !!(window.React || document.querySelector('[data-reactroot]')),
                        vue: !!(window.Vue || document.querySelector('[data-server-rendered="true"]')),
                        angular: !!(window.angular || document.querySelector('[ng-app]')),
                        jquery: !!(window.jQuery || window.$),
                        nextjs: !!(window.__NEXT_DATA__),
                        spa: document.querySelector('div[id="app"], div[id="root"]') !== null
                    };

                    const scripts = document.querySelectorAll('script');
                    const scriptCount = {
                        inline: Array.from(scripts).filter(s => !s.src).length,
                        external: Array.from(scripts).filter(s => s.src).length,
                        total: scripts.length
                    };

                    return {
                        frameworks,
                        scriptCount,
                        isJSHeavy: scriptCount.external > 10 || Object.values(frameworks).some(Boolean)
                    };
                });

                // Get metrics
                const metrics = await page.evaluate(() => ({
                    dom: {
                        elementCount: document.querySelectorAll('*').length,
                        scriptTags: document.querySelectorAll('script').length
                    }
                }));

                return {
                    html: await page.content(),
                    jsMetrics: jsAnalysis,
                    metrics,
                    status: response?.status() || 200,
                    url: page.url(),
                    analysisType: 'content'
                };
            }
        `;

        return this.executeBrowserlessScript(browserlessScript);
    }

    async runLighthouseAnalysis(url, options = {}) {
        logger.info(`Running Lighthouse performance audit for: ${url}`);
        
        // Use Browserless Lighthouse endpoint for comprehensive analysis
        const lighthouseEndpoint = `${this.browserlessBaseUrl}/performance`;
        const headers = {
            'Content-Type': 'application/json',
        };

        if (this.browserlessToken) {
            headers['Authorization'] = `Bearer ${this.browserlessToken}`;
        }

        const lighthouseConfig = {
            url: url,
            options: {
                onlyCategories: ['performance', 'accessibility', 'best-practices', 'seo'],
                formFactor: options.mobile ? 'mobile' : 'desktop',
                screenEmulation: {
                    mobile: options.mobile || false,
                    width: options.mobile ? 375 : 1200,
                    height: options.mobile ? 667 : 800,
                    deviceScaleFactor: options.mobile ? 2 : 1
                },
                throttling: {
                    rttMs: options.throttling ? 150 : 0,
                    throughputKbps: options.throttling ? 1638.4 : 0,
                    cpuSlowdownMultiplier: options.throttling ? 4 : 1
                }
            }
        };

        const abortController = new AbortController();
        const timeoutId = setTimeout(() => abortController.abort(), this.requestTimeout);

        try {
            const response = await fetch(lighthouseEndpoint, {
                method: 'POST',
                headers,
                body: JSON.stringify(lighthouseConfig),
                signal: abortController.signal
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                throw new Error(`Lighthouse API error: ${response.status} ${response.statusText}`);
            }

            const lighthouseResult = await response.json();
            
            return {
                lighthouse: lighthouseResult,
                analysisType: 'lighthouse',
                url: url,
                status: 200
            };

        } catch (error) {
            clearTimeout(timeoutId);
            throw error;
        }
    }

    async executeBrowserlessScript(script) {
        const browserlessScript = script;

            // Security: Token in header, not query string (following DevOps best practices)
            const browserlessEndpoint = `${this.browserlessBaseUrl}/function`;
            const headers = {
                'Content-Type': 'application/json',
            };

            // Add authorization if we have a token
            if (this.browserlessToken) {
                headers['Authorization'] = `Bearer ${this.browserlessToken}`;
            }

            const requestBody = {
                code: browserlessScript,
                context: {
                    timeout: this.requestTimeout
                }
            };

            // Create AbortController for timeout handling
            const abortController = new AbortController();
            const timeoutId = setTimeout(() => abortController.abort(), this.requestTimeout);

            const response = await fetch(browserlessEndpoint, {
                method: 'POST',
                headers,
                body: JSON.stringify(requestBody),
                signal: abortController.signal
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                throw new Error(`Browserless API error: ${response.status} ${response.statusText}`);
            }

            const result = await response.json();
            logger.info('Browserless.io rendering completed successfully');
            return result;

        } catch (error) {
            logger.error(`Browserless.io rendering failed for ${url}:`, error);
            throw error;
        }
    }

    async renderPageWithPlaywright(url, options = {}) {
        await this.initialize();
        
        const page = await this.browser.newPage({
            viewport: { width: 1200, height: 800 }, // Small viewport
            userAgent: 'Mozilla/5.0 (compatible; SEO-Audit-Bot/1.0; +https://seo-audit.example.com/bot)'
        });

        try {
            // Set up request interception for resource blocking
            await page.route('**/*', (route) => {
                const resourceType = route.request().resourceType();
                const url = route.request().url();
                
                // Block resource-heavy content types
                if (['image', 'font', 'media', 'stylesheet'].includes(resourceType)) {
                    return route.abort();
                }
                
                // Block tracking and analytics
                if (this.isTrackingUrl(url)) {
                    return route.abort();
                }
                
                // Allow only document, xhr, fetch for first-party and essential CDNs
                if (['document', 'xhr', 'fetch', 'script'].includes(resourceType)) {
                    return route.continue();
                }
                
                route.abort();
            });

            // Set timeouts
            page.setDefaultTimeout(this.requestTimeout);
            page.setDefaultNavigationTimeout(this.requestTimeout);

            // Navigate to page
            logger.info(`Rendering JavaScript content for: ${url}`);
            const response = await page.goto(url, {
                waitUntil: 'domcontentloaded',
                timeout: this.requestTimeout
            });

            // Wait for potential dynamic content with short timeout
            await page.waitForTimeout(2000); // 2 second wait for JS execution

            // Try to detect if page uses significant JavaScript
            const jsMetrics = await this.analyzeJavaScriptUsage(page);

            // Get the rendered HTML
            const renderedHtml = await page.content();
            
            // Get page metrics
            const metrics = await this.getPageMetrics(page);

            return {
                html: renderedHtml,
                jsMetrics,
                metrics,
                status: response?.status() || 200,
                url: page.url()
            };

        } catch (error) {
            logger.error(`Failed to render page ${url}:`, error);
            throw error;
        } finally {
            await page.close().catch(() => {}); // Ensure cleanup
        }
    }

    async analyzeJavaScriptUsage(page) {
        try {
            const jsAnalysis = await page.evaluate(() => {
                // Detect common JS frameworks/libraries
                const frameworks = {
                    react: !!(window.React || document.querySelector('[data-reactroot]') || document.querySelector('[data-react-checksum]')),
                    vue: !!(window.Vue || document.querySelector('[data-server-rendered="true"]')),
                    angular: !!(window.angular || document.querySelector('[ng-app]') || document.querySelector('[ng-version]')),
                    jquery: !!(window.jQuery || window.$),
                    nextjs: !!(window.__NEXT_DATA__),
                    nuxt: !!(window.__NUXT__ || window.$nuxt),
                    spa: document.querySelector('div[id="app"], div[id="root"], div[id="__next"]') !== null
                };

                // Count script tags
                const scripts = document.querySelectorAll('script');
                const inlineScripts = Array.from(scripts).filter(s => !s.src).length;
                const externalScripts = Array.from(scripts).filter(s => s.src).length;

                // Check for dynamic content indicators
                const dynamicIndicators = {
                    hasLoadingSpinners: document.querySelector('.loading, .spinner, [class*="load"]') !== null,
                    hasSkeletonScreens: document.querySelector('.skeleton, [class*="skeleton"]') !== null,
                    hasLazyLoading: document.querySelector('[data-lazy], [loading="lazy"]') !== null,
                    hasAsyncContent: document.querySelector('[data-async], [data-fetch]') !== null
                };

                // Measure content differences
                const staticContentRatio = document.querySelectorAll('[data-ssr], [data-server-rendered]').length / Math.max(document.querySelectorAll('*').length, 1);

                return {
                    frameworks,
                    scriptCount: {
                        inline: inlineScripts,
                        external: externalScripts,
                        total: scripts.length
                    },
                    dynamicIndicators,
                    staticContentRatio,
                    isJSHeavy: externalScripts > 10 || inlineScripts > 5 || Object.values(frameworks).some(Boolean)
                };
            });

            return jsAnalysis;
        } catch (error) {
            logger.warn('Failed to analyze JavaScript usage:', error);
            return { isJSHeavy: false, error: error.message };
        }
    }

    async getPageMetrics(page) {
        try {
            const metrics = await page.evaluate(() => ({
                dom: {
                    elementCount: document.querySelectorAll('*').length,
                    textNodes: document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT).nextNode() ? 1 : 0,
                    scriptTags: document.querySelectorAll('script').length
                },
                timing: performance.timing ? {
                    domContentLoaded: performance.timing.domContentLoadedEventEnd - performance.timing.navigationStart,
                    loadComplete: performance.timing.loadEventEnd - performance.timing.navigationStart
                } : {}
            }));

            return metrics;
        } catch (error) {
            logger.warn('Failed to get page metrics:', error);
            return {};
        }
    }

    isTrackingUrl(url) {
        const trackingPatterns = [
            /google-analytics\.com/,
            /googletagmanager\.com/,
            /facebook\.net/,
            /doubleclick\.net/,
            /googlesyndication\.com/,
            /amazon-adsystem\.com/,
            /adsystem\.amazon/,
            /ads\.yahoo\.com/,
            /scorecardresearch\.com/,
            /quantserve\.com/,
            /outbrain\.com/,
            /taboola\.com/,
            /twitter\.com\/i\/adsct/,
            /analytics/,
            /tracking/,
            /telemetry/
        ];

        return trackingPatterns.some(pattern => pattern.test(url));
    }

    async close() {
        if (this.browser) {
            try {
                await this.browser.close();
                this.browser = null;
                this.isInitialized = false;
                logger.info('Headless browser closed');
            } catch (error) {
                logger.error('Error closing browser:', error);
            }
        }
    }

    // Health check for the renderer
    async healthCheck() {
        if (this.useBrowserless) {
            return this.healthCheckBrowserless();
        } else {
            return this.healthCheckPlaywright();
        }
    }

    async healthCheckBrowserless() {
        try {
            // Use the correct endpoint for Browserless stats
            const statsEndpoint = `${this.browserlessBaseUrl}/metrics`;
            const response = await fetch(statsEndpoint, {
                timeout: 5000,
                headers: this.browserlessToken ? {
                    'Authorization': `Bearer ${this.browserlessToken}`
                } : {}
            });
            
            return {
                status: response.ok ? 'healthy' : 'degraded',
                mode: 'browserless',
                endpoint: this.browserlessBaseUrl,
                hasToken: !!this.browserlessToken
            };
        } catch (error) {
            return {
                status: 'unhealthy',
                mode: 'browserless', 
                error: error.message
            };
        }
    }

    async healthCheckPlaywright() {
        try {
            await this.initialize();
            return {
                status: 'healthy',
                mode: 'playwright',
                browserConnected: !!this.browser?.isConnected(),
                initialized: this.isInitialized
            };
        } catch (error) {
            return {
                status: 'unhealthy',
                mode: 'playwright',
                error: error.message,
                initialized: false
            };
        }
    }
}

module.exports = JavaScriptRenderer;