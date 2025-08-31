// server-production.js - Full production server with working Browserless integration (CommonJS)
const dotenv = require('dotenv');
dotenv.config();

const express = require('express');
const cors = require('cors');
const {
    requireApiKey,
    createRateLimit,
    urlValidationRules,
    bodyUrlValidationRules,
    batchUrlValidationRules,
    handleValidationErrors,
    securityHeaders
} = require('./middleware/security.js');

// Polyfill browser APIs for Node.js environment
if (typeof global.File === 'undefined') {
  global.File = class File {
    constructor(bits, name, options = {}) {
      this.bits = bits;
      this.name = name;
      this.type = options.type || '';
      this.lastModified = options.lastModified || Date.now();
    }
  };
}

const app = express();

// Security headers
app.use(securityHeaders);

// Rate limiting
app.use('/api/audit', createRateLimit(15 * 60 * 1000, 10)); // 10 requests per 15 minutes
app.use(createRateLimit(15 * 60 * 1000, 100)); // Global rate limit

// Middleware
app.use(cors({
    origin: true,
    methods: ['GET', 'POST', 'OPTIONS', 'HEAD'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-API-Key'],
    credentials: true
}));
app.use(express.json({ limit: '10mb' }));

// Health check endpoints
app.get('/healthz', (_req, res) => res.status(200).send('ok'));
app.get('/api/health', (_req, res) => {
  res.json({ 
    status: 'ok',
    node: process.version,
    arch: process.arch,
    features: {
      jsRendering: {
        status: process.env.BROWSERLESS_TOKEN ? 'available' : 'disabled',
        endpoint: process.env.BROWSERLESS_WS || 'wss://production-sfo.browserless.io'
      },
      security: {
        apiKeyRequired: process.env.NODE_ENV === 'production',
        rateLimiting: true,
        urlValidation: true
      }
    },
    env: {
      hasToken: Boolean(process.env.BROWSERLESS_TOKEN),
      tokenLength: process.env.BROWSERLESS_TOKEN ? process.env.BROWSERLESS_TOKEN.trim().length : 0
    }
  });
});

// API Documentation
app.get('/api/docs', (_req, res) => {
  res.json({
    title: 'SEO Audit API',
    version: '2.1.0',
    security: {
      apiKey: {
        required: process.env.NODE_ENV === 'production',
        methods: ['header: X-API-Key', 'query: api_key'],
        note: 'Required in production environment'
      },
      rateLimits: {
        global: '100 requests per 15 minutes',
        audit: '10 requests per 15 minutes'
      },
      urlValidation: {
        protocols: ['http', 'https'],
        maxLength: 2048,
        blocked: ['localhost', 'private IPs', 'metadata endpoints']
      }
    },
    endpoints: {
      'GET /api/audit': {
        description: 'Perform SEO audit on a URL',
        parameters: {
          url: 'required - URL to audit',
          fastMode: 'optional - boolean',
          enableJS: 'optional - boolean'
        }
      },
      'POST /api/audit': {
        description: 'Perform SEO audit via POST',
        body: {
          url: 'required - URL to audit',
          fastMode: 'optional - boolean',
          enableJS: 'optional - boolean',
          includeFullReport: 'optional - boolean'
        }
      }
    }
  });
});

// Wire in the comprehensive audit orchestrator 
const OptimizedAuditOrchestrator = require('./services/audit-orchestrator.optimized');
const orchestrator = new OptimizedAuditOrchestrator();

// Audit endpoints with security validation
app.post('/api/audit',
  requireApiKey,
  bodyUrlValidationRules,
  handleValidationErrors,
  async (req, res) => {
    try {
      const { url, fastMode, enableJS, includeFullReport } = req.body;

      console.log(`🔍 Starting ${fastMode ? 'fast' : 'comprehensive'} audit for: ${url}`);
      
      // Force enable PSI metrics for comprehensive analysis
      process.env.USE_PSI_METRICS = 'true';
      
      const results = await orchestrator.performEnhancedAudit(url, {
        fastMode: Boolean(fastMode),
        enableJS: Boolean(enableJS),
        includeFullReport: Boolean(includeFullReport),
        includePSI: true
      });

      res.json(results);
    } catch (error) {
      console.error('Audit error:', error);
      res.status(500).json({ 
        error: 'Audit failed',
        message: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }
);

app.get('/api/audit',
  requireApiKey,
  urlValidationRules,
  handleValidationErrors,
  async (req, res) => {
    try {
      const { url, fastMode, enableJS } = req.query;

      console.log(`🔍 Starting ${fastMode === 'true' ? 'fast' : 'comprehensive'} audit for: ${url}`);
      
      // Force enable PSI metrics for comprehensive analysis
      process.env.USE_PSI_METRICS = 'true';
      
      const results = await orchestrator.performEnhancedAudit(url, {
        fastMode: fastMode === 'true',
        enableJS: enableJS === 'true',
        includePSI: true
      });

      res.json(results);
    } catch (error) {
      console.error('Audit error:', error);
      res.status(500).json({ 
        error: 'Audit failed',
        message: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }
);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ 
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
});

// Start server
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`🚀 SEO Audit Backend listening on port ${PORT}`);
  console.log(`📡 Browserless WS: ${process.env.BROWSERLESS_WS || 'wss://production-sfo.browserless.io'}`);
  console.log(`🔑 Token present: ${Boolean(process.env.BROWSERLESS_TOKEN)}`);
  if (process.env.BROWSERLESS_TOKEN) {
    console.log(`🔑 Token length: ${process.env.BROWSERLESS_TOKEN.trim().length} chars`);
  }
  console.log(`🎯 Environment: ${process.env.NODE_ENV || 'development'}`);
});