# 🚀 Production Deployment Guide
## SEO Audit Tool with Browserless.io Integration

This guide follows DevOps best practices for secure, scalable deployment to Google Cloud Run with Browserless.io for JavaScript rendering.

## 📋 Prerequisites

1. **Google Cloud Project** with billing enabled
2. **Browserless.io Account** (free tier: 6 hours/month)
3. **gcloud CLI** installed and authenticated
4. **Domain** for production frontend (optional)

## 🔐 Security Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│  Cloudflare     │    │   Cloud Run      │    │ Browserless.io  │
│  Pages (UI)     │───▶│   Backend        │───▶│  (Headless      │
│                 │    │                  │    │   Browsers)     │
│  • Static only  │    │  • Secrets in    │    │                 │
│  • No tokens    │    │    Secret Mgr    │    │ • Managed SaaS  │
│                 │    │  • Non-root user │    │ • Professional  │
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

**Key Security Features:**
- 🔒 Browserless token stored in Google Secret Manager
- 🛡️ No secrets in client-side code or environment files
- 👤 Non-root container user
- 🔑 Workload Identity for service-to-service auth
- 📊 Comprehensive monitoring and alerting

---

## 🎯 Step 1: Set Up Browserless.io

1. **Sign up** at https://www.browserless.io/
2. **Get your token** from the dashboard
3. **Note your usage limits** (6 hours/month on free tier)

---

## ⚙️ Step 2: Configure Google Cloud

### Update Configuration Files

Edit the deployment scripts with your details:

```bash
# In deploy-backend-with-browserless.sh
PROJECT_ID="your-project-id"           # Your GCP project
SERVICE_NAME="seo-audit-backend"       # Cloud Run service name  
REGION="us-central1"                   # Your preferred region

# In setup-monitoring.sh
NOTIFICATION_EMAIL="your-email@company.com"  # Alert email
```

### Enable Required APIs

```bash
gcloud services enable run.googleapis.com
gcloud services enable secretmanager.googleapis.com
gcloud services enable monitoring.googleapis.com
gcloud services enable cloudbuild.googleapis.com
```

---

## 🚀 Step 3: Deploy Backend to Cloud Run

### Deploy with Browserless Integration

```bash
# Make scripts executable
chmod +x deploy-backend-with-browserless.sh
chmod +x setup-monitoring.sh

# Deploy (will prompt for Browserless token)
./deploy-backend-with-browserless.sh
```

**What this does:**
- ✅ Creates secret in Secret Manager
- ✅ Builds container with production optimizations
- ✅ Deploys to Cloud Run with:
  - 2 CPU cores, 2GB RAM
  - Concurrency: 5 (optimized for headless work)
  - Timeout: 3 minutes
  - Auto-scaling: 0-50 instances
- ✅ Configures IAM permissions
- ✅ Provides service URL for frontend

### Set Up Monitoring (Recommended)

```bash
./setup-monitoring.sh
```

**Monitoring includes:**
- 📈 Request rate and latency dashboards  
- 🚨 Alerts for high error rates (>10/min)
- 💾 Memory usage alerts (>80%)
- 💰 Egress cost monitoring (>1GB/hour)
- 📧 Email notifications

---

## 🌐 Step 4: Deploy Frontend

### Update Frontend Configuration

```bash
# Update the API URL in your frontend env
echo "VITE_API_URL=https://your-service-url" > .env.production
```

### Deploy to Cloudflare Pages

```bash
npm run build
# Deploy dist/ to Cloudflare Pages via dashboard or CLI
```

---

## 🧪 Step 5: Test Production Deployment

### Health Check
```bash
curl https://your-service-url/api/health
```

### Static Analysis Test
```bash
curl -X POST https://your-service-url/api/audit \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com"}'
```

### JavaScript Rendering Test
```bash
curl -X POST https://your-service-url/api/audit/two-pass \
  -H "Content-Type: application/json" \
  -d '{"url": "https://react.dev"}'
```

**Expected Response:**
```json
{
  "mode": "two-pass",
  "phases": {
    "static": { "completed": true, "executionTime": 800 },
    "javascript": { "completed": true, "executionTime": 4200 }
  },
  "tests": {
    "seo": {
      "jsAnalysis": {
        "needsJS": true,
        "confidence": "high",
        "recommendation": "JavaScript rendering strongly recommended"
      }
    }
  }
}
```

---

## 📊 What "Good" Looks Like

### ✅ Performance Benchmarks

| Metric | Target | How to Check |
|--------|--------|--------------|
| **Static Analysis** | < 2 seconds | Cloud Run logs |
| **JS Rendering** | < 10 seconds | Two-pass audit response |
| **Error Rate** | < 1% | Monitoring dashboard |
| **Memory Usage** | < 80% | Cloud Run metrics |
| **Cold Start** | < 5 seconds | Request tracing |

### ✅ Security Checklist

- [ ] Browserless token in Secret Manager (not env vars)
- [ ] No secrets in client-side code
- [ ] Service running as non-root user  
- [ ] HTTPS-only endpoints
- [ ] Monitoring alerts configured
- [ ] Regular token rotation scheduled

### ✅ Cost Management

- [ ] Free tier limits understood (6 hours/month)
- [ ] Monitoring set up for egress costs
- [ ] Auto-scaling configured (max 50 instances)
- [ ] Circuit breaker prevents runaway costs

---

## 🔄 Maintenance & Operations

### View Logs
```bash
gcloud run logs tail seo-audit-backend --region=us-central1
```

### Monitor Usage
```bash
# View recent deployments
gcloud run services describe seo-audit-backend --region=us-central1

# Check secret versions
gcloud secrets versions list browserless-token
```

### Rotate Browserless Token
```bash
# Add new token version
echo -n 'NEW_BROWSERLESS_TOKEN' | gcloud secrets versions add browserless-token --data-file=-

# Update Cloud Run to use latest version  
gcloud run services update seo-audit-backend \
  --update-secrets "BROWSERLESS_TOKEN=browserless-token:latest" \
  --region=us-central1
```

### Scale Based on Usage
```bash
# Increase concurrency for higher throughput
gcloud run services update seo-audit-backend \
  --concurrency=10 --max-instances=100 --region=us-central1

# Reduce for cost optimization
gcloud run services update seo-audit-backend \
  --concurrency=3 --max-instances=20 --region=us-central1
```

---

## 🆘 Troubleshooting

### Common Issues

**Issue: "Circuit breaker open"**
```bash
# Check error logs
gcloud run logs tail seo-audit-backend --region=us-central1 | grep ERROR

# Reset by redeploying
gcloud run services replace service.yaml --region=us-central1
```

**Issue: Browserless quota exceeded**
```bash
# Check usage in Browserless dashboard
# Consider upgrading plan or optimizing requests
```

**Issue: High memory usage**
```bash
# Scale up memory
gcloud run services update seo-audit-backend \
  --memory=4Gi --region=us-central1
```

### Support Contacts

- **Browserless.io Support**: support@browserless.io
- **Google Cloud Support**: Through Cloud Console
- **Internal DevOps**: your-devops-team@company.com

---

## 📈 Scaling Beyond MVP

When you outgrow the free tier:

1. **Upgrade Browserless Plan**: $50/month for 40 hours
2. **Implement Queuing**: Use Cloud Tasks for burst traffic
3. **Add Caching**: Redis for frequently accessed sites  
4. **Consider Self-Hosting**: If >200 hours/month needed

This architecture supports scaling from MVP to production with minimal changes.

---

**🎉 You're now running a production-grade SEO audit tool with enterprise-level JavaScript rendering capabilities!**