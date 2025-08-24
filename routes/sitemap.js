// routes/sitemap.js
// Sitemap-based audit routes

const express = require('express');
const rateLimit = require('express-rate-limit');
const { Logger } = require('../utils/logger');
const { cache } = require('../utils/cache');
const { validateAuditUrl, sanitizeInput } = require('../utils/validation');
const AuditOrchestrator = require('../services/audit-orchestrator');

const router = express.Router();
const logger = new Logger('sitemap-routes');

// Rate limiting for sitemap audits
const sitemapLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 3,
  message: { error: 'Too many sitemap requests, try again later' }
});

/**
 * POST /api/sitemap-audit
 * Analyze multiple pages from a website's sitemap
 */
router.post('/sitemap-audit', sitemapLimiter, async (req, res) => {
  const { url, maxUrls = 50 } = req.body || {};
  
  // Validate input
  const validation = validateAuditUrl(url);
  if (!validation.isValid) {
    return res.status(400).json({ 
      error: 'Invalid URL', 
      details: validation.errors 
    });
  }
  
  const sanitizedUrl = sanitizeInput(url);
  const numUrls = Math.min(Math.max(parseInt(maxUrls) || 50, 1), 200);
  
  // Check cache
  const cacheKey = `sitemap_${sanitizedUrl}_${numUrls}`;
  if (cache.has(cacheKey)) {
    const cached = cache.get(cacheKey);
    logger.info('Returning cached sitemap results', { url: sanitizedUrl, urls: numUrls });
    return res.json(cached);
  }
  
  logger.info('Starting sitemap audit', { url: sanitizedUrl, maxUrls: numUrls });
  
  try {
    const orchestrator = new AuditOrchestrator();
    const results = await orchestrator.runSitemapAudit(sanitizedUrl, { maxUrls: numUrls });
    
    // Cache results for 10 minutes
    cache.set(cacheKey, results, 600000);
    
    logger.info('Sitemap audit completed', { 
      url: sanitizedUrl, 
      pagesAnalyzed: results.pages?.length || 0,
      processingTime: results.processingTime 
    });
    
    res.json(results);
    
  } catch (error) {
    logger.error('Sitemap audit failed', error, { url: sanitizedUrl });
    res.status(500).json({ 
      error: 'Sitemap audit failed', 
      details: error.message 
    });
  }
});

module.exports = router;
