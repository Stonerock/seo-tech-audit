// server.optimized.js - Fast-starting SEO Audit Backend
// Optimized for cloud deployment with lazy loading

const dotenv = require('dotenv');
dotenv.config();

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
const { getServiceManager } = require('./services/service-manager');

// Basic logging without heavy winston dependencies
const log = {
    info: (msg, ...args) => console.log(`[INFO] ${msg}`, ...args),
    warn: (msg, ...args) => console.warn(`[WARN] ${msg}`, ...args),
    error: (msg, ...args) => console.error(`[ERROR] ${msg}`, ...args)
};

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 8080;

// Initialize service manager
let serviceManager = null;
let services = null;

const initializeServices = async () => {
    if (!services) {
        serviceManager = getServiceManager();
        services = await serviceManager.initializeServices();
        log.info('Production services initialized');
    }
    return services;
};
let jobStore;
try {
    const { FirestoreJobStore } = require('./services/job-store.firestore');
    jobStore = new FirestoreJobStore();
    log.info('Using FirestoreJobStore');
} catch (e) {
    const { InMemoryJobStore } = require('./services/job-store');
    jobStore = new InMemoryJobStore();
    log.warn('Falling back to InMemoryJobStore:', e.message);
}
let jobQueue = null;
try {
    const { JobQueue } = require('./services/pubsub');
    jobQueue = new JobQueue();
} catch (e) {
    log.warn('Pub/Sub not available:', e.message);
}

// CORS middleware - allow all origins for now to fix the issue
app.use(cors({
  origin: (origin, callback) => {
    // Allow no-origin requests (curl, server-to-server)
    if (!origin) return callback(null, true);
    const allowed = [
      'https://seo-audit-tool-e50.pages.dev',
    ];
    // Allow Cloudflare Pages preview subdomains
    const isPagesPreview = /https:\/\/[a-z0-9-]+\.[a-z0-9-]+\.pages\.dev$/i.test(origin);
    if (allowed.includes(origin) || isPagesPreview) {
      return callback(null, true);
    }
    return callback(null, true); // Temporarily allow all to avoid blocking
  },
  credentials: true,
  maxAge: 86400,
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

app.use(express.json({ limit: '2mb' })); // Reduced from 10mb
app.use(express.urlencoded({ extended: true, limit: '2mb' }));

// Initialize services middleware
app.use(async (req, res, next) => {
    try {
        req.services = await initializeServices();
        next();
    } catch (error) {
        log.error('Service initialization failed:', error);
        next(error);
    }
});

// Serve static files
app.use(express.static('.', {
    index: false // Don't automatically serve index.html for all routes
}));
// Simple health
app.get('/healthz', (_req, res) => res.status(200).send('ok'));
// Probe routes
try {
    app.use('/probe', require('./routes/probe'));
} catch (e) {
    log.warn('Probe routes not available:', e.message);
}

// Analytics routes for product insights
try {
    app.use('/api/analytics', require('./routes/analytics'));
} catch (e) {
    log.warn('Analytics routes not available:', e.message);
}

// Apply production middleware after services are initialized
app.use(async (req, res, next) => {
    try {
        const services = await initializeServices();
        const middleware = serviceManager.getMiddleware();
        
        // Apply telemetry tracing
        middleware.tracing(req, res, () => {
            // Apply security validation for audit endpoints
            if (req.path.startsWith('/api/audit')) {
                middleware.security(req, res, next);
            } else {
                next();
            }
        });
    } catch (error) {
        log.error('Middleware initialization failed:', error);
        next();
    }
});

// Request logging middleware
app.use((req, res, next) => {
    log.info(`${req.method} ${req.path} - ${req.ip}`);
    next();
});

// Rate limiting disabled for debugging
// const generalLimiter = rateLimit({...});
// const auditLimiter = rateLimit({...});
// app.use('/api/health', generalLimiter);
// app.use('/api/audit', auditLimiter);
// app.use('/api/', generalLimiter);

// Lazy-loaded orchestrator
let orchestrator = null;
const getOrchestrator = async () => {
    if (!orchestrator) {
        const OptimizedAuditOrchestrator = require('./services/audit-orchestrator.optimized.js');
        orchestrator = new OptimizedAuditOrchestrator();
        log.info('Audit orchestrator loaded');
    }
    return orchestrator;
};

// Comprehensive health check endpoint with all services
app.get('/api/health', async (req, res) => {
    try {
        const services = await initializeServices();
        const healthStatus = await serviceManager.getHealthStatus();
        return res.json(healthStatus);
    } catch (error) {
        log.error('Health check failed:', error);
        // Fallback to basic health check
    }
    
    // Basic health check fallback
    const health = {
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        mode: 'optimized',
        memory: {
            used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + 'MB',
            total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024) + 'MB'
        },
        features: {
            staticAnalysis: 'available',
            jsDetection: 'available'
        }
    };

    // Lightweight JS rendering config status (no external calls)
    try {
        const orchestratorInstance = await getOrchestrator();
        const jsRenderer = await orchestratorInstance.loadJSRenderer();
        if (jsRenderer) {
            const hasToken = !!process.env.BROWSERLESS_TOKEN;
            health.features.jsRendering = {
                status: hasToken ? 'configured' : 'disabled',
                mode: hasToken ? 'browserless' : (process.env.ENABLE_LOCAL_PLAYWRIGHT === '1' ? 'playwright' : 'none'),
                available: hasToken || process.env.ENABLE_LOCAL_PLAYWRIGHT === '1',
                probe: '/probe/browserless'
            };
        } else {
            health.features.jsRendering = {
                status: 'unavailable',
                mode: 'none',
                available: false
            };
        }
    } catch (error) {
        health.features.jsRendering = {
            status: 'error',
            available: false,
            error: error.message
        };
    }

    res.json(health);
});

// Service-specific health endpoints
app.get('/api/health/circuit-breakers', async (req, res) => {
    try {
        const services = await initializeServices();
        const circuitHealth = services.reliability.getCircuitBreakerHealth();
        res.json(circuitHealth);
    } catch (error) {
        res.status(500).json({ error: 'Circuit breaker health unavailable', message: error.message });
    }
});

app.get('/api/health/security', async (req, res) => {
    try {
        const services = await initializeServices();
        const securityHealth = services.security.getSecurityHealth();
        res.json(securityHealth);
    } catch (error) {
        res.status(500).json({ error: 'Security health unavailable', message: error.message });
    }
});

// HTTP connectivity probe endpoint
app.get('/probe/http', async (req, res) => {
    const startTime = Date.now();
    const target = req.query.target || 'https://chrome.browserless.io';
    
    try {
        const fetch = require('node-fetch');
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10000); // 10s timeout
        
        console.log(`[PROBE] Testing HTTP connectivity to ${target}`);
        
        const response = await fetch(target, {
            method: 'HEAD',
            signal: controller.signal,
            headers: {
                'User-Agent': 'SEO-Audit-Tool-Probe/2.1.0'
            }
        });
        
        clearTimeout(timeout);
        const latency = Date.now() - startTime;
        
        const result = {
            target,
            status: response.status,
            statusText: response.statusText,
            latency: `${latency}ms`,
            headers: Object.fromEntries(response.headers.entries()),
            connectivity: response.status < 400 ? 'ok' : 'error',
            timestamp: new Date().toISOString()
        };
        
        console.log(`[PROBE] Result:`, { status: result.status, latency: result.latency, connectivity: result.connectivity });
        
        res.json(result);
        
    } catch (error) {
        const latency = Date.now() - startTime;
        
        const result = {
            target,
            error: error.message,
            code: error.code,
            latency: `${latency}ms`,
            connectivity: 'failed',
            timestamp: new Date().toISOString()
        };
        
        console.error(`[PROBE] Failed:`, result);
        
        res.status(503).json(result);
    }
});

// Pub/Sub push worker endpoint
app.post('/worker/pubsub', async (req, res) => {
    try {
        const token = process.env.PUBSUB_TOKEN;
        if (token) {
            const provided = req.query.token || req.header('x-pubsub-token') || (req.header('authorization') || '').replace(/^Bearer\s+/i, '');
            if (provided !== token) {
                return res.status(401).json({ error: 'unauthorized' });
            }
        }

        const msg = req.body && req.body.message ? req.body.message : req.body;
        if (!msg) {
            return res.status(400).json({ error: 'missing message' });
        }

        let payload = null;
        if (msg.data) {
            const decoded = Buffer.from(msg.data, 'base64').toString('utf8');
            payload = JSON.parse(decoded);
        } else {
            payload = msg;
        }

        const { jobId, url, options = {} } = payload || {};
        if (!url) {
            return res.status(400).json({ error: 'missing url' });
        }

        // Mark running and execute audit
        await jobStore.updateJob(jobId || `job-${Date.now()}`, { status: 'running', startedAt: Date.now(), url, options });
        const orchestratorInstance = await getOrchestrator();
        const result = await orchestratorInstance.performTwoPassAudit(url, { ...options, enableJS: true });
        await jobStore.saveResult(jobId || `job-${Date.now()}`, result);

        return res.status(204).end();
    } catch (err) {
        log.error('Worker execution failed:', err.message);
        return res.status(500).json({ error: 'worker-failed', message: err.message });
    }
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

// Rate limiting middleware for audit endpoints
app.use('/api/audit', async (req, res, next) => {
    try {
        const services = await initializeServices();
        const middleware = serviceManager.getMiddleware();
        
        // Apply audit-specific rate limiting
        middleware.audit(req, res, next);
    } catch (error) {
        log.warn('Rate limiting unavailable:', error.message);
        next();
    }
});

// Main audit endpoint with enhanced production services
app.post('/api/audit', validateAuditInput, async (req, res) => {
    const { url, options = {} } = req.body;
    const jobId = `audit-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const startTime = Date.now();
    const timeoutMs = 60000; // 60 second timeout for intelligent audit
    
    try {
        log.info(`Starting enhanced audit for: ${url}`);
        
        const services = await initializeServices();
        
        // Use enhanced audit with all production services
        const result = await serviceManager.performEnhancedAudit(jobId, url, {
            ...options,
            enableJS: options.enableJS !== false,
            includePSI: options.includePSI !== false,
            clientId: req.get('x-client-id') || 'default'
        });
        
        log.info(`Enhanced audit completed in ${Date.now() - startTime}ms`);
        res.json(result);
        
    } catch (error) {
        log.error(`Enhanced audit failed for ${url}:`, error.message);
        
        // Fallback to basic audit
        try {
            const orchestratorInstance = await getOrchestrator();
            const fallback = await orchestratorInstance.performTwoPassAudit(url, options);
            res.status(206).json({
                ...fallback,
                warning: 'Enhanced features unavailable, using basic audit',
                error: error.message
            });
        } catch (fallbackError) {
            const executionTime = Date.now() - startTime;
            res.status(500).json({
                error: 'Both enhanced and basic audits failed',
                details: error.message,
                fallbackError: fallbackError.message,
                url,
                executionTime,
                timestamp: new Date().toISOString()
            });
        }
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
        const orchestratorInstance = await getOrchestrator();
        const result = await orchestratorInstance.performEnhancedAudit(url, options);
        res.json(result);
        
    } catch (error) {
        log.error(`Enhanced audit failed for ${url}:`, error.message);
        res.status(500).json({
            error: 'Enhanced audit failed, falling back to basic audit',
            fallback: await (await getOrchestrator()).performLightweightAudit(url, options)
        });
    }
});

// Jobs API — control plane MVP (in-memory store for now)
app.post('/api/audit/jobs', async (req, res) => {
    try {
        const { url, options = {}, force = false } = req.body || {};
        if (!url || typeof url !== 'string') {
            return res.status(400).json({ error: 'URL is required' });
        }
        const idempotencyWindowMs = force ? 0 : 10 * 60 * 1000;
        let jobId, reused;
        try {
            ({ jobId, reused } = await jobStore.createJob(url, options, idempotencyWindowMs));
        } catch (e) {
            // Firestore may be disabled; fallback to in-memory store seamlessly
            log.warn('Primary job store failed, falling back to in-memory:', e.message);
            const { InMemoryJobStore } = require('./services/job-store');
            jobStore = new InMemoryJobStore();
            ({ jobId, reused } = await jobStore.createJob(url, options, idempotencyWindowMs));
        }
        // Enqueue to Pub/Sub if available; otherwise run inline async
        if (jobQueue && jobQueue.enabled) {
            await jobQueue.publishJob({ jobId, url, options });
        } else {
            process.nextTick(async () => {
                try {
                    await jobStore.updateJob(jobId, { status: 'running', startedAt: Date.now() });
                    const orchestratorInstance = await getOrchestrator();
                    const result = await orchestratorInstance.performTwoPassAudit(url, { ...options, enableJS: true });
                    await jobStore.saveResult(jobId, result);
                } catch (err) {
                    await jobStore.failJob(jobId, 'WORKER_ERROR', err?.message || 'Unknown');
                }
            });
        }
        return res.status(202).json({ jobId, reused, statusUrl: `/api/audit/jobs/${jobId}` });
    } catch (error) {
        log.error('Job create error:', error);
        return res.status(500).json({ error: 'Failed to create job' });
    }
});

app.get('/api/audit/jobs/:jobId', async (req, res) => {
    try {
        const { jobId } = req.params;
        const data = await jobStore.getJob(jobId);
        if (!data) return res.status(404).json({ error: 'Job not found' });
        return res.json({ job: data.job, result: data.result });
    } catch (error) {
        log.error('Job status error:', error);
        return res.status(500).json({ error: 'Failed to get job status' });
    }
});

// Two-pass audit endpoint (static + JavaScript rendering when needed)
app.post('/api/audit/two-pass', validateAuditInput, async (req, res) => {
    const { url, options = {} } = req.body;

    const startTime = Date.now();
    const timeoutMs = 60000; // 60 second timeout for two-pass audit
    
    try {
        log.info(`Starting two-pass audit for: ${url}`);
        
        // Race between audit and timeout
        const orchestratorInstance = await getOrchestrator();
        const auditPromise = orchestratorInstance.performTwoPassAudit(url, { 
            ...options, 
            enableJS: options.enableJS !== false // Default to true
        });
        const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Two-pass audit timeout')), timeoutMs)
        );
        
        const result = await Promise.race([auditPromise, timeoutPromise]);
        
        log.info(`Two-pass audit completed in ${Date.now() - startTime}ms`);
        res.json(result);
        
    } catch (error) {
        log.error(`Two-pass audit failed for ${url}:`, error.message);
        
        // Fallback to lightweight audit
        try {
            log.info('Falling back to lightweight audit...');
            const fallback = await (await getOrchestrator()).performLightweightAudit(url, options);
            res.status(500).json({
                error: 'Two-pass audit failed, fallback to static analysis',
                details: error.message,
                fallback
            });
        } catch (fallbackError) {
            res.status(500).json({
                error: 'Both two-pass and fallback audits failed',
                details: error.message,
                fallbackError: fallbackError.message
            });
        }
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

// Webhook management endpoints
app.post('/api/webhooks/register', async (req, res) => {
    try {
        const services = await initializeServices();
        const { clientId, endpoint } = req.body;
        
        if (!clientId || !endpoint) {
            return res.status(400).json({ error: 'clientId and endpoint required' });
        }
        
        services.webhooks.registerEndpoint(clientId, endpoint, { test: true });
        res.json({ success: true, message: 'Webhook registered and tested' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to register webhook', message: error.message });
    }
});

app.get('/api/webhooks/stats', async (req, res) => {
    try {
        const services = await initializeServices();
        const stats = services.webhooks.getWebhookStats();
        res.json(stats);
    } catch (error) {
        res.status(500).json({ error: 'Failed to get webhook stats', message: error.message });
    }
});

// Cache management with service integration
app.post('/api/cache/clear', async (req, res) => {
    try {
        const services = await initializeServices();
        const results = {};
        
        // Clear application cache
        const before = cache.size;
        cache.clear();
        results.application = { itemsCleared: before };
        
        // Clear PageSpeed Insights cache
        if (services.pagespeed && services.pagespeed.enabled) {
            const psiCleared = services.pagespeed.clearCache();
            results.pagespeedInsights = { itemsCleared: psiCleared };
        }
        
        // Force garbage collection if available
        if (global.gc) {
            global.gc();
        }
        
        log.info('All caches cleared');
        res.json({ 
            status: 'cleared',
            results,
            memoryUsage: process.memoryUsage() 
        });
    } catch (error) {
        res.status(500).json({ error: 'Cache clear failed', message: error.message });
    }
});

// Artifacts management endpoints
app.get('/api/artifacts/stats', async (req, res) => {
    try {
        const services = await initializeServices();
        if (!services.artifacts || !services.artifacts.enabled) {
            return res.status(503).json({ error: 'Artifacts storage not available' });
        }
        
        const stats = await services.artifacts.getStorageStats();
        res.json(stats);
    } catch (error) {
        res.status(500).json({ error: 'Failed to get artifacts stats', message: error.message });
    }
});

app.post('/api/artifacts/cleanup', async (req, res) => {
    try {
        const services = await initializeServices();
        const { daysOld = 30 } = req.body;
        
        if (!services.artifacts || !services.artifacts.enabled) {
            return res.status(503).json({ error: 'Artifacts storage not available' });
        }
        
        const deletedCount = await services.artifacts.cleanupOldArtifacts(daysOld);
        res.json({ success: true, deletedFiles: deletedCount });
    } catch (error) {
        res.status(500).json({ error: 'Cleanup failed', message: error.message });
    }
});

// Enhanced batch audit limiter - now using production rate limiting

// Enhanced sitemap discovery and batch auditing
app.post('/api/sitemap-audit', async (req, res) => {
    const { url, maxUrls = 20, mode = 'discover' } = req.body;
    
    if (!url) {
        return res.status(400).json({ error: 'URL is required' });
    }

    // Validate maxUrls (default 20, max 50)
    const limitedMaxUrls = Math.min(Math.max(parseInt(maxUrls) || 20, 1), 50);

    const startTime = Date.now();

    try {
        log.info(`Starting sitemap audit for: ${url} (mode: ${mode}, maxUrls: ${limitedMaxUrls})`);

        const fetch = (await import('node-fetch')).default;
        const xml2js = (await import('xml2js')).default;
        const { URL } = await import('url');
        
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
            const orchestrator = await getOrchestrator();

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

// Graceful shutdown with service cleanup
process.on('SIGTERM', async () => {
    log.info('SIGTERM received, shutting down gracefully');
    
    try {
        if (serviceManager) {
            await serviceManager.shutdown();
        }
    } catch (error) {
        log.error('Service shutdown error:', error);
    }
    
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