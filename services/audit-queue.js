// services/audit-queue.js
// Enterprise-grade audit queue system for handling concurrent requests

const EventEmitter = require('events');
const { v4: uuidv4 } = require('uuid');
const AuditOrchestrator = require('./audit-orchestrator');

/**
 * Job statuses for audit queue
 */
const JOB_STATUS = {
  PENDING: 'pending',
  PROCESSING: 'processing', 
  COMPLETED: 'completed',
  FAILED: 'failed',
  CANCELLED: 'cancelled'
};

/**
 * Job priorities for queue management
 */
const JOB_PRIORITY = {
  LOW: 1,
  NORMAL: 2,
  HIGH: 3,
  URGENT: 4
};

class AuditQueue extends EventEmitter {
  constructor(options = {}) {
    super();
    
    // Configuration
    this.maxConcurrent = options.maxConcurrent || 3;
    this.jobTimeout = options.jobTimeout || 60000; // 60 seconds
    this.retryAttempts = options.retryAttempts || 2;
    this.cleanupInterval = options.cleanupInterval || 300000; // 5 minutes
    this.testMode = options.testMode || false; // Add test mode flag
    
    // Allow dependency injection for testing
    this.orchestratorFactory = options.orchestratorFactory || (() => new AuditOrchestrator());
    
    // Queue state
    this.pending = new Map(); // jobId -> job
    this.processing = new Map(); // jobId -> job
    this.completed = new Map(); // jobId -> job (recent completions)
    this.failed = new Map(); // jobId -> job (recent failures)
    
    // Priority queues for different job types
    this.priorityQueues = {
      [JOB_PRIORITY.URGENT]: [],
      [JOB_PRIORITY.HIGH]: [],
      [JOB_PRIORITY.NORMAL]: [],
      [JOB_PRIORITY.LOW]: []
    };
    
    // Statistics
    this.stats = {
      totalJobs: 0,
      completedJobs: 0,
      failedJobs: 0,
      avgProcessingTime: 0,
      currentLoad: 0,
      peakLoad: 0,
      startTime: Date.now()
    };
    
    // Interval references for cleanup
    this.processingInterval = null;
    this.cleanupIntervalRef = null;
    
    // Start background processes only if not in test mode
    if (!this.testMode) {
      this.startProcessing();
      this.startCleanup();
    }
    
    console.log(`🚀 Audit Queue initialized - Max concurrent: ${this.maxConcurrent}${this.testMode ? ' (TEST MODE)' : ''}`);
  }

  /**
   * Add a new audit job to the queue
   * @param {string} url - URL to audit
   * @param {Object} options - Audit options
   * @param {number} priority - Job priority (1-4)
   * @returns {Object} - Job information
   */
  addJob(url, options = {}, priority = JOB_PRIORITY.NORMAL) {
    const jobId = uuidv4();
    const job = {
      id: jobId,
      url,
      options,
      priority,
      status: JOB_STATUS.PENDING,
      createdAt: new Date(),
      updatedAt: new Date(),
      attempts: 0,
      maxAttempts: this.retryAttempts + 1,
      estimatedDuration: this.estimateJobDuration(options),
      result: null,
      error: null,
      processingTime: null,
      startedAt: null,
      completedAt: null
    };

    // Check for duplicate jobs
    const duplicateJob = this.findDuplicateJob(url, options);
    if (duplicateJob) {
      console.log(`📋 Duplicate job detected for ${url}, returning existing job ${duplicateJob.id}`);
      return {
        jobId: duplicateJob.id,
        status: duplicateJob.status,
        position: this.getJobPosition(duplicateJob.id),
        estimatedWait: this.estimateWaitTime(duplicateJob.id),
        duplicate: true
      };
    }

    // Add to appropriate priority queue
    this.priorityQueues[priority].push(jobId);
    this.pending.set(jobId, job);
    
    this.stats.totalJobs++;
    this.updateStats();
    
    console.log(`📝 Job ${jobId} added to queue (priority: ${priority}, URL: ${url})`);
    
    this.emit('jobAdded', job);
    
    return {
      jobId,
      status: JOB_STATUS.PENDING,
      position: this.getJobPosition(jobId),
      estimatedWait: this.estimateWaitTime(jobId)
    };
  }

  /**
   * Get job status and information
   * @param {string} jobId - Job ID
   * @returns {Object|null} - Job information
   */
  getJob(jobId) {
    // Check all job collections
    const job = this.pending.get(jobId) || 
                this.processing.get(jobId) || 
                this.completed.get(jobId) || 
                this.failed.get(jobId);
    
    if (!job) {
      return null;
    }

    return {
      ...job,
      position: job.status === JOB_STATUS.PENDING ? this.getJobPosition(jobId) : null,
      estimatedWait: job.status === JOB_STATUS.PENDING ? this.estimateWaitTime(jobId) : null
    };
  }

  /**
   * Cancel a pending job
   * @param {string} jobId - Job ID
   * @returns {boolean} - Success status
   */
  cancelJob(jobId) {
    const job = this.pending.get(jobId);
    if (!job) {
      return false;
    }

    // Remove from priority queue
    for (const queue of Object.values(this.priorityQueues)) {
      const index = queue.indexOf(jobId);
      if (index !== -1) {
        queue.splice(index, 1);
        break;
      }
    }

    // Move to failed with cancelled status
    job.status = JOB_STATUS.CANCELLED;
    job.updatedAt = new Date();
    job.error = 'Job cancelled by user';
    
    this.pending.delete(jobId);
    this.failed.set(jobId, job);
    
    console.log(`❌ Job ${jobId} cancelled`);
    this.emit('jobCancelled', job);
    
    return true;
  }

  /**
   * Get current queue status and statistics
   * @returns {Object} - Queue status
   */
  getStatus() {
    const currentTime = Date.now();
    const uptime = currentTime - this.stats.startTime;
    
    return {
      queue: {
        pending: this.pending.size,
        processing: this.processing.size,
        completed: this.completed.size,
        failed: this.failed.size
      },
      capacity: {
        maxConcurrent: this.maxConcurrent,
        currentProcessing: this.processing.size,
        availableSlots: this.maxConcurrent - this.processing.size
      },
      stats: {
        ...this.stats,
        uptime,
        throughput: this.stats.completedJobs / (uptime / 1000 / 60), // jobs per minute
        successRate: this.stats.totalJobs > 0 ? 
          (this.stats.completedJobs / this.stats.totalJobs * 100) : 0
      },
      priorityQueues: {
        urgent: this.priorityQueues[JOB_PRIORITY.URGENT].length,
        high: this.priorityQueues[JOB_PRIORITY.HIGH].length,
        normal: this.priorityQueues[JOB_PRIORITY.NORMAL].length,
        low: this.priorityQueues[JOB_PRIORITY.LOW].length
      }
    };
  }

  /**
   * Start the job processing loop
   * @private
   */
  startProcessing() {
    if (this.testMode) {
      console.log('⚠️ Test mode: Processing intervals disabled');
      return;
    }
    
    this.processingInterval = setInterval(() => {
      this.processNextJob();
    }, 1000); // Check every second
  }
  
  /**
   * Manually process jobs (for testing)
   */
  async manualProcess() {
    while (this.pending.size > 0 && this.processing.size < this.maxConcurrent) {
      await this.processNextJob();
      // Small delay to prevent tight loops
      await new Promise(resolve => setTimeout(resolve, 10));
    }
  }

  /**
   * Process the next job in the queue
   * @private
   */
  async processNextJob() {
    // Check if we have capacity
    if (this.processing.size >= this.maxConcurrent) {
      return;
    }

    // Get next job by priority
    const jobId = this.getNextJobId();
    if (!jobId) {
      return;
    }

    const job = this.pending.get(jobId);
    if (!job) {
      return;
    }

    // Move job to processing
    this.pending.delete(jobId);
    job.status = JOB_STATUS.PROCESSING;
    job.startedAt = new Date();
    job.updatedAt = new Date();
    job.attempts++;
    this.processing.set(jobId, job);

    console.log(`🔄 Starting job ${jobId} (attempt ${job.attempts}/${job.maxAttempts})`);
    this.emit('jobStarted', job);

    let timeoutId = null;
    
    try {
      // Set timeout for job
      const timeoutPromise = new Promise((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error('Job timeout')), this.jobTimeout);
      });

      // Execute audit
      const orchestrator = this.orchestratorFactory();
      const auditPromise = orchestrator.runFullAudit(job.url, job.options);

      const result = await Promise.race([auditPromise, timeoutPromise]);
      
      // Clear timeout since job completed successfully
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
      
      // Job completed successfully
      job.status = JOB_STATUS.COMPLETED;
      job.result = result;
      job.completedAt = new Date();
      job.processingTime = job.completedAt - job.startedAt;
      job.updatedAt = new Date();

      this.processing.delete(jobId);
      this.completed.set(jobId, job);
      
      this.stats.completedJobs++;
      this.updateAverageProcessingTime(job.processingTime);
      
      console.log(`✅ Job ${jobId} completed in ${job.processingTime}ms`);
      this.emit('jobCompleted', job);

    } catch (error) {
      // Clear timeout on error
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
      
      console.error(`❌ Job ${jobId} failed (attempt ${job.attempts}):`, error.message);
      
      // Check if we should retry
      if (job.attempts < job.maxAttempts && !error.message.includes('timeout')) {
        // Retry job - move back to pending with increased priority
        job.status = JOB_STATUS.PENDING;
        job.priority = Math.min(job.priority + 1, JOB_PRIORITY.URGENT);
        job.updatedAt = new Date();
        
        this.processing.delete(jobId);
        this.pending.set(jobId, job);
        this.priorityQueues[job.priority].unshift(jobId); // Add to front for retry
        
        console.log(`🔄 Retrying job ${jobId} with higher priority ${job.priority}`);
        this.emit('jobRetry', job);
        
      } else {
        // Job failed permanently
        job.status = JOB_STATUS.FAILED;
        job.error = error.message;
        job.completedAt = new Date();
        job.updatedAt = new Date();
        
        this.processing.delete(jobId);
        this.failed.set(jobId, job);
        
        this.stats.failedJobs++;
        
        console.log(`💥 Job ${jobId} failed permanently: ${error.message}`);
        this.emit('jobFailed', job);
      }
    }

    this.updateStats();
  }

  /**
   * Get next job ID to process (by priority)
   * @private
   * @returns {string|null} - Job ID
   */
  getNextJobId() {
    // Process by priority: urgent -> high -> normal -> low
    for (const priority of [JOB_PRIORITY.URGENT, JOB_PRIORITY.HIGH, JOB_PRIORITY.NORMAL, JOB_PRIORITY.LOW]) {
      const queue = this.priorityQueues[priority];
      if (queue.length > 0) {
        return queue.shift();
      }
    }
    return null;
  }

  /**
   * Find duplicate job in queue
   * @private
   * @param {string} url - URL to check
   * @param {Object} options - Options to check
   * @returns {Object|null} - Duplicate job if found
   */
  findDuplicateJob(url, options) {
    const optionsKey = JSON.stringify(options);
    
    // Check pending and processing jobs
    const allActiveJobs = [...this.pending.values(), ...this.processing.values()];
    
    return allActiveJobs.find(job => 
      job.url === url && JSON.stringify(job.options) === optionsKey
    );
  }

  /**
   * Get position of job in queue
   * @private
   * @param {string} jobId - Job ID
   * @returns {number} - Position (1-based)
   */
  getJobPosition(jobId) {
    let position = 1;
    
    // Count jobs with higher or equal priority that come before this job
    for (const priority of [JOB_PRIORITY.URGENT, JOB_PRIORITY.HIGH, JOB_PRIORITY.NORMAL, JOB_PRIORITY.LOW]) {
      const queue = this.priorityQueues[priority];
      const index = queue.indexOf(jobId);
      
      if (index !== -1) {
        return position + index;
      }
      
      position += queue.length;
    }
    
    return 0; // Job not found in pending queues
  }

  /**
   * Estimate wait time for a job
   * @private
   * @param {string} jobId - Job ID
   * @returns {number} - Estimated wait time in milliseconds
   */
  estimateWaitTime(jobId) {
    const position = this.getJobPosition(jobId);
    if (position === 0) return 0;
    
    const avgProcessingTime = this.stats.avgProcessingTime || 30000; // Default 30 seconds
    const availableSlots = this.maxConcurrent - this.processing.size;
    
    // Calculate estimated wait based on position and available slots
    const jobsAhead = position - 1;
    const batchesAhead = Math.ceil(jobsAhead / this.maxConcurrent);
    
    return batchesAhead * avgProcessingTime;
  }

  /**
   * Estimate job duration based on options
   * @private
   * @param {Object} options - Audit options
   * @returns {number} - Estimated duration in milliseconds
   */
  estimateJobDuration(options) {
    let baseTime = 15000; // 15 seconds base
    
    if (options.lighthouse) baseTime += 20000; // Add 20s for Lighthouse
    if (options.comprehensive) baseTime += 10000; // Add 10s for comprehensive
    
    return baseTime;
  }

  /**
   * Update statistics
   * @private
   */
  updateStats() {
    this.stats.currentLoad = this.processing.size;
    this.stats.peakLoad = Math.max(this.stats.peakLoad, this.stats.currentLoad);
  }

  /**
   * Update average processing time
   * @private
   * @param {number} processingTime - Processing time in milliseconds
   */
  updateAverageProcessingTime(processingTime) {
    if (this.stats.avgProcessingTime === 0) {
      this.stats.avgProcessingTime = processingTime;
    } else {
      // Exponential moving average
      this.stats.avgProcessingTime = (this.stats.avgProcessingTime * 0.8) + (processingTime * 0.2);
    }
  }

  /**
   * Start cleanup process for old completed/failed jobs
   * @private
   */
  startCleanup() {
    if (this.testMode) {
      console.log('⚠️ Test mode: Cleanup intervals disabled');
      return;
    }
    
    this.cleanupIntervalRef = setInterval(() => {
      this.cleanupOldJobs();
    }, this.cleanupInterval);
  }

  /**
   * Clean up old completed and failed jobs
   * @private
   */
  cleanupOldJobs() {
    const cutoffTime = Date.now() - (24 * 60 * 60 * 1000); // 24 hours ago
    
    let cleanedCompleted = 0;
    let cleanedFailed = 0;
    
    // Clean completed jobs
    for (const [jobId, job] of this.completed.entries()) {
      if (job.completedAt && job.completedAt.getTime() < cutoffTime) {
        this.completed.delete(jobId);
        cleanedCompleted++;
      }
    }
    
    // Clean failed jobs
    for (const [jobId, job] of this.failed.entries()) {
      if (job.completedAt && job.completedAt.getTime() < cutoffTime) {
        this.failed.delete(jobId);
        cleanedFailed++;
      }
    }
    
    if (cleanedCompleted > 0 || cleanedFailed > 0) {
      console.log(`🧹 Cleaned up ${cleanedCompleted} completed and ${cleanedFailed} failed jobs`);
    }
  }

  /**
   * Shutdown the queue gracefully
   */
  async shutdown() {
    console.log('🛑 Shutting down audit queue...');
    
    // Clear intervals first to prevent new processing
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = null;
    }
    
    if (this.cleanupIntervalRef) {
      clearInterval(this.cleanupIntervalRef);
      this.cleanupIntervalRef = null;
    }
    
    // Wait for current jobs to complete (with timeout)
    const shutdownTimeout = 30000; // 30 seconds
    const startTime = Date.now();
    
    while (this.processing.size > 0 && (Date.now() - startTime) < shutdownTimeout) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    if (this.processing.size > 0) {
      console.log(`⚠️ Shutdown timeout reached, ${this.processing.size} jobs still processing`);
      
      // Force cancel remaining jobs
      for (const [jobId, job] of this.processing.entries()) {
        job.status = JOB_STATUS.CANCELLED;
        job.error = 'Shutdown timeout';
        job.completedAt = new Date();
        job.updatedAt = new Date();
        
        this.processing.delete(jobId);
        this.failed.set(jobId, job);
      }
    }
    
    console.log('✅ Audit queue shut down');
  }
  
  /**
   * Force shutdown without waiting for jobs to complete
   */
  forceShutdown() {
    console.log('🛑 Force shutting down audit queue...');
    
    // Clear intervals immediately
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = null;
    }
    
    if (this.cleanupIntervalRef) {
      clearInterval(this.cleanupIntervalRef);
      this.cleanupIntervalRef = null;
    }
    
    // Cancel all processing jobs immediately
    for (const [jobId, job] of this.processing.entries()) {
      job.status = JOB_STATUS.CANCELLED;
      job.error = 'Force shutdown';
      job.completedAt = new Date();
      job.updatedAt = new Date();
      
      this.processing.delete(jobId);
      this.failed.set(jobId, job);
    }
    
    // Cancel all pending jobs immediately
    for (const [jobId, job] of this.pending.entries()) {
      job.status = JOB_STATUS.CANCELLED;
      job.error = 'Force shutdown';
      job.completedAt = new Date();
      job.updatedAt = new Date();
      
      this.pending.delete(jobId);
      this.failed.set(jobId, job);
    }
    
    // Clear priority queues
    Object.values(this.priorityQueues).forEach(queue => queue.length = 0);
    
    console.log('✅ Audit queue force shut down');
  }
}

// Singleton instance for global use
let globalQueue = null;

/**
 * Get the global audit queue instance
 * @param {Object} options - Queue options
 * @returns {AuditQueue} - Queue instance
 */
function getGlobalQueue(options = {}) {
  if (!globalQueue) {
    globalQueue = new AuditQueue(options);
  }
  return globalQueue;
}

/**
 * Clear the global queue instance (for testing)
 */
function clearGlobalQueue() {
  if (globalQueue) {
    globalQueue.forceShutdown();
    globalQueue = null;
  }
}

/**
 * Shutdown the global queue gracefully
 */
async function shutdownGlobalQueue() {
  if (globalQueue) {
    await globalQueue.shutdown();
    globalQueue = null;
  }
}

module.exports = {
  AuditQueue,
  getGlobalQueue,
  clearGlobalQueue,
  shutdownGlobalQueue,
  JOB_STATUS,
  JOB_PRIORITY
};