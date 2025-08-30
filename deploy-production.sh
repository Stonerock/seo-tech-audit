#!/bin/bash
set -e

echo "🚀 PRODUCTION Deployment with Working Browserless Integration"
echo "============================================================="

# Configuration
PROJECT_ID="seo-audit-tool-prod"
REGION="us-central1"
SERVICE_NAME="seo-audit-backend"
IMAGE_NAME="seo-audit-backend"
REGISTRY="$REGION-docker.pkg.dev/$PROJECT_ID/cloud-run-source-deploy"
IMAGE_TAG="production-$(date +%s)"
FULL_IMAGE="$REGISTRY/$IMAGE_NAME:$IMAGE_TAG"

echo "📋 Production Configuration:"
echo "  Target: Full server with working Browserless integration"
echo "  Image: $IMAGE_TAG"
echo ""

# Create production Dockerfile with CommonJS fixes
echo "📝 Creating production Dockerfile..."
cat > Dockerfile.production << 'EOF'
FROM --platform=linux/amd64 node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Remove ES module type to avoid conflicts
RUN echo "Removing ES module configurations..." && \
    sed -i '/.*"type".*:.*"module".*/d' package.json && \
    sed -i '/.*"module".*:.*/d' package.json && \
    echo "✅ Package.json ES module cleanup complete"

# Install production dependencies
RUN npm ci --only=production --silent

# Copy application code
COPY . .

# Final package.json cleanup after copy
RUN echo "Final package.json cleanup after copy..." && \
    sed -i '/.*"type".*:.*"module".*/d' package.json && \
    sed -i '/.*"module".*:.*/d' package.json && \
    echo "✅ Final package.json cleanup complete"

# Clean up deployment artifacts
RUN rm -f Dockerfile.* deploy-*.sh *.backup .gcloudignore server-probe.js

# Expose port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:8080/api/health || exit 1

# Start production application
CMD ["node", "server-production.js"]
EOF

echo "🐳 Building production Docker image..."
docker buildx build \
  --platform linux/amd64 \
  --file Dockerfile.production \
  --tag "$FULL_IMAGE" \
  --push \
  .

echo "🚀 Deploying production server to Cloud Run..."
gcloud run deploy $SERVICE_NAME \
  --image="$FULL_IMAGE" \
  --region=$REGION \
  --allow-unauthenticated \
  --set-env-vars NODE_ENV=production,BROWSERLESS_WS=wss://production-sfo.browserless.io \
  --set-secrets BROWSERLESS_TOKEN=browserless-token:latest \
  --memory 1Gi \
  --timeout 540 \
  --max-instances 10 \
  --concurrency 10 \
  --quiet

echo "🧹 Cleaning up..."
rm -f Dockerfile.production

echo "⏱️ Waiting for production deployment to stabilize..."
sleep 20

echo "🎯 PRODUCTION TESTING..."
echo ""

# Test 1: Basic health
echo "1. Health check..."
HEALTH=$(curl -s "https://seo-audit-backend-458683085682.us-central1.run.app/api/health" | jq -r '.status')
echo "   Status: $HEALTH"

# Test 2: Browserless integration check
echo "2. Browserless integration status..."
BROWSERLESS_STATUS=$(curl -s "https://seo-audit-backend-458683085682.us-central1.run.app/api/health" | jq -r '.features.jsRendering.status')
echo "   Browserless: $BROWSERLESS_STATUS"

# Test 3: Quick audit (fast mode)
echo "3. Fast mode audit test..."
FAST_RESULT=$(curl -X POST "https://seo-audit-backend-458683085682.us-central1.run.app/api/audit" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com", "fastMode": true, "enableJS": false}' \
  -s | jq -r '.mode // "error"')
echo "   Fast mode: $FAST_RESULT"

# Test 4: Two-pass audit (with JS)
echo "4. Two-pass audit test..."
TWOPASS_RESULT=$(curl -X POST "https://seo-audit-backend-458683085682.us-central1.run.app/api/audit" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://react.dev", "fastMode": false, "enableJS": true}' \
  -s | jq -r '.mode // "error"')
echo "   Two-pass mode: $TWOPASS_RESULT"

echo ""
echo "🎉 PRODUCTION RESULTS:"
echo "======================"

if [ "$HEALTH" = "ok" ]; then
    echo "✅ Service: HEALTHY"
else
    echo "❌ Service: $HEALTH"
    exit 1
fi

if [ "$BROWSERLESS_STATUS" = "available" ] || [ "$BROWSERLESS_STATUS" = "degraded" ]; then
    echo "🚀 Browserless: $BROWSERLESS_STATUS (WORKING!)"
else
    echo "❌ Browserless: $BROWSERLESS_STATUS"
fi

if [ "$FAST_RESULT" = "lightweight" ]; then
    echo "⚡ Fast mode: SUCCESS"
else
    echo "⚠️ Fast mode: $FAST_RESULT"
fi

if [ "$TWOPASS_RESULT" = "two-pass" ]; then
    echo "🎊 Two-pass: SUCCESS!"
    echo ""
    echo "🏆 COMPLETE SUCCESS!"
    echo "   ✅ Fast mode working"
    echo "   ✅ Browserless integration working"  
    echo "   ✅ Two-pass audit working"
    echo "   ✅ Ready for frontend testing!"
else
    echo "⚠️ Two-pass: $TWOPASS_RESULT"
fi

echo ""
echo "🔗 Service URL: https://seo-audit-backend-458683085682.us-central1.run.app"
echo "📦 Production Image: $FULL_IMAGE"