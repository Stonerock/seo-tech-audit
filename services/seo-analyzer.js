// services/seo-analyzer.js
// SEO analysis functions extracted from server.js

const { fetchWithTimeout } = require('../utils/helpers');
const xml2js = require('xml2js');

class SEOAnalyzer {
  constructor() {
    this.supportedLanguages = ['en', 'es', 'fr', 'de', 'it', 'pt', 'ru', 'ja', 'ko', 'zh'];
  }

  /**
   * Analyze SEO basics for a webpage
   * @param {Object} $ - Cheerio DOM object
   * @param {string} url - Page URL
   * @returns {Object} - SEO analysis results
   */
  async analyzeSEOBasics($, url) {
    const urlObj = new URL(url);
    
    const seo = {
      https: urlObj.protocol === 'https:',
      title: $('title').text() || null,
      metaDescription: $('meta[name="description"]').attr('content') || null,
      h1Count: $('h1').length,
      imageCount: $('img').length,
      altMissing: $('img:not([alt])').length,
      internalLinks: 0,
      externalLinks: 0,
      socialLinks: this.analyzeSocialLinks($),
      lang: $('html').attr('lang') || null,
      hreflang: $('link[hreflang]').length > 0,
      canonical: $('link[rel="canonical"]').attr('href') || null,
      issues: []
    };

    // Analyze links
    $('a[href]').each((_, link) => {
      const href = $(link).attr('href');
      if (href) {
        if (href.startsWith('http') && !href.includes(urlObj.hostname)) {
          seo.externalLinks++;
        } else if (href.startsWith('/') || href.startsWith(urlObj.origin)) {
          seo.internalLinks++;
        }
      }
    });

    // Validation and issues
    if (!seo.title) {
      seo.issues.push('Missing title tag');
    } else if (seo.title.length > 60) {
      seo.issues.push('Title too long (>60 characters)');
    }

    if (!seo.metaDescription) {
      seo.issues.push('Missing meta description');
    } else if (seo.metaDescription.length > 160) {
      seo.issues.push('Meta description too long (>160 characters)');
    }

    if (seo.h1Count === 0) {
      seo.issues.push('Missing H1 tag');
    } else if (seo.h1Count > 1) {
      seo.issues.push('Multiple H1 tags found');
    }

    if (!seo.https) {
      seo.issues.push('Not using HTTPS');
    }

    if (seo.altMissing > 0) {
      seo.issues.push(`${seo.altMissing} images missing alt text`);
    }

    if (!seo.canonical) {
      seo.issues.push('Missing canonical URL');
    }

    // Calculate SEO score
    seo.score = this.calculateSEOScore(seo);

    return seo;
  }

  /**
   * Analyze social media links and presence
   * @param {Object} $ - Cheerio DOM object
   * @returns {Object} - Social links analysis
   */
  analyzeSocialLinks($) {
    const socialPatterns = {
      facebook: /facebook\.com/i,
      twitter: /twitter\.com|x\.com/i,
      linkedin: /linkedin\.com/i,
      instagram: /instagram\.com/i,
      youtube: /youtube\.com|youtu\.be/i,
      tiktok: /tiktok\.com/i
    };

    const socialLinks = {};
    const foundLinks = [];

    $('a[href]').each((_, link) => {
      const href = $(link).attr('href');
      if (href) {
        for (const [platform, pattern] of Object.entries(socialPatterns)) {
          if (pattern.test(href)) {
            socialLinks[platform] = href;
            foundLinks.push({ platform, url: href });
          }
        }
      }
    });

    return {
      ...socialLinks,
      count: foundLinks.length,
      platforms: Object.keys(socialLinks)
    };
  }

  /**
   * Test external files (robots.txt, sitemap.xml, etc.)
   * @param {string} url - Base URL
   * @returns {Object} - External files analysis
   */
  async testExternalFiles(url) {
    const urlObj = new URL(url);
    const results = {};
    
    // Test robots.txt
    try {
      const robotsUrl = `${urlObj.origin}/robots.txt`;
      const robotsResponse = await fetchWithTimeout(robotsUrl);
      results.robots = {
        exists: robotsResponse.ok,
        url: robotsUrl,
        size: robotsResponse.ok ? robotsResponse.headers.get('content-length') : null
      };
      
      if (robotsResponse.ok) {
        const robotsText = await robotsResponse.text();
        results.robots.hasSitemap = robotsText.includes('Sitemap:');
        results.robots.hasUserAgent = robotsText.includes('User-agent:');
        results.robots.content = robotsText.substring(0, 1000); // First 1000 chars
      }
    } catch (error) {
      results.robots = { exists: false, error: error.message };
    }
    
    // Test sitemap.xml
    try {
      const sitemapUrl = `${urlObj.origin}/sitemap.xml`;
      const sitemapResponse = await fetchWithTimeout(sitemapUrl);
      results.sitemap = {
        exists: sitemapResponse.ok,
        url: sitemapUrl
      };
      
      if (sitemapResponse.ok) {
        const sitemapText = await sitemapResponse.text();
        const parser = new xml2js.Parser();
        try {
          const sitemapData = await parser.parseStringPromise(sitemapText);
          const urls = sitemapData?.urlset?.url || sitemapData?.sitemapindex?.sitemap || [];
          results.sitemap.urlCount = Array.isArray(urls) ? urls.length : 0;
          results.sitemap.type = sitemapData?.urlset ? 'urlset' : 'sitemapindex';
        } catch (parseError) {
          results.sitemap.parseError = parseError.message;
        }
      }
    } catch (error) {
      results.sitemap = { exists: false, error: error.message };
    }

    // Test llms.txt
    try {
      const llmsUrl = `${urlObj.origin}/llms.txt`;
      const llmsResponse = await fetchWithTimeout(llmsUrl);
      results.llms = {
        exists: llmsResponse.ok,
        url: llmsUrl
      };
      if (llmsResponse.ok) {
        const txt = await llmsResponse.text();
        const lines = txt.split(/\r?\n/).filter(Boolean).length;
        results.llms.lines = lines;
        results.llms.hasSitemap = /sitemap/i.test(txt);
        results.llms.hasFaq = /faq/i.test(txt);
        results.llms.hasDocs = /docs|documentation/i.test(txt);
        results.llms.content = txt.substring(0, 500); // First 500 chars
      }
    } catch (error) {
      results.llms = { exists: false };
    }
    
    return results;
  }

  /**
   * Test metadata (title, description, Open Graph, Twitter Cards)
   * @param {Object} $ - Cheerio DOM object
   * @returns {Object} - Metadata analysis
   */
  testMetadata($) {
    const meta = {
      title: $('title').text() || null,
      description: $('meta[name="description"]').attr('content') || null,
      keywords: $('meta[name="keywords"]').attr('content') || null,
      
      // Open Graph
      og: {
        title: $('meta[property="og:title"]').attr('content') || null,
        description: $('meta[property="og:description"]').attr('content') || null,
        image: $('meta[property="og:image"]').attr('content') || null,
        url: $('meta[property="og:url"]').attr('content') || null,
        type: $('meta[property="og:type"]').attr('content') || null,
        siteName: $('meta[property="og:site_name"]').attr('content') || null
      },
      
      // Twitter Cards
      twitter: {
        card: $('meta[name="twitter:card"]').attr('content') || null,
        title: $('meta[name="twitter:title"]').attr('content') || null,
        description: $('meta[name="twitter:description"]').attr('content') || null,
        image: $('meta[name="twitter:image"]').attr('content') || null,
        site: $('meta[name="twitter:site"]').attr('content') || null
      },
      
      // Other important meta
      viewport: $('meta[name="viewport"]').attr('content') || null,
      robots: $('meta[name="robots"]').attr('content') || null,
      canonical: $('link[rel="canonical"]').attr('href') || null,
      favicon: $('link[rel="icon"], link[rel="shortcut icon"]').attr('href') || null,
      
      // Language and alternate versions
      lang: $('html').attr('lang') || null,
      hreflang: []
    };

    // Collect hreflang links
    $('link[hreflang]').each((_, link) => {
      meta.hreflang.push({
        hreflang: $(link).attr('hreflang'),
        href: $(link).attr('href')
      });
    });
    
    // Validation
    const issues = [];
    if (!meta.title) issues.push('Title missing');
    if (meta.title && meta.title.length > 60) issues.push('Title too long (>60 characters)');
    if (!meta.description) issues.push('Meta description missing');
    if (meta.description && meta.description.length > 160) issues.push('Description too long (>160 characters)');
    if (!meta.viewport) issues.push('Viewport meta missing (mobile optimization)');
    
    // Open Graph validation
    if (!meta.og.title && !meta.og.description) issues.push('Missing Open Graph meta tags');
    if (meta.og.image && !meta.og.image.startsWith('http')) issues.push('Open Graph image should be absolute URL');
    
    meta.issues = issues;
    meta.score = this.calculateMetadataScore(meta);
    
    return meta;
  }

  /**
   * Calculate SEO score based on analysis
   * @param {Object} seo - SEO analysis object
   * @returns {number} - Score from 0-100
   */
  calculateSEOScore(seo) {
    let score = 100;
    
    // Deduct points for issues
    score -= seo.issues.length * 10;
    
    // Bonus points for good practices
    if (seo.https) score += 5;
    if (seo.h1Count === 1) score += 5;
    if (seo.canonical) score += 5;
    if (seo.lang) score += 5;
    if (seo.hreflang) score += 5;
    if (seo.socialLinks.count > 0) score += 5;
    
    // Image optimization
    if (seo.imageCount > 0) {
      const altTextRatio = (seo.imageCount - seo.altMissing) / seo.imageCount;
      score += altTextRatio * 10;
    }
    
    // Link analysis
    if (seo.internalLinks > 0) score += 5;
    if (seo.externalLinks > 0 && seo.externalLinks < 10) score += 5;
    
    return Math.max(0, Math.min(100, Math.round(score)));
  }

  /**
   * Calculate metadata score
   * @param {Object} meta - Metadata object
   * @returns {number} - Score from 0-100
   */
  calculateMetadataScore(meta) {
    let score = 0;
    
    // Basic meta tags
    if (meta.title) score += 20;
    if (meta.description) score += 20;
    if (meta.viewport) score += 10;
    
    // Open Graph
    if (meta.og.title) score += 10;
    if (meta.og.description) score += 10;
    if (meta.og.image) score += 10;
    
    // Twitter Cards
    if (meta.twitter.card) score += 5;
    if (meta.twitter.title || meta.twitter.description) score += 5;
    
    // Technical SEO
    if (meta.canonical) score += 5;
    if (meta.lang) score += 5;
    
    return Math.min(100, score);
  }

  /**
   * AI Readiness analysis for SEO
   * @param {string} url - Page URL
   * @param {Object} headersInfo - Headers information
   * @param {Object} $ - Cheerio DOM object
   * @returns {Object} - AI readiness analysis
   */
  async testAIReadiness(url, headersInfo, $) {
    const urlObj = new URL(url);
    const aiBots = [
      'GPTBot',
      'CCBot',
      'ClaudeBot',
      'anthropic-ai',
      'PerplexityBot',
      'Google-Extended',
      'Applebot-Extended',
      'bingbot'
    ];

    const result = {
      robots: { url: `${urlObj.origin}/robots.txt`, allows: {}, exists: null },
      xRobotsTag: null,
      recommendations: [],
      score: 100
    };

    // robots.txt analysis
    try {
      const r = await fetchWithTimeout(result.robots.url, 8000);
      result.robots.exists = r.ok;
      if (r.ok) {
        const txt = await r.text();
        const lower = txt.toLowerCase();
        for (const bot of aiBots) {
          const botKey = bot.toLowerCase();
          const hasUserAgent = lower.includes(`user-agent: ${botKey}`);
          // Heuristic: if bot not specified, assume wildcard applies
          const wildcardDisallowAll = /user-agent:\s*\*([\s\S]*?)disallow:\s*\//i.test(lower) && !/allow:\s*\//i.test(lower);
          result.robots.allows[bot] = hasUserAgent ? !new RegExp(`user-agent:\\s*${botKey}[\\s\\S]*?disallow:\\s*/`, 'i').test(lower) : !wildcardDisallowAll;
        }
        if (!/sitemap:/i.test(txt)) {
          result.recommendations.push('Add Sitemap reference to robots.txt');
          result.score -= 5;
        }
      } else {
        result.recommendations.push('Add robots.txt allowing AI crawlers');
        result.score -= 10;
      }
    } catch (e) {
      result.recommendations.push('robots.txt not reachable');
      result.score -= 10;
    }

    // X-Robots-Tag from headers
    if (headersInfo && headersInfo.headers) {
      const xrt = headersInfo.headers['x-robots-tag'] || null;
      result.xRobotsTag = xrt;
      if (xrt && /(noai|noimageai|nosnippet)/i.test(xrt)) {
        result.recommendations.push('Remove restrictive X-Robots-Tag for AI (noai/noimageai/nosnippet)');
        result.score -= 10;
      }
    }

    // Meta robots on page
    try {
      const metaRobots = $('meta[name="robots"]').attr('content') || '';
      if (/noindex|nosnippet/i.test(metaRobots)) {
        result.recommendations.push('Avoid page-level noindex/nosnippet for AI discoverability');
        result.score -= 10;
      }
    } catch (_) {}

    // Clamp score
    if (result.score < 0) result.score = 0;
    return result;
  }
}

module.exports = SEOAnalyzer;