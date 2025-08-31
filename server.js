const express = require('express');
const cors = require('cors');
const OptimizedAuditOrchestrator = require('./services/audit-orchestrator.optimized.js');
const {
    requireApiKey,
    createRateLimit,
    urlValidationRules,
    handleValidationErrors,
    securityHeaders
} = require('./middleware/security.js');

const app = express();
const port = process.env.PORT || 8080;

// Security headers
app.use(securityHeaders);

// Rate limiting
app.use('/api/audit', createRateLimit(15 * 60 * 1000, 10)); // 10 requests per 15 minutes
app.use(createRateLimit(15 * 60 * 1000, 100)); // Global rate limit

// CORS configuration
app.use(cors({
    origin: true,
    methods: ['GET', 'POST', 'OPTIONS', 'HEAD'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-API-Key'],
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

// Audit endpoint with security validation
app.get('/api/audit', 
    requireApiKey,
    urlValidationRules,
    handleValidationErrors,
    async (req, res) => {
        try {
            console.log(`Starting analysis for: ${req.query.url}`);
            const { url } = req.query;
            
            const options = {
                includeLighthouse: req.query.lighthouse === 'true',
                fastMode: req.query.fast === 'true',
                forcePuppeteer: req.query.puppeteer === 'true'
            };
            
            const results = await orchestrator.performEnhancedAudit(url, options);
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

app.listen(port, () => {
    console.log(`🚀 Simple SEO Audit API running on port ${port}`);
});
