#!/bin/bash
set -e

echo "🐳 Multi-Platform Docker Build & Push (AMD64 for Cloud Run)"
echo "==========================================================="

# Configuration
PROJECT_ID="seo-audit-tool-prod"
REGION="us-central1"
SERVICE_NAME="seo-audit-backend"
IMAGE_NAME="seo-audit-backend"
REGISTRY="$REGION-docker.pkg.dev/$PROJECT_ID/cloud-run-source-deploy"
IMAGE_TAG="amd64-fix-$(date +%s)"
FULL_IMAGE="$REGISTRY/$IMAGE_NAME:$IMAGE_TAG"

echo "📋 Build Configuration:"
echo "  Project: $PROJECT_ID"
echo "  Platform: linux/amd64 (Cloud Run compatible)"
echo "  Image: $IMAGE_TAG"
echo ""

# Create optimized Dockerfile for AMD64
echo "📝 Creating AMD64-optimized Dockerfile..."
cat > Dockerfile.amd64 << 'EOF'
FROM --platform=linux/amd64 node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Remove ES module type to avoid conflicts
RUN if [ -f package.json ]; then sed -i '/"type": "module",/d' package.json; fi

# Install production dependencies
RUN npm ci --only=production --silent

# Copy application code
COPY . .

# Remove problematic files
RUN rm -f Dockerfile.* deploy-*.sh *.backup .gcloudignore minimal-*.sh

# Expose port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:8080/api/health || exit 1

# Start application
CMD ["node", "server.js"]
EOF

echo "🔧 Final authentication patch..."
# Ensure clean authentication fix (in case of previous patches)
sed -i.bak 's/?token=\${this.browserlessToken}.*/?token=\${this.browserlessToken}/g' services/js-renderer.js

echo "🐳 Building multi-platform Docker image..."
docker buildx create --use --name multiarch || docker buildx use multiarch
docker buildx build \
  --platform linux/amd64 \
  --file Dockerfile.amd64 \
  --tag "$FULL_IMAGE" \
  --push \
  .

echo "🚀 Deploying to Cloud Run..."
gcloud run deploy $SERVICE_NAME \
  --image="$FULL_IMAGE" \
  --region=$REGION \
  --allow-unauthenticated \
  --set-env-vars NODE_ENV=production \
  --set-secrets BROWSERLESS_TOKEN=browserless-token:latest \
  --memory 1Gi \
  --timeout 540 \
  --max-instances 10 \
  --quiet

echo "🧹 Cleaning up..."
rm -f Dockerfile.amd64
mv services/js-renderer.js.bak services/js-renderer.js 2>/dev/null || true

echo "⏱️ Waiting for deployment to stabilize..."
sleep 15

echo "🎯 Testing deployment..."

# Test basic health
echo "1. Health check..."
HEALTH=$(curl -s "https://seo-audit-backend-458683085682.us-central1.run.app/api/health" | jq -r '.status')
echo "   Status: $HEALTH"

# Test Browserless specifically
echo "2. Browserless integration..."
BROWSERLESS_STATUS=$(curl -s "https://seo-audit-backend-458683085682.us-central1.run.app/api/health" | jq -r '.features.jsRendering.status')
echo "   Browserless: $BROWSERLESS_STATUS"

echo ""
echo "🎉 DEPLOYMENT RESULTS:"
if [ "$HEALTH" = "ok" ]; then
    echo "✅ Service: HEALTHY"
    if [ "$BROWSERLESS_STATUS" = "available" ]; then
        echo "🚀 Browserless: WORKING!"
        echo ""
        echo "🎊 SUCCESS! Cloud Run → Browserless.io connection established!"
    else
        echo "⚠️  Browserless: $BROWSERLESS_STATUS (but service deployed)"
    fi
else
    echo "❌ Service: $HEALTH"
fi

echo ""
echo "🔗 Service URL: https://seo-audit-backend-458683085682.us-central1.run.app"
echo "📊 AMD64 Image: $FULL_IMAGE"