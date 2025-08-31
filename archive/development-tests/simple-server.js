const express = require('express');
const cors = require('cors');
const OptimizedAuditOrchestrator = require('./services/audit-orchestrator.optimized.js');

const app = express();
const port = process.env.PORT || 8080;

// CORS configuration
app.use(cors({
    origin: true,
    methods: ['GET', 'POST', 'OPTIONS', 'HEAD'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    credentials: true
}));

app.use(express.json());

// Health check endpoint
app.get('/api/health-new', (req, res) => {
    console.log('Health check requested');
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        mode: 'optimized'
    });
});

// Initialize orchestrator
const orchestrator = new OptimizedAuditOrchestrator();

// Audit endpoint
app.get('/api/audit', async (req, res) => {
    try {
        console.log(`Starting analysis for: ${req.query.url}`);
        const { url } = req.query;
        if (!url) {
            return res.status(400).json({ error: 'URL parameter is required' });
        }

        const options = {
            includeLighthouse: req.query.lighthouse === 'true',
            fastMode: req.query.fast === 'true',
            forcePuppeteer: req.query.puppeteer === 'true'
        };
        
        const results = await orchestrator.performEnhancedAudit(url, options);
        res.json(results);
    } catch (error) {
        console.error('Audit error:', error);
        res.status(500).json({ error: error.message });
    }
});

app.listen(port, () => {
    console.log(`🚀 Simple SEO Audit API running on port ${port}`);
});
