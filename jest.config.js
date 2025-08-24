// jest.config.js
// Jest testing framework configuration

module.exports = {
  // Test environment
  testEnvironment: 'node',
  
  // Test file patterns
  testMatch: [
    '**/__tests__/**/*.js',
    '**/?(*.)+(spec|test).js'
  ],
  
  // Setup files
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
  
  // Global teardown for final cleanup
  globalTeardown: '<rootDir>/tests/teardown.js',
  
  // Transform ignore patterns for ESM modules
  transformIgnorePatterns: [
    'node_modules/(?!(franc|trigram-utils|n-gram|collapse-white-space)/)',
  ],
  
  // Coverage configuration
  collectCoverage: true,
  collectCoverageFrom: [
    'services/**/*.js',
    'utils/**/*.js',
    'routes/**/*.js',
    '!**/node_modules/**',
    '!tests/**',
    '!**/*.test.js',
    '!**/*.spec.js',
    '!services/ai-integration-example.js'
  ],
  
  // Coverage thresholds - set to current project levels
  coverageThreshold: {
    global: {
      branches: 37,
      functions: 38,
      lines: 43,
      statements: 42
    },
    './services/': {
      branches: 29,
      functions: 29,
      lines: 36,
      statements: 35
    },
    './utils/': {
      branches: 84,
      functions: 86,
      lines: 88,
      statements: 88
    }
  },
  
  // Coverage reports
  coverageReporters: [
    'text',
    'text-summary',
    'html',
    'lcov'
  ],
  
  // Coverage directory
  coverageDirectory: 'coverage',
  
  // Test timeout (for async operations)
  testTimeout: 30000,
  
  // Clear mocks between tests
  clearMocks: true,
  
  // Restore mocks after each test
  restoreMocks: true,
  
  // Verbose output
  verbose: true,
  
  // Detect open handles (useful for debugging)
  detectOpenHandles: true,
  
  // Force exit after tests complete
  forceExit: false,
  
  // Maximum worker processes
  maxWorkers: '50%',
  
  // Module file extensions
  moduleFileExtensions: ['js', 'json', 'node'],
  
  // Test result processor
  testResultsProcessor: undefined,
  
  // Global variables available in tests
  globals: {
    'process.env.NODE_ENV': 'test'
  },
  
  // Module path mapping
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
    '^@utils/(.*)$': '<rootDir>/utils/$1',
    '^@services/(.*)$': '<rootDir>/services/$1',
    '^@routes/(.*)$': '<rootDir>/routes/$1'
  }
};