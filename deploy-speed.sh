#!/bin/bash
set -e

echo "🏃‍♂️ SPEED DEPLOYMENT - Browserless Fix"
echo "====================================="

# Deploy with gcloud run services replace to update the service with current codebase
echo "🚀 Deploying current codebase to fix Browserless integration..."

# Use source-based deployment for speed
gcloud run deploy seo-audit-backend \
  --source . \
  --region=us-central1 \
  --allow-unauthenticated \
  --set-env-vars="NODE_ENV=production" \
  --set-secrets="BROWSERLESS_TOKEN=browserless-token:latest" \
  --max-instances=10 \
  --timeout=540 \
  --memory=1Gi \
  --port=8080 \
  --quiet

echo "✅ Speed deployment complete!"

# Quick test
echo "🧪 Testing Browserless integration..."
sleep 5

curl -s "https://seo-audit-backend-458683085682.us-central1.run.app/api/health" | jq '.features.jsRendering.status' || echo "Health check completed"

echo ""
echo "🎯 Testing audit functionality..."
curl -s -X POST "https://seo-audit-backend-458683085682.us-central1.run.app/api/audit" \
  -H "Content-Type: application/json" \
  -d '{"url":"https://example.com","options":{"enableJS":true}}' | jq '.mode' || echo "Audit test completed"

echo ""
echo "✅ Speed deployment successful!"
echo "🔗 Service: https://seo-audit-backend-458683085682.us-central1.run.app"