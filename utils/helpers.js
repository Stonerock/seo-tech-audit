// utils/helpers.js
// Common utility functions extracted from server.js

const fetch = require('node-fetch');

/**
 * Fetch with timeout and proper error handling
 * @param {string} url - URL to fetch
 * @param {number} timeout - Timeout in milliseconds (default: 5000)
 * @returns {Promise<Response>} - Fetch response
 */
async function fetchWithTimeout(url, timeout = 5000) {
  // Support Node 16 where global AbortController may be missing
  let AbortControllerImpl = global.AbortController;
  try {
    if (!AbortControllerImpl) {
      AbortControllerImpl = require('abort-controller');
    }
  } catch (_) {
    AbortControllerImpl = null;
  }

  const controller = AbortControllerImpl ? new AbortControllerImpl() : null;
  const timeoutId = setTimeout(() => controller && controller.abort(), timeout);
  
  try {
    const response = await fetch(url, { 
      signal: controller ? controller.signal : undefined,
      headers: {
        'User-Agent': 'SEO-Audit-Tool/1.0'
      }
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

/**
 * Validate URL format and protocol
 * @param {string} url - URL to validate
 * @returns {boolean} - True if valid, false otherwise
 */
function isValidUrl(url) {
  try {
    const u = new URL(url);
    return ['http:', 'https:'].includes(u.protocol);
  } catch (_) {
    return false;
  }
}

/**
 * Detect CDN from response headers
 * @param {Object} headers - Response headers object
 * @returns {string|null} - CDN name or null
 */
function detectCdn(headers) {
  if (!headers || typeof headers !== 'object') {
    return null;
  }
  
  const headerString = JSON.stringify(headers).toLowerCase();
  
  if (headers['cf-ray'] || headers['cf-cache-status'] || headerString.includes('cloudflare')) {
    return 'Cloudflare';
  }
  if (headers['x-amz-cf-pop'] || headers['x-cache']?.includes('cloudfront')) {
    return 'AWS CloudFront';
  }
  if (headers['x-vercel-id']) {
    return 'Vercel';
  }
  if (headers['x-fastly-request-id'] || headerString.includes('fastly')) {
    return 'Fastly';
  }
  if (headers['akamai-grn'] || headerString.includes('akamai')) {
    return 'Akamai';
  }
  if (headers['server']?.toLowerCase().includes('varnish')) {
    return 'Varnish (possible Fastly)';
  }
  
  return null;
}

/**
 * Format audit results for consistent output
 * @param {Object} data - Raw audit data
 * @returns {Object} - Formatted results
 */
function formatResults(data) {
  return {
    url: data.url,
    timestamp: data.timestamp || new Date().toISOString(),
    tests: data.tests || {},
    metadata: {
      version: '2.0.0',
      processingTime: data.processingTime || null
    }
  };
}

/**
 * Generate cache key from URL and options
 * @param {string} url - URL being audited
 * @param {Object} options - Audit options
 * @returns {string} - Cache key
 */
function generateCacheKey(url, options = {}) {
  const optionsStr = JSON.stringify(options);
  const crypto = require('crypto');
  return crypto.createHash('md5').update(url + optionsStr).digest('hex');
}

/**
 * Convert headers object to lowercase keys
 * @param {Headers} headers - Fetch Headers object
 * @returns {Object} - Headers object with lowercase keys
 */
function normalizeHeaders(headers) {
  const headerObj = {};
  if (headers && headers.forEach) {
    headers.forEach((value, key) => { 
      headerObj[key.toLowerCase()] = value; 
    });
  }
  return headerObj;
}

/**
 * Sleep for specified milliseconds
 * @param {number} ms - Milliseconds to sleep
 * @returns {Promise} - Resolves after timeout
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Get file extension from URL
 * @param {string} url - URL to analyze
 * @returns {string|null} - File extension or null
 */
function getFileExtension(url) {
  try {
    const pathname = new URL(url).pathname;
    const match = pathname.match(/\.([a-zA-Z0-9]+)$/);
    return match ? match[1].toLowerCase() : null;
  } catch (_) {
    return null;
  }
}

/**
 * Check if URL is external to given domain
 * @param {string} url - URL to check
 * @param {string} baseDomain - Base domain to compare against
 * @returns {boolean} - True if external
 */
function isExternalUrl(url, baseDomain) {
  try {
    const urlObj = new URL(url);
    const baseObj = new URL(baseDomain);
    return urlObj.hostname !== baseObj.hostname;
  } catch (_) {
    return false;
  }
}

module.exports = {
  fetchWithTimeout,
  isValidUrl,
  detectCdn,
  formatResults,
  generateCacheKey,
  normalizeHeaders,
  sleep,
  getFileExtension,
  isExternalUrl
};