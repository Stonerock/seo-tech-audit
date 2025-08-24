# Cloudflare Pages Setup Guide

This guide walks you through deploying the SEO Audit Tool frontend to Cloudflare Pages.

## Prerequisites

1. **Cloudflare Account**: Sign up at [Cloudflare](https://cloudflare.com)
2. **Wrangler CLI**: Install globally with `npm install -g wrangler`
3. **Cloud Run Backend**: Deployed and running (see `deploy.sh`)

## Quick Setup

### 1. Install Wrangler CLI

```bash
npm install -g wrangler
```

### 2. Login to Cloudflare

```bash
wrangler login
```

This opens your browser to authenticate with Cloudflare.

### 3. Get Your Cloud Run Backend URL

After running `./deploy.sh`, get your backend URL:

```bash
# Example URL format:
# https://seo-audit-backend-YOUR_PROJECT_ID.a.run.app
```

### 4. Deploy Frontend

```bash
# Set your backend URL
export BACKEND_URL="https://seo-audit-backend-YOUR_PROJECT_ID.a.run.app"

# Deploy to Cloudflare Pages
./cloudflare-deploy.sh
```

## Manual Deployment Steps

### 1. Prepare Build Directory

```bash
mkdir -p dist
cp index.html dist/
cp -r components/ dist/ 2>/dev/null || true
cp -r assets/ dist/ 2>/dev/null || true
```

### 2. Configure Backend URLs

Update API endpoints in `dist/index.html`:

```bash
# Replace localhost with your Cloud Run URL
sed -i "s|http://localhost:3001|https://your-backend-url|g" dist/index.html
```

### 3. Deploy with Wrangler

```bash
wrangler pages deploy dist --project-name=seo-audit-tool
```

## GitHub Actions Automation

The repository includes GitHub Actions for automatic deployment:

### 1. Set Repository Secrets

In your GitHub repository settings, add these secrets:

- `CLOUDFLARE_API_TOKEN`: Your Cloudflare API token
- `CLOUDFLARE_ACCOUNT_ID`: Your Cloudflare account ID  
- `BACKEND_URL`: Your Cloud Run backend URL

### 2. Get Cloudflare Credentials

**API Token**: 
1. Go to [Cloudflare API Tokens](https://dash.cloudflare.com/profile/api-tokens)
2. Create token with these permissions:
   - Zone: Zone Settings:Read, Zone:Read
   - Account: Cloudflare Pages:Edit

**Account ID**:
1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com)
2. Copy Account ID from the sidebar

### 3. Automatic Deployments

- **Main/Master branch**: Automatically deploys to production
- **Pull Requests**: Creates preview deployments
- **Manual**: Use "Run workflow" with custom backend URL

## Configuration Files

### `wrangler.toml`
Main configuration file for Cloudflare Pages:
- Build settings
- Custom headers for security
- API proxying to backend
- Cache policies

### `.github/workflows/cloudflare-pages.yml`
GitHub Actions workflow for:
- Automated deployments
- Backend URL configuration
- Health checks
- PR preview comments

## Custom Domain Setup

### 1. Add Custom Domain

```bash
wrangler pages domain add yourdomain.com --project-name=seo-audit-tool
```

### 2. Update DNS

Point your domain to Cloudflare Pages:
- Add a CNAME record: `yourdomain.com` → `seo-audit-tool.pages.dev`

### 3. SSL/TLS

Cloudflare provides automatic SSL certificates. Configure in:
- Cloudflare Dashboard → SSL/TLS → Overview
- Set to "Full (strict)" for best security

## Environment Configuration

### Development
- Backend: `http://localhost:3001`
- Frontend: Local file or dev server

### Staging/Preview
- Backend: Staging Cloud Run instance
- Frontend: PR preview deployments

### Production
- Backend: Production Cloud Run instance  
- Frontend: Main branch deployment

## Troubleshooting

### Common Issues

**API Calls Failing**
- Check CORS configuration in Cloud Run backend
- Verify backend URL is correct in deployment

**Build Failures**
- Ensure `dist/` directory exists
- Check file paths in deployment script

**Authentication Issues**
- Re-run `wrangler login`
- Verify API token permissions

### Debug Commands

```bash
# Check deployment status
wrangler pages deployment list --project-name=seo-audit-tool

# View logs
wrangler pages deployment logs --project-name=seo-audit-tool

# Test local build
wrangler pages dev dist/
```

## Performance Optimizations

### Cloudflare Features

1. **Auto Minify**: Enable CSS, HTML, JS minification
2. **Brotli Compression**: Automatic compression
3. **HTTP/2**: Enabled by default  
4. **Global CDN**: 200+ edge locations

### Cache Configuration

The `wrangler.toml` includes optimized cache headers:
- Static assets: 1 year cache
- HTML: 1 hour cache  
- Security headers included

## Monitoring

### Analytics
- Cloudflare Web Analytics (free)
- Real User Monitoring (RUM)
- Core Web Vitals tracking

### Alerts
Set up alerts for:
- Deployment failures
- Performance degradation  
- Security issues

## Next Steps

1. **Custom Domain**: Configure your domain
2. **Branch Deployments**: Set up staging environments
3. **Analytics**: Enable Cloudflare Analytics
4. **Security**: Review security headers and policies
5. **Performance**: Monitor Core Web Vitals

## Support

- [Cloudflare Pages Documentation](https://developers.cloudflare.com/pages/)
- [Wrangler CLI Reference](https://developers.cloudflare.com/workers/wrangler/)
- [GitHub Actions Integration](https://developers.cloudflare.com/pages/platform/github-integration/)