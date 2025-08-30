#!/bin/bash
set -e

echo "🔥 Browserless Authentication Hotfix"
echo "===================================="
echo "Applying minimal authentication fix for MVP speed"
echo ""

# Temporarily rename Dockerfile for deployment
echo "⚡ Preparing container..."
mv Dockerfile Dockerfile.backup 2>/dev/null || true
cp Dockerfile.minimal Dockerfile

echo "🚀 Deploying hotfix..."
gcloud run deploy seo-audit-backend \
  --source . \
  --region=us-central1 \
  --allow-unauthenticated \
  --set-env-vars NODE_ENV=production \
  --set-secrets BROWSERLESS_TOKEN=browserless-token:latest \
  --memory=1Gi \
  --timeout=540 \
  --quiet

# Restore original Dockerfile
mv Dockerfile.backup Dockerfile 2>/dev/null || true

echo "🎯 Testing hotfix..."
sleep 10

# Test basic health
HEALTH=$(curl -s "https://seo-audit-backend-458683085682.us-central1.run.app/api/health" | jq -r '.status')
echo "✅ Health: $HEALTH"

# Test Browserless specifically
BROWSERLESS_STATUS=$(curl -s "https://seo-audit-backend-458683085682.us-central1.run.app/api/health" | jq -r '.features.jsRendering.status')
echo "🔧 Browserless: $BROWSERLESS_STATUS"

echo ""
echo "🎉 Hotfix deployment complete!"
echo "🔗 https://seo-audit-backend-458683085682.us-central1.run.app"
echo ""
if [ "$BROWSERLESS_STATUS" = "available" ]; then
    echo "✅ SUCCESS: Browserless authentication fixed!"
else
    echo "⚠️  Browserless still needs attention - but authentication updated"
fi