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
                basicMetadata,
                basicSchema
            ] = await Promise.allSettled([
                this.checkBasicSEO(url),
                this.checkBasicPerformance(url),
                this.checkBasicAccessibility(url),
                this.checkBasicFiles(url),
                this.checkBasicMetadata(url),
                this.checkBasicSchema(url)
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
                    metadata: basicMetadata.status === 'fulfilled' ? basicMetadata.value : { error: basicMetadata.reason?.message },
                    schema: basicSchema.status === 'fulfilled' ? basicSchema.value : { error: basicSchema.reason?.message }
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

    // Check for basic files (robots.txt, sitemap.xml)
    async checkBasicFiles(url) {
        const fetch = require('node-fetch');
        const baseUrl = new URL(url).origin;

        try {
            const [robotsResponse, sitemapResponse, rssResponse, llmsResponse] = await Promise.allSettled([
                fetch(`${baseUrl}/robots.txt`, { timeout: 5000 }),
                fetch(`${baseUrl}/sitemap.xml`, { timeout: 5000 }),
                fetch(`${baseUrl}/rss.xml`, { timeout: 5000 }),
                fetch(`${baseUrl}/llms.txt`, { timeout: 5000 })
            ]);

            return {
                robots: {
                    exists: robotsResponse.status === 'fulfilled' && robotsResponse.value.ok,
                    url: `${baseUrl}/robots.txt`
                },
                sitemap: {
                    exists: sitemapResponse.status === 'fulfilled' && sitemapResponse.value.ok,
                    url: `${baseUrl}/sitemap.xml`
                },
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

    // Basic schema detection
    async checkBasicSchema(url) {
        const fetch = require('node-fetch');
        const cheerio = require('cheerio');

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

            const jsonLdScripts = $('script[type="application/ld+json"]');
            const microdataItems = $('[itemscope]');
            const types = [];
            const issues = [];

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

            // Basic validation
            if (types.length === 0) {
                issues.push('No structured data found');
            }

            return {
                types: [...new Set(types)], // Remove duplicates
                totalSchemas: types.length,
                jsonLdCount: jsonLdScripts.length,
                microdataCount: microdataItems.length,
                issues,
                score: Math.max(0, Math.min(100, types.length > 0 ? (types.length * 20) + (100 - (issues.length * 15)) : 0))
            };
        } catch (error) {
            throw new Error(`Schema check failed: ${error.message}`);
        }
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