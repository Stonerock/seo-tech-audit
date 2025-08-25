# Browserless.io Integration

This project supports JavaScript rendering through Browserless.io, a cloud-based headless browser service. This integration provides several benefits over local browser instances:

## Benefits

1. **Reduced Resource Usage**: No need to run heavy browser instances locally
2. **Faster Deployments**: Smaller Docker images without browser dependencies
3. **Better Scalability**: Browserless handles concurrency better than local instances
4. **Cost Efficiency**: Pay only for usage with Browserless's free tier

## Setup Instructions

### 1. Get Browserless.io Token

1. Sign up at [https://www.browserless.io/](https://www.browserless.io/)
2. Get your API token from the dashboard
3. Add it to your environment variables:

```bash
# In .env.production
BROWSERLESS_TOKEN=your-actual-token-here
```

### 2. Deploy with Browserless Integration

Use the provided deployment script:

```bash
chmod +x deploy-backend-with-browserless.sh
./deploy-backend-with-browserless.sh
```

### 3. Manual Deployment (Alternative)

If deploying manually, ensure the secret is properly configured:

```bash
# Create secret (one-time setup)
echo "your-browserless-token" | gcloud secrets create browserless-token --data-file=-

# Deploy with secret access
gcloud run deploy your-service-name \
    --source . \
    --update-secrets BROWSERLESS_TOKEN=browserless-token:latest
```

## Configuration

The integration automatically detects whether to use Browserless or fall back to local Playwright:

- **Production**: Uses Browserless.io when `BROWSERLESS_TOKEN` is present
- **Development**: Uses local Playwright when `BROWSERLESS_TOKEN` is missing

## Testing

Test the integration with:

```bash
npm run test-browserless
```

## Health Check

The `/api/health` endpoint includes Browserless status information:

```json
{
  "features": {
    "jsRendering": {
      "status": "healthy",
      "mode": "browserless",
      "available": true,
      "provider": "browserless.io",
      "hasToken": true
    }
  }
}
```

## Fallback Behavior

If Browserless fails, the system gracefully falls back to:
1. Local Playwright (if available)
2. Static HTML analysis only

This ensures audits continue to work even if Browserless is temporarily unavailable.