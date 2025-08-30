// services/telemetry.js - Basic OpenTelemetry tracing for audit pipeline
const { NodeSDK } = require('@opentelemetry/sdk-node');
const { getNodeAutoInstrumentations } = require('@opentelemetry/auto-instrumentations-node');
const { Resource } = require('@opentelemetry/resources');
const { SemanticResourceAttributes } = require('@opentelemetry/semantic-conventions');

class TelemetryService {
  constructor() {
    this.enabled = process.env.ENABLE_TRACING === 'true';
    this.serviceName = process.env.SERVICE_NAME || 'seo-audit-backend';
    this.serviceVersion = process.env.SERVICE_VERSION || '2.1.0';
    
    if (this.enabled) {
      this.initializeTracing();
      console.log('[TELEMETRY] OpenTelemetry tracing enabled');
    } else {
      console.log('[TELEMETRY] Tracing disabled - set ENABLE_TRACING=true to enable');
    }
  }

  initializeTracing() {
    try {
      // Configure resource
      const resource = new Resource({
        [SemanticResourceAttributes.SERVICE_NAME]: this.serviceName,
        [SemanticResourceAttributes.SERVICE_VERSION]: this.serviceVersion,
        [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]: process.env.NODE_ENV || 'development'
      });

      // Initialize SDK
      const sdk = new NodeSDK({
        resource,
        instrumentations: [
          getNodeAutoInstrumentations({
            // Disable some noisy instrumentations
            '@opentelemetry/instrumentation-fs': {
              enabled: false
            }
          })
        ]
      });

      // Start tracing
      sdk.start();
      
      this.sdk = sdk;

    } catch (error) {
      console.error('[TELEMETRY] Failed to initialize tracing:', error.message);
      this.enabled = false;
    }
  }

  /**
   * Create custom span for audit operations
   */
  createAuditSpan(name, attributes = {}) {
    if (!this.enabled) return null;

    try {
      const { trace } = require('@opentelemetry/api');
      const tracer = trace.getTracer(this.serviceName);

      return tracer.startSpan(name, {
        attributes: {
          'audit.operation': name,
          ...attributes
        }
      });

    } catch (error) {
      console.warn('[TELEMETRY] Failed to create span:', error.message);
      return null;
    }
  }

  /**
   * Trace audit pipeline: HTTP → Queue → Worker → Browserless
   */
  async traceAuditPipeline(jobId, url, operation, fn) {
    const span = this.createAuditSpan(`audit.${operation}`, {
      'audit.job_id': jobId,
      'audit.url': this.hashUrl(url),
      'audit.domain': this.getDomain(url)
    });

    try {
      const startTime = Date.now();
      const result = await fn();
      
      if (span) {
        span.setAttributes({
          'audit.duration_ms': Date.now() - startTime,
          'audit.success': true,
          'audit.mode': result?.mode || 'unknown'
        });
        span.setStatus({ code: 1 }); // OK
      }

      return result;

    } catch (error) {
      if (span) {
        span.setAttributes({
          'audit.duration_ms': Date.now() - Date.now(),
          'audit.success': false,
          'audit.error': error.message
        });
        span.recordException(error);
        span.setStatus({ code: 2, message: error.message }); // ERROR
      }
      
      throw error;

    } finally {
      if (span) {
        span.end();
      }
    }
  }

  /**
   * Trace Browserless operations specifically
   */
  async traceBrowserlessOperation(operation, url, fn) {
    const span = this.createAuditSpan(`browserless.${operation}`, {
      'browserless.operation': operation,
      'browserless.url': this.hashUrl(url),
      'browserless.endpoint': process.env.BROWSERLESS_WS || 'unknown'
    });

    try {
      const startTime = Date.now();
      const result = await fn();
      
      if (span) {
        span.setAttributes({
          'browserless.duration_ms': Date.now() - startTime,
          'browserless.success': true
        });
        span.setStatus({ code: 1 });
      }

      return result;

    } catch (error) {
      if (span) {
        span.setAttributes({
          'browserless.duration_ms': Date.now() - Date.now(),
          'browserless.success': false,
          'browserless.error': error.message,
          'browserless.error_type': error.name || 'Error'
        });
        span.recordException(error);
        span.setStatus({ code: 2, message: error.message });
      }
      
      throw error;

    } finally {
      if (span) {
        span.end();
      }
    }
  }

  /**
   * Add custom metrics to spans
   */
  recordMetric(spanName, metricName, value, attributes = {}) {
    if (!this.enabled) return;

    try {
      const { metrics } = require('@opentelemetry/api');
      const meter = metrics.getMeter(this.serviceName);
      
      const counter = meter.createCounter(metricName, {
        description: `Custom metric for ${spanName}`
      });

      counter.add(value, attributes);

    } catch (error) {
      console.warn('[TELEMETRY] Failed to record metric:', error.message);
    }
  }

  /**
   * Express middleware for automatic HTTP request tracing
   */
  getExpressMiddleware() {
    if (!this.enabled) {
      return (req, res, next) => next();
    }

    return (req, res, next) => {
      const span = this.createAuditSpan(`http.${req.method}`, {
        'http.method': req.method,
        'http.url': req.url,
        'http.route': req.route?.path || req.url,
        'http.user_agent': req.get('user-agent'),
        'http.remote_addr': req.ip
      });

      if (span) {
        // Store span in request for later use
        req.telemetrySpan = span;

        // End span when response finishes
        res.on('finish', () => {
          span.setAttributes({
            'http.status_code': res.statusCode,
            'http.response_size': res.get('content-length') || 0
          });
          
          if (res.statusCode >= 400) {
            span.setStatus({ code: 2, message: `HTTP ${res.statusCode}` });
          } else {
            span.setStatus({ code: 1 });
          }
          
          span.end();
        });
      }

      next();
    };
  }

  // Helper methods
  hashUrl(url) {
    if (!url) return 'unknown';
    const crypto = require('crypto');
    return crypto.createHash('md5').update(url).digest('hex').substring(0, 8);
  }

  getDomain(url) {
    try {
      return new URL(url).hostname;
    } catch {
      return 'invalid-url';
    }
  }

  /**
   * Graceful shutdown
   */
  async shutdown() {
    if (this.enabled && this.sdk) {
      try {
        await this.sdk.shutdown();
        console.log('[TELEMETRY] Tracing shutdown complete');
      } catch (error) {
        console.error('[TELEMETRY] Shutdown error:', error.message);
      }
    }
  }
}

// Global instance
let telemetryInstance = null;

function getTelemetry() {
  if (!telemetryInstance) {
    telemetryInstance = new TelemetryService();
  }
  return telemetryInstance;
}

module.exports = { 
  TelemetryService,
  getTelemetry 
};