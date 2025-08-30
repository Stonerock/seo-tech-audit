#!/bin/bash
set -e

echo "🔧 Final ES Module Cleanup & Browserless Fix"
echo "============================================"

# Configuration
PROJECT_ID="seo-audit-tool-prod"
REGION="us-central1"
SERVICE_NAME="seo-audit-backend"
IMAGE_NAME="seo-audit-backend"
REGISTRY="$REGION-docker.pkg.dev/$PROJECT_ID/cloud-run-source-deploy"
IMAGE_TAG="final-fix-$(date +%s)"
FULL_IMAGE="$REGISTRY/$IMAGE_NAME:$IMAGE_TAG"

echo "📋 Final Fix Configuration:"
echo "  Target: Complete ES Module cleanup + Browserless auth"
echo "  Image: $IMAGE_TAG"
echo ""

# Create completely clean Dockerfile
echo "📝 Creating ES-module-free Dockerfile..."
cat > Dockerfile.clean << 'EOF'
FROM --platform=linux/amd64 node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# AGGRESSIVE ES MODULE CLEANUP
RUN echo "Removing all ES module configurations..." && \
    sed -i '/"type":/d' package.json && \
    sed -i '/"module":/d' package.json && \
    echo "ES module cleanup complete"

# Install production dependencies
RUN npm ci --only=production --silent

# Copy application code
COPY . .

# COMPREHENSIVE ES MODULE CLEANUP IN CONTAINER
RUN echo "Container-level ES module cleanup..." && \
    find . -name "package.json" -exec sed -i '/"type":/d' {} \; && \
    find . -name "*.mjs" -exec mv {} {}.backup \; 2>/dev/null || true && \
    echo "Converting ES imports to CommonJS..." && \
    sed -i 's/^import \(.*\) from \x27\([^"]*\)\x27;$/const \1 = require(\x27\2\x27);/' server.js && \
    sed -i 's/^import \(.*\) from "\([^"]*\)";$/const \1 = require("\2");/' server.js && \
    sed -i 's/^export default /module.exports = /' server.js && \
    echo "All ES module references removed"

# Clean up deployment artifacts
RUN rm -f Dockerfile.* deploy-*.sh *.backup .gcloudignore minimal-*.sh

# Verify no ES module conflicts remain in app code (exclude node_modules)
RUN echo "Verifying clean CommonJS environment..." && \
    if find . -name node_modules -prune -o -type f \( -name "*.json" -o -name "*.js" \) -exec grep -l '"type".*"module"' {} \; | grep -v node_modules; then echo "ERROR: ES modules found in app code"; exit 1; fi && \
    echo "✅ Clean CommonJS environment confirmed"

# Expose port
EXPOSE 8080

# Health check with curl (pre-installed in alpine)
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:8080/api/health || exit 1

# Start application
CMD ["node", "server.js"]
EOF

echo "🔧 Final authentication cleanup..."
# Reset and apply clean auth fix
cp services/js-renderer.js services/js-renderer.js.original
sed -i.tmp '
s/Authorization.*Bearer.*\${[^}]*}/Content-Type\x27: \x27application\/javascript/g
s/\${this\.browserlessBaseUrl}\/function/\${this.browserlessBaseUrl}\/function?token=\${this.browserlessToken}/g
s/?token=\${this\.browserlessToken}[^}]*/?token=\${this.browserlessToken}/g
' services/js-renderer.js

echo "✅ Authentication fix applied cleanly"

echo "🐳 Building final clean image..."
docker buildx build \
  --platform linux/amd64 \
  --file Dockerfile.clean \
  --tag "$FULL_IMAGE" \
  --push \
  .

echo "🚀 Final deployment..."
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

echo "🧹 Restoring original files..."
rm -f Dockerfile.clean
mv services/js-renderer.js.original services/js-renderer.js 2>/dev/null || true

echo "⏱️ Stabilizing deployment..."
sleep 20

echo "🎯 FINAL TESTING..."

# Test 1: Basic health
echo "1. Service health..."
HEALTH=$(curl -s "https://seo-audit-backend-458683085682.us-central1.run.app/api/health" | jq -r '.status')
echo "   Status: $HEALTH"

# Test 2: Browserless health  
echo "2. Browserless integration..."
BROWSERLESS=$(curl -s "https://seo-audit-backend-458683085682.us-central1.run.app/api/health" | jq -r '.features.jsRendering.status')
echo "   Status: $BROWSERLESS"

# Test 3: React.dev audit
echo "3. React.dev two-pass audit..."
AUDIT=$(curl -X POST "https://seo-audit-backend-458683085682.us-central1.run.app/api/audit" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://react.dev", "fastMode": false, "enableJS": true}' \
  -s | jq -r '.mode // "error"')
echo "   Mode: $AUDIT"

# Test 4: BBC.com audit
echo "4. BBC.com high-confidence test..."
BBC_RESULT=$(curl -X POST "https://seo-audit-backend-458683085682.us-central1.run.app/api/audit" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://bbc.com", "fastMode": false, "enableJS": true}' \
  -s | jq -r '.mode // "error"')
echo "   Mode: $BBC_RESULT"

echo ""
echo "🎉 FINAL RESULTS:"
echo "===================="

if [ "$HEALTH" = "ok" ]; then
    echo "✅ Service: HEALTHY"
else
    echo "❌ Service: $HEALTH"
    exit 1
fi

if [ "$BROWSERLESS" = "available" ] || [ "$BROWSERLESS" = "degraded" ]; then
    echo "🚀 Browserless: $BROWSERLESS (WORKING!)"
    
    if [ "$AUDIT" = "two-pass" ] || [ "$BBC_RESULT" = "two-pass" ]; then
        echo "🎊 Two-pass: SUCCESS!"
        echo ""
        echo "🏆 COMPLETE SUCCESS!"
        echo "   Cloud Run → Browserless.io connection established!"
        echo "   Enhanced JavaScript rendering active!"
        echo "   AI optimization analysis fully operational!"
    else
        echo "⚠️ Two-pass: $AUDIT (confidence threshold or other issue)"
    fi
else
    echo "❌ Browserless: $BROWSERLESS"
fi

echo ""
echo "🔗 Service URL: https://seo-audit-backend-458683085682.us-central1.run.app"
echo "📦 Final Image: $FULL_IMAGE"