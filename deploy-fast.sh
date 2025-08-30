#!/bin/bash
set -e

echo "🚀 Fast MVP Deployment Script"
echo "=============================="

# Use the last known working image to avoid rebuilds
IMAGE="us-central1-docker.pkg.dev/seo-audit-tool-prod/cloud-run-source-deploy/seo-audit-backend@sha256:b561be1f30609c2ded3ef3f4d2b2a16948602459f5a7af0af9a109abb6dd451e"

echo "⚡ Deploying pre-built image (skipping container build)..."

gcloud run deploy seo-audit-backend \
  --image="$IMAGE" \
  --region=us-central1 \
  --allow-unauthenticated \
  --set-env-vars="NODE_ENV=production" \
  --set-secrets="BROWSERLESS_TOKEN=browserless-token:latest" \
  --max-instances=10 \
  --timeout=540 \
  --memory=1Gi \
  --port=8080 \
  --quiet

echo "✅ Service deployed!"

echo "🎯 Testing deployment..."

# Quick health check
sleep 5
curl -s "https://seo-audit-backend-458683085682.us-central1.run.app/api/health" | jq '.status'

echo ""
echo "✅ Fast deployment complete!"
echo "🔗 Service URL: https://seo-audit-backend-458683085682.us-central1.run.app"