# 🏗️ Build Configuration Guide

## 📋 Overview

This document outlines the build configuration for the SEO Audit Tool, covering local development setup, Docker containerization, and production build optimization for deployment to Cloudflare Pages and Google Cloud Run.

## 🛠️ Development Environment Setup

### Prerequisites

- **Node.js** 18+ (LTS recommended)
- **npm** 8+
- **Docker** 20+ (for containerization)
- **Git** 2.30+
- **Google Cloud SDK** (for deployment)

### Local Development Setup

```bash
# Clone repository
git clone https://github.com/your-username/seo-audit-tool.git
cd seo-audit-tool

# Install dependencies
npm install

# Install Playwright browsers
npx playwright install

# Copy environment template
cp .env.example .env

# Start development server
npm run dev
```

### Environment Configuration

```bash
# .env (local development)
NODE_ENV=development
PORT=3001

# External API Keys (optional for development)
PSI_API_KEY=your_pagespeed_insights_key
WPT_API_KEY=your_webpagetest_key

# Development Database
DATABASE_URL=sqlite:./data/dev.db

# AI Analysis Configuration
ENABLE_AI_ANALYSIS=true
MAX_CONCURRENT_AUDITS=3

# Debug Configuration
DEBUG=seo-audit:*
LOG_LEVEL=debug
```

## 📦 Package.json Scripts

### Core Scripts

```json
{
  "scripts": {
    "start": "node server.js",
    "dev": "nodemon server.js",
    "build": "npm run build:backend && npm run build:frontend",
    "build:backend": "npm run test && npm run lint",
    "build:frontend": "npm run build:assets && npm run optimize:images",
    "build:assets": "postcss assets/css/main.css -o dist/css/main.min.css && uglifyjs assets/js/main.js -o dist/js/main.min.js",
    "optimize:images": "imagemin assets/images/* --out-dir=dist/images",
    
    "test": "jest",
    "test:unit": "jest tests/unit",
    "test:integration": "jest tests/integration",
    "test:coverage": "jest --coverage",
    "test:watch": "jest --watch",
    "test:ci": "jest --ci --coverage --watchAll=false",
    
    "lint": "eslint . --ext .js,.json",
    "lint:fix": "eslint . --ext .js,.json --fix",
    "lint:frontend": "eslint assets/js --ext .js",
    "format": "prettier --write .",
    "format:check": "prettier --check .",
    
    "type-check": "tsc --noEmit",
    "security-scan": "npm audit && snyk test",
    
    "docker:build": "docker build -t seo-audit-tool .",
    "docker:run": "docker run -p 3001:8080 seo-audit-tool",
    "docker:dev": "docker-compose -f docker-compose.dev.yml up",
    
    "deploy:backend": "gcloud run deploy seo-audit-api --source .",
    "deploy:frontend": "npm run build:frontend && wrangler pages publish dist",
    
    "clean": "rm -rf dist/ coverage/ .nyc_output/",
    "clean:deps": "rm -rf node_modules/ package-lock.json && npm install",
    "clean:all": "npm run clean && npm run clean:deps"
  }
}
```

### Development Dependencies

```json
{
  "devDependencies": {
    "@types/node": "^18.17.0",
    "eslint": "^8.45.0",
    "eslint-config-prettier": "^9.0.0",
    "eslint-plugin-node": "^11.1.0",
    "jest": "^29.6.0",
    "nodemon": "^3.0.1",
    "prettier": "^3.0.0",
    "supertest": "^6.3.3",
    "typescript": "^5.1.0",
    
    "postcss": "^8.4.27",
    "postcss-cli": "^10.1.0",
    "autoprefixer": "^10.4.14",
    "cssnano": "^6.0.1",
    "uglify-js": "^3.17.4",
    "imagemin": "^8.0.1",
    "imagemin-mozjpeg": "^10.0.0",
    "imagemin-pngquant": "^9.0.2",
    
    "docker-compose": "^0.24.2",
    "snyk": "^1.1200.0",
    "@google-cloud/functions-framework": "^3.3.0"
  }
}
```

## 🐳 Docker Configuration

### Production Dockerfile

```dockerfile
# Dockerfile
FROM mcr.microsoft.com/playwright:v1.49-jammy as base

# Install Node.js 18
RUN curl -fsSL https://deb.nodesource.com/setup_18.x | bash - && \
    apt-get install -y nodejs

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --omit=dev && \
    npm cache clean --force

# Install Playwright with dependencies
RUN npx playwright install chromium --with-deps

# Copy application code
COPY . .

# Remove unnecessary files
RUN rm -rf tests/ docs/ .github/ .git/ *.md

# Create non-root user
RUN groupadd -r appuser && \
    useradd -r -g appuser appuser && \
    chown -R appuser:appuser /app

USER appuser

# Set production environment
ENV NODE_ENV=production \
    PORT=8080 \
    PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PLAYWRIGHT_BROWSERS_PATH=/ms-playwright

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:$PORT/health || exit 1

# Expose port
EXPOSE 8080

# Start application
CMD ["node", "server.js"]
```

### Development Docker Compose

```yaml
# docker-compose.dev.yml
version: '3.8'

services:
  app:
    build:
      context: .
      dockerfile: Dockerfile.dev
    ports:
      - "3001:8080"
    environment:
      - NODE_ENV=development
      - DEBUG=seo-audit:*
      - DATABASE_URL=sqlite:./data/dev.db
    volumes:
      - ./:/app
      - /app/node_modules
    depends_on:
      - redis
      - postgres

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    command: redis-server --appendonly yes
    volumes:
      - redis_data:/data

  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_DB: seo_audit_dev
      POSTGRES_USER: dev
      POSTGRES_PASSWORD: dev123
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

volumes:
  redis_data:
  postgres_data:
```

### Development Dockerfile

```dockerfile
# Dockerfile.dev
FROM mcr.microsoft.com/playwright:v1.49-jammy

WORKDIR /app

# Install Node.js 18
RUN curl -fsSL https://deb.nodesource.com/setup_18.x | bash - && \
    apt-get install -y nodejs

# Copy package files
COPY package*.json ./

# Install all dependencies (including dev)
RUN npm install

# Install Playwright browsers
RUN npx playwright install

# Copy application code
COPY . .

# Expose port
EXPOSE 8080

# Start with nodemon for development
CMD ["npm", "run", "dev"]
```

## 🎨 Frontend Build Configuration

### PostCSS Configuration

```javascript
// postcss.config.js
module.exports = {
  plugins: [
    require('autoprefixer'),
    require('cssnano')({
      preset: ['default', {
        discardComments: { removeAll: true },
        normalizeWhitespace: true,
        colormin: true,
        convertValues: true,
        discardDuplicates: true
      }]
    })
  ]
}
```

### Asset Optimization

```javascript
// build-scripts/optimize-assets.js
const imagemin = require('imagemin');
const imageminMozjpeg = require('imagemin-mozjpeg');
const imageminPngquant = require('imagemin-pngquant');
const UglifyJS = require('uglify-js');
const fs = require('fs');
const path = require('path');

// Optimize images
async function optimizeImages() {
  await imagemin(['assets/images/*.{jpg,png}'], {
    destination: 'dist/images',
    plugins: [
      imageminMozjpeg({ quality: 80 }),
      imageminPngquant({ quality: [0.6, 0.8] })
    ]
  });
  console.log('✅ Images optimized');
}

// Minify JavaScript
function minifyJS() {
  const jsFiles = fs.readdirSync('assets/js')
    .filter(file => file.endsWith('.js'))
    .map(file => path.join('assets/js', file));

  jsFiles.forEach(file => {
    const code = fs.readFileSync(file, 'utf8');
    const minified = UglifyJS.minify(code, {
      compress: {
        dead_code: true,
        drop_console: true,
        drop_debugger: true
      }
    });

    if (minified.error) {
      console.error(`❌ Error minifying ${file}:`, minified.error);
      return;
    }

    const outputFile = path.join('dist/js', path.basename(file, '.js') + '.min.js');
    fs.writeFileSync(outputFile, minified.code);
    console.log(`✅ Minified ${file} -> ${outputFile}`);
  });
}

// Build service worker
function buildServiceWorker() {
  const swContent = `
const CACHE_NAME = 'seo-audit-v${Date.now()}';
const urlsToCache = [
  '/',
  '/assets/css/main.min.css',
  '/assets/js/main.min.js',
  '/assets/images/logo.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => response || fetch(event.request))
  );
});
  `;

  fs.writeFileSync('dist/sw.js', swContent);
  console.log('✅ Service worker built');
}

// Run all optimizations
async function buildAssets() {
  console.log('🏗️ Building frontend assets...');
  
  // Create dist directory
  if (!fs.existsSync('dist')) {
    fs.mkdirSync('dist', { recursive: true });
  }
  
  ['css', 'js', 'images'].forEach(dir => {
    if (!fs.existsSync(`dist/${dir}`)) {
      fs.mkdirSync(`dist/${dir}`, { recursive: true });
    }
  });

  await Promise.all([
    optimizeImages(),
    minifyJS(),
    buildServiceWorker()
  ]);

  console.log('✅ Frontend build completed');
}

if (require.main === module) {
  buildAssets().catch(console.error);
}

module.exports = { buildAssets, optimizeImages, minifyJS };
```

## 🧪 Testing Configuration

### Jest Configuration

```javascript
// jest.config.js
module.exports = {
  testEnvironment: 'node',
  collectCoverageFrom: [
    'services/**/*.js',
    'utils/**/*.js',
    'routes/**/*.js',
    '!**/*.test.js',
    '!**/node_modules/**'
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    }
  },
  testPathIgnorePatterns: [
    '/node_modules/',
    '/coverage/',
    '/dist/'
  ],
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
  testTimeout: 30000,
  collectCoverage: true,
  coverageReporters: ['text', 'lcov', 'html'],
  coverageDirectory: 'coverage',
  
  // Test patterns
  testMatch: [
    '**/tests/**/*.test.js',
    '**/?(*.)+(spec|test).js'
  ],
  
  // Module paths for testing
  moduleNameMapping: {
    '^@/(.*)$': '<rootDir>/$1',
    '^@services/(.*)$': '<rootDir>/services/$1',
    '^@utils/(.*)$': '<rootDir>/utils/$1'
  },
  
  // Test environment setup
  globalSetup: '<rootDir>/tests/global-setup.js',
  globalTeardown: '<rootDir>/tests/global-teardown.js'
};
```

### Test Setup Files

```javascript
// tests/setup.js
const { TextEncoder, TextDecoder } = require('util');

// Polyfills for Node.js testing environment
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;

// Mock external APIs for testing
jest.mock('../utils/external-apis', () => ({
  fetchPageSpeedInsights: jest.fn(() => Promise.resolve({ data: 'mocked' })),
  fetchWebPageTest: jest.fn(() => Promise.resolve({ data: 'mocked' }))
}));

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'sqlite::memory:';
process.env.LOG_LEVEL = 'error';

// Increase timeout for integration tests
jest.setTimeout(30000);
```

```javascript
// tests/global-setup.js
module.exports = async () => {
  console.log('🧪 Setting up test environment...');
  
  // Start test database
  // Initialize test fixtures
  // Set up test external services
  
  console.log('✅ Test environment ready');
};
```

## 📊 Code Quality Configuration

### ESLint Configuration

```javascript
// .eslintrc.js
module.exports = {
  env: {
    node: true,
    es2022: true,
    jest: true
  },
  extends: [
    'eslint:recommended',
    'plugin:node/recommended',
    'prettier'
  ],
  plugins: ['node'],
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module'
  },
  rules: {
    // Error Prevention
    'no-console': ['warn', { allow: ['warn', 'error'] }],
    'no-debugger': 'error',
    'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    
    // Code Quality
    'prefer-const': 'error',
    'no-var': 'error',
    'object-shorthand': 'error',
    'prefer-template': 'error',
    
    // Node.js Specific
    'node/no-missing-import': 'error',
    'node/no-unpublished-require': 'off',
    'node/exports-style': ['error', 'module.exports'],
    
    // Best Practices
    'eqeqeq': ['error', 'always'],
    'curly': ['error', 'all'],
    'consistent-return': 'error',
    'no-return-await': 'error'
  },
  overrides: [
    {
      files: ['tests/**/*.js'],
      env: {
        jest: true
      },
      rules: {
        'node/no-unpublished-require': 'off'
      }
    }
  ]
};
```

### Prettier Configuration

```javascript
// .prettierrc.js
module.exports = {
  semi: true,
  trailingComma: 'es5',
  singleQuote: true,
  printWidth: 100,
  tabWidth: 2,
  useTabs: false,
  bracketSpacing: true,
  bracketSameLine: false,
  arrowParens: 'avoid',
  endOfLine: 'lf',
  
  // Ignore patterns
  overrides: [
    {
      files: '*.json',
      options: {
        printWidth: 80
      }
    },
    {
      files: '*.md',
      options: {
        proseWrap: 'preserve'
      }
    }
  ]
};
```

### Prettier Ignore

```
# .prettierignore
node_modules/
dist/
coverage/
.git/
*.min.js
*.min.css
package-lock.json
CHANGELOG.md
```

## 🔄 Pre-commit Hooks

### Husky Configuration

```bash
# Install husky
npm install --save-dev husky lint-staged

# Initialize husky
npx husky install

# Add pre-commit hook
npx husky add .husky/pre-commit "npx lint-staged"

# Add commit message hook
npx husky add .husky/commit-msg "npx commitlint --edit $1"
```

### Lint-staged Configuration

```json
{
  "lint-staged": {
    "*.{js,json}": [
      "eslint --fix",
      "prettier --write"
    ],
    "*.{css,html,md}": [
      "prettier --write"
    ],
    "package.json": [
      "sort-package-json"
    ]
  }
}
```

### Commitlint Configuration

```javascript
// commitlint.config.js
module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [
      2,
      'always',
      [
        'feat',     // New feature
        'fix',      // Bug fix
        'docs',     // Documentation
        'style',    // Code style (formatting)
        'refactor', // Code refactoring
        'test',     // Tests
        'chore',    // Build/tooling
        'perf',     // Performance improvement
        'ci',       // CI/CD changes
        'revert'    // Revert commit
      ]
    ],
    'subject-max-length': [2, 'always', 72],
    'body-max-line-length': [2, 'always', 100]
  }
};
```

## 📋 Build Scripts

### Cloud Run Build Script

```bash
#!/bin/bash
# scripts/build-for-cloud-run.sh

set -e

echo "🏗️ Building for Google Cloud Run..."

# Clean previous builds
npm run clean

# Install production dependencies
npm ci --omit=dev

# Run tests
npm run test:ci

# Security audit
npm audit --audit-level=moderate

# Build frontend assets
npm run build:frontend

# Optimize Docker layers
echo "🐳 Building optimized Docker image..."
docker build \
  --platform linux/amd64 \
  --tag seo-audit-tool:latest \
  --target production \
  .

echo "✅ Build completed successfully"
```

### Cloudflare Pages Build Script

```bash
#!/bin/bash
# scripts/build-for-pages.sh

set -e

echo "🌐 Building for Cloudflare Pages..."

# Install dependencies
npm ci

# Build frontend
npm run build:frontend

# Copy static files
cp -r assets/* dist/
cp index.html dist/
cp _redirects dist/

# Generate sitemap
node scripts/generate-sitemap.js > dist/sitemap.xml

# Verify build
echo "📊 Build verification..."
ls -la dist/

echo "✅ Cloudflare Pages build completed"
```

### Build Verification Script

```javascript
// scripts/verify-build.js
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

function verifyBuild() {
  console.log('🔍 Verifying build...');
  
  const checks = [
    {
      name: 'Frontend assets exist',
      check: () => fs.existsSync('dist/css/main.min.css') && fs.existsSync('dist/js/main.min.js')
    },
    {
      name: 'Docker image builds',
      check: () => {
        try {
          execSync('docker build -t test-build .', { stdio: 'pipe' });
          execSync('docker rmi test-build', { stdio: 'pipe' });
          return true;
        } catch (e) {
          return false;
        }
      }
    },
    {
      name: 'Tests pass',
      check: () => {
        try {
          execSync('npm test', { stdio: 'pipe' });
          return true;
        } catch (e) {
          return false;
        }
      }
    },
    {
      name: 'Linting passes',
      check: () => {
        try {
          execSync('npm run lint', { stdio: 'pipe' });
          return true;
        } catch (e) {
          return false;
        }
      }
    }
  ];

  let allPassed = true;
  checks.forEach(({ name, check }) => {
    const passed = check();
    console.log(`${passed ? '✅' : '❌'} ${name}`);
    if (!passed) allPassed = false;
  });

  if (allPassed) {
    console.log('🎉 All build verification checks passed!');
    process.exit(0);
  } else {
    console.log('💥 Build verification failed!');
    process.exit(1);
  }
}

if (require.main === module) {
  verifyBuild();
}

module.exports = { verifyBuild };
```

## 🚀 Quick Start Commands

### Development

```bash
# First time setup
git clone <repo> && cd seo-audit-tool
npm install
cp .env.example .env
npm run dev

# Daily development
npm run dev          # Start with hot reload
npm run test:watch   # Run tests in watch mode
npm run lint:fix     # Fix linting issues
```

### Production Build

```bash
# Local production build
npm run build
npm run docker:build
npm run docker:run

# Deploy to staging
npm run deploy:backend -- --region=europe-north1
npm run deploy:frontend

# Deploy to production
npm run deploy:backend -- --region=europe-north1 --env=production
```

### Maintenance

```bash
# Update dependencies
npm update
npm audit fix

# Clean rebuild
npm run clean:all

# Security scan
npm run security-scan

# Performance check
npm run test:performance
```

---

**Next Steps**: See [API Documentation](api-documentation.md) for detailed API reference and usage examples.