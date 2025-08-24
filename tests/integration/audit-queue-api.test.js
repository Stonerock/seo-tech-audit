// tests/integration/audit-queue-api.test.js
// Integration tests for audit queue API endpoints

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

// Mock the audit queue with real functionality for testing
const mockQueue = {
  addJob: jest.fn(),
  getJob: jest.fn(),
  cancelJob: jest.fn(),
  getStatus: jest.fn()
};

jest.mock('../../services/audit-queue', () => ({
  getGlobalQueue: jest.fn(() => mockQueue),
  JOB_STATUS: {
    PENDING: 'pending',
    PROCESSING: 'processing',
    COMPLETED: 'completed',
    FAILED: 'failed',
    CANCELLED: 'cancelled'
  },
  JOB_PRIORITY: {
    LOW: 1,
    NORMAL: 2,
    HIGH: 3,
    URGENT: 4
  }
}));

const { JOB_STATUS, JOB_PRIORITY } = require('../../services/audit-queue');

describe('Audit Queue API Integration Tests', () => {
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

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Set up default mock implementations
    mockQueue.getStatus.mockReturnValue({
      queue: { pending: 0, processing: 0, completed: 0, failed: 0 },
      capacity: { maxConcurrent: 3, currentProcessing: 0, availableSlots: 3 },
      stats: { totalJobs: 0, completedJobs: 0, failedJobs: 0, avgProcessingTime: 0 },
      priorityQueues: { urgent: 0, high: 0, normal: 0, low: 0 }
    });
  });

  describe('POST /api/audit/queue', () => {
    test('should queue audit job successfully', async () => {
      mockQueue.addJob.mockReturnValue({
        jobId: 'job-123',
        status: JOB_STATUS.PENDING,
        position: 1,
        estimatedWait: 5000
      });

      const response = await request(app)
        .post('/api/audit/queue')
        .send({ 
          url: 'https://example.com',
          priority: JOB_PRIORITY.NORMAL
        })
        .expect(202);

      expect(response.body).toMatchObject({
        message: 'Audit job queued successfully',
        job: {
          id: 'job-123',
          url: 'https://example.com',
          status: JOB_STATUS.PENDING,
          position: 1,
          estimatedWait: 5000,
          duplicate: false
        },
        checkStatusUrl: '/api/audit/job/job-123'
      });

      expect(mockQueue.addJob).toHaveBeenCalledWith(
        'https://example.com',
        {},
        JOB_PRIORITY.NORMAL
      );
    });

    test('should handle duplicate jobs', async () => {
      mockQueue.addJob.mockReturnValue({
        jobId: 'job-123',
        status: JOB_STATUS.PENDING,
        position: 1,
        estimatedWait: 5000,
        duplicate: true
      });

      const response = await request(app)
        .post('/api/audit/queue')
        .send({ url: 'https://example.com' })
        .expect(202);

      expect(response.body.job.duplicate).toBe(true);
    });

    test('should validate URL', async () => {
      const response = await request(app)
        .post('/api/audit/queue')
        .send({})
        .expect(400);

      expect(response.body.error).toBe('URL is required');
    });

    test('should validate priority', async () => {
      const response = await request(app)
        .post('/api/audit/queue')
        .send({ 
          url: 'https://example.com',
          priority: 999
        })
        .expect(400);

      expect(response.body.error).toBe('Invalid priority');
      expect(response.body.validPriorities).toEqual([1, 2, 3, 4]);
    });
  });

  describe('GET /api/audit/queue/status', () => {
    test('should return queue status', async () => {
      const mockStatus = {
        queue: { pending: 5, processing: 2, completed: 10, failed: 1 },
        capacity: { maxConcurrent: 3, currentProcessing: 2, availableSlots: 1 },
        stats: { totalJobs: 18, completedJobs: 10, failedJobs: 1, avgProcessingTime: 2500 },
        priorityQueues: { urgent: 0, high: 1, normal: 3, low: 1 }
      };

      mockQueue.getStatus.mockReturnValue(mockStatus);

      const response = await request(app)
        .get('/api/audit/queue/status')
        .expect(200);

      expect(response.body).toMatchObject({
        queue: mockStatus.queue,
        capacity: mockStatus.capacity,
        statistics: mockStatus.stats,
        priorityQueues: mockStatus.priorityQueues
      });

      expect(response.body).toHaveProperty('timestamp');
    });
  });

  describe('GET /api/audit/job/:jobId', () => {
    test('should return pending job details', async () => {
      const mockJob = {
        id: 'job-123',
        url: 'https://example.com',
        status: JOB_STATUS.PENDING,
        priority: JOB_PRIORITY.NORMAL,
        createdAt: new Date('2024-01-01T10:00:00Z'),
        updatedAt: new Date('2024-01-01T10:00:00Z'),
        attempts: 0,
        maxAttempts: 3,
        position: 2,
        estimatedWait: 10000
      };

      mockQueue.getJob.mockReturnValue(mockJob);

      const response = await request(app)
        .get('/api/audit/job/job-123')
        .expect(200);

      expect(response.body).toMatchObject({
        id: 'job-123',
        url: 'https://example.com',
        status: JOB_STATUS.PENDING,
        priority: JOB_PRIORITY.NORMAL,
        position: 2,
        estimatedWait: 10000
      });
    });

    test('should return completed job with results', async () => {
      const mockJob = {
        id: 'job-123',
        url: 'https://example.com',
        status: JOB_STATUS.COMPLETED,
        priority: JOB_PRIORITY.NORMAL,
        createdAt: new Date('2024-01-01T10:00:00Z'),
        updatedAt: new Date('2024-01-01T10:05:00Z'),
        attempts: 1,
        maxAttempts: 3,
        result: { seo: { score: 85 } },
        processingTime: 3000,
        completedAt: new Date('2024-01-01T10:05:00Z')
      };

      mockQueue.getJob.mockReturnValue(mockJob);

      const response = await request(app)
        .get('/api/audit/job/job-123')
        .expect(200);

      expect(response.body).toMatchObject({
        id: 'job-123',
        status: JOB_STATUS.COMPLETED,
        result: { seo: { score: 85 } },
        processingTime: 3000
      });
    });

    test('should return 404 for non-existent job', async () => {
      mockQueue.getJob.mockReturnValue(null);

      const response = await request(app)
        .get('/api/audit/job/non-existent')
        .expect(404);

      expect(response.body.error).toBe('Job not found');
    });
  });

  describe('DELETE /api/audit/job/:jobId', () => {
    test('should cancel job successfully', async () => {
      mockQueue.cancelJob.mockReturnValue(true);

      const response = await request(app)
        .delete('/api/audit/job/job-123')
        .expect(200);

      expect(response.body).toEqual({
        message: 'Job cancelled successfully',
        jobId: 'job-123'
      });

      expect(mockQueue.cancelJob).toHaveBeenCalledWith('job-123');
    });

    test('should handle job not found', async () => {
      mockQueue.cancelJob.mockReturnValue(false);

      const response = await request(app)
        .delete('/api/audit/job/non-existent')
        .expect(404);

      expect(response.body.error).toBe('Job not found or cannot be cancelled');
    });
  });

  describe('POST /api/audit/batch/queue', () => {
    test('should queue multiple jobs successfully', async () => {
      mockQueue.addJob
        .mockReturnValueOnce({
          jobId: 'job-1',
          status: JOB_STATUS.PENDING,
          position: 1,
          estimatedWait: 0
        })
        .mockReturnValueOnce({
          jobId: 'job-2',
          status: JOB_STATUS.PENDING,
          position: 2,
          estimatedWait: 5000
        });

      const response = await request(app)
        .post('/api/audit/batch/queue')
        .send({ 
          urls: ['https://example1.com', 'https://example2.com'],
          priority: JOB_PRIORITY.HIGH
        })
        .expect(202);

      expect(response.body).toMatchObject({
        message: '2 audit jobs queued successfully',
        jobs: [
          { id: 'job-1', url: 'https://example1.com' },
          { id: 'job-2', url: 'https://example2.com' }
        ]
      });

      expect(response.body).toHaveProperty('batchId');
      expect(mockQueue.addJob).toHaveBeenCalledTimes(2);
    });

    test('should validate URLs array', async () => {
      const response = await request(app)
        .post('/api/audit/batch/queue')
        .send({})
        .expect(400);

      expect(response.body.error).toBe('URLs array is required');
    });

    test('should enforce maximum URLs limit', async () => {
      const urls = Array(11).fill('https://example.com');

      const response = await request(app)
        .post('/api/audit/batch/queue')
        .send({ urls })
        .expect(400);

      expect(response.body.error).toBe('Maximum 10 URLs allowed per batch');
    });
  });

  describe('Error Handling', () => {
    test('should handle queue service errors', async () => {
      mockQueue.addJob.mockImplementation(() => {
        throw new Error('Queue service unavailable');
      });

      const response = await request(app)
        .post('/api/audit/queue')
        .send({ url: 'https://example.com' })
        .expect(500);

      expect(response.body.error).toBe('Failed to queue audit job');
      expect(response.body.details).toBe('Queue service unavailable');
    });

    test('should handle status service errors', async () => {
      mockQueue.getStatus.mockImplementation(() => {
        throw new Error('Status service error');
      });

      const response = await request(app)
        .get('/api/audit/queue/status')
        .expect(500);

      expect(response.body.error).toBe('Failed to get queue status');
    });
  });
});