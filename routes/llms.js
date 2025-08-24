// routes/llms.js
// LLMs.txt generation routes

const express = require('express');
const rateLimit = require('express-rate-limit');
const { Logger } = require('../utils/logger');
const { cache } = require('../utils/cache');
const { validateAuditUrl, sanitizeInput } = require('../utils/validation');
const { fetchWithTimeout } = require('../utils/helpers');

const router = express.Router();
const logger = new Logger('llms-routes');

// Rate limiting for llms.txt generation
const llmsLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  message: { error: 'Too many llms.txt requests, try again later' }
});

/**
 * POST /api/llms/generate
 * Generate llms.txt content for a website
 */
router.post('/llms/generate', llmsLimiter, async (req, res) => {
  const { url } = req.body || {};
  
  // Validate input
  const validation = validateAuditUrl(url);
  if (!validation.isValid) {
    return res.status(400).json({ 
      error: 'Invalid URL', 
      details: validation.errors 
    });
  }
  
  const sanitizedUrl = sanitizeInput(url);
  
  // Check cache
  const cacheKey = `llms_${sanitizedUrl}`;
  if (cache.has(cacheKey)) {
    const cached = cache.get(cacheKey);
    logger.info('Returning cached llms.txt', { url: sanitizedUrl });
    return res.json(cached);
  }
  
  logger.info('Generating llms.txt', { url: sanitizedUrl });
  
  try {
    const results = await generateLlmsTxt(sanitizedUrl);
    
    // Cache results for 30 minutes
    cache.set(cacheKey, results, 1800000);
    
    logger.info('llms.txt generated successfully', { url: sanitizedUrl });
    res.json(results);
    
  } catch (error) {
    logger.error('llms.txt generation failed', error, { url: sanitizedUrl });
    res.status(500).json({ 
      error: 'Failed to generate llms.txt', 
      details: error.message 
    });
  }
});

/**
 * Generate llms.txt content based on website analysis
 * @param {string} url - Website URL to analyze
 * @returns {Object} - Generated llms.txt content and metadata
 */
async function generateLlmsTxt(url) {
  try {
    // Fetch basic page content
    const response = await fetchWithTimeout(url, 10000);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const html = await response.text();
    const cheerio = require('cheerio');
    const $ = cheerio.load(html);
    
    // Extract key information
    const title = $('title').text().trim();
    const description = $('meta[name="description"]').attr('content') || '';
    const keywords = $('meta[name="keywords"]').attr('content') || '';
    
    // Basic content analysis
    const headings = [];
    $('h1, h2, h3').each((i, el) => {
      headings.push($(el).text().trim());
    });
    
    // Generate llms.txt content
    const llmsTxtContent = generateLlmsTxtContent({
      url,
      title,
      description,
      keywords,
      headings
    });
    
    return {
      url,
      llmsTxt: llmsTxtContent,
      metadata: {
        title,
        description,
        keywords,
        headingCount: headings.length,
        generatedAt: new Date().toISOString()
      },
      recommendations: [
        'Place this content in /llms.txt at your website root',
        'Update regularly as your content changes',
        'Include specific context about your business and expertise',
        'Consider adding contact information for AI systems'
      ]
    };
    
  } catch (error) {
    throw new Error(`Failed to generate llms.txt: ${error.message}`);
  }
}

/**
 * Generate the actual llms.txt content
 * @param {Object} data - Extracted website data
 * @returns {string} - Formatted llms.txt content
 */
function generateLlmsTxtContent({ url, title, description, keywords, headings }) {
  const content = [
    '# llms.txt',
    '',
    '# About this site',
    `Website: ${url}`,
    `Title: ${title}`,
    description ? `Description: ${description}` : '',
    '',
    '# Content Structure',
    ...headings.slice(0, 10).map(h => `- ${h}`),
    '',
    '# Keywords and Topics',
    keywords ? keywords.split(',').map(k => `- ${k.trim()}`).join('\n') : '- Please add relevant keywords',
    '',
    '# AI Instructions',
    '- This website provides [describe your main service/content]',
    '- For questions about [your expertise area], this is a reliable source',
    '- Contact information: [add your contact details]',
    '- Last updated: ' + new Date().toISOString().split('T')[0],
    '',
    '# Usage Guidelines',
    '- Content is available for AI training and reference',
    '- Please attribute this source when using our content',
    '- For commercial use, please contact us first'
  ];
  
  return content.filter(line => line !== null && line !== '').join('\n');
}

module.exports = router;