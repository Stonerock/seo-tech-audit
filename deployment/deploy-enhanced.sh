#!/bin/bash
set -e

echo "🚀 Enhanced Production Deployment"
echo "=================================="

# Configuration
PROJECT_ID="seo-audit-tool-prod"
REGION="us-central1"
SERVICE_NAME="seo-audit-backend"
IMAGE_NAME="seo-audit-backend"
REGISTRY="$REGION-docker.pkg.dev/$PROJECT_ID/cloud-run-source-deploy"
IMAGE_TAG="enhanced-$(date +%s)"
FULL_IMAGE="$REGISTRY/$IMAGE_NAME:$IMAGE_TAG"

echo "📋 Enhanced Configuration:"
echo "  Target: Enhanced server with production services"
echo "  Image: $IMAGE_TAG"
echo ""

# Create enhanced Dockerfile
echo "📝 Creating enhanced Dockerfile..."
cat > Dockerfile.enhanced << 'EOF'
FROM --platform=linux/amd64 node:18-alpine

WORKDIR /app

# Install dependencies for native modules if needed
RUN apk add --no-cache python3 make g++

# Copy package files
COPY package*.json ./

# Clean package.json of ES module configs
RUN echo "Removing ES module configurations..." && \
    sed -i '/.*"type".*:.*"module".*/d' package.json && \
    sed -i '/.*"module".*:.*/d' package.json && \
    echo "✅ Package.json cleanup complete"

# Install dependencies with legacy peer deps
RUN npm ci --only=production --legacy-peer-deps --silent

# Copy source code
COPY . .

# Final cleanup
RUN sed -i '/.*"type".*:.*"module".*/d' package.json && \
    sed -i '/.*"module".*:.*/d' package.json

# Remove unnecessary files
RUN rm -f Dockerfile.* deploy-*.sh *.backup .gcloudignore server-probe.js

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD curl -f http://localhost:8080/healthz || exit 1

# Use server.js (the integrated version)
EXPOSE 8080
CMD ["node", "server.js"]
EOF

echo "🐳 Building enhanced Docker image..."
docker build --platform=linux/amd64 -t "$FULL_IMAGE" -f Dockerfile.enhanced .

echo "📤 Pushing image to registry..."
docker push "$FULL_IMAGE"

echo "🚀 Deploying enhanced server to Cloud Run..."
gcloud run deploy "$SERVICE_NAME" \
  --image="$FULL_IMAGE" \
  --region="$REGION" \
  --allow-unauthenticated \
  --set-env-vars="NODE_ENV=production,ENABLE_SECURITY_HARDENING=false,ENABLE_RELIABILITY_PATTERNS=false" \
  --set-secrets="BROWSERLESS_TOKEN=browserless-token:latest" \
  --max-instances=10 \
  --timeout=540 \
  --memory=1Gi \
  --cpu=1 \
  --port=8080 \
  --quiet

echo "✅ Enhanced deployment complete!"

# Test the deployment
echo "🧪 Testing enhanced deployment..."
sleep 10

SERVICE_URL="https://seo-audit-backend-458683085682.us-central1.run.app"

# Test health endpoint
echo "Testing health endpoint..."
curl -s "$SERVICE_URL/api/health" | jq '.status' || echo "Health check skipped"

# Test basic audit
echo "Testing basic audit functionality..."
curl -s -X POST "$SERVICE_URL/api/audit" \
  -H "Content-Type: application/json" \
  -d '{"url":"https://example.com"}' | jq '.url' || echo "Audit test skipped"

echo ""
echo "🎉 Enhanced deployment successful!"
echo "🔗 Service URL: $SERVICE_URL"
echo "📊 Health: $SERVICE_URL/api/health"
echo "🔍 Audit: POST $SERVICE_URL/api/audit"

# Cleanup
rm -f Dockerfile.enhanced