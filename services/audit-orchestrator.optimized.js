// services/audit-orchestrator.optimized.js
// Lightweight audit orchestrator with lazy loading of heavy dependencies

const { logger } = require('../utils/logger');

class OptimizedAuditOrchestrator {
    constructor() {
        this.puppeteer = null;
        this.lighthouse = null;
        this.aiAnalyzer = null;
        this.perfAnalyzer = null;
        this.botAnalyzer = null;
        this.eatAnalyzer = null; // E-A-T analysis for content authority
        this.jsRenderer = null; // Lightweight JavaScript renderer
        
        // Performance optimization settings
        this.requestCache = new Map();
        this.maxResponseSize = 3 * 1024 * 1024; // 3MB limit (reduced)
        this.requestTimeout = 8000; // 8 second timeout (improved for dynamic sites)
        this.maxRedirects = 2; // Reduced redirects
        this.cacheTimeout = 5 * 60 * 1000; // 5 minutes (longer cache)
        this.dynamicSiteTimeout = 15000; // 15 second timeout for suspected dynamic sites
    }

    // Shared HTML fetcher to avoid duplicate requests  
    async getPageContent(url) {
        const response = await this.makeOptimizedRequest(url);
        if (response.status >= 400) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        const cheerio = require('cheerio');
        return {
            html: response.body,
            $: cheerio.load(response.body),
            url: response.url,
            status: response.status,
            headers: response.headers
        };
    }

    // Optimized HTTP client with caching and limits
    async makeOptimizedRequest(url, options = {}) {
        const cacheKey = `${url}-${JSON.stringify(options)}`;
        
        // Check cache first
        if (this.requestCache.has(cacheKey)) {
            const cached = this.requestCache.get(cacheKey);
            if (Date.now() - cached.timestamp < this.cacheTimeout) {
                return cached.data;
            } else {
                this.requestCache.delete(cacheKey);
            }
        }
        
        try {
            const fetch = require('node-fetch');
            const response = await fetch(url, {
                timeout: options.adaptiveTimeout ? this.dynamicSiteTimeout : this.requestTimeout,
                redirect: 'manual',
                headers: {
                    'User-Agent': 'Mozilla/5.0 (compatible; AttentionBot/1.0; +https://attentionisallyouneed.app)',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                    'Accept-Language': 'en-US,en;q=0.5',
                    'Accept-Encoding': 'gzip, deflate',
                    'Cache-Control': 'no-cache',
                    ...options.headers
                },
                ...options
            });
            
            // Handle redirects efficiently
            if (response.status >= 300 && response.status < 400 && options.followRedirects !== false) {
                const location = response.headers.get('location');
                if (location && this.maxRedirects > 0) {
                    const absoluteUrl = new URL(location, url).href;
                    return await this.makeOptimizedRequest(absoluteUrl, { 
                        ...options, 
                        followRedirects: (options.followRedirects || this.maxRedirects) - 1 
                    });
                }
            }
            
            // Check content length before reading
            const contentLength = response.headers.get('content-length');
            if (contentLength && parseInt(contentLength) > this.maxResponseSize) {
                throw new Error(`Response too large: ${contentLength} bytes`);
            }
            
            const data = {
                status: response.status,
                statusText: response.statusText,
                headers: Object.fromEntries(response.headers.entries()),
                url: response.url,
                body: null
            };
            
            // Only read body if needed
            if (options.includeBody !== false) {
                const text = await response.text();
                if (text.length > this.maxResponseSize) {
                    data.body = text.substring(0, this.maxResponseSize);
                    data.truncated = true;
                } else {
                    data.body = text;
                }
            }
            
            // Cache successful responses
            if (response.status < 400) {
                this.requestCache.set(cacheKey, {
                    data,
                    timestamp: Date.now()
                });
            }
            
            return data;
        } catch (error) {
            if (error.name === 'AbortError' || error.code === 'ECONNABORTED') {
                // Provide more helpful error messages for dynamic sites
                const isDynamic = this.isDynamicSiteError(error);
                if (isDynamic) {
                    throw new Error(`Site appears to be JavaScript-heavy or dynamic. Static analysis may be incomplete. Consider enabling JavaScript rendering for full results.`);
                } else {
                    throw new Error(`Request timeout after ${this.requestTimeout}ms`);
                }
            }
            throw error;
        }
    }

    // Lazy load heavy dependencies only when needed
    async loadPuppeteer() {
        if (!this.puppeteer) {
            try {
                this.puppeteer = require('puppeteer-core');
            } catch (error) {
                logger.warn('Puppeteer not available, falling back to lightweight mode');
                return null;
            }
        }
        return this.puppeteer;
    }

    async loadLighthouse() {
        if (!this.lighthouse) {
            try {
                this.lighthouse = require('lighthouse');
            } catch (error) {
                logger.warn('Lighthouse not available, using basic performance metrics');
                return null;
            }
        }
        return this.lighthouse;
    }

    async loadJSRenderer() {
        if (!this.jsRenderer) {
            try {
                const JavaScriptRenderer = require('./js-renderer');
                this.jsRenderer = new JavaScriptRenderer();
            } catch (error) {
                logger.warn('JavaScript renderer not available:', error.message);
                return null;
            }
        }
        return this.jsRenderer;
    }

    // Detect if page likely needs JavaScript rendering based on static HTML
    detectJavaScriptNeed($, html) {
        const indicators = {
            // Framework indicators
            hasReact: !!(html.includes('data-reactroot') || html.includes('__REACT_DEVTOOLS_GLOBAL_HOOK__') || html.includes('React.')),
            hasVue: !!(html.includes('data-server-rendered') || html.includes('Vue.') || html.includes('v-if') || html.includes('v-for')),
            hasAngular: !!(html.includes('ng-app') || html.includes('ng-version') || html.includes('angular.') || html.includes('[ng-')),
            hasNext: !!html.includes('__NEXT_DATA__'),
            hasNuxt: !!html.includes('__NUXT__'),
            
            // SPA indicators
            hasSPARoot: !!($('#root, #app, #__next').length > 0),
            hasMinimalContent: $('body').text().trim().length < 500,
            
            // Script indicators  
            hasExternalScripts: $('script[src]').length > 5,
            hasInlineScripts: $('script:not([src])').length > 3,
            hasModuleScripts: $('script[type="module"]').length > 0,
            
            // Dynamic content indicators
            hasLoadingStates: !!(html.includes('loading') || html.includes('spinner') || html.includes('skeleton')),
            hasAsyncAttributes: $('[data-async], [data-fetch], [data-lazy]').length > 0,
            hasPlaceholders: $('.placeholder, [class*="placeholder"]').length > 0,
            
            // Meta indicators
            hasJSRequiredMeta: !!$('noscript').text().includes('JavaScript'),
            hasPreloadJS: $('link[rel="preload"][as="script"]').length > 0
        };

        // Calculate confidence score
        let jsNeedScore = 0;
        
        // Framework detection (high weight)
        if (indicators.hasReact || indicators.hasVue || indicators.hasAngular) jsNeedScore += 40;
        if (indicators.hasNext || indicators.hasNuxt) jsNeedScore += 35;
        
        // SPA indicators (high weight)
        if (indicators.hasSPARoot && indicators.hasMinimalContent) jsNeedScore += 30;
        
        // Script density (medium weight)
        if (indicators.hasExternalScripts) jsNeedScore += 20;
        if (indicators.hasModuleScripts) jsNeedScore += 15;
        if (indicators.hasInlineScripts) jsNeedScore += 10;
        
        // Dynamic content indicators (medium weight)
        if (indicators.hasLoadingStates) jsNeedScore += 15;
        if (indicators.hasAsyncAttributes) jsNeedScore += 10;
        if (indicators.hasPlaceholders) jsNeedScore += 10;
        
        // Meta indicators (low weight)
        if (indicators.hasJSRequiredMeta) jsNeedScore += 10;
        if (indicators.hasPreloadJS) jsNeedScore += 5;

        const confidence = jsNeedScore >= 50 ? 'high' : jsNeedScore >= 25 ? 'medium' : 'low';
        const needsJS = jsNeedScore >= 25;

        return {
            needsJS,
            confidence,
            score: Math.min(jsNeedScore, 100),
            indicators,
            recommendation: this.getJSRecommendation(jsNeedScore, indicators)
        };
    }

    getJSRecommendation(score, indicators) {
        if (score >= 50) {
            return 'JavaScript rendering strongly recommended - detected modern framework or SPA';
        } else if (score >= 25) {
            return 'JavaScript rendering may improve audit accuracy - detected dynamic content';
        } else {
            return 'Static HTML analysis sufficient - minimal JavaScript detected';
        }
    }

    // Helper to detect if errors are likely from dynamic sites
    isDynamicSiteError(error) {
        const errorMsg = error.message?.toLowerCase() || '';
        const errorCode = error.code || '';
        
        // Common patterns for dynamic sites that cause timeouts/stalls
        const dynamicIndicators = [
            'timeout',
            'econnaborted',
            'socket hang up',
            'network timeout',
            'request timeout',
            'connection timeout'
        ];
        
        return dynamicIndicators.some(indicator => 
            errorMsg.includes(indicator) || errorCode.includes(indicator.toUpperCase())
        );
    }

    // Fast, lightweight audit that works without heavy dependencies
    async performLightweightAudit(url, options = {}) {
        const startTime = Date.now();
        logger.info(`Starting lightweight audit for: ${url}`, { options });

        try {
            // Global timeout for entire audit - adaptive based on site complexity
            const globalTimeoutMs = options.fastMode ? 25000 : 45000;
            const auditTimeout = setTimeout(() => {
                throw new Error(`Audit timeout exceeded ${globalTimeoutMs / 1000} seconds`);
            }, globalTimeoutMs);

            // Parallel execution of lightweight checks with adaptive timeouts
            const auditOptions = { 
                ...options, 
                adaptiveTimeout: options.fastMode ? false : true // Use longer timeouts for non-fast mode
            };
            
            const checks = [
                this.checkBasicSEO(url, auditOptions),
                this.checkBasicPerformance(url, auditOptions),
                this.checkBasicAccessibility(url, auditOptions),
                this.checkBasicFiles(url, auditOptions),
                this.checkBasicMetadata(url, auditOptions),
                this.checkBasicSchema(url, auditOptions),
                this.checkEATSignals(url, auditOptions)
            ];

            // Add Lighthouse check if requested (but skip if too slow)
            if (options.includeLighthouse && !options.fastMode) {
                logger.info('Including Lighthouse performance audit');
                checks.push(this.checkLighthousePerformance(url));
            }

            // Add AEO (Answer Engine Optimization) analysis
            checks.push(this.checkAEOReadiness(url, auditOptions));

            const results = await Promise.allSettled(checks);
            clearTimeout(auditTimeout);

            const auditResults = {
                url,
                timestamp: new Date().toISOString(),
                executionTime: Date.now() - startTime,
                tests: {
                    seo: results[0].status === 'fulfilled' ? results[0].value : { error: results[0].reason?.message },
                    performance: results[1].status === 'fulfilled' ? results[1].value : { error: results[1].reason?.message },
                    accessibility: results[2].status === 'fulfilled' ? results[2].value : { error: results[2].reason?.message },
                    files: results[3].status === 'fulfilled' ? results[3].value : { error: results[3].reason?.message },
                    metadata: results[4].status === 'fulfilled' ? results[4].value : { error: results[4].reason?.message },
                    schema: results[5].status === 'fulfilled' ? results[5].value : { error: results[5].reason?.message },
                    eat: results[6].status === 'fulfilled' ? results[6].value : { error: results[6].reason?.message }
                },
                mode: options.includeLighthouse ? 'enhanced' : 'lightweight'
            };
            
            // Debug logging for mode and jsAnalysis
            console.log('[DEBUG] Lightweight audit results:', {
                mode: auditResults.mode,
                jsAnalysis: auditResults.tests.seo?.jsAnalysis || 'not set',
                seoStatus: results[0].status,
                hasTests: !!auditResults.tests,
                testsKeys: Object.keys(auditResults.tests)
            });

            // Add lighthouse results if available
            const lighthouseIndex = options.includeLighthouse ? 7 : -1;
            const aeoIndex = options.includeLighthouse ? 8 : 7;
            
            if (options.includeLighthouse && results[lighthouseIndex]) {
                auditResults.tests.lighthouse = results[lighthouseIndex].status === 'fulfilled' ? 
                    results[lighthouseIndex].value : { error: results[lighthouseIndex].reason?.message };
            }

            // Add AEO results
            if (results[aeoIndex]) {
                auditResults.tests.aeo = results[aeoIndex].status === 'fulfilled' ? 
                    results[aeoIndex].value : { error: results[aeoIndex].reason?.message };
            }

            // Add PageSpeed Insights data if API key is available and not in fast mode
            if (process.env.PAGESPEED_API_KEY && options.includePSI !== false && !options.fastMode) {
                logger.info('Adding PageSpeed Insights data to lightweight audit...');
                try {
                    const { PageSpeedInsights } = require('./pagespeed-insights');
                    const psi = new PageSpeedInsights();
                    const psiData = await psi.getInsights(url, {
                        categories: 'performance,seo,accessibility'
                    });
                    
                    if (psiData) {
                        auditResults.psiMetrics = psiData;
                        auditResults.tests.performance = {
                            ...auditResults.tests.performance,
                            psi: psiData.performance || null,
                            coreWebVitals: psiData.performance?.coreWebVitals || null
                        };
                        logger.info('PageSpeed Insights added to lightweight audit');
                    }
                } catch (psiError) {
                    logger.warn('PageSpeed Insights failed in lightweight audit:', psiError.message);
                }
            }

            logger.info(`${auditResults.mode} audit completed in ${auditResults.executionTime}ms`);
            return auditResults;

        } catch (error) {
            console.error('[AUDIT_FAIL] Lightweight audit failed:', {
                name: error?.name, 
                message: error?.message, 
                code: error?.code,
                stack: error?.stack?.split('\n').slice(0, 6),
                url: url,
                options: options
            });
            
            // Check if this is a dynamic site that needs different handling
            const isDynamic = this.isDynamicSiteError(error);
            if (isDynamic && !options.retryAttempt) {
                logger.info('Retrying with adaptive timeout for suspected dynamic site');
                try {
                    return await this.performLightweightAudit(url, {
                        ...options,
                        adaptiveTimeout: true,
                        retryAttempt: true
                    });
                } catch (retryError) {
                    logger.warn('Retry with adaptive timeout also failed');
                    // Enhance error message for dynamic sites
                    const enhancedError = new Error(
                        `Analysis failed: Site appears to be JavaScript-heavy or has slow loading times. ` +
                        `Static HTML analysis may be incomplete. Consider: 1) Enabling JavaScript rendering ` +
                        `if available, 2) Testing on a faster/simpler page, 3) Checking if the site ` +
                        `blocks our crawler (robots.txt or firewall).`
                    );
                    enhancedError.originalError = retryError;
                    enhancedError.isDynamicSite = true;
                    throw enhancedError;
                }
            }
            
            logger.error('Lightweight audit failed:', error);
            throw error;
        }
    }

    // Two-pass audit: Static first, then JavaScript rendering if needed
    async performTwoPassAudit(url, options = {}) {
        const startTime = Date.now();
        logger.info(`Starting two-pass audit for: ${url}`);

        try {
            // Phase 1: Static analysis (fast)
            logger.info('Phase 1: Static HTML analysis');
            const staticResults = await this.performLightweightAudit(url, { ...options, phase: 'static' });
            
            // Check if JavaScript rendering is needed
            const jsAnalysis = staticResults.tests.seo?.jsAnalysis;
            // Use JS rendering for medium+ confidence or when explicitly requested
            const shouldUseJS = (jsAnalysis?.needsJS && jsAnalysis.confidence !== 'low') || options.forceJS === true;
            
            logger.info(`JavaScript detection: needsJS=${jsAnalysis?.needsJS}, confidence=${jsAnalysis?.confidence}`);
            logger.info(`Recommendation: ${jsAnalysis?.recommendation}`);

            // Phase 2: JavaScript rendering (if needed and enabled)
            let jsResults = null;
            if (shouldUseJS && options.enableJS === true) {
                logger.info('Phase 2: JavaScript rendering analysis');
                
                const jsRenderer = await this.loadJSRenderer();
                if (jsRenderer) {
                    try {
                        // Enable Lighthouse for performance analysis when requested
                        const renderOptions = {
                            includePerformance: options.includeLighthouse !== false, // Default to true
                            includeScreenshot: options.includeScreenshot !== false,
                            timeout: options.timeout || 30000
                        };
                        const renderResult = await jsRenderer.renderPage(url, renderOptions);
                        
                        // Re-analyze with rendered content
                        const cheerio = require('cheerio');
                        const $js = cheerio.load(renderResult.html);
                        
                        // Run key analyses on JS-rendered content
                        jsResults = {
                            seo: await this.analyzeRenderedSEO($js, renderResult.html, url),
                            accessibility: await this.analyzeRenderedAccessibility($js),
                            schema: await this.analyzeRenderedSchema($js),
                            metrics: renderResult.metrics,
                            jsMetrics: renderResult.jsMetrics,
                            // Include Lighthouse performance data if available
                            lighthouse: renderResult.lighthouse || null,
                            screenshot: renderResult.screenshot || null,
                            analysisType: renderResult.analysisType || 'content'
                        };
                        
                        logger.info('JavaScript rendering completed successfully');
                    } catch (jsError) {
                        logger.warn('JavaScript rendering failed, using static results:', jsError.message);
                        jsResults = { error: jsError.message, fallbackToStatic: true };
                    }
                } else {
                    logger.warn('JavaScript renderer not available, using static results only');
                    jsResults = { error: 'JavaScript renderer not available', fallbackToStatic: true };
                }
            }

            // Combine results
            const combinedResults = {
                ...staticResults,
                timestamp: new Date().toISOString(),
                executionTime: Date.now() - startTime,
                mode: jsResults ? 'two-pass' : 'static-only',
                phases: {
                    static: {
                        completed: true,
                        executionTime: staticResults.executionTime
                    },
                    javascript: jsResults ? {
                        completed: !jsResults.error,
                        attempted: shouldUseJS,
                        recommendation: jsAnalysis?.recommendation,
                        error: jsResults.error,
                        executionTime: jsResults.error ? 0 : Date.now() - startTime - staticResults.executionTime
                    } : {
                        completed: false,
                        attempted: false,
                        skipped: !shouldUseJS ? 'not needed' : 'disabled'
                    }
                }
            };
            
            // Debug logging for two-pass audit
            console.log('[DEBUG] Two-pass audit results:', {
                mode: combinedResults.mode,
                jsAnalysis: jsAnalysis,
                shouldUseJS: shouldUseJS,
                jsResultsAvailable: !!jsResults,
                jsResultsError: jsResults?.error,
                staticResultsMode: staticResults.mode
            });

            // Merge JS results if available
            if (jsResults && !jsResults.error) {
                combinedResults.tests.jsRendered = jsResults;
                
                // Add Lighthouse performance data if available
                if (jsResults.lighthouse) {
                    combinedResults.tests.performance = {
                        ...combinedResults.tests.performance,
                        lighthouse: jsResults.lighthouse,
                        analysisType: 'lighthouse',
                        coreWebVitals: this.extractCoreWebVitals(jsResults.lighthouse),
                        scores: this.extractLighthouseScores(jsResults.lighthouse)
                    };
                }
                
                // Add screenshot if available
                if (jsResults.screenshot) {
                    combinedResults.artifacts = combinedResults.artifacts || {};
                    combinedResults.artifacts.screenshot = jsResults.screenshot;
                }
                
                // Update confidence indicators
                combinedResults.tests.seo.analysisMethod = 'hybrid';
                if (jsResults.seo) {
                    combinedResults.tests.seo.jsEnhanced = true;
                    combinedResults.tests.seo.differences = this.compareStaticVsJS(staticResults.tests.seo, jsResults.seo);
                }
            }

            // Add PageSpeed Insights data if API key is available and not in fast mode
            if (process.env.PAGESPEED_API_KEY && options.includePSI !== false && !options.fastMode) {
                logger.info('Fetching PageSpeed Insights data...');
                try {
                    const { PageSpeedInsights } = require('./pagespeed-insights');
                    const psi = new PageSpeedInsights();
                    const psiData = await psi.getInsights(url, {
                        categories: 'performance,seo,accessibility'
                    });
                    
                    if (psiData) {
                        combinedResults.psiMetrics = psiData;
                        combinedResults.tests.performance = {
                            ...combinedResults.tests.performance,
                            psi: psiData.performance || null,
                            coreWebVitals: psiData.performance?.coreWebVitals || null
                        };
                        logger.info('PageSpeed Insights data added successfully');
                    }
                } catch (psiError) {
                    logger.warn('PageSpeed Insights failed:', psiError.message);
                }
            }

            logger.info(`Two-pass audit completed in ${combinedResults.executionTime}ms`);
            return combinedResults;

        } catch (error) {
            console.error('[AUDIT_FAIL] Two-pass audit failed:', {
                name: error?.name, 
                message: error?.message, 
                code: error?.code,
                stack: error?.stack?.split('\n').slice(0, 6),
                url: url,
                options: options
            });
            logger.error('Two-pass audit failed:', error);
            throw error;
        }
    }

    // Analyze SEO on JavaScript-rendered content
    async analyzeRenderedSEO($, html, url) {
        const title = $('title').text().trim();
        const description = $('meta[name="description"]').attr('content') || '';
        const h1Count = $('h1').length;
        const h2Count = $('h2').length;
        const wordCount = $('body').text().split(/\\s+/).filter(word => word.length > 0).length;
        
        return {
            title,
            description,
            h1Count,
            h2Count,
            wordCount,
            method: 'js-rendered'
        };
    }

    // Analyze accessibility on JavaScript-rendered content
    async analyzeRenderedAccessibility($) {
        const images = $('img').length;
        const imagesWithoutAlt = $('img:not([alt])').length;
        const hasLang = $('html[lang]').length > 0;
        
        return {
            images,
            imagesWithoutAlt,
            hasLang,
            method: 'js-rendered'
        };
    }

    // Analyze schema on JavaScript-rendered content
    async analyzeRenderedSchema($) {
        const jsonLdScripts = $('script[type="application/ld+json"]');
        const totalSchemas = jsonLdScripts.length;
        
        return {
            totalSchemas,
            jsonLdCount: totalSchemas,
            method: 'js-rendered'
        };
    }

    // Compare static vs JavaScript-rendered results
    compareStaticVsJS(staticSEO, jsSEO) {
        const differences = [];
        
        if (staticSEO.title !== jsSEO.title) {
            differences.push({
                field: 'title',
                static: staticSEO.title,
                jsRendered: jsSEO.title,
                significance: 'high'
            });
        }
        
        if (staticSEO.h1Count !== jsSEO.h1Count) {
            differences.push({
                field: 'h1Count',
                static: staticSEO.h1Count,
                jsRendered: jsSEO.h1Count,
                significance: 'medium'
            });
        }
        
        if (Math.abs(staticSEO.wordCount - jsSEO.wordCount) > 100) {
            differences.push({
                field: 'wordCount',
                static: staticSEO.wordCount,
                jsRendered: jsSEO.wordCount,
                significance: 'high'
            });
        }
        
        return differences;
    }

    // Basic SEO check using optimized HTTP client
    async checkBasicSEO(url, options = {}) {
        const cheerio = require('cheerio');

        try {
            const response = await this.makeOptimizedRequest(url, { 
                adaptiveTimeout: options.adaptiveTimeout 
            });
            
            if (response.status >= 400) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const html = response.body;
            const $ = cheerio.load(html);

            const title = $('title').text().trim();
            const description = $('meta[name="description"]').attr('content') || '';
            const h1Count = $('h1').length;
            const h2Count = $('h2').length;
            const internalLinks = $('a[href^="/"], a[href*="' + new URL(url).hostname + '"]').length;
            const externalLinks = $('a[href^="http"]').not('[href*="' + new URL(url).hostname + '"]').length;
            const images = $('img').length;
            const imagesWithoutAlt = $('img:not([alt])').length;
            const wordCount = $('body').text().split(/\\s+/).filter(word => word.length > 0).length;
            const https = url.startsWith('https://');
            const canonical = $('link[rel="canonical"]').attr('href') || '';

            // Calculate SEO score based on best practices
            let score = 0;
            const scoreBreakdown = [];
            
            // Title (25 points)
            let titleScore = 0;
            if (title.length > 0) {
                if (title.length >= 30 && title.length <= 60) {
                    titleScore = 25;
                    scoreBreakdown.push({ factor: 'Title (optimal length)', points: 25, earned: 25 });
                } else if (title.length >= 20 && title.length <= 70) {
                    titleScore = 20;
                    scoreBreakdown.push({ factor: 'Title (good length)', points: 25, earned: 20 });
                } else {
                    titleScore = 10;
                    scoreBreakdown.push({ factor: 'Title (present but not optimal)', points: 25, earned: 10 });
                }
                score += titleScore;
            } else {
                scoreBreakdown.push({ factor: 'Title', points: 25, earned: 0 });
            }
            
            // Meta description (20 points) - Any description is good
            if (description.length > 0) {
                score += 20;
                scoreBreakdown.push({ factor: 'Meta description', points: 20, earned: 20 });
            } else {
                scoreBreakdown.push({ factor: 'Meta description', points: 20, earned: 0 });
            }
            
            // H1 structure (20 points) - Modern HTML5 allows multiple H1s
            if (h1Count > 0) {
                score += 20;
                scoreBreakdown.push({ factor: 'H1 heading structure', points: 20, earned: 20 });
            } else {
                scoreBreakdown.push({ factor: 'H1 heading structure', points: 20, earned: 0 });
            }
            
            // H2 structure (10 points)
            if (h2Count > 0) {
                score += 10;
                scoreBreakdown.push({ factor: 'H2 subheading structure', points: 10, earned: 10 });
            } else {
                scoreBreakdown.push({ factor: 'H2 subheading structure', points: 10, earned: 0 });
            }
            
            // HTTPS (10 points)
            if (https) {
                score += 10;
                scoreBreakdown.push({ factor: 'HTTPS encryption', points: 10, earned: 10 });
            } else {
                scoreBreakdown.push({ factor: 'HTTPS encryption', points: 10, earned: 0 });
            }
            
            // Internal linking (5 points)
            if (internalLinks > 0) {
                score += 5;
                scoreBreakdown.push({ factor: 'Internal linking', points: 5, earned: 5 });
            } else {
                scoreBreakdown.push({ factor: 'Internal linking', points: 5, earned: 0 });
            }
            
            // Content length (5 points)
            if (wordCount > 300) {
                score += 5;
                scoreBreakdown.push({ factor: 'Content length', points: 5, earned: 5 });
            } else {
                scoreBreakdown.push({ factor: 'Content length', points: 5, earned: 0 });
            }
            
            // Canonical URL (5 points)
            if (canonical) {
                score += 5;
                scoreBreakdown.push({ factor: 'Canonical URL', points: 5, earned: 5 });
            } else {
                scoreBreakdown.push({ factor: 'Canonical URL', points: 5, earned: 0 });
            }

            // JavaScript detection analysis
            const jsAnalysis = this.detectJavaScriptNeed($, html);

            return {
                title,
                description,
                h1Count,
                h2Count,
                internalLinks,
                externalLinks,
                images,
                imagesWithoutAlt,
                wordCount,
                https,
                canonical,
                score, // Add calculated score
                scoreBreakdown, // Add detailed scoring breakdown
                jsAnalysis, // Add JavaScript detection results
                og: {
                    title: $('meta[property="og:title"]').attr('content') || '',
                    description: $('meta[property="og:description"]').attr('content') || '',
                    image: $('meta[property="og:image"]').attr('content') || '',
                    url: $('meta[property="og:url"]').attr('content') || ''
                }
            };
        } catch (error) {
            throw new Error(`SEO check failed: ${error.message}`);
        }
    }

    // Basic performance check using simple HTTP metrics
    async checkBasicPerformance(url, options = {}) {
        try {
            const startTime = Date.now();
            const response = await this.makeOptimizedRequest(url, { includeBody: false });
            const endTime = Date.now();
            const responseTime = endTime - startTime;
            
            const contentLength = parseInt(response.headers['content-length'] || '0');
            
            return {
                responseTime,
                statusCode: response.status,
                contentLength,
                contentType: response.headers['content-type'] || '',
                server: response.headers['server'] || '',
                cacheControl: response.headers['cache-control'] || '',
                compression: response.headers['content-encoding'] || 'none',
                score: responseTime < 1000 ? 100 : responseTime < 2000 ? 80 : responseTime < 3000 ? 60 : 40,
                // Frontend-compatible structure
                metrics: {
                    firstContentfulPaint: responseTime * 0.6, // Estimate FCP as 60% of response time
                    loadComplete: responseTime,
                    resources: Math.ceil(contentLength / 10000) || 1, // Estimate resource count
                    memory: {
                        usedJSHeapSize: Math.round(contentLength / 1024 / 10) || 1 // Estimate memory usage
                    }
                },
                scores: {
                    overall: responseTime < 1500 ? 'good' : responseTime < 3000 ? 'needs-improvement' : 'poor',
                    fcp: responseTime < 1800 ? 'good' : responseTime < 3000 ? 'needs-improvement' : 'poor',
                    loadTime: responseTime < 3000 ? 'good' : responseTime < 5000 ? 'needs-improvement' : 'poor'
                }
            };
        } catch (error) {
            throw new Error(`Performance check failed: ${error.message}`);
        }
    }

    // Basic accessibility check using cheerio
    async checkBasicAccessibility(url, options = {}) {
        const fetch = require('node-fetch');
        const cheerio = require('cheerio');

        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 10000);

            const response = await fetch(url, { 
                signal: controller.signal,
                timeout: 10000,
                headers: { 'User-Agent': 'SEO-Audit-Tool/2.1.0' },
                size: 5 * 1024 * 1024 // 5MB limit
            });
            
            clearTimeout(timeoutId);
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const html = await response.text();
            const $ = cheerio.load(html);

            const issues = [];
            
            // Check for common accessibility issues
            if ($('img:not([alt])').length > 0) {
                issues.push(`${$('img:not([alt])').length} images missing alt text`);
            }
            
            if ($('input:not([label])').length > 0) {
                issues.push(`${$('input:not([label])').length} inputs without proper labels`);
            }
            
            if (!$('html').attr('lang')) {
                issues.push('Page language not specified');
            }

            return {
                issues,
                score: Math.max(0, 100 - (issues.length * 20)),
                imagesWithoutAlt: $('img:not([alt])').length,
                totalImages: $('img').length,
                hasLang: !!$('html').attr('lang'),
                lang: $('html').attr('lang') || null,
                // Frontend-compatible structure
                heuristics: {
                    images: {
                        percentage: $('img').length > 0 ? Math.round(($('img:not([alt])').length / $('img').length) * 100) : 0,
                        withoutAlt: $('img:not([alt])').length
                    },
                    headings: {
                        h1Count: $('h1').length
                    },
                    links: {
                        empty: $('a[href=""], a:not([href])').length
                    },
                    lang: $('html').attr('lang') || null
                }
            };
        } catch (error) {
            throw new Error(`Accessibility check failed: ${error.message}`);
        }
    }

    // Check for basic files (robots.txt, sitemap variants, etc.)
    async checkBasicFiles(url, options = {}) {
        const fetch = require('node-fetch');
        const baseUrl = new URL(url).origin;

        try {
            // Check multiple sitemap variants - many sites use sitemap_index.xml or other formats
            const sitemapVariants = [
                'sitemap.xml',
                'sitemap_index.xml', 
                'sitemap-index.xml',
                'sitemaps.xml',
                'sitemap1.xml'
            ];

            const [robotsResponse, rssResponse, llmsResponse] = await Promise.allSettled([
                fetch(`${baseUrl}/robots.txt`, { timeout: 5000 }),
                fetch(`${baseUrl}/rss.xml`, { timeout: 5000 }),
                fetch(`${baseUrl}/llms.txt`, { timeout: 5000 })
            ]);

            // Check sitemap variants in parallel
            const sitemapChecks = await Promise.allSettled(
                sitemapVariants.map(variant => 
                    fetch(`${baseUrl}/${variant}`, { timeout: 5000 })
                )
            );

            // Find first successful sitemap
            let sitemapResult = { exists: false, url: `${baseUrl}/sitemap.xml` };
            for (let i = 0; i < sitemapChecks.length; i++) {
                const check = sitemapChecks[i];
                if (check.status === 'fulfilled' && check.value.ok) {
                    sitemapResult = {
                        exists: true,
                        url: `${baseUrl}/${sitemapVariants[i]}`,
                        variant: sitemapVariants[i]
                    };
                    break;
                }
            }

            // Also check robots.txt for sitemap declarations
            if (!sitemapResult.exists && robotsResponse.status === 'fulfilled' && robotsResponse.value.ok) {
                try {
                    const robotsText = await robotsResponse.value.text();
                    const sitemapMatch = robotsText.match(/Sitemap:\s*(.+)/i);
                    if (sitemapMatch) {
                        const declaredSitemap = sitemapMatch[1].trim();
                        const checkDeclared = await fetch(declaredSitemap, { timeout: 5000 });
                        if (checkDeclared.ok) {
                            sitemapResult = {
                                exists: true,
                                url: declaredSitemap,
                                variant: 'declared-in-robots',
                                source: 'robots.txt'
                            };
                        }
                    }
                } catch (error) {
                    // Ignore robots.txt parsing errors
                }
            }

            // Analyze robots.txt content with bot policy analyzer
            let robotsAnalysis = {
                exists: robotsResponse.status === 'fulfilled' && robotsResponse.value.ok,
                url: `${baseUrl}/robots.txt`
            };

            if (robotsAnalysis.exists) {
                try {
                    if (!this.botAnalyzer) {
                        const BotPolicyAnalyzer = require('./bot-policy-analyzer');
                        this.botAnalyzer = new BotPolicyAnalyzer();
                    }
                    
                    const robotsText = await robotsResponse.value.text();
                    const botPolicyResults = await this.botAnalyzer.analyzeRobotsTxt(robotsText, baseUrl);
                    robotsAnalysis.botPolicyAnalysis = botPolicyResults;
                } catch (error) {
                    console.warn('Bot policy analysis failed:', error.message);
                }
            }

            return {
                robots: robotsAnalysis,
                sitemap: sitemapResult,
                rss: {
                    exists: rssResponse.status === 'fulfilled' && rssResponse.value.ok,
                    url: `${baseUrl}/rss.xml`
                },
                llms: {
                    exists: llmsResponse.status === 'fulfilled' && llmsResponse.value.ok,
                    url: `${baseUrl}/llms.txt`
                }
            };
        } catch (error) {
            throw new Error(`File check failed: ${error.message}`);
        }
    }

    // Basic metadata extraction
    async checkBasicMetadata(url, options = {}) {
        const fetch = require('node-fetch');
        const cheerio = require('cheerio');

        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 10000);

            const response = await fetch(url, { 
                signal: controller.signal,
                timeout: 10000,
                headers: { 'User-Agent': 'SEO-Audit-Tool/2.1.0' },
                size: 5 * 1024 * 1024 // 5MB limit
            });
            
            clearTimeout(timeoutId);
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const html = await response.text();
            const $ = cheerio.load(html);

            const issues = [];
            const title = $('title').text().trim();
            const description = $('meta[name="description"]').attr('content') || '';

            if (!title) issues.push('Missing title tag');
            if (!description) issues.push('Missing meta description');
            if (title.length > 60) issues.push('Title tag too long (>60 chars)');
            // Removed: Google doesn't enforce strict meta description length limits

            return {
                title,
                description,
                canonical: $('link[rel="canonical"]').attr('href') || '',
                viewport: $('meta[name="viewport"]').attr('content') || '',
                robots: $('meta[name="robots"]').attr('content') || '',
                issues,
                og: {
                    title: $('meta[property="og:title"]').attr('content') || '',
                    description: $('meta[property="og:description"]').attr('content') || '',
                    image: $('meta[property="og:image"]').attr('content') || '',
                    url: $('meta[property="og:url"]').attr('content') || ''
                }
            };
        } catch (error) {
            throw new Error(`Metadata check failed: ${error.message}`);
        }
    }

    // Enhanced schema detection with business type analysis and AI-readiness scoring
    async checkBasicSchema(url, options = {}) {
        const fetch = require('node-fetch');
        const cheerio = require('cheerio');
        const path = require('path');

        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 10000);

            const response = await fetch(url, { 
                signal: controller.signal,
                timeout: 10000,
                headers: { 'User-Agent': 'SEO-Audit-Tool/2.1.0' },
                size: 5 * 1024 * 1024
            });
            
            clearTimeout(timeoutId);
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const html = await response.text();
            const $ = cheerio.load(html);

            // Load business types configuration
            const businessTypesConfig = require(path.join(__dirname, '../config/business-types.json'));

            const jsonLdScripts = $('script[type="application/ld+json"]');
            const microdataItems = $('[itemscope]');
            const types = [];
            const issues = [];
            const schemaData = []; // Store actual schema objects for field analysis

            // Enhanced JSON-LD parsing (tolerant to real-world markup)
            jsonLdScripts.each((i, script) => {
                try {
                    // Use text() to decode HTML entities like &quot; that break JSON.parse
                    const raw = ($(script).text() || '').trim();
                    if (!raw) return;

                    // Clean up content - strip HTML comments and CDATA wrappers
                    let cleaned = raw
                        .replace(/<!--[\s\S]*?-->/g, '')
                        .replace(/\/\*<!\[CDATA\[\*\//g, '')
                        .replace(/\/\*\]\]>\*\//g, '')
                        .trim();

                    // Try strict parse first
                    let parsed = null;
                    try {
                        parsed = JSON.parse(cleaned);
                    } catch (_) {
                        // Fallbacks:
                        // 1) Remove trailing commas
                        const noTrailingCommas = cleaned.replace(/,\s*([}\]])/g, '$1');
                        try {
                            parsed = JSON.parse(noTrailingCommas);
                        } catch (_) {
                            // 2) Multiple root objects concatenated -> wrap as array
                            const asArray = `[${noTrailingCommas.replace(/}\s*{/, '},{')}]`;
                            try {
                                parsed = JSON.parse(asArray);
                            } catch (err) {
                                issues.push(`Invalid JSON-LD syntax: ${err.message.substring(0, 80)}`);
                            }
                        }
                    }

                    if (parsed) {
                        schemaData.push(parsed);
                        this.extractTypesFromJsonLd(parsed, types);
                    }
                } catch (e) {
                    issues.push(`JSON-LD processing error: ${e.message.substring(0, 80)}`);
                }
            });

            // Enhanced microdata parsing
            microdataItems.each((i, el) => {
                const itemType = $(el).attr('itemtype');
                if (itemType) {
                    // Extract type from schema.org URL
                    const typeMatch = itemType.match(/schema\.org\/(.+)$/);
                    if (typeMatch) {
                        types.push(typeMatch[1]);
                    } else {
                        // Fallback for other formats
                        const type = itemType.split('/').pop();
                        if (type) types.push(type);
                    }
                }
            });

            // Check for RDFa (less common but worth checking)
            const rdfa = $('[typeof], [property]').length;
            if (rdfa > 0) {
                $('[typeof]').each((i, el) => {
                    const typeOf = $(el).attr('typeof');
                    if (typeOf && typeOf.includes('schema.org')) {
                        const type = typeOf.split('/').pop();
                        if (type) types.push(type);
                    }
                });
            }

            const uniqueTypes = [...new Set(types)];

            // Detect business type (multilingual safe)
            const businessTypeResult = this.detectBusinessType(uniqueTypes, businessTypesConfig, $, url);

            // Analyze schema coverage for detected business type
            const schemaAnalysis = this.analyzeSchemaFields(schemaData, businessTypeResult.type, businessTypesConfig);

            // Calculate AI-readiness score based on schema coverage
            const aiReadinessScore = this.calculateAIReadinessScore(schemaAnalysis, businessTypeResult, businessTypesConfig);

            // Content validation - check for mismatches between schema and visible content
            const contentValidation = this.validateSchemaContentMatch(schemaData, $);

            // Basic validation
            if (uniqueTypes.length === 0) {
                issues.push('No structured data found');
            }
            
            // Add content validation issues
            issues.push(...contentValidation.issues);

            return {
                types: uniqueTypes,
                totalSchemas: types.length,
                jsonLdCount: jsonLdScripts.length,
                microdataCount: microdataItems.length,
                issues,
                // New AI-era fields
                businessType: businessTypeResult,
                schemaFields: schemaAnalysis.presentFields,
                missingFields: schemaAnalysis.missingFields,
                aiReadinessScore,
                fieldCoveragePercent: schemaAnalysis.coveragePercent,
                contentValidation: contentValidation,
                // Legacy score for backward compatibility
                score: aiReadinessScore
            };
        } catch (error) {
            throw new Error(`Schema check failed: ${error.message}`);
        }
    }

    // Detect business type from schema types (multilingual safe)
    detectBusinessType(schemaTypes, businessTypesConfig, $, url) {
        // Priority order: specific to general
        const businessTypeOrder = ['LocalBusiness', 'Product', 'SoftwareApplication', 'Organization', 'WebPage'];
        
        // Check schema-based detection first (multilingual safe)
        for (const businessType of businessTypeOrder) {
            const config = businessTypesConfig[businessType];
            if (config && config.identifyingSchemas) {
                const hasMatchingSchema = config.identifyingSchemas.some(schema => 
                    schemaTypes.some(type => type.includes(schema))
                );
                if (hasMatchingSchema) {
                    return {
                        type: businessType,
                        confidence: 'high',
                        method: 'schema',
                        detected: config.name
                    };
                }
            }
        }

        // Fallback: keyword-based detection (English-only, flagged)
        const pageText = $('title, h1, h2, meta[name="description"]').text().toLowerCase();
        for (const businessType of businessTypeOrder) {
            const config = businessTypesConfig[businessType];
            if (config && config.fallbackKeywords) {
                const keywordMatches = config.fallbackKeywords.filter(keyword => 
                    pageText.includes(keyword)
                ).length;
                
                if (keywordMatches >= 2) { // Require at least 2 keyword matches
                    return {
                        type: businessType,
                        confidence: 'medium',
                        method: 'keywords-en',
                        detected: config.name,
                        language: 'en',
                        scope: 'english-only'
                    };
                }
            }
        }

        // Default fallback
        return {
            type: 'WebPage',
            confidence: 'low',
            method: 'default',
            detected: 'General Website'
        };
    }

    // Analyze schema fields present vs required for business type
    analyzeSchemaFields(schemaData, businessTypeResult, businessTypesConfig) {
        const businessType = businessTypeResult;
        const requiredFields = businessTypesConfig[businessType]?.requiredFields || {};
        
        const presentFields = {};
        const missingFields = {};
        
        // Check each required field
        Object.keys(requiredFields).forEach(fieldPath => {
            const isPresent = this.isSchemaFieldPresent(schemaData, fieldPath);
            
            if (isPresent) {
                presentFields[fieldPath] = requiredFields[fieldPath]; // Store point value
            } else {
                missingFields[fieldPath] = requiredFields[fieldPath]; // Store point value
            }
        });

        const totalPossiblePoints = Object.values(requiredFields).reduce((sum, points) => sum + points, 0);
        const earnedPoints = Object.values(presentFields).reduce((sum, points) => sum + points, 0);
        const coveragePercent = totalPossiblePoints > 0 ? Math.round((earnedPoints / totalPossiblePoints) * 100) : 0;

        return {
            presentFields,
            missingFields,
            earnedPoints,
            totalPossiblePoints,
            coveragePercent
        };
    }

    // Check if a specific schema field is present in the data
    isSchemaFieldPresent(schemaData, fieldPath) {
        const pathParts = fieldPath.split('.');
        
        return schemaData.some(data => {
            return this.searchObjectForPath(data, pathParts, 0);
        });
    }

    // Recursively search object for field path
    searchObjectForPath(obj, pathParts, currentIndex) {
        if (!obj || typeof obj !== 'object') return false;
        if (currentIndex >= pathParts.length) return true;
        
        const currentPart = pathParts[currentIndex];
        
        // Handle arrays
        if (Array.isArray(obj)) {
            return obj.some(item => this.searchObjectForPath(item, pathParts, currentIndex));
        }
        
        // Check if current part exists in object
        if (obj[currentPart] !== undefined && obj[currentPart] !== null && obj[currentPart] !== '') {
            if (currentIndex === pathParts.length - 1) {
                return true; // Found the final field
            }
            return this.searchObjectForPath(obj[currentPart], pathParts, currentIndex + 1);
        }
        
        // Also check nested objects recursively
        return Object.values(obj).some(value => {
            if (typeof value === 'object') {
                return this.searchObjectForPath(value, pathParts, currentIndex);
            }
            return false;
        });
    }

    // Calculate AI-readiness score based on schema coverage
    calculateAIReadinessScore(schemaAnalysis, businessTypeResult, businessTypesConfig) {
        // Base score from schema field coverage
        let score = schemaAnalysis.coveragePercent;
        
        // Bonus for high-confidence business type detection
        if (businessTypeResult.confidence === 'high') {
            score += 5; // Schema-based detection bonus
        }
        
        // Penalty for English-only fallback detection
        if (businessTypeResult.method === 'keywords-en') {
            score -= 10; // Reduce confidence for language-dependent detection
        }
        
        return Math.max(0, Math.min(100, score));
    }

    // Helper function to recursively extract types from JSON-LD data
    extractTypesFromJsonLd(data, types) {
        if (!data) return;

        // Handle single object
        if (typeof data === 'object' && !Array.isArray(data)) {
            if (data['@type']) {
                // Handle array of types
                if (Array.isArray(data['@type'])) {
                    data['@type'].forEach(type => {
                        if (typeof type === 'string') {
                            types.push(type.replace('schema:', '').replace('http://schema.org/', '').replace('https://schema.org/', ''));
                        }
                    });
                } else if (typeof data['@type'] === 'string') {
                    types.push(data['@type'].replace('schema:', '').replace('http://schema.org/', '').replace('https://schema.org/', ''));
                }
            }

            // Recursively check nested objects, including @graph/mainEntity etc.
            Object.values(data).forEach(value => {
                if (typeof value === 'object') {
                    this.extractTypesFromJsonLd(value, types);
                }
            });
        }
        // Handle array of objects
        else if (Array.isArray(data)) {
            data.forEach(item => this.extractTypesFromJsonLd(item, types));
        }
    }

    // Enhanced audit that loads heavy dependencies on demand
    async performEnhancedAudit(url, options = {}) {
        logger.info(`Starting optimized audit for: ${url}`);
        
        // Skip Puppeteer for performance unless explicitly requested
        if (options.forcePuppeteer) {
            try {
                const puppeteer = await this.loadPuppeteer();
                if (puppeteer) {
                    logger.info('Using Puppeteer for enhanced audit');
                    return await this.performPuppeteerAudit(url, options);
                }
            } catch (error) {
                logger.warn('Puppeteer failed, using optimized lightweight mode');
            }
        }
        
        // Use optimized lightweight audit by default (faster)
        return await this.performLightweightAudit(url, options);
    }

    async performPuppeteerAudit(url, options = {}) {
        // Implementation for full Puppeteer-based audit
        // Only loads when puppeteer is available
        logger.info('Performing enhanced Puppeteer audit');
        // ... enhanced audit logic here
        return await this.performLightweightAudit(url, options); // Fallback for now
    }

    // Lighthouse performance check using optional dependency
    async checkLighthousePerformance(url) {
        try {
            const lighthouse = await this.loadLighthouse();
            if (!lighthouse) {
                logger.warn('Lighthouse not available, skipping performance audit');
                return {
                    error: 'Lighthouse not installed',
                    fallback: true,
                    message: 'Install lighthouse dependency for enhanced performance metrics'
                };
            }

            const chromeLauncher = require('chrome-launcher');
            
            // Launch Chrome
            const chrome = await chromeLauncher.launch({chromeFlags: ['--headless', '--no-sandbox', '--disable-gpu']});
            
            try {
                // Run Lighthouse
                const options = {
                    logLevel: 'error',
                    output: 'json',
                    onlyCategories: ['performance'],
                    port: chrome.port,
                };
                
                const runnerResult = await lighthouse.default ? 
                    await lighthouse.default(url, options) : 
                    await lighthouse(url, options);
                const report = runnerResult.lhr;
                
                // Extract key metrics
                const performance = report.categories.performance;
                const audits = report.audits;
                
                return {
                    score: Math.round(performance.score * 100),
                    metrics: {
                        firstContentfulPaint: audits['first-contentful-paint']?.displayValue || 'N/A',
                        largestContentfulPaint: audits['largest-contentful-paint']?.displayValue || 'N/A',
                        firstInputDelay: audits['max-potential-fid']?.displayValue || 'N/A',
                        cumulativeLayoutShift: audits['cumulative-layout-shift']?.displayValue || 'N/A',
                        speedIndex: audits['speed-index']?.displayValue || 'N/A',
                        totalBlockingTime: audits['total-blocking-time']?.displayValue || 'N/A'
                    },
                    opportunities: report.categories.performance.auditRefs
                        .filter(ref => audits[ref.id]?.details?.type === 'opportunity')
                        .map(ref => ({
                            title: audits[ref.id].title,
                            description: audits[ref.id].description,
                            score: audits[ref.id].score,
                            displayValue: audits[ref.id].displayValue
                        }))
                        .slice(0, 5), // Top 5 opportunities
                    diagnostics: report.categories.performance.auditRefs
                        .filter(ref => audits[ref.id]?.details?.type === 'diagnostic')
                        .map(ref => ({
                            title: audits[ref.id].title,
                            description: audits[ref.id].description,
                            score: audits[ref.id].score,
                            displayValue: audits[ref.id].displayValue
                        }))
                        .slice(0, 3) // Top 3 diagnostics
                };
            } finally {
                await chrome.kill();
            }
        } catch (error) {
            logger.warn('Lighthouse audit failed:', error.message);
            return {
                error: 'Lighthouse audit failed',
                message: error.message,
                fallback: true
            };
        }
    }

    // AEO (Answer Engine Optimization) readiness analysis - optimized
    async checkAEOReadiness(url, options = {}) {
        try {
            const pageContent = await this.getPageContent(url);
            const { $, html } = pageContent;

            // Detect language for scoping checks
            const language = this.detectPageLanguage($);
            const isEnglish = language === 'en';

            // 1. FAQ Detection (Schema-based - multilingual safe)
            const faqSchemaDetected = $('script[type="application/ld+json"]').toArray().some(script => {
                try {
                    const data = JSON.parse($(script).text());
                    return this.containsFAQSchema(data);
                } catch (e) {
                    return false;
                }
            });

            // 2. FAQ Pattern Detection (English-only)
            let faqPatternsFound = 0;
            let faqPatternsScope = 'multilingual-safe';
            
            if (isEnglish) {
                faqPatternsScope = 'english-only';
                const bodyText = $('body').text();
                
                // English FAQ patterns
                const faqPatterns = [
                    /\bQ:\s*(.+?)\s*A:/gi,
                    /\bQuestion:\s*(.+?)\s*Answer:/gi,
                    /\bFAQ/gi,
                    /\bFrequently Asked Questions/gi,
                    /\bQ&A/gi
                ];
                
                faqPatternsFound = faqPatterns.reduce((count, pattern) => {
                    const matches = bodyText.match(pattern) || [];
                    return count + matches.length;
                }, 0);
            }

            // 3. Enhanced Heading Structure Analysis (multilingual safe)
            // Extract detailed heading information for enhanced analysis
            const headingElements = [];
            $('h1, h2, h3, h4, h5, h6').each((i, el) => {
                headingElements.push({
                    level: parseInt(el.tagName.slice(1)),
                    text: $(el).text().trim(),
                    id: $(el).attr('id') || null
                });
            });

            // Use enhanced AI analyzer for detailed heading analysis
            if (!this.aiAnalyzer) {
                const AIContentAnalyzer = require('./ai-analyzer');
                this.aiAnalyzer = new AIContentAnalyzer();
            }
            
            const detailedHeadingAnalysis = this.aiAnalyzer.analyzeHeadingStructure(headingElements);
            
            // Basic counts for compatibility
            const headings = {
                h1: $('h1').length,
                h2: $('h2').length,
                h3: $('h3').length,
                h4: $('h4').length,
                h5: $('h5').length,
                h6: $('h6').length
            };

            const hasHierarchy = detailedHeadingAnalysis.details.hierarchyValid && headings.h1 > 0;
            const hierarchyDepth = detailedHeadingAnalysis.details.nestingDepth;

            // 4. List Structure Detection (multilingual safe)
            const lists = {
                unordered: $('ul').length,
                ordered: $('ol').length,
                total: $('ul, ol').length
            };

            // 5. Conversational Tone Analysis (English-only)
            let conversationalScore = 0;
            let conversationalScope = 'not-analyzed';
            
            if (isEnglish) {
                conversationalScope = 'english-only';
                conversationalScore = this.analyzeConversationalTone($);
            }

            // Calculate AEO Score
            const aeoScore = this.calculateAEOScore({
                faqSchemaDetected,
                faqPatternsFound,
                hasHierarchy,
                hierarchyDepth,
                listsTotal: lists.total,
                conversationalScore,
                isEnglish
            });

            return {
                score: aeoScore,
                language: language,
                faq: {
                    schemaDetected: faqSchemaDetected,
                    patternsFound: faqPatternsFound,
                    patternsScope: faqPatternsScope
                },
                headingStructure: {
                    hierarchy: hasHierarchy,
                    depth: hierarchyDepth,
                    counts: headings,
                    scope: 'multilingual-safe',
                    detailsAnalysis: detailedHeadingAnalysis.details,
                    analysisScore: detailedHeadingAnalysis.score,
                    analysisIssues: detailedHeadingAnalysis.issues,
                    analysisStrengths: detailedHeadingAnalysis.strengths
                },
                lists: {
                    ...lists,
                    scope: 'multilingual-safe'
                },
                conversationalTone: {
                    score: conversationalScore,
                    scope: conversationalScope
                },
                recommendations: this.generateAEORecommendations({
                    faqSchemaDetected,
                    faqPatternsFound,
                    hasHierarchy,
                    hierarchyDepth,
                    listsTotal: lists.total,
                    isEnglish
                })
            };

        } catch (error) {
            throw new Error(`AEO check failed: ${error.message}`);
        }
    }

    // Detect page language (simple heuristic)
    detectPageLanguage($) {
        const langAttr = $('html').attr('lang') || $('html').attr('xml:lang');
        if (langAttr) {
            return langAttr.toLowerCase().split('-')[0]; // e.g., 'en-US' -> 'en'
        }
        
        // Fallback: assume English for now (could be enhanced)
        return 'en';
    }

    // Check if schema data contains FAQ schema
    containsFAQSchema(data) {
        if (Array.isArray(data)) {
            return data.some(item => this.containsFAQSchema(item));
        }
        
        if (typeof data === 'object' && data !== null) {
            if (data['@type'] === 'FAQPage' || 
                (Array.isArray(data['@type']) && data['@type'].includes('FAQPage'))) {
                return true;
            }
            
            return Object.values(data).some(value => {
                if (typeof value === 'object') {
                    return this.containsFAQSchema(value);
                }
                return false;
            });
        }
        
        return false;
    }

    // Analyze conversational tone (English-only)
    analyzeConversationalTone($) {
        const bodyText = $('body').text();
        const sentences = bodyText.split(/[.!?]+/).filter(s => s.trim().length > 0);
        
        if (sentences.length === 0) return 0;
        
        let score = 0;
        
        // Average sentence length (shorter = more conversational)
        const avgSentenceLength = sentences.reduce((sum, s) => sum + s.trim().split(/\s+/).length, 0) / sentences.length;
        if (avgSentenceLength < 20) score += 25;
        else if (avgSentenceLength < 30) score += 15;
        
        // Personal pronouns (more = more conversational)
        const pronouns = /\b(you|your|we|our|us|I|my|me)\b/gi;
        const pronounMatches = bodyText.match(pronouns) || [];
        const pronounDensity = pronounMatches.length / bodyText.split(/\s+/).length;
        if (pronounDensity > 0.02) score += 25; // 2% density
        else if (pronounDensity > 0.01) score += 15;
        
        // Questions (more = more conversational)
        const questionMarks = (bodyText.match(/\?/g) || []).length;
        const questionDensity = questionMarks / sentences.length;
        if (questionDensity > 0.1) score += 25; // 10% of sentences are questions
        else if (questionDensity > 0.05) score += 15;
        
        // Contractions (more = more conversational)
        const contractions = /\b(don't|won't|can't|isn't|aren't|wasn't|weren't|hasn't|haven't|hadn't|doesn't|didn't|couldn't|shouldn't|wouldn't|mustn't|needn't|daren't|mayn't|oughtn't|mightn't|'ll|'re|'ve|'d|'m)\b/gi;
        const contractionMatches = bodyText.match(contractions) || [];
        if (contractionMatches.length > 5) score += 25;
        else if (contractionMatches.length > 2) score += 15;
        
        return Math.min(score, 100);
    }

    // Calculate overall AEO score
    calculateAEOScore(factors) {
        let score = 0;
        
        // FAQ Detection (40 points)
        if (factors.faqSchemaDetected) score += 40;
        else if (factors.faqPatternsFound > 0) score += Math.min(factors.faqPatternsFound * 10, 30);
        
        // Heading Structure (30 points)
        if (factors.hasHierarchy) score += 20;
        if (factors.hierarchyDepth > 2) score += 10;
        
        // Lists (20 points)
        if (factors.listsTotal > 0) score += 10;
        if (factors.listsTotal > 5) score += 10;
        
        // Conversational Tone (10 points - English only)
        if (factors.isEnglish) {
            score += Math.round(factors.conversationalScore * 0.1);
        } else {
            // For non-English, normalize score based on available factors
            score = Math.round(score * 1.11); // Adjust for missing 10% from tone
        }
        
        return Math.min(score, 100);
    }

    // Generate AEO recommendations
    generateAEORecommendations(factors) {
        const recommendations = [];
        
        if (!factors.faqSchemaDetected && factors.faqPatternsFound === 0) {
            recommendations.push({
                priority: 'high',
                title: 'Add FAQ content',
                description: 'Create FAQ section with structured data markup',
                scope: 'multilingual-safe'
            });
        }
        
        if (!factors.hasHierarchy) {
            recommendations.push({
                priority: 'medium',
                title: 'Improve heading structure',
                description: 'Use H1, H2, H3 hierarchy for better content organization',
                scope: 'multilingual-safe'
            });
        }
        
        if (factors.listsTotal === 0) {
            recommendations.push({
                priority: 'medium',
                title: 'Add structured lists',
                description: 'Use bullet points and numbered lists for scannable content',
                scope: 'multilingual-safe'
            });
        }
        
        if (factors.isEnglish && factors.conversationalScore < 50) {
            recommendations.push({
                priority: 'low',
                title: 'Make content more conversational',
                description: 'Use shorter sentences, personal pronouns, and questions',
                scope: 'english-only'
            });
        }
        
        return recommendations;
    }

    // Extract Core Web Vitals from Lighthouse results
    extractCoreWebVitals(lighthouseData) {
        try {
            const audits = lighthouseData.audits || lighthouseData.lhr?.audits || {};
            
            return {
                fcp: {
                    value: audits['first-contentful-paint']?.displayValue || 'N/A',
                    score: audits['first-contentful-paint']?.score || 0,
                    numericValue: audits['first-contentful-paint']?.numericValue || null
                },
                lcp: {
                    value: audits['largest-contentful-paint']?.displayValue || 'N/A',
                    score: audits['largest-contentful-paint']?.score || 0,
                    numericValue: audits['largest-contentful-paint']?.numericValue || null
                },
                cls: {
                    value: audits['cumulative-layout-shift']?.displayValue || 'N/A',
                    score: audits['cumulative-layout-shift']?.score || 0,
                    numericValue: audits['cumulative-layout-shift']?.numericValue || null
                },
                fid: {
                    value: audits['max-potential-fid']?.displayValue || 'N/A',
                    score: audits['max-potential-fid']?.score || 0,
                    numericValue: audits['max-potential-fid']?.numericValue || null
                },
                speedIndex: {
                    value: audits['speed-index']?.displayValue || 'N/A',
                    score: audits['speed-index']?.score || 0,
                    numericValue: audits['speed-index']?.numericValue || null
                },
                tbt: {
                    value: audits['total-blocking-time']?.displayValue || 'N/A',
                    score: audits['total-blocking-time']?.score || 0,
                    numericValue: audits['total-blocking-time']?.numericValue || null
                }
            };
        } catch (error) {
            logger.warn('Failed to extract Core Web Vitals:', error.message);
            return {};
        }
    }

    // Extract Lighthouse category scores
    extractLighthouseScores(lighthouseData) {
        try {
            const categories = lighthouseData.categories || lighthouseData.lhr?.categories || {};
            
            return {
                performance: Math.round((categories.performance?.score || 0) * 100),
                accessibility: Math.round((categories.accessibility?.score || 0) * 100),
                bestPractices: Math.round((categories['best-practices']?.score || 0) * 100),
                seo: Math.round((categories.seo?.score || 0) * 100),
                pwa: Math.round((categories.pwa?.score || 0) * 100)
            };
        } catch (error) {
            logger.warn('Failed to extract Lighthouse scores:', error.message);
            return {};
        }
    }

    // Validate schema content against visible page content
    validateSchemaContentMatch(schemaData, $) {
        const issues = [];
        const warnings = [];
        let validationScore = 100;

        if (!schemaData || schemaData.length === 0) {
            return { issues: [], warnings: [], score: 100, validItems: 0 };
        }

        // Get visible page content for comparison
        const pageTitle = $('title').text().trim();
        const pageDescription = $('meta[name="description"]').attr('content') || '';
        const visibleText = $('body').text().toLowerCase().trim();
        const headings = $('h1, h2, h3').map((i, el) => $(el).text().trim()).get().join(' ').toLowerCase();

        let validItems = 0;
        let totalChecks = 0;

        schemaData.forEach((schema, index) => {
            if (!schema) return;

            const schemaArray = Array.isArray(schema) ? schema : [schema];
            
            schemaArray.forEach((item) => {
                if (!item || typeof item !== 'object') return;

                // Validate common schema fields
                const schemaName = item.name || item.headline || item.title;
                const schemaDescription = item.description;
                const schemaAuthor = item.author?.name || item.author;

                // Check title/name consistency
                if (schemaName && pageTitle) {
                    totalChecks++;
                    const similarity = this.calculateStringSimilarity(
                        schemaName.toLowerCase().trim(), 
                        pageTitle.toLowerCase().trim()
                    );
                    if (similarity > 0.5) {
                        validItems++;
                    } else if (similarity < 0.2) {
                        issues.push(`Schema name "${schemaName}" doesn't match page title "${pageTitle}"`);
                        validationScore -= 15;
                    } else {
                        warnings.push(`Schema name partially matches page title (${Math.round(similarity * 100)}% similarity)`);
                        validationScore -= 5;
                    }
                }

                // Check description consistency
                if (schemaDescription && pageDescription) {
                    totalChecks++;
                    const similarity = this.calculateStringSimilarity(
                        schemaDescription.toLowerCase().trim(),
                        pageDescription.toLowerCase().trim()
                    );
                    if (similarity > 0.3) {
                        validItems++;
                    } else {
                        warnings.push(`Schema description may not match page meta description`);
                        validationScore -= 10;
                    }
                }

                // For FAQ schemas, check if questions exist on page
                if (item['@type'] === 'FAQPage' && item.mainEntity) {
                    const questions = Array.isArray(item.mainEntity) ? item.mainEntity : [item.mainEntity];
                    questions.forEach(q => {
                        if (q.name) {
                            totalChecks++;
                            const questionExists = visibleText.includes(q.name.toLowerCase()) || 
                                                 headings.includes(q.name.toLowerCase());
                            if (questionExists) {
                                validItems++;
                            } else {
                                issues.push(`FAQ question "${q.name}" not found in visible content`);
                                validationScore -= 10;
                            }
                        }
                    });
                }

                // For Organization schemas, check if organization name appears on page
                if (item['@type'] === 'Organization' && item.name) {
                    totalChecks++;
                    if (visibleText.includes(item.name.toLowerCase()) || 
                        pageTitle.toLowerCase().includes(item.name.toLowerCase())) {
                        validItems++;
                    } else {
                        warnings.push(`Organization name "${item.name}" not prominently displayed on page`);
                        validationScore -= 8;
                    }
                }
            });
        });

        return {
            issues: issues.slice(0, 5), // Limit to top 5 issues to avoid overwhelming
            warnings: warnings.slice(0, 3), // Limit to top 3 warnings
            score: Math.max(0, validationScore),
            validItems,
            totalChecks,
            matchPercentage: totalChecks > 0 ? Math.round((validItems / totalChecks) * 100) : 100
        };
    }

    // Simple string similarity calculation using Levenshtein distance
    calculateStringSimilarity(str1, str2) {
        const track = Array(str2.length + 1).fill(null).map(() =>
            Array(str1.length + 1).fill(null));
        
        for (let i = 0; i <= str1.length; i++) {
            track[0][i] = i;
        }
        for (let j = 0; j <= str2.length; j++) {
            track[j][0] = j;
        }
        
        for (let j = 1; j <= str2.length; j++) {
            for (let i = 1; i <= str1.length; i++) {
                const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
                track[j][i] = Math.min(
                    track[j][i - 1] + 1,
                    track[j - 1][i] + 1,
                    track[j - 1][i - 1] + indicator
                );
            }
        }
        
        const distance = track[str2.length][str1.length];
        const maxLength = Math.max(str1.length, str2.length);
        return maxLength === 0 ? 1 : (maxLength - distance) / maxLength;
    }

    // E-A-T (Expertise, Authoritativeness, Trustworthiness) analysis
    async checkEATSignals(url, options = {}) {
        try {
            // Lazy load E-A-T analyzer
            if (!this.eatAnalyzer) {
                const EATAnalyzer = require('./eat-analyzer');
                this.eatAnalyzer = new EATAnalyzer();
            }

            const response = await this.makeOptimizedRequest(url, { 
                adaptiveTimeout: options.adaptiveTimeout 
            });
            
            if (response.status >= 400) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const cheerio = require('cheerio');
            const $ = cheerio.load(response.body);

            // Get schema data for enhanced author analysis
            const jsonLdScripts = $('script[type="application/ld+json"]');
            const schemaData = [];
            
            jsonLdScripts.each((i, script) => {
                try {
                    const raw = $(script).text().trim();
                    if (raw) {
                        const parsed = JSON.parse(raw);
                        schemaData.push(parsed);
                    }
                } catch (e) {
                    // Skip invalid JSON-LD
                }
            });

            // Perform comprehensive E-A-T analysis
            const eatResults = await this.eatAnalyzer.analyzeEAT($, url, schemaData);

            return {
                ...eatResults,
                url,
                timestamp: new Date().toISOString()
            };

        } catch (error) {
            throw new Error(`E-A-T analysis failed: ${error.message}`);
        }
    }
}

// Server setup
if (require.main === module) {
    const express = require('express');
    const cors = require('cors');
    const app = express();
    const port = process.env.PORT || 3001;

    // CORS configuration - allow all origins for now
    app.use(cors({
        origin: true, // Allow all origins
        methods: ['GET', 'POST', 'OPTIONS', 'HEAD'],
        allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
        credentials: true
    }));
    
    app.use(express.json());
    
    // Add health check endpoint with CORS debugging
    app.get('/api/health-new', (req, res) => {
        console.log('Health check requested from origin:', req.headers.origin);
        res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
        res.header('Access-Control-Allow-Credentials', 'true');
        res.json({
            status: 'healthy',
            timestamp: new Date().toISOString(),
            uptime: process.uptime(),
            mode: 'optimized',
            memory: {
                used: `${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`,
                total: `${Math.round(process.memoryUsage().heapTotal / 1024 / 1024)}MB`
            },
            cors: {
                origin: req.headers.origin,
                method: req.method
            }
        });
    });

    const orchestrator = new OptimizedAuditOrchestrator();

    app.get('/api/audit', async (req, res) => {
        try {
            // Explicit CORS headers
            res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
            res.header('Access-Control-Allow-Credentials', 'true');
            
            const { url } = req.query;
            if (!url) {
                return res.status(400).json({ error: 'URL parameter is required' });
            }

            console.log(`Starting analysis for: ${url} from origin:`, req.headers.origin);
            const options = {
                includeLighthouse: req.query.lighthouse === 'true',
                fastMode: req.query.fast === 'true',
                forcePuppeteer: req.query.puppeteer === 'true'
            };
            const results = await orchestrator.performEnhancedAudit(url, options);
            res.json(results);
        } catch (error) {
            console.error('Audit error:', error);
            res.status(500).json({ error: error.message });
        }
    });

    app.listen(port, () => {
        console.log(`🚀 AI-Era SEO Audit API running on port ${port}`);
    });
}

module.exports = OptimizedAuditOrchestrator;