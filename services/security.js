// services/security.js - Security hardening: robots.txt respect + Secret Manager
const { SecretManagerServiceClient } = require('@google-cloud/secret-manager');
const fetch = require('node-fetch');

class SecurityService {
  constructor() {
    this.enabled = process.env.ENABLE_SECURITY_HARDENING !== 'false'; // Enabled by default
    this.respectRobots = process.env.RESPECT_ROBOTS_TXT !== 'false'; // Enabled by default
    this.robotsOverride = process.env.ROBOTS_OVERRIDE === 'true'; // Disabled by default
    this.projectId = process.env.GOOGLE_CLOUD_PROJECT;
    
    // Secret Manager client (only if GCP project configured)
    if (this.projectId && this.enabled) {
      try {
        this.secretClient = new SecretManagerServiceClient();
        console.log('[SECURITY] Secret Manager client initialized');
      } catch (error) {
        console.warn('[SECURITY] Secret Manager unavailable:', error.message);
        this.secretClient = null;
      }
    }

    if (this.enabled) {
      console.log(`[SECURITY] Security hardening enabled (robots: ${this.respectRobots})`);
    } else {
      console.log('[SECURITY] Security hardening disabled');
    }
  }

  /**
   * Check robots.txt before auditing a URL
   */
  async checkRobotsPermission(url, userAgent = 'SEO-Audit-Tool') {
    if (!this.respectRobots) {
      return { allowed: true, reason: 'robots.txt checking disabled' };
    }

    // Override for emergency or authorized audits
    if (this.robotsOverride) {
      this.logAuditAction(url, 'ROBOTS_OVERRIDE', 'Admin override enabled');
      return { allowed: true, reason: 'administrative override' };
    }

    try {
      const robotsUrl = new URL('/robots.txt', url).toString();
      
      // Fetch robots.txt with timeout
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000); // 5s timeout

      const response = await fetch(robotsUrl, {
        signal: controller.signal,
        headers: {
          'User-Agent': userAgent,
          'Accept': 'text/plain'
        }
      });

      clearTimeout(timeout);

      if (!response.ok) {
        // No robots.txt found = allowed by default
        if (response.status === 404) {
          return { allowed: true, reason: 'no robots.txt found' };
        }
        return { allowed: true, reason: `robots.txt error: ${response.status}` };
      }

      const robotsContent = await response.text();
      const isAllowed = this.parseRobotsTxt(robotsContent, userAgent, new URL(url).pathname);
      
      this.logAuditAction(url, isAllowed ? 'ROBOTS_ALLOWED' : 'ROBOTS_BLOCKED', {
        userAgent,
        robotsUrl
      });

      return {
        allowed: isAllowed,
        reason: isAllowed ? 'robots.txt permits' : 'robots.txt blocks',
        robotsUrl,
        userAgent
      };

    } catch (error) {
      console.warn(`[SECURITY] Robots.txt check failed for ${url}:`, error.message);
      
      // Default to allowed if robots.txt can't be fetched
      // (Don't block audits due to network issues)
      return { allowed: true, reason: 'robots.txt fetch failed - allowing' };
    }
  }

  /**
   * Parse robots.txt content to check if path is allowed
   */
  parseRobotsTxt(content, userAgent, path) {
    const lines = content.split('\n').map(line => line.trim().toLowerCase());
    let currentUserAgent = null;
    let disallowedPaths = [];
    let allowedPaths = [];
    
    // Simple robots.txt parser
    for (const line of lines) {
      if (line.startsWith('#') || !line) continue;
      
      if (line.startsWith('user-agent:')) {
        const agent = line.split(':')[1].trim();
        currentUserAgent = (agent === '*' || userAgent.toLowerCase().includes(agent));
      }
      
      if (currentUserAgent) {
        if (line.startsWith('disallow:')) {
          const disallowPath = line.split(':')[1].trim();
          if (disallowPath) disallowedPaths.push(disallowPath);
        }
        
        if (line.startsWith('allow:')) {
          const allowPath = line.split(':')[1].trim();
          if (allowPath) allowedPaths.push(allowPath);
        }
      }
    }

    // Check if path matches any disallow rules
    for (const disallowPath of disallowedPaths) {
      if (disallowPath === '/') return false; // Disallow all
      if (path.startsWith(disallowPath)) {
        // Check if there's a more specific allow rule
        const hasAllowOverride = allowedPaths.some(allowPath => 
          path.startsWith(allowPath) && allowPath.length > disallowPath.length
        );
        if (!hasAllowOverride) return false;
      }
    }

    return true; // Allowed by default
  }

  /**
   * Get secret from Secret Manager
   */
  async getSecret(secretId, version = 'latest') {
    if (!this.secretClient) {
      console.warn('[SECURITY] Secret Manager not available - using environment variable');
      return process.env[secretId.toUpperCase()];
    }

    try {
      const name = `projects/${this.projectId}/secrets/${secretId}/versions/${version}`;
      const [response] = await this.secretClient.accessSecretVersion({ name });
      
      const secretValue = response.payload.data.toString();
      console.log(`[SECURITY] Secret ${secretId} retrieved from Secret Manager`);
      
      return secretValue;

    } catch (error) {
      console.warn(`[SECURITY] Failed to get secret ${secretId}:`, error.message);
      
      // Fallback to environment variable
      const fallback = process.env[secretId.toUpperCase()];
      if (fallback) {
        console.log(`[SECURITY] Using environment fallback for ${secretId}`);
        return fallback;
      }
      
      return null;
    }
  }

  /**
   * Get all secrets needed for the application
   */
  async loadSecrets() {
    const secrets = {};
    
    const secretIds = [
      'browserless-token',
      'pagespeed-api-key',
      'pubsub-token',
      'webhook-secret'
    ];

    for (const secretId of secretIds) {
      try {
        const value = await this.getSecret(secretId);
        if (value) {
          secrets[secretId] = value.trim(); // Always trim secrets
        }
      } catch (error) {
        console.warn(`[SECURITY] Failed to load secret ${secretId}:`, error.message);
      }
    }

    console.log(`[SECURITY] Loaded ${Object.keys(secrets).length} secrets`);
    return secrets;
  }

  /**
   * Store secret in Secret Manager
   */
  async storeSecret(secretId, secretValue) {
    if (!this.secretClient) {
      throw new Error('Secret Manager not available');
    }

    try {
      const parent = `projects/${this.projectId}`;
      
      // Create secret (if it doesn't exist)
      try {
        await this.secretClient.createSecret({
          parent,
          secretId,
          secret: {
            replication: {
              automatic: {}
            }
          }
        });
        console.log(`[SECURITY] Secret ${secretId} created`);
      } catch (error) {
        if (!error.message.includes('already exists')) {
          throw error;
        }
      }

      // Add secret version
      const secretPath = `${parent}/secrets/${secretId}`;
      await this.secretClient.addSecretVersion({
        parent: secretPath,
        payload: {
          data: Buffer.from(secretValue, 'utf8')
        }
      });

      console.log(`[SECURITY] Secret ${secretId} stored successfully`);
      return true;

    } catch (error) {
      console.error(`[SECURITY] Failed to store secret ${secretId}:`, error.message);
      return false;
    }
  }

  /**
   * Log security-related audit actions
   */
  logAuditAction(url, action, details) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      url: this.hashUrl(url),
      domain: this.getDomain(url),
      action,
      details: typeof details === 'string' ? details : JSON.stringify(details),
      userAgent: 'SEO-Audit-Tool/2.1.0'
    };

    // In production, this would go to structured logging (Cloud Logging)
    console.log(`[SECURITY] ${action}:`, logEntry);

    // Could also store in Firestore for audit trail
    // await this.storeAuditLog(logEntry);
  }

  /**
   * Validate URL for security (basic checks)
   */
  validateAuditUrl(url) {
    try {
      const parsed = new URL(url);
      
      // Only allow HTTP/HTTPS
      if (!['http:', 'https:'].includes(parsed.protocol)) {
        return { valid: false, reason: 'Invalid protocol - only HTTP/HTTPS allowed' };
      }

      // Block localhost/internal IPs (basic check)
      if (parsed.hostname === 'localhost' || parsed.hostname.startsWith('127.') || parsed.hostname.startsWith('192.168.')) {
        if (process.env.NODE_ENV !== 'development') {
          return { valid: false, reason: 'Internal/localhost URLs not allowed' };
        }
      }

      // Block suspicious TLDs (basic check)
      const suspiciousTlds = ['.onion', '.bit', '.i2p'];
      if (suspiciousTlds.some(tld => parsed.hostname.endsWith(tld))) {
        return { valid: false, reason: 'Suspicious TLD not allowed' };
      }

      return { valid: true, reason: 'URL passes security validation' };

    } catch (error) {
      return { valid: false, reason: 'Invalid URL format' };
    }
  }

  /**
   * Rate limiting check (basic implementation)
   */
  checkRateLimit(clientIp, endpoint = 'audit') {
    // This is a simple in-memory rate limiter
    // In production, use Redis or the rate limiting middleware
    
    const now = Date.now();
    const windowMs = 15 * 60 * 1000; // 15 minutes
    const maxRequests = endpoint === 'audit' ? 20 : 100;

    if (!this.rateLimitStore) {
      this.rateLimitStore = new Map();
    }

    const key = `${clientIp}:${endpoint}`;
    const clientData = this.rateLimitStore.get(key) || { requests: 0, windowStart: now };

    // Reset window if expired
    if (now - clientData.windowStart > windowMs) {
      clientData.requests = 0;
      clientData.windowStart = now;
    }

    clientData.requests++;
    this.rateLimitStore.set(key, clientData);

    const allowed = clientData.requests <= maxRequests;
    
    if (!allowed) {
      this.logAuditAction('rate-limit', 'RATE_LIMIT_EXCEEDED', {
        clientIp,
        endpoint,
        requests: clientData.requests,
        limit: maxRequests
      });
    }

    return {
      allowed,
      remaining: Math.max(0, maxRequests - clientData.requests),
      resetTime: clientData.windowStart + windowMs
    };
  }

  // Helper methods
  hashUrl(url) {
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
   * Security health check
   */
  getSecurityHealth() {
    return {
      timestamp: new Date().toISOString(),
      securityHardening: this.enabled,
      robotsRespect: this.respectRobots,
      robotsOverride: this.robotsOverride,
      secretManager: !!this.secretClient,
      rateLimitStore: this.rateLimitStore?.size || 0
    };
  }
}

// Singleton instance
let securityInstance = null;

function getSecurityService() {
  if (!securityInstance) {
    securityInstance = new SecurityService();
  }
  return securityInstance;
}

module.exports = {
  SecurityService,
  getSecurityService
};