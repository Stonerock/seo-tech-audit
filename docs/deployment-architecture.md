# 🚀 Deployment Architecture - Cloudflare Pages + Cloud Run

## 📋 Overview

This document outlines our production deployment strategy using **Cloudflare Pages** for the frontend and **Google Cloud Run** for the backend API. This architecture provides:

- ✅ **Near-zero cost** for MVP deployment ($0-5/month)
- ✅ **Global performance** with Cloudflare's edge network
- ✅ **Auto-scaling** from 0 to 100k+ requests
- ✅ **Production-ready** from day one

## 🏗️ Architecture Overview

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│  Cloudflare     │    │   Cloudflare     │    │  Google Cloud   │
│  DNS + CDN      │───▶│  Pages (Frontend)│───▶│  Run (Backend)  │
│                 │    │  Edge Functions  │    │  Docker + AI    │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                │                        │
                                ▼                        ▼
                       ┌──────────────────┐    ┌─────────────────┐
                       │  Static Assets   │    │  Cloud SQL      │
                       │  HTML/CSS/JS     │    │  PostgreSQL     │
                       └──────────────────┘    └─────────────────┘
```

## 📁 Project Structure

```
seo-audit-tool/
├── frontend/                   # Cloudflare Pages
│   ├── index.html
│   ├── assets/
│   │   ├── css/
│   │   ├── js/
│   │   └── images/
│   ├── functions/              # Edge Functions
│   │   └── api/
│   │       └── [...path].js    # Proxy to Cloud Run
│   ├── _redirects              # Cloudflare routing
│   └── wrangler.toml          # Cloudflare config
├── backend/                    # Google Cloud Run
│   ├── Dockerfile
│   ├── server.js              # Express entry point
│   ├── routes/
│   │   ├── audit.js
│   │   ├── sitemap.js
│   │   ├── llms.js
│   │   └── health.js
│   ├── services/
│   │   ├── seo-analyzer.js
│   │   ├── ai-analyzer.js     # NLP-powered analysis
│   │   ├── performance-analyzer.js
│   │   ├── audit-orchestrator.js
│   │   └── bot-policy-analyzer.js
│   ├── utils/
│   │   ├── helpers.js
│   │   ├── cache.js
│   │   └── validation.js
│   └── tests/
│       ├── unit/
│       └── integration/
├── .github/
│   └── workflows/
│       ├── deploy-frontend.yml
│       ├── deploy-backend.yml
│       └── run-tests.yml
└── docs/
    ├── deployment-architecture.md
    ├── ci-cd-pipeline.md
    └── api-documentation.md
```

## 🐳 Docker Configuration

### Optimized Dockerfile for Cloud Run

```dockerfile
# backend/Dockerfile
FROM mcr.microsoft.com/playwright:v1.49-jammy as base

# Set working directory
WORKDIR /app

# Copy package files for better Docker layer caching
COPY package*.json ./

# Install production dependencies
RUN npm ci --omit=dev && \
    npm cache clean --force && \
    playwright install chromium --with-deps

# Copy application code
COPY . .

# Create non-root user for security
RUN groupadd -r appuser && useradd -r -g appuser appuser
RUN chown -R appuser:appuser /app
USER appuser

# Environment configuration
ENV NODE_ENV=production \
    PORT=8080 \
    PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PLAYWRIGHT_BROWSERS_PATH=/ms-playwright

# Health check endpoint
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:$PORT/health || exit 1

# Expose port
EXPOSE 8080

# Start application
CMD ["node", "server.js"]
```

### .dockerignore Optimization

```dockerignore
# backend/.dockerignore
node_modules
npm-debug.log
.git
.gitignore
README.md
.env
.nyc_output
coverage
.vscode
.idea
frontend/
.github/
docs/
test-reports/
*.log
.DS_Store
```

## ☁️ Cloud Run Configuration

### Deployment Command

```bash
gcloud run deploy seo-audit-api \
    --source ./backend \
    --project=$GCP_PROJECT_ID \
    --region=europe-north1 \
    --allow-unauthenticated \
    --port=8080 \
    --timeout=900s \
    --memory=2Gi \
    --cpu=2 \
    --concurrency=10 \
    --min-instances=0 \
    --max-instances=100 \
    --execution-environment=gen2 \
    --set-env-vars="NODE_ENV=production,ENABLE_AI_ANALYSIS=true" \
    --set-secrets="API_KEYS=/secrets/api-keys:latest" \
    --labels="app=seo-audit,environment=production"
```

### Resource Configuration Explained

- **Memory: 2GB** - Handles Playwright + AI analysis + multiple concurrent requests
- **CPU: 2 vCPU** - Enables parallel processing of audit components
- **Timeout: 15min** - Accommodates deep sitemap scans (200+ pages)
- **Concurrency: 10** - Balances throughput with memory usage
- **Auto-scaling: 0-100** - Cost-effective scaling with burst capacity

## 🌐 Cloudflare Pages Configuration

### Edge Function Proxy

```javascript
// frontend/functions/api/[...path].js
export async function onRequest(context) {
  const { request, env, params } = context;
  const url = new URL(request.url);
  
  // Build Cloud Run URL
  const apiPath = params.path.join('/');
  const targetUrl = `${env.CLOUD_RUN_URL}/api/${apiPath}${url.search}`;
  
  // Forward request with proper headers
  const response = await fetch(targetUrl, {
    method: request.method,
    headers: {
      ...request.headers,
      'X-Forwarded-For': request.headers.get('CF-Connecting-IP'),
      'X-Real-IP': request.headers.get('CF-Connecting-IP'),
      'User-Agent': request.headers.get('User-Agent'),
    },
    body: request.method !== 'GET' ? request.body : undefined,
  });
  
  // Return response with CORS headers
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
  
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }
  
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: {
      ...response.headers,
      ...corsHeaders,
    },
  });
}
```

### Cloudflare Configuration

```toml
# frontend/wrangler.toml
name = "seo-audit-frontend"
compatibility_date = "2024-01-01"
pages_build_output_dir = "."

[env.production.vars]
CLOUD_RUN_URL = "https://seo-audit-api-xxx-ew.a.run.app"

[[env.production.kv_namespaces]]
binding = "AUDIT_CACHE"
id = "your-kv-namespace-id"
```

## 🗄️ Database Strategy

### Option 1: Cloud SQL (Recommended for Production)

```bash
# Create Cloud SQL instance
gcloud sql instances create seo-audit-db \
    --database-version=POSTGRES_15 \
    --tier=db-f1-micro \
    --region=europe-north1 \
    --storage-type=SSD \
    --storage-size=10GB \
    --storage-auto-increase \
    --backup-start-time=02:00 \
    --maintenance-window-day=SUN \
    --maintenance-window-hour=03
```

### Option 2: SQLite with Cloud Storage (Cost-Effective)

```yaml
# Mount persistent storage for SQLite
gcloud run deploy seo-audit-api \
    --add-volume=name=audit-data,type=cloud-storage,bucket=seo-audit-storage \
    --add-volume-mount=volume=audit-data,mount-path=/app/data
```

## 🔒 Security Configuration

### Secret Management

```bash
# Store API keys in Secret Manager
gcloud secrets create api-keys \
    --data-file=secrets/api-keys.json \
    --project=$GCP_PROJECT_ID

# Grant Cloud Run access
gcloud projects add-iam-policy-binding $GCP_PROJECT_ID \
    --member="serviceAccount:$CLOUD_RUN_SA" \
    --role="roles/secretmanager.secretAccessor"
```

### Environment Variables

```bash
# backend/.env.example
NODE_ENV=production
PORT=8080

# External API Keys (stored in Secret Manager)
PSI_API_KEY=your_pagespeed_insights_key
WPT_API_KEY=your_webpagetest_key

# Database Configuration
DATABASE_URL=postgresql://user:pass@host:5432/seo_audit_db
SQLITE_PATH=/app/data/audits.db

# AI Analysis Configuration
ENABLE_AI_ANALYSIS=true
MAX_CONCURRENT_AUDITS=10
CACHE_ENABLED=true

# Monitoring
LOG_LEVEL=info
ENABLE_METRICS=true
SENTRY_DSN=https://your-sentry-dsn
```

## 📊 Monitoring & Logging

### Health Check Implementation

```javascript
// backend/routes/health.js
const express = require('express');
const router = express.Router();

router.get('/health', async (req, res) => {
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version,
    memory: process.memoryUsage(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV
  };
  
  try {
    // Test critical dependencies
    await testDatabaseConnection();
    await testExternalAPIs();
    
    res.status(200).json(health);
  } catch (error) {
    res.status(503).json({
      ...health,
      status: 'unhealthy',
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

async function testDatabaseConnection() {
  // Test database connectivity
  // Implementation depends on chosen database
}

async function testExternalAPIs() {
  // Test critical external services
  // PageSpeed Insights, WebPageTest, etc.
}

module.exports = router;
```

## 💰 Cost Analysis

### Development/MVP Phase
- **Cloudflare Pages**: Free (unlimited static hosting)
- **Cloud Run**: $0-5/month (pay-per-use, generous free tier)
- **Cloud SQL**: $7/month (db-f1-micro instance)
- **Total**: $7-12/month

### Production Phase (1000 audits/month)
- **Cloudflare Pages**: Free
- **Cloud Run**: $15-25/month (based on usage)
- **Cloud SQL**: $15/month (larger instance)
- **Secrets/Storage**: $2/month
- **Total**: $32-42/month

### High-Volume Phase (10k+ audits/month)
- **Cloudflare Pages**: Free
- **Cloud Run**: $50-100/month
- **Cloud SQL**: $30-50/month
- **Additional services**: $10-20/month
- **Total**: $90-170/month

## 🎯 Performance Optimizations

### Frontend Optimizations
- **Static asset caching** via Cloudflare CDN
- **Edge function caching** for API responses
- **Image optimization** with Cloudflare Polish
- **Minification** and compression

### Backend Optimizations
- **Container image optimization** with multi-stage builds
- **Memory management** for long-running processes
- **Connection pooling** for database connections
- **Request queuing** to prevent resource exhaustion

## 🚀 Deployment Checklist

### Pre-deployment
- [ ] Code refactoring complete
- [ ] Tests passing (unit + integration)
- [ ] Docker image builds successfully
- [ ] Environment variables configured
- [ ] Secrets created in Secret Manager

### Initial Deployment
- [ ] Deploy backend to Cloud Run
- [ ] Deploy frontend to Cloudflare Pages
- [ ] Configure custom domain
- [ ] Test end-to-end functionality
- [ ] Set up monitoring alerts

### Post-deployment
- [ ] Monitor performance metrics
- [ ] Check error logs
- [ ] Validate cost projections
- [ ] Document any issues/learnings
- [ ] Plan next iteration

## 📞 Support & Troubleshooting

### Common Issues
1. **Cold start latency**: Consider min-instances=1 for production
2. **Memory issues**: Monitor heap usage and adjust limits
3. **Timeout errors**: Increase Cloud Run timeout for long audits
4. **CORS issues**: Verify edge function proxy configuration

### Monitoring Tools
- **Google Cloud Console**: Service metrics and logs
- **Cloudflare Analytics**: Frontend performance and traffic
- **Cloud Logging**: Centralized log aggregation
- **Error Reporting**: Automatic error detection and alerting

---

**Next Steps**: See [CI/CD Pipeline Documentation](ci-cd-pipeline.md) for automated deployment setup.