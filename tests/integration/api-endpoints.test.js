// tests/integration/api-endpoints.test.js
// Basic integration tests for API endpoints

const request = require('supertest');
const express = require('express');

// Mock everything to avoid complex dependencies
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
        seo: { score: 85 },
        multiBot: {
          summary: { totalBots: 5, allowed: 3, blocked: 2 },
          botMatrix: { 'Googlebot': { type: 'search' } },
          optimizedRobotsTxt: { recommended: 'User-agent: *\nAllow: /' }
        }
      },
      processingTime: 1000
    })
  }));
});

// Mock audit queue to prevent interval creation
jest.mock('../../services/audit-queue', () => {
  const mockQueue = {
    addJob: jest.fn().mockResolvedValue({ id: 'test-job-1', status: 'pending' }),
    getJob: jest.fn().mockResolvedValue({ id: 'test-job-1', status: 'completed' }),
    getQueue: jest.fn().mockResolvedValue({ pending: 0, processing: 0, completed: 1 }),
    cancelJob: jest.fn().mockResolvedValue(true),
    shutdown: jest.fn().mockResolvedValue(),
    processingInterval: null,
    cleanupIntervalRef: null
  };
  
  return {
    AuditQueue: jest.fn(() => mockQueue),
    getGlobalQueue: jest.fn(() => mockQueue),
    JOB_STATUS: {
      PENDING: 'pending',
      PROCESSING: 'processing', 
      COMPLETED: 'completed',
      FAILED: 'failed',
      CANCELLED: 'cancelled'
    },
    JOB_PRIORITY: {
      LOW: 0,
      NORMAL: 1,
      HIGH: 2,
      URGENT: 3
    }
  };
});

describe('API Integration Tests', () => {
  let app;

  beforeAll(() => {
    app = express();
    app.use(express.json());
    
    // Import routes after all mocking
    const auditRoutes = require('../../routes/audit');
    app.use('/api', auditRoutes);
    
    app.use((err, req, res, next) => {
      res.status(500).json({ error: err.message });
    });
  });
  
  afterAll(async () => {
    // Clean up any remaining intervals or timeouts
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  describe('Basic API Tests', () => {
    test('should handle health check', async () => {
      const response = await request(app)
        .get('/api/health')
        .expect(200);

      expect(response.body).toHaveProperty('status');
      expect(response.body.status).toBe('ok');
    });

    test('should handle missing URL in audit', async () => {
      const response = await request(app)
        .post('/api/audit')
        .send({})
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('URL is required');
    });

    test('should handle cache clear', async () => {
      const response = await request(app)
        .post('/api/cache/clear')
        .expect(200);

      expect(response.body.message).toContain('Cache cleared');
    });

    test('should validate batch URL limits', async () => {
      const tooManyUrls = Array(11).fill('https://example.com');

      const response = await request(app)
        .post('/api/audit/batch')
        .send({ urls: tooManyUrls })
        .expect(400);

      expect(response.body.error).toContain('Maximum 10 URLs allowed');
    });

    test('should handle successful audit with multi-bot analysis', async () => {
      const response = await request(app)
        .post('/api/audit')
        .send({ url: 'https://example.com' })
        .expect(200);

      expect(response.body).toHaveProperty('tests');
      expect(response.body.tests).toHaveProperty('multiBot');
      expect(response.body.tests.multiBot).toHaveProperty('summary');
      expect(response.body.tests.multiBot).toHaveProperty('botMatrix');
      expect(response.body.tests.multiBot).toHaveProperty('optimizedRobotsTxt');
    });
  });
});