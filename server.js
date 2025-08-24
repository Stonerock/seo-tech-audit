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

// Basic middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Serve static files
app.use(express.static('.', {
    index: false // Don't automatically serve index.html for all routes
}));

// Request logging middleware
app.use((req, res, next) => {
    log.info(`${req.method} ${req.path} - ${req.ip}`);
    next();
});

// Rate limiting
const limiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 20, // 20 requests per minute
    message: { error: 'Too many requests, please try again later' }
});
app.use('/api/', limiter);

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

// Main audit endpoint with timeout protection
app.post('/api/audit', async (req, res) => {
    const { url, options = {} } = req.body;
    
    if (!url) {
        return res.status(400).json({ error: 'URL is required' });
    }

    // Validate URL
    try {
        new URL(url);
    } catch (error) {
        return res.status(400).json({ error: 'Invalid URL format' });
    }

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

// Basic sitemap audit
app.post('/api/sitemap-audit', async (req, res) => {
    const { url, maxUrls = 10 } = req.body;
    
    if (!url) {
        return res.status(400).json({ error: 'URL is required' });
    }

    try {
        const fetch = require('node-fetch');
        const xml2js = require('xml2js');
        
        // Simple sitemap parsing
        const sitemapUrl = new URL('/sitemap.xml', url).href;
        const response = await fetch(sitemapUrl, { timeout: 10000 });
        
        if (!response.ok) {
            return res.status(404).json({ error: 'Sitemap not found' });
        }
        
        const xml = await response.text();
        const parser = new xml2js.Parser();
        const result = await parser.parseStringPromise(xml);
        
        const urls = result.urlset?.url?.slice(0, maxUrls).map(u => u.loc[0]) || [];
        
        res.json({
            sitemap: sitemapUrl,
            totalUrls: urls.length,
            urls,
            message: 'Basic sitemap parsing - upgrade for full analysis'
        });
        
    } catch (error) {
        log.error(`Sitemap audit failed:`, error.message);
        res.status(500).json({ error: 'Sitemap audit failed' });
    }
});

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