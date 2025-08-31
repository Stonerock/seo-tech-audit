# Backend Debugging Guide

This document contains debugging techniques and approaches for systematically fixing backend issues, particularly for Cloud Run deployments.

## Systematic Debugging Approach

### 1. Instrument Error Handling

Right now you're getting `{ mode: null, jsAnalysis: null }`. Add explicit logging:

```javascript
// wherever you do the main render/audit
try {
  // ...
} catch (err) {
  console.error('[AUDIT_FAIL]', {
    name: err?.name, 
    message: err?.message, 
    code: err?.code,
    stack: err?.stack?.split('\n').slice(0, 6),
  });
  throw err; // or map to a 502 with details
}
```

### 2. Enable Selective Debug Logging

And enable selective debug during a test deploy:

```bash
ENV DEBUG=puppeteer:*,ws,puppeteer-core:*
```

(Do this only for a test revision; it's chatty.)

### 3. Sanity Checks for "Works Locally, Fails on Cloud Run"

#### VPC/Egress Issues
If you attached a Serverless VPC connector with "all egress through VPC", your service won't reach the public internet (Browserless). Either allow public egress or add proper routes. Quick check:

Add `GET /probe/http` that `curl -I https://chrome.browserless.io` and returns status/latency.

#### Concurrency Too High
If multiple audits share one Browserless session inadvertently, you'll see intermittent `Target closed` or timeout. Keep Cloud Run concurrency ~10 while testing.

#### Node Version Drift
If you pin `node:18-alpine` but run features tested on `node:20` locally, Puppeteer handshake may differ subtly. Pick one (Node 20 is fine) and keep it consistent.

### 4. ESM-Only Dependencies

You don't have to abandon CJS overall. Options:

#### Build ESM → CJS
```bash
npx tsup node_modules/some-esm-only/index.js --format cjs --out-dir vendor/some-esm
```

Then require from `vendor/...`.

#### Isolate Lighthouse
Run it via Browserless's HTTP API or as a sidecar microservice built ESM-native, and call it over HTTP from your CJS backend.

## Implementation Examples

### Error Logging Implementation
```javascript
// In audit orchestrator methods
catch (error) {
    console.error('[AUDIT_FAIL] Lightweight audit failed:', {
        name: error?.name, 
        message: error?.message, 
        code: error?.code,
        stack: error?.stack?.split('\n').slice(0, 6),
        url: url,
        options: options
    });
    logger.error('Lightweight audit failed:', error);
    throw error;
}
```

### Debug Logging for Null Values
```javascript
// Debug logging for mode and jsAnalysis
console.log('[DEBUG] Lightweight audit results:', {
    mode: auditResults.mode,
    jsAnalysis: auditResults.tests.seo?.jsAnalysis || 'not set',
    seoStatus: results[0].status,
    hasTests: !!auditResults.tests,
    testsKeys: Object.keys(auditResults.tests)
});
```

### HTTP Probe Endpoint
```javascript
// HTTP connectivity probe endpoint
app.get('/probe/http', async (req, res) => {
    const startTime = Date.now();
    const target = req.query.target || 'https://chrome.browserless.io';
    
    try {
        const fetch = require('node-fetch');
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10000); // 10s timeout
        
        console.log(`[PROBE] Testing HTTP connectivity to ${target}`);
        
        const response = await fetch(target, {
            method: 'HEAD',
            signal: controller.signal,
            headers: {
                'User-Agent': 'SEO-Audit-Tool-Probe/2.1.0'
            }
        });
        
        clearTimeout(timeout);
        const latency = Date.now() - startTime;
        
        const result = {
            target,
            status: response.status,
            statusText: response.statusText,
            latency: `${latency}ms`,
            headers: Object.fromEntries(response.headers.entries()),
            connectivity: response.status < 400 ? 'ok' : 'error',
            timestamp: new Date().toISOString()
        };
        
        console.log(`[PROBE] Result:`, { status: result.status, latency: result.latency, connectivity: result.connectivity });
        
        res.json(result);
        
    } catch (error) {
        const latency = Date.now() - startTime;
        
        const result = {
            target,
            error: error.message,
            code: error.code,
            latency: `${latency}ms`,
            connectivity: 'failed',
            timestamp: new Date().toISOString()
        };
        
        console.error(`[PROBE] Failed:`, result);
        
        res.status(503).json(result);
    }
});
```

## Cloud Run Deployment Best Practices

### Optimal Configuration
```bash
gcloud run deploy seo-audit-backend \
  --source . \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars "USE_PSI_METRICS=true,PAGESPEED_API_KEY=your_key" \
  --memory 2Gi \
  --cpu 2 \
  --timeout 300 \
  --concurrency 10 \
  --max-instances 5
```

### Testing Commands
```bash
# Test health
curl "https://your-service.run.app/api/health"

# Test connectivity
curl "https://your-service.run.app/probe/http"

# Test audit
curl -X POST "https://your-service.run.app/api/audit" \
-H "Content-Type: application/json" \
-d '{"url": "https://example.com", "options": {"fastMode": true}}'
```

## Results After Implementation

When properly implemented, you should see:
- ✅ Mode: `"static-only"` or `"two-pass"` (not null)
- ✅ jsAnalysis: Full object with `needsJS`, `confidence`, `indicators` (not null)  
- ✅ PSI data: Complete Core Web Vitals from Google's API
- ✅ External connectivity: Sub-400ms latency to external services
- ✅ Proper error details when things fail

This systematic approach transforms debugging from guesswork into methodical problem-solving.