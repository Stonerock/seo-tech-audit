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

    // Fast, lightweight audit that works without heavy dependencies
    async performLightweightAudit(url, options = {}) {
        const startTime = Date.now();
        logger.info(`Starting lightweight audit for: ${url}`);

        try {
            // Parallel execution of lightweight checks
            const [
                basicSeo,
                basicPerformance,
                basicAccessibility,
                basicFiles,
                basicMetadata
            ] = await Promise.allSettled([
                this.checkBasicSEO(url),
                this.checkBasicPerformance(url),
                this.checkBasicAccessibility(url),
                this.checkBasicFiles(url),
                this.checkBasicMetadata(url)
            ]);

            const results = {
                url,
                timestamp: new Date().toISOString(),
                executionTime: Date.now() - startTime,
                tests: {
                    seo: basicSeo.status === 'fulfilled' ? basicSeo.value : { error: basicSeo.reason?.message },
                    performance: basicPerformance.status === 'fulfilled' ? basicPerformance.value : { error: basicPerformance.reason?.message },
                    accessibility: basicAccessibility.status === 'fulfilled' ? basicAccessibility.value : { error: basicAccessibility.reason?.message },
                    files: basicFiles.status === 'fulfilled' ? basicFiles.value : { error: basicFiles.reason?.message },
                    metadata: basicMetadata.status === 'fulfilled' ? basicMetadata.value : { error: basicMetadata.reason?.message }
                },
                mode: 'lightweight'
            };

            logger.info(`Lightweight audit completed in ${results.executionTime}ms`);
            return results;

        } catch (error) {
            logger.error('Lightweight audit failed:', error);
            throw error;
        }
    }

    // Basic SEO check using only HTTP requests and cheerio
    async checkBasicSEO(url) {
        const fetch = require('node-fetch');
        const cheerio = require('cheerio');

        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 10000);

            const response = await fetch(url, { 
                signal: controller.signal,
                timeout: 10000,
                headers: { 
                    'User-Agent': 'SEO-Audit-Tool/2.1.0',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
                },
                size: 5 * 1024 * 1024 // 5MB limit
            });
            
            clearTimeout(timeoutId);

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const html = await response.text();
            const $ = cheerio.load(html);

            return {
                title: $('title').text().trim(),
                description: $('meta[name="description"]').attr('content') || '',
                h1Count: $('h1').length,
                h2Count: $('h2').length,
                internalLinks: $('a[href^="/"], a[href*="' + new URL(url).hostname + '"]').length,
                externalLinks: $('a[href^="http"]').not('[href*="' + new URL(url).hostname + '"]').length,
                images: $('img').length,
                imagesWithoutAlt: $('img:not([alt])').length,
                wordCount: $('body').text().split(/\\s+/).filter(word => word.length > 0).length,
                https: url.startsWith('https://'),
                canonical: $('link[rel="canonical"]').attr('href') || '',
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
    async checkBasicPerformance(url) {
        const fetch = require('node-fetch');
        
        try {
            const startTime = Date.now();
            const response = await fetch(url, { 
                timeout: 15000,
                headers: { 'User-Agent': 'SEO-Audit-Tool/2.1.0' }
            });
            const endTime = Date.now();
            const responseTime = endTime - startTime;
            
            const contentLength = parseInt(response.headers.get('content-length') || '0');
            
            return {
                responseTime,
                statusCode: response.status,
                contentLength,
                contentType: response.headers.get('content-type') || '',
                server: response.headers.get('server') || '',
                cacheControl: response.headers.get('cache-control') || '',
                compression: response.headers.get('content-encoding') || 'none',
                score: responseTime < 1000 ? 100 : responseTime < 2000 ? 80 : responseTime < 3000 ? 60 : 40
            };
        } catch (error) {
            throw new Error(`Performance check failed: ${error.message}`);
        }
    }

    // Basic accessibility check using cheerio
    async checkBasicAccessibility(url) {
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
                lang: $('html').attr('lang') || null
            };
        } catch (error) {
            throw new Error(`Accessibility check failed: ${error.message}`);
        }
    }

    // Check for basic files (robots.txt, sitemap.xml)
    async checkBasicFiles(url) {
        const fetch = require('node-fetch');
        const baseUrl = new URL(url).origin;

        try {
            const [robotsResponse, sitemapResponse] = await Promise.allSettled([
                fetch(`${baseUrl}/robots.txt`, { timeout: 5000 }),
                fetch(`${baseUrl}/sitemap.xml`, { timeout: 5000 })
            ]);

            return {
                robots: {
                    exists: robotsResponse.status === 'fulfilled' && robotsResponse.value.ok,
                    url: `${baseUrl}/robots.txt`
                },
                sitemap: {
                    exists: sitemapResponse.status === 'fulfilled' && sitemapResponse.value.ok,
                    url: `${baseUrl}/sitemap.xml`
                }
            };
        } catch (error) {
            throw new Error(`File check failed: ${error.message}`);
        }
    }

    // Basic metadata extraction
    async checkBasicMetadata(url) {
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
            if (description.length > 160) issues.push('Meta description too long (>160 chars)');

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

    // Enhanced audit that loads heavy dependencies on demand
    async performEnhancedAudit(url, options = {}) {
        logger.info(`Attempting enhanced audit for: ${url}`);
        
        try {
            // Try to load puppeteer for enhanced checks
            const puppeteer = await this.loadPuppeteer();
            
            if (puppeteer) {
                return await this.performPuppeteerAudit(url, options);
            } else {
                logger.info('Falling back to lightweight audit mode');
                return await this.performLightweightAudit(url, options);
            }
        } catch (error) {
            logger.warn('Enhanced audit failed, falling back to lightweight mode');
            return await this.performLightweightAudit(url, options);
        }
    }

    async performPuppeteerAudit(url, options = {}) {
        // Implementation for full Puppeteer-based audit
        // Only loads when puppeteer is available
        logger.info('Performing enhanced Puppeteer audit');
        // ... enhanced audit logic here
        return await this.performLightweightAudit(url, options); // Fallback for now
    }
}

module.exports = OptimizedAuditOrchestrator;