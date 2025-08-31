#!/bin/bash
# setup-monitoring.sh
# Set up monitoring, alerting, and observability for production deployment

set -e

PROJECT_ID="your-project-id"
SERVICE_NAME="seo-audit-backend"
REGION="us-central1"
NOTIFICATION_EMAIL="your-email@company.com"

echo "📊 Setting up monitoring and alerting for SEO Audit Backend"
echo "========================================================="

# Step 1: Create notification channel
echo "📧 Creating notification channel..."
NOTIFICATION_CHANNEL=$(gcloud alpha monitoring channels create \
    --display-name="SEO Audit Alerts" \
    --type=email \
    --channel-labels=email_address="$NOTIFICATION_EMAIL" \
    --format="value(name)")

echo "✅ Notification channel created: $NOTIFICATION_CHANNEL"

# Step 2: Create alert policies
echo "🚨 Creating alert policies..."

# High Error Rate Alert
cat > error-rate-policy.json << EOF
{
  "displayName": "SEO Audit - High Error Rate",
  "conditions": [
    {
      "displayName": "High 4xx/5xx error rate",
      "conditionThreshold": {
        "filter": "resource.type=\"cloud_run_revision\" resource.labels.service_name=\"$SERVICE_NAME\" metric.type=\"run.googleapis.com/request_count\"",
        "comparison": "COMPARISON_GREATER_THAN",
        "thresholdValue": 10,
        "duration": "300s",
        "aggregations": [
          {
            "alignmentPeriod": "60s",
            "perSeriesAligner": "ALIGN_RATE",
            "crossSeriesReducer": "REDUCE_SUM",
            "groupByFields": ["metric.labels.response_code_class"]
          }
        ],
        "trigger": {
          "count": 1
        }
      }
    }
  ],
  "notificationChannels": ["$NOTIFICATION_CHANNEL"],
  "alertStrategy": {
    "autoClose": "1800s"
  }
}
EOF

gcloud alpha monitoring policies create --policy-from-file=error-rate-policy.json

# High Latency Alert
cat > latency-policy.json << EOF
{
  "displayName": "SEO Audit - High Latency",
  "conditions": [
    {
      "displayName": "P95 latency > 30 seconds",
      "conditionThreshold": {
        "filter": "resource.type=\"cloud_run_revision\" resource.labels.service_name=\"$SERVICE_NAME\" metric.type=\"run.googleapis.com/request_latencies\"",
        "comparison": "COMPARISON_GREATER_THAN",
        "thresholdValue": 30000,
        "duration": "300s",
        "aggregations": [
          {
            "alignmentPeriod": "60s",
            "perSeriesAligner": "ALIGN_DELTA",
            "crossSeriesReducer": "REDUCE_PERCENTILE_95"
          }
        ]
      }
    }
  ],
  "notificationChannels": ["$NOTIFICATION_CHANNEL"]
}
EOF

gcloud alpha monitoring policies create --policy-from-file=latency-policy.json

# High Memory Usage Alert
cat > memory-policy.json << EOF
{
  "displayName": "SEO Audit - High Memory Usage",
  "conditions": [
    {
      "displayName": "Memory utilization > 80%",
      "conditionThreshold": {
        "filter": "resource.type=\"cloud_run_revision\" resource.labels.service_name=\"$SERVICE_NAME\" metric.type=\"run.googleapis.com/memory/utilizations\"",
        "comparison": "COMPARISON_GREATER_THAN",
        "thresholdValue": 0.8,
        "duration": "300s",
        "aggregations": [
          {
            "alignmentPeriod": "60s",
            "perSeriesAligner": "ALIGN_MEAN",
            "crossSeriesReducer": "REDUCE_MAX"
          }
        ]
      }
    }
  ],
  "notificationChannels": ["$NOTIFICATION_CHANNEL"]
}
EOF

gcloud alpha monitoring policies create --policy-from-file=memory-policy.json

# Cost Alert (egress data)
cat > cost-policy.json << EOF
{
  "displayName": "SEO Audit - High Egress Costs",
  "conditions": [
    {
      "displayName": "High outbound traffic",
      "conditionThreshold": {
        "filter": "resource.type=\"cloud_run_revision\" resource.labels.service_name=\"$SERVICE_NAME\" metric.type=\"run.googleapis.com/sent_bytes_count\"",
        "comparison": "COMPARISON_GREATER_THAN",
        "thresholdValue": 1073741824,
        "duration": "3600s",
        "aggregations": [
          {
            "alignmentPeriod": "3600s",
            "perSeriesAligner": "ALIGN_RATE",
            "crossSeriesReducer": "REDUCE_SUM"
          }
        ]
      }
    }
  ],
  "notificationChannels": ["$NOTIFICATION_CHANNEL"]
}
EOF

gcloud alpha monitoring policies create --policy-from-file=cost-policy.json

# Step 3: Create custom dashboard
echo "📊 Creating monitoring dashboard..."
cat > dashboard.json << EOF
{
  "displayName": "SEO Audit Backend Monitoring",
  "mosaicLayout": {
    "tiles": [
      {
        "width": 6,
        "height": 4,
        "widget": {
          "title": "Request Rate",
          "xyChart": {
            "dataSets": [
              {
                "timeSeriesQuery": {
                  "timeSeriesFilter": {
                    "filter": "resource.type=\"cloud_run_revision\" resource.labels.service_name=\"$SERVICE_NAME\" metric.type=\"run.googleapis.com/request_count\"",
                    "aggregation": {
                      "alignmentPeriod": "60s",
                      "perSeriesAligner": "ALIGN_RATE",
                      "crossSeriesReducer": "REDUCE_SUM"
                    }
                  }
                },
                "plotType": "LINE"
              }
            ]
          }
        }
      },
      {
        "width": 6,
        "height": 4,
        "xPos": 6,
        "widget": {
          "title": "Response Latency (P95)",
          "xyChart": {
            "dataSets": [
              {
                "timeSeriesQuery": {
                  "timeSeriesFilter": {
                    "filter": "resource.type=\"cloud_run_revision\" resource.labels.service_name=\"$SERVICE_NAME\" metric.type=\"run.googleapis.com/request_latencies\"",
                    "aggregation": {
                      "alignmentPeriod": "60s",
                      "perSeriesAligner": "ALIGN_DELTA",
                      "crossSeriesReducer": "REDUCE_PERCENTILE_95"
                    }
                  }
                },
                "plotType": "LINE"
              }
            ]
          }
        }
      },
      {
        "width": 6,
        "height": 4,
        "yPos": 4,
        "widget": {
          "title": "Memory Utilization",
          "xyChart": {
            "dataSets": [
              {
                "timeSeriesQuery": {
                  "timeSeriesFilter": {
                    "filter": "resource.type=\"cloud_run_revision\" resource.labels.service_name=\"$SERVICE_NAME\" metric.type=\"run.googleapis.com/memory/utilizations\"",
                    "aggregation": {
                      "alignmentPeriod": "60s",
                      "perSeriesAligner": "ALIGN_MEAN"
                    }
                  }
                },
                "plotType": "LINE"
              }
            ]
          }
        }
      },
      {
        "width": 6,
        "height": 4,
        "xPos": 6,
        "yPos": 4,
        "widget": {
          "title": "Error Rate by Status Code",
          "xyChart": {
            "dataSets": [
              {
                "timeSeriesQuery": {
                  "timeSeriesFilter": {
                    "filter": "resource.type=\"cloud_run_revision\" resource.labels.service_name=\"$SERVICE_NAME\" metric.type=\"run.googleapis.com/request_count\" metric.labels.response_code_class!=\"2xx\"",
                    "aggregation": {
                      "alignmentPeriod": "60s",
                      "perSeriesAligner": "ALIGN_RATE",
                      "crossSeriesReducer": "REDUCE_SUM",
                      "groupByFields": ["metric.labels.response_code_class"]
                    }
                  }
                },
                "plotType": "STACKED_AREA"
              }
            ]
          }
        }
      }
    ]
  }
}
EOF

DASHBOARD_ID=$(gcloud monitoring dashboards create --config-from-file=dashboard.json --format="value(name)")

# Clean up temp files
rm -f error-rate-policy.json latency-policy.json memory-policy.json cost-policy.json dashboard.json

echo ""
echo "✅ Monitoring setup complete!"
echo "================================"
echo "📧 Notification email: $NOTIFICATION_EMAIL"
echo "📊 Dashboard: https://console.cloud.google.com/monitoring/dashboards/custom/$DASHBOARD_ID"
echo ""
echo "🔍 Useful monitoring commands:"
echo "# View recent logs:"
echo "gcloud run logs tail $SERVICE_NAME --region=$REGION"
echo ""
echo "# View service metrics:"
echo "gcloud monitoring metrics list --filter=\"metric.type:run.googleapis.com\""
echo ""
echo "# Manual health check:"
echo "curl https://$SERVICE_NAME-hash-$REGION.run.app/api/health"