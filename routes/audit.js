// routes/audit.js
// Main audit API endpoints

const express = require('express');
const rateLimit = require('express-rate-limit');
const AuditOrchestrator = require('../services/audit-orchestrator');
const { getGlobalQueue, JOB_STATUS, JOB_PRIORITY } = require('../services/audit-queue');
const { cache } = require('../utils/cache');
const { validateAuditUrl } = require('../utils/validation');

const router = express.Router();

// Initialize global audit queue
const auditQueue = getGlobalQueue({
  maxConcurrent: 3,
  jobTimeout: 60000,
  retryAttempts: 2
});

// Rate limiting for audit endpoints
const auditLimiter = rateLimit({ 
  windowMs: 60 * 1000, // 1 minute
  max: 10, // 10 requests per minute
  message: { error: 'Too many audit requests, please try again later' }
});

/**
 * POST /api/audit
 * Main audit endpoint - analyzes a single URL comprehensively
 */
router.post('/audit', auditLimiter, async (req, res) => {
  const { url, lighthouse: lhFlag, options = {} } = req.body || {};
  
  // Validate URL
  if (!url) {
    return res.status(400).json({ error: 'URL is required' });
  }

  const urlValidation = validateAuditUrl(url);
  if (!urlValidation.isValid) {
    return res.status(400).json({ 
      error: 'Invalid URL',
      details: urlValidation.errors 
    });
  }

  // Check cache first
  const cacheKey = `audit_${url}_${JSON.stringify(options)}`;
  if (cache.has(cacheKey)) {
    const cached = cache.get(cacheKey);
    console.log(`📦 Returning cached results for ${url}`);
    return res.json({
      ...cached,
      cached: true,
      cacheAge: cached.cacheAge
    });
  }

  console.log(`🔍 Starting audit for ${url}`);
  
  try {
    const orchestrator = new AuditOrchestrator();
    const auditOptions = {
      ...options,
      lighthouse: Boolean(lhFlag) || process.env.LIGHTHOUSE === '1'
    };

    const results = await orchestrator.runFullAudit(url, auditOptions);
    
    // Cache the results
    cache.set(cacheKey, results);
    
    console.log(`✅ Audit completed for ${url} in ${results.processingTime}ms`);
    res.json(results);
    
  } catch (error) {
    console.error('❌ Audit error:', error);
    
    // Determine appropriate error status
    let status = 500;
    if (error.message.includes('Invalid URL')) status = 400;
    if (error.message.includes('timeout')) status = 408;
    if (error.message.includes('network')) status = 502;
    
    res.status(status).json({ 
      error: 'Audit failed', 
      details: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /api/health
 * Health check endpoint
 */
router.get('/health', (req, res) => {
  const cacheStats = cache.getStats();
  
  res.json({ 
    status: 'ok', 
    service: 'SEO Audit Backend',
    version: '2.0.0',
    timestamp: new Date().toISOString(),
    cache: {
      size: cacheStats.size,
      hitRate: cacheStats.hitRate,
      usage: `${cacheStats.usage}%`
    },
    uptime: process.uptime(),
    memory: {
      rss: Math.round(process.memoryUsage().rss / 1024 / 1024),
      heapUsed: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
      heapTotal: Math.round(process.memoryUsage().heapTotal / 1024 / 1024)
    }
  });
});

/**
 * POST /api/cache/clear
 * Clear cache endpoint
 */
router.post('/cache/clear', (req, res) => {
  const sizeBefore = cache.size();
  const statsBefore = cache.getStats();
  
  cache.clear();
  
  console.log(`🗑️ Cache cleared - removed ${sizeBefore} items`);
  
  res.json({ 
    message: 'Cache cleared successfully',
    itemsRemoved: sizeBefore,
    statsBefore: {
      size: statsBefore.size,
      hitRate: statsBefore.hitRate,
      usage: statsBefore.usage
    }
  });
});

/**
 * GET /api/cache/stats
 * Get cache statistics
 */
router.get('/cache/stats', (req, res) => {
  const stats = cache.getStats();
  
  res.json({
    cache: stats,
    timestamp: new Date().toISOString()
  });
});

/**
 * POST /api/audit/batch
 * Batch audit endpoint for multiple URLs
 */
router.post('/audit/batch', auditLimiter, async (req, res) => {
  const { urls, options = {} } = req.body || {};
  
  if (!Array.isArray(urls) || urls.length === 0) {
    return res.status(400).json({ error: 'URLs array is required' });
  }

  if (urls.length > 10) {
    return res.status(400).json({ error: 'Maximum 10 URLs allowed per batch' });
  }

  // Validate all URLs first
  const urlValidations = urls.map(url => ({
    url,
    validation: validateAuditUrl(url)
  }));

  const invalidUrls = urlValidations.filter(v => !v.validation.isValid);
  if (invalidUrls.length > 0) {
    return res.status(400).json({
      error: 'Invalid URLs found',
      invalidUrls: invalidUrls.map(v => ({
        url: v.url,
        errors: v.validation.errors
      }))
    });
  }

  console.log(`🔍 Starting batch audit for ${urls.length} URLs`);

  try {
    const orchestrator = new AuditOrchestrator();
    const results = [];
    
    // Process URLs sequentially to avoid overwhelming the system
    for (const url of urls) {
      try {
        const result = await orchestrator.runFullAudit(url, options);
        results.push({
          url,
          status: 'success',
          result
        });
      } catch (error) {
        results.push({
          url,
          status: 'error',
          error: error.message
        });
      }
    }

    const successful = results.filter(r => r.status === 'success').length;
    const failed = results.filter(r => r.status === 'error').length;

    console.log(`✅ Batch audit completed: ${successful} successful, ${failed} failed`);

    res.json({
      summary: {
        total: urls.length,
        successful,
        failed,
        processingTime: Date.now() - Date.now() // Would need to track start time
      },
      results
    });

  } catch (error) {
    console.error('❌ Batch audit error:', error);
    res.status(500).json({ 
      error: 'Batch audit failed', 
      details: error.message 
    });
  }
});

/**
 * POST /api/audit/queue
 * Add audit job to queue - returns immediately with job ID
 */
router.post('/audit/queue', auditLimiter, async (req, res) => {
  const { url, priority = JOB_PRIORITY.NORMAL, options = {} } = req.body || {};
  
  // Validate URL
  if (!url) {
    return res.status(400).json({ error: 'URL is required' });
  }

  const urlValidation = validateAuditUrl(url);
  if (!urlValidation.isValid) {
    return res.status(400).json({ 
      error: 'Invalid URL',
      details: urlValidation.errors 
    });
  }

  // Validate priority
  const validPriorities = Object.values(JOB_PRIORITY);
  if (!validPriorities.includes(priority)) {
    return res.status(400).json({ 
      error: 'Invalid priority',
      validPriorities
    });
  }

  console.log(`📋 Adding audit job to queue for ${url} (priority: ${priority})`);
  
  try {
    const jobInfo = auditQueue.addJob(url, options, priority);
    
    res.status(202).json({
      message: 'Audit job queued successfully',
      job: {
        id: jobInfo.jobId,
        url,
        status: jobInfo.status,
        position: jobInfo.position,
        estimatedWait: jobInfo.estimatedWait,
        duplicate: jobInfo.duplicate || false
      },
      checkStatusUrl: `/api/audit/job/${jobInfo.jobId}`
    });
    
  } catch (error) {
    console.error('❌ Queue job error:', error);
    res.status(500).json({ 
      error: 'Failed to queue audit job', 
      details: error.message
    });
  }
});

/**
 * GET /api/audit/queue/status
 * Get current audit queue status and statistics
 */
router.get('/audit/queue/status', (req, res) => {
  try {
    const status = auditQueue.getStatus();
    
    res.json({
      queue: status.queue,
      capacity: status.capacity,
      statistics: status.stats,
      priorityQueues: status.priorityQueues,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Queue status error:', error);
    res.status(500).json({ 
      error: 'Failed to get queue status', 
      details: error.message
    });
  }
});

/**
 * GET /api/audit/job/:jobId
 * Get specific job status and result
 */
router.get('/audit/job/:jobId', (req, res) => {
  const { jobId } = req.params;
  
  if (!jobId) {
    return res.status(400).json({ error: 'Job ID is required' });
  }
  
  try {
    const job = auditQueue.getJob(jobId);
    
    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }
    
    const response = {
      id: job.id,
      url: job.url,
      status: job.status,
      priority: job.priority,
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
      attempts: job.attempts,
      maxAttempts: job.maxAttempts
    };
    
    // Add status-specific information
    if (job.status === JOB_STATUS.PENDING) {
      response.position = job.position;
      response.estimatedWait = job.estimatedWait;
    } else if (job.status === JOB_STATUS.PROCESSING) {
      response.startedAt = job.startedAt;
      response.estimatedDuration = job.estimatedDuration;
    } else if (job.status === JOB_STATUS.COMPLETED) {
      response.result = job.result;
      response.processingTime = job.processingTime;
      response.completedAt = job.completedAt;
    } else if (job.status === JOB_STATUS.FAILED) {
      response.error = job.error;
      response.completedAt = job.completedAt;
    }
    
    res.json(response);
    
  } catch (error) {
    console.error('❌ Job status error:', error);
    res.status(500).json({ 
      error: 'Failed to get job status', 
      details: error.message
    });
  }
});

/**
 * DELETE /api/audit/job/:jobId
 * Cancel a pending audit job
 */
router.delete('/audit/job/:jobId', (req, res) => {
  const { jobId } = req.params;
  
  if (!jobId) {
    return res.status(400).json({ error: 'Job ID is required' });
  }
  
  try {
    const cancelled = auditQueue.cancelJob(jobId);
    
    if (!cancelled) {
      return res.status(404).json({ 
        error: 'Job not found or cannot be cancelled',
        details: 'Job may have already started processing or completed'
      });
    }
    
    res.json({
      message: 'Job cancelled successfully',
      jobId
    });
    
  } catch (error) {
    console.error('❌ Job cancellation error:', error);
    res.status(500).json({ 
      error: 'Failed to cancel job', 
      details: error.message
    });
  }
});

/**
 * POST /api/audit/batch/queue
 * Add multiple audit jobs to queue
 */
router.post('/audit/batch/queue', auditLimiter, async (req, res) => {
  const { urls, priority = JOB_PRIORITY.NORMAL, options = {} } = req.body || {};
  
  if (!Array.isArray(urls) || urls.length === 0) {
    return res.status(400).json({ error: 'URLs array is required' });
  }

  if (urls.length > 10) {
    return res.status(400).json({ error: 'Maximum 10 URLs allowed per batch' });
  }

  // Validate all URLs first
  const urlValidations = urls.map(url => ({
    url,
    validation: validateAuditUrl(url)
  }));

  const invalidUrls = urlValidations.filter(v => !v.validation.isValid);
  if (invalidUrls.length > 0) {
    return res.status(400).json({
      error: 'Invalid URLs found',
      invalidUrls: invalidUrls.map(v => ({
        url: v.url,
        errors: v.validation.errors
      }))
    });
  }

  console.log(`📋 Adding ${urls.length} audit jobs to queue (priority: ${priority})`);

  try {
    const jobs = [];
    
    // Add each URL as a separate job
    for (const url of urls) {
      const jobInfo = auditQueue.addJob(url, options, priority);
      jobs.push({
        id: jobInfo.jobId,
        url,
        status: jobInfo.status,
        position: jobInfo.position,
        estimatedWait: jobInfo.estimatedWait,
        duplicate: jobInfo.duplicate || false
      });
    }

    res.status(202).json({
      message: `${jobs.length} audit jobs queued successfully`,
      jobs,
      batchId: `batch_${Date.now()}`,
      checkStatusUrl: '/api/audit/queue/status'
    });
    
  } catch (error) {
    console.error('❌ Batch queue error:', error);
    res.status(500).json({ 
      error: 'Failed to queue batch audit jobs', 
      details: error.message
    });
  }
});

module.exports = router;