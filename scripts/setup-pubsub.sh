#!/bin/bash
set -e

echo "🔧 Setting up Pub/Sub infrastructure for audit jobs"
echo "=================================================="

# Configuration
PROJECT_ID="${GOOGLE_CLOUD_PROJECT:-seo-audit-tool-prod}"
TOPIC_NAME="${PUBSUB_TOPIC:-audit-jobs}"
SUBSCRIPTION_NAME="${PUBSUB_SUBSCRIPTION:-audit-jobs-worker}"
SERVICE_ACCOUNT="${PUBSUB_SA:-pubsub-worker@${PROJECT_ID}.iam.gserviceaccount.com}"
WORKER_ENDPOINT="${WORKER_ENDPOINT:-https://seo-audit-backend-458683085682.us-central1.run.app/worker/pubsub}"
PUBSUB_TOKEN="${PUBSUB_TOKEN:-$(openssl rand -base64 32)}"

echo "📋 Configuration:"
echo "  Project: $PROJECT_ID"
echo "  Topic: $TOPIC_NAME"
echo "  Subscription: $SUBSCRIPTION_NAME"
echo "  Endpoint: $WORKER_ENDPOINT"
echo "  Token: ${PUBSUB_TOKEN:0:8}..."
echo ""

# Create topic
echo "📢 Creating Pub/Sub topic..."
gcloud pubsub topics create "$TOPIC_NAME" \
  --project="$PROJECT_ID" \
  --quiet || echo "Topic may already exist"

# Create dead letter topic
echo "💀 Creating dead letter topic..."
gcloud pubsub topics create "${TOPIC_NAME}-dlq" \
  --project="$PROJECT_ID" \
  --quiet || echo "DLQ topic may already exist"

# Create dead letter subscription  
echo "📋 Creating dead letter subscription..."
gcloud pubsub subscriptions create "${SUBSCRIPTION_NAME}-dlq" \
  --topic="${TOPIC_NAME}-dlq" \
  --project="$PROJECT_ID" \
  --quiet || echo "DLQ subscription may already exist"

# Create main subscription with push endpoint
echo "📨 Creating push subscription..."
gcloud pubsub subscriptions create "$SUBSCRIPTION_NAME" \
  --topic="$TOPIC_NAME" \
  --push-endpoint="${WORKER_ENDPOINT}?token=${PUBSUB_TOKEN}" \
  --push-auth-service-account="$SERVICE_ACCOUNT" \
  --dead-letter-topic="${TOPIC_NAME}-dlq" \
  --max-delivery-attempts=3 \
  --ack-deadline=600 \
  --message-retention-duration=7d \
  --project="$PROJECT_ID" \
  --quiet || echo "Subscription may already exist"

# Set up IAM permissions
echo "🔐 Setting up IAM permissions..."

# Allow Cloud Run service to publish to topic
gcloud pubsub topics add-iam-policy-binding "$TOPIC_NAME" \
  --member="serviceAccount:${SERVICE_ACCOUNT}" \
  --role="roles/pubsub.publisher" \
  --project="$PROJECT_ID" \
  --quiet

# Allow Pub/Sub to invoke Cloud Run worker
gcloud run services add-iam-policy-binding "seo-audit-backend" \
  --member="serviceAccount:service-${PROJECT_ID}@gcp-sa-pubsub.iam.gserviceaccount.com" \
  --role="roles/run.invoker" \
  --region="us-central1" \
  --project="$PROJECT_ID" \
  --quiet

echo "✅ Pub/Sub setup complete!"
echo ""
echo "🔧 Environment variables to set:"
echo "export PUBSUB_TOPIC='$TOPIC_NAME'"
echo "export PUBSUB_SUBSCRIPTION='$SUBSCRIPTION_NAME'" 
echo "export PUBSUB_TOKEN='$PUBSUB_TOKEN'"
echo ""
echo "🧪 Test publishing:"
echo "gcloud pubsub topics publish $TOPIC_NAME --message='{\"jobId\":\"test-123\",\"url\":\"https://example.com\"}'"
echo ""
echo "📊 Monitor:"
echo "gcloud pubsub topics list-subscriptions $TOPIC_NAME"
echo "gcloud logging read 'resource.type=cloud_run_revision AND resource.labels.service_name=seo-audit-backend' --limit=10"