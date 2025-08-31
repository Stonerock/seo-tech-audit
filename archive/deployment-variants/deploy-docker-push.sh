#!/bin/bash
set -e

echo "🐳 Local Docker Build & Push Deployment"
echo "======================================="

# Configuration
PROJECT_ID="seo-audit-tool-prod"
REGION="us-central1"
SERVICE_NAME="seo-audit-backend"
IMAGE_NAME="seo-audit-backend"
REGISTRY="$REGION-docker.pkg.dev/$PROJECT_ID/cloud-run-source-deploy"
IMAGE_TAG="auth-fix-$(date +%s)"
FULL_IMAGE="$REGISTRY/$IMAGE_NAME:$IMAGE_TAG"

echo "📋 Build Configuration:"
echo "  Project: $PROJECT_ID"
echo "  Registry: $REGISTRY"
echo "  Image: $IMAGE_TAG"
echo ""

# Create optimized Dockerfile for local build
echo "📝 Creating optimized Dockerfile..."
cat > Dockerfile.local << 'EOF'
FROM node:18-alpine

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
RUN rm -f Dockerfile.* deploy-*.sh *.backup .gcloudignore

# Expose port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD curl -f http://localhost:8080/api/health || exit 1

# Start application
CMD ["node", "server.js"]
EOF

echo "🔧 Patching authentication (final fix)..."
# Fix the duplicate token issue from previous patch
sed -i.bak 's/?token=\${this.browserlessToken}?token=\${this.browserlessToken}/?token=\${this.browserlessToken}/g' services/js-renderer.js

echo "🐳 Building Docker image locally..."
docker build -f Dockerfile.local -t "$FULL_IMAGE" .

echo "🚀 Configuring Docker for Google Cloud..."
gcloud auth configure-docker $REGION-docker.pkg.dev --quiet

echo "📤 Pushing image to registry..."
docker push "$FULL_IMAGE"

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
rm -f Dockerfile.local
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

# Test react.dev audit
echo "3. React.dev two-pass audit..."
AUDIT_RESULT=$(curl -X POST "https://seo-audit-backend-458683085682.us-central1.run.app/api/audit" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://react.dev", "fastMode": false, "enableJS": true}' \
  -s | jq -r '.mode // "error"')
echo "   Audit mode: $AUDIT_RESULT"

echo ""
echo "🎉 DEPLOYMENT RESULTS:"
if [ "$HEALTH" = "ok" ]; then
    echo "✅ Service: HEALTHY"
else
    echo "❌ Service: $HEALTH"
fi

if [ "$BROWSERLESS_STATUS" = "available" ]; then
    echo "✅ Browserless: WORKING"
else
    echo "⚠️  Browserless: $BROWSERLESS_STATUS"
fi

if [ "$AUDIT_RESULT" = "two-pass" ]; then
    echo "🚀 Two-pass: SUCCESS!"
    echo ""
    echo "🎊 COMPLETE SUCCESS! Cloud Run → Browserless.io connection working!"
elif [ "$AUDIT_RESULT" = "lightweight" ]; then
    echo "⚠️  Two-pass: Falling back to lightweight (check confidence threshold)"
else
    echo "❌ Audit: $AUDIT_RESULT"
fi

echo ""
echo "🔗 Service URL: https://seo-audit-backend-458683085682.us-central1.run.app"
echo "📊 Image: $FULL_IMAGE"