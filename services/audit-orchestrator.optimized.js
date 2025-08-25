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
            const checks = [
                this.checkBasicSEO(url),
                this.checkBasicPerformance(url),
                this.checkBasicAccessibility(url),
                this.checkBasicFiles(url),
                this.checkBasicMetadata(url),
                this.checkBasicSchema(url)
            ];

            // Add Lighthouse check if requested
            if (options.includeLighthouse) {
                logger.info('Including Lighthouse performance audit');
                checks.push(this.checkLighthousePerformance(url));
            }

            const results = await Promise.allSettled(checks);

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
                    schema: results[5].status === 'fulfilled' ? results[5].value : { error: results[5].reason?.message }
                },
                mode: options.includeLighthouse ? 'enhanced' : 'lightweight'
            };

            // Add lighthouse results if available
            if (options.includeLighthouse && results[6]) {
                auditResults.tests.lighthouse = results[6].status === 'fulfilled' ? 
                    results[6].value : { error: results[6].reason?.message };
            }

            logger.info(`${auditResults.mode} audit completed in ${auditResults.executionTime}ms`);
            return auditResults;

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
            
            // Title (25 points)
            if (title.length > 0) {
                if (title.length >= 30 && title.length <= 60) score += 25;
                else if (title.length >= 20 && title.length <= 70) score += 20;
                else if (title.length > 0) score += 10;
            }
            
            // Meta description (20 points)
            if (description.length > 0) {
                if (description.length >= 120 && description.length <= 160) score += 20;
                else if (description.length >= 100 && description.length <= 180) score += 15;
                else if (description.length > 0) score += 10;
            }
            
            // H1 structure (20 points)
            if (h1Count === 1) score += 20;
            else if (h1Count > 1) score += 10;
            
            // H2 structure (10 points)
            if (h2Count > 0) score += 10;
            
            // HTTPS (10 points)
            if (https) score += 10;
            
            // Internal linking (5 points)
            if (internalLinks > 0) score += 5;
            
            // Content length (5 points)
            if (wordCount > 300) score += 5;
            
            // Canonical URL (5 points)
            if (canonical) score += 5;

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

    // Check for basic files (robots.txt, sitemap variants, etc.)
    async checkBasicFiles(url) {
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

            return {
                robots: {
                    exists: robotsResponse.status === 'fulfilled' && robotsResponse.value.ok,
                    url: `${baseUrl}/robots.txt`
                },
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

    // Enhanced schema detection with business type analysis and AI-readiness scoring
    async checkBasicSchema(url) {
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

            // Basic validation
            if (uniqueTypes.length === 0) {
                issues.push('No structured data found');
            }

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
}

module.exports = OptimizedAuditOrchestrator;