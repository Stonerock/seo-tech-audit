// tests/setup.js
// Jest test setup file

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.PORT = '3001';
process.env.API_KEYS = 'test-key-1,test-key-2';
process.env.USE_PSI_METRICS = 'false';

// Extend Jest matchers
expect.extend({
  toBeValidUrl(received) {
    try {
      new URL(received);
      return {
        message: () => `expected ${received} not to be a valid URL`,
        pass: true
      };
    } catch (error) {
      return {
        message: () => `expected ${received} to be a valid URL`,
        pass: false
      };
    }
  },
  
  toHaveHttpStatus(received, expected) {
    const pass = received.status === expected;
    return {
      message: () => 
        pass 
          ? `expected response not to have status ${expected}`
          : `expected response to have status ${expected}, but got ${received.status}`,
      pass
    };
  },
  
  toBeValidSchema(received) {
    const isValid = received && 
      typeof received === 'object' && 
      received['@type'] && 
      received['@context'];
    
    return {
      message: () => 
        isValid 
          ? 'expected object not to be valid schema'
          : 'expected object to be valid schema (missing @type or @context)',
      pass: isValid
    };
  }
});

// Global test utilities
global.testUtils = {
  // Create mock HTML content
  createMockHtml: (options = {}) => {
    const {
      title = 'Test Page',
      description = 'Test description',
      lang = 'en',
      schema = null,
      content = '<p>Test content</p>'
    } = options;
    
    let schemaScript = '';
    if (schema) {
      schemaScript = `<script type="application/ld+json">${JSON.stringify(schema)}</script>`;
    }
    
    return `
      <!DOCTYPE html>
      <html lang="${lang}">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>${title}</title>
          <meta name="description" content="${description}">
          ${schemaScript}
        </head>
        <body>
          <h1>${title}</h1>
          ${content}
        </body>
      </html>
    `;
  },
  
  // Create mock audit results
  createMockAuditResults: (overrides = {}) => {
    return {
      url: 'https://example.com',
      timestamp: new Date().toISOString(),
      processingTime: 1000,
      tests: {
        seo: {
          score: 85,
          https: true,
          title: 'Test Page',
          issues: []
        },
        performance: {
          scores: { overall: 'good' },
          metrics: { loadComplete: 2000 }
        },
        accessibility: {
          score: 'good',
          issues: []
        },
        schema: {
          found: true,
          types: ['WebPage'],
          schemas: []
        },
        ...overrides
      }
    };
  },
  
  // Create mock response headers
  createMockHeaders: (overrides = {}) => {
    return {
      'content-type': 'text/html; charset=utf-8',
      'content-length': '1234',
      'server': 'nginx/1.18.0',
      ...overrides
    };
  },
  
  // Sleep utility for async tests
  sleep: (ms) => new Promise(resolve => setTimeout(resolve, ms)),
  
  // Generate test URLs
  generateTestUrl: (path = '') => `https://test-domain.com${path}`,
  
  // Mock fetch responses
  mockFetchResponse: (data, options = {}) => {
    const {
      status = 200,
      headers = {},
      ok = status >= 200 && status < 300
    } = options;
    
    return Promise.resolve({
      ok,
      status,
      headers: new Map(Object.entries(headers)),
      text: () => Promise.resolve(typeof data === 'string' ? data : JSON.stringify(data)),
      json: () => Promise.resolve(typeof data === 'object' ? data : JSON.parse(data))
    });
  }
};

// Mock console methods in tests to reduce noise
global.console = {
  ...console,
  log: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  info: jest.fn(),
  debug: jest.fn()
};

// Setup and teardown hooks
beforeEach(() => {
  // Clear all mocks before each test
  jest.clearAllMocks();
  
  // Reset console mocks
  global.console.log.mockClear();
  global.console.warn.mockClear();
  global.console.error.mockClear();
});

afterEach(() => {
  // Clean up after each test
  jest.restoreAllMocks();
});

// Global audit queue cleanup
let globalAuditQueue = null;

// Function to get audit queue instance for cleanup
const getAuditQueueForCleanup = () => {
  try {
    // Only import if not mocked
    const auditQueueModule = require('../../services/audit-queue');
    if (!jest.isMockFunction(auditQueueModule.getGlobalQueue)) {
      return auditQueueModule.getGlobalQueue();
    }
  } catch (error) {
    // Ignore if module is mocked or not available
  }
  return null;
};

// Global cleanup after all tests
afterAll(async () => {
  try {
    // Clean up audit queue if it exists
    const auditQueue = getAuditQueueForCleanup();
    if (auditQueue && typeof auditQueue.shutdown === 'function') {
      await auditQueue.shutdown();
    }
    
    // Try to use the shutdown function from the module
    const auditQueueModule = require('../../services/audit-queue');
    if (auditQueueModule.shutdownGlobalQueue && typeof auditQueueModule.shutdownGlobalQueue === 'function') {
      await auditQueueModule.shutdownGlobalQueue();
    }
  } catch (error) {
    // Ignore cleanup errors (likely because modules are mocked)
  }
  
  // Force clear any remaining intervals as a safety net
  if (globalAuditQueue) {
    if (globalAuditQueue.processingInterval) {
      clearInterval(globalAuditQueue.processingInterval);
    }
    if (globalAuditQueue.cleanupIntervalRef) {
      clearInterval(globalAuditQueue.cleanupIntervalRef);
    }
  }
});

// Global error handler for unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Timeout for long-running tests
jest.setTimeout(30000);