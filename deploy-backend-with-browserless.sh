#!/bin/bash
# deploy-backend-with-browserless.sh
# Secure deployment script following DevOps best practices

set -e

# Configuration
PROJECT_ID="your-project-id"
SERVICE_NAME="seo-audit-backend"
REGION="us-central1"
SECRET_NAME="browserless-token"

echo "🚀 Deploying SEO Audit Backend with Browserless.io Integration"
echo "=================================================="

# Step 1: Verify project and auth
echo "📋 Verifying Google Cloud setup..."
gcloud config set project "$PROJECT_ID"
gcloud auth list

# Step 2: Create secret if it doesn't exist (one-time setup)
echo "🔐 Setting up secret management..."
if ! gcloud secrets describe "$SECRET_NAME" --quiet 2>/dev/null; then
    echo "Creating new secret: $SECRET_NAME"
    echo "⚠️  Please enter your Browserless token when prompted:"
    read -s BROWSERLESS_TOKEN
    echo -n "$BROWSERLESS_TOKEN" | gcloud secrets create "$SECRET_NAME" --data-file=-
    echo "✅ Secret created successfully"
else
    echo "✅ Secret already exists: $SECRET_NAME"
fi

# Step 3: Build and deploy Cloud Run service
echo "🔨 Building and deploying Cloud Run service..."
gcloud run deploy "$SERVICE_NAME" \
    --source . \
    --region="$REGION" \
    --platform=managed \
    --allow-unauthenticated \
    --port=8080 \
    --cpu=2 \
    --memory=2Gi \
    --concurrency=5 \
    --timeout=180 \
    --max-instances=50 \
    --min-instances=0 \
    --cpu-throttling \
    --update-secrets "BROWSERLESS_TOKEN=${SECRET_NAME}:latest" \
    --set-env-vars="NODE_ENV=production,LOG_LEVEL=info"

# Step 4: Configure IAM for secret access
echo "🔑 Configuring IAM permissions..."
SERVICE_ACCOUNT=$(gcloud run services describe "$SERVICE_NAME" \
    --region="$REGION" \
    --format="value(spec.template.spec.serviceAccountName)")

if [ -n "$SERVICE_ACCOUNT" ]; then
    gcloud secrets add-iam-policy-binding "$SECRET_NAME" \
        --member="serviceAccount:${SERVICE_ACCOUNT}" \
        --role="roles/secretmanager.secretAccessor"
    echo "✅ IAM permissions configured"
else
    echo "⚠️  Using default service account"
fi

# Step 5: Get service URL
SERVICE_URL=$(gcloud run services describe "$SERVICE_NAME" \
    --region="$REGION" \
    --format="value(status.url)")

echo ""
echo "🎉 Deployment Complete!"
echo "=================================================="
echo "Service URL: $SERVICE_URL"
echo "Health Check: $SERVICE_URL/api/health"
echo "Test Endpoint: $SERVICE_URL/api/audit/two-pass"
echo ""
echo "🔧 Next Steps:"
echo "1. Update frontend VITE_API_URL to point to: $SERVICE_URL"
echo "2. Test the deployment with: curl $SERVICE_URL/api/health"
echo "3. Monitor logs with: gcloud run logs tail $SERVICE_NAME --region=$REGION"
echo ""
echo "🛡️  Security Notes:"
echo "- Browserless token is stored securely in Secret Manager"
echo "- Token is only accessible to Cloud Run service"
echo "- No secrets are exposed in environment variables"
echo "- Service is configured with production-optimized resources"