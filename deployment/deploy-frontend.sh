#!/bin/bash

# Frontend deployment script for Cloudflare Pages
# This script uses Vite to build and deploy the React + TypeScript app

set -e

echo "🚀 Starting Cloudflare Pages deployment..."

# Build the project using Vite
echo "🏗️  Building with Vite..."
npm run build

# Copy any additional static files to dist
if [ -f "_headers" ]; then
    cp _headers dist/
    echo "✅ Headers file copied"
fi

if [ -f "_redirects" ]; then
    cp _redirects dist/
    echo "✅ Redirects file copied"
fi

# Verify build was successful
echo "🔍 Verifying build..."
if [ -f "dist/index.html" ]; then
    echo "✅ Build successful - index.html found"
else
    echo "❌ Build failed - no index.html found"
    exit 1
fi

# Check for JavaScript and CSS files
if ls dist/assets/*.js > /dev/null 2>&1; then
    echo "✅ JavaScript assets found"
else
    echo "⚠️  Warning: No JavaScript assets found"
fi

if ls dist/assets/*.css > /dev/null 2>&1; then
    echo "✅ CSS assets found"  
else
    echo "⚠️  Warning: No CSS assets found"
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