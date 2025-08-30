// services/reliability.js - Reliability patterns: deadlines, rate limiting, circuit breakers
const rateLimit = require('express-rate-limit');

class ReliabilityService {
  constructor() {
    this.enabled = process.env.ENABLE_RELIABILITY_PATTERNS !== 'false'; // Enabled by default
    this.circuitBreakers = new Map();
    
    if (this.enabled) {
      console.log('[RELIABILITY] Reliability patterns enabled');
    }
  }

  /**
   * Create job deadline wrapper
   * Ensures jobs don't run indefinitely
   */
  createJobDeadline(timeoutMs = 120000) { // 2 minutes default
    return (fn) => {
      return async (...args) => {
        const deadline = Date.now() + timeoutMs;
        
        const timeoutPromise = new Promise((_, reject) => {
          const remaining = deadline - Date.now();
          setTimeout(() => {
            reject(new Error(`Job deadline exceeded (${timeoutMs}ms)`));
          }, Math.max(remaining, 0));
        });

        try {
          return await Promise.race([fn(...args), timeoutPromise]);
        } catch (error) {
          if (error.message.includes('deadline exceeded')) {
            // Log deadline exceeded for monitoring
            console.warn(`[RELIABILITY] Job deadline exceeded: ${timeoutMs}ms`);
          }
          throw error;
        }
      };
    };
  }

  /**
   * Circuit breaker for external services (Browserless, PSI)
   */
  createCircuitBreaker(name, options = {}) {
    const defaults = {
      failureThreshold: 5, // Open after 5 failures
      recoveryTimeout: 30000, // 30 seconds
      monitoringPeriod: 60000 // 1 minute window
    };

    const config = { ...defaults, ...options };
    
    const breaker = {
      name,
      state: 'CLOSED', // CLOSED, OPEN, HALF_OPEN
      failures: 0,
      lastFailure: null,
      successCount: 0,
      stats: {
        totalCalls: 0,
        totalFailures: 0,
        totalSuccesses: 0
      }
    };

    this.circuitBreakers.set(name, breaker);

    return {
      execute: async (fn) => {
        breaker.stats.totalCalls++;

        // Check circuit state
        if (breaker.state === 'OPEN') {
          const timeSinceLastFailure = Date.now() - breaker.lastFailure;
          
          if (timeSinceLastFailure > config.recoveryTimeout) {
            breaker.state = 'HALF_OPEN';
            console.log(`[RELIABILITY] Circuit breaker ${name} moved to HALF_OPEN`);
          } else {
            const error = new Error(`Circuit breaker ${name} is OPEN`);
            error.circuitBreakerOpen = true;
            throw error;
          }
        }

        try {
          const result = await fn();
          
          // Success - reset failure count
          if (breaker.state === 'HALF_OPEN') {
            breaker.state = 'CLOSED';
            breaker.failures = 0;
            console.log(`[RELIABILITY] Circuit breaker ${name} CLOSED after recovery`);
          }
          
          breaker.successCount++;
          breaker.stats.totalSuccesses++;
          
          return result;

        } catch (error) {
          breaker.failures++;
          breaker.lastFailure = Date.now();
          breaker.stats.totalFailures++;

          // Check if we should open the circuit
          if (breaker.failures >= config.failureThreshold) {
            breaker.state = 'OPEN';
            console.warn(`[RELIABILITY] Circuit breaker ${name} OPENED after ${breaker.failures} failures`);
          }

          throw error;
        }
      },

      getStats: () => ({
        name: breaker.name,
        state: breaker.state,
        failures: breaker.failures,
        successRate: breaker.stats.totalCalls > 0 
          ? (breaker.stats.totalSuccesses / breaker.stats.totalCalls * 100).toFixed(2) + '%'
          : '0%',
        ...breaker.stats
      })
    };
  }

  /**
   * Rate limiting configurations
   */
  createRateLimiters() {
    // General API rate limiter
    const generalLimiter = rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 100, // Limit each IP to 100 requests per windowMs
      message: {
        error: 'Too many requests, please try again later',
        resetTime: new Date(Date.now() + 15 * 60 * 1000).toISOString()
      },
      standardHeaders: true,
      legacyHeaders: false,
      // Custom key generator for better distributed rate limiting
      keyGenerator: (req) => {
        return req.ip + ':' + (req.get('x-forwarded-for') || 'unknown');
      }
    });

    // Audit-specific rate limiter (more restrictive)
    const auditLimiter = rateLimit({
      windowMs: 10 * 60 * 1000, // 10 minutes  
      max: 20, // 20 audits per 10 minutes per IP
      message: {
        error: 'Audit rate limit exceeded. Please wait before requesting more audits.',
        resetTime: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
        hint: 'Consider upgrading for higher rate limits'
      },
      standardHeaders: true,
      legacyHeaders: false,
      keyGenerator: (req) => {
        return req.ip + ':audit';
      }
    });

    // Batch audit rate limiter (most restrictive)
    const batchLimiter = rateLimit({
      windowMs: 60 * 60 * 1000, // 1 hour
      max: 5, // 5 batch operations per hour
      message: {
        error: 'Batch audit limit reached. Batch operations are resource-intensive.',
        resetTime: new Date(Date.now() + 60 * 60 * 1000).toISOString()
      },
      standardHeaders: true,
      legacyHeaders: false
    });

    return {
      general: generalLimiter,
      audit: auditLimiter,
      batch: batchLimiter
    };
  }

  /**
   * Configurable idempotency window
   */
  getIdempotencyWindow(requestType = 'default') {
    const windows = {
      'default': 10 * 60 * 1000, // 10 minutes
      'audit': parseInt(process.env.AUDIT_IDEMPOTENCY_WINDOW_MS) || 5 * 60 * 1000, // 5 minutes
      'batch': 60 * 60 * 1000, // 1 hour for batch operations
      'enhanced': 30 * 60 * 1000 // 30 minutes for enhanced audits
    };

    return windows[requestType] || windows.default;
  }

  /**
   * Resource-based backoff for external services
   */
  createBackoffStrategy(serviceName, attempt = 1) {
    const baseDelay = 1000; // 1 second
    const maxDelay = 30000;  // 30 seconds
    const jitter = Math.random() * 1000; // Up to 1 second jitter

    const delay = Math.min(baseDelay * Math.pow(2, attempt - 1) + jitter, maxDelay);

    console.log(`[RELIABILITY] Backing off ${serviceName} for ${delay}ms (attempt ${attempt})`);
    
    return new Promise(resolve => setTimeout(resolve, delay));
  }

  /**
   * Health check for circuit breakers
   */
  getCircuitBreakerHealth() {
    const health = {
      timestamp: new Date().toISOString(),
      circuitBreakers: {}
    };

    for (const [name, breaker] of this.circuitBreakers) {
      health.circuitBreakers[name] = {
        state: breaker.state,
        healthy: breaker.state !== 'OPEN',
        failures: breaker.failures,
        successRate: breaker.stats.totalCalls > 0 
          ? (breaker.stats.totalSuccesses / breaker.stats.totalCalls * 100).toFixed(1) + '%'
          : 'N/A'
      };
    }

    const allHealthy = Object.values(health.circuitBreakers).every(cb => cb.healthy);
    health.overall = allHealthy ? 'healthy' : 'degraded';

    return health;
  }

  /**
   * Request timeout wrapper
   */
  withTimeout(promise, timeoutMs, errorMessage = 'Operation timed out') {
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error(errorMessage)), timeoutMs);
    });

    return Promise.race([promise, timeoutPromise]);
  }

  /**
   * Retry with exponential backoff
   */
  async retry(fn, options = {}) {
    const { 
      maxAttempts = 3, 
      serviceName = 'unknown',
      shouldRetry = (error) => true 
    } = options;

    let lastError;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;

        if (attempt === maxAttempts || !shouldRetry(error)) {
          break;
        }

        await this.createBackoffStrategy(serviceName, attempt);
      }
    }

    throw lastError;
  }

  /**
   * Resource monitoring and alerting
   */
  checkResourceHealth() {
    const health = {
      memory: process.memoryUsage(),
      uptime: process.uptime(),
      timestamp: new Date().toISOString()
    };

    // Memory pressure detection
    const memoryUsagePercent = (health.memory.heapUsed / health.memory.heapTotal) * 100;
    health.memoryPressure = memoryUsagePercent > 80 ? 'high' : memoryUsagePercent > 60 ? 'medium' : 'low';

    // Circuit breaker health
    health.circuitBreakers = this.getCircuitBreakerHealth();

    return health;
  }
}

// Singleton instance
let reliabilityInstance = null;

function getReliabilityService() {
  if (!reliabilityInstance) {
    reliabilityInstance = new ReliabilityService();
  }
  return reliabilityInstance;
}

module.exports = {
  ReliabilityService,
  getReliabilityService
};