# 🚀 Manual Deployment Steps

Your tool works locally but not on phones because the backend only runs on your laptop. Here's how to fix it:

## Current Status
- ✅ **Frontend**: https://seo-audit-tool-e50.pages.dev/ (Cloudflare Pages)
- ❌ **Backend**: Only localhost:3001 (your laptop only)
- ❌ **Result**: Phone can't access localhost:3001

## Solution: Deploy Backend to Cloud

### Option 1: Google Cloud Run (Recommended)

1. **Install Google Cloud CLI**
   ```bash
   # macOS with Homebrew
   brew install --cask google-cloud-sdk
   
   # Or download: https://cloud.google.com/sdk/docs/install
   ```

2. **Authenticate**
   ```bash
   gcloud auth login
   gcloud config set project YOUR_PROJECT_ID
   ```

3. **Deploy Backend**
   ```bash
   cd "/Users/markus.karikivi/Local Sites/Optimisation-tool"
   ./deploy.sh
   ```

4. **Update Frontend**
   - After deployment, you'll get a URL like: `https://seo-audit-backend-xxx-uc.a.run.app`
   - Update line 785 in index.html with the real URL
   - Redeploy to Cloudflare Pages

### Option 2: Alternative Cloud Providers

**Railway** (Easiest)
1. Go to https://railway.app
2. Connect GitHub repo
3. Deploy from `/`
4. Set PORT=8080 in environment

**Render** 
1. Go to https://render.com
2. New Web Service from GitHub
3. Build: `npm install`
4. Start: `npm start`

**Vercel** (Functions)
1. `npm i -g vercel`
2. `vercel --prod`
3. Configure as Node.js functions

### Option 3: Manual Cloud Run (Without CLI)

1. Go to https://console.cloud.google.com/run
2. Create Service
3. Deploy from source (connect GitHub)
4. Select repository and branch
5. Configure:
   - Port: 8080
   - Memory: 2GB
   - CPU: 2
   - Min instances: 0
   - Max instances: 5

## After Backend Deployment

1. **Test Backend**
   ```bash
   curl https://YOUR_BACKEND_URL/api/health
   ```

2. **Update Frontend**
   - Edit `index.html` line 785
   - Replace `https://your-cloud-run-url-here` with actual URL
   - Commit and push (auto-deploys to Cloudflare)

3. **Test Full Flow**
   - Open https://seo-audit-tool-e50.pages.dev/ on phone
   - Try analyzing a website
   - Should work! 🎉

## Quick Fix Preview

Once deployed, your setup will be:
- **Frontend**: Cloudflare Pages (global CDN, fast)
- **Backend**: Cloud Run (serverless, scales to zero)
- **Cost**: ~$0-5/month for moderate usage

This will make your tool work on any device, anywhere in the world!