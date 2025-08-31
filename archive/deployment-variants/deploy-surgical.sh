#!/bin/bash
set -e

echo "🔬 SURGICAL Browserless Debugging Deployment"
echo "============================================"

# Configuration
PROJECT_ID="seo-audit-tool-prod"
REGION="us-central1"
SERVICE_NAME="seo-audit-backend"
IMAGE_NAME="seo-audit-backend"
REGISTRY="$REGION-docker.pkg.dev/$PROJECT_ID/cloud-run-source-deploy"
IMAGE_TAG="surgical-$(date +%s)"
FULL_IMAGE="$REGISTRY/$IMAGE_NAME:$IMAGE_TAG"

echo "📋 Surgical Configuration:"
echo "  Target: Isolated Browserless connectivity probe"
echo "  Image: $IMAGE_TAG"
echo ""

# Create surgical Dockerfile with verification steps
echo "📝 Creating surgical Dockerfile with verification..."
cat > Dockerfile.surgical << 'EOF'
FROM --platform=linux/amd64 node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Remove ES module type to avoid conflicts - VERIFY IMMEDIATELY
RUN echo "Removing ES module configurations..." && \
    sed -i '/.*"type".*:.*"module".*/d' package.json && \
    sed -i '/.*"module".*:.*/d' package.json && \
    echo "After cleanup:" && cat package.json | head -10 && \
    echo "✅ Package.json ES module cleanup complete"

# Install production dependencies
RUN npm ci --only=production --silent

# Copy application code
COPY . .

# Clean up package.json again (COPY . overwrote the cleaned version)
RUN echo "Final package.json cleanup after copy..." && \
    sed -i '/.*"type".*:.*"module".*/d' package.json && \
    sed -i '/.*"module".*:.*/d' package.json && \
    echo "Final package.json:" && head -10 package.json

# VERIFY PATCH APPLIED - fail fast if not
RUN echo "Verifying surgical patch application..." && \
    echo "Files check:" && \
    ls -la routes/ && \
    ls -la server-probe.js && \
    echo "Content check:" && \
    head -5 server-probe.js && \
    echo "Package.json check:" && \
    grep -n type package.json || echo "No type field found (good)" && \
    echo "✅ Files verified - proceeding"

# Verify app code is CJS (exclude node_modules)
RUN echo "Verifying app code is CJS..." && \
    ! find . -path ./node_modules -prune -o -type f -name "*.mjs" -print | grep . && \
    ! find . -path ./node_modules -prune -o -type f -name "package.json" -exec grep -l '"type"[[:space:]]*:[[:space:]]*"module"' {} \; | grep . && \
    echo "✅ App code is clean CJS"

# Clean up deployment artifacts
RUN rm -f Dockerfile.* deploy-*.sh *.backup .gcloudignore

# Expose port
EXPOSE 8080

# Health check with curl (pre-installed in alpine)
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:8080/healthz || exit 1

# Start with probe server for surgical debugging
CMD ["node", "server-probe.js"]
EOF

echo "🐳 Building surgical Docker image..."
docker buildx build \
  --platform linux/amd64 \
  --file Dockerfile.surgical \
  --tag "$FULL_IMAGE" \
  --push \
  .

echo "🚀 Deploying surgical probe to Cloud Run..."
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
rm -f Dockerfile.surgical

echo "⏱️ Waiting for surgical deployment to stabilize..."
sleep 15

echo "🔬 SURGICAL TESTING..."
echo ""

# Test 1: Basic health
echo "1. Health check..."
HEALTH=$(curl -s "https://seo-audit-backend-458683085682.us-central1.run.app/healthz")
echo "   Response: $HEALTH"

# Test 2: Health API with env details
echo "2. Health API with environment..."
curl -s "https://seo-audit-backend-458683085682.us-central1.run.app/api/health" | jq '.'

# Test 3: HTTP connectivity probe
echo "3. HTTP connectivity to Browserless..."
curl -s "https://seo-audit-backend-458683085682.us-central1.run.app/probe/http" | jq '.'

# Test 4: THE MAIN EVENT - Browserless WebSocket probe
echo "4. 🎯 BROWSERLESS WEBSOCKET PROBE..."
echo ""
PROBE_RESPONSE=$(curl -s "https://seo-audit-backend-458683085682.us-central1.run.app/probe/browserless")
echo "$PROBE_RESPONSE" | jq '.'

# Analyze results
echo ""
echo "🔍 SURGICAL ANALYSIS:"
echo "======================"

PROBE_OK=$(echo "$PROBE_RESPONSE" | jq -r '.ok // false')
if [ "$PROBE_OK" = "true" ]; then
    echo "🎉 BROWSERLESS CONNECTION: SUCCESS!"
    echo "   - WebSocket connection established"
    echo "   - Page navigation successful"
    echo "   - Authentication working"
    echo ""
    echo "✅ The Browserless integration is WORKING"
    echo "   Next step: Check main audit logic for error swallowing"
else
    echo "❌ BROWSERLESS CONNECTION: FAILED"
    echo ""
    echo "🔍 Error details:"
    echo "$PROBE_RESPONSE" | jq '.details // empty'
    echo ""
    echo "🎯 DIAGNOSIS:"
    ERROR_NAME=$(echo "$PROBE_RESPONSE" | jq -r '.details.name // "unknown"')
    ERROR_CODE=$(echo "$PROBE_RESPONSE" | jq -r '.details.code // "unknown"')
    case "$ERROR_NAME:$ERROR_CODE" in
        "*ECONNREFUSED*"|"*:ECONNREFUSED")
            echo "   → Network connectivity issue (VPC/firewall)"
            ;;
        "*ERR_INVALID_PROTOCOL*"|"*:ERR_INVALID_PROTOCOL")
            echo "   → URL/protocol issue (check BROWSERLESS_WS)"
            ;;
        "*403*"|"*Unauthorized*")
            echo "   → Authentication issue (check token)"
            ;;
        "*timeout*"|"*ETIMEDOUT*")
            echo "   → Timeout (check network or increase timeout)"
            ;;
        *)
            echo "   → Other issue - see error details above"
            ;;
    esac
fi

echo ""
echo "🔗 Service URL: https://seo-audit-backend-458683085682.us-central1.run.app"
echo "🔬 Surgical Image: $FULL_IMAGE"
echo ""
echo "🎯 Next steps based on probe result:"
if [ "$PROBE_OK" = "true" ]; then
    echo "   1. Browserless is working - main audit logic has error swallowing"
    echo "   2. Add error logging to main renderer"
    echo "   3. Deploy full server with fixed error handling"
else
    echo "   1. Fix the specific connection issue identified above"
    echo "   2. Re-run surgical probe until success"
    echo "   3. Then deploy full functionality"
fi