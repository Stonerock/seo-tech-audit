// server.optimized.js - Fast-starting SEO Audit Backend
// Optimized for cloud deployment with lazy loading

require('dotenv').config();

// Define missing globals for Node.js environment compatibility
if (typeof File === 'undefined') {
    // Define ReadableStream if not available
    if (typeof ReadableStream === 'undefined') {
        global.ReadableStream = class ReadableStream {
            constructor() {}
        };
    }
    
    global.File = class File {
        constructor(fileBits, fileName, options = {}) {
            this.name = fileName;
            this.type = options.type || '';
            this.size = fileBits ? (Array.isArray(fileBits) ? fileBits.reduce((acc, bit) => acc + (bit?.size || bit?.length || 0), 0) : fileBits.length || 0) : 0;
            this.lastModified = options.lastModified || Date.now();
        }
        
        // Add common File methods that libraries might expect
        slice(start, end, contentType) {
            return new File([], `${this.name}-slice`, { type: contentType || this.type });
        }
        
        stream() {
            return new ReadableStream();
        }
        
        arrayBuffer() {
            return Promise.resolve(new ArrayBuffer(0));
        }
        
        text() {
            return Promise.resolve('');
        }
    };
    
    // Also define Blob if needed
    if (typeof Blob === 'undefined') {
        global.Blob = class Blob {
            constructor(blobParts = [], options = {}) {
                this.type = options.type || '';
                this.size = blobParts ? blobParts.reduce((acc, part) => acc + (part?.size || part?.length || 0), 0) : 0;
            }
            
            slice(start, end, contentType) {
                return new Blob([], { type: contentType || this.type });
            }
            
            stream() {
                return new ReadableStream();
            }
            
            arrayBuffer() {
                return Promise.resolve(new ArrayBuffer(0));
            }
            
            text() {
                return Promise.resolve('');
            }
        };
    }
}

const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');

// Basic logging without heavy winston dependencies
const log = {
    info: (msg, ...args) => console.log(`[INFO] ${msg}`, ...args),
    warn: (msg, ...args) => console.warn(`[WARN] ${msg}`, ...args),
    error: (msg, ...args) => console.error(`[ERROR] ${msg}`, ...args)
};

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 8080;

// Security-hardened middleware
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? ['https://seo-audit-tool-e50.pages.dev', 'https://attentionisallyouneed.app']
    : ['http://localhost:3000', 'http://localhost:5173', 'http://localhost:8080'],
  credentials: true,
  maxAge: 86400, // 24 hours
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json({ limit: '2mb' })); // Reduced from 10mb
app.use(express.urlencoded({ extended: true, limit: '2mb' }));

// Serve static files
app.use(express.static('.', {
    index: false // Don't automatically serve index.html for all routes
}));

// Request logging middleware
app.use((req, res, next) => {
    log.info(`${req.method} ${req.path} - ${req.ip}`);
    next();
});

// Enhanced rate limiting with different limits for different endpoints
const generalLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 30, // General API calls
    message: { error: 'Too many requests, please try again later' },
    standardHeaders: true,
    legacyHeaders: false,
});

const auditLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute  
    max: 3, // Only 3 audit requests per minute - much more reasonable
    message: { error: 'Too many audit requests. Please wait before analyzing another URL.' },
    standardHeaders: true,
    legacyHeaders: false,
});

// Apply different rate limits
app.use('/api/health', generalLimiter);
app.use('/api/audit', auditLimiter);
app.use('/api/', generalLimiter);

// Lazy-loaded orchestrator
let orchestrator = null;
const getOrchestrator = () => {
    if (!orchestrator) {
        const OptimizedAuditOrchestrator = require('./services/audit-orchestrator.optimized');
        orchestrator = new OptimizedAuditOrchestrator();
        log.info('Audit orchestrator loaded');
    }
    return orchestrator;
};

// Health check endpoint (no dependencies needed)
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        mode: 'optimized',
        memory: {
            used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + 'MB',
            total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024) + 'MB'
        }
    });
});

// Input validation middleware
const validateAuditInput = (req, res, next) => {
    const { url, options = {} } = req.body;
    
    // URL validation
    if (!url) {
        return res.status(400).json({ 
            success: false,
            error: 'URL is required',
            code: 'MISSING_URL'
        });
    }

    if (typeof url !== 'string' || url.length > 2000) {
        return res.status(400).json({ 
            success: false,
            error: 'Invalid URL: must be a string under 2000 characters',
            code: 'INVALID_URL_FORMAT'
        });
    }

    // Validate URL format and protocol
    try {
        const urlObj = new URL(url);
        if (!['http:', 'https:'].includes(urlObj.protocol)) {
            return res.status(400).json({ 
                success: false,
                error: 'Invalid URL: only HTTP and HTTPS protocols are supported',
                code: 'INVALID_PROTOCOL'
            });
        }
        
        // Block localhost and private IPs in production
        if (process.env.NODE_ENV === 'production') {
            const hostname = urlObj.hostname.toLowerCase();
            if (hostname === 'localhost' || 
                hostname.startsWith('127.') || 
                hostname.startsWith('192.168.') || 
                hostname.startsWith('10.') ||
                hostname.startsWith('172.')) {
                return res.status(400).json({ 
                    success: false,
                    error: 'Private and local URLs are not allowed',
                    code: 'PRIVATE_URL_BLOCKED'
                });
            }
        }
    } catch (error) {
        return res.status(400).json({ 
            success: false,
            error: 'Invalid URL format',
            code: 'MALFORMED_URL'
        });
    }

    // Options validation
    if (options.timeout && (typeof options.timeout !== 'number' || options.timeout < 5000 || options.timeout > 60000)) {
        return res.status(400).json({ 
            success: false,
            error: 'Invalid timeout: must be between 5000 and 60000 milliseconds',
            code: 'INVALID_TIMEOUT'
        });
    }

    if (options.includeLighthouse && typeof options.includeLighthouse !== 'boolean') {
        return res.status(400).json({ 
            success: false,
            error: 'includeLighthouse must be a boolean',
            code: 'INVALID_OPTION'
        });
    }

    next();
};

// Main audit endpoint with timeout protection
app.post('/api/audit', validateAuditInput, async (req, res) => {
    const { url, options = {} } = req.body;

    const startTime = Date.now();
    const timeoutMs = 45000; // 45 second timeout
    
    try {
        log.info(`Starting audit for: ${url}`);
        
        // Race between audit and timeout
        const auditPromise = getOrchestrator().performLightweightAudit(url, options);
        const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Audit timeout')), timeoutMs)
        );
        
        const result = await Promise.race([auditPromise, timeoutPromise]);
        
        log.info(`Audit completed in ${Date.now() - startTime}ms`);
        res.json(result);
        
    } catch (error) {
        log.error(`Audit failed for ${url}:`, error.message);
        
        const executionTime = Date.now() - startTime;
        res.status(500).json({
            error: error.message === 'Audit timeout' ? 'Audit timed out' : 'Audit failed',
            url,
            executionTime,
            timestamp: new Date().toISOString()
        });
    }
});

// Enhanced audit endpoint (loads heavy dependencies on demand)
app.post('/api/audit/enhanced', async (req, res) => {
    const { url, options = {} } = req.body;
    
    if (!url) {
        return res.status(400).json({ error: 'URL is required' });
    }

    try {
        log.info(`Starting enhanced audit for: ${url}`);
        const result = await getOrchestrator().performEnhancedAudit(url, options);
        res.json(result);
        
    } catch (error) {
        log.error(`Enhanced audit failed for ${url}:`, error.message);
        res.status(500).json({
            error: 'Enhanced audit failed, falling back to basic audit',
            fallback: await getOrchestrator().performLightweightAudit(url, options)
        });
    }
});

// Cache management
let cache = new Map();
app.post('/api/cache/clear', (req, res) => {
    const before = cache.size;
    cache.clear();
    
    // Force garbage collection if available
    if (global.gc) {
        global.gc();
    }
    
    log.info(`Cache cleared: ${before} items removed`);
    res.json({ 
        status: 'cleared', 
        itemsCleared: before,
        memoryUsage: process.memoryUsage() 
    });
});

// Enhanced batch audit limiter - more restrictive for batch operations
const batchAuditLimiter = rateLimit({
    windowMs: 5 * 60 * 1000, // 5 minutes
    max: 2, // Only 2 batch audits per 5 minutes
    message: { error: 'Too many batch audit requests. Please wait before starting another batch analysis.' },
    standardHeaders: true,
    legacyHeaders: false,
});

// Enhanced sitemap discovery and batch auditing
app.post('/api/sitemap-audit', batchAuditLimiter, async (req, res) => {
    const { url, maxUrls = 20, mode = 'discover' } = req.body;
    
    if (!url) {
        return res.status(400).json({ error: 'URL is required' });
    }

    // Validate maxUrls (default 20, max 50)
    const limitedMaxUrls = Math.min(Math.max(parseInt(maxUrls) || 20, 1), 50);

    const startTime = Date.now();

    try {
        log.info(`Starting sitemap audit for: ${url} (mode: ${mode}, maxUrls: ${limitedMaxUrls})`);

        const fetch = require('node-fetch');
        const xml2js = require('xml2js');
        const { URL } = require('url');
        
        const baseUrl = new URL(url).origin;
        const discoveredSitemaps = [];
        const allUrls = new Set(); // Use Set to avoid duplicates

        // Try multiple sitemap locations
        const potentialSitemaps = [
            '/sitemap.xml',
            '/sitemap_index.xml',
            '/sitemaps.xml',
            '/wp-sitemap.xml', // WordPress
            '/sitemap1.xml'
        ];

        for (const sitemapPath of potentialSitemaps) {
            try {
                const sitemapUrl = new URL(sitemapPath, baseUrl).href;
                log.info(`Checking sitemap: ${sitemapUrl}`);
                
                const response = await fetch(sitemapUrl, { 
                    timeout: 10000,
                    headers: {
                        'User-Agent': 'SEO-Audit-Tool/2.1.0 (+https://attentionisallyouneed.app)'
                    }
                });
                
                if (response.ok) {
                    const xml = await response.text();
                    const parser = new xml2js.Parser();
                    const result = await parser.parseStringPromise(xml);
                    
                    discoveredSitemaps.push({
                        url: sitemapUrl,
                        status: 'found',
                        type: result.sitemapindex ? 'index' : 'urlset'
                    });

                    // Handle sitemap index (contains other sitemaps)
                    if (result.sitemapindex && result.sitemapindex.sitemap) {
                        for (const sitemap of result.sitemapindex.sitemap.slice(0, 5)) { // Limit sub-sitemaps
                            try {
                                const subSitemapUrl = sitemap.loc[0];
                                const subResponse = await fetch(subSitemapUrl, { timeout: 8000 });
                                if (subResponse.ok) {
                                    const subXml = await subResponse.text();
                                    const subResult = await parser.parseStringPromise(subXml);
                                    
                                    if (subResult.urlset && subResult.urlset.url) {
                                        subResult.urlset.url.forEach(urlEntry => {
                                            if (allUrls.size < limitedMaxUrls) {
                                                allUrls.add(urlEntry.loc[0]);
                                            }
                                        });
                                    }
                                }
                            } catch (subError) {
                                log.warn(`Failed to fetch sub-sitemap: ${sitemap.loc[0]}`);
                            }
                        }
                    }
                    
                    // Handle regular sitemap (contains URLs)
                    if (result.urlset && result.urlset.url) {
                        result.urlset.url.forEach(urlEntry => {
                            if (allUrls.size < limitedMaxUrls) {
                                allUrls.add(urlEntry.loc[0]);
                            }
                        });
                    }

                    // Found at least one sitemap, can break if only discovering
                    if (mode === 'discover' && allUrls.size > 0) {
                        break;
                    }
                }
            } catch (sitemapError) {
                log.warn(`Sitemap ${sitemapPath} not accessible:`, sitemapError.message);
                discoveredSitemaps.push({
                    url: new URL(sitemapPath, baseUrl).href,
                    status: 'not_found',
                    error: sitemapError.message
                });
            }
        }

        const urlArray = Array.from(allUrls).slice(0, limitedMaxUrls);
        const executionTime = Date.now() - startTime;

        if (mode === 'discover') {
            // Just return sitemap discovery results
            res.json({
                success: true,
                baseUrl,
                sitemaps: discoveredSitemaps,
                discoveredUrls: urlArray.length,
                urls: urlArray,
                maxUrls: limitedMaxUrls,
                executionTime,
                timestamp: new Date().toISOString(),
                nextStep: 'Use mode=batch to perform full audit on discovered URLs'
            });
        } else if (mode === 'batch') {
            // Perform actual batch audit
            if (urlArray.length === 0) {
                return res.status(404).json({
                    success: false,
                    error: 'No URLs found in sitemap',
                    sitemaps: discoveredSitemaps,
                    executionTime
                });
            }

            log.info(`Performing batch audit on ${urlArray.length} URLs`);

            const batchResults = {
                success: true,
                baseUrl,
                sitemaps: discoveredSitemaps,
                totalUrls: urlArray.length,
                maxUrls: limitedMaxUrls,
                results: [],
                summary: {
                    completed: 0,
                    failed: 0,
                    avgScore: 0,
                    totalExecutionTime: 0
                },
                timestamp: new Date().toISOString()
            };

            // Process URLs in smaller batches to avoid timeout
            const batchSize = 5;
            const orchestrator = getOrchestrator();

            for (let i = 0; i < urlArray.length; i += batchSize) {
                const batch = urlArray.slice(i, i + batchSize);
                log.info(`Processing batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(urlArray.length/batchSize)}`);

                const batchPromises = batch.map(async (pageUrl) => {
                    try {
                        const auditStart = Date.now();
                        const result = await Promise.race([
                            orchestrator.performLightweightAudit(pageUrl, { skipLighthouse: true }),
                            new Promise((_, reject) => 
                                setTimeout(() => reject(new Error('Individual audit timeout')), 15000)
                            )
                        ]);
                        
                        const auditTime = Date.now() - auditStart;
                        batchResults.summary.completed++;
                        batchResults.summary.totalExecutionTime += auditTime;

                        // Calculate simple composite score for summary
                        const scores = calculateSimpleScore(result);
                        batchResults.summary.avgScore += scores.overall;

                        return {
                            url: pageUrl,
                            success: true,
                            executionTime: auditTime,
                            scores,
                            keyFindings: extractKeyFindings(result)
                        };
                    } catch (error) {
                        log.warn(`Batch audit failed for ${pageUrl}:`, error.message);
                        batchResults.summary.failed++;
                        return {
                            url: pageUrl,
                            success: false,
                            error: error.message,
                            executionTime: 0
                        };
                    }
                });

                const batchResults_partial = await Promise.all(batchPromises);
                batchResults.results.push(...batchResults_partial);

                // Check if we're approaching timeout
                if (Date.now() - startTime > 40000) {
                    log.warn('Batch audit approaching timeout, stopping early');
                    break;
                }
            }

            // Calculate final average score
            if (batchResults.summary.completed > 0) {
                batchResults.summary.avgScore = Math.round(batchResults.summary.avgScore / batchResults.summary.completed);
            }

            batchResults.executionTime = Date.now() - startTime;
            res.json(batchResults);
        }
        
    } catch (error) {
        log.error(`Sitemap audit failed:`, error.message);
        res.status(500).json({ 
            success: false,
            error: 'Sitemap audit failed',
            details: error.message,
            executionTime: Date.now() - startTime
        });
    }
});

// Helper function to calculate simple scores for batch results
function calculateSimpleScore(auditResult) {
    let seoScore = 0;
    let performanceScore = 0;
    let accessibilityScore = 0;

    // Calculate SEO score
    if (auditResult.tests.seo) {
        const seo = auditResult.tests.seo;
        seoScore = (seo.title ? 25 : 0) + 
                  (seo.description ? 25 : 0) + 
                  (seo.h1Count === 1 ? 25 : 0) + 
                  (seo.h2Count > 0 ? 25 : 0);
    }

    // Calculate performance score
    if (auditResult.tests.performance) {
        const perf = auditResult.tests.performance;
        performanceScore = Math.max(0, 100 - Math.floor(perf.responseTime / 10));
    }

    // Calculate accessibility score
    if (auditResult.tests.accessibility) {
        const a11y = auditResult.tests.accessibility;
        accessibilityScore = Math.max(0, 100 - (a11y.issues?.length || 0) * 10);
    }

    const overall = Math.round((seoScore + performanceScore + accessibilityScore) / 3);

    return {
        seo: seoScore,
        performance: performanceScore,
        accessibility: accessibilityScore,
        overall
    };
}

// Helper function to extract key findings for batch results
function extractKeyFindings(auditResult) {
    const findings = [];

    if (auditResult.tests.seo) {
        const seo = auditResult.tests.seo;
        if (!seo.title) findings.push('Missing title');
        if (!seo.description) findings.push('Missing meta description');
        if (seo.h1Count !== 1) findings.push(`${seo.h1Count} H1 tags`);
    }

    if (auditResult.tests.performance) {
        const perf = auditResult.tests.performance;
        if (perf.responseTime > 1000) findings.push(`Slow response: ${perf.responseTime}ms`);
    }

    if (auditResult.tests.accessibility) {
        const a11y = auditResult.tests.accessibility;
        if (a11y.issues && a11y.issues.length > 0) {
            findings.push(`${a11y.issues.length} a11y issues`);
        }
    }

    return findings;
}

// LLMS.txt generation
app.post('/api/llms/generate', (req, res) => {
    const { url } = req.body;
    
    if (!url) {
        return res.status(400).json({ error: 'URL is required' });
    }
    
    const baseUrl = new URL(url).origin;
    const llmsContent = `# llms.txt - AI Training Guidelines
# Generated by SEO Audit Tool

# Allow training on public content
User-agent: *
Allow: /

# Restrict sensitive areas
User-agent: *
Disallow: /admin/
Disallow: /private/
Disallow: /api/

# Contact information
Contact: admin@${new URL(url).hostname}

# Training preferences
Training-consent: conditional
Training-restrictions: no-personal-data

# Generated on ${new Date().toISOString()}`;

    res.json({
        content: llmsContent,
        url: `${baseUrl}/llms.txt`,
        instructions: 'Save this content to your website root as llms.txt'
    });
});

// Serve main application
app.get('/', (req, res) => {
    res.sendFile('index.html', { root: __dirname });
});

// Error handling middleware
app.use((error, req, res, next) => {
    log.error('Unhandled error:', error);
    res.status(500).json({ 
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
});

// 404 handler
app.use('*', (req, res) => {
    res.status(404).json({ error: 'Endpoint not found' });
});

// Start server
const server = app.listen(PORT, () => {
    console.log('╔════════════════════════════════════════╗');
    console.log('║         SEO Audit Tool (Optimized)    ║');
    console.log('╠════════════════════════════════════════╣');
    console.log(`║  Status: ✅ Running                    ║`);
    console.log(`║  Port: ${PORT}                            ║`);
    console.log(`║  Mode: ${process.env.NODE_ENV || 'development'}                    ║`);
    console.log('╠════════════════════════════════════════╣');
    console.log('║  Optimizations:                        ║');
    console.log('║  • Lazy loading of heavy dependencies  ║');
    console.log('║  • Fast startup time                   ║');
    console.log('║  • Graceful fallbacks                  ║');
    console.log('║  • Cloud-optimized                     ║');
    console.log('╚════════════════════════════════════════╝');
    
    log.info('Server started successfully');
    log.info(`Health check: http://localhost:${PORT}/api/health`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
    log.info('SIGTERM received, shutting down gracefully');
    server.close(() => {
        log.info('Server closed');
        process.exit(0);
    });
});

process.on('SIGINT', () => {
    log.info('SIGINT received, shutting down gracefully');
    server.close(() => {
        log.info('Server closed');
        process.exit(0);
    });
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
    log.error('Uncaught exception:', error);
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    log.error('Unhandled rejection at:', promise, 'reason:', reason);
    process.exit(1);
});

module.exports = app;