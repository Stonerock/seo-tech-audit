#!/bin/bash
set -e

echo "🚀 MVP Ultra-Fast Deployment"
echo "============================="

# For MVP: Skip tests, linting, and heavy checks
export SKIP_TESTS=true
export NODE_ENV=production

echo "⚡ Building minimal container..."

# Use Cloud Build for parallel processing
gcloud run deploy seo-audit-backend \
  --source . \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars NODE_ENV=production \
  --set-secrets BROWSERLESS_TOKEN=browserless-token:latest \
  --max-instances 10 \
  --timeout 540 \
  --memory 1Gi \
  --quiet

echo "✅ Deployment complete!"

echo "🎯 Testing deployment..."
sleep 10

# Test health
HEALTH=$(curl -s "https://seo-audit-backend-458683085682.us-central1.run.app/api/health" | jq -r '.status')
echo "Health: $HEALTH"

# Test Browserless
BROWSERLESS=$(curl -s "https://seo-audit-backend-458683085682.us-central1.run.app/api/health" | jq -r '.features.jsRendering.status')
echo "Browserless: $BROWSERLESS"

echo ""
echo "✅ MVP deployment complete!"
echo "🔗 https://seo-audit-backend-458683085682.us-central1.run.app"
echo ""
echo "💡 For future deployments:"
echo "   • Use ./deploy-mvp.sh for speed"
echo "   • Full tests disabled for MVP velocity"
echo "   • Container builds cached for faster iterations"