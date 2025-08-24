// services/memory-monitor.js
// Memory monitoring and cleanup service for the SEO audit tool

const EventEmitter = require('events');

/**
 * Memory thresholds and configurations
 */
const MEMORY_THRESHOLDS = {
  WARNING: 0.7,     // 70% of available memory
  CRITICAL: 0.85,   // 85% of available memory
  EMERGENCY: 0.95   // 95% of available memory
};

const MEMORY_ACTIONS = {
  WARNING: 'warning',
  CRITICAL: 'critical',
  EMERGENCY: 'emergency',
  NORMAL: 'normal'
};

class MemoryMonitor extends EventEmitter {
  constructor(options = {}) {
    super();
    
    // Configuration
    this.monitorInterval = options.monitorInterval || 30000; // 30 seconds
    this.cleanupInterval = options.cleanupInterval || 300000; // 5 minutes
    this.maxHeapSize = options.maxHeapSize || this.getMaxHeapSize();
    this.alertCooldown = options.alertCooldown || 60000; // 1 minute between alerts
    
    // State
    this.isMonitoring = false;
    this.intervalId = null;
    this.cleanupIntervalId = null;
    this.lastAlert = new Map(); // Track last alert times
    this.memoryHistory = [];
    this.maxHistorySize = 100; // Keep last 100 readings
    
    // Cleanup registry
    this.cleanupTasks = new Map();
    this.gcTriggerCount = 0;
    
    console.log(`🧠 Memory Monitor initialized - Max heap: ${(this.maxHeapSize / 1024 / 1024).toFixed(0)}MB`);
  }

  /**
   * Get maximum heap size from V8 or estimate based on system memory
   * @returns {number} - Maximum heap size in bytes
   */
  getMaxHeapSize() {
    try {
      // Try to get V8 heap statistics
      const v8 = require('v8');
      const heapStats = v8.getHeapStatistics();
      return heapStats.heap_size_limit;
    } catch (error) {
      // Fallback: estimate based on system memory
      const os = require('os');
      const totalMemory = os.totalmem();
      // Assume Node.js can use up to 25% of system memory
      return Math.min(totalMemory * 0.25, 4 * 1024 * 1024 * 1024); // Max 4GB
    }
  }

  /**
   * Start memory monitoring
   */
  startMonitoring() {
    if (this.isMonitoring) {
      console.log('⚠️ Memory monitoring already started');
      return;
    }
    
    this.isMonitoring = true;
    
    // Start memory monitoring interval
    this.intervalId = setInterval(() => {
      this.checkMemoryUsage();
    }, this.monitorInterval);
    
    // Start cleanup interval
    this.cleanupIntervalId = setInterval(() => {
      this.runCleanupTasks();
    }, this.cleanupInterval);
    
    console.log('🔍 Memory monitoring started');
    this.emit('monitoringStarted');
  }

  /**
   * Stop memory monitoring
   */
  stopMonitoring() {
    if (!this.isMonitoring) {
      return;
    }
    
    this.isMonitoring = false;
    
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    
    if (this.cleanupIntervalId) {
      clearInterval(this.cleanupIntervalId);
      this.cleanupIntervalId = null;
    }
    
    console.log('🛑 Memory monitoring stopped');
    this.emit('monitoringStopped');
  }

  /**
   * Check current memory usage and emit alerts
   */
  checkMemoryUsage() {
    try {
      const memUsage = process.memoryUsage();
      const heapUsed = memUsage.heapUsed;
      const heapTotal = memUsage.heapTotal;
      const external = memUsage.external;
      const rss = memUsage.rss;
      
      const heapUsageRatio = heapUsed / this.maxHeapSize;
      const totalUsageRatio = heapTotal / this.maxHeapSize;
      
      // Add to history
      const timestamp = Date.now();
      this.memoryHistory.push({
        timestamp,
        heapUsed,
        heapTotal,
        external,
        rss,
        heapUsageRatio,
        totalUsageRatio
      });
      
      // Trim history
      if (this.memoryHistory.length > this.maxHistorySize) {
        this.memoryHistory.shift();
      }
      
      // Determine current memory level
      let currentLevel = MEMORY_ACTIONS.NORMAL;
      let thresholdExceeded = null;
      
      if (heapUsageRatio >= MEMORY_THRESHOLDS.EMERGENCY) {
        currentLevel = MEMORY_ACTIONS.EMERGENCY;
        thresholdExceeded = 'emergency';
      } else if (heapUsageRatio >= MEMORY_THRESHOLDS.CRITICAL) {
        currentLevel = MEMORY_ACTIONS.CRITICAL;
        thresholdExceeded = 'critical';
      } else if (heapUsageRatio >= MEMORY_THRESHOLDS.WARNING) {
        currentLevel = MEMORY_ACTIONS.WARNING;
        thresholdExceeded = 'warning';
      }
      
      // Emit alerts with cooldown
      if (thresholdExceeded && this.shouldEmitAlert(thresholdExceeded)) {
        const memoryInfo = {
          level: currentLevel,
          heapUsed: Math.round(heapUsed / 1024 / 1024),
          heapTotal: Math.round(heapTotal / 1024 / 1024),
          maxHeap: Math.round(this.maxHeapSize / 1024 / 1024),
          usagePercent: Math.round(heapUsageRatio * 100),
          rss: Math.round(rss / 1024 / 1024),
          external: Math.round(external / 1024 / 1024),
          threshold: Math.round(MEMORY_THRESHOLDS[thresholdExceeded.toUpperCase()] * 100)
        };
        
        console.log(`🚨 Memory ${thresholdExceeded}: ${memoryInfo.usagePercent}% (${memoryInfo.heapUsed}MB / ${memoryInfo.maxHeap}MB)`);
        
        this.emit('memoryAlert', memoryInfo);
        this.lastAlert.set(thresholdExceeded, timestamp);
        
        // Auto-trigger cleanup for critical/emergency levels
        if (currentLevel === MEMORY_ACTIONS.CRITICAL || currentLevel === MEMORY_ACTIONS.EMERGENCY) {
          this.triggerGarbageCollection();
          this.runCleanupTasks();
        }
      }
      
      // Emit regular status update
      this.emit('memoryUpdate', {
        heapUsed: Math.round(heapUsed / 1024 / 1024),
        heapTotal: Math.round(heapTotal / 1024 / 1024),
        maxHeap: Math.round(this.maxHeapSize / 1024 / 1024),
        usagePercent: Math.round(heapUsageRatio * 100),
        rss: Math.round(rss / 1024 / 1024),
        level: currentLevel
      });
    } catch (error) {
      console.error('❌ Memory usage check failed:', error.message);
      // Emit error event instead of throwing
      this.emit('error', error);
    }
  }

  /**
   * Check if we should emit an alert (respects cooldown)
   * @param {string} level - Alert level
   * @returns {boolean} - Should emit alert
   */
  shouldEmitAlert(level) {
    const lastAlertTime = this.lastAlert.get(level);
    if (!lastAlertTime) {
      return true;
    }
    
    return (Date.now() - lastAlertTime) >= this.alertCooldown;
  }

  /**
   * Register a cleanup task
   * @param {string} name - Task name
   * @param {Function} cleanupFn - Cleanup function
   * @param {number} priority - Priority (lower = higher priority)
   */
  registerCleanupTask(name, cleanupFn, priority = 10) {
    this.cleanupTasks.set(name, {
      name,
      cleanup: cleanupFn,
      priority,
      lastRun: null,
      runCount: 0
    });
    
    console.log(`📝 Registered cleanup task: ${name} (priority: ${priority})`);
  }

  /**
   * Unregister a cleanup task
   * @param {string} name - Task name
   */
  unregisterCleanupTask(name) {
    if (this.cleanupTasks.delete(name)) {
      console.log(`🗑️ Unregistered cleanup task: ${name}`);
    }
  }

  /**
   * Run all registered cleanup tasks
   */
  async runCleanupTasks() {
    if (this.cleanupTasks.size === 0) {
      return;
    }
    
    console.log('🧹 Running memory cleanup tasks...');
    
    // Sort tasks by priority
    const tasks = Array.from(this.cleanupTasks.values())
      .sort((a, b) => a.priority - b.priority);
    
    let tasksRun = 0;
    const startTime = Date.now();
    
    for (const task of tasks) {
      try {
        await task.cleanup();
        task.lastRun = Date.now();
        task.runCount++;
        tasksRun++;
        
        console.log(`✅ Cleanup task completed: ${task.name}`);
      } catch (error) {
        console.error(`❌ Cleanup task failed: ${task.name}`, error.message);
      }
    }
    
    const duration = Date.now() - startTime;
    console.log(`🧹 Cleanup completed: ${tasksRun} tasks in ${duration}ms`);
    
    this.emit('cleanupCompleted', {
      tasksRun,
      totalTasks: this.cleanupTasks.size,
      duration
    });
  }

  /**
   * Trigger garbage collection if available
   */
  triggerGarbageCollection() {
    if (global.gc) {
      console.log('🗑️ Triggering garbage collection...');
      const before = process.memoryUsage();
      
      global.gc();
      this.gcTriggerCount++;
      
      const after = process.memoryUsage();
      const freed = before.heapUsed - after.heapUsed;
      
      console.log(`♻️ GC completed - freed ${Math.round(freed / 1024 / 1024)}MB`);
      
      this.emit('garbageCollected', {
        freedMemory: freed,
        before: before.heapUsed,
        after: after.heapUsed,
        triggerCount: this.gcTriggerCount
      });
    } else {
      console.log('⚠️ Garbage collection not available (run with --expose-gc)');
    }
  }

  /**
   * Get memory statistics
   * @returns {Object} - Memory statistics
   */
  getMemoryStats() {
    const memUsage = process.memoryUsage();
    const heapUsageRatio = memUsage.heapUsed / this.maxHeapSize;
    
    return {
      current: {
        heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024),
        heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
        external: Math.round(memUsage.external / 1024 / 1024),
        rss: Math.round(memUsage.rss / 1024 / 1024),
        maxHeap: Math.round(this.maxHeapSize / 1024 / 1024),
        usagePercent: Math.round(heapUsageRatio * 100)
      },
      monitoring: {
        isActive: this.isMonitoring,
        historySize: this.memoryHistory.length,
        gcTriggerCount: this.gcTriggerCount,
        registeredCleanupTasks: this.cleanupTasks.size
      },
      thresholds: {
        warning: Math.round(MEMORY_THRESHOLDS.WARNING * 100),
        critical: Math.round(MEMORY_THRESHOLDS.CRITICAL * 100),
        emergency: Math.round(MEMORY_THRESHOLDS.EMERGENCY * 100)
      }
    };
  }

  /**
   * Get memory usage trend
   * @param {number} minutes - Number of minutes to analyze
   * @returns {Object} - Trend analysis
   */
  getMemoryTrend(minutes = 10) {
    const cutoffTime = Date.now() - (minutes * 60 * 1000);
    const recentHistory = this.memoryHistory.filter(h => h.timestamp >= cutoffTime);
    
    if (recentHistory.length < 2) {
      return { trend: 'insufficient_data', samples: recentHistory.length };
    }
    
    const first = recentHistory[0];
    const last = recentHistory[recentHistory.length - 1];
    const memoryChange = last.heapUsed - first.heapUsed;
    const timeSpan = last.timestamp - first.timestamp;
    const changeRate = memoryChange / (timeSpan / 1000); // bytes per second
    
    let trend = 'stable';
    if (changeRate > 1024 * 1024) { // More than 1MB/sec growth
      trend = 'growing_fast';
    } else if (changeRate > 100 * 1024) { // More than 100KB/sec growth
      trend = 'growing';
    } else if (changeRate < -1024 * 1024) { // More than 1MB/sec decrease
      trend = 'decreasing_fast';
    } else if (changeRate < -100 * 1024) { // More than 100KB/sec decrease
      trend = 'decreasing';
    }
    
    return {
      trend,
      changeRate: Math.round(changeRate / 1024), // KB/sec
      totalChange: Math.round(memoryChange / 1024 / 1024), // MB
      samples: recentHistory.length,
      timeSpan: Math.round(timeSpan / 1000), // seconds
      avgUsage: Math.round(recentHistory.reduce((sum, h) => sum + h.heapUsed, 0) / recentHistory.length / 1024 / 1024)
    };
  }

  /**
   * Force memory cleanup and GC
   */
  async forceCleanup() {
    console.log('🚨 Forcing immediate memory cleanup...');
    
    await this.runCleanupTasks();
    this.triggerGarbageCollection();
    
    // Wait a bit for GC to complete
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const stats = this.getMemoryStats();
    console.log(`🧠 Post-cleanup memory: ${stats.current.usagePercent}% (${stats.current.heapUsed}MB)`);
    
    return stats;
  }

  /**
   * Shutdown the memory monitor
   */
  async shutdown() {
    console.log('🛑 Shutting down memory monitor...');
    
    this.stopMonitoring();
    this.removeAllListeners();
    this.cleanupTasks.clear();
    this.memoryHistory = [];
    this.lastAlert.clear();
    
    console.log('✅ Memory monitor shut down');
  }
}

// Singleton instance for global use
let globalMonitor = null;

/**
 * Get the global memory monitor instance
 * @param {Object} options - Monitor options
 * @returns {MemoryMonitor} - Monitor instance
 */
function getGlobalMonitor(options = {}) {
  if (!globalMonitor) {
    globalMonitor = new MemoryMonitor(options);
  }
  return globalMonitor;
}

/**
 * Initialize common cleanup tasks
 * @param {MemoryMonitor} monitor - Memory monitor instance
 */
function initializeDefaultCleanupTasks(monitor) {
  // Cache cleanup (high priority)
  monitor.registerCleanupTask('cache_cleanup', async () => {
    try {
      const { cache } = require('../utils/cache');
      const beforeSize = cache.size();
      
      // Clear cache if it's too large
      if (beforeSize > 1000) {
        cache.clear();
        console.log(`🗑️ Cache cleared: ${beforeSize} items removed`);
      }
    } catch (error) {
      console.error('Cache cleanup failed:', error.message);
    }
  }, 1);
  
  // Audit queue cleanup (medium priority)
  monitor.registerCleanupTask('queue_cleanup', async () => {
    try {
      const { getGlobalQueue } = require('./audit-queue');
      const queue = getGlobalQueue();
      
      // Force cleanup of old jobs
      queue.cleanupOldJobs();
      console.log('🗑️ Audit queue cleaned up');
    } catch (error) {
      console.error('Queue cleanup failed:', error.message);
    }
  }, 5);
  
  // General cleanup (low priority)
  monitor.registerCleanupTask('general_cleanup', async () => {
    // Clear any temporary variables, close unused connections, etc.
    if (global.gc) {
      global.gc();
    }
    console.log('🗑️ General cleanup completed');
  }, 10);
}

module.exports = {
  MemoryMonitor,
  getGlobalMonitor,
  initializeDefaultCleanupTasks,
  MEMORY_THRESHOLDS,
  MEMORY_ACTIONS
};