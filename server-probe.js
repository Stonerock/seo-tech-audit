// server-probe.js - Minimal CJS server with surgical Browserless probe
const dotenv = require('dotenv');
dotenv.config();

const express = require('express');
const cors = require('cors');

const app = express();

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Health check
app.get('/healthz', (_req, res) => res.status(200).send('ok'));
app.get('/api/health', (_req, res) => res.json({ 
  status: 'ok',
  node: process.version,
  arch: process.arch,
  env: {
    hasToken: Boolean(process.env.BROWSERLESS_TOKEN),
    tokenLength: process.env.BROWSERLESS_TOKEN ? process.env.BROWSERLESS_TOKEN.trim().length : 0,
    wsUrl: process.env.BROWSERLESS_WS || 'wss://chrome.browserless.io'
  }
}));

// Wire in the probe
app.use('/', require('./routes/probe'));

// Start server
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`🚀 Probe server listening on port ${PORT}`);
  console.log(`📡 Browserless WS: ${process.env.BROWSERLESS_WS || 'wss://chrome.browserless.io'}`);
  console.log(`🔑 Token present: ${Boolean(process.env.BROWSERLESS_TOKEN)}`);
  if (process.env.BROWSERLESS_TOKEN) {
    console.log(`🔑 Token length: ${process.env.BROWSERLESS_TOKEN.length} chars`);
  }
});