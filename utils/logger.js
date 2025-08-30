// utils/logger.js
// Comprehensive logging service using Winston

const winston = require('winston');
const DailyRotateFile = require('winston-daily-rotate-file');
const path = require('path');
const os = require('os');

/**
 * Custom log levels for SEO audit tool
 */
const LOG_LEVELS = {
  error: 0,
  warn: 1,
  audit: 2,  // Custom level for audit operations
  info: 3,
  queue: 4,  // Custom level for queue operations
  memory: 5, // Custom level for memory monitoring
  debug: 6
};

/**
 * Custom colors for log levels
 */
const LOG_COLORS = {
  error: 'red',
  warn: 'yellow',
  audit: 'green',
  info: 'cyan',
  queue: 'blue',
  memory: 'magenta',
  debug: 'white'
};

/**
 * Custom log format for better readability
 */
const logFormat = winston.format.combine(
  winston.format.timestamp({
    format: 'YYYY-MM-DD HH:mm:ss.SSS'
  }),
  winston.format.errors({ stack: true }),
  winston.format.json(),
  winston.format.prettyPrint()
);

/**
 * Console format for development
 */
const consoleFormat = winston.format.combine(
  winston.format.timestamp({
    format: 'HH:mm:ss.SSS'
  }),
  winston.format.colorize({ all: true }),
  winston.format.printf(({ timestamp, level, message, service, ...meta }) => {
    const metaStr = Object.keys(meta).length > 0 ? JSON.stringify(meta) : '';
    const serviceStr = service ? `[${service}]` : '';
    return `${timestamp} ${level} ${serviceStr} ${message} ${metaStr}`;
  })
);

/**
 * Create logger configuration
 */
function createLoggerConfig(options = {}) {
  const isCloudRun = !!process.env.K_SERVICE || !!process.env.K_REVISION || !!process.env.GOOGLE_CLOUD_PROJECT;
  const {
    logLevel = process.env.LOG_LEVEL || 'info',
    // Default to /tmp on Cloud Run; otherwise use project root 'logs'
    logDir: providedLogDir,
    enableConsole = process.env.NODE_ENV !== 'test',
    // Disable file logs by default, can be enabled with ENABLE_FILE_LOGS=1
    enableFile: providedEnableFile,
    maxFiles = '14d',
    maxSize = '20m'
  } = options;

  const logDir = providedLogDir || process.env.LOG_DIR || (isCloudRun ? '/tmp/logs' : 'logs');
  const enableFile = typeof providedEnableFile === 'boolean' ? providedEnableFile : process.env.ENABLE_FILE_LOGS === '1';

  const transports = [];

  // Console transport for development
  if (enableConsole) {
    transports.push(
      new winston.transports.Console({
        level: logLevel,
        format: consoleFormat,
        handleExceptions: true,
        handleRejections: true
      })
    );
  }

  // File transports (only when explicitly enabled)
  if (enableFile) {
    // Ensure log directory exists lazily and safely
    try {
      const fs = require('fs');
      if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, { recursive: true });
      }
    } catch (e) {
      // Fall back to console-only if directory cannot be created
      // eslint-disable-next-line no-console
      console.warn('[logger] Failed to prepare log directory, disabling file logs:', e.message);
      return {
        levels: LOG_LEVELS,
        level: logLevel,
        transports: [
          new winston.transports.Console({
            level: logLevel,
            format: consoleFormat,
            handleExceptions: true,
            handleRejections: true
          })
        ],
        exitOnError: false
      };
    }

    // General application logs with rotation
    transports.push(
      new DailyRotateFile({
        filename: path.join(logDir, 'application-%DATE%.log'),
        datePattern: 'YYYY-MM-DD',
        maxFiles,
        maxSize,
        level: logLevel,
        format: logFormat,
        handleExceptions: true,
        handleRejections: true
      })
    );

    // Error logs (separate file)
    transports.push(
      new DailyRotateFile({
        filename: path.join(logDir, 'error-%DATE%.log'),
        datePattern: 'YYYY-MM-DD',
        maxFiles,
        maxSize,
        level: 'error',
        format: logFormat
      })
    );

    // Audit-specific logs
    transports.push(
      new DailyRotateFile({
        filename: path.join(logDir, 'audit-%DATE%.log'),
        datePattern: 'YYYY-MM-DD',
        maxFiles,
        maxSize,
        level: 'audit',
        format: logFormat
      })
    );

    // Queue operation logs
    transports.push(
      new DailyRotateFile({
        filename: path.join(logDir, 'queue-%DATE%.log'),
        datePattern: 'YYYY-MM-DD',
        maxFiles,
        maxSize,
        level: 'queue',
        format: logFormat
      })
    );

    // Memory monitoring logs
    transports.push(
      new DailyRotateFile({
        filename: path.join(logDir, 'memory-%DATE%.log'),
        datePattern: 'YYYY-MM-DD',
        maxFiles,
        maxSize,
        level: 'memory',
        format: logFormat
      })
    );
  }

  return {
    levels: LOG_LEVELS,
    level: logLevel,
    transports,
    exitOnError: false
  };
}

/**
 * Create and configure the main logger
 */
const logger = winston.createLogger(createLoggerConfig());

// Add custom colors
winston.addColors(LOG_COLORS);

/**
 * Enhanced logging methods with context
 */
class Logger {
  constructor(defaultService = 'app') {
    this.defaultService = defaultService;
    this.logger = logger;
  }

  /**
   * Create a child logger with a specific service context
   * @param {string} service - Service name
   * @returns {Logger} - Child logger
   */
  child(service) {
    return new Logger(service);
  }

  /**
   * Log error with enhanced context
   * @param {string} message - Error message
   * @param {Error|Object} error - Error object or metadata
   * @param {Object} meta - Additional metadata
   */
  error(message, error = null, meta = {}) {
    const logData = {
      service: this.defaultService,
      ...meta
    };

    if (error instanceof Error) {
      logData.error = {
        name: error.name,
        message: error.message,
        stack: error.stack,
        code: error.code
      };
    } else if (error && typeof error === 'object') {
      logData.errorDetails = error;
    }

    this.logger.error(message, logData);
  }

  /**
   * Log warning
   * @param {string} message - Warning message
   * @param {Object} meta - Additional metadata
   */
  warn(message, meta = {}) {
    this.logger.warn(message, {
      service: this.defaultService,
      ...meta
    });
  }

  /**
   * Log audit operation
   * @param {string} message - Audit message
   * @param {Object} meta - Audit metadata
   */
  audit(message, meta = {}) {
    this.logger.log('audit', message, {
      service: this.defaultService,
      timestamp: new Date().toISOString(),
      ...meta
    });
  }

  /**
   * Log general information
   * @param {string} message - Info message
   * @param {Object} meta - Additional metadata
   */
  info(message, meta = {}) {
    this.logger.info(message, {
      service: this.defaultService,
      ...meta
    });
  }

  /**
   * Log queue operation
   * @param {string} message - Queue message
   * @param {Object} meta - Queue metadata
   */
  queue(message, meta = {}) {
    this.logger.log('queue', message, {
      service: this.defaultService,
      timestamp: new Date().toISOString(),
      ...meta
    });
  }

  /**
   * Log memory monitoring
   * @param {string} message - Memory message
   * @param {Object} meta - Memory metadata
   */
  memory(message, meta = {}) {
    this.logger.log('memory', message, {
      service: this.defaultService,
      timestamp: new Date().toISOString(),
      ...meta
    });
  }

  /**
   * Log debug information
   * @param {string} message - Debug message
   * @param {Object} meta - Additional metadata
   */
  debug(message, meta = {}) {
    this.logger.debug(message, {
      service: this.defaultService,
      ...meta
    });
  }

  /**
   * Log performance metrics
   * @param {string} operation - Operation name
   * @param {number} duration - Duration in milliseconds
   * @param {Object} meta - Additional metrics
   */
  performance(operation, duration, meta = {}) {
    this.logger.info(`Performance: ${operation}`, {
      service: this.defaultService,
      operation,
      duration,
      performanceMetric: true,
      ...meta
    });
  }

  /**
   * Log API request/response
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {number} duration - Request duration
   */
  request(req, res, duration) {
    const logData = {
      service: 'api',
      method: req.method || 'UNKNOWN',
      url: req.originalUrl || req.url || 'unknown',
      status: res.statusCode || 0,
      duration,
      userAgent: req.get ? req.get('User-Agent') : null,
      ip: req.ip || (req.connection && req.connection.remoteAddress) || 'unknown',
      requestId: req.headers && req.headers['x-request-id']
    };

    // Add request body for non-GET requests (but sanitize sensitive data)
    if (req.method !== 'GET' && req.body) {
      logData.requestBody = this.sanitizeData(req.body);
    }

    const level = res.statusCode >= 400 ? 'warn' : 'info';
    this.logger[level](`${logData.method} ${logData.url}`, logData);
  }

  /**
   * Sanitize sensitive data from logs
   * @param {*} data - Data to sanitize
   * @returns {*} - Sanitized data
   */
  sanitizeData(data) {
    // Handle non-object types
    if (typeof data !== 'object' || data === null) {
      return data;
    }

    const sensitiveFields = ['password', 'token', 'secret', 'key', 'auth'];

    function sanitizeObject(obj) {
      if (typeof obj !== 'object' || obj === null) {
        return obj;
      }

      const result = Array.isArray(obj) ? [] : {};
      
      for (const [key, value] of Object.entries(obj)) {
        const isSensitive = sensitiveFields.some(field => 
          key.toLowerCase().includes(field)
        );
        
        if (isSensitive) {
          result[key] = '[REDACTED]';
        } else if (typeof value === 'object' && value !== null) {
          result[key] = sanitizeObject(value);
        } else {
          result[key] = value;
        }
      }
      
      return result;
    }

    return sanitizeObject(data);
  }

  /**
   * Create correlation ID for request tracing
   * @returns {string} - Unique correlation ID
   */
  createCorrelationId() {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get system information for debugging
   * @returns {Object} - System information
   */
  getSystemInfo() {
    const memory = process.memoryUsage();
    return {
      node: process.version,
      platform: os.platform(),
      arch: os.arch(),
      uptime: process.uptime(),
      memory: {
        rss: Math.round(memory.rss / 1024 / 1024),
        heapUsed: Math.round(memory.heapUsed / 1024 / 1024),
        heapTotal: Math.round(memory.heapTotal / 1024 / 1024),
        external: Math.round(memory.external / 1024 / 1024)
      },
      loadAvg: os.loadavg(),
      cpus: os.cpus().length
    };
  }

  /**
   * Log system startup information
   */
  logStartup() {
    const sysInfo = this.getSystemInfo();
    this.info('Application starting up', {
      ...sysInfo,
      pid: process.pid,
      env: process.env.NODE_ENV
    });
  }

  /**
   * Log system shutdown
   */
  logShutdown(reason = 'Unknown') {
    const sysInfo = this.getSystemInfo();
    this.info('Application shutting down', {
      ...sysInfo,
      reason,
      uptime: process.uptime()
    });
  }

  /**
   * Create a timer for performance measurement
   * @param {string} operation - Operation name
   * @returns {Function} - End timer function
   */
  timer(operation) {
    const start = Date.now();
    return (meta = {}) => {
      const duration = Date.now() - start;
      this.performance(operation, duration, meta);
      return duration;
    };
  }
}

/**
 * Express middleware for request logging
 * @param {Object} options - Middleware options
 * @returns {Function} - Express middleware
 */
function requestLogger(options = {}) {
  const { skipPaths = ['/health', '/metrics'] } = options;
  const requestLog = new Logger('request');

  return (req, res, next) => {
    // Skip logging for certain paths
    if (skipPaths.some(path => req.path.startsWith(path))) {
      return next();
    }

    const start = Date.now();
    const correlationId = requestLog.createCorrelationId();
    
    // Add correlation ID to request
    req.correlationId = correlationId;
    res.setHeader('X-Correlation-ID', correlationId);

    // Override res.end to capture response
    const originalEnd = res.end;
    res.end = function(...args) {
      const duration = Date.now() - start;
      requestLog.request(req, res, duration);
      originalEnd.apply(this, args);
    };

    next();
  };
}

/**
 * Express error handling middleware
 * @param {Error} err - Error object
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 * @param {Function} next - Next middleware
 */
function errorLogger(err, req, res, next) {
  const errorLog = new Logger('error');
  
  errorLog.error('Unhandled error in request', err, {
    method: req.method,
    url: req.originalUrl || req.url,
    correlationId: req.correlationId,
    userAgent: req.get('User-Agent'),
    ip: req.ip || req.connection.remoteAddress
  });

  next(err);
}

/**
 * Global error handlers
 */
function setupGlobalErrorHandlers() {
  const globalLog = new Logger('global');

  // Handle uncaught exceptions
  process.on('uncaughtException', (error) => {
    globalLog.error('Uncaught Exception - shutting down', error, {
      fatal: true
    });
    process.exit(1);
  });

  // Handle unhandled promise rejections
  process.on('unhandledRejection', (reason, promise) => {
    globalLog.error('Unhandled Promise Rejection', reason, {
      promise: promise.toString(),
      warning: 'This may cause memory leaks'
    });
  });

  // Handle SIGTERM gracefully
  process.on('SIGTERM', () => {
    globalLog.info('SIGTERM received - initiating graceful shutdown');
  });

  // Handle SIGINT gracefully
  process.on('SIGINT', () => {
    globalLog.info('SIGINT received - initiating graceful shutdown');
  });
}

// Create default logger instance
const defaultLogger = new Logger('app');

// Set up global error handlers
setupGlobalErrorHandlers();

module.exports = {
  Logger,
  logger: defaultLogger,
  requestLogger,
  errorLogger,
  setupGlobalErrorHandlers,
  LOG_LEVELS,
  LOG_COLORS,
  createLoggerConfig
};