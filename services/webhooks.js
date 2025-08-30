// services/webhooks.js - Webhook notifications for audit completions
const fetch = require('node-fetch');
const crypto = require('crypto');

class WebhookService {
  constructor() {
    this.enabled = process.env.ENABLE_WEBHOOKS === 'true';
    this.secret = process.env.WEBHOOK_SECRET;
    this.retryAttempts = parseInt(process.env.WEBHOOK_RETRY_ATTEMPTS) || 3;
    this.timeoutMs = parseInt(process.env.WEBHOOK_TIMEOUT_MS) || 10000;
    
    // Webhook endpoints can be configured per client/subscription
    this.endpoints = this.loadWebhookEndpoints();
    
    if (this.enabled) {
      console.log(`[WEBHOOKS] Enabled with ${this.endpoints.size} configured endpoints`);
    } else {
      console.log('[WEBHOOKS] Disabled - set ENABLE_WEBHOOKS=true to enable');
    }
  }

  /**
   * Load webhook endpoints from environment or configuration
   */
  loadWebhookEndpoints() {
    const endpoints = new Map();
    
    // Load from environment variables
    // Format: WEBHOOK_ENDPOINT_clientid=https://api.client.com/webhooks/seo-audit
    for (const [key, value] of Object.entries(process.env)) {
      if (key.startsWith('WEBHOOK_ENDPOINT_')) {
        const clientId = key.replace('WEBHOOK_ENDPOINT_', '').toLowerCase();
        endpoints.set(clientId, value);
      }
    }

    // Default webhook for testing
    if (process.env.WEBHOOK_DEFAULT_ENDPOINT) {
      endpoints.set('default', process.env.WEBHOOK_DEFAULT_ENDPOINT);
    }

    return endpoints;
  }

  /**
   * Send webhook notification for audit completion
   */
  async sendAuditCompleted(jobId, result, metadata = {}) {
    if (!this.enabled) return;

    const payload = {
      event: 'audit.completed',
      timestamp: new Date().toISOString(),
      data: {
        jobId,
        url: result.url,
        status: result.status || 'completed',
        scores: {
          seo: result.tests?.seo?.score || 0,
          performance: result.tests?.performance?.score || 0,
          accessibility: result.tests?.accessibility?.score || 0
        },
        completedAt: result.completedAt,
        duration: result.processingTime,
        mode: result.mode,
        artifacts: result.artifacts || {}
      },
      metadata
    };

    // Determine which endpoints to notify
    const clientId = metadata.clientId || 'default';
    const endpoints = this.getEndpointsForClient(clientId);

    for (const endpoint of endpoints) {
      await this.sendWebhook(endpoint, payload, 'audit.completed');
    }
  }

  /**
   * Send webhook notification for audit failure
   */
  async sendAuditFailed(jobId, error, metadata = {}) {
    if (!this.enabled) return;

    const payload = {
      event: 'audit.failed',
      timestamp: new Date().toISOString(),
      data: {
        jobId,
        url: metadata.url,
        error: {
          message: error.message,
          type: error.name || 'Error',
          code: error.code
        },
        failedAt: new Date().toISOString(),
        retryCount: metadata.retryCount || 0
      },
      metadata
    };

    const clientId = metadata.clientId || 'default';
    const endpoints = this.getEndpointsForClient(clientId);

    for (const endpoint of endpoints) {
      await this.sendWebhook(endpoint, payload, 'audit.failed');
    }
  }

  /**
   * Send batch audit status webhook
   */
  async sendBatchStatus(batchId, status, results = [], metadata = {}) {
    if (!this.enabled) return;

    const completed = results.filter(r => r.status === 'completed').length;
    const failed = results.filter(r => r.status === 'failed').length;

    const payload = {
      event: 'batch.status',
      timestamp: new Date().toISOString(),
      data: {
        batchId,
        status,
        summary: {
          total: results.length,
          completed,
          failed,
          pending: results.length - completed - failed
        },
        results: results.map(r => ({
          jobId: r.jobId,
          url: r.url,
          status: r.status,
          score: r.tests?.seo?.score || 0
        }))
      },
      metadata
    };

    const clientId = metadata.clientId || 'default';
    const endpoints = this.getEndpointsForClient(clientId);

    for (const endpoint of endpoints) {
      await this.sendWebhook(endpoint, payload, 'batch.status');
    }
  }

  /**
   * Send generic webhook with retry logic
   */
  async sendWebhook(endpoint, payload, eventType) {
    const webhookId = this.generateWebhookId();
    
    for (let attempt = 1; attempt <= this.retryAttempts; attempt++) {
      try {
        const signature = this.generateSignature(payload, webhookId);
        
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'SEO-Audit-Tool/2.1.0',
            'X-Webhook-ID': webhookId,
            'X-Webhook-Event': eventType,
            'X-Webhook-Signature': signature,
            'X-Webhook-Timestamp': Date.now().toString()
          },
          body: JSON.stringify(payload),
          signal: controller.signal
        });

        clearTimeout(timeout);

        if (response.ok) {
          console.log(`[WEBHOOKS] Successfully sent ${eventType} to ${this.maskEndpoint(endpoint)}`);
          this.recordWebhookSuccess(endpoint, eventType, attempt);
          return { success: true, attempt, status: response.status };
        } else {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

      } catch (error) {
        console.warn(`[WEBHOOKS] Attempt ${attempt}/${this.retryAttempts} failed for ${eventType}:`, error.message);
        
        if (attempt === this.retryAttempts) {
          this.recordWebhookFailure(endpoint, eventType, error);
          return { success: false, attempts: attempt, error: error.message };
        }

        // Exponential backoff
        await this.delay(Math.pow(2, attempt) * 1000);
      }
    }
  }

  /**
   * Generate HMAC signature for webhook security
   */
  generateSignature(payload, webhookId) {
    if (!this.secret) return 'no-secret-configured';

    const sigPayload = `${webhookId}.${JSON.stringify(payload)}`;
    const signature = crypto
      .createHmac('sha256', this.secret)
      .update(sigPayload, 'utf8')
      .digest('hex');

    return `sha256=${signature}`;
  }

  /**
   * Verify webhook signature (for incoming webhooks)
   */
  verifySignature(payload, signature, webhookId) {
    const expectedSig = this.generateSignature(payload, webhookId);
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSig)
    );
  }

  /**
   * Get webhook endpoints for a specific client
   */
  getEndpointsForClient(clientId) {
    const endpoints = [];
    
    // Client-specific endpoint
    if (this.endpoints.has(clientId)) {
      endpoints.push(this.endpoints.get(clientId));
    }
    
    // Default endpoint if no client-specific one
    if (endpoints.length === 0 && this.endpoints.has('default')) {
      endpoints.push(this.endpoints.get('default'));
    }

    return endpoints;
  }

  /**
   * Register a new webhook endpoint
   */
  registerEndpoint(clientId, endpoint, options = {}) {
    this.endpoints.set(clientId, endpoint);
    console.log(`[WEBHOOKS] Registered endpoint for client ${clientId}: ${this.maskEndpoint(endpoint)}`);
    
    // Optionally test the endpoint
    if (options.test) {
      this.testEndpoint(clientId, endpoint);
    }
  }

  /**
   * Test webhook endpoint
   */
  async testEndpoint(clientId, endpoint) {
    const testPayload = {
      event: 'webhook.test',
      timestamp: new Date().toISOString(),
      data: {
        message: 'This is a test webhook from SEO Audit Tool',
        clientId
      }
    };

    const result = await this.sendWebhook(endpoint, testPayload, 'webhook.test');
    
    if (result.success) {
      console.log(`[WEBHOOKS] Test successful for ${clientId}`);
    } else {
      console.warn(`[WEBHOOKS] Test failed for ${clientId}:`, result.error);
    }

    return result;
  }

  /**
   * Get webhook statistics
   */
  getWebhookStats() {
    return {
      enabled: this.enabled,
      endpoints: this.endpoints.size,
      retryAttempts: this.retryAttempts,
      timeoutMs: this.timeoutMs,
      // In production, these would come from persistent storage
      recentSuccesses: 0,
      recentFailures: 0
    };
  }

  // Helper methods
  generateWebhookId() {
    return crypto.randomBytes(16).toString('hex');
  }

  maskEndpoint(endpoint) {
    try {
      const url = new URL(endpoint);
      return `${url.protocol}//${url.hostname}${url.pathname}`;
    } catch {
      return 'invalid-endpoint';
    }
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  recordWebhookSuccess(endpoint, eventType, attempt) {
    // In production, record metrics for monitoring
    console.log(`[WEBHOOKS] SUCCESS: ${eventType} to ${this.maskEndpoint(endpoint)} (attempt ${attempt})`);
  }

  recordWebhookFailure(endpoint, eventType, error) {
    // In production, record metrics and potentially alert
    console.error(`[WEBHOOKS] FAILURE: ${eventType} to ${this.maskEndpoint(endpoint)} - ${error.message}`);
  }

  /**
   * Express middleware to handle incoming webhooks
   */
  createWebhookHandler(eventHandler) {
    return (req, res) => {
      try {
        const webhookId = req.get('X-Webhook-ID');
        const signature = req.get('X-Webhook-Signature');
        const eventType = req.get('X-Webhook-Event');

        if (this.secret && signature) {
          if (!this.verifySignature(req.body, signature, webhookId)) {
            return res.status(401).json({ error: 'Invalid webhook signature' });
          }
        }

        const payload = req.body;
        
        // Call the provided event handler
        eventHandler(eventType, payload, {
          webhookId,
          timestamp: req.get('X-Webhook-Timestamp')
        });

        res.json({ received: true, webhookId });

      } catch (error) {
        console.error('[WEBHOOKS] Handler error:', error);
        res.status(500).json({ error: 'Webhook processing failed' });
      }
    };
  }
}

module.exports = { WebhookService };