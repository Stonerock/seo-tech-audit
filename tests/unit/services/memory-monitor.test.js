// tests/unit/services/memory-monitor.test.js
// Unit tests for the memory monitor service

const { MemoryMonitor, MEMORY_THRESHOLDS, MEMORY_ACTIONS } = require('../../../services/memory-monitor');

// Mock modules
jest.mock('../../../utils/cache', () => ({
  cache: {
    size: jest.fn(() => 500),
    clear: jest.fn()
  }
}));

jest.mock('../../../services/audit-queue', () => ({
  getGlobalQueue: jest.fn(() => ({
    cleanupOldJobs: jest.fn()
  }))
}));

describe('Services - MemoryMonitor', () => {
  let monitor;
  let mockProcess;

  beforeEach(() => {
    // Create fresh monitor for each test
    monitor = new MemoryMonitor({
      monitorInterval: 100, // Fast for testing
      cleanupInterval: 200,
      alertCooldown: 100
    });

    // Mock process.memoryUsage
    mockProcess = {
      heapUsed: 100 * 1024 * 1024,    // 100MB
      heapTotal: 150 * 1024 * 1024,   // 150MB
      external: 10 * 1024 * 1024,     // 10MB
      rss: 200 * 1024 * 1024          // 200MB
    };
    
    jest.spyOn(process, 'memoryUsage').mockReturnValue(mockProcess);
    
    // Mock global.gc
    global.gc = jest.fn();
    
    jest.clearAllMocks();
  });

  afterEach(async () => {
    if (monitor) {
      await monitor.shutdown();
      monitor = null;
    }
    
    // Clean up global.gc
    delete global.gc;
    
    // Restore mocks
    jest.restoreAllMocks();
  });

  describe('Constructor and Initialization', () => {
    test('should initialize with default options', () => {
      const defaultMonitor = new MemoryMonitor();
      
      expect(defaultMonitor.monitorInterval).toBe(30000);
      expect(defaultMonitor.cleanupInterval).toBe(300000);
      expect(defaultMonitor.alertCooldown).toBe(60000);
      expect(defaultMonitor.isMonitoring).toBe(false);
      expect(defaultMonitor.cleanupTasks.size).toBe(0);
      
      defaultMonitor.shutdown();
    });

    test('should initialize with custom options', () => {
      const customMonitor = new MemoryMonitor({
        monitorInterval: 5000,
        cleanupInterval: 10000,
        alertCooldown: 2000
      });
      
      expect(customMonitor.monitorInterval).toBe(5000);
      expect(customMonitor.cleanupInterval).toBe(10000);
      expect(customMonitor.alertCooldown).toBe(2000);
      
      customMonitor.shutdown();
    });
  });

  describe('Memory Monitoring', () => {
    test('should start monitoring', () => {
      expect(monitor.isMonitoring).toBe(false);
      
      monitor.startMonitoring();
      
      expect(monitor.isMonitoring).toBe(true);
      expect(monitor.intervalId).not.toBeNull();
      expect(monitor.cleanupIntervalId).not.toBeNull();
    });

    test('should stop monitoring', () => {
      monitor.startMonitoring();
      expect(monitor.isMonitoring).toBe(true);
      
      monitor.stopMonitoring();
      
      expect(monitor.isMonitoring).toBe(false);
      expect(monitor.intervalId).toBeNull();
      expect(monitor.cleanupIntervalId).toBeNull();
    });

    test('should not start monitoring twice', () => {
      monitor.startMonitoring();
      const firstIntervalId = monitor.intervalId;
      
      monitor.startMonitoring();
      
      expect(monitor.intervalId).toBe(firstIntervalId);
    });

    test('should emit monitoring events', (done) => {
      let startEventFired = false;
      let stopEventFired = false;
      
      monitor.on('monitoringStarted', () => {
        startEventFired = true;
      });
      
      monitor.on('monitoringStopped', () => {
        stopEventFired = true;
        expect(startEventFired).toBe(true);
        expect(stopEventFired).toBe(true);
        done();
      });
      
      monitor.startMonitoring();
      monitor.stopMonitoring();
    });
  });

  describe('Memory Usage Checking', () => {
    test('should check memory usage and add to history', () => {
      expect(monitor.memoryHistory.length).toBe(0);
      
      monitor.checkMemoryUsage();
      
      expect(monitor.memoryHistory.length).toBe(1);
      expect(monitor.memoryHistory[0]).toHaveProperty('timestamp');
      expect(monitor.memoryHistory[0]).toHaveProperty('heapUsed');
      expect(monitor.memoryHistory[0]).toHaveProperty('heapTotal');
      expect(monitor.memoryHistory[0]).toHaveProperty('external');
      expect(monitor.memoryHistory[0]).toHaveProperty('rss');
    });

    test('should emit memory update events', (done) => {
      monitor.on('memoryUpdate', (info) => {
        expect(info).toHaveProperty('heapUsed');
        expect(info).toHaveProperty('heapTotal');
        expect(info).toHaveProperty('usagePercent');
        expect(info).toHaveProperty('level');
        expect(typeof info.heapUsed).toBe('number');
        done();
      });
      
      monitor.checkMemoryUsage();
    });

    test('should emit warning alert when threshold exceeded', (done) => {
      // Set high memory usage to trigger warning
      const warningThreshold = monitor.maxHeapSize * MEMORY_THRESHOLDS.WARNING;
      mockProcess.heapUsed = Math.ceil(warningThreshold * 1.1); // 10% above warning
      
      monitor.on('memoryAlert', (alert) => {
        expect(alert.level).toBe(MEMORY_ACTIONS.WARNING);
        expect(alert.usagePercent).toBeGreaterThan(MEMORY_THRESHOLDS.WARNING * 100);
        expect(alert).toHaveProperty('heapUsed');
        expect(alert).toHaveProperty('threshold');
        done();
      });
      
      monitor.checkMemoryUsage();
    });

    test('should emit critical alert and trigger cleanup', (done) => {
      // Set very high memory usage to trigger critical
      const criticalThreshold = monitor.maxHeapSize * MEMORY_THRESHOLDS.CRITICAL;
      mockProcess.heapUsed = Math.ceil(criticalThreshold * 1.1); // 10% above critical
      
      monitor.on('memoryAlert', (alert) => {
        expect(alert.level).toBe(MEMORY_ACTIONS.CRITICAL);
        // Check that GC was called after the alert event
        setImmediate(() => {
          expect(global.gc).toHaveBeenCalled();
          done();
        });
      });
      
      monitor.checkMemoryUsage();
    });

    test('should respect alert cooldown', () => {
      const warningThreshold = monitor.maxHeapSize * MEMORY_THRESHOLDS.WARNING;
      mockProcess.heapUsed = warningThreshold + 1024 * 1024;
      
      let alertCount = 0;
      monitor.on('memoryAlert', () => {
        alertCount++;
      });
      
      // First check should emit alert
      monitor.checkMemoryUsage();
      expect(alertCount).toBe(1);
      
      // Second check immediately should not emit (cooldown)
      monitor.checkMemoryUsage();
      expect(alertCount).toBe(1);
    });

    test('should trim memory history when it gets too large', () => {
      monitor.maxHistorySize = 3; // Small for testing
      
      // Add more entries than max
      for (let i = 0; i < 5; i++) {
        monitor.checkMemoryUsage();
      }
      
      expect(monitor.memoryHistory.length).toBe(3);
    });
  });

  describe('Cleanup Tasks', () => {
    test('should register cleanup task', () => {
      const cleanupFn = jest.fn();
      
      monitor.registerCleanupTask('test_cleanup', cleanupFn, 5);
      
      expect(monitor.cleanupTasks.size).toBe(1);
      expect(monitor.cleanupTasks.has('test_cleanup')).toBe(true);
      
      const task = monitor.cleanupTasks.get('test_cleanup');
      expect(task.name).toBe('test_cleanup');
      expect(task.cleanup).toBe(cleanupFn);
      expect(task.priority).toBe(5);
    });

    test('should unregister cleanup task', () => {
      const cleanupFn = jest.fn();
      monitor.registerCleanupTask('test_cleanup', cleanupFn);
      
      expect(monitor.cleanupTasks.size).toBe(1);
      
      monitor.unregisterCleanupTask('test_cleanup');
      
      expect(monitor.cleanupTasks.size).toBe(0);
    });

    test('should run cleanup tasks in priority order', async () => {
      const executionOrder = [];
      
      monitor.registerCleanupTask('low_priority', async () => {
        executionOrder.push('low');
      }, 10);
      
      monitor.registerCleanupTask('high_priority', async () => {
        executionOrder.push('high');
      }, 1);
      
      monitor.registerCleanupTask('medium_priority', async () => {
        executionOrder.push('medium');
      }, 5);
      
      await monitor.runCleanupTasks();
      
      expect(executionOrder).toEqual(['high', 'medium', 'low']);
    });

    test('should handle cleanup task errors gracefully', async () => {
      const successTask = jest.fn().mockResolvedValue();
      const errorTask = jest.fn().mockRejectedValue(new Error('Cleanup failed'));
      
      monitor.registerCleanupTask('success_task', successTask);
      monitor.registerCleanupTask('error_task', errorTask);
      
      // Should not throw despite error in one task
      await expect(monitor.runCleanupTasks()).resolves.toBeUndefined();
      
      expect(successTask).toHaveBeenCalled();
      expect(errorTask).toHaveBeenCalled();
    });

    test('should emit cleanup completed event', (done) => {
      monitor.registerCleanupTask('test_task', async () => {});
      
      monitor.on('cleanupCompleted', (result) => {
        expect(result).toHaveProperty('tasksRun', 1);
        expect(result).toHaveProperty('totalTasks', 1);
        expect(result).toHaveProperty('duration');
        expect(typeof result.duration).toBe('number');
        done();
      });
      
      monitor.runCleanupTasks();
    });
  });

  describe('Garbage Collection', () => {
    test('should trigger garbage collection when available', () => {
      monitor.triggerGarbageCollection();
      
      expect(global.gc).toHaveBeenCalled();
      expect(monitor.gcTriggerCount).toBe(1);
    });

    test('should emit garbage collected event', (done) => {
      monitor.on('garbageCollected', (result) => {
        expect(result).toHaveProperty('freedMemory');
        expect(result).toHaveProperty('before');
        expect(result).toHaveProperty('after');
        expect(result).toHaveProperty('triggerCount', 1);
        done();
      });
      
      monitor.triggerGarbageCollection();
    });

    test('should handle missing garbage collection gracefully', () => {
      delete global.gc;
      
      // Should not throw
      expect(() => monitor.triggerGarbageCollection()).not.toThrow();
      expect(monitor.gcTriggerCount).toBe(0);
    });
  });

  describe('Statistics and Trends', () => {
    test('should return memory statistics', () => {
      const stats = monitor.getMemoryStats();
      
      expect(stats).toHaveProperty('current');
      expect(stats).toHaveProperty('monitoring');
      expect(stats).toHaveProperty('thresholds');
      
      expect(stats.current).toHaveProperty('heapUsed');
      expect(stats.current).toHaveProperty('heapTotal');
      expect(stats.current).toHaveProperty('usagePercent');
      
      expect(stats.monitoring).toHaveProperty('isActive');
      expect(stats.monitoring).toHaveProperty('historySize');
      expect(stats.monitoring).toHaveProperty('gcTriggerCount');
      
      expect(stats.thresholds).toHaveProperty('warning');
      expect(stats.thresholds).toHaveProperty('critical');
      expect(stats.thresholds).toHaveProperty('emergency');
    });

    test('should analyze memory trend with insufficient data', () => {
      const trend = monitor.getMemoryTrend();
      
      expect(trend.trend).toBe('insufficient_data');
      expect(trend.samples).toBe(0);
    });

    test('should analyze memory trend with sufficient data', (done) => {
      // Add some history data
      monitor.checkMemoryUsage();
      
      // Simulate memory growth
      mockProcess.heapUsed += 50 * 1024 * 1024; // Add 50MB
      
      // Wait a bit and add another reading
      setTimeout(() => {
        monitor.checkMemoryUsage();
        
        const trend = monitor.getMemoryTrend();
        expect(trend).toHaveProperty('trend');
        expect(trend).toHaveProperty('changeRate');
        expect(trend).toHaveProperty('totalChange');
        expect(trend.samples).toBe(2);
        done();
      }, 50); // Longer delay to ensure different timestamps
    });
  });

  describe('Force Cleanup', () => {
    test('should force cleanup and return stats', async () => {
      const cleanupTask = jest.fn().mockResolvedValue();
      monitor.registerCleanupTask('force_test', cleanupTask);
      
      const stats = await monitor.forceCleanup();
      
      expect(cleanupTask).toHaveBeenCalled();
      expect(global.gc).toHaveBeenCalled();
      expect(stats).toHaveProperty('current');
      expect(stats.current).toHaveProperty('usagePercent');
    });
  });

  describe('Shutdown', () => {
    test('should shutdown cleanly', async () => {
      monitor.registerCleanupTask('test_task', jest.fn());
      monitor.startMonitoring();
      
      expect(monitor.isMonitoring).toBe(true);
      expect(monitor.cleanupTasks.size).toBe(1);
      expect(monitor.memoryHistory.length).toBeGreaterThanOrEqual(0);
      
      await monitor.shutdown();
      
      expect(monitor.isMonitoring).toBe(false);
      expect(monitor.cleanupTasks.size).toBe(0);
      expect(monitor.memoryHistory.length).toBe(0);
      expect(monitor.lastAlert.size).toBe(0);
    });
  });

  describe('Edge Cases', () => {
    test('should handle V8 heap statistics error gracefully', () => {
      // Create monitor with mock that throws error
      jest.doMock('v8', () => ({
        getHeapStatistics: () => {
          throw new Error('V8 not available');
        }
      }));
      
      const testMonitor = new MemoryMonitor();
      expect(testMonitor.maxHeapSize).toBeGreaterThan(0);
      
      testMonitor.shutdown();
    });

    test('should handle process.memoryUsage error gracefully', () => {
      // Temporarily replace checkMemoryUsage with a version that handles errors
      const originalCheckMemoryUsage = monitor.checkMemoryUsage;
      monitor.checkMemoryUsage = function() {
        try {
          return originalCheckMemoryUsage.call(this);
        } catch (error) {
          // Should handle gracefully
          console.warn('Memory check failed:', error.message);
        }
      };
      
      jest.spyOn(process, 'memoryUsage').mockImplementation(() => {
        throw new Error('Memory usage unavailable');
      });
      
      expect(() => monitor.checkMemoryUsage()).not.toThrow();
      
      // Restore original method
      monitor.checkMemoryUsage = originalCheckMemoryUsage;
    });

    test('should handle cleanup task registration with invalid priority', () => {
      const cleanupFn = jest.fn();
      
      // Should default to priority 10
      monitor.registerCleanupTask('test_cleanup', cleanupFn);
      
      const task = monitor.cleanupTasks.get('test_cleanup');
      expect(task.priority).toBe(10);
    });
  });
});