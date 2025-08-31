// server-production.js - Full production server with working Browserless integration (CommonJS)
const dotenv = require('dotenv');
dotenv.config();

const express = require('express');
const cors = require('cors');

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

// Middleware
app.use(cors());
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
      }
    },
    env: {
      hasToken: Boolean(process.env.BROWSERLESS_TOKEN),
      tokenLength: process.env.BROWSERLESS_TOKEN ? process.env.BROWSERLESS_TOKEN.trim().length : 0
    }
  });
});

// Wire in the comprehensive audit orchestrator 
const OptimizedAuditOrchestrator = require('./services/audit-orchestrator.optimized');
const orchestrator = new OptimizedAuditOrchestrator();

// Audit endpoints
app.post('/api/audit', async (req, res) => {
  try {
    const { url, fastMode, enableJS, includeFullReport } = req.body;
    
    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }

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
      message: error.message 
    });
  }
});

app.get('/api/audit', async (req, res) => {
  try {
    const { url, fastMode, enableJS } = req.query;
    
    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }

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
      message: error.message 
    });
  }
});

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