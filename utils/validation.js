// utils/validation.js
// Input validation utilities for audit system

/**
 * Validate URL for audit
 * @param {string} url - URL to validate
 * @returns {Object} - Validation result with isValid and errors
 */
function validateAuditUrl(url) {
  const result = {
    isValid: true,
    errors: [],
    warnings: []
  };

  // Check if URL is provided
  if (!url || typeof url !== 'string') {
    result.isValid = false;
    result.errors.push('URL is required');
    return result;
  }

  // Trim whitespace
  url = url.trim();

  // Check URL length
  if (url.length > 2048) {
    result.isValid = false;
    result.errors.push('URL too long (max 2048 characters)');
  }

  // Validate URL format
  try {
    const urlObj = new URL(url);
    
    // Check protocol
    if (!['http:', 'https:'].includes(urlObj.protocol)) {
      result.isValid = false;
      result.errors.push('Invalid protocol. Only HTTP and HTTPS are supported');
    }

    // Check for localhost/internal URLs
    if (urlObj.hostname === 'localhost' || 
        urlObj.hostname.startsWith('127.') ||
        urlObj.hostname.startsWith('192.168.') ||
        urlObj.hostname.startsWith('10.') ||
        urlObj.hostname.endsWith('.local')) {
      result.warnings.push('Local/internal URL detected');
    }

    // Check for suspicious patterns
    if (urlObj.pathname.includes('../') || urlObj.pathname.includes('..\\')) {
      result.isValid = false;
      result.errors.push('URL contains path traversal attempts');
    }

    // Check for common file extensions that shouldn't be audited
    const suspiciousExtensions = ['.exe', '.zip', '.pdf', '.doc', '.docx', '.xls', '.xlsx'];
    const ext = urlObj.pathname.toLowerCase().split('.').pop();
    if (suspiciousExtensions.includes('.' + ext)) {
      result.warnings.push(`URL appears to point to a file (.${ext}) rather than a webpage`);
    }

  } catch (error) {
    result.isValid = false;
    result.errors.push('Malformed URL');
  }

  return result;
}

/**
 * Validate audit options
 * @param {Object} options - Audit options to validate
 * @returns {Object} - Validation result
 */
function validateAuditOptions(options = {}) {
  const result = {
    isValid: true,
    errors: [],
    warnings: [],
    sanitized: {}
  };

  // Lighthouse flag
  if (options.lighthouse !== undefined) {
    if (typeof options.lighthouse !== 'boolean') {
      result.warnings.push('lighthouse option should be boolean, converting');
      result.sanitized.lighthouse = Boolean(options.lighthouse);
    } else {
      result.sanitized.lighthouse = options.lighthouse;
    }
  }

  // Timeout option
  if (options.timeout !== undefined) {
    const timeout = parseInt(options.timeout);
    if (isNaN(timeout) || timeout < 1000 || timeout > 120000) {
      result.errors.push('timeout must be between 1000 and 120000 milliseconds');
      result.isValid = false;
    } else {
      result.sanitized.timeout = timeout;
    }
  }

  // Include external option
  if (options.includeExternal !== undefined) {
    if (typeof options.includeExternal !== 'boolean') {
      result.warnings.push('includeExternal option should be boolean, converting');
      result.sanitized.includeExternal = Boolean(options.includeExternal);
    } else {
      result.sanitized.includeExternal = options.includeExternal;
    }
  }

  // AI analysis option
  if (options.aiAnalysis !== undefined) {
    if (typeof options.aiAnalysis !== 'boolean') {
      result.warnings.push('aiAnalysis option should be boolean, converting');
      result.sanitized.aiAnalysis = Boolean(options.aiAnalysis);
    } else {
      result.sanitized.aiAnalysis = options.aiAnalysis;
    }
  }

  return result;
}

/**
 * Validate schema.org markup
 * @param {Object} schema - Schema object to validate
 * @returns {Object} - Validation result
 */
function validateSchema(schema) {
  const result = {
    isValid: true,
    errors: [],
    warnings: []
  };

  if (!schema || typeof schema !== 'object') {
    result.isValid = false;
    result.errors.push('Schema must be an object');
    return result;
  }

  // Check for required @type
  if (!schema['@type']) {
    result.errors.push('Schema missing required @type property');
    result.isValid = false;
  }

  // Check for @context
  if (!schema['@context']) {
    result.warnings.push('Schema missing @context property (recommended)');
  } else if (schema['@context'] !== 'https://schema.org' && 
             !schema['@context'].includes('schema.org')) {
    result.warnings.push('Schema @context does not reference schema.org');
  }

  // Validate common schema types
  const schemaType = Array.isArray(schema['@type']) ? schema['@type'][0] : schema['@type'];
  
  switch (schemaType) {
    case 'WebPage':
      if (!schema.name && !schema.headline) {
        result.warnings.push('WebPage schema missing name/headline');
      }
      if (!schema.url) {
        result.warnings.push('WebPage schema missing url');
      }
      break;
      
    case 'Article':
    case 'NewsArticle':
    case 'BlogPosting':
      if (!schema.headline) {
        result.errors.push(`${schemaType} schema missing required headline`);
        result.isValid = false;
      }
      if (!schema.datePublished) {
        result.warnings.push(`${schemaType} schema missing datePublished`);
      }
      if (!schema.author) {
        result.warnings.push(`${schemaType} schema missing author`);
      }
      break;
      
    case 'FAQPage':
      if (!Array.isArray(schema.mainEntity)) {
        result.errors.push('FAQPage schema missing mainEntity array');
        result.isValid = false;
      } else {
        const hasValidQuestions = schema.mainEntity.every(q => 
          q['@type'] === 'Question' && q.acceptedAnswer
        );
        if (!hasValidQuestions) {
          result.errors.push('FAQPage schema has invalid Question/Answer structure');
          result.isValid = false;
        }
      }
      break;
  }

  return result;
}

/**
 * Validate robots.txt content
 * @param {string} robotsContent - Robots.txt content
 * @returns {Object} - Validation result
 */
function validateRobotsTxt(robotsContent) {
  const result = {
    isValid: true,
    errors: [],
    warnings: [],
    parsed: {
      userAgents: [],
      sitemaps: [],
      rules: []
    }
  };

  if (!robotsContent || typeof robotsContent !== 'string') {
    result.isValid = false;
    result.errors.push('Robots.txt content must be a string');
    return result;
  }

  const lines = robotsContent.split('\n').map(line => line.trim());
  let currentUserAgent = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = i + 1;

    // Skip empty lines and comments
    if (!line || line.startsWith('#')) continue;

    // Parse User-agent
    if (line.toLowerCase().startsWith('user-agent:')) {
      currentUserAgent = line.substring(11).trim();
      if (!currentUserAgent) {
        result.warnings.push(`Line ${lineNum}: Empty User-agent directive`);
      } else {
        result.parsed.userAgents.push(currentUserAgent);
      }
      continue;
    }

    // Parse Sitemap
    if (line.toLowerCase().startsWith('sitemap:')) {
      const sitemapUrl = line.substring(8).trim();
      try {
        new URL(sitemapUrl);
        result.parsed.sitemaps.push(sitemapUrl);
      } catch (e) {
        result.warnings.push(`Line ${lineNum}: Invalid sitemap URL: ${sitemapUrl}`);
      }
      continue;
    }

    // Parse Disallow/Allow
    if (line.toLowerCase().startsWith('disallow:') || line.toLowerCase().startsWith('allow:')) {
      if (!currentUserAgent) {
        result.warnings.push(`Line ${lineNum}: ${line.split(':')[0]} directive without User-agent`);
      }
      
      const rule = {
        userAgent: currentUserAgent,
        directive: line.split(':')[0].toLowerCase(),
        path: line.substring(line.indexOf(':') + 1).trim()
      };
      result.parsed.rules.push(rule);
      continue;
    }

    // Parse Crawl-delay
    if (line.toLowerCase().startsWith('crawl-delay:')) {
      const delay = parseInt(line.substring(12).trim());
      if (isNaN(delay) || delay < 0) {
        result.warnings.push(`Line ${lineNum}: Invalid crawl-delay value`);
      }
      continue;
    }

    // Unknown directive
    if (line.includes(':')) {
      result.warnings.push(`Line ${lineNum}: Unknown directive: ${line}`);
    }
  }

  // Validation checks
  if (result.parsed.userAgents.length === 0) {
    result.warnings.push('No User-agent directives found');
  }

  if (result.parsed.sitemaps.length === 0) {
    result.warnings.push('No Sitemap directives found');
  }

  return result;
}

/**
 * Sanitize user input for security
 * @param {string} input - Input to sanitize
 * @returns {string} - Sanitized input
 */
function sanitizeInput(input) {
  if (typeof input !== 'string') {
    return '';
  }

  return input
    .trim()
    .replace(/[<>]/g, '') // Remove potential HTML
    .replace(/javascript:/gi, '') // Remove javascript: URLs
    .replace(/data:/gi, '') // Remove data: URLs
    .substring(0, 1000); // Limit length
}

/**
 * Validate HTTP headers for security issues
 * @param {Object} headers - Headers object
 * @returns {Object} - Validation result
 */
function validateHeaders(headers) {
  const result = {
    security: {
      hasCSP: false,
      hasSTST: false,
      hasXFrameOptions: false,
      hasXContentTypeOptions: false,
      issues: []
    }
  };

  if (!headers || typeof headers !== 'object') {
    return result;
  }

  // Check security headers
  result.security.hasCSP = !!(headers['content-security-policy'] || headers['csp']);
  result.security.hasSTST = !!headers['strict-transport-security'];
  result.security.hasXFrameOptions = !!headers['x-frame-options'];
  result.security.hasXContentTypeOptions = !!headers['x-content-type-options'];

  // Identify potential issues
  if (!result.security.hasCSP) {
    result.security.issues.push('Missing Content-Security-Policy header');
  }
  
  if (!result.security.hasSTST) {
    result.security.issues.push('Missing Strict-Transport-Security header');
  }

  if (headers['server']) {
    result.security.issues.push('Server header reveals server software');
  }

  return result;
}

module.exports = {
  validateAuditUrl,
  validateAuditOptions,
  validateSchema,
  validateRobotsTxt,
  sanitizeInput,
  validateHeaders
};