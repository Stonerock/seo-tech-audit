#!/bin/bash

# SEO Audit Tool - Cloudflare Pages Deployment Script
# Deploys the frontend to Cloudflare Pages

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
PROJECT_NAME="seo-audit-tool"
BUILD_DIR="dist"
BACKEND_URL="${BACKEND_URL:-https://seo-audit-backend-YOUR_PROJECT_ID.a.run.app}"

echo -e "${GREEN}🌟 Deploying SEO Audit Tool Frontend to Cloudflare Pages${NC}"
echo "Project: $PROJECT_NAME"
echo "Build Directory: $BUILD_DIR"
echo "Backend URL: $BACKEND_URL"
echo ""

# Check if Wrangler CLI is installed
if ! command -v wrangler &> /dev/null; then
    echo -e "${RED}❌ Wrangler CLI is not installed${NC}"
    echo -e "${YELLOW}Install it with: npm install -g wrangler${NC}"
    echo "Or visit: https://developers.cloudflare.com/workers/wrangler/install-and-update/"
    exit 1
fi

# Check if logged in
if ! wrangler whoami &> /dev/null; then
    echo -e "${YELLOW}⚠️  Not authenticated with Cloudflare${NC}"
    echo "Run: wrangler login"
    exit 1
fi

# Create build directory if it doesn't exist
mkdir -p $BUILD_DIR

# Prepare frontend for deployment
echo -e "${YELLOW}📦 Preparing frontend build...${NC}"

# Copy main files to build directory
cp index.html $BUILD_DIR/
cp -r components/ $BUILD_DIR/components/ 2>/dev/null || echo "No components directory"
cp -r assets/ $BUILD_DIR/assets/ 2>/dev/null || echo "No assets directory"

# Update API endpoints to point to Cloud Run backend
echo -e "${YELLOW}🔗 Configuring backend endpoints...${NC}"
if [ -n "$BACKEND_URL" ] && [ "$BACKEND_URL" != "https://seo-audit-backend-YOUR_PROJECT_ID.a.run.app" ]; then
    # Replace localhost:3001 with actual backend URL in index.html
    sed -i.bak "s|http://localhost:3001|$BACKEND_URL|g" $BUILD_DIR/index.html
    sed -i.bak "s|http://127.0.0.1:3001|$BACKEND_URL|g" $BUILD_DIR/index.html
    rm $BUILD_DIR/index.html.bak
    echo -e "${GREEN}✅ Updated API endpoints to: $BACKEND_URL${NC}"
else
    echo -e "${YELLOW}⚠️  Using default backend URL - update BACKEND_URL environment variable${NC}"
fi

# Create wrangler.toml if it doesn't exist
if [ ! -f "wrangler.toml" ]; then
    echo -e "${YELLOW}📝 Creating wrangler.toml configuration...${NC}"
    cat > wrangler.toml << EOF
name = "$PROJECT_NAME"
pages_build_output_dir = "$BUILD_DIR"

[env.production]
# Production environment configuration
# Add any production-specific settings here

[env.preview] 
# Preview environment configuration
# Add any staging-specific settings here
EOF
fi

# Deploy to Cloudflare Pages
echo -e "${YELLOW}🚀 Deploying to Cloudflare Pages...${NC}"
wrangler pages deploy $BUILD_DIR --project-name=$PROJECT_NAME

# Get the deployment URL
echo ""
echo -e "${GREEN}✅ Deployment completed successfully!${NC}"
echo -e "${GREEN}🌐 Your SEO Audit Tool frontend is now live!${NC}"
echo ""
echo -e "${YELLOW}📝 Next steps:${NC}"
echo "1. Visit your Cloudflare Pages dashboard to view the deployment"
echo "2. Configure a custom domain if desired"
echo "3. Set up branch-based deployments for staging/production"
echo "4. Update CORS settings in your Cloud Run backend if needed"
echo ""
echo -e "${BLUE}🔗 Useful commands:${NC}"
echo "  View deployments: wrangler pages deployment list --project-name=$PROJECT_NAME"
echo "  Set custom domain: wrangler pages domain add <domain> --project-name=$PROJECT_NAME"
echo "  View logs: wrangler pages deployment logs --project-name=$PROJECT_NAME"
echo ""
echo -e "${GREEN}🎉 Frontend deployment complete!${NC}"