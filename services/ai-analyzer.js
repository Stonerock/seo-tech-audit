// services/ai-content-analyzer.js
// State-of-the-art multilingual AI content evaluation

const natural = require('natural');
const compromise = require('compromise');
const franc = require('franc');
const sentiment = require('sentiment');
const { removeStopwords, eng, fra, deu, spa, ita, jpn, kor, rus } = require('stopword');
const keyword = require('keyword-extractor');

class AIContentAnalyzer {
  constructor() {
    // Cache for performance optimization
    this.analysisCache = new Map();
    this.maxCacheSize = 1000;
    this.cacheHits = 0;
    this.cacheMisses = 0;
    
    // Language detection and processing
    this.supportedLanguages = new Set([
      'en', 'es', 'fr', 'de', 'it', 'pt', 'ru', 'ja', 'ko', 'zh', 
      'ar', 'hi', 'th', 'vi', 'tr', 'pl', 'nl', 'sv', 'no', 'da', 'fi'
    ]);
    
    // Language-specific stopword lists
    this.stopwordLists = {
      en: eng, fr: fra, de: deu, es: spa, it: ita, 
      ja: jpn, ko: kor, ru: rus
    };
    
    // Initialize sentiment analyzer
    this.sentimentAnalyzer = new sentiment();
    
    // Semantic indicators (language-agnostic patterns)
    this.semanticPatterns = {
      questionIndicators: [
        // English
        /\b(what|how|why|when|where|which|who)\s+/gi,
        // Spanish
        /\b(qué|cómo|por qué|cuándo|dónde|cuál|quién)\s+/gi,
        // German
        /\b(was|wie|warum|wann|wo|welch|wer)\s+/gi,
        // French
        /\b(que|comment|pourquoi|quand|où|quel|qui)\s+/gi,
        // Japanese
        /\b(何|どの|いつ|どこ|なぜ|どうして)/gi,
        // Russian
        /\b(что|как|почему|когда|где|какой|кто)\s+/gi
      ],
      definitionIndicators: [
        /\b(is|are|means|refers to|defined as|known as)\b/gi,
        /\b(es|son|significa|se refiere a|definido como)\b/gi,
        /\b(ist|sind|bedeutet|bezieht sich auf|definiert als)\b/gi,
        /\b(est|sont|signifie|se réfère à|défini comme)\b/gi,
        /\b(である|です|とは|を意味する)/gi
      ],
      citationIndicators: [
        /\b(according to|based on|research shows|studies indicate|source|study)\b/gi,
        /\b(según|basado en|la investigación muestra|los estudios indican)\b/gi,
        /\b(laut|basierend auf|forschung zeigt|studien zeigen)\b/gi,
        /\b(selon|basé sur|la recherche montre|les études indiquent)\b/gi
      ],
      emphasisIndicators: [
        /\b(important|significant|crucial|essential|key|critical)\b/gi,
        /\b(importante|significativo|crucial|esencial|clave|crítico)\b/gi,
        /\b(wichtig|bedeutend|entscheidend|wesentlich|kritisch)\b/gi,
        /\b(important|significatif|crucial|essentiel|clé|critique)\b/gi
      ]
    };
    
    // Technical term patterns
    this.technicalPatterns = {
      apis: /\b(api|rest|graphql|endpoint|webhook)\b/gi,
      programming: /\b(javascript|python|java|react|vue|angular|node)\b/gi,
      databases: /\b(sql|nosql|mongodb|postgresql|mysql|redis)\b/gi,
      cloud: /\b(aws|azure|gcp|docker|kubernetes|serverless)\b/gi,
      seo: /\b(seo|sem|serp|keywords|backlinks|meta tags)\b/gi
    };
  }

  /**
   * Analyze content readiness for AI systems with multilingual support and caching
   * @param {Object} $ - Cheerio DOM object
   * @param {Object} tests - Existing test results
   * @param {string} url - Page URL for context
   * @returns {Object} Comprehensive AI readiness analysis
   */
  async analyzeAIReadiness($, tests, url) {
    // Generate cache key
    const cacheKey = this.generateCacheKey($, tests, url);
    
    // Check cache first
    if (this.analysisCache.has(cacheKey)) {
      this.cacheHits++;
      const cached = this.analysisCache.get(cacheKey);
      // Add cache metadata
      cached.cached = true;
      cached.cacheAge = Date.now() - cached.timestamp;
      return cached;
    }
    
    this.cacheMisses++;
    
    // Perform analysis
    const result = await this.performAnalysis($, tests, url);
    
    // Cache management
    if (this.analysisCache.size >= this.maxCacheSize) {
      // Remove oldest entries (LRU-like behavior)
      const oldestKey = this.analysisCache.keys().next().value;
      this.analysisCache.delete(oldestKey);
    }
    
    // Add to cache with timestamp
    result.timestamp = Date.now();
    result.cached = false;
    this.analysisCache.set(cacheKey, { ...result });
    
    return result;
  }
  
  /**
   * Generate cache key based on content and configuration
   */
  generateCacheKey($, tests, url) {
    const content = this.extractContent($);
    
    // Create a hash from key content elements
    const keyElements = [
      content.text.substring(0, 500), // First 500 chars of text
      content.headings.map(h => h.text).join('|'),
      JSON.stringify(tests.schema?.types || []),
      url || 'unknown'
    ].join('::');
    
    // Simple hash function (for demo - consider using crypto.createHash in production)
    let hash = 0;
    for (let i = 0; i < keyElements.length; i++) {
      const char = keyElements.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    
    return `ai_analysis_${Math.abs(hash).toString(36)}`;
  }
  
  /**
   * Perform the actual analysis (extracted from main method for caching)
   */
  async performAnalysis($, tests, url) {
    const content = this.extractContent($);
    const language = await this.detectLanguage(content.text);
    
    const analysis = {
      overallScore: 0,
      language: language,
      confidence: 0,
      subMetrics: {
        answerClarity: await this.analyzeAnswerClarity(content, language),
        structuredData: this.analyzeStructuredData(tests.schema, content),
        extractableFacts: await this.analyzeExtractableFacts(content, language),
        citations: await this.analyzeCitations(content, $, language),
        recency: this.analyzeRecency(content, tests, language),
        technical: this.analyzeTechnical(tests, url)
      },
      insights: {
        contentType: await this.detectContentType(content, language.language, $),
        entities: await this.extractEntities(content.text, language.language),
        readabilityScore: await this.calculateReadability(content.text, language.language),
        semanticStructure: await this.analyzeSemanticStructure(content, language)
      },
      recommendations: []
    };

    // Calculate weighted overall score
    const weights = {
      answerClarity: 25,
      structuredData: 20,
      extractableFacts: 20,
      citations: 15,
      recency: 10,
      technical: 10
    };

    analysis.overallScore = Math.round(
      Object.entries(weights).reduce((total, [metric, weight]) => {
        return total + (analysis.subMetrics[metric].score * weight / 100);
      }, 0)
    );

    analysis.grade = this.calculateGrade(analysis.overallScore);
    analysis.recommendations = this.generateRecommendations(analysis, language);

    return analysis;
  }
  
  /**
   * Get cache statistics for monitoring
   */
  getCacheStats() {
    const hitRate = this.cacheHits / (this.cacheHits + this.cacheMisses) * 100;
    return {
      size: this.analysisCache.size,
      maxSize: this.maxCacheSize,
      hits: this.cacheHits,
      misses: this.cacheMisses,
      hitRate: Math.round(hitRate * 100) / 100,
      usage: Math.round((this.analysisCache.size / this.maxCacheSize) * 100)
    };
  }
  
  /**
   * Clear cache (useful for testing or memory management)
   */
  clearCache() {
    this.analysisCache.clear();
    this.cacheHits = 0;
    this.cacheMisses = 0;
  }

  /**
   * Extract structured content from DOM
   */
  extractContent($) {
    return {
      text: $('body').text().replace(/\s+/g, ' ').trim(),
      headings: this.extractHeadings($),
      paragraphs: this.extractParagraphs($),
      lists: this.extractLists($),
      tables: this.extractTables($),
      links: this.extractLinks($),
      images: this.extractImages($)
    };
  }

  /**
   * Language-agnostic language detection using multiple signals
   */
  async detectLanguage(text) {
    // Primary: HTML lang attribute (already handled in original code)
    // Secondary: Statistical analysis of character patterns
    // Tertiary: Common word detection
    
    const detectionMethods = [
      this.detectByCharacterFrequency(text),
      this.detectByCommonWords(text),
      this.detectByUnicodeRanges(text)
    ];

    // Combine results with confidence scoring
    const languageCandidates = {};
    detectionMethods.forEach(result => {
      if (result.language && result.confidence > 0.3) {
        languageCandidates[result.language] = 
          (languageCandidates[result.language] || 0) + result.confidence;
      }
    });

    const bestMatch = Object.entries(languageCandidates)
      .sort(([,a], [,b]) => b - a)[0];

    return {
      language: bestMatch ? bestMatch[0] : 'en',
      confidence: bestMatch ? Math.min(bestMatch[1], 1.0) : 0.5,
      detectedMethods: detectionMethods.length
    };
  }

  /**
   * Advanced answer clarity analysis using NLP
   */
  async analyzeAnswerClarity(content, languageInfo) {
    const score = {
      score: 0,
      details: {},
      issues: [],
      strengths: []
    };

    // 1. Heading structure analysis
    const headingQuality = this.analyzeHeadingStructure(content.headings);
    score.details.headingStructure = headingQuality;
    score.score += headingQuality.score * 0.3;

    // 2. Question-answer pattern detection (language-agnostic)
    const qaPatterns = this.detectQAPatterns(content, languageInfo.language);
    score.details.qaPatterns = qaPatterns;
    score.score += qaPatterns.score * 0.3;

    // 3. Content clarity and directness
    const clarityAnalysis = await this.analyzeContentClarity(content, languageInfo.language);
    score.details.clarity = clarityAnalysis;
    score.score += clarityAnalysis.score * 0.4;

    // Generate specific recommendations
    if (headingQuality.score < 60) {
      score.issues.push(`Improve heading hierarchy (${headingQuality.issues.join(', ')})`);
    }
    if (qaPatterns.score < 60) {
      score.issues.push('Add more question-answer patterns for AI Overview optimization');
    }
    if (clarityAnalysis.score < 60) {
      score.issues.push('Improve content clarity and directness');
    }

    return score;
  }

  /**
   * Language-agnostic content type detection with schema.org integration
   */
  async detectContentType(content, language, $ = null) {
    // First priority: Extract from schema.org markup if available
    if ($) {
      const schemaType = this.extractSchemaType($);
      if (schemaType) {
        return {
          type: this.mapSchemaToContentType(schemaType),
          confidence: 0.95,
          source: 'schema_markup',
          schemaType: schemaType
        };
      }
    }

    // Second priority: URL-based detection
    const urlType = this.detectTypeFromUrl(content.url || '');
    if (urlType.confidence > 0.7) {
      return urlType;
    }

    // Third priority: Content-based detection with enhanced scoring
    const indicators = {
      article: {
        patterns: [/article|blog|post|news|story|editorial/gi],
        signals: ['byline', 'publication date', 'author bio', 'reading time'],
        weights: { patterns: 0.4, signals: 0.6 }
      },
      product: {
        patterns: [/price|buy|purchase|product|item|shop|cart|order/gi],
        signals: ['pricing', 'specifications', 'reviews', 'add to cart', 'stock'],
        weights: { patterns: 0.5, signals: 0.5 }
      },
      faq: {
        patterns: [/faq|question|answer|q&a|frequently asked/gi],
        signals: ['question headings', 'accordion structure', 'expandable sections'],
        weights: { patterns: 0.6, signals: 0.4 }
      },
      guide: {
        patterns: [/guide|tutorial|how.?to|step|instructions|manual/gi],
        signals: ['numbered lists', 'sequential content', 'step indicators'],
        weights: { patterns: 0.5, signals: 0.5 }
      },
      service: {
        patterns: [/service|consultation|contact|booking|appointment/gi],
        signals: ['contact forms', 'pricing tables', 'testimonials'],
        weights: { patterns: 0.4, signals: 0.6 }
      },
      landing: {
        patterns: [/landing|campaign|offer|deal|promotion|limited/gi],
        signals: ['call to action', 'forms', 'conversion elements'],
        weights: { patterns: 0.3, signals: 0.7 }
      }
    };

    const scores = {};
    const maxPossibleScore = 100;
    
    for (const [type, config] of Object.entries(indicators)) {
      let patternScore = 0;
      let signalScore = 0;
      
      // Enhanced pattern matching with context
      config.patterns.forEach(pattern => {
        const matches = (content.text.match(pattern) || []).length;
        const density = matches / (content.text.split(' ').length / 100); // Matches per 100 words
        patternScore += Math.min(density * 15, 50); // Cap at 50 points
      });
      
      // Enhanced structural signals
      signalScore = this.detectStructuralSignals(content, config.signals);
      
      // Weighted combination
      const totalScore = 
        (patternScore * config.weights.patterns) + 
        (signalScore * config.weights.signals);
      
      scores[type] = Math.min(totalScore, maxPossibleScore);
    }

    // Get the highest scoring type
    const detectedType = Object.entries(scores)
      .sort(([,a], [,b]) => b - a)[0];

    // Enhanced confidence calculation
    const topScore = detectedType[1];
    const secondBest = Object.values(scores)
      .sort((a, b) => b - a)[1] || 0;
    
    // Confidence based on score difference and absolute score
    let confidence = (topScore / 100) * 0.7; // Base confidence from score
    const scoreDifference = topScore - secondBest;
    confidence += (scoreDifference / 100) * 0.3; // Bonus for clear winner
    
    // Minimum confidence threshold
    if (topScore < 20) {
      confidence = Math.max(confidence, 0.1);
    }

    return {
      type: detectedType[0],
      confidence: Math.min(confidence, 0.95),
      source: 'content_analysis',
      allScores: scores,
      reasoning: this.explainContentTypeDetection(detectedType[0], topScore, content)
    };
  }

  /**
   * Extract schema.org type from JSON-LD
   */
  extractSchemaType($) {
    let schemaType = null;
    
    $('script[type="application/ld+json"]').each((i, elem) => {
      try {
        // Use text() to properly decode entities
        const raw = ($(elem).text() || '').trim();
        if (!raw) return;

        // Clean comments and CDATA wrappers
        let cleaned = raw
          .replace(/<!--[\s\S]*?-->/g, '')
          .replace(/\/\*<!\[CDATA\[\*\//g, '')
          .replace(/\/\*\]\]>\*\//g, '')
          .trim();

        let parsed = null;
        try {
          parsed = JSON.parse(cleaned);
        } catch (_) {
          const noTrailingCommas = cleaned.replace(/,\s*([}\]])/g, '$1');
          try {
            parsed = JSON.parse(noTrailingCommas);
          } catch (_) {
            const asArray = `[${noTrailingCommas.replace(/}\s*{/, '},{')}]`;
            parsed = JSON.parse(asArray);
          }
        }

        const extractType = (obj) => {
          if (obj && obj['@type']) {
            const type = Array.isArray(obj['@type']) ? obj['@type'][0] : obj['@type'];
            if (!schemaType) schemaType = type; // Take first valid type
          }
          if (obj && obj['@graph']) {
            obj['@graph'].forEach(extractType);
          }
        };
        
        if (Array.isArray(parsed)) {
          parsed.forEach(extractType);
        } else {
          extractType(parsed);
        }
      } catch (e) {
        // Invalid JSON-LD, continue
      }
    });
    
    return schemaType;
  }

  /**
   * Map schema.org types to content types
   */
  mapSchemaToContentType(schemaType) {
    const mapping = {
      'Article': 'article',
      'BlogPosting': 'article',
      'NewsArticle': 'article',
      'Product': 'product',
      'FAQPage': 'faq',
      'QAPage': 'faq',
      'HowTo': 'guide',
      'Recipe': 'guide',
      'Service': 'service',
      'Organization': 'service',
      'WebPage': 'landing',
      'WebSite': 'landing'
    };
    
    return mapping[schemaType] || 'webpage';
  }

  /**
   * Detect content type from URL patterns
   */
  detectTypeFromUrl(url) {
    if (!url) return { type: 'unknown', confidence: 0 };
    
    const urlLower = url.toLowerCase();
    const pathSegments = urlLower.split('/').filter(Boolean);
    
    const urlPatterns = {
      article: {
        patterns: [/\/blog\//i, /\/article\//i, /\/news\//i, /\/post\//i],
        confidence: 0.8
      },
      product: {
        patterns: [/\/product\//i, /\/item\//i, /\/shop\//i, /\/store\//i],
        confidence: 0.85
      },
      faq: {
        patterns: [/\/faq/i, /\/help/i, /\/support/i, /\/questions/i],
        confidence: 0.9
      },
      guide: {
        patterns: [/\/guide/i, /\/tutorial/i, /\/how-to/i, /\/manual/i],
        confidence: 0.85
      },
      service: {
        patterns: [/\/service/i, /\/contact/i, /\/about/i],
        confidence: 0.7
      }
    };
    
    for (const [type, config] of Object.entries(urlPatterns)) {
      if (config.patterns.some(pattern => pattern.test(url))) {
        return {
          type,
          confidence: config.confidence,
          source: 'url_pattern'
        };
      }
    }
    
    return { type: 'webpage', confidence: 0.3, source: 'default' };
  }

  /**
   * Explain content type detection reasoning
   */
  explainContentTypeDetection(type, score, content) {
    const reasons = [];
    
    if (score > 70) {
      reasons.push(`Strong ${type} indicators found`);
    } else if (score > 40) {
      reasons.push(`Moderate ${type} characteristics detected`);
    } else {
      reasons.push(`Weak ${type} signals, low confidence`);
    }
    
    if (content.headings.length > 5) {
      reasons.push('Well-structured heading hierarchy');
    }
    
    if (content.lists.items > 10) {
      reasons.push('Rich list content');
    }
    
    return reasons;
  }

  /**
   * Advanced entity extraction using multiple techniques
   */
  async extractEntities(text, language) {
    const entities = {
      persons: [],
      organizations: [],
      locations: [],
      dates: [],
      technical: [],
      topics: []
    };

    // 1. Named Entity Recognition using compromise.js for English
    if (language === 'en') {
      try {
        const doc = compromise(text);
        entities.persons = doc.people().out('array');
        entities.organizations = doc.organizations().out('array');
        entities.locations = doc.places().out('array');
        // Note: dates() method may not be available in all compromise versions
        entities.dates = doc.match('#Date').out('array');
      } catch (e) {
        // Fallback if compromise methods fail
        console.warn('Compromise.js entity extraction failed:', e.message);
      }
    }

    // 2. Pattern-based extraction for all languages
    entities.technical = this.extractTechnicalTerms(text);
    entities.topics = await this.extractTopics(text, language);

    // 3. Capitalized entity extraction (works across languages)
    const capitalizedEntities = this.extractCapitalizedEntities(text);
    entities.general = capitalizedEntities;

    return entities;
  }

  /**
   * Generate language-specific recommendations
   */
  generateRecommendations(analysis, languageInfo) {
    const recommendations = new Map(); // Use Map to prevent duplicates with better control
    const lang = languageInfo.language;

    // Language-specific recommendation templates
    const templates = {
      en: {
        answerClarity: 'Improve content clarity by adding clear headings and direct answers',
        structuredData: 'Enhance structured data with schema.org markup',
        extractableFacts: 'Add more extractable facts and data points',
        citations: 'Include more authoritative sources and citations',
        recency: 'Update content with recent information and dates',
        technical: 'Improve technical optimization (HTTPS, performance, robots.txt)'
      },
      es: {
        answerClarity: 'Mejorar la claridad del contenido añadiendo encabezados claros y respuestas directas',
        structuredData: 'Mejorar datos estructurados con marcado schema.org',
        extractableFacts: 'Añadir más datos extraíbles y puntos de información',
        citations: 'Incluir más fuentes autorizadas y citas',
        recency: 'Actualizar contenido con información reciente',
        technical: 'Mejorar optimización técnica (HTTPS, rendimiento, robots.txt)'
      },
      de: {
        answerClarity: 'Inhaltsklarheit durch klare Überschriften und direkte Antworten verbessern',
        structuredData: 'Strukturierte Daten mit schema.org Markup erweitern',
        extractableFacts: 'Mehr extrahierbare Fakten und Datenpunkte hinzufügen',
        citations: 'Mehr autoritative Quellen und Zitate einbeziehen',
        recency: 'Inhalte mit aktuellen Informationen und Daten aktualisieren',
        technical: 'Technische Optimierung verbessern (HTTPS, Performance, robots.txt)'
      },
      // Add more languages as needed
      default: {
        answerClarity: 'Improve content structure and clarity',
        structuredData: 'Add structured data markup',
        extractableFacts: 'Include more factual content',
        citations: 'Add authoritative sources',
        recency: 'Update content regularly',
        technical: 'Improve technical SEO'
      }
    };

    const langTemplates = templates[lang] || templates.default;

    // Generate recommendations based on sub-metric scores
    Object.entries(analysis.subMetrics).forEach(([metric, data]) => {
      if (data.score < 70 && !recommendations.has(metric)) {
        const template = langTemplates[metric] || langTemplates.answerClarity;
        recommendations.set(metric, {
          type: metric,
          message: template,
          priority: data.score < 40 ? 'high' : data.score < 60 ? 'medium' : 'low',
          specifics: data.issues || [],
          score: data.score
        });
      }
    });

    // Add specific recommendations from sub-metrics
    Object.entries(analysis.subMetrics).forEach(([metric, data]) => {
      if (data.issues && data.issues.length > 0) {
        data.issues.forEach((issue, index) => {
          const issueKey = `${metric}_issue_${index}`;
          if (!recommendations.has(issueKey)) {
            recommendations.set(issueKey, {
              type: metric,
              message: issue,
              priority: 'low',
              specifics: [],
              score: data.score
            });
          }
        });
      }
    });

    // Convert to array and sort by priority and score
    const result = Array.from(recommendations.values())
      .sort((a, b) => {
        const priorityOrder = { high: 3, medium: 2, low: 1 };
        if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
          return priorityOrder[b.priority] - priorityOrder[a.priority];
        }
        return a.score - b.score; // Lower scores first
      })
      .slice(0, 10); // Limit to top 10 recommendations

    return result;
  }

  // Helper methods for specific analysis tasks
  extractHeadings($) {
    const headings = [];
    $('h1, h2, h3, h4, h5, h6').each((i, el) => {
      headings.push({
        level: parseInt(el.tagName.slice(1)),
        text: $(el).text().trim(),
        id: $(el).attr('id') || null
      });
    });
    return headings;
  }

  extractParagraphs($) {
    return $('p').map((i, el) => $(el).text().trim()).get()
      .filter(text => text.length > 20);
  }

  extractLists($) {
    return {
      ordered: $('ol').length,
      unordered: $('ul').length,
      items: $('li').length
    };
  }

  extractTables($) {
    return $('table').map((i, table) => ({
      rows: $(table).find('tr').length,
      headers: $(table).find('th').length,
      caption: $(table).find('caption').text() || null
    })).get();
  }

  extractLinks($) {
    const internal = [];
    const external = [];
    
    $('a[href]').each((i, el) => {
      const href = $(el).attr('href');
      const text = $(el).text().trim();
      const isExternal = href.startsWith('http');
      
      (isExternal ? external : internal).push({
        href,
        text,
        rel: $(el).attr('rel') || null
      });
    });

    return { internal, external };
  }

  extractImages($) {
    return $('img').map((i, img) => ({
      src: $(img).attr('src'),
      alt: $(img).attr('alt') || null,
      hasAlt: Boolean($(img).attr('alt'))
    })).get();
  }

  /**
   * Analyze structured data quality
   */
  analyzeStructuredData(schemaTests, content) {
    const analysis = {
      score: 0,
      details: {},
      issues: [],
      strengths: []
    };

    if (!schemaTests) {
      analysis.issues.push('No schema data available');
      return analysis;
    }

    // Check schema presence and types
    const types = schemaTests.types?.length || 0;
    const issues = (schemaTests.requiredIssues || []).length;
    
    let baseScore = Math.min(100, types * 15);
    baseScore -= Math.min(40, issues * 10);
    analysis.score = Math.max(0, baseScore);

    if (types > 0) {
      analysis.strengths.push(`Found ${types} schema type(s)`);
    } else {
      analysis.issues.push('No structured data markup found');
    }

    if (issues > 0) {
      analysis.issues.push(`${issues} schema validation issue(s)`);
    }

    return analysis;
  }

  /**
   * Analyze extractable facts from content
   */
  async analyzeExtractableFacts(content, languageInfo) {
    const analysis = {
      score: 0,
      details: {},
      issues: [],
      strengths: []
    };

    let score = 0;

    // Check for structured content
    if (content.lists.items > 3) {
      score += 25;
      analysis.strengths.push('Good use of lists for facts');
    }

    if (content.tables.length > 0) {
      score += 30;
      analysis.strengths.push('Contains data tables');
    }

    // Check for numerical data
    const numbers = content.text.match(/\d+[\d,.]*/g) || [];
    if (numbers.length > 5) {
      score += 20;
      analysis.strengths.push('Contains numerical data');
    }

    // Definition patterns
    const definitions = this.semanticPatterns.definitionIndicators.reduce((count, pattern) => {
      return count + (content.text.match(pattern) || []).length;
    }, 0);

    if (definitions > 0) {
      score += 25;
      analysis.strengths.push('Contains clear definitions');
    } else {
      analysis.issues.push('Few extractable definitions found');
    }

    analysis.score = Math.min(100, score);
    return analysis;
  }

  /**
   * Analyze citations and sources
   */
  async analyzeCitations(content, $, languageInfo) {
    const analysis = {
      score: 0,
      details: {},
      issues: [],
      strengths: []
    };

    let score = 0;

    // External links analysis
    const externalLinks = content.links.external.length;
    if (externalLinks > 3) {
      score += 40;
      analysis.strengths.push(`${externalLinks} external references`);
    } else if (externalLinks > 0) {
      score += 20;
      analysis.issues.push('Limited external sources');
    } else {
      analysis.issues.push('No external citations found');
    }

    // Citation indicators in text
    const citationCount = this.semanticPatterns.citationIndicators.reduce((count, pattern) => {
      return count + (content.text.match(pattern) || []).length;
    }, 0);

    if (citationCount > 2) {
      score += 30;
      analysis.strengths.push('Good citation language usage');
    }

    // Authority indicators
    const authorityTerms = ['study', 'research', 'university', 'professor', 'expert', 'official'];
    const authorityCount = authorityTerms.reduce((count, term) => {
      return count + (content.text.toLowerCase().match(new RegExp(`\\b${term}\\b`, 'g')) || []).length;
    }, 0);

    if (authorityCount > 1) {
      score += 30;
      analysis.strengths.push('Contains authority references');
    }

    analysis.score = Math.min(100, score);
    return analysis;
  }

  /**
   * Analyze content recency
   */
  analyzeRecency(content, tests, languageInfo) {
    const analysis = {
      score: 0,
      details: {},
      issues: [],
      strengths: []
    };

    let score = 0;

    // Date patterns in content
    const currentYear = new Date().getFullYear();
    const recentYears = [currentYear, currentYear - 1, currentYear - 2];
    
    const dateMatches = content.text.match(/202[0-9]/g) || [];
    const recentDates = dateMatches.filter(year => recentYears.includes(parseInt(year)));
    
    if (recentDates.length > 0) {
      score += 50;
      analysis.strengths.push('Contains recent dates');
    } else {
      analysis.issues.push('No recent date indicators found');
    }

    // Schema date information
    if (tests.schema && tests.schema.schemas) {
      const hasDatePublished = JSON.stringify(tests.schema.schemas).includes('datePublished');
      if (hasDatePublished) {
        score += 30;
        analysis.strengths.push('Schema includes publication date');
      }
    }

    // Update language indicators
    const updateTerms = {
      en: ['updated', 'revised', 'last modified'],
      es: ['actualizado', 'revisado', 'última modificación'],
      de: ['aktualisiert', 'überarbeitet', 'zuletzt geändert']
    };

    const lang = languageInfo.language || 'en';
    const terms = updateTerms[lang] || updateTerms.en;
    
    const hasUpdateLanguage = terms.some(term => 
      content.text.toLowerCase().includes(term)
    );

    if (hasUpdateLanguage) {
      score += 20;
      analysis.strengths.push('Mentions content updates');
    }

    analysis.score = Math.min(100, score);
    return analysis;
  }

  /**
   * Analyze technical optimization
   */
  analyzeTechnical(tests, url) {
    const analysis = {
      score: 0,
      details: {},
      issues: [],
      strengths: []
    };

    let score = 0;

    // HTTPS check
    if (tests.seo?.https) {
      score += 25;
      analysis.strengths.push('HTTPS enabled');
    } else {
      analysis.issues.push('HTTPS not detected');
    }

    // Robots.txt
    if (tests.files?.robots?.exists) {
      score += 20;
      analysis.strengths.push('Robots.txt found');
    } else {
      analysis.issues.push('Robots.txt missing');
    }

    // Sitemap
    if (tests.files?.sitemap?.exists) {
      score += 20;
      analysis.strengths.push('Sitemap available');
    } else {
      analysis.issues.push('Sitemap not found');
    }

    // Performance indicators
    if (tests.performance?.score) {
      const perf = tests.performance.score;
      if (perf.fcp !== 'poor' && perf.loadTime !== 'poor') {
        score += 25;
        analysis.strengths.push('Good performance metrics');
      } else {
        analysis.issues.push('Performance optimization needed');
      }
    }

    // CDN usage
    if (tests.headers?.cdn) {
      score += 10;
      analysis.strengths.push(`CDN detected: ${tests.headers.cdn}`);
    }

    analysis.score = Math.min(100, score);
    return analysis;
  }
  
  /**
   * Detect language using multiple statistical methods
   */
  detectByCharacterFrequency(text) {
    try {
      const detected = franc(text);
      const langMap = {
        'eng': 'en', 'spa': 'es', 'fra': 'fr', 'deu': 'de', 'ita': 'it',
        'por': 'pt', 'rus': 'ru', 'jpn': 'ja', 'kor': 'ko', 'cmn': 'zh'
      };
      
      return {
        language: langMap[detected] || 'en',
        confidence: detected !== 'und' ? 0.8 : 0.2,
        method: 'character_frequency'
      };
    } catch (e) {
      return { language: 'en', confidence: 0.1, method: 'fallback' };
    }
  }

  /**
   * Detect language by common words patterns
   */
  detectByCommonWords(text) {
    const commonWords = {
      en: ['the', 'and', 'is', 'in', 'to', 'of', 'a', 'that', 'it', 'for'],
      es: ['el', 'la', 'de', 'que', 'y', 'a', 'en', 'un', 'es', 'se'],
      fr: ['le', 'de', 'et', 'à', 'un', 'il', 'être', 'et', 'que', 'avoir'],
      de: ['der', 'die', 'und', 'in', 'den', 'von', 'zu', 'das', 'mit', 'sich'],
      ja: ['の', 'に', 'は', 'を', 'た', 'が', 'で', 'て', 'と', 'し'],
      ru: ['в', 'и', 'не', 'на', 'я', 'быть', 'он', 'с', 'а', 'как']
    };

    const words = text.toLowerCase().split(/\s+/).slice(0, 100);
    const scores = {};

    for (const [lang, wordList] of Object.entries(commonWords)) {
      scores[lang] = wordList.filter(word => words.includes(word)).length;
    }

    const maxScore = Math.max(...Object.values(scores));
    const detectedLang = Object.entries(scores)
      .find(([, score]) => score === maxScore)?.[0] || 'en';

    return {
      language: detectedLang,
      confidence: maxScore > 3 ? 0.7 : 0.3,
      method: 'common_words'
    };
  }

  /**
   * Detect language by Unicode character ranges
   */
  detectByUnicodeRanges(text) {
    const unicodeRanges = {
      ja: /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/,
      ko: /[\uAC00-\uD7AF\u1100-\u11FF\u3130-\u318F]/,
      zh: /[\u4E00-\u9FFF]/,
      ar: /[\u0600-\u06FF]/,
      ru: /[\u0400-\u04FF]/,
      th: /[\u0E00-\u0E7F]/
    };

    for (const [lang, pattern] of Object.entries(unicodeRanges)) {
      if (pattern.test(text)) {
        const matches = (text.match(new RegExp(pattern.source, 'g')) || []).length;
        const confidence = Math.min(matches / text.length * 10, 0.9);
        return { language: lang, confidence, method: 'unicode_ranges' };
      }
    }

    return { language: 'en', confidence: 0.1, method: 'unicode_fallback' };
  }

  /**
   * Analyze heading structure for AI readability with detailed hierarchy analysis
   */
  analyzeHeadingStructure(headings) {
    const analysis = {
      score: 0,
      issues: [],
      strengths: [],
      details: {
        hasH1: false,
        h1Count: 0,
        hierarchyValid: true,
        hierarchyIssues: [],
        questionCount: 0,
        averageLength: 0,
        levelDistribution: { h1: 0, h2: 0, h3: 0, h4: 0, h5: 0, h6: 0 },
        nestingDepth: 0,
        orphanedHeadings: [],
        skippedLevels: [],
        emptyHeadings: 0,
        duplicateHeadings: []
      }
    };

    if (headings.length === 0) {
      analysis.issues.push('No headings found - add structured headings for better AI parsing');
      return analysis;
    }

    // Count headings by level and detect distribution issues
    headings.forEach(h => {
      analysis.details.levelDistribution[`h${h.level}`]++;
    });

    // H1 Analysis (multiple H1s are acceptable but should be strategic)
    analysis.details.h1Count = analysis.details.levelDistribution.h1;
    analysis.details.hasH1 = analysis.details.h1Count > 0;
    
    if (analysis.details.h1Count === 0) {
      analysis.issues.push('Missing H1 tag - add primary heading for content hierarchy');
      analysis.score -= 15;
    } else if (analysis.details.h1Count === 1) {
      analysis.score += 20;
      analysis.strengths.push('Single H1 provides clear document structure');
    } else if (analysis.details.h1Count <= 3) {
      analysis.score += 15;
      analysis.strengths.push(`${analysis.details.h1Count} H1s - acceptable for sectioned content`);
    } else {
      analysis.issues.push(`${analysis.details.h1Count} H1 tags - consider reducing for cleaner hierarchy`);
      analysis.score -= 5;
    }

    // Detailed hierarchy validation with specific issue detection
    let currentMaxLevel = 0;
    const hierarchyPath = [];
    analysis.details.nestingDepth = Math.max(...headings.map(h => h.level));
    
    for (let i = 0; i < headings.length; i++) {
      const heading = headings[i];
      const level = heading.level;
      
      // Check for empty headings
      if (!heading.text || heading.text.trim().length === 0) {
        analysis.details.emptyHeadings++;
        continue;
      }
      
      // Check for level skipping
      if (level > currentMaxLevel + 1 && currentMaxLevel > 0) {
        const skipped = `H${currentMaxLevel + 1} to H${level}`;
        if (!analysis.details.skippedLevels.includes(skipped)) {
          analysis.details.skippedLevels.push(skipped);
          analysis.details.hierarchyIssues.push(`Skipped heading level: ${skipped} at "${heading.text.substring(0, 40)}..."`);
        }
        analysis.details.hierarchyValid = false;
      }
      
      // Update hierarchy tracking
      currentMaxLevel = Math.max(currentMaxLevel, level);
      hierarchyPath.push({ level, text: heading.text, index: i });
      
      // Check for orphaned deep headings (H4+ without proper parent structure)
      if (level >= 4) {
        const hasProperParent = hierarchyPath.slice(0, -1).some(h => h.level === level - 1);
        if (!hasProperParent) {
          analysis.details.orphanedHeadings.push({
            heading: heading.text.substring(0, 40),
            level: `H${level}`,
            position: i + 1
          });
        }
      }
    }

    // Check for duplicate headings (can confuse AI systems)
    const headingTexts = headings.map(h => h.text.toLowerCase().trim());
    const duplicates = headingTexts.filter((text, index) => 
      text.length > 0 && headingTexts.indexOf(text) !== index
    );
    analysis.details.duplicateHeadings = [...new Set(duplicates)];

    // Empty headings penalty
    if (analysis.details.emptyHeadings > 0) {
      analysis.issues.push(`${analysis.details.emptyHeadings} empty heading(s) found`);
      analysis.score -= analysis.details.emptyHeadings * 5;
    }

    // Hierarchy scoring
    if (analysis.details.hierarchyValid && analysis.details.skippedLevels.length === 0) {
      analysis.score += 25;
      analysis.strengths.push('Perfect heading hierarchy structure');
    } else if (analysis.details.skippedLevels.length <= 2) {
      analysis.score += 15;
      analysis.issues.push(`Minor hierarchy issues: ${analysis.details.skippedLevels.join(', ')}`);
    } else {
      analysis.score += 5;
      analysis.issues.push(`Multiple hierarchy violations (${analysis.details.skippedLevels.length})`);
    }

    // Orphaned headings penalty
    if (analysis.details.orphanedHeadings.length > 0) {
      analysis.issues.push(`${analysis.details.orphanedHeadings.length} orphaned deep heading(s) - ensure proper nesting`);
      analysis.score -= analysis.details.orphanedHeadings.length * 3;
    }

    // Duplicate headings penalty
    if (analysis.details.duplicateHeadings.length > 0) {
      analysis.issues.push(`${analysis.details.duplicateHeadings.length} duplicate heading(s) - may confuse AI systems`);
      analysis.score -= analysis.details.duplicateHeadings.length * 2;
    }

    // Nesting depth analysis
    if (analysis.details.nestingDepth <= 3) {
      analysis.score += 10;
      analysis.strengths.push('Appropriate heading depth (≤3 levels)');
    } else if (analysis.details.nestingDepth <= 4) {
      analysis.score += 5;
      analysis.strengths.push('Manageable heading depth (4 levels)');
    } else {
      analysis.issues.push(`Deep nesting (${analysis.details.nestingDepth} levels) - consider flattening structure`);
    }

    // Check for question-based headings (enhanced)
    const questionHeadings = headings.filter(h => 
      this.semanticPatterns.questionIndicators.some(pattern => 
        pattern.test(h.text)
      )
    );
    
    analysis.details.questionCount = questionHeadings.length;
    if (questionHeadings.length > 0) {
      analysis.score += 20;
      analysis.strengths.push(`${questionHeadings.length} question-based headings for AI Overviews`);
    } else if (headings.length > 3) {
      analysis.issues.push('Consider adding question-based headings for better AI Overview optimization');
    }

    // Check heading length distribution (enhanced)
    const lengths = headings.map(h => h.text.length).filter(len => len > 0);
    if (lengths.length > 0) {
      analysis.details.averageLength = Math.round(lengths.reduce((a, b) => a + b, 0) / lengths.length);
      
      const tooShort = lengths.filter(len => len < 10).length;
      const tooLong = lengths.filter(len => len > 100).length;
      const optimal = lengths.filter(len => len >= 20 && len <= 70).length;
      
      if (optimal / lengths.length > 0.8) {
        analysis.score += 15;
        analysis.strengths.push('Optimal heading lengths for AI processing');
      } else {
        if (tooShort > 0) analysis.issues.push(`${tooShort} headings too short (<10 chars)`);
        if (tooLong > 0) analysis.issues.push(`${tooLong} headings too long (>100 chars)`);
      }
    }

    // Content distribution analysis
    const totalLevels = Object.values(analysis.details.levelDistribution).filter(count => count > 0).length;
    if (totalLevels >= 3) {
      analysis.score += 10;
      analysis.strengths.push(`Good level variety (${totalLevels} different heading levels)`);
    }

    // Check for semantic heading patterns
    const semanticPatterns = [
      /\b(introduction|overview|summary|conclusion)\b/gi,
      /\b(benefits|advantages|features|steps|process)\b/gi,
      /\b(examples|case studies|comparison|analysis)\b/gi
    ];
    
    const semanticHeadings = headings.filter(h =>
      semanticPatterns.some(pattern => pattern.test(h.text))
    ).length;

    if (semanticHeadings > 0) {
      analysis.score += 10;
      analysis.strengths.push('Contains semantic heading patterns');
    }

    // Final score clamping and bonus for comprehensive structure
    analysis.score = Math.max(0, Math.min(100, analysis.score));
    
    // Bonus for comprehensive, well-structured content
    if (analysis.score > 75 && headings.length >= 5 && analysis.details.nestingDepth >= 2) {
      analysis.score += 5;
      analysis.strengths.push('Comprehensive content structure ideal for AI systems');
    }

    return analysis;
  }

  /**
   * Detect Q&A patterns in content
   */
  detectQAPatterns(content, language) {
    const analysis = {
      score: 0,
      patterns: [],
      details: {
        explicitQA: 0,
        implicitQA: 0,
        faqStructure: false
      }
    };

    const text = content.text.toLowerCase();
    
    // Explicit Q&A patterns
    const qaPatterns = [
      /q:\s*(.+?)\s*a:/gi,
      /question:\s*(.+?)\s*answer:/gi,
      /\?\s*(.{10,200})\./gi
    ];

    qaPatterns.forEach(pattern => {
      const matches = text.match(pattern) || [];
      analysis.details.explicitQA += matches.length;
    });

    // Question indicators in headings
    const questionHeadings = content.headings.filter(h => 
      this.semanticPatterns.questionIndicators.some(pattern => 
        pattern.test(h.text.toLowerCase())
      )
    );

    analysis.details.implicitQA = questionHeadings.length;

    // FAQ structure detection
    const faqIndicators = ['faq', 'frequently asked', 'common questions'];
    analysis.details.faqStructure = faqIndicators.some(indicator => 
      text.includes(indicator)
    );

    // Scoring
    if (analysis.details.explicitQA > 0) analysis.score += 40;
    if (analysis.details.implicitQA > 2) analysis.score += 30;
    if (analysis.details.faqStructure) analysis.score += 30;

    return analysis;
  }

  /**
   * Analyze content clarity using multiple metrics
   */
  async analyzeContentClarity(contentParam, language) {
    const analysis = {
      score: 0,
      metrics: {},
      issues: [],
      strengths: []
    };

    // Sentence length analysis
    const sentences = contentParam.text.split(/[.!?]+/).filter(s => s.trim().length > 5);
    const avgSentenceLength = sentences.reduce((acc, s) => acc + s.split(' ').length, 0) / sentences.length;
    
    analysis.metrics.avgSentenceLength = avgSentenceLength;
    
    if (avgSentenceLength < 25) {
      analysis.score += 30;
      analysis.strengths.push('Good sentence length for AI parsing');
    } else if (avgSentenceLength > 35) {
      analysis.issues.push('Sentences too long for optimal AI processing');
    } else {
      analysis.score += 15;
    }

    // Paragraph structure
    const avgParagraphLength = contentParam.paragraphs && contentParam.paragraphs.length > 0 
      ? contentParam.paragraphs.reduce((acc, p) => acc + p.split(' ').length, 0) / contentParam.paragraphs.length
      : 0;
    analysis.metrics.avgParagraphLength = avgParagraphLength;
    
    if (avgParagraphLength >= 50 && avgParagraphLength <= 150) {
      analysis.score += 25;
      analysis.strengths.push('Optimal paragraph length');
    } else if (avgParagraphLength > 0) {
      analysis.issues.push('Paragraph length not optimal for AI consumption');
    }

    // Definition patterns
    const definitionCount = this.semanticPatterns.definitionIndicators.reduce((count, pattern) => {
      return count + (contentParam.text.match(pattern) || []).length;
    }, 0);
    
    if (definitionCount > 0) {
      analysis.score += 20;
      analysis.strengths.push('Contains clear definitions');
    }

    // List structures
    if (contentParam && contentParam.lists && contentParam.lists.items > 3) {
      analysis.score += 15;
      analysis.strengths.push('Good use of list structures');
    }

    // Table data
    if (contentParam && contentParam.tables && contentParam.tables.length > 0) {
      analysis.score += 10;
      analysis.strengths.push('Contains structured data tables');
    }

    return analysis;
  }

  /**
   * Detect structural signals for content type classification
   */
  detectStructuralSignals(content, signals) {
    let score = 0;
    
    const signalChecks = {
      'byline': () => content.text.match(/by\s+[A-Z][a-z]+\s+[A-Z][a-z]+/gi),
      'publication date': () => content.text.match(/\d{1,2}[\/-]\d{1,2}[\/-]\d{4}|\d{4}-\d{2}-\d{2}/g),
      'author bio': () => content.text.toLowerCase().includes('author') || content.text.toLowerCase().includes('writer'),
      'pricing': () => content.text.match(/\$\d+|€\d+|£\d+|price|cost|buy/gi),
      'specifications': () => content.text.toLowerCase().includes('spec') || content.tables.length > 0,
      'reviews': () => content.text.match(/review|rating|\d+\s*stars?/gi),
      'question headings': () => content.headings.filter(h => h.text.includes('?')).length,
      'accordion structure': () => content.text.match(/expand|collapse|toggle/gi),
      'numbered lists': () => content.lists.ordered > 0,
      'sequential content': () => content.text.match(/step\s*\d+|first|second|third|next|then|finally/gi)
    };

    signals.forEach(signal => {
      const check = signalChecks[signal];
      if (check && check()) {
        score += 15;
      }
    });

    return Math.min(score, 50);
  }

  /**
   * Extract technical terms using pattern matching and NLP
   */
  extractTechnicalTerms(text) {
    const terms = new Set();
    
    // Pattern-based extraction
    Object.values(this.technicalPatterns).forEach(pattern => {
      const matches = text.match(pattern) || [];
      matches.forEach(match => terms.add(match.toLowerCase()));
    });

    // Capitalized technical terms (likely proper nouns)
    const capitalizedTerms = text.match(/\b[A-Z][a-zA-Z]*[A-Z][a-zA-Z]*\b/g) || [];
    capitalizedTerms.forEach(term => {
      if (term.length > 3) terms.add(term);
    });

    return Array.from(terms);
  }

  /**
   * Extract main topics using keyword extraction
   */
  async extractTopics(text, language) {
    try {
      const options = {
        language: language === 'en' ? 'english' : 'english', // Default to English for now
        remove_digits: true,
        return_changed_case: true,
        remove_duplicates: true
      };

      const keywords = keyword.extract(text, options);
      
      // Filter and score keywords
      const scoredKeywords = keywords
        .filter(word => word.length > 3)
        .map(word => ({
          term: word,
          frequency: (text.toLowerCase().match(new RegExp(word.toLowerCase(), 'g')) || []).length
        }))
        .sort((a, b) => b.frequency - a.frequency)
        .slice(0, 10);

      return scoredKeywords;
    } catch (e) {
      return [];
    }
  }

  /**
   * Extract capitalized entities (works across languages)
   */
  extractCapitalizedEntities(text) {
    const entities = new Set();
    
    // Multi-word capitalized entities
    const multiWordEntities = text.match(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3}\b/g) || [];
    multiWordEntities.forEach(entity => {
      if (entity.length > 5) entities.add(entity);
    });

    // Single capitalized words (excluding sentence starters)
    const words = text.split(/\s+/);
    for (let i = 1; i < words.length; i++) {
      const word = words[i];
      if (/^[A-Z][a-z]{3,}$/.test(word) && !word.match(/^(The|A|An|This|That)$/)) {
        entities.add(word);
      }
    }

    return Array.from(entities).slice(0, 20);
  }

  /**
   * Calculate readability score (language-adaptive with enhanced algorithm)
   */
  async calculateReadability(text, language) {
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
    const words = text.split(/\s+/).filter(w => w.length > 0);
    const syllables = this.countSyllables(text, language);

    // Basic metrics
    const avgSentenceLength = words.length / sentences.length;
    const avgSyllablesPerWord = syllables / words.length;
    
    // Enhanced analysis
    const complexSentences = this.detectComplexSentences(text, language);
    const technicalTerms = this.extractTechnicalTerms(text).length;
    const passiveVoice = this.detectPassiveVoice(text, language);
    
    let score;
    if (language === 'en') {
      // Enhanced Flesch Reading Ease for English
      score = 206.835 - (1.015 * avgSentenceLength) - (84.6 * avgSyllablesPerWord);
      
      // Adjust for complex sentences
      score -= complexSentences.percentage * 0.5;
      
      // Adjust for passive voice
      score -= passiveVoice.percentage * 0.3;
    } else {
      // Simplified scoring for other languages with enhancements
      score = 100 - (avgSentenceLength * 2) - (avgSyllablesPerWord * 30);
      
      // Language-specific adjustments
      if (language === 'de') {
        // German compound words are naturally longer
        score += 10;
      } else if (language === 'fi') {
        // Finnish agglutination creates longer words
        score += 15;
      }
    }

    // Technical content adjustment
    if (technicalTerms > 10) {
      score += Math.min(technicalTerms, 20); // Technical content naturally more complex
    }

    const finalScore = Math.max(0, Math.min(100, score));

    return {
      score: finalScore,
      avgSentenceLength,
      avgSyllablesPerWord,
      complexity: complexSentences,
      technicalLevel: this.getTechnicalLevel(technicalTerms),
      passiveVoice: passiveVoice,
      grade: this.getReadabilityGrade(finalScore, technicalTerms),
      suggestions: this.getReadabilitySuggestions(finalScore, complexSentences, technicalTerms, language)
    };
  }

  /**
   * Detect complex sentences (multiple clauses, long constructions)
   */
  detectComplexSentences(text, language) {
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
    let complexCount = 0;
    
    const complexityIndicators = {
      en: [/\b(although|however|nevertheless|furthermore|moreover|consequently)\b/gi,
           /\b(which|that|who|whom|whose)\b/gi, // Relative clauses
           /\b(because|since|while|whereas|unless)\b/gi], // Subordinating conjunctions
      de: [/\b(obwohl|jedoch|dennoch|außerdem|folglich)\b/gi,
           /\b(der|die|das|welche|welcher|welches)\b/gi],
      es: [/\b(aunque|sin embargo|además|por lo tanto)\b/gi,
           /\b(que|quien|cuyo|cual)\b/gi],
      default: [/\b(however|although|because|which)\b/gi]
    };

    const indicators = complexityIndicators[language] || complexityIndicators.default;
    
    sentences.forEach(sentence => {
      let complexity = 0;
      
      // Length-based complexity
      if (sentence.split(' ').length > 25) complexity++;
      
      // Indicator-based complexity
      indicators.forEach(pattern => {
        if (pattern.test(sentence)) complexity++;
      });
      
      // Comma count (indicates complex structure)
      const commas = (sentence.match(/,/g) || []).length;
      if (commas > 3) complexity++;
      
      if (complexity >= 2) complexCount++;
    });

    return {
      count: complexCount,
      total: sentences.length,
      percentage: (complexCount / sentences.length) * 100
    };
  }

  /**
   * Detect passive voice usage
   */
  detectPassiveVoice(text, language) {
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
    let passiveCount = 0;

    const passivePatterns = {
      en: [/\b(was|were|is|are|been|being)\s+\w+(ed|en)\b/gi,
           /\b(was|were|is|are)\s+\w+ed\s+by\b/gi],
      de: [/\b(wurde|wurden|wird|werden)\s+\w+/gi],
      es: [/\b(fue|fueron|es|son)\s+\w+(ado|ido)\b/gi],
      default: [/\b(was|were|is|are)\s+\w+ed\b/gi]
    };

    const patterns = passivePatterns[language] || passivePatterns.default;
    
    sentences.forEach(sentence => {
      if (patterns.some(pattern => pattern.test(sentence))) {
        passiveCount++;
      }
    });

    return {
      count: passiveCount,
      total: sentences.length,
      percentage: (passiveCount / sentences.length) * 100
    };
  }

  /**
   * Get technical level classification
   */
  getTechnicalLevel(technicalTermCount) {
    if (technicalTermCount > 25) return 'very_high';
    if (technicalTermCount > 15) return 'high';
    if (technicalTermCount > 8) return 'medium';
    if (technicalTermCount > 3) return 'low';
    return 'minimal';
  }

  /**
   * Get readability grade adjusted for technical content
   */
  getReadabilityGrade(score, technicalTerms) {
    // Adjust grade expectations for technical content
    const adjustment = technicalTerms > 15 ? 10 : technicalTerms > 8 ? 5 : 0;
    const adjustedScore = score + adjustment;
    
    if (adjustedScore > 80) return 'Easy';
    if (adjustedScore > 60) return 'Medium';
    if (adjustedScore > 40) return 'Difficult';
    return 'Very Difficult';
  }

  /**
   * Generate readability improvement suggestions
   */
  getReadabilitySuggestions(score, complexSentences, technicalTerms, language) {
    const suggestions = [];
    
    if (score < 50) {
      suggestions.push('Break long sentences into shorter ones');
      suggestions.push('Use simpler vocabulary where possible');
    }
    
    if (complexSentences.percentage > 30) {
      suggestions.push('Reduce sentence complexity by splitting compound sentences');
    }
    
    if (technicalTerms > 20) {
      suggestions.push('Consider adding a glossary for technical terms');
      suggestions.push('Define technical concepts on first use');
    }
    
    const languageSpecific = {
      en: ['Use active voice instead of passive voice', 'Consider using bullet points for lists'],
      de: ['Consider shorter compound words where possible'],
      es: ['Use direct object pronouns to reduce repetition'],
      default: ['Use shorter sentences', 'Add transition words for better flow']
    };
    
    const langSuggestions = languageSpecific[language] || languageSpecific.default;
    suggestions.push(...langSuggestions.slice(0, 2));
    
    return suggestions.slice(0, 5); // Limit to top 5 suggestions
  }

  /**
   * Count syllables (approximate for multiple languages)
   */
  countSyllables(text, language) {
    if (language === 'en') {
      return text.toLowerCase()
        .replace(/[^a-z]/g, '')
        .replace(/[aeiou]{2,}/g, 'a')
        .replace(/[^aeiou]/g, '')
        .length || 1;
    } else {
      // Simplified syllable counting for other languages
      return text.replace(/[^aeiouäöüàéèêëíîïóôõúûü]/gi, '').length || text.split(' ').length;
    }
  }

  /**
   * Analyze semantic structure of content
   */
  async analyzeSemanticStructure(contentParam, languageInfo) {
    const structure = {
      score: 0,
      elements: {
        introduction: false,
        conclusion: false,
        transitions: 0,
        emphasis: 0
      },
      flow: 'linear'
    };

    const text = contentParam.text.toLowerCase();
    
    // Introduction detection
    const firstParagraph = contentParam.paragraphs[0] || '';
    if (firstParagraph.length > 100) {
      structure.elements.introduction = true;
      structure.score += 25;
    }

    // Conclusion detection
    const lastParagraph = contentParam.paragraphs[contentParam.paragraphs.length - 1] || '';
    const conclusionWords = ['conclusion', 'summary', 'finally', 'in summary', 'to conclude'];
    if (conclusionWords.some(word => lastParagraph.toLowerCase().includes(word))) {
      structure.elements.conclusion = true;
      structure.score += 20;
    }

    // Transition words
    const transitionWords = [
      'however', 'therefore', 'furthermore', 'moreover', 'additionally',
      'consequently', 'meanwhile', 'nevertheless', 'in contrast'
    ];
    structure.elements.transitions = transitionWords.reduce((count, word) => {
      return count + (text.match(new RegExp(`\\b${word}\\b`, 'g')) || []).length;
    }, 0);

    if (structure.elements.transitions > 2) {
      structure.score += 25;
    }

    // Emphasis indicators
    structure.elements.emphasis = this.semanticPatterns.emphasisIndicators.reduce((count, pattern) => {
      return count + (text.match(pattern) || []).length;
    }, 0);

    if (structure.elements.emphasis > 3) {
      structure.score += 30;
    }

    return structure;
  }

  /**
   * Calculate grade from numeric score
   */
  calculateGrade(score) {
    if (score >= 90) return 'A';
    if (score >= 80) return 'B';
    if (score >= 70) return 'C';
    if (score >= 60) return 'D';
    return 'F';
  }
}

module.exports = AIContentAnalyzer;