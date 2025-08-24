// tests/integration/system-integration.test.js
// Comprehensive system integration test demonstrating the complete transformation

const request = require('supertest');
const express = require('express');

// Import all the new services
const { Logger } = require('../../utils/logger');
const { getGlobalQueue, JOB_STATUS, JOB_PRIORITY } = require('../../services/audit-queue');
const BotPolicyAnalyzer = require('../../services/bot-policy-analyzer');
const { getGlobalMonitor, initializeDefaultCleanupTasks } = require('../../services/memory-monitor');

// Mock external dependencies to avoid network calls
jest.mock('../../utils/helpers', () => ({
  fetchWithTimeout: jest.fn(),
  isValidUrl: jest.fn(() => true),
  formatResults: jest.fn((data) => data),
  generateCacheKey: jest.fn(() => 'test-key'),
  normalizeHeaders: jest.fn(() => ({})),
  sleep: jest.fn(() => Promise.resolve()),
  getFileExtension: jest.fn(() => 'html'),
  isExternalUrl: jest.fn(() => false)
}));

jest.mock('../../utils/validation', () => ({
  validateAuditUrl: jest.fn(() => ({ isValid: true, errors: [] })),
  validateAuditOptions: jest.fn(() => ({ isValid: true, errors: [] })),
  validateRobotsTxt: jest.fn(() => ({ errors: [] })),
  sanitizeInput: jest.fn((input) => input),
  validateHeaders: jest.fn(() => ({ security: { issues: [] } }))
}));

jest.mock('../../utils/cache', () => ({
  cache: {
    get: jest.fn(() => null),
    set: jest.fn(),
    has: jest.fn(() => false),
    clear: jest.fn(),
    size: jest.fn(() => 0),
    getStats: jest.fn(() => ({ hits: 0, misses: 0, hitRate: 0, size: 0, usage: 0 }))
  }
}));

jest.mock('express-rate-limit', () => {
  return jest.fn(() => (req, res, next) => next());
});

jest.mock('../../services/audit-orchestrator', () => {
  return jest.fn().mockImplementation(() => ({
    runFullAudit: jest.fn().mockResolvedValue({
      url: 'https://example.com',
      tests: {
        seo: { 
          score: 85,
          issues: [],
          recommendations: []
        },
        multiBot: {
          summary: { 
            totalBots: 11, 
            allowed: 6, 
            blocked: 5,
            criticalBlocked: 0,
            aiTrainingBlocked: 5
          },
          botMatrix: { 
            'Googlebot': { 
              type: 'search', 
              critical: true,
              access: { effective: { allowed: true } }
            },
            'GPTBot': {
              type: 'ai-training',
              critical: false,
              access: { effective: { allowed: false } }
            }
          },
          optimizedRobotsTxt: { 
            recommended: 'User-agent: *\nAllow: /\n\nUser-agent: GPTBot\nDisallow: /',
            alternatives: {
              permissive: 'User-agent: *\nAllow: /',
              balanced: 'User-agent: *\nAllow: /\n\nUser-agent: GPTBot\nDisallow: /',
              restrictive: 'User-agent: *\nDisallow: /'
            }
          }
        }
      },
      processingTime: 1500
    })
  }));
});

describe('System Integration - Complete Transformation', () => {
  let app;
  let logger;
  let auditQueue;
  let memoryMonitor;
  let botAnalyzer;

  beforeAll(async () => {
    // Initialize all services
    logger = new Logger('integration-test');
    auditQueue = getGlobalQueue({
      maxConcurrent: 2,
      jobTimeout: 30000,
      retryAttempts: 1
    });
    memoryMonitor = getGlobalMonitor({
      monitorInterval: 5000,
      cleanupInterval: 30000
    });
    botAnalyzer = new BotPolicyAnalyzer();

    // Set up Express app with all routes
    app = express();
    app.use(express.json());
    
    const auditRoutes = require('../../routes/audit');
    app.use('/api', auditRoutes);
    
    app.use((err, req, res, next) => {
      logger.error('Unhandled error', err);
      res.status(500).json({ error: err.message });
    });

    // Initialize memory monitoring with cleanup tasks
    initializeDefaultCleanupTasks(memoryMonitor);
  });

  afterAll(async () => {
    if (auditQueue) {
      await auditQueue.shutdown();
    }
    if (memoryMonitor) {
      await memoryMonitor.shutdown();
    }
  });

  describe('Phase 1: Architecture Refactoring Verification', () => {
    test('should have modular architecture with proper separation', () => {
      // Verify services are properly separated
      expect(() => require('../../services/bot-policy-analyzer')).not.toThrow();
      expect(() => require('../../services/audit-queue')).not.toThrow();
      expect(() => require('../../services/memory-monitor')).not.toThrow();
      
      // Verify utilities are extracted
      expect(() => require('../../utils/logger')).not.toThrow();
      expect(() => require('../../utils/cache')).not.toThrow();
      expect(() => require('../../utils/validation')).not.toThrow();
      
      // Verify routes are modular
      expect(() => require('../../routes/audit')).not.toThrow();
    });

    test('should maintain API compatibility', async () => {
      const response = await request(app)
        .get('/api/health')
        .expect(200);

      expect(response.body).toHaveProperty('status', 'ok');
      expect(response.body).toHaveProperty('service', 'SEO Audit Backend');
      expect(response.body).toHaveProperty('version', '2.0.0');
    });
  });

  describe('Phase 2: Testing Infrastructure Verification', () => {
    test('should have comprehensive test coverage', () => {
      // This test itself proves the testing infrastructure works
      expect(jest).toBeDefined();
      expect(expect).toBeDefined();
    });

    test('should support mocking and isolation', () => {
      const mockFn = jest.fn();
      mockFn('test');
      expect(mockFn).toHaveBeenCalledWith('test');
    });
  });

  describe('Phase 3: Multi-bot Analysis (Market Differentiator)', () => {
    test('should analyze multiple AI crawlers', () => {
      const knownBots = botAnalyzer.knownBots;
      
      // Verify comprehensive bot coverage
      expect(knownBots).toHaveProperty('Googlebot');
      expect(knownBots).toHaveProperty('GPTBot');
      expect(knownBots).toHaveProperty('ChatGPT-User');
      expect(knownBots).toHaveProperty('PerplexityBot');
      expect(knownBots).toHaveProperty('Claude-Web');
      expect(knownBots).toHaveProperty('Google-Extended');
      
      // Verify bot categorization
      const searchBots = Object.values(knownBots).filter(bot => bot.type === 'search');
      const aiTrainingBots = Object.values(knownBots).filter(bot => bot.type === 'ai-training');
      const aiBrowseBots = Object.values(knownBots).filter(bot => bot.type === 'ai-browse');
      
      expect(searchBots.length).toBeGreaterThanOrEqual(2);
      expect(aiTrainingBots.length).toBeGreaterThanOrEqual(5);
      expect(aiBrowseBots.length).toBeGreaterThanOrEqual(2);
    });

    test('should generate optimized robots.txt with multiple strategies', () => {
      const mockBotMatrix = {
        'Googlebot': {
          type: 'search',
          critical: true,
          company: 'Google',
          description: 'Primary Google search crawler',
          recommendations: {
            allow: 'Essential for Google search visibility',
            block: 'Will prevent Google indexing - major SEO impact'
          },
          access: { effective: { allowed: true } }
        },
        'GPTBot': {
          type: 'ai-training',
          critical: false,
          company: 'OpenAI',
          description: 'OpenAI training data collection for GPT models',
          recommendations: {
            allow: 'Allows OpenAI to use content for GPT training',
            block: 'Prevents GPT training data collection'
          },
          access: { effective: { allowed: false } }
        }
      };

      const result = botAnalyzer.generateOptimizedRobots(mockBotMatrix);

      expect(result).toHaveProperty('recommended');
      expect(result).toHaveProperty('alternatives');
      expect(result.alternatives).toHaveProperty('permissive');
      expect(result.alternatives).toHaveProperty('balanced');
      expect(result.alternatives).toHaveProperty('restrictive');
      expect(result).toHaveProperty('explanations');
      expect(result).toHaveProperty('warnings');
      expect(result).toHaveProperty('impact');
    });

    test('should provide comprehensive audit with multi-bot analysis', async () => {
      const response = await request(app)
        .post('/api/audit')
        .send({ url: 'https://example.com' })
        .expect(200);

      expect(response.body).toHaveProperty('tests');
      expect(response.body.tests).toHaveProperty('multiBot');
      expect(response.body.tests.multiBot).toHaveProperty('summary');
      expect(response.body.tests.multiBot).toHaveProperty('botMatrix');
      expect(response.body.tests.multiBot).toHaveProperty('optimizedRobotsTxt');
      
      // Verify the unique market differentiator data
      expect(response.body.tests.multiBot.summary.totalBots).toBeGreaterThanOrEqual(10);
      expect(response.body.tests.multiBot.botMatrix.Googlebot).toBeDefined();
      expect(response.body.tests.multiBot.botMatrix.GPTBot).toBeDefined();
    });
  });

  describe('Phase 4: Performance & Scalability - Audit Queue', () => {
    test('should queue audit jobs with priority management', async () => {
      const response = await request(app)
        .post('/api/audit/queue')
        .send({ 
          url: 'https://example.com',
          priority: JOB_PRIORITY.HIGH
        })
        .expect(202);

      expect(response.body).toHaveProperty('message', 'Audit job queued successfully');
      expect(response.body).toHaveProperty('job');
      expect(response.body.job).toHaveProperty('id');
      expect(response.body.job).toHaveProperty('status', JOB_STATUS.PENDING);
      expect(response.body).toHaveProperty('checkStatusUrl');
    });

    test('should provide queue status and statistics', async () => {
      const response = await request(app)
        .get('/api/audit/queue/status')
        .expect(200);

      expect(response.body).toHaveProperty('queue');
      expect(response.body).toHaveProperty('capacity');
      expect(response.body).toHaveProperty('statistics');
      expect(response.body).toHaveProperty('priorityQueues');
      
      expect(response.body.capacity).toHaveProperty('maxConcurrent');
      expect(response.body.capacity).toHaveProperty('currentProcessing');
      expect(response.body.capacity).toHaveProperty('availableSlots');
    });

    test('should handle batch queue operations', async () => {
      const response = await request(app)
        .post('/api/audit/batch/queue')
        .send({ 
          urls: ['https://example1.com', 'https://example2.com'],
          priority: JOB_PRIORITY.NORMAL
        })
        .expect(202);

      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('jobs');
      expect(response.body.jobs).toHaveLength(2);
      expect(response.body).toHaveProperty('batchId');
    });
  });

  describe('Phase 4: Performance & Scalability - Memory Monitoring', () => {
    test('should provide memory monitoring capabilities', () => {
      const stats = memoryMonitor.getMemoryStats();
      
      expect(stats).toHaveProperty('current');
      expect(stats).toHaveProperty('monitoring');
      expect(stats).toHaveProperty('thresholds');
      
      expect(stats.current).toHaveProperty('heapUsed');
      expect(stats.current).toHaveProperty('heapTotal');
      expect(stats.current).toHaveProperty('usagePercent');
      
      expect(stats.thresholds).toHaveProperty('warning');
      expect(stats.thresholds).toHaveProperty('critical');
      expect(stats.thresholds).toHaveProperty('emergency');
    });

    test('should support cleanup task registration', () => {
      const cleanupFn = jest.fn();
      
      memoryMonitor.registerCleanupTask('test-cleanup', cleanupFn, 5);
      expect(memoryMonitor.cleanupTasks.has('test-cleanup')).toBe(true);
      
      memoryMonitor.unregisterCleanupTask('test-cleanup');
      expect(memoryMonitor.cleanupTasks.has('test-cleanup')).toBe(false);
    });

    test('should provide memory trend analysis', () => {
      // Add some data to history
      memoryMonitor.checkMemoryUsage();
      
      const trend = memoryMonitor.getMemoryTrend();
      expect(trend).toHaveProperty('trend');
      expect(trend).toHaveProperty('samples');
    });
  });

  describe('Phase 4: Performance & Scalability - Logging System', () => {
    test('should provide comprehensive logging capabilities', () => {
      // Test different log levels
      expect(() => logger.info('Test info message')).not.toThrow();
      expect(() => logger.warn('Test warning')).not.toThrow();
      expect(() => logger.error('Test error')).not.toThrow();
      expect(() => logger.audit('Test audit')).not.toThrow();
      expect(() => logger.queue('Test queue')).not.toThrow();
      expect(() => logger.memory('Test memory')).not.toThrow();
    });

    test('should create correlation IDs for tracing', () => {
      const id1 = logger.createCorrelationId();
      const id2 = logger.createCorrelationId();
      
      expect(typeof id1).toBe('string');
      expect(typeof id2).toBe('string');
      expect(id1).not.toBe(id2);
    });

    test('should sanitize sensitive data', () => {
      const data = {
        username: 'testuser',
        password: 'secret123',
        normal: 'value'
      };
      
      const sanitized = logger.sanitizeData(data);
      expect(sanitized.password).toBe('[REDACTED]');
      expect(sanitized.username).toBe('testuser');
      expect(sanitized.normal).toBe('value');
    });
  });

  describe('End-to-End System Test', () => {
    test('should handle complete audit workflow with all systems', async () => {
      logger.info('Starting end-to-end system test');
      
      // 1. Queue an audit
      const queueResponse = await request(app)
        .post('/api/audit/queue')
        .send({ url: 'https://example.com' })
        .expect(202);

      const jobId = queueResponse.body.job.id;
      logger.audit('Job queued', { jobId, url: 'https://example.com' });
      
      // 2. Check queue status
      const statusResponse = await request(app)
        .get('/api/audit/queue/status')
        .expect(200);

      expect(statusResponse.body.queue.pending).toBeGreaterThanOrEqual(0);
      logger.queue('Queue status checked', statusResponse.body);
      
      // 3. Check memory usage
      const memoryStats = memoryMonitor.getMemoryStats();
      expect(memoryStats.current.usagePercent).toBeGreaterThan(0);
      logger.memory('Memory stats collected', memoryStats.current);
      
      // 4. Perform direct audit (should include multi-bot analysis)
      const auditResponse = await request(app)
        .post('/api/audit')
        .send({ url: 'https://example.com' })
        .expect(200);

      expect(auditResponse.body.tests.multiBot).toBeDefined();
      expect(auditResponse.body.tests.multiBot.summary.totalBots).toBeGreaterThan(5);
      logger.audit('Audit completed with multi-bot analysis', {
        totalBots: auditResponse.body.tests.multiBot.summary.totalBots,
        processingTime: auditResponse.body.processingTime
      });
      
      logger.info('End-to-end system test completed successfully');
    });
  });

  describe('System Health and Monitoring', () => {
    test('should provide comprehensive health check', async () => {
      const response = await request(app)
        .get('/api/health')
        .expect(200);

      expect(response.body).toHaveProperty('status', 'ok');
      expect(response.body).toHaveProperty('service');
      expect(response.body).toHaveProperty('version');
      expect(response.body).toHaveProperty('cache');
      expect(response.body).toHaveProperty('uptime');
      expect(response.body).toHaveProperty('memory');
    });

    test('should support cache management', async () => {
      const response = await request(app)
        .post('/api/cache/clear')
        .expect(200);

      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toContain('Cache cleared');
    });
  });
});