// utils/secrets.js - Secure secret management for production
const { SecretManagerServiceClient } = require('@google-cloud/secret-manager');

class SecretsManager {
  constructor() {
    this.client = new SecretManagerServiceClient();
    this.cache = new Map();
    this.cacheTimeout = 5 * 60 * 1000; // 5 minutes
    this.projectId = process.env.GOOGLE_CLOUD_PROJECT || 'seo-audit-tool-prod';
  }

  /**
   * Get secret value with caching and local development support
   */
  async getSecret(secretName) {
    const envVarName = secretName.toUpperCase().replace(/-/g, '_');
    
    // For local development, use environment variables directly
    if (process.env.NODE_ENV !== 'production' && process.env[envVarName]) {
      console.log(`[Secrets] Using local env var: ${envVarName}`);
      return process.env[envVarName];
    }

    // Check cache first
    const cached = this.cache.get(secretName);
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.value;
    }

    try {
      // Try Google Secret Manager for production
      const name = `projects/${this.projectId}/secrets/${secretName}/versions/latest`;
      const [version] = await this.client.accessSecretVersion({ name });
      const secretValue = version.payload.data.toString();
      
      // Cache the result
      this.cache.set(secretName, {
        value: secretValue,
        timestamp: Date.now()
      });

      console.log(`[Secrets] Loaded from Secret Manager: ${secretName}`);
      return secretValue;
    } catch (error) {
      console.warn(`[Secrets] Secret Manager failed for ${secretName}, using env fallback`);
      // Fallback to environment variable
      return process.env[envVarName];
    }
  }

  /**
   * Get PageSpeed API key securely
   */
  async getPageSpeedApiKey() {
    return this.getSecret('pagespeed-api-key');
  }

  /**
   * Get Browserless token securely
   */
  async getBrowserlessToken() {
    return this.getSecret('browserless-token');
  }
}

// Singleton instance
const secretsManager = new SecretsManager();

module.exports = { SecretsManager, secretsManager };