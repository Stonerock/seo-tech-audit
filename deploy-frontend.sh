#!/bin/bash

# Frontend deployment script for Cloudflare Pages
# This script ensures reliable deployment when GitHub Actions fails

set -e

echo "🚀 Starting Cloudflare Pages deployment..."

# Create build directory
echo "📦 Preparing build directory..."
rm -rf dist
mkdir -p dist

# Copy frontend files
echo "📋 Copying frontend files..."
cp index.html dist/

# Copy components if they exist
if [ -d "components" ]; then
    cp -r components/ dist/
    echo "✅ Components copied"
else
    echo "ℹ️  No components directory found"
fi

# Copy assets if they exist
if [ -d "assets" ]; then
    cp -r assets/ dist/
    echo "✅ Assets copied"
else
    echo "ℹ️  No assets directory found"
fi

# Copy any additional static files
if [ -f "_headers" ]; then
    cp _headers dist/
    echo "✅ Headers file copied"
fi

if [ -f "_redirects" ]; then
    cp _redirects dist/
    echo "✅ Redirects file copied"
fi

# Verify backend URL is correctly configured
echo "🔍 Verifying backend configuration..."
if grep -q "seo-audit-backend-458683085682.us-central1.run.app" dist/index.html; then
    echo "✅ Backend URL configured correctly"
else
    echo "⚠️  Warning: Backend URL might not be configured properly"
fi

# Deploy to Cloudflare Pages
echo "🌩️  Deploying to Cloudflare Pages..."
wrangler pages deploy dist --project-name=seo-audit-tool --commit-dirty=true

echo "✨ Deployment complete!"
echo ""
echo "🔗 Your site should be available at:"
echo "   https://seo-audit-tool-e50.pages.dev"
echo ""
echo "🩺 Backend health check:"
curl -s https://seo-audit-backend-458683085682.us-central1.run.app/api/health | head -1
echo ""
echo "✅ Frontend deployment script completed successfully!"