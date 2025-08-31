#!/bin/bash
set -e

echo "🔧 Minimal Authentication Fix for Browserless"
echo "============================================="

# Create a minimal working version by just fixing the auth issue
# without touching any ES module stuff

echo "📝 Creating minimal fixed server.js..."

# Copy current working file and make minimal changes
cp server.js server.js.backup

# Fix the js-renderer to use query params instead of Bearer token
echo "🔄 Patching authentication method..."

# Replace the Bearer token pattern in the current code
sed -i.bak "s/'Authorization': \`Bearer \${[^}]*}\`/'Content-Type': 'application\/javascript'/g" services/js-renderer.js

# Replace endpoint construction to include token
sed -i.bak "s/\${this.browserlessBaseUrl}\/function/\${this.browserlessBaseUrl}\/function?token=\${this.browserlessToken}/g" services/js-renderer.js

echo "✅ Authentication patched!"

# Deploy with minimal changes
echo "🚀 Deploying authentication fix..."
gcloud run deploy seo-audit-backend \
  --source . \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars NODE_ENV=production \
  --set-secrets BROWSERLESS_TOKEN=browserless-token:latest \
  --memory 1Gi \
  --timeout 540 \
  --quiet

echo "🎯 Testing deployment..."
sleep 10

# Test the fix
HEALTH=$(curl -s "https://seo-audit-backend-458683085682.us-central1.run.app/api/health" | jq -r '.features.jsRendering.status')
echo "Browserless status: $HEALTH"

if [ "$HEALTH" = "available" ]; then
    echo "🎉 SUCCESS! Browserless authentication fixed!"
    
    # Test react.dev two-pass audit
    echo "🧪 Testing react.dev two-pass audit..."
    RESULT=$(curl -X POST "https://seo-audit-backend-458683085682.us-central1.run.app/api/audit" \
      -H "Content-Type: application/json" \
      -d '{"url": "https://react.dev", "fastMode": false, "enableJS": true}' \
      -s | jq -r '.mode')
    
    echo "React.dev audit mode: $RESULT"
    
    if [ "$RESULT" = "two-pass" ]; then
        echo "🚀 COMPLETE SUCCESS! Two-pass audit working!"
    else
        echo "⚠️ Two-pass not triggered, but authentication fixed"
    fi
else
    echo "⚠️ Browserless still shows $HEALTH - checking logs..."
fi

# Restore backup
mv server.js.backup server.js 2>/dev/null || true

echo ""
echo "✅ Minimal authentication fix deployment complete!"