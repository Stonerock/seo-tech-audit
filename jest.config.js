// jest.config.js
// Jest testing framework configuration
// MVP Configuration: Focus on core functionality and key integrations
// Edge cases in validation are skipped to ensure CI/CD pipeline stability

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
      branches: 29,
      functions: 35,
      lines: 38,
      statements: 37
    },
    './services/': {
      branches: 19,
      functions: 26,
      lines: 29,
      statements: 28
    },
    './utils/': {
      branches: 82,
      functions: 86,
      lines: 86,
      statements: 86
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
  
  // Setup Node.js environment properly
  setupFiles: ['<rootDir>/tests/jest-setup.js'],
  
  // Module path mapping
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
    '^@utils/(.*)$': '<rootDir>/utils/$1',
    '^@services/(.*)$': '<rootDir>/services/$1',
    '^@routes/(.*)$': '<rootDir>/routes/$1'
  }
};