# 🔌 API Documentation

## 📋 Overview

The SEO Audit Tool provides a comprehensive REST API for performing SEO audits, AI readiness analysis, and generating actionable recommendations. This document covers all available endpoints, request/response formats, and integration examples.

## 🚀 Quick Start

### Base URL
- **Development**: `http://localhost:3001`
- **Production**: `https://your-domain.com`

### Authentication
Currently, the API does not require authentication. For production deployments, consider adding API key authentication for rate limiting and access control.

## 📊 Core Endpoints

### 1. Health Check

Check if the API is running and healthy.

```http
GET /health
```

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "version": "1.0.0",
  "memory": {
    "rss": 150994944,
    "heapTotal": 89653248,
    "heapUsed": 65042704
  },
  "uptime": 3600.555
}
```

### 2. Single Page Audit

Perform a comprehensive SEO audit on a single URL.

```http
POST /api/audit
```

**Request Body:**
```json
{
  "url": "https://example.com",
  "lighthouse": true,
  "options": {
    "enableAI": true,
    "includePerformance": true,
    "timeout": 30000
  }
}
```

**Parameters:**
- `url` (required): The URL to audit
- `lighthouse` (optional): Enable Lighthouse analysis (default: false)
- `options.enableAI` (optional): Enable AI-powered analysis (default: true)
- `options.includePerformance` (optional): Include performance metrics (default: true)
- `options.timeout` (optional): Request timeout in milliseconds (default: 30000)

**Response:**
```json
{
  "url": "https://example.com",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "tests": {
    "metadata": {
      "title": "Example Site",
      "description": "An example website",
      "og": {
        "title": "Example Site",
        "description": "Social media description",
        "image": "https://example.com/og-image.jpg"
      }
    },
    "seo": {
      "https": true,
      "canonical": "https://example.com",
      "robotsMeta": "index, follow"
    },
    "accessibility": {
      "score": 85,
      "issues": [],
      "images": {
        "total": 10,
        "withoutAlt": 2
      }
    },
    "performance": {
      "score": {
        "fcp": "good",
        "lcp": "needs-improvement", 
        "loadTime": "good"
      },
      "metrics": {
        "firstContentfulPaint": 1200,
        "largestContentfulPaint": 2100,
        "loadComplete": 3500
      }
    },
    "schema": {
      "found": true,
      "types": ["Article", "Organization"],
      "schemas": [
        {
          "@type": "Article",
          "headline": "Example Article",
          "datePublished": "2024-01-15"
        }
      ]
    },
    "aiSurfaces": {
      "score": 78,
      "grade": "B",
      "subs": {
        "answerClarity": 82,
        "structuredData": 90,
        "extractableFacts": 75,
        "citations": 70,
        "recency": 85,
        "technical": 88
      },
      "enhanced": {
        "language": {
          "language": "en",
          "confidence": 0.95
        },
        "contentType": {
          "type": "article",
          "confidence": 0.85,
          "source": "schema_markup"
        },
        "entities": {
          "persons": ["John Smith"],
          "organizations": ["Example Corp"],
          "technical": ["javascript", "api", "node"]
        }
      }
    },
    "aeo": {
      "comparisonContent": {
        "score": 65,
        "findings": {
          "comparisonTables": 2,
          "vsContent": 1,
          "prosConsLists": 1
        },
        "recommendations": [
          "Add more structured comparison content",
          "Include decision-making frameworks"
        ]
      },
      "expertAuthority": {
        "score": 72,
        "findings": {
          "authorBios": 1,
          "credentials": 0,
          "contactInfo": 1
        }
      },
      "contentChunking": {
        "score": 80,
        "findings": {
          "averageParagraphLength": 120,
          "headingHierarchy": true,
          "lists": 8
        }
      },
      "citationQuality": {
        "score": 68,
        "findings": {
          "externalLinks": 5,
          "authorityDomains": 2,
          "citationContexts": 3,
          "diverseDomains": 4
        }
      }
    }
  },
  "summary": {
    "overallScore": 76,
    "grade": "B",
    "criticalIssues": 2,
    "recommendations": 8
  }
}
```

### 3. Sitemap-based Audit

Analyze multiple pages from a website's sitemap.

```http
POST /api/sitemap-audit
```

**Request Body:**
```json
{
  "url": "https://example.com",
  "maxUrls": 50,
  "options": {
    "sitemapUrl": "https://example.com/sitemap.xml",
    "includeSubdomains": false,
    "skipPatterns": ["/admin/", "/login/"]
  }
}
```

**Response:**
```json
{
  "baseUrl": "https://example.com",
  "sitemapUrl": "https://example.com/sitemap.xml",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "urlsAnalyzed": 47,
  "results": [
    {
      "url": "https://example.com",
      "status": "success",
      "summary": {
        "score": 78,
        "grade": "B",
        "issues": ["Missing alt text on 2 images"]
      }
    }
  ],
  "aggregated": {
    "averageScore": 76,
    "commonIssues": [
      {
        "issue": "Missing meta descriptions",
        "count": 12,
        "percentage": 25.5
      }
    ],
    "schemaTypes": {
      "Article": 20,
      "WebPage": 15,
      "Product": 8
    }
  },
  "recommendations": [
    {
      "priority": "high",
      "issue": "12 pages missing meta descriptions",
      "impact": "Reduced click-through rates from search results",
      "effort": "Low",
      "timeEstimate": "2 hours"
    }
  ]
}
```

### 4. Generate llms.txt

Generate an llms.txt file for AI training data policies.

```http
POST /api/llms/generate
```

**Request Body:**
```json
{
  "url": "https://example.com",
  "options": {
    "allowTraining": false,
    "contactEmail": "ai@example.com",
    "customDirectives": [
      "No commercial use without permission"
    ]
  }
}
```

**Response:**
```
# llms.txt - AI Training Data Policy
# Generated on 2024-01-15T10:30:00.000Z

# Allow AI training: No
# Contact: ai@example.com

User-agent: GPTBot
Disallow: /

User-agent: Google-Extended
Disallow: /

User-agent: CCBot
Disallow: /

# Custom directives:
# No commercial use without permission

# Last updated: 2024-01-15
```

### 5. Bot Policy Analysis

Analyze website's bot access policies and detect conflicts.

```http
POST /api/bot-analysis
```

**Request Body:**
```json
{
  "url": "https://example.com",
  "options": {
    "checkBots": ["googlebot", "gptbot", "perplexitybot", "claudebot"],
    "analyzeConflicts": true
  }
}
```

**Response:**
```json
{
  "url": "https://example.com",
  "analysis": {
    "robotsTxt": {
      "exists": true,
      "url": "https://example.com/robots.txt",
      "rules": [
        {
          "userAgent": "*",
          "disallow": ["/admin/", "/private/"]
        },
        {
          "userAgent": "GPTBot",
          "disallow": ["/"]
        }
      ]
    },
    "botAccess": {
      "googlebot": {
        "allowed": true,
        "restrictions": ["/admin/", "/private/"]
      },
      "gptbot": {
        "allowed": false,
        "restrictions": ["/"]
      },
      "perplexitybot": {
        "allowed": true,
        "restrictions": ["/admin/", "/private/"],
        "stealthWarning": true
      }
    },
    "conflicts": [
      {
        "severity": "low",
        "type": "meta_robots_conflict",
        "description": "Some pages have noindex meta tag but are crawlable via robots.txt",
        "affectedUrls": 3
      }
    ],
    "recommendations": [
      {
        "type": "ai_training_opt_out",
        "priority": "medium",
        "action": "Add Google-Extended disallow to prevent AI training",
        "implementation": "User-agent: Google-Extended\\nDisallow: /"
      }
    ]
  }
}
```

## 🎯 Advanced Features

### 6. Fix Priorities

Get prioritized list of issues to fix.

```http
GET /api/fix-priorities
```

**Query Parameters:**
- `auditId`: ID from previous audit (optional)
- `priority`: Filter by priority level (critical|high|medium|low)
- `category`: Filter by category (seo|performance|accessibility|aeo)

**Response:**
```json
{
  "priorities": {
    "critical": [
      {
        "issue": "Missing page title",
        "impact": "Search engines cannot understand page topic",
        "effort": "Low",
        "timeEstimate": "5 min",
        "category": "seo",
        "urls": ["https://example.com/page1", "https://example.com/page2"]
      }
    ],
    "high": [
      {
        "issue": "Expert authority signals missing",
        "impact": "Poor E-E-A-T signals, reduced trust from AI systems",
        "effort": "Medium-High", 
        "timeEstimate": "3-6 hours",
        "category": "aeo"
      }
    ]
  },
  "summary": {
    "totalIssues": 15,
    "criticalCount": 3,
    "estimatedEffort": "8-12 hours"
  }
}
```

### 7. Batch Operations

Process multiple URLs in a single request.

```http
POST /api/batch-audit
```

**Request Body:**
```json
{
  "urls": [
    "https://example.com",
    "https://example.com/about",
    "https://example.com/contact"
  ],
  "options": {
    "enableAI": true,
    "timeout": 60000,
    "maxConcurrent": 3
  }
}
```

**Response:**
```json
{
  "batchId": "batch_123456789",
  "status": "processing",
  "urls": {
    "total": 3,
    "completed": 0,
    "failed": 0,
    "pending": 3
  },
  "statusUrl": "/api/batch-status/batch_123456789",
  "estimatedCompletion": "2024-01-15T10:35:00.000Z"
}
```

### 8. Batch Status

Check status of batch operations.

```http
GET /api/batch-status/{batchId}
```

**Response:**
```json
{
  "batchId": "batch_123456789",
  "status": "completed",
  "progress": {
    "total": 3,
    "completed": 3,
    "failed": 0,
    "percentage": 100
  },
  "results": [
    {
      "url": "https://example.com",
      "status": "success",
      "score": 78,
      "completedAt": "2024-01-15T10:32:00.000Z"
    }
  ],
  "summary": {
    "averageScore": 76,
    "totalIssues": 12,
    "processingTime": "2m 15s"
  }
}
```

## 🔧 Utility Endpoints

### 9. Cache Management

```http
POST /api/cache/clear
DELETE /api/cache/{key}
GET /api/cache/stats
```

### 10. System Information

```http
GET /api/system/info
```

**Response:**
```json
{
  "version": "1.0.0",
  "nodeVersion": "18.17.0",
  "environment": "production",
  "features": {
    "aiAnalysis": true,
    "lighthouseIntegration": true,
    "batchProcessing": true
  },
  "limits": {
    "maxConcurrentRequests": 10,
    "maxUrlsPerBatch": 100,
    "requestTimeout": 300000
  }
}
```

## 📝 Response Codes

| Code | Status | Description |
|------|--------|-------------|
| 200 | OK | Request successful |
| 400 | Bad Request | Invalid request parameters |
| 404 | Not Found | Resource not found |
| 422 | Unprocessable Entity | Invalid URL or unreachable site |
| 429 | Too Many Requests | Rate limit exceeded |
| 500 | Internal Server Error | Server error occurred |
| 503 | Service Unavailable | Service temporarily unavailable |

## 🚨 Error Responses

All errors follow a consistent format:

```json
{
  "error": {
    "code": "INVALID_URL",
    "message": "The provided URL is not valid or reachable",
    "details": {
      "url": "https://invalid-url.example",
      "issue": "DNS resolution failed"
    },
    "timestamp": "2024-01-15T10:30:00.000Z"
  }
}
```

## 📚 Integration Examples

### JavaScript/Node.js

```javascript
const axios = require('axios');

class SEOAuditClient {
  constructor(baseURL = 'https://your-api.com') {
    this.client = axios.create({
      baseURL,
      timeout: 60000,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }

  async auditSite(url, options = {}) {
    try {
      const response = await this.client.post('/api/audit', {
        url,
        ...options
      });
      return response.data;
    } catch (error) {
      throw new Error(`Audit failed: ${error.response?.data?.error?.message || error.message}`);
    }
  }

  async batchAudit(urls, options = {}) {
    const batch = await this.client.post('/api/batch-audit', {
      urls,
      ...options
    });

    const batchId = batch.data.batchId;
    
    // Poll for completion
    while (true) {
      const status = await this.client.get(`/api/batch-status/${batchId}`);
      
      if (status.data.status === 'completed') {
        return status.data.results;
      }
      
      if (status.data.status === 'failed') {
        throw new Error('Batch audit failed');
      }
      
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }
}

// Usage
const client = new SEOAuditClient();

async function example() {
  // Single audit
  const result = await client.auditSite('https://example.com', {
    lighthouse: true,
    options: { enableAI: true }
  });
  
  console.log(`Site score: ${result.summary.overallScore}`);
  
  // Batch audit
  const batchResults = await client.batchAudit([
    'https://example.com',
    'https://example.com/about'
  ]);
  
  console.log(`Batch completed: ${batchResults.length} sites analyzed`);
}
```

### Python

```python
import requests
import time
from typing import List, Dict, Any

class SEOAuditClient:
    def __init__(self, base_url: str = "https://your-api.com"):
        self.base_url = base_url
        self.session = requests.Session()
        self.session.headers.update({
            'Content-Type': 'application/json'
        })
    
    def audit_site(self, url: str, options: Dict[str, Any] = None) -> Dict[str, Any]:
        """Audit a single URL"""
        if options is None:
            options = {}
            
        response = self.session.post(
            f"{self.base_url}/api/audit",
            json={"url": url, **options},
            timeout=60
        )
        
        if response.status_code != 200:
            raise Exception(f"Audit failed: {response.json().get('error', {}).get('message', 'Unknown error')}")
        
        return response.json()
    
    def batch_audit(self, urls: List[str], options: Dict[str, Any] = None) -> List[Dict[str, Any]]:
        """Audit multiple URLs"""
        if options is None:
            options = {}
            
        # Start batch
        batch_response = self.session.post(
            f"{self.base_url}/api/batch-audit",
            json={"urls": urls, **options}
        )
        
        batch_id = batch_response.json()["batchId"]
        
        # Poll for completion
        while True:
            status_response = self.session.get(
                f"{self.base_url}/api/batch-status/{batch_id}"
            )
            status_data = status_response.json()
            
            if status_data["status"] == "completed":
                return status_data["results"]
            
            if status_data["status"] == "failed":
                raise Exception("Batch audit failed")
            
            time.sleep(5)

# Usage
client = SEOAuditClient()

# Single audit
result = client.audit_site("https://example.com", {
    "lighthouse": True,
    "options": {"enableAI": True}
})

print(f"Site score: {result['summary']['overallScore']}")
```

### cURL Examples

```bash
# Single audit
curl -X POST https://your-api.com/api/audit \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://example.com",
    "lighthouse": true,
    "options": {
      "enableAI": true
    }
  }'

# Sitemap audit
curl -X POST https://your-api.com/api/sitemap-audit \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://example.com",
    "maxUrls": 50
  }'

# Health check
curl https://your-api.com/health

# Bot analysis
curl -X POST https://your-api.com/api/bot-analysis \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://example.com",
    "options": {
      "analyzeConflicts": true
    }
  }'
```

## 📊 Rate Limits

| Endpoint | Limit | Window |
|----------|-------|--------|
| `/api/audit` | 60 requests | 1 hour |
| `/api/sitemap-audit` | 10 requests | 1 hour |
| `/api/batch-audit` | 5 requests | 1 hour |
| Health checks | 1000 requests | 1 hour |

## 🔒 Security Considerations

1. **Input Validation**: All URLs are validated and sanitized
2. **Resource Limits**: Timeouts and memory limits prevent abuse
3. **CORS**: Configured for secure cross-origin requests
4. **Rate Limiting**: Prevents API abuse
5. **Error Handling**: No sensitive information leaked in errors

## 📈 Performance Tips

1. **Enable caching** for repeated audits of the same URLs
2. **Use batch operations** for multiple URLs
3. **Disable Lighthouse** for faster basic audits
4. **Set appropriate timeouts** based on site complexity
5. **Monitor rate limits** to avoid throttling

---

**Next Steps**: See [Deployment Architecture](deployment-architecture.md) for information on hosting and scaling the API.