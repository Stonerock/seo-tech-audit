// services/service-manager.js - Central orchestration for all microservices
// Import all production services
let getReliabilityService, getSecurityService, WebhookService, getTelemetry, ArtifactsStorage, PageSpeedInsights, getAnalytics;

try {
  ({ getReliabilityService } = require('./reliability'));
} catch (e) {
  console.warn('[SERVICE MANAGER] Reliability service unavailable:', e.message);
}

try {
  ({ getSecurityService } = require('./security'));
} catch (e) {
  console.warn('[SERVICE MANAGER] Security service unavailable:', e.message);
}

try {
  ({ WebhookService } = require('./webhooks'));
} catch (e) {
  console.warn('[SERVICE MANAGER] Webhook service unavailable:', e.message);
}

try {
  ({ getTelemetry } = require('./telemetry'));
} catch (e) {
  console.warn('[SERVICE MANAGER] Telemetry service unavailable:', e.message);
}

try {
  ({ ArtifactsStorage } = require('./artifacts-storage'));
} catch (e) {
  console.warn('[SERVICE MANAGER] Artifacts storage unavailable:', e.message);
}

try {
  ({ PageSpeedInsights } = require('./pagespeed-insights'));
} catch (e) {
  console.warn('[SERVICE MANAGER] PageSpeed Insights unavailable:', e.message);
}

try {
  ({ getAnalytics } = require('./audit-analytics.firestore'));
} catch (e) {
  console.warn('[SERVICE MANAGER] Analytics service unavailable:', e.message);
}

class ServiceManager {
  constructor() {
    this.services = {};
    this.initialized = false;
  }

  /**
   * Initialize all services in the correct order
   */
  async initializeServices() {
    if (this.initialized) return this.services;

    console.log('[SERVICE MANAGER] Initializing production services...');

    try {
      // 1. Initialize core services first (with fallbacks)
      this.services.security = getSecurityService ? getSecurityService() : null;
      this.services.reliability = getReliabilityService ? getReliabilityService() : null;
      this.services.telemetry = getTelemetry ? getTelemetry() : null;

      // 2. Load secrets from Secret Manager
      if (this.services.security && this.services.security.enabled) {
        console.log('[SERVICE MANAGER] Loading secrets from Secret Manager...');
        const secrets = await this.services.security.loadSecrets();
        
        // Update environment with secrets
        if (secrets['browserless-token']) {
          process.env.BROWSERLESS_TOKEN = secrets['browserless-token'];
        }
        if (secrets['pagespeed-api-key']) {
          process.env.PAGESPEED_API_KEY = secrets['pagespeed-api-key'];
        }
        if (secrets['webhook-secret']) {
          process.env.WEBHOOK_SECRET = secrets['webhook-secret'];
        }
      }

      // 3. Initialize dependent services
      this.services.artifacts = ArtifactsStorage ? new ArtifactsStorage() : null;
      this.services.pagespeed = PageSpeedInsights ? new PageSpeedInsights() : null;
      this.services.webhooks = WebhookService ? new WebhookService() : null;
      this.services.analytics = getAnalytics ? getAnalytics() : null;

      console.log(`[SERVICE MANAGER] Services initialized:`);
      console.log(`  - Artifacts: ${!!this.services.artifacts}`);
      console.log(`  - PageSpeed: ${!!this.services.pagespeed}`);
      console.log(`  - Webhooks: ${!!this.services.webhooks}`);
      console.log(`  - Analytics: ${!!this.services.analytics}`);

      // 4. Create circuit breakers for external services
      if (this.services.reliability) {
        this.createCircuitBreakers();
        
        // 5. Set up rate limiters
        this.services.rateLimiters = this.services.reliability.createRateLimiters();
      }

      this.initialized = true;
      console.log('[SERVICE MANAGER] All services initialized successfully');

      return this.services;

    } catch (error) {
      console.error('[SERVICE MANAGER] Initialization failed:', error);
      throw error;
    }
  }

  /**
   * Create circuit breakers for all external services
   */
  createCircuitBreakers() {
    console.log('[SERVICE MANAGER] Creating circuit breakers...');

    // Browserless circuit breaker
    this.services.browserlessBreaker = this.services.reliability.createCircuitBreaker('browserless', {
      failureThreshold: 5,
      recoveryTimeout: 30000,
      monitoringPeriod: 60000
    });

    // PageSpeed Insights circuit breaker
    this.services.psiBreaker = this.services.reliability.createCircuitBreaker('pagespeed-insights', {
      failureThreshold: 3,
      recoveryTimeout: 60000,
      monitoringPeriod: 300000
    });

    // WebPageTest circuit breaker (if used)
    this.services.wptBreaker = this.services.reliability.createCircuitBreaker('webpagetest', {
      failureThreshold: 3,
      recoveryTimeout: 45000,
      monitoringPeriod: 180000
    });
  }

  /**
   * Get Express middleware for all services
   */
  getMiddleware() {
    if (!this.initialized) {
      throw new Error('Services not initialized. Call initializeServices() first.');
    }

    return {
      // Rate limiting middleware
      general: this.services.rateLimiters.general,
      audit: this.services.rateLimiters.audit,
      batch: this.services.rateLimiters.batch,

      // Telemetry middleware
      tracing: this.services.telemetry.getExpressMiddleware(),

      // Security middleware
      security: this.createSecurityMiddleware()
    };
  }

  /**
   * Create security validation middleware
   */
  createSecurityMiddleware() {
    return async (req, res, next) => {
      try {
        // URL validation for audit requests
        if (req.path.startsWith('/audit') && req.body.url) {
          const validation = this.services.security.validateAuditUrl(req.body.url);
          if (!validation.valid) {
            return res.status(400).json({
              error: 'URL validation failed',
              reason: validation.reason
            });
          }

          // Check robots.txt compliance
          const robotsCheck = await this.services.security.checkRobotsPermission(req.body.url);
          if (!robotsCheck.allowed) {
            return res.status(403).json({
              error: 'Robots.txt blocks audit',
              reason: robotsCheck.reason,
              robotsUrl: robotsCheck.robotsUrl
            });
          }

          // Add robots check result to request for logging
          req.robotsCheck = robotsCheck;
        }

        next();
      } catch (error) {
        console.error('[SECURITY MIDDLEWARE] Error:', error);
        next(error);
      }
    };
  }

  /**
   * Enhanced audit orchestration with all services
   */
  async performEnhancedAudit(jobId, url, options = {}) {
    const startTime = Date.now();
    
    try {
      // 1. Security validation (already done in middleware, but double-check)
      const urlValidation = this.services.security.validateAuditUrl(url);
      if (!urlValidation.valid) {
        throw new Error(`URL validation failed: ${urlValidation.reason}`);
      }

      // 2. Create telemetry span
      const auditResult = await this.services.telemetry.traceAuditPipeline(
        jobId, 
        url, 
        'enhanced_audit',
        async () => {
          // 3. Perform enhanced audit with circuit breaker protection
          const coreResult = await this.services.browserlessBreaker.execute(async () => {
            const AuditOrchestrator = require('./audit-orchestrator.optimized');
            const orchestrator = new AuditOrchestrator();
            
            // Enable all enhanced features
            const enhancedOptions = {
              ...options,
              enableJS: options.enableJS !== false, // Default to true
              includeLighthouse: options.includeLighthouse !== false, // Default to true
              includeScreenshot: options.includeScreenshot !== false, // Default to true
              forceJS: options.forceJS === true // Force JS rendering if requested
            };
            
            return await orchestrator.performTwoPassAudit(url, enhancedOptions);
          });

          // 4. Get PageSpeed Insights data (if enabled)
          let psiData = null;
          if (options.includePSI !== false) {
            console.log(`[SERVICE MANAGER] PSI requested for ${url}`);
            console.log(`[SERVICE MANAGER] PSI service available: ${!!this.services.pagespeed}`);
            console.log(`[SERVICE MANAGER] PSI breaker available: ${!!this.services.psiBreaker}`);
            
            if (this.services.pagespeed && this.services.psiBreaker) {
              try {
                psiData = await this.services.psiBreaker.execute(async () => {
                  console.log(`[SERVICE MANAGER] Calling PSI for ${url}`);
                  return await this.services.pagespeed.getInsights(url, {
                    categories: 'performance,seo,accessibility'
                  });
                });
                console.log(`[SERVICE MANAGER] PSI data received: ${!!psiData}`);
              } catch (psiError) {
                console.error(`[SERVICE MANAGER] PSI failed: ${psiError.message}`);
              }
            } else {
              console.warn(`[SERVICE MANAGER] PSI service not available`);
            }
          }

          // 5. Store artifacts (screenshots, HAR files)
          const artifacts = {};
          
          if (coreResult.screenshot && this.services.artifacts.enabled) {
            const screenshotArtifact = await this.services.artifacts.uploadScreenshot(
              jobId, 
              coreResult.screenshot,
              { url, auditMode: options.mode }
            );
            if (screenshotArtifact) artifacts.screenshot = screenshotArtifact;
          }

          if (coreResult.harData && this.services.artifacts.enabled) {
            const harArtifact = await this.services.artifacts.uploadHAR(
              jobId,
              coreResult.harData,
              { url, auditMode: options.mode }
            );
            if (harArtifact) artifacts.har = harArtifact;
          }

          // 6. Combine all results
          const enhancedResult = {
            ...coreResult,
            jobId,
            psiMetrics: psiData,
            artifacts,
            processingTime: Date.now() - startTime,
            services: {
              browserless: 'success',
              pagespeed: psiData ? 'success' : 'skipped',
              artifacts: Object.keys(artifacts).length > 0 ? 'success' : 'skipped'
            }
          };

          // 7. Record analytics
          if (this.services.analytics.enabled) {
            await this.services.analytics.recordAuditResult(jobId, url, enhancedResult);
          }

          return enhancedResult;
        }
      );

      // 8. Send webhook notification
      if (this.services.webhooks.enabled) {
        await this.services.webhooks.sendAuditCompleted(jobId, auditResult, {
          clientId: options.clientId,
          mode: options.mode
        });
      }

      return auditResult;

    } catch (error) {
      // Record failure analytics
      if (this.services.analytics.enabled) {
        await this.services.analytics.recordAuditFailure(jobId, url, error);
      }

      // Send failure webhook
      if (this.services.webhooks.enabled) {
        await this.services.webhooks.sendAuditFailed(jobId, error, {
          url,
          clientId: options.clientId
        });
      }

      throw error;
    }
  }

  /**
   * Get comprehensive health status for all services
   */
  async getHealthStatus() {
    const health = {
      timestamp: new Date().toISOString(),
      overall: 'healthy',
      services: {}
    };

    try {
      // Core application health
      health.services.application = {
        status: 'healthy',
        uptime: process.uptime(),
        memory: process.memoryUsage()
      };

      // Circuit breaker health
      health.services.circuitBreakers = this.services.reliability.getCircuitBreakerHealth();

      // Security service health
      health.services.security = this.services.security.getSecurityHealth();

      // Service-specific health
      health.services.artifacts = {
        enabled: this.services.artifacts.enabled,
        bucket: process.env.GCS_BUCKET || 'not-configured'
      };

      health.services.pagespeed = {
        enabled: this.services.pagespeed.enabled,
        cacheStats: this.services.pagespeed.getCacheStats()
      };

      health.services.webhooks = this.services.webhooks.getWebhookStats();

      health.services.analytics = {
        enabled: this.services.analytics.enabled,
        firestore: !!this.services.analytics.db
      };

      // Determine overall health
      const unhealthyServices = Object.values(health.services.circuitBreakers.circuitBreakers || {})
        .filter(cb => !cb.healthy);
      
      if (unhealthyServices.length > 0) {
        health.overall = 'degraded';
      }

    } catch (error) {
      console.error('[SERVICE MANAGER] Health check error:', error);
      health.overall = 'error';
      health.error = error.message;
    }

    return health;
  }

  /**
   * Graceful shutdown of all services
   */
  async shutdown() {
    console.log('[SERVICE MANAGER] Shutting down services...');
    
    try {
      if (this.services.telemetry) {
        await this.services.telemetry.shutdown();
      }
      
      console.log('[SERVICE MANAGER] All services shut down successfully');
    } catch (error) {
      console.error('[SERVICE MANAGER] Shutdown error:', error);
    }
  }

  /**
   * Get service instance
   */
  getService(serviceName) {
    if (!this.initialized) {
      throw new Error('Services not initialized');
    }
    return this.services[serviceName];
  }
}

// Singleton instance
let serviceManagerInstance = null;

function getServiceManager() {
  if (!serviceManagerInstance) {
    serviceManagerInstance = new ServiceManager();
  }
  return serviceManagerInstance;
}

module.exports = {
  ServiceManager,
  getServiceManager
};