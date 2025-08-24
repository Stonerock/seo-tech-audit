// services/ai-integration-example.js
// Example of how to integrate the new AI content analyzer

const AIContentAnalyzer = require('./ai-content-analyzer');

/**
 * Enhanced computeAISurfaces function using state-of-the-art NLP with QA improvements
 * Replaces the current regex-based implementation
 */
async function computeAISurfacesAdvanced($, tests) {
  const analyzer = new AIContentAnalyzer();
  
  try {
    // Use the enhanced analyzer with caching and improved algorithms
    const analysis = await analyzer.analyzeAIReadiness($, tests, tests.url || 'unknown');
    
    // Log cache performance for monitoring
    const cacheStats = analyzer.getCacheStats();
    if (cacheStats.hits + cacheStats.misses > 0) {
      console.log(`🚀 Cache Performance: ${cacheStats.hitRate}% hit rate (${cacheStats.hits}/${cacheStats.hits + cacheStats.misses})`);
    }
    
    // Transform the result to match the existing API structure
    return {
      score: analysis.overallScore,
      grade: analysis.grade,
      weights: {
        answerClarity: 25,
        structuredData: 20,
        extractableFacts: 20,
        citations: 15,
        recency: 10,
        technical: 10
      },
      subs: {
        answerClarity: analysis.subMetrics.answerClarity.score,
        structuredData: analysis.subMetrics.structuredData.score,
        extractableFacts: analysis.subMetrics.extractableFacts.score,
        citations: analysis.subMetrics.citations.score,
        recency: analysis.subMetrics.recency.score,
        technical: analysis.subMetrics.technical.score
      },
      recommendations: analysis.recommendations.map(rec => rec.message),
      
      // Enhanced data not available in the old system
      enhanced: {
        language: analysis.language,
        contentType: analysis.insights.contentType,
        entities: analysis.insights.entities,
        readabilityScore: analysis.insights.readabilityScore,
        semanticStructure: analysis.insights.semanticStructure,
        detailedRecommendations: analysis.recommendations,
        cacheInfo: {
          cached: analysis.cached || false,
          cacheAge: analysis.cacheAge || 0
        },
        confidence: {
          language: analysis.language.confidence,
          contentType: analysis.insights.contentType.confidence
        }
      }
    };
  } catch (error) {
    console.error('Advanced AI analysis failed, falling back to basic analysis:', error);
    
    // Fallback to the original implementation if NLP fails
    return computeAISurfacesBasic($, tests);
  }
}

/**
 * Fallback function (the original implementation)
 */
function computeAISurfacesBasic($, tests) {
  // This would be the original regex-based implementation
  // keeping it as a fallback for reliability
  const weights = {
    answerClarity: 25,
    structuredData: 20,
    extractableFacts: 20,
    citations: 15,
    recency: 10,
    technical: 10
  };

  // Original basic scoring logic as fallback
  const bodyText = $('body').text().toLowerCase();
  
  const answerClarity = (() => {
    const h1 = $('h1').length;
    const faqs = $('script[type=\"application/ld+json\"]').filter((_, el) => /FAQPage/.test($(el).html() || '')).length;
    let score = 0;
    if (h1 >= 1) score += 40;
    if (faqs > 0) score += 40;
    if (bodyText.includes('what') || bodyText.includes('how')) score += 20;
    return score;
  })();

  const structuredData = (() => {
    const types = tests.schema?.types?.length || 0;
    const issues = (tests.schema?.requiredIssues || []).length;
    let base = Math.min(100, types * 15);
    base -= Math.min(40, issues * 10);
    return Math.max(0, base);
  })();

  const extractableFacts = (() => {
    let score = 0;
    const hasMeta = Boolean(tests.metadata?.title && tests.metadata?.description);
    const og = tests.metadata?.og || {};
    const hasOG = Boolean(og.title || og.description || og.image);
    if (hasMeta) score += 40;
    if (hasOG) score += 40;
    return score;
  })();

  const citations = (() => {
    const external = $('a[href^=\"http\"]').length;
    let score = 0;
    if (external > 3) score += 60;
    else if (external > 0) score += 40;
    return score;
  })();

  const recency = (() => {
    const hasDates = /202[0-9]/.test(bodyText);
    return hasDates ? 50 : 20;
  })();

  const technical = (() => {
    let score = 0;
    if (tests.seo?.https) score += 30;
    if (tests.files?.robots?.exists) score += 20;
    if (tests.files?.sitemap?.exists) score += 20;
    return score;
  })();

  const subs = { answerClarity, structuredData, extractableFacts, citations, recency, technical };
  const total = (
    answerClarity * (weights.answerClarity / 100) +
    structuredData * (weights.structuredData / 100) +
    extractableFacts * (weights.extractableFacts / 100) +
    citations * (weights.citations / 100) +
    recency * (weights.recency / 100) +
    technical * (weights.technical / 100)
  );

  const score = Math.round(total);
  const grade = score >= 90 ? 'A' : score >= 80 ? 'B' : score >= 70 ? 'C' : score >= 60 ? 'D' : 'F';

  return { score, grade, weights, subs, recommendations: ['Use advanced analysis for better insights'] };
}

/**
 * Migration strategy: Gradual rollout
 */
class AIMigrationStrategy {
  constructor() {
    this.useAdvanced = process.env.USE_ADVANCED_AI === 'true';
    this.fallbackOnError = true;
    this.analyzer = new AIContentAnalyzer();
  }

  async analyzeContent($, tests) {
    if (this.useAdvanced) {
      try {
        return await computeAISurfacesAdvanced($, tests);
      } catch (error) {
        console.warn('Advanced analysis failed, using basic fallback:', error.message);
        if (this.fallbackOnError) {
          return computeAISurfacesBasic($, tests);
        }
        throw error;
      }
    } else {
      return computeAISurfacesBasic($, tests);
    }
  }
}

/**
 * Example usage in server.js:
 * 
 * // Replace the existing computeAISurfaces function with:
 * const { AIMigrationStrategy } = require('./services/ai-integration-example');
 * const aiStrategy = new AIMigrationStrategy();
 * 
 * // In the audit pipeline:
 * results.tests.aiSurfaces = await aiStrategy.analyzeContent($, results.tests);
 */

module.exports = {
  computeAISurfacesAdvanced,
  computeAISurfacesBasic,
  AIMigrationStrategy
};