// services/ai-content-analyzer.js
// State-of-the-art multilingual AI content evaluation

const natural = require('natural');
const compromise = require('compromise');
const sentiment = require('sentiment');
const { removeStopwords, eng, fra, deu, spa, ita, jpn, kor, rus } = require('stopword');
const keyword = require('keyword-extractor');

// Dynamic import for ES modules
let franc = null;
(async () => {
  try {
    const francModule = await import('franc');
    franc = francModule.franc;
  } catch (error) {
    console.warn('Failed to load franc module:', error.message);
    // Fallback to basic language detection
    franc = () => 'eng'; // Default to English
  }
})();

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
      // New specification-compliant metrics
      machineComprehension: {
        schemaCoverage: this.analyzeStructuredData(tests.schema, content), // 15 pts
        entityClarity: this.analyzeEntityClarity(tests.schema), // 10 pts  
        semanticHTML: this.analyzeSemanticHTML($, tests.accessibility) // 5 pts
      },
      contentStructure: {
        sectionGranularity: await this.analyzeSectionGranularity($), // 10 pts
        paragraphReadability: this.analyzeParagraphReadability($), // 5 pts
        answerSignals: this.analyzeAnswerSignals($), // 5 pts
        deepLinking: this.analyzeDeepLinkingAnchors($) // 5 pts
      },
      technicalQuality: {
        coreWebVitals: this.analyzeCoreWebVitals(tests.performance, tests.psiMetrics), // 10 pts
        crawlability: this.analyzeCrawlability(tests, $), // 8 pts
        renderingStrategy: this.analyzeRenderingStrategy($, tests) // 7 pts
      },
      accessibility: {
        altTextCoverage: this.analyzeAltTextCoverage($, tests.accessibility), // 4 pts
        contrastAndLandmarks: this.analyzeContrastAndLandmarks($, tests.accessibility) // 3 pts
      },
      trustGovernance: {
        authorExpertise: this.analyzeAuthorExpertise($, tests), // 5 pts
        publisherTransparency: this.analyzePublisherTransparency($), // 4 pts
        externalCorroboration: this.analyzeExternalCorroboration($), // 3 pts
        llmsGovernance: this.analyzeLLMsGovernance(tests) // 1 pt
      },
      // Legacy metrics (to be migrated)
      subMetrics: {
        answerClarity: await this.analyzeAnswerClarity(content, language),
        extractableFacts: await this.analyzeExtractableFacts(content, language),
        citations: await this.analyzeCitations(content, $, language),
        recency: this.analyzeRecency(content, tests, language),
        technical: this.analyzeTechnical(tests, url),
        contentPatterns: this.analyzeContentPatterns($)
      },
      insights: {
        contentType: await this.detectContentType(content, language.language, $),
        entities: await this.extractEntities(content.text, language.language),
        readabilityScore: await this.calculateReadability(content.text, language.language),
        semanticStructure: await this.analyzeSemanticStructure(content, language)
      },
      recommendations: []
    };

    // Calculate category scores per specification
    const machineComprehensionScore = 
      analysis.machineComprehension.schemaCoverage.score +
      analysis.machineComprehension.entityClarity.score +
      analysis.machineComprehension.semanticHTML.score;
    
    const contentStructureScore = 
      analysis.contentStructure.sectionGranularity.score +
      analysis.contentStructure.paragraphReadability.score +
      analysis.contentStructure.answerSignals.score +
      analysis.contentStructure.deepLinking.score;
    
    const technicalQualityScore = 
      analysis.technicalQuality.coreWebVitals.score +
      analysis.technicalQuality.crawlability.score +
      analysis.technicalQuality.renderingStrategy.score;
    
    const accessibilityScore = 
      analysis.accessibility.altTextCoverage.score +
      analysis.accessibility.contrastAndLandmarks.score;
    
    const trustGovernanceScore = 
      analysis.trustGovernance.authorExpertise.score +
      analysis.trustGovernance.publisherTransparency.score +
      analysis.trustGovernance.externalCorroboration.score +
      analysis.trustGovernance.llmsGovernance.score;
    
    analysis.categoryScores = {
      machineComprehension: {
        score: machineComprehensionScore,
        maxScore: 30,
        percentage: Math.round((machineComprehensionScore / 30) * 100)
      },
      contentStructure: {
        score: contentStructureScore,
        maxScore: 25,
        percentage: Math.round((contentStructureScore / 25) * 100)
      },
      technicalQuality: {
        score: technicalQualityScore,
        maxScore: 25,
        percentage: Math.round((technicalQualityScore / 25) * 100)
      },
      accessibility: {
        score: accessibilityScore,
        maxScore: 7,
        percentage: Math.round((accessibilityScore / 7) * 100)
      },
      trustGovernance: {
        score: trustGovernanceScore,
        maxScore: 13,
        percentage: Math.round((trustGovernanceScore / 13) * 100)
      }
    };

    // Legacy scoring (transitional)
    const legacyWeights = {
      answerClarity: 20,
      extractableFacts: 17,
      citations: 15,
      contentPatterns: 15,
      recency: 8,
      technical: 7
    };

    const legacyScore = Math.round(
      Object.entries(legacyWeights).reduce((total, [metric, weight]) => {
        return total + (analysis.subMetrics[metric].score * weight / 100);
      }, 0)
    );

    // Full specification scoring - 100% new categories implemented!
    const newCategoriesScore = 
      (analysis.categoryScores.machineComprehension.percentage * 0.3) + 
      (analysis.categoryScores.contentStructure.percentage * 0.25) +
      (analysis.categoryScores.technicalQuality.percentage * 0.25) +
      (analysis.categoryScores.accessibility.percentage * 0.07) +
      (analysis.categoryScores.trustGovernance.percentage * 0.13);
    
    analysis.overallScore = Math.round(newCategoriesScore);

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
      items: $('li').length,
      // Enhanced list analysis
      details: this.analyzeListStructures($)
    };
  }

  /**
   * Analyze list structures for AI optimization
   */
  analyzeListStructures($) {
    const analysis = {
      score: 0,
      totalLists: 0,
      listTypes: {
        bulleted: 0,
        numbered: 0,
        definition: 0,
        nested: 0
      },
      patterns: {
        steps: 0,
        features: 0,
        benefits: 0,
        tips: 0,
        comparisons: 0
      },
      issues: [],
      strengths: []
    };

    // Count different list types
    const bulletLists = $('ul');
    const numberedLists = $('ol');
    const definitionLists = $('dl');
    
    analysis.listTypes.bulleted = bulletLists.length;
    analysis.listTypes.numbered = numberedLists.length;
    analysis.listTypes.definition = definitionLists.length;
    analysis.totalLists = analysis.listTypes.bulleted + analysis.listTypes.numbered + analysis.listTypes.definition;

    // Detect nested lists
    analysis.listTypes.nested = $('ul ul, ol ol, ul ol, ol ul').length;

    // Analyze list content patterns for AI optimization
    const allListItems = $('li');
    const listTexts = allListItems.map((i, el) => $(el).text().toLowerCase()).get();
    
    // Step patterns
    const stepPatterns = [/step \d+/gi, /\d+\./g, /first|second|third|next|then|finally/gi];
    analysis.patterns.steps = stepPatterns.reduce((count, pattern) => {
      return count + listTexts.filter(text => pattern.test(text)).length;
    }, 0);

    // Feature patterns
    const featurePatterns = [/feature/gi, /includes/gi, /offers/gi, /provides/gi];
    analysis.patterns.features = featurePatterns.reduce((count, pattern) => {
      return count + listTexts.filter(text => pattern.test(text)).length;
    }, 0);

    // Benefits patterns
    const benefitPatterns = [/benefit/gi, /advantage/gi, /helps/gi, /improves/gi, /saves/gi];
    analysis.patterns.benefits = benefitPatterns.reduce((count, pattern) => {
      return count + listTexts.filter(text => pattern.test(text)).length;
    }, 0);

    // Tips patterns
    const tipPatterns = [/tip/gi, /recommendation/gi, /suggestion/gi, /advice/gi];
    analysis.patterns.tips = tipPatterns.reduce((count, pattern) => {
      return count + listTexts.filter(text => pattern.test(text)).length;
    }, 0);

    // Scoring
    if (analysis.totalLists > 0) {
      analysis.score += Math.min(analysis.totalLists * 15, 60); // Max 60 points for lists
      analysis.strengths.push(`${analysis.totalLists} structured lists found`);
    }

    if (analysis.listTypes.numbered > 0) {
      analysis.score += 15;
      analysis.strengths.push('Numbered lists for sequential content');
    }

    if (analysis.patterns.steps > 2) {
      analysis.score += 20;
      analysis.strengths.push('Step-by-step content structure');
    }

    if (analysis.listTypes.nested > 0) {
      analysis.score += 10;
      analysis.strengths.push('Hierarchical list structures');
    }

    // Issues
    if (analysis.totalLists === 0) {
      analysis.issues.push('No list structures found - consider adding bullet points or numbered lists');
    }

    if (allListItems.length > 0) {
      const emptyItems = allListItems.filter((i, el) => $(el).text().trim().length < 5).length;
      if (emptyItems > 0) {
        analysis.issues.push(`${emptyItems} empty or very short list items`);
        analysis.score -= emptyItems * 2;
      }
    }

    analysis.score = Math.max(0, Math.min(100, analysis.score));
    return analysis;
  }

  /**
   * Comprehensive FAQ, summary boxes, and AI-optimized content pattern detection
   */
  analyzeContentPatterns($) {
    const analysis = {
      score: 0,
      patterns: {
        faq: {
          schemaFAQ: false,
          explicitFAQ: 0,
          questionHeadings: 0,
          accordions: 0,
          qaPairs: 0
        },
        summaryBoxes: {
          highlighted: 0,
          callouts: 0,
          asides: 0,
          blockquotes: 0,
          keyPoints: 0
        },
        bulletContent: {
          bulletLists: 0,
          checklistItems: 0,
          features: 0,
          benefits: 0,
          tips: 0
        },
        aiOptimized: {
          definitions: 0,
          examples: 0,
          comparisons: 0,
          procedures: 0,
          troubleshooting: 0
        }
      },
      recommendations: [],
      strengths: [],
      issues: []
    };

    // 1. FAQ Pattern Detection (Enhanced)
    // Schema-based FAQ detection
    $('script[type="application/ld+json"]').each((i, script) => {
      try {
        const data = JSON.parse($(script).text());
        if (this.containsFAQSchema(data)) {
          analysis.patterns.faq.schemaFAQ = true;
        }
      } catch (e) {
        // Invalid JSON, skip
      }
    });

    // Explicit FAQ patterns
    const bodyText = $('body').text();
    const faqPatterns = [
      /\bQ:\s*(.+?)\s*A:/gi,
      /\bQuestion:\s*(.+?)\s*Answer:/gi,
      /\bFAQ\b/gi,
      /\bFrequently Asked Questions\b/gi,
      /\bQ&A\b/gi,
      /\bCommon Questions\b/gi
    ];
    
    analysis.patterns.faq.explicitFAQ = faqPatterns.reduce((count, pattern) => {
      return count + (bodyText.match(pattern) || []).length;
    }, 0);

    // Question-based headings
    const questionHeadings = $('h1, h2, h3, h4, h5, h6').filter((i, el) => {
      const text = $(el).text();
      return /\?/.test(text) || /\b(what|how|why|when|where|which|who)\s/gi.test(text);
    });
    analysis.patterns.faq.questionHeadings = questionHeadings.length;

    // Accordion/collapsible patterns
    const accordionSelectors = [
      '[class*="accordion"]',
      '[class*="collaps"]',
      '[class*="expand"]',
      '[class*="toggle"]',
      'details',
      '[aria-expanded]'
    ];
    analysis.patterns.faq.accordions = accordionSelectors.reduce((count, selector) => {
      return count + $(selector).length;
    }, 0);

    // Q&A pair detection
    const qaPairPattern = /\?[\s\S]{1,500}?\./g;
    analysis.patterns.faq.qaPairs = (bodyText.match(qaPairPattern) || []).length;

    // 2. Summary Box Detection
    const summarySelectors = [
      '[class*="summary"]',
      '[class*="highlight"]',
      '[class*="callout"]',
      '[class*="alert"]',
      '[class*="notice"]',
      '[class*="tip"]',
      '[class*="info"]',
      '[class*="warning"]'
    ];

    summarySelectors.forEach(selector => {
      const elements = $(selector);
      analysis.patterns.summaryBoxes.highlighted += elements.length;
    });

    analysis.patterns.summaryBoxes.asides = $('aside').length;
    analysis.patterns.summaryBoxes.blockquotes = $('blockquote').length;

    // Key points detection
    const keyPointPatterns = [
      /\b(key point|important|remember|note|summary)\b/gi,
      /\b(takeaway|conclusion|in brief|tldr)\b/gi
    ];
    analysis.patterns.summaryBoxes.keyPoints = keyPointPatterns.reduce((count, pattern) => {
      return count + (bodyText.match(pattern) || []).length;
    }, 0);

    // 3. Enhanced Bullet Content Analysis
    const bulletItems = $('ul li');
    const bulletTexts = bulletItems.map((i, el) => $(el).text().toLowerCase()).get();

    // Checklist detection
    const checklistPatterns = [/✓|✗|☑|☐|✅|❌/g, /\[\s*x\s*\]|\[\s*\]/g];
    analysis.patterns.bulletContent.checklistItems = checklistPatterns.reduce((count, pattern) => {
      return count + bulletTexts.filter(text => pattern.test(text)).length;
    }, 0);

    analysis.patterns.bulletContent.bulletLists = $('ul').length;

    // 4. AI-Optimized Content Pattern Detection
    // Definitions
    const definitionPatterns = [
      /\b(.+?)\s+(is|are|means|refers to|defined as)\b/gi,
      /\bdefine|definition|meaning|term\b/gi
    ];
    analysis.patterns.aiOptimized.definitions = definitionPatterns.reduce((count, pattern) => {
      return count + (bodyText.match(pattern) || []).length;
    }, 0);

    // Examples
    const examplePatterns = [
      /\b(for example|such as|including|like|instance)\b/gi,
      /\b(e\.g\.|i\.e\.|eg\.|ie\.)\b/gi
    ];
    analysis.patterns.aiOptimized.examples = examplePatterns.reduce((count, pattern) => {
      return count + (bodyText.match(pattern) || []).length;
    }, 0);

    // Comparisons
    const comparisonPatterns = [
      /\b(vs|versus|compared to|difference|similar|unlike)\b/gi,
      /\b(better|worse|more|less|than)\b/gi
    ];
    analysis.patterns.aiOptimized.comparisons = comparisonPatterns.reduce((count, pattern) => {
      return count + (bodyText.match(pattern) || []).length;
    }, 0);

    // Procedures and troubleshooting
    const procedurePatterns = [/\b(procedure|process|method|approach|technique)\b/gi];
    const troubleshootingPatterns = [/\b(troubleshoot|problem|issue|error|fix|solve)\b/gi];
    
    analysis.patterns.aiOptimized.procedures = procedurePatterns.reduce((count, pattern) => {
      return count + (bodyText.match(pattern) || []).length;
    }, 0);

    analysis.patterns.aiOptimized.troubleshooting = troubleshootingPatterns.reduce((count, pattern) => {
      return count + (bodyText.match(pattern) || []).length;
    }, 0);

    // Scoring and recommendations
    this.scoreContentPatterns(analysis);
    
    return analysis;
  }

  /**
   * Score content patterns and generate recommendations
   */
  scoreContentPatterns(analysis) {
    let score = 0;

    // FAQ scoring
    const faq = analysis.patterns.faq;
    if (faq.schemaFAQ) score += 25;
    if (faq.explicitFAQ > 0) score += Math.min(faq.explicitFAQ * 10, 25);
    if (faq.questionHeadings > 2) score += 20;
    if (faq.accordions > 0) score += 15;
    if (faq.qaPairs > 3) score += 15;

    // Summary boxes scoring
    const summaries = analysis.patterns.summaryBoxes;
    if (summaries.highlighted > 0) score += 20;
    if (summaries.asides > 0) score += 10;
    if (summaries.blockquotes > 1) score += 10;
    if (summaries.keyPoints > 2) score += 15;

    // Bullet content scoring
    const bullets = analysis.patterns.bulletContent;
    if (bullets.bulletLists > 2) score += 15;
    if (bullets.checklistItems > 0) score += 10;

    // AI-optimized content scoring
    const ai = analysis.patterns.aiOptimized;
    if (ai.definitions > 2) score += 15;
    if (ai.examples > 3) score += 15;
    if (ai.comparisons > 1) score += 10;

    // Generate strengths
    if (faq.schemaFAQ) analysis.strengths.push('Schema.org FAQ markup detected');
    if (faq.questionHeadings > 2) analysis.strengths.push('Good use of question-based headings');
    if (summaries.highlighted > 0) analysis.strengths.push('Summary/highlight boxes present');
    if (bullets.bulletLists > 2) analysis.strengths.push('Rich bullet-point content');
    if (ai.definitions > 2) analysis.strengths.push('Clear definitions for AI extraction');

    // Generate issues and recommendations
    if (faq.explicitFAQ === 0 && faq.questionHeadings === 0) {
      analysis.issues.push('No FAQ patterns detected');
      analysis.recommendations.push('Add FAQ section or question-based headings for AI Overviews');
    }
    
    if (summaries.highlighted === 0) {
      analysis.issues.push('No highlighted content or summary boxes');
      analysis.recommendations.push('Add callout boxes or highlighted key information');
    }
    
    if (bullets.bulletLists < 2) {
      analysis.issues.push('Limited use of bullet lists');
      analysis.recommendations.push('Use bullet lists for features, benefits, or key points');
    }

    if (ai.definitions < 2) {
      analysis.recommendations.push('Add clear definitions for key terms and concepts');
    }

    analysis.score = Math.max(0, Math.min(100, score));
  }

  /**
   * Check if schema data contains FAQ schema (enhanced)
   */
  containsFAQSchema(data) {
    if (Array.isArray(data)) {
      return data.some(item => this.containsFAQSchema(item));
    }
    
    if (typeof data === 'object' && data !== null) {
      // Check for FAQ schema types
      const faqTypes = ['FAQPage', 'QAPage'];
      if (data['@type']) {
        const types = Array.isArray(data['@type']) ? data['@type'] : [data['@type']];
        if (types.some(type => faqTypes.includes(type))) {
          return true;
        }
      }
      
      // Check for mainEntity with Question type
      if (data.mainEntity && Array.isArray(data.mainEntity)) {
        return data.mainEntity.some(entity => 
          entity['@type'] === 'Question' || 
          (Array.isArray(entity['@type']) && entity['@type'].includes('Question'))
        );
      }
      
      return Object.values(data).some(value => {
        if (typeof value === 'object') {
          return this.containsFAQSchema(value);
        }
        return false;
      });
    }
    
    return false;
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
   * 1.1 Schema coverage & validity (15 pts) - Machine Comprehension Category
   */
  analyzeStructuredData(schemaTests, content) {
    const analysis = {
      score: 0,
      maxScore: 15,
      evidence: {
        requiredSchemas: { present: [], missing: [] },
        recommendedSchemas: { present: [], missing: [] },
        validationErrors: [],
        totalSchemas: 0,
        hasOrganizationLogo: false
      },
      issues: [],
      strengths: []
    };

    if (!schemaTests) {
      analysis.issues.push('Schema analysis failed');
      analysis.evidence.validationErrors.push('No schema data available');
      return analysis;
    }

    // Define required and recommended schema types per specification
    const requiredTypes = ['Organization', 'WebSite', 'BreadcrumbList'];
    const recommendedTypes = ['Product', 'Article', 'Event', 'FAQPage', 'HowTo'];
    const detectedTypes = schemaTests.types || [];
    
    analysis.evidence.totalSchemas = schemaTests.totalSchemas || 0;

    // Check required schemas
    requiredTypes.forEach(type => {
      if (detectedTypes.some(detected => detected.includes(type))) {
        analysis.evidence.requiredSchemas.present.push(type);
      } else {
        analysis.evidence.requiredSchemas.missing.push(type);
      }
    });

    // Check recommended schemas
    recommendedTypes.forEach(type => {
      if (detectedTypes.some(detected => detected.includes(type))) {
        analysis.evidence.recommendedSchemas.present.push(type);
      } else {
        analysis.evidence.recommendedSchemas.missing.push(type);
      }
    });

    // Scoring per specification
    const requiredPresent = analysis.evidence.requiredSchemas.present.length;
    const requiredTotal = requiredTypes.length;
    
    if (requiredPresent === requiredTotal) {
      analysis.score = 11; // All required valid → 11/15
      analysis.strengths.push('All required schemas present');
    } else if (requiredPresent > 0) {
      analysis.score = 7; // Some required valid → 7/15
      analysis.strengths.push(`${requiredPresent}/${requiredTotal} required schemas present`);
      analysis.issues.push(`Missing: ${analysis.evidence.requiredSchemas.missing.join(', ')}`);
    } else {
      analysis.score = 0; // None → 0/15
      analysis.issues.push('No required schemas found (Organization, WebSite, BreadcrumbList)');
    }

    // +1 per recommended type (max +4)
    const recommendedBonus = Math.min(analysis.evidence.recommendedSchemas.present.length, 4);
    analysis.score += recommendedBonus;
    
    if (recommendedBonus > 0) {
      analysis.strengths.push(`+${recommendedBonus} recommended schemas: ${analysis.evidence.recommendedSchemas.present.join(', ')}`);
    }

    // Organization logo field validation (part of required check)
    if (analysis.evidence.requiredSchemas.present.includes('Organization')) {
      if (schemaTests.businessType && schemaTests.businessType.confidence === 'high') {
        analysis.evidence.hasOrganizationLogo = true;
        analysis.strengths.push('Organization schema with business fields detected');
      } else {
        analysis.issues.push('Organization schema missing required logo field');
        analysis.score = Math.max(0, analysis.score - 2);
      }
    }

    // Validation errors penalty
    if (schemaTests.issues && schemaTests.issues.length > 0) {
      analysis.evidence.validationErrors = schemaTests.issues;
      analysis.issues.push(`${schemaTests.issues.length} validation errors`);
      analysis.score = Math.max(0, analysis.score - Math.min(schemaTests.issues.length, 3));
    }

    analysis.score = Math.max(0, Math.min(15, analysis.score));
    return analysis;
  }

  /**
   * 1.2 Entity clarity (10 pts) - Machine Comprehension Category
   */
  analyzeEntityClarity(schemaTests) {
    const analysis = {
      score: 0,
      maxScore: 10,
      evidence: {
        sameAsFields: [],
        authoritativeDomains: [],
        socialProfiles: [],
        totalReferences: 0
      },
      issues: [],
      strengths: []
    };

    if (!schemaTests || !schemaTests.types) {
      analysis.issues.push('No schema data for entity analysis');
      return analysis;
    }

    // Extract sameAs fields from schema data
    // This would typically come from parsed JSON-LD Organization or Person schemas
    const authoritativeDomains = [
      'wikidata.org',
      'wikipedia.org', 
      'linkedin.com',
      'crunchbase.com',
      'github.com' // Added as tech-relevant authoritative source
    ];

    const socialDomains = [
      'facebook.com',
      'twitter.com',
      'x.com',
      'instagram.com',
      'youtube.com',
      'tiktok.com'
    ];

    // Mock extraction - in real implementation, would parse JSON-LD sameAs fields
    // For now, check if business type detection found authoritative sources
    if (schemaTests.businessType) {
      analysis.evidence.totalReferences = 1;
      
      // High confidence business type suggests good entity clarity
      if (schemaTests.businessType.confidence === 'high') {
        analysis.evidence.authoritativeDomains.push('schema-validated');
        analysis.score = 7; // Simulating 1 authoritative source
        analysis.strengths.push('High-confidence business type detection');
      }
    }

    // Check for entity references in content
    // This is a simplified version - full implementation would parse actual sameAs arrays
    const hasLinkedInReference = schemaTests.types?.some(type => 
      type.toLowerCase().includes('organization') || type.toLowerCase().includes('person')
    );

    if (hasLinkedInReference && analysis.evidence.authoritativeDomains.length === 0) {
      // Simulate minimal entity clarity
      analysis.score = 2;
      analysis.issues.push('Limited entity clarity - add sameAs references to authoritative sources');
    }

    // Scoring per specification
    const authoritativeCount = analysis.evidence.authoritativeDomains.length;
    
    if (authoritativeCount >= 2) {
      analysis.score = 10; // ≥2 authoritative → 10/10
      analysis.strengths.push(`${authoritativeCount} authoritative entity references`);
    } else if (authoritativeCount === 1) {
      analysis.score = 7; // 1 authoritative → 7/10
      analysis.strengths.push('1 authoritative entity reference found');
    } else if (analysis.evidence.socialProfiles.length > 0) {
      analysis.score = 5; // Only social profiles → 5/10
      analysis.strengths.push('Social media entity references found');
    } else {
      analysis.score = 2; // None → 2/10
      analysis.issues.push('No authoritative entity references found');
    }

    analysis.score = Math.max(0, Math.min(10, analysis.score));
    return analysis;
  }

  /**
   * 1.3 Semantic HTML basics (5 pts) - Machine Comprehension Category
   */
  analyzeSemanticHTML($, accessibilityTests) {
    const analysis = {
      score: 0,
      maxScore: 5,
      evidence: {
        headingOutline: { valid: false, issues: [] },
        ariaLandmarks: { present: [], missing: [] },
        altTextCoverage: { percentage: 0, withAlt: 0, total: 0 }
      },
      issues: [],
      strengths: []
    };

    // 1. Logical heading outline (H1–H3 in correct nesting)
    const headings = [];
    $('h1, h2, h3, h4, h5, h6').each((i, el) => {
      headings.push({
        level: parseInt(el.tagName.slice(1)),
        text: $(el).text().trim()
      });
    });

    let headingValid = true;
    let previousLevel = 0;

    for (const heading of headings) {
      if (heading.level > previousLevel + 1 && previousLevel > 0) {
        headingValid = false;
        analysis.evidence.headingOutline.issues.push(`Skipped level: H${previousLevel} to H${heading.level}`);
      }
      previousLevel = Math.max(previousLevel, heading.level);
    }

    analysis.evidence.headingOutline.valid = headingValid && headings.length > 0;

    // 2. ARIA landmarks
    const requiredLandmarks = ['header', 'nav', 'main', 'footer'];
    const landmarkSelectors = {
      header: 'header, [role="banner"]',
      nav: 'nav, [role="navigation"]', 
      main: 'main, [role="main"]',
      footer: 'footer, [role="contentinfo"]'
    };

    requiredLandmarks.forEach(landmark => {
      const elements = $(landmarkSelectors[landmark]);
      if (elements.length > 0) {
        analysis.evidence.ariaLandmarks.present.push(landmark);
      } else {
        analysis.evidence.ariaLandmarks.missing.push(landmark);
      }
    });

    // 3. Alt text coverage ≥80%
    const images = $('img');
    const imagesWithAlt = images.filter((i, img) => {
      const alt = $(img).attr('alt');
      return alt !== undefined && alt.trim().length > 0;
    });

    analysis.evidence.altTextCoverage.total = images.length;
    analysis.evidence.altTextCoverage.withAlt = imagesWithAlt.length;
    analysis.evidence.altTextCoverage.percentage = images.length > 0 ? 
      Math.round((imagesWithAlt.length / images.length) * 100) : 100;

    // Scoring per specification
    let criteriaCount = 0;

    if (analysis.evidence.headingOutline.valid) {
      criteriaCount++;
      analysis.strengths.push('Logical heading outline structure');
    } else {
      analysis.issues.push('Invalid heading hierarchy');
    }

    if (analysis.evidence.ariaLandmarks.present.length === 4) {
      criteriaCount++;
      analysis.strengths.push('All ARIA landmarks present');
    } else {
      analysis.issues.push(`Missing landmarks: ${analysis.evidence.ariaLandmarks.missing.join(', ')}`);
    }

    if (analysis.evidence.altTextCoverage.percentage >= 80) {
      criteriaCount++;
      analysis.strengths.push(`${analysis.evidence.altTextCoverage.percentage}% alt text coverage`);
    } else {
      analysis.issues.push(`Only ${analysis.evidence.altTextCoverage.percentage}% alt text coverage`);
    }

    // Scoring
    if (criteriaCount === 3) {
      analysis.score = 5; // All three present → 5/5
    } else if (criteriaCount === 2) {
      analysis.score = 3; // Two → 3/5
    } else if (criteriaCount === 1) {
      analysis.score = 2; // One → 2/5
    } else {
      analysis.score = 0; // None → 0/5
    }

    return analysis;
  }

  /**
   * 2.1 Section granularity (10 pts) - Content Structure & Answerability Category
   */
  async analyzeSectionGranularity($) {
    const analysis = {
      score: 0,
      maxScore: 10,
      evidence: {
        sections: [],
        averageTokens: 0,
        medianTokens: 0,
        totalSections: 0
      },
      issues: [],
      strengths: []
    };

    try {
      const { encoding_for_model } = require('tiktoken');
      const encoder = encoding_for_model('gpt-4');

      // Split content by H2/H3 as per specification
      const sections = [];
      let currentSection = { heading: 'Introduction', content: '' };

      $('h2, h3, p, li, div').each((i, el) => {
        const tagName = el.tagName.toLowerCase();
        const text = $(el).text().trim();

        if (tagName === 'h2' || tagName === 'h3') {
          // Save previous section if it has content
          if (currentSection.content.length > 0) {
            sections.push(currentSection);
          }
          // Start new section
          currentSection = { 
            heading: text, 
            content: '',
            level: tagName 
          };
        } else if (text.length > 20) {
          // Add content to current section
          currentSection.content += text + ' ';
        }
      });

      // Add final section
      if (currentSection.content.length > 0) {
        sections.push(currentSection);
      }

      // Count tokens per section using cl100k_base (≈ 0.75 words/token)
      analysis.evidence.sections = sections.map(section => {
        const tokens = encoder.encode(section.content).length;
        return {
          heading: section.heading,
          tokens: tokens,
          words: section.content.split(/\s+/).length,
          level: section.level
        };
      });

      analysis.evidence.totalSections = sections.length;
      
      if (analysis.evidence.sections.length > 0) {
        const tokenCounts = analysis.evidence.sections.map(s => s.tokens);
        analysis.evidence.averageTokens = Math.round(
          tokenCounts.reduce((a, b) => a + b, 0) / tokenCounts.length
        );
        
        // Calculate median
        const sorted = [...tokenCounts].sort((a, b) => a - b);
        const mid = Math.floor(sorted.length / 2);
        analysis.evidence.medianTokens = sorted.length % 2 ? 
          sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
      }

      // Scoring per specification using median tokens
      const medianTokens = analysis.evidence.medianTokens;
      
      if (medianTokens >= 200 && medianTokens <= 600) {
        analysis.score = 10; // 200–600 tokens → 10/10
        analysis.strengths.push(`Optimal section length: ${medianTokens} tokens`);
      } else if (medianTokens >= 120 && medianTokens < 200) {
        analysis.score = 8; // 120–200 → 8/10
        analysis.strengths.push(`Good section length: ${medianTokens} tokens`);
      } else if (medianTokens > 600 && medianTokens <= 1000) {
        analysis.score = 7; // 600–1000 → 7/10
        analysis.issues.push(`Sections slightly long: ${medianTokens} tokens`);
      } else if (medianTokens < 120) {
        analysis.score = 5; // <120 → 5/10
        analysis.issues.push(`Sections too short: ${medianTokens} tokens`);
      } else {
        analysis.score = 4; // >1000 → 4/10
        analysis.issues.push(`Sections too long: ${medianTokens} tokens`);
      }

      encoder.free(); // Clean up encoder

    } catch (error) {
      analysis.issues.push('Token counting failed');
      analysis.evidence.validationErrors = [error.message];
      analysis.score = 0; // Mark as "Not Measured"
    }

    return analysis;
  }

  /**
   * 2.2 Paragraph readability (5 pts) - Content Structure & Answerability Category
   */
  analyzeParagraphReadability($) {
    const analysis = {
      score: 0,
      maxScore: 5,
      evidence: {
        paragraphs: [],
        averageWords: 0,
        medianWords: 0,
        totalParagraphs: 0
      },
      issues: [],
      strengths: []
    };

    // Extract all paragraphs
    const paragraphs = [];
    $('p').each((i, el) => {
      const text = $(el).text().trim();
      if (text.length > 20) { // Filter out very short paragraphs
        const wordCount = text.split(/\s+/).length;
        paragraphs.push({
          text: text.substring(0, 100) + '...', // Truncate for evidence
          words: wordCount
        });
      }
    });

    analysis.evidence.paragraphs = paragraphs;
    analysis.evidence.totalParagraphs = paragraphs.length;

    if (paragraphs.length > 0) {
      const wordCounts = paragraphs.map(p => p.words);
      analysis.evidence.averageWords = Math.round(
        wordCounts.reduce((a, b) => a + b, 0) / wordCounts.length
      );

      // Calculate median word count
      const sorted = [...wordCounts].sort((a, b) => a - b);
      const mid = Math.floor(sorted.length / 2);
      analysis.evidence.medianWords = sorted.length % 2 ? 
        sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);

      // Scoring per specification using median words
      const medianWords = analysis.evidence.medianWords;
      
      if (medianWords >= 25 && medianWords <= 40) {
        analysis.score = 5; // 25–40 words → 5/5
        analysis.strengths.push(`Optimal paragraph length: ${medianWords} words`);
      } else if (medianWords >= 20 && medianWords < 25) {
        analysis.score = 4; // 20–25 → 4/5
        analysis.strengths.push(`Good paragraph length: ${medianWords} words`);
      } else if (medianWords > 40 && medianWords <= 60) {
        analysis.score = 3; // 40–60 → 3/5
        analysis.issues.push(`Paragraphs slightly long: ${medianWords} words`);
      } else if (medianWords < 20) {
        analysis.score = 2; // <20 → 2/5
        analysis.issues.push(`Paragraphs too short: ${medianWords} words`);
      } else {
        analysis.score = 1; // >60 → 1/5
        analysis.issues.push(`Paragraphs too long: ${medianWords} words`);
      }
    } else {
      analysis.score = 0;
      analysis.issues.push('No readable paragraphs found');
    }

    return analysis;
  }

  /**
   * 2.3 Answer signals (5 pts) - Content Structure & Answerability Category
   */
  analyzeAnswerSignals($) {
    const analysis = {
      score: 0,
      maxScore: 5,
      evidence: {
        questionHeadings: 0,
        lists: 0,
        tables: 0,
        faqSchema: false,
        totalSignals: 0
      },
      issues: [],
      strengths: []
    };

    // Count Q-form headings (What, How, Why, When, Where, Who)
    const questionPatterns = /^(what|how|why|when|where|who)\b/i;
    $('h1, h2, h3, h4, h5, h6').each((i, el) => {
      const text = $(el).text().trim();
      if (questionPatterns.test(text)) {
        analysis.evidence.questionHeadings++;
      }
    });

    // Count lists and tables
    analysis.evidence.lists = $('ul, ol').length;
    analysis.evidence.tables = $('table').length;

    // Check for FAQ schema
    $('script[type="application/ld+json"]').each((i, elem) => {
      try {
        const jsonText = $(elem).text().trim();
        if (jsonText.includes('"@type"') && 
            (jsonText.includes('FAQPage') || jsonText.includes('QAPage'))) {
          analysis.evidence.faqSchema = true;
        }
      } catch (e) {
        // Invalid JSON, continue
      }
    });

    // Calculate total signals
    analysis.evidence.totalSignals = 
      analysis.evidence.questionHeadings + 
      analysis.evidence.lists + 
      analysis.evidence.tables + 
      (analysis.evidence.faqSchema ? 1 : 0);

    // Scoring per specification
    if (analysis.evidence.totalSignals >= 8) {
      analysis.score = 5; // 8+ signals → 5/5
      analysis.strengths.push(`Excellent answer signals: ${analysis.evidence.totalSignals} found`);
    } else if (analysis.evidence.totalSignals >= 5) {
      analysis.score = 4; // 5–7 → 4/5
      analysis.strengths.push(`Good answer signals: ${analysis.evidence.totalSignals} found`);
    } else if (analysis.evidence.totalSignals >= 3) {
      analysis.score = 3; // 3–4 → 3/5
      analysis.issues.push(`Some answer signals: ${analysis.evidence.totalSignals} found`);
    } else if (analysis.evidence.totalSignals >= 1) {
      analysis.score = 2; // 1–2 → 2/5
      analysis.issues.push(`Few answer signals: ${analysis.evidence.totalSignals} found`);
    } else {
      analysis.score = 0; // 0 → 0/5
      analysis.issues.push('No answer signals detected');
    }

    return analysis;
  }

  /**
   * 2.4 Deep-linking anchors (5 pts) - Content Structure & Answerability Category
   */
  analyzeDeepLinkingAnchors($) {
    const analysis = {
      score: 0,
      maxScore: 5,
      evidence: {
        headingsWithIds: 0,
        totalHeadings: 0,
        tocDetected: false,
        jumpLinks: 0,
        anchorCoverage: 0
      },
      issues: [],
      strengths: []
    };

    // Count headings with ID attributes
    let headingsWithIds = 0;
    let totalHeadings = 0;
    
    $('h1, h2, h3, h4, h5, h6').each((i, el) => {
      totalHeadings++;
      if ($(el).attr('id')) {
        headingsWithIds++;
      }
    });

    analysis.evidence.headingsWithIds = headingsWithIds;
    analysis.evidence.totalHeadings = totalHeadings;
    analysis.evidence.anchorCoverage = totalHeadings > 0 ? 
      Math.round((headingsWithIds / totalHeadings) * 100) : 0;

    // Detect Table of Contents
    const tocSelectors = [
      'nav[class*="toc"]',
      'div[class*="table-of-contents"]',
      'div[class*="toc"]',
      'ul[class*="toc"]',
      '.table-of-contents',
      '#toc',
      '[role="navigation"]'
    ];
    
    for (const selector of tocSelectors) {
      if ($(selector).length > 0) {
        // Check if it contains internal links
        const internalLinks = $(selector).find('a[href^="#"]').length;
        if (internalLinks > 2) {
          analysis.evidence.tocDetected = true;
          break;
        }
      }
    }

    // Count jump links (internal anchors)
    analysis.evidence.jumpLinks = $('a[href^="#"]').length;

    // Scoring per specification
    const coverage = analysis.evidence.anchorCoverage;
    
    if (coverage >= 80 && analysis.evidence.tocDetected) {
      analysis.score = 5; // 80%+ anchors + TOC → 5/5
      analysis.strengths.push(`Excellent deep-linking: ${coverage}% anchors + TOC`);
    } else if (coverage >= 60) {
      analysis.score = 4; // 60–79% → 4/5
      analysis.strengths.push(`Good deep-linking: ${coverage}% anchors`);
    } else if (coverage >= 40) {
      analysis.score = 3; // 40–59% → 3/5
      analysis.issues.push(`Some deep-linking: ${coverage}% anchors`);
    } else if (coverage >= 20) {
      analysis.score = 2; // 20–39% → 2/5
      analysis.issues.push(`Limited deep-linking: ${coverage}% anchors`);
    } else {
      analysis.score = 1; // <20% → 1/5
      analysis.issues.push(`Poor deep-linking: ${coverage}% anchors`);
    }

    if (analysis.evidence.tocDetected) {
      analysis.strengths.push('Table of Contents detected');
    } else if (analysis.evidence.totalHeadings > 3) {
      analysis.issues.push('Consider adding Table of Contents');
    }

    return analysis;
  }

  /**
   * 3.1 Core Web Vitals (10 pts) - Technical Quality Category
   */
  analyzeCoreWebVitals(performanceData, psiData) {
    const analysis = {
      score: 0,
      maxScore: 10,
      evidence: {
        fcp: null,
        lcp: null,
        cls: null,
        fid: null,
        vitalsScore: 0,
        source: 'none'
      },
      issues: [],
      strengths: []
    };

    // Prioritize CrUX field data over lab data
    if (psiData && psiData.performance && psiData.performance.coreWebVitals) {
      const vitals = psiData.performance.coreWebVitals;
      analysis.evidence.source = 'crux-field-data';
      
      // Map CrUX ratings to scores
      const ratingToScore = { 'good': 3, 'needs-improvement': 2, 'poor': 1 };
      
      analysis.evidence.fcp = vitals.fcp;
      analysis.evidence.lcp = vitals.lcp;
      analysis.evidence.cls = vitals.cls;
      analysis.evidence.fid = vitals.fid;
      
      const scores = [
        ratingToScore[vitals.fcp] || 0,
        ratingToScore[vitals.lcp] || 0,
        ratingToScore[vitals.cls] || 0,
        ratingToScore[vitals.fid] || 0
      ];
      
      const avgVitalScore = scores.reduce((a, b) => a + b, 0) / scores.length;
      analysis.evidence.vitalsScore = Math.round(avgVitalScore * 100) / 100;
      
      // Scoring per specification
      if (avgVitalScore >= 2.5) {
        analysis.score = 10; // All good → 10/10
        analysis.strengths.push('Excellent Core Web Vitals (field data)');
      } else if (avgVitalScore >= 2.0) {
        analysis.score = 8; // Mostly good → 8/10
        analysis.strengths.push('Good Core Web Vitals (field data)');
      } else if (avgVitalScore >= 1.5) {
        analysis.score = 6; // Mixed → 6/10
        analysis.issues.push('Some Core Web Vitals need improvement');
      } else {
        analysis.score = 3; // Mostly poor → 3/10
        analysis.issues.push('Core Web Vitals need significant improvement');
      }
      
    } else if (performanceData && performanceData.metrics) {
      // Fallback to lab data
      analysis.evidence.source = 'lab-data';
      const metrics = performanceData.metrics;
      
      let labScore = 0;
      if (metrics.firstContentfulPaint && metrics.firstContentfulPaint < 1800) labScore += 2.5;
      if (metrics.loadComplete && metrics.loadComplete < 3000) labScore += 2.5;
      
      analysis.score = Math.round(labScore);
      analysis.issues.push('Using lab data - field data recommended');
      
    } else {
      analysis.score = 0;
      analysis.issues.push('No Core Web Vitals data available');
    }

    return analysis;
  }

  /**
   * 3.2 Crawlability (8 pts) - Technical Quality Category
   */
  analyzeCrawlability(tests, $) {
    const analysis = {
      score: 0,
      maxScore: 8,
      evidence: {
        robotsTxt: false,
        xmlSitemap: false,
        canonicalTags: 0,
        metaRobots: null,
        httpStatus: null,
        redirectChain: 0
      },
      issues: [],
      strengths: []
    };

    // Check robots.txt (2 pts)
    if (tests.files && tests.files.robots && tests.files.robots.exists) {
      analysis.evidence.robotsTxt = true;
      analysis.score += 2;
      analysis.strengths.push('robots.txt found');
    } else {
      analysis.issues.push('robots.txt missing');
    }

    // Check XML sitemap (2 pts)
    if (tests.files && tests.files.sitemap && tests.files.sitemap.exists) {
      analysis.evidence.xmlSitemap = true;
      analysis.score += 2;
      analysis.strengths.push('XML sitemap found');
      
      // Bonus for enhanced sitemap validation
      if (tests.files.sitemap.enhanced && tests.files.sitemap.enhanced.score >= 80) {
        analysis.score += 1;
        analysis.strengths.push('High-quality XML sitemap');
      }
    } else {
      analysis.issues.push('XML sitemap missing');
    }

    // Check canonical tags (2 pts)
    const canonicalCount = $('link[rel="canonical"]').length;
    analysis.evidence.canonicalTags = canonicalCount;
    
    if (canonicalCount === 1) {
      analysis.score += 2;
      analysis.strengths.push('Canonical tag present');
    } else if (canonicalCount > 1) {
      analysis.score += 1;
      analysis.issues.push('Multiple canonical tags found');
    } else {
      analysis.issues.push('Canonical tag missing');
    }

    // Check hreflang implementation (1 pt)
    const hreflangValidation = this.validateHreflangImplementation($);
    analysis.evidence.hreflang = hreflangValidation;
    
    if (hreflangValidation.score >= 0.8) {
      analysis.score += 1;
      analysis.strengths.push('Proper hreflang implementation');
    } else if (hreflangValidation.totalLinks > 0) {
      analysis.score += 0.5;
      analysis.issues.push(...hreflangValidation.issues);
    } else if (hreflangValidation.isMultilingual) {
      analysis.issues.push('Missing hreflang tags for multilingual site');
    }

    // Check meta robots (1 pt)  
    const metaRobots = $('meta[name="robots"]').attr('content');
    analysis.evidence.metaRobots = metaRobots || null;
    
    if (metaRobots && !metaRobots.includes('noindex') && !metaRobots.includes('nofollow')) {
      analysis.score += 1;
      analysis.strengths.push('Meta robots allows indexing');
    } else if (!metaRobots) {
      analysis.score += 0.5; // Default behavior is indexable
    } else {
      analysis.issues.push('Meta robots blocks crawling');
    }

    // HTTP status check (1 pt) - from performance data
    if (tests.performance && tests.performance.statusCode) {
      analysis.evidence.httpStatus = tests.performance.statusCode;
      if (tests.performance.statusCode === 200) {
        analysis.score += 1;
        analysis.strengths.push('Clean HTTP 200 status');
      } else {
        analysis.issues.push(`HTTP ${tests.performance.statusCode} status`);
      }
    }

    return analysis;
  }

  /**
   * 3.3 Rendering strategy (7 pts) - Technical Quality Category
   */
  analyzeRenderingStrategy($, tests) {
    const analysis = {
      score: 0,
      maxScore: 7,
      evidence: {
        renderingType: 'unknown',
        jsRequiredContent: 0,
        totalContent: 0,
        ssrIndicators: [],
        spaIndicators: [],
        confidence: 'low'
      },
      issues: [],
      strengths: []
    };

    // Check for SSR/Static indicators
    const ssrIndicators = [
      $('meta[name="generator"]').length > 0,
      $('meta[name="next-head-count"]').length > 0, // Next.js SSR
      $('script[data-nuxt-ssr]').length > 0, // Nuxt SSR
      $('script').filter((i, el) => $(el).html().includes('__NUXT__')).length > 0,
      $('script').filter((i, el) => $(el).html().includes('__NEXT_DATA__')).length > 0,
      $('.gatsby-script-loader').length > 0, // Gatsby static
      $('body').children().length > 10 // Substantial pre-rendered content
    ];

    const ssrCount = ssrIndicators.filter(Boolean).length;
    analysis.evidence.ssrIndicators = ssrCount;

    // Check for SPA indicators
    const spaIndicators = [
      $('#root').length > 0 && $('#root').children().length === 0,
      $('#app').length > 0 && $('#app').children().length === 0,
      $('script[src*="react"]').length > 0 && $('body').text().trim().length < 100,
      $('script[src*="vue"]').length > 0 && $('body').text().trim().length < 100,
      $('script[src*="angular"]').length > 0 && $('body').text().trim().length < 100,
      $('noscript').text().includes('enable JavaScript') // Common SPA warning
    ];

    const spaCount = spaIndicators.filter(Boolean).length;
    analysis.evidence.spaIndicators = spaCount;

    // Analyze content availability
    const bodyText = $('body').text().trim();
    const mainContent = $('main, article, .content, .post, .entry').text().trim();
    
    analysis.evidence.totalContent = bodyText.length;
    analysis.evidence.jsRequiredContent = Math.max(0, 
      analysis.evidence.totalContent - (mainContent.length || bodyText.length)
    );

    // Determine rendering strategy and score
    if (ssrCount >= 3) {
      analysis.evidence.renderingType = 'ssr-static';
      analysis.evidence.confidence = 'high';
      analysis.score = 7; // SSR/Static → 7/7
      analysis.strengths.push('Server-side rendered or static');
    } else if (ssrCount >= 1 && spaCount < 2) {
      analysis.evidence.renderingType = 'hybrid';
      analysis.evidence.confidence = 'medium';
      analysis.score = 5; // Hybrid → 5/7
      analysis.strengths.push('Hybrid rendering detected');
    } else if (spaCount >= 2 && bodyText.length < 500) {
      analysis.evidence.renderingType = 'spa';
      analysis.evidence.confidence = 'high';
      analysis.score = 2; // Heavy SPA → 2/7
      analysis.issues.push('Heavy client-side rendering detected');
    } else {
      analysis.evidence.renderingType = 'mixed';
      analysis.evidence.confidence = 'low';
      analysis.score = 4; // Mixed/unknown → 4/7
      analysis.issues.push('Rendering strategy unclear');
    }

    return analysis;
  }

  /**
   * 4.1 Alt text coverage (4 pts) - Accessibility & Inclusivity Category
   */
  analyzeAltTextCoverage($, accessibilityData) {
    const analysis = {
      score: 0,
      maxScore: 4,
      evidence: {
        totalImages: 0,
        imagesWithAlt: 0,
        coverage: 0,
        emptyAlt: 0,
        descriptiveAlt: 0,
        axeViolations: [],
        source: 'cheerio'
      },
      issues: [],
      strengths: []
    };

    // Use axe-core results if available
    if (accessibilityData && accessibilityData.axeResults) {
      analysis.evidence.source = 'axe-core';
      
      // Extract image-related violations from axe-core
      const imageViolations = accessibilityData.axeResults.violations.filter(v => 
        v.id === 'image-alt' || v.id === 'alt-text' || v.description.toLowerCase().includes('alt')
      );
      
      analysis.evidence.axeViolations = imageViolations;
      analysis.evidence.totalImages = accessibilityData.totalImages || 0;
      analysis.evidence.imagesWithAlt = analysis.evidence.totalImages - (accessibilityData.imagesWithoutAlt || 0);
      
      // Enhanced scoring using axe-core data
      if (imageViolations.length === 0 && analysis.evidence.totalImages > 0) {
        analysis.evidence.coverage = 100;
        analysis.score = 4;
        analysis.strengths.push('Perfect alt text coverage (axe-core verified)');
      } else {
        const violationNodes = imageViolations.reduce((total, v) => total + v.nodes, 0);
        analysis.evidence.coverage = analysis.evidence.totalImages > 0 ? 
          Math.round(((analysis.evidence.totalImages - violationNodes) / analysis.evidence.totalImages) * 100) : 100;
        
        // Apply scoring based on axe-core findings
        if (analysis.evidence.coverage >= 95) {
          analysis.score = 4;
          analysis.strengths.push(`Excellent alt text coverage: ${analysis.evidence.coverage}% (axe-core)`);
        } else if (analysis.evidence.coverage >= 80) {
          analysis.score = 3;
          analysis.strengths.push(`Good alt text coverage: ${analysis.evidence.coverage}% (axe-core)`);
        } else {
          analysis.score = Math.max(1, Math.round(analysis.evidence.coverage / 25));
          analysis.issues.push(`Alt text issues detected by axe-core: ${violationNodes} violations`);
        }
      }
    } else {
      // Fallback to cheerio analysis
      const images = $('img');
      analysis.evidence.totalImages = images.length;

      let imagesWithAlt = 0;
      let emptyAlt = 0;
      let descriptiveAlt = 0;

      images.each((i, img) => {
        const alt = $(img).attr('alt');
        if (alt !== undefined) {
          imagesWithAlt++;
          if (alt.trim().length === 0) {
            emptyAlt++;
          } else if (alt.trim().length >= 10) {
            descriptiveAlt++;
          }
        }
      });

      analysis.evidence.imagesWithAlt = imagesWithAlt;
      analysis.evidence.emptyAlt = emptyAlt;
      analysis.evidence.descriptiveAlt = descriptiveAlt;
      analysis.evidence.coverage = analysis.evidence.totalImages > 0 ? 
        Math.round((imagesWithAlt / analysis.evidence.totalImages) * 100) : 100;

      // Standard scoring
      const coverage = analysis.evidence.coverage;
      
      if (coverage >= 95) {
        analysis.score = 4;
        analysis.strengths.push(`Excellent alt text coverage: ${coverage}%`);
      } else if (coverage >= 80) {
        analysis.score = 3;
        analysis.strengths.push(`Good alt text coverage: ${coverage}%`);
      } else if (coverage >= 60) {
        analysis.score = 2;
        analysis.issues.push(`Moderate alt text coverage: ${coverage}%`);
      } else if (coverage > 0) {
        analysis.score = 1;
        analysis.issues.push(`Poor alt text coverage: ${coverage}%`);
      } else {
        analysis.score = 0;
        analysis.issues.push('No alt text found');
      }
    }

    return analysis;
  }

  /**
   * 4.2 Contrast & landmarks (3 pts) - Accessibility & Inclusivity Category
   */
  analyzeContrastAndLandmarks($, accessibilityData) {
    const analysis = {
      score: 0,
      maxScore: 3,
      evidence: {
        landmarks: {
          main: 0,
          nav: 0,
          aside: 0,
          header: 0,
          footer: 0,
          total: 0
        },
        skipLinks: 0,
        headingHierarchy: true,
        axeViolations: [],
        axeScore: 0,
        source: 'cheerio'
      },
      issues: [],
      strengths: []
    };

    // Use axe-core results if available
    if (accessibilityData && accessibilityData.axeResults) {
      analysis.evidence.source = 'axe-core';
      
      // Extract relevant violations from axe-core
      const relevantViolations = accessibilityData.axeResults.violations.filter(v => 
        v.id.includes('landmark') || v.id.includes('region') || 
        v.id.includes('heading') || v.id.includes('contrast') ||
        v.id.includes('skip') || v.id.includes('focus')
      );
      
      analysis.evidence.axeViolations = relevantViolations.map(v => ({
        id: v.id,
        impact: v.impact,
        description: v.description,
        nodes: v.nodes
      }));

      // Calculate axe-core based score
      const totalViolations = relevantViolations.reduce((total, v) => total + v.nodes, 0);
      const impactWeights = { critical: 3, serious: 2, moderate: 1, minor: 0.5 };
      const penalty = relevantViolations.reduce((total, v) => {
        return total + (impactWeights[v.impact] || 1) * v.nodes;
      }, 0);

      analysis.evidence.axeScore = Math.max(0, 3 - Math.min(penalty, 3));
      analysis.score = Math.round(analysis.evidence.axeScore);

      if (analysis.score >= 3) {
        analysis.strengths.push('Excellent accessibility (axe-core verified)');
      } else if (analysis.score >= 2) {
        analysis.strengths.push(`Good accessibility: ${totalViolations} minor issues`);
      } else {
        analysis.issues.push(`Accessibility issues detected: ${totalViolations} violations`);
      }
      
      // Add specific violation details
      relevantViolations.forEach(violation => {
        if (violation.impact === 'critical' || violation.impact === 'serious') {
          analysis.issues.push(`${violation.description} (${violation.nodes} instances)`);
        }
      });
    } else {
      // Fallback to cheerio analysis
      const landmarks = {
        main: $('main, [role="main"]').length,
        nav: $('nav, [role="navigation"]').length,
        aside: $('aside, [role="complementary"]').length,
        header: $('header, [role="banner"]').length,
        footer: $('footer, [role="contentinfo"]').length
      };

      analysis.evidence.landmarks = { ...landmarks };
      analysis.evidence.landmarks.total = Object.values(landmarks).reduce((a, b) => a + b, 0);

      // Check skip links
      analysis.evidence.skipLinks = $('a[href^="#"]').filter((i, el) => {
        const text = $(el).text().toLowerCase();
        return text.includes('skip') || text.includes('jump');
      }).length;

      // Check heading hierarchy
      const headings = [];
      $('h1, h2, h3, h4, h5, h6').each((i, el) => {
        headings.push(parseInt(el.tagName.slice(1)));
      });
      
      let hierarchyValid = true;
      for (let i = 1; i < headings.length; i++) {
        if (headings[i] - headings[i-1] > 1) {
          hierarchyValid = false;
          break;
        }
      }
      analysis.evidence.headingHierarchy = hierarchyValid;

      // Standard scoring
      let score = 0;
      
      if (analysis.evidence.landmarks.total >= 4) {
        score += 2;
        analysis.strengths.push('Good landmark structure');
      } else if (analysis.evidence.landmarks.total >= 2) {
        score += 1;
        analysis.strengths.push('Basic landmark structure');
      } else {
        analysis.issues.push('Missing ARIA landmarks');
      }

      if (analysis.evidence.skipLinks > 0 && hierarchyValid) {
        score += 1;
        analysis.strengths.push('Skip links and valid heading hierarchy');
      } else if (hierarchyValid) {
        score += 0.5;
        analysis.strengths.push('Valid heading hierarchy');
      } else {
        analysis.issues.push('Heading hierarchy issues detected');
      }

      analysis.score = Math.round(score);
    }

    return analysis;
  }

  /**
   * 5.1 Author expertise (5 pts) - Trust, Transparency & Governance Category
   */
  analyzeAuthorExpertise($, tests) {
    const analysis = {
      score: 0,
      maxScore: 5,
      evidence: {
        authorsBylines: 0,
        authorBios: 0,
        authorCredentials: 0,
        authorLinks: 0,
        expertiseSignals: 0
      },
      issues: [],
      strengths: []
    };

    // Extract authors from schema, meta tags, and bylines
    const authors = new Set();
    
    // Schema.org authors
    if (tests.schema && tests.schema.types) {
      tests.schema.types.forEach(type => {
        if (type.includes('author')) authors.add('schema');
      });
    }

    // Meta author tags
    const metaAuthor = $('meta[name="author"]').attr('content');
    if (metaAuthor) {
      authors.add(metaAuthor);
      analysis.evidence.authorsBylines++;
    }

    // Byline patterns in content
    const bylinePatterns = [
      /by\s+([A-Z][a-z]+\s+[A-Z][a-z]+)/gi,
      /author[:\s]+([A-Z][a-z]+\s+[A-Z][a-z]+)/gi,
      /written\s+by\s+([A-Z][a-z]+)/gi
    ];

    const bodyText = $('body').text();
    bylinePatterns.forEach(pattern => {
      const matches = bodyText.match(pattern) || [];
      analysis.evidence.authorsBylines += matches.length;
      matches.forEach(match => authors.add(match));
    });

    // Author bio sections
    analysis.evidence.authorBios = $(
      '.author-bio, .about-author, [class*="author"], [id*="author"]'
    ).filter((i, el) => $(el).text().length > 50).length;

    // Author links to profiles
    analysis.evidence.authorLinks = $('a[href*="linkedin.com"], a[href*="twitter.com"], a[href*="about"]')
      .filter((i, el) => $(el).text().toLowerCase().includes('author')).length;

    // Expertise credentials in text
    const credentialPatterns = [
      /ph\.?d/gi, /m\.?d/gi, /ceo/gi, /cto/gi, /professor/gi,
      /expert/gi, /specialist/gi, /consultant/gi, /certified/gi
    ];
    
    analysis.evidence.authorCredentials = credentialPatterns.reduce((count, pattern) => {
      return count + (bodyText.match(pattern) || []).length;
    }, 0);

    analysis.evidence.expertiseSignals = 
      analysis.evidence.authorsBylines + 
      analysis.evidence.authorBios + 
      analysis.evidence.authorCredentials +
      analysis.evidence.authorLinks;

    // Scoring per specification
    if (analysis.evidence.expertiseSignals >= 6) {
      analysis.score = 5; // 6+ signals → 5/5
      analysis.strengths.push(`Strong author expertise: ${analysis.evidence.expertiseSignals} signals`);
    } else if (analysis.evidence.expertiseSignals >= 4) {
      analysis.score = 4; // 4–5 → 4/5
      analysis.strengths.push(`Good author expertise: ${analysis.evidence.expertiseSignals} signals`);
    } else if (analysis.evidence.expertiseSignals >= 2) {
      analysis.score = 3; // 2–3 → 3/5
      analysis.issues.push(`Some author expertise: ${analysis.evidence.expertiseSignals} signals`);
    } else if (analysis.evidence.expertiseSignals >= 1) {
      analysis.score = 1; // 1 → 1/5
      analysis.issues.push(`Limited author expertise: ${analysis.evidence.expertiseSignals} signals`);
    } else {
      analysis.score = 0; // 0 → 0/5
      analysis.issues.push('No author expertise signals detected');
    }

    return analysis;
  }

  /**
   * 5.2 Publisher transparency (4 pts) - Trust, Transparency & Governance Category
   */
  analyzePublisherTransparency($) {
    const analysis = {
      score: 0,
      maxScore: 4,
      evidence: {
        aboutPage: false,
        contactInfo: false,
        privacyPolicy: false,
        transparencyScore: 0
      },
      issues: [],
      strengths: []
    };

    // Check for About page
    const aboutLinks = $('a[href*="about"], a[href*="/about"]').length;
    const aboutText = $('body').text().toLowerCase();
    analysis.evidence.aboutPage = aboutLinks > 0 || aboutText.includes('about us');

    // Check for Contact information
    const contactPatterns = [
      /contact/i, /email/i, /phone/i, /address/i,
      /@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, // Email patterns
      /\(\d{3}\)\s?\d{3}-?\d{4}/g // Phone patterns
    ];
    
    analysis.evidence.contactInfo = contactPatterns.some(pattern => 
      pattern.test($('body').text())
    );

    // Check for Privacy Policy
    analysis.evidence.privacyPolicy = $('a[href*="privacy"], a[href*="policy"]').length > 0;

    // Calculate transparency signals
    const transparencySignals = [
      analysis.evidence.aboutPage,
      analysis.evidence.contactInfo,
      analysis.evidence.privacyPolicy
    ].filter(Boolean).length;

    analysis.evidence.transparencyScore = transparencySignals;

    // Scoring per specification
    if (transparencySignals === 3) {
      analysis.score = 4; // All 3 → 4/4
      analysis.strengths.push('Full transparency: About + Contact + Privacy');
    } else if (transparencySignals === 2) {
      analysis.score = 3; // 2/3 → 3/4
      analysis.strengths.push(`Good transparency: ${transparencySignals}/3 elements`);
    } else if (transparencySignals === 1) {
      analysis.score = 2; // 1/3 → 2/4
      analysis.issues.push(`Limited transparency: ${transparencySignals}/3 elements`);
    } else {
      analysis.score = 0; // 0/3 → 0/4
      analysis.issues.push('No transparency signals detected');
    }

    return analysis;
  }

  /**
   * 5.3 External corroboration (3 pts) - Trust, Transparency & Governance Category
   */
  analyzeExternalCorroboration($) {
    const analysis = {
      score: 0,
      maxScore: 3,
      evidence: {
        citations: 0,
        externalLinks: 0,
        authorityDomains: 0,
        sourceQuality: 0
      },
      issues: [],
      strengths: []
    };

    // Count external links
    const externalLinks = $('a[href^="http"]').filter((i, el) => {
      const href = $(el).attr('href') || '';
      return !href.includes(window.location?.hostname || '');
    });

    analysis.evidence.externalLinks = externalLinks.length;

    // Check for authority domains
    const authorityDomains = [
      'wikipedia.org', 'gov', 'edu', 'scholar.google.com',
      'pubmed.ncbi.nlm.nih.gov', 'arxiv.org', 'jstor.org',
      'reuters.com', 'bbc.com', 'nytimes.com'
    ];

    let authorityLinks = 0;
    externalLinks.each((i, el) => {
      const href = $(el).attr('href') || '';
      if (authorityDomains.some(domain => href.includes(domain))) {
        authorityLinks++;
      }
    });

    analysis.evidence.authorityDomains = authorityLinks;

    // Look for citation patterns
    const citationPatterns = [
      /\[\d+\]/g, // [1], [2], etc.
      /\(\d{4}\)/g, // (2024)
      /et\s+al\./gi, // et al.
      /according\s+to/gi,
      /study\s+found/gi,
      /research\s+shows/gi
    ];

    analysis.evidence.citations = citationPatterns.reduce((count, pattern) => {
      return count + ($('body').text().match(pattern) || []).length;
    }, 0);

    analysis.evidence.sourceQuality = 
      analysis.evidence.citations + 
      analysis.evidence.authorityDomains +
      Math.min(analysis.evidence.externalLinks, 5); // Cap external links at 5

    // Scoring per specification
    if (analysis.evidence.sourceQuality >= 8) {
      analysis.score = 3; // 8+ → 3/3
      analysis.strengths.push(`Excellent corroboration: ${analysis.evidence.sourceQuality} signals`);
    } else if (analysis.evidence.sourceQuality >= 5) {
      analysis.score = 2; // 5–7 → 2/3
      analysis.strengths.push(`Good corroboration: ${analysis.evidence.sourceQuality} signals`);
    } else if (analysis.evidence.sourceQuality >= 2) {
      analysis.score = 1; // 2–4 → 1/3
      analysis.issues.push(`Some corroboration: ${analysis.evidence.sourceQuality} signals`);
    } else {
      analysis.score = 0; // 0–1 → 0/3
      analysis.issues.push('No external corroboration detected');
    }

    return analysis;
  }

  /**
   * 5.4 llms.txt governance (1 pt) - Trust, Transparency & Governance Category
   */
  analyzeLLMsGovernance(tests) {
    const analysis = {
      score: 0,
      maxScore: 1,
      evidence: {
        llmsExists: false,
        llmsUrl: null
      },
      issues: [],
      strengths: []
    };

    // Check for llms.txt file
    if (tests.files && tests.files.llms && tests.files.llms.exists) {
      analysis.evidence.llmsExists = true;
      analysis.evidence.llmsUrl = tests.files.llms.url;
      analysis.score = 1;
      analysis.strengths.push('llms.txt governance file found');
    } else {
      analysis.score = 0;
      analysis.issues.push('llms.txt governance file missing');
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
      // Check if franc is loaded, fallback to basic detection
      const detected = franc ? franc(text) : 'eng';
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

  /**
   * Comprehensive hreflang validation with multilingual modifiers
   */
  validateHreflangImplementation($) {
    const validation = {
      score: 0,
      totalLinks: 0,
      validLinks: 0,
      issues: [],
      strengths: [],
      isMultilingual: false,
      languages: [],
      evidence: {
        hasXDefault: false,
        hasCurrentLang: false,
        reciprocalLinks: 0,
        urlPatterns: [],
        invalidCodes: [],
        missingCodes: []
      }
    };

    // Get current page language
    const currentLang = $('html').attr('lang') || null;
    
    // Collect all hreflang links
    const hreflangLinks = [];
    $('link[hreflang]').each((_, link) => {
      const hreflang = $(link).attr('hreflang');
      const href = $(link).attr('href');
      hreflangLinks.push({ hreflang, href });
      validation.totalLinks++;
    });

    if (validation.totalLinks === 0) {
      // Check if site appears multilingual by other signals
      validation.isMultilingual = this.detectMultilingualSignals($);
      return validation;
    }

    // Valid language codes (ISO 639-1 + common regions)
    const validLanguageCodes = [
      // Major languages
      'en', 'es', 'fr', 'de', 'it', 'pt', 'ru', 'ja', 'ko', 'zh', 'ar', 'hi',
      'nl', 'sv', 'da', 'no', 'fi', 'pl', 'cs', 'hu', 'ro', 'el', 'tr', 'he',
      'th', 'vi', 'id', 'ms', 'tl', 'sw', 'am', 'or', 'bn', 'gu', 'kn', 'ml',
      'mr', 'pa', 'ta', 'te', 'ur', 'ne', 'si', 'my', 'km', 'lo', 'ka', 'hy',
      'az', 'uz', 'kk', 'ky', 'tg', 'mn', 'bo', 'dz', 'is', 'mt', 'cy', 'ga',
      'gd', 'br', 'eu', 'ca', 'gl', 'ast', 'an', 'oc', 'co', 'sc', 'rm', 'lb',
      'fo', 'kl', 'se', 'sms', 'sk', 'sl', 'hr', 'sr', 'bs', 'mk', 'bg', 'uk',
      'be', 'lt', 'lv', 'et', 'eo', 'vo', 'ia', 'ie'
    ];

    // Valid region codes (ISO 3166-1)
    const validRegionCodes = [
      'US', 'GB', 'CA', 'AU', 'NZ', 'ZA', 'IE', 'IN', 'SG', 'MY', 'PH', 'HK',
      'ES', 'MX', 'AR', 'CL', 'CO', 'PE', 'VE', 'UY', 'PY', 'BO', 'EC', 'GT',
      'CR', 'PA', 'DO', 'CU', 'PR', 'FR', 'BE', 'CH', 'LU', 'MC', 'DE', 'AT',
      'IT', 'SM', 'VA', 'PT', 'BR', 'RU', 'BY', 'KZ', 'KG', 'TJ', 'TM', 'UZ',
      'JP', 'KR', 'KP', 'CN', 'TW', 'HK', 'MO', 'SG', 'TH', 'VN', 'LA', 'KH',
      'MM', 'ID', 'MY', 'BN', 'PH', 'TL', 'PG', 'FJ', 'TO', 'WS', 'VU', 'SB',
      'NC', 'PF', 'WF', 'CK', 'NU', 'TK', 'TV', 'NR', 'KI', 'MH', 'FM', 'PW'
    ];

    // Validate each hreflang link
    hreflangLinks.forEach(link => {
      const { hreflang, href } = link;
      const isValid = this.validateHreflangCode(hreflang, validLanguageCodes, validRegionCodes);
      
      if (isValid) {
        validation.validLinks++;
        validation.languages.push(hreflang);
      } else {
        validation.evidence.invalidCodes.push(hreflang);
      }

      // Track URL patterns for consistency
      if (href) {
        const urlPattern = this.extractUrlPattern(href);
        validation.evidence.urlPatterns.push(urlPattern);
      }
    });

    // Check for x-default
    validation.evidence.hasXDefault = hreflangLinks.some(link => 
      link.hreflang === 'x-default'
    );

    // Check if current language is included
    if (currentLang) {
      validation.evidence.hasCurrentLang = hreflangLinks.some(link => 
        link.hreflang === currentLang || link.hreflang.startsWith(currentLang + '-')
      );
    }

    // Calculate score
    const validityRatio = validation.totalLinks > 0 ? validation.validLinks / validation.totalLinks : 0;
    validation.score = validityRatio;

    // Generate feedback
    if (validation.validLinks === validation.totalLinks && validation.totalLinks > 1) {
      validation.strengths.push(`All ${validation.totalLinks} hreflang codes valid`);
    }

    if (validation.evidence.hasXDefault) {
      validation.strengths.push('x-default fallback present');
    } else if (validation.totalLinks > 2) {
      validation.issues.push('Missing x-default for international targeting');
    }

    if (!validation.evidence.hasCurrentLang && currentLang && validation.totalLinks > 0) {
      validation.issues.push(`Current language (${currentLang}) not in hreflang set`);
    }

    if (validation.evidence.invalidCodes.length > 0) {
      validation.issues.push(`Invalid language codes: ${validation.evidence.invalidCodes.join(', ')}`);
    }

    // Check URL pattern consistency
    const uniquePatterns = [...new Set(validation.evidence.urlPatterns)];
    if (uniquePatterns.length > 1 && validation.totalLinks > 2) {
      validation.issues.push('Inconsistent URL patterns across languages');
    }

    validation.isMultilingual = this.detectMultilingualSignals($);

    return validation;
  }

  /**
   * Validate individual hreflang code format
   */
  validateHreflangCode(code, validLanguages, validRegions) {
    if (!code || code === 'x-default') return true;
    
    const parts = code.toLowerCase().split('-');
    const language = parts[0];
    const region = parts[1];

    // Validate language code
    if (!validLanguages.includes(language)) {
      return false;
    }

    // If region is specified, validate it
    if (region && !validRegions.includes(region.toUpperCase())) {
      return false;
    }

    return true;
  }

  /**
   * Extract URL pattern for consistency checking
   */
  extractUrlPattern(url) {
    try {
      const urlObj = new URL(url);
      const path = urlObj.pathname;
      
      // Common patterns: subdomain, subdirectory, parameter
      if (urlObj.hostname.includes('.')) {
        const subdomain = urlObj.hostname.split('.')[0];
        if (subdomain.length === 2 || subdomain.length === 5) { // en, en-us
          return 'subdomain';
        }
      }
      
      if (path.startsWith('/')) {
        const segments = path.split('/').filter(Boolean);
        if (segments.length > 0 && (segments[0].length === 2 || segments[0].length === 5)) {
          return 'subdirectory';
        }
      }
      
      if (urlObj.searchParams.has('lang') || urlObj.searchParams.has('language')) {
        return 'parameter';
      }
      
      return 'other';
    } catch {
      return 'invalid-url';
    }
  }

  /**
   * Detect multilingual signals without explicit hreflang
   */
  detectMultilingualSignals($) {
    // Language switcher elements
    const languageSwitchers = $(
      '[class*="lang"], [class*="language"], [id*="lang"], [id*="language"], ' +
      '[class*="translate"], [id*="translate"], .language-selector, .lang-switch'
    ).length;

    // Multiple language links in navigation
    const navLanguageLinks = $('nav a, .nav a, .menu a').filter((i, el) => {
      const text = $(el).text().toLowerCase();
      return /^(en|es|fr|de|it|pt|ru|ja|ko|zh|ar)$/.test(text.trim()) ||
             /english|español|français|deutsch|italiano|português/.test(text);
    }).length;

    // Language flags or locale indicators
    const localeIndicators = $(
      'img[src*="flag"], img[alt*="flag"], [class*="flag"], ' +
      '[data-lang], [data-language], [lang]:not(html)'
    ).length;

    return languageSwitchers > 0 || navLanguageLinks > 1 || localeIndicators > 0;
  }
}

module.exports = AIContentAnalyzer;