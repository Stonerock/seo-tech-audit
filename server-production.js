// server-production.js - Full production server with working Browserless integration (CommonJS)
const dotenv = require('dotenv');
dotenv.config();

const express = require('express');
const cors = require('cors');

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

// Wire in the minimal audit routes (working with Browserless)
app.use('/api', require('./routes/audit-minimal'));

// Wire in the surgical probe for debugging (can be removed later)
app.use('/', require('./routes/probe'));

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