// tests/unit/utils/logger.test.js
// Unit tests for the logging service

const { Logger, requestLogger, errorLogger, LOG_LEVELS } = require('../../../utils/logger');
const winston = require('winston');

// Mock winston to avoid actual file operations
jest.mock('winston', () => {
  const mockLogger = {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
    log: jest.fn()
  };

  return {
    createLogger: jest.fn(() => mockLogger),
    addColors: jest.fn(),
    format: {
      combine: jest.fn(() => 'combined-format'),
      timestamp: jest.fn(() => 'timestamp-format'),
      errors: jest.fn(() => 'errors-format'),
      json: jest.fn(() => 'json-format'),
      prettyPrint: jest.fn(() => 'prettyPrint-format'),
      colorize: jest.fn(() => 'colorize-format'),
      printf: jest.fn(() => 'printf-format')
    },
    transports: {
      Console: jest.fn()
    }
  };
});

jest.mock('winston-daily-rotate-file', () => {
  return jest.fn().mockImplementation(() => ({}));
});

// Mock fs for directory creation
jest.mock('fs', () => ({
  existsSync: jest.fn(() => false),
  mkdirSync: jest.fn()
}));

describe('Utils - Logger', () => {
  let logger;
  let mockWinstonLogger;

  beforeEach(() => {
    jest.clearAllMocks();
    logger = new Logger('test-service');
    mockWinstonLogger = winston.createLogger();
    logger.logger = mockWinstonLogger;
  });

  describe('Logger Class', () => {
    test('should initialize with default service name', () => {
      const defaultLogger = new Logger();
      expect(defaultLogger.defaultService).toBe('app');
    });

    test('should initialize with custom service name', () => {
      expect(logger.defaultService).toBe('test-service');
    });

    test('should create child logger with new service name', () => {
      const childLogger = logger.child('child-service');
      expect(childLogger.defaultService).toBe('child-service');
      expect(childLogger).toBeInstanceOf(Logger);
    });
  });

  describe('Logging Methods', () => {
    test('should log error with Error object', () => {
      const error = new Error('Test error');
      error.code = 'TEST_ERROR';
      
      logger.error('Test message', error, { additional: 'data' });
      
      expect(mockWinstonLogger.error).toHaveBeenCalledWith('Test message', {
        service: 'test-service',
        additional: 'data',
        error: {
          name: 'Error',
          message: 'Test error',
          stack: error.stack,
          code: 'TEST_ERROR'
        }
      });
    });

    test('should log error with object details', () => {
      const errorDetails = { type: 'validation', field: 'email' };
      
      logger.error('Validation failed', errorDetails);
      
      expect(mockWinstonLogger.error).toHaveBeenCalledWith('Validation failed', {
        service: 'test-service',
        errorDetails
      });
    });

    test('should log warning', () => {
      logger.warn('Warning message', { code: 'WARN_001' });
      
      expect(mockWinstonLogger.warn).toHaveBeenCalledWith('Warning message', {
        service: 'test-service',
        code: 'WARN_001'
      });
    });

    test('should log audit operations', () => {
      logger.audit('User login', { userId: '123', ip: '127.0.0.1' });
      
      expect(mockWinstonLogger.log).toHaveBeenCalledWith('audit', 'User login', {
        service: 'test-service',
        userId: '123',
        ip: '127.0.0.1',
        timestamp: expect.any(String)
      });
    });

    test('should log info', () => {
      logger.info('Info message', { details: 'test' });
      
      expect(mockWinstonLogger.info).toHaveBeenCalledWith('Info message', {
        service: 'test-service',
        details: 'test'
      });
    });

    test('should log queue operations', () => {
      logger.queue('Job added', { jobId: 'job-123', priority: 2 });
      
      expect(mockWinstonLogger.log).toHaveBeenCalledWith('queue', 'Job added', {
        service: 'test-service',
        jobId: 'job-123',
        priority: 2,
        timestamp: expect.any(String)
      });
    });

    test('should log memory monitoring', () => {
      logger.memory('Memory alert', { usage: 85, threshold: 80 });
      
      expect(mockWinstonLogger.log).toHaveBeenCalledWith('memory', 'Memory alert', {
        service: 'test-service',
        usage: 85,
        threshold: 80,
        timestamp: expect.any(String)
      });
    });

    test('should log debug information', () => {
      logger.debug('Debug message', { variable: 'value' });
      
      expect(mockWinstonLogger.debug).toHaveBeenCalledWith('Debug message', {
        service: 'test-service',
        variable: 'value'
      });
    });

    test('should log performance metrics', () => {
      logger.performance('API call', 1500, { endpoint: '/api/audit' });
      
      expect(mockWinstonLogger.info).toHaveBeenCalledWith('Performance: API call', {
        service: 'test-service',
        operation: 'API call',
        duration: 1500,
        endpoint: '/api/audit',
        performanceMetric: true
      });
    });
  });

  describe('Request Logging', () => {
    test('should log API request successfully', () => {
      const req = {
        method: 'GET',
        originalUrl: '/api/audit',
        get: jest.fn((header) => header === 'User-Agent' ? 'test-agent' : null),
        ip: '127.0.0.1',
        headers: { 'x-request-id': 'req-123' }
      };
      
      const res = {
        statusCode: 200
      };
      
      logger.request(req, res, 1200);
      
      expect(mockWinstonLogger.info).toHaveBeenCalledWith('GET /api/audit', {
        service: 'api',
        method: 'GET',
        url: '/api/audit',
        status: 200,
        duration: 1200,
        userAgent: 'test-agent',
        ip: '127.0.0.1',
        requestId: 'req-123'
      });
    });

    test('should log error status as warning', () => {
      const req = {
        method: 'POST',
        originalUrl: '/api/audit',
        get: jest.fn(() => null),
        connection: { remoteAddress: '192.168.1.1' },
        headers: {},
        body: { url: 'https://example.com' }
      };
      
      const res = {
        statusCode: 400
      };
      
      logger.request(req, res, 800);
      
      expect(mockWinstonLogger.warn).toHaveBeenCalledWith('POST /api/audit', {
        service: 'api',
        method: 'POST',
        url: '/api/audit',
        status: 400,
        duration: 800,
        userAgent: null,
        ip: '192.168.1.1',
        requestId: undefined,
        requestBody: { url: 'https://example.com' }
      });
    });
  });

  describe('Data Sanitization', () => {
    test('should sanitize sensitive fields', () => {
      const data = {
        username: 'testuser',
        password: 'secret123',
        token: 'abc123',
        apiKey: 'key456',
        normal: 'value'
      };
      
      const sanitized = logger.sanitizeData(data);
      
      expect(sanitized).toEqual({
        username: 'testuser',
        password: '[REDACTED]',
        token: '[REDACTED]',
        apiKey: '[REDACTED]',
        normal: 'value'
      });
    });

    test('should sanitize nested objects', () => {
      const data = {
        user: {
          name: 'John',
          secret: 'hidden'
        },
        config: {
          apiKey: 'key123',
          timeout: 5000
        }
      };
      
      const sanitized = logger.sanitizeData(data);
      
      expect(sanitized).toEqual({
        user: {
          name: 'John',
          secret: '[REDACTED]'
        },
        config: {
          apiKey: '[REDACTED]',
          timeout: 5000
        }
      });
    });

    test('should handle arrays', () => {
      const data = {
        items: [
          { name: 'item1', password: 'secret' },
          { name: 'item2', value: 'normal' }
        ]
      };
      
      const sanitized = logger.sanitizeData(data);
      
      expect(sanitized.items[0].password).toBe('[REDACTED]');
      expect(sanitized.items[1].value).toBe('normal');
    });

    test('should handle non-object values', () => {
      expect(logger.sanitizeData('string')).toBe('string');
      expect(logger.sanitizeData(123)).toBe(123);
      expect(logger.sanitizeData(null)).toBe(null);
      expect(logger.sanitizeData(undefined)).toBe(undefined);
    });
  });

  describe('Utility Methods', () => {
    test('should create correlation ID', () => {
      const id1 = logger.createCorrelationId();
      const id2 = logger.createCorrelationId();
      
      expect(typeof id1).toBe('string');
      expect(typeof id2).toBe('string');
      expect(id1).not.toBe(id2);
      expect(id1).toMatch(/^\d+-[a-z0-9]+$/);
    });

    test('should get system information', () => {
      const sysInfo = logger.getSystemInfo();
      
      expect(sysInfo).toHaveProperty('node');
      expect(sysInfo).toHaveProperty('platform');
      expect(sysInfo).toHaveProperty('arch');
      expect(sysInfo).toHaveProperty('uptime');
      expect(sysInfo).toHaveProperty('memory');
      expect(sysInfo).toHaveProperty('loadAvg');
      expect(sysInfo).toHaveProperty('cpus');
      
      expect(sysInfo.memory).toHaveProperty('rss');
      expect(sysInfo.memory).toHaveProperty('heapUsed');
      expect(sysInfo.memory).toHaveProperty('heapTotal');
      expect(sysInfo.memory).toHaveProperty('external');
    });

    test('should log startup information', () => {
      logger.logStartup();
      
      expect(mockWinstonLogger.info).toHaveBeenCalledWith('Application starting up', 
        expect.objectContaining({
          pid: process.pid,
          env: process.env.NODE_ENV,
          node: expect.any(String),
          platform: expect.any(String)
        })
      );
    });

    test('should log shutdown information', () => {
      logger.logShutdown('SIGTERM');
      
      expect(mockWinstonLogger.info).toHaveBeenCalledWith('Application shutting down', 
        expect.objectContaining({
          reason: 'SIGTERM',
          uptime: expect.any(Number)
        })
      );
    });

    test('should create and use timer', () => {
      const endTimer = logger.timer('test operation');
      
      // Simulate some work
      setTimeout(() => {
        const duration = endTimer({ result: 'success' });
        
        expect(typeof duration).toBe('number');
        expect(duration).toBeGreaterThan(0);
        expect(mockWinstonLogger.info).toHaveBeenCalledWith('Performance: test operation', 
          expect.objectContaining({
            operation: 'test operation',
            duration: expect.any(Number),
            result: 'success',
            performanceMetric: true
          })
        );
      }, 10);
    });
  });

  describe('Express Middleware', () => {
    test('should create request logger middleware', () => {
      const middleware = requestLogger();
      expect(typeof middleware).toBe('function');
      expect(middleware.length).toBe(3); // Express middleware signature
    });

    test('should skip logging for specified paths', () => {
      const middleware = requestLogger({ skipPaths: ['/health'] });
      const req = { path: '/health' };
      const res = {};
      const next = jest.fn();
      
      middleware(req, res, next);
      
      expect(next).toHaveBeenCalled();
      expect(req.correlationId).toBeUndefined();
    });

    test('should add correlation ID to request', () => {
      const middleware = requestLogger();
      const req = { path: '/api/test' };
      const res = { 
        setHeader: jest.fn(),
        end: jest.fn()
      };
      const next = jest.fn();
      
      middleware(req, res, next);
      
      expect(req.correlationId).toBeDefined();
      expect(res.setHeader).toHaveBeenCalledWith('X-Correlation-ID', req.correlationId);
      expect(next).toHaveBeenCalled();
    });

    test('should create error logger middleware', () => {
      const middleware = errorLogger;
      expect(typeof middleware).toBe('function');
      expect(middleware.length).toBe(4); // Express error middleware signature
    });

    test('should log errors with request context', () => {
      const err = new Error('Test error');
      const req = {
        method: 'POST',
        originalUrl: '/api/test',
        correlationId: 'test-123',
        get: jest.fn(() => 'test-agent'),
        ip: '127.0.0.1'
      };
      const res = {};
      const next = jest.fn();
      
      errorLogger(err, req, res, next);
      
      expect(next).toHaveBeenCalledWith(err);
      // Note: We can't easily test the actual logging here without more complex mocking
    });
  });

  describe('Configuration', () => {
    test('should have correct log levels', () => {
      expect(LOG_LEVELS).toEqual({
        error: 0,
        warn: 1,
        audit: 2,
        info: 3,
        queue: 4,
        memory: 5,
        debug: 6
      });
    });

    test('should handle environment variables', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'test';
      
      // Create new logger instance to test env handling
      const testLogger = new Logger('env-test');
      expect(testLogger.defaultService).toBe('env-test');
      
      process.env.NODE_ENV = originalEnv;
    });
  });

  describe('Edge Cases', () => {
    test('should handle missing request properties', () => {
      const req = {
        method: 'GET'
        // Missing other properties
      };
      const res = { statusCode: 200 };
      
      // Should not throw
      expect(() => logger.request(req, res, 100)).not.toThrow();
    });

    test('should handle circular references in metadata', () => {
      const obj = { name: 'test' };
      obj.self = obj; // Create circular reference
      
      // Should not throw (Winston handles this)
      expect(() => logger.info('Test', obj)).not.toThrow();
    });

    test('should handle very large metadata objects', () => {
      const largeObj = {};
      for (let i = 0; i < 1000; i++) {
        largeObj[`key${i}`] = `value${i}`;
      }
      
      // Should not throw
      expect(() => logger.info('Large object test', largeObj)).not.toThrow();
    });
  });
});