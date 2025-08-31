const { URL } = require('url');
const dns = require('dns').promises;
const net = require('net');
const rateLimit = require('express-rate-limit');
const { body, query, validationResult } = require('express-validator');

// SSRF Protection - Block internal/private networks
const BLOCKED_NETWORKS = [
  // Private IPv4 ranges
  { start: '10.0.0.0', end: '10.255.255.255' },
  { start: '172.16.0.0', end: '172.31.255.255' },
  { start: '192.168.0.0', end: '192.168.255.255' },
  // Localhost
  { start: '127.0.0.0', end: '127.255.255.255' },
  // Link-local
  { start: '169.254.0.0', end: '169.254.255.255' },
  // Multicast
  { start: '224.0.0.0', end: '239.255.255.255' },
];

const BLOCKED_DOMAINS = [
  'localhost',
  'metadata.google.internal',
  '169.254.169.254', // AWS/GCP metadata
];

function ipToNumber(ip) {
  return ip.split('.').reduce((acc, octet) => (acc << 8) + parseInt(octet, 10), 0) >>> 0;
}

function isIPInRange(ip, range) {
  const ipNum = ipToNumber(ip);
  const startNum = ipToNumber(range.start);
  const endNum = ipToNumber(range.end);
  return ipNum >= startNum && ipNum <= endNum;
}

async function validateURL(urlString) {
  try {
    const url = new URL(urlString);
    
    // Only allow HTTP/HTTPS
    if (!['http:', 'https:'].includes(url.protocol)) {
      throw new Error('Only HTTP and HTTPS protocols are allowed');
    }
    
    // Block suspicious domains
    const hostname = url.hostname.toLowerCase();
    if (BLOCKED_DOMAINS.some(domain => hostname.includes(domain))) {
      throw new Error('Access to this domain is not allowed');
    }
    
    // Check if hostname is a direct IP address
    if (net.isIPv4(hostname)) {
      if (BLOCKED_NETWORKS.some(network => isIPInRange(hostname, network))) {
        throw new Error('Direct IP access to internal networks is not allowed');
      }
    } else {
      // Resolve hostname to IP and check for internal networks
      try {
        const addresses = await dns.resolve4(hostname);
        for (const ip of addresses) {
          if (BLOCKED_NETWORKS.some(network => isIPInRange(ip, network))) {
            throw new Error('Access to internal networks is not allowed');
          }
        }
      } catch (dnsError) {
        // If DNS resolution fails, still allow the request but log it
        console.warn(`DNS resolution failed for ${hostname}:`, dnsError.message);
      }
    }
    
    return url;
  } catch (error) {
    throw new Error(`Invalid URL: ${error.message}`);
  }
}

// API Key Authentication Middleware
function requireApiKey(req, res, next) {
  const apiKey = req.headers['x-api-key'] || req.query.api_key;
  const validApiKeys = process.env.API_KEYS ? process.env.API_KEYS.split(',') : [];
  
  // Skip API key check in development
  if (process.env.NODE_ENV === 'development') {
    return next();
  }
  
  if (!apiKey || !validApiKeys.includes(apiKey)) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Valid API key required'
    });
  }
  
  next();
}

// Rate Limiting
const createRateLimit = (windowMs = 15 * 60 * 1000, max = 100) => {
  return rateLimit({
    windowMs,
    max,
    message: {
      error: 'Too Many Requests',
      message: 'Rate limit exceeded. Please try again later.'
    },
    standardHeaders: true,
    legacyHeaders: false,
  });
};

// Validation Rules
const urlValidationRules = [
  query('url')
    .isURL({ protocols: ['http', 'https'], require_protocol: true })
    .withMessage('Must be a valid HTTP or HTTPS URL')
    .isLength({ max: 2048 })
    .withMessage('URL must be less than 2048 characters')
    .custom(async (value) => {
      await validateURL(value);
      return true;
    })
];

const bodyUrlValidationRules = [
  body('url')
    .isURL({ protocols: ['http', 'https'], require_protocol: true })
    .withMessage('Must be a valid HTTP or HTTPS URL')
    .isLength({ max: 2048 })
    .withMessage('URL must be less than 2048 characters')
    .custom(async (value) => {
      await validateURL(value);
      return true;
    })
];

const batchUrlValidationRules = [
  body('urls')
    .isArray({ min: 1, max: 50 })
    .withMessage('Must be an array of 1-50 URLs')
    .custom(async (urls) => {
      for (const url of urls) {
        if (typeof url !== 'string') {
          throw new Error('All URLs must be strings');
        }
        await validateURL(url);
      }
      return true;
    })
];

// Validation Error Handler
function handleValidationErrors(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'Validation Error',
      details: errors.array()
    });
  }
  next();
}

// Security Headers Middleware
function securityHeaders(req, res, next) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  // Remove sensitive headers
  res.removeHeader('X-Powered-By');
  res.removeHeader('Server');
  
  next();
}

module.exports = {
  validateURL,
  requireApiKey,
  createRateLimit,
  urlValidationRules,
  bodyUrlValidationRules,
  batchUrlValidationRules,
  handleValidationErrors,
  securityHeaders
};