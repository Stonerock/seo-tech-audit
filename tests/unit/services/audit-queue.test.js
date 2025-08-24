// tests/unit/services/audit-queue.test.js
// Unit tests for the audit queue service

const { AuditQueue, JOB_STATUS, JOB_PRIORITY } = require('../../../services/audit-queue');

// Mock the audit orchestrator
jest.mock('../../../services/audit-orchestrator', () => {
  const mockRunFullAudit = jest.fn();
  return jest.fn().mockImplementation(() => ({
    runFullAudit: mockRunFullAudit
  }));
});

const AuditOrchestrator = require('../../../services/audit-orchestrator');

describe('Services - AuditQueue', () => {
  let queue;
  let mockRunFullAudit;

  beforeEach(() => {
    // Clear all mocks first
    jest.clearAllMocks();
    
    // Get the mock function reference
    const MockAuditOrchestrator = require('../../../services/audit-orchestrator');
    const mockInstance = new MockAuditOrchestrator();
    mockRunFullAudit = mockInstance.runFullAudit;
    
    // Create a new queue for each test in test mode (no intervals)
    queue = new AuditQueue({
      maxConcurrent: 2,
      jobTimeout: 5000,
      retryAttempts: 1,
      cleanupInterval: 60000,
      testMode: true, // Prevent intervals from starting
      orchestratorFactory: () => mockInstance
    });
  });

  afterEach(async () => {
    if (queue) {
      // Remove all listeners and shutdown properly
      queue.removeAllListeners();
      await queue.forceShutdown();
      queue = null;
    }
  });

  describe('Job Management', () => {
    test('should add job to queue', () => {
      const result = queue.addJob('https://example.com', {}, JOB_PRIORITY.NORMAL);

      expect(result).toHaveProperty('jobId');
      expect(result).toHaveProperty('status', JOB_STATUS.PENDING);
      expect(result).toHaveProperty('position');
      expect(result).toHaveProperty('estimatedWait');
      expect(queue.pending.size).toBe(1);
    });

    test('should detect duplicate jobs', () => {
      const url = 'https://example.com';
      const options = { lighthouse: true };

      const result1 = queue.addJob(url, options, JOB_PRIORITY.NORMAL);
      const result2 = queue.addJob(url, options, JOB_PRIORITY.NORMAL);

      expect(result2.duplicate).toBe(true);
      expect(result2.jobId).toBe(result1.jobId);
      expect(queue.pending.size).toBe(1);
    });

    test('should get job information', () => {
      const result = queue.addJob('https://example.com', {}, JOB_PRIORITY.HIGH);
      const job = queue.getJob(result.jobId);

      expect(job).toBeTruthy();
      expect(job.id).toBe(result.jobId);
      expect(job.url).toBe('https://example.com');
      expect(job.priority).toBe(JOB_PRIORITY.HIGH);
      expect(job.status).toBe(JOB_STATUS.PENDING);
    });

    test('should return null for non-existent job', () => {
      const job = queue.getJob('non-existent-id');
      expect(job).toBeNull();
    });

    test('should cancel pending job', () => {
      const result = queue.addJob('https://example.com', {}, JOB_PRIORITY.NORMAL);
      const cancelled = queue.cancelJob(result.jobId);

      expect(cancelled).toBe(true);
      expect(queue.pending.size).toBe(0);
      expect(queue.failed.size).toBe(1);

      const job = queue.getJob(result.jobId);
      expect(job.status).toBe(JOB_STATUS.CANCELLED);
    });

    test('should not cancel non-existent job', () => {
      const cancelled = queue.cancelJob('non-existent-id');
      expect(cancelled).toBe(false);
    });
  });

  describe('Priority Queuing', () => {
    test('should process jobs by priority order', () => {
      // Add jobs with different priorities
      const lowJob = queue.addJob('https://low.com', {}, JOB_PRIORITY.LOW);
      const normalJob = queue.addJob('https://normal.com', {}, JOB_PRIORITY.NORMAL);
      const highJob = queue.addJob('https://high.com', {}, JOB_PRIORITY.HIGH);
      const urgentJob = queue.addJob('https://urgent.com', {}, JOB_PRIORITY.URGENT);

      // Check positions (higher priority should have lower position numbers)
      expect(queue.getJob(urgentJob.jobId).position).toBe(1);
      expect(queue.getJob(highJob.jobId).position).toBe(2);
      expect(queue.getJob(normalJob.jobId).position).toBe(3);
      expect(queue.getJob(lowJob.jobId).position).toBe(4);
    });

    test('should calculate estimated wait times', () => {
      // Add multiple jobs
      const job1 = queue.addJob('https://example1.com', {}, JOB_PRIORITY.NORMAL);
      const job2 = queue.addJob('https://example2.com', {}, JOB_PRIORITY.NORMAL);
      const job3 = queue.addJob('https://example3.com', {}, JOB_PRIORITY.NORMAL);

      const wait1 = queue.estimateWaitTime(job1.jobId);
      const wait2 = queue.estimateWaitTime(job2.jobId);
      const wait3 = queue.estimateWaitTime(job3.jobId);

      expect(wait1).toBe(0); // First job, no wait
      expect(wait2).toBeGreaterThanOrEqual(wait1);
      expect(wait3).toBeGreaterThanOrEqual(wait2);
    });
  });

  describe('Queue Status', () => {
    test('should return accurate queue status', () => {
      // Add some jobs
      queue.addJob('https://example1.com', {}, JOB_PRIORITY.HIGH);
      queue.addJob('https://example2.com', {}, JOB_PRIORITY.NORMAL);
      queue.addJob('https://example3.com', {}, JOB_PRIORITY.LOW);

      const status = queue.getStatus();

      expect(status.queue.pending).toBe(3);
      expect(status.queue.processing).toBe(0);
      expect(status.capacity.maxConcurrent).toBe(2);
      expect(status.capacity.availableSlots).toBe(2);
      expect(status.priorityQueues.high).toBe(1);
      expect(status.priorityQueues.normal).toBe(1);
      expect(status.priorityQueues.low).toBe(1);
    });

    test('should track statistics correctly', () => {
      const status = queue.getStatus();

      expect(status.stats).toHaveProperty('totalJobs');
      expect(status.stats).toHaveProperty('completedJobs');
      expect(status.stats).toHaveProperty('failedJobs');
      expect(status.stats).toHaveProperty('avgProcessingTime');
      expect(status.stats).toHaveProperty('uptime');
    });
  });

  describe('Job Processing', () => {
    test('should process job successfully', async () => {
      const mockResult = {
        url: 'https://example.com',
        tests: { seo: { score: 85 } },
        processingTime: 1000
      };

      mockRunFullAudit.mockResolvedValue(mockResult);

      const result = queue.addJob('https://example.com', {}, JOB_PRIORITY.NORMAL);
      
      // Wait for job to be processed using manual processing
      const jobCompletedPromise = new Promise((resolve) => {
        queue.on('jobCompleted', (job) => {
          expect(job.id).toBe(result.jobId);
          expect(job.status).toBe(JOB_STATUS.COMPLETED);
          expect(job.result).toEqual(mockResult);
          expect(job.processingTime).toBeGreaterThan(0);
          resolve();
        });
      });
      
      // Manually trigger processing
      await queue.manualProcess();
      await jobCompletedPromise;

      expect(queue.processing.size).toBe(0);
      expect(queue.completed.size).toBe(1);
      expect(queue.stats.completedJobs).toBe(1);
    }, 10000);

    test('should handle job failure and retry', async () => {
      mockRunFullAudit
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({ url: 'https://example.com', tests: {} });

      const result = queue.addJob('https://example.com', {}, JOB_PRIORITY.NORMAL);
      
      let retryEventFired = false;
      let completedEventFired = false;

      queue.on('jobRetry', (job) => {
        expect(job.id).toBe(result.jobId);
        expect(job.attempts).toBe(1);
        retryEventFired = true;
      });

      const jobCompletedPromise = new Promise((resolve) => {
        queue.on('jobCompleted', (job) => {
          expect(job.id).toBe(result.jobId);
          expect(job.attempts).toBe(2);
          completedEventFired = true;
          resolve();
        });
      });
      
      // Manually trigger processing multiple times for retry
      await queue.manualProcess();
      await queue.manualProcess();
      await jobCompletedPromise;

      expect(retryEventFired).toBe(true);
      expect(completedEventFired).toBe(true);
      expect(queue.stats.completedJobs).toBeGreaterThanOrEqual(1);
    }, 10000);

    test('should fail job permanently after max retries', async () => {
      mockRunFullAudit.mockRejectedValue(new Error('Persistent error'));

      const result = queue.addJob('https://example.com', {}, JOB_PRIORITY.NORMAL);
      
      const jobFailedPromise = new Promise((resolve) => {
        queue.on('jobFailed', (job) => {
          expect(job.id).toBe(result.jobId);
          expect(job.status).toBe(JOB_STATUS.FAILED);
          expect(job.attempts).toBe(2); // Original + 1 retry
          expect(job.error).toBe('Persistent error');
          resolve();
        });
      });
      
      // Manually trigger processing multiple times
      await queue.manualProcess();
      await queue.manualProcess();
      await jobFailedPromise;

      expect(queue.failed.size).toBe(1);
      expect(queue.stats.failedJobs).toBe(1);
    }, 10000);

    test('should respect concurrency limits', async () => {
      // Mock a slow audit
      mockRunFullAudit.mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve({ url: 'test', tests: {} }), 100))
      );

      // Add more jobs than max concurrent
      queue.addJob('https://example1.com', {}, JOB_PRIORITY.NORMAL);
      queue.addJob('https://example2.com', {}, JOB_PRIORITY.NORMAL);
      queue.addJob('https://example3.com', {}, JOB_PRIORITY.NORMAL);

      // Start processing
      queue.manualProcess();
      
      // Check immediately - should not exceed concurrency
      await new Promise(resolve => setTimeout(resolve, 50));

      const status = queue.getStatus();
      expect(status.queue.processing).toBeLessThanOrEqual(queue.maxConcurrent);
      expect(status.queue.pending).toBeGreaterThan(0);
    }, 5000);
  });

  describe('Job Events', () => {
    test('should emit jobAdded event', () => {
      let eventFired = false;
      
      queue.on('jobAdded', (job) => {
        expect(job.url).toBe('https://example.com');
        expect(job.status).toBe(JOB_STATUS.PENDING);
        eventFired = true;
      });

      queue.addJob('https://example.com', {}, JOB_PRIORITY.NORMAL);
      expect(eventFired).toBe(true);
    });

    test('should emit jobCancelled event', () => {
      let eventFired = false;
      
      queue.on('jobCancelled', (job) => {
        expect(job.status).toBe(JOB_STATUS.CANCELLED);
        eventFired = true;
      });

      const result = queue.addJob('https://example.com', {}, JOB_PRIORITY.NORMAL);
      queue.cancelJob(result.jobId);
      
      expect(eventFired).toBe(true);
    });
  });

  describe('Cleanup', () => {
    test('should clean up old jobs', () => {
      // Add a completed job with old timestamp
      const oldJob = {
        id: 'old-job',
        status: JOB_STATUS.COMPLETED,
        completedAt: new Date(Date.now() - 25 * 60 * 60 * 1000) // 25 hours ago
      };
      
      queue.completed.set('old-job', oldJob);
      expect(queue.completed.size).toBe(1);

      // Trigger cleanup
      queue.cleanupOldJobs();
      
      expect(queue.completed.size).toBe(0);
    });

    test('should not clean up recent jobs', () => {
      // Add a completed job with recent timestamp
      const recentJob = {
        id: 'recent-job',
        status: JOB_STATUS.COMPLETED,
        completedAt: new Date(Date.now() - 1 * 60 * 60 * 1000) // 1 hour ago
      };
      
      queue.completed.set('recent-job', recentJob);
      expect(queue.completed.size).toBe(1);

      // Trigger cleanup
      queue.cleanupOldJobs();
      
      expect(queue.completed.size).toBe(1);
    });
  });

  describe('Utility Functions', () => {
    test('should estimate job duration based on options', () => {
      const basicDuration = queue.estimateJobDuration({});
      const lighthouseDuration = queue.estimateJobDuration({ lighthouse: true });
      const comprehensiveDuration = queue.estimateJobDuration({ comprehensive: true });
      const fullDuration = queue.estimateJobDuration({ lighthouse: true, comprehensive: true });

      expect(lighthouseDuration).toBeGreaterThan(basicDuration);
      expect(comprehensiveDuration).toBeGreaterThan(basicDuration);
      expect(fullDuration).toBeGreaterThan(lighthouseDuration);
      expect(fullDuration).toBeGreaterThan(comprehensiveDuration);
    });

    test('should update average processing time', () => {
      expect(queue.stats.avgProcessingTime).toBe(0);

      queue.updateAverageProcessingTime(1000);
      expect(queue.stats.avgProcessingTime).toBe(1000);

      queue.updateAverageProcessingTime(2000);
      expect(queue.stats.avgProcessingTime).toBeGreaterThan(1000);
      expect(queue.stats.avgProcessingTime).toBeLessThan(2000);
    });
  });
});