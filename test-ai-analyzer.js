// test-ai-analyzer.js
// Test the new AI content analyzer

const cheerio = require('cheerio');
const AIContentAnalyzer = require('./services/ai-content-analyzer');

// Test data in multiple languages
const testContent = {
  english: `
    <html lang=\"en\">
    <head><title>How to Build a REST API with Node.js</title></head>
    <body>
      <h1>How to Build a REST API with Node.js</h1>
      <p>This comprehensive guide explains how to create a RESTful API using Node.js and Express. 
         APIs are essential for modern web development, allowing different applications to communicate effectively.</p>
      
      <h2>What is a REST API?</h2>
      <p>REST (Representational State Transfer) is an architectural style for designing networked applications.
         According to research by Roy Fielding, REST APIs provide a stateless, cacheable communication method.</p>
      
      <h2>Step-by-Step Implementation</h2>
      <ol>
        <li>Install Node.js and npm</li>
        <li>Initialize your project with npm init</li>
        <li>Install Express framework</li>
      </ol>
      
      <p>For more information, visit the official <a href=\"https://nodejs.org\">Node.js documentation</a>.</p>
      
      <script type=\"application/ld+json\">
      {
        \"@context\": \"https://schema.org\",
        \"@type\": \"Article\",
        \"headline\": \"How to Build a REST API with Node.js\",
        \"author\": {
          \"@type\": \"Person\",
          \"name\": \"John Developer\"
        },
        \"datePublished\": \"2024-01-15\"
      }
      </script>
    </body>
    </html>
  `,
  
  spanish: `
    <html lang=\"es\">
    <head><title>Cómo construir una API REST con Node.js</title></head>
    <body>
      <h1>Cómo construir una API REST con Node.js</h1>
      <p>Esta guía completa explica cómo crear una API RESTful usando Node.js y Express.
         Las APIs son esenciales para el desarrollo web moderno.</p>
      
      <h2>¿Qué es una API REST?</h2>
      <p>REST es un estilo arquitectónico para diseñar aplicaciones en red.
         Según investigaciones, las APIs REST proporcionan un método de comunicación sin estado.</p>
      
      <p>Para más información, visite la <a href=\"https://nodejs.org\">documentación oficial de Node.js</a>.</p>
    </body>
    </html>
  `,
  
  german: `
    <html lang=\"de\">
    <head><title>Wie man eine REST API mit Node.js erstellt</title></head>
    <body>
      <h1>Wie man eine REST API mit Node.js erstellt</h1>
      <p>Diese umfassende Anleitung erklärt, wie man eine RESTful API mit Node.js und Express erstellt.
         APIs sind wesentlich für die moderne Webentwicklung.</p>
      
      <h2>Was ist eine REST API?</h2>
      <p>REST ist ein Architekturstil für die Gestaltung von Netzwerkanwendungen.
         Laut Forschung bieten REST APIs eine zustandslose Kommunikationsmethode.</p>
    </body>
    </html>
  `
};

async function testAIAnalyzer() {
  console.log('🧪 Testing State-of-the-Art AI Content Analyzer\n');
  
  const analyzer = new AIContentAnalyzer();
  
  for (const [language, html] of Object.entries(testContent)) {
    console.log(`\n📊 Analyzing ${language.toUpperCase()} content:`);
    console.log('=' .repeat(50));
    
    try {
      const $ = cheerio.load(html);
      
      // Mock tests object (simulating the existing test results)
      const mockTests = {
        schema: {
          types: ['Article'],
          requiredIssues: []
        },
        metadata: {
          title: $('title').text(),
          description: 'A comprehensive guide to building REST APIs',
          og: {
            title: $('title').text(),
            description: 'A comprehensive guide',
            image: 'https://example.com/image.jpg'
          }
        },
        seo: {
          https: true
        },
        files: {
          robots: { exists: true },
          sitemap: { exists: true }
        },
        performance: {
          score: {
            fcp: 'good',
            loadTime: 'good'
          }
        }
      };
      
      // Run the advanced analysis
      const startTime = Date.now();
      try {
        console.log('  🔍 Starting analysis...');
        const analysis = await analyzer.analyzeAIReadiness($, mockTests, 'https://example.com');
        const duration = Date.now() - startTime;
        
        // Display results
        console.log(`⏱️  Analysis Time: ${duration}ms`);
        console.log(`🌍 Detected Language: ${analysis.language.language} (${Math.round(analysis.language.confidence * 100)}% confidence)`);
        console.log(`📊 Overall AI Readiness Score: ${analysis.overallScore}/100 (${analysis.grade})`);
        
        console.log(`\n📈 Sub-Metrics:`);
        Object.entries(analysis.subMetrics).forEach(([metric, data]) => {
          const emoji = data.score >= 80 ? '🟢' : data.score >= 60 ? '🟡' : '🔴';
          console.log(`  ${emoji} ${metric}: ${data.score}/100`);
        });
        
        console.log('\n🎯 Content Insights:');
        console.log(`  📝 Content Type: ${analysis.insights.contentType.type} (${Math.round(analysis.insights.contentType.confidence * 100)}% confidence)`);
        if (analysis.insights.contentType.source) {
          console.log(`    📍 Source: ${analysis.insights.contentType.source}`);
        }
        console.log(`  👥 Entities Found: ${analysis.insights.entities.general?.length || 0}`);
        if (analysis.insights.entities.technical?.length > 0) {
          console.log(`  🔧 Technical Terms: ${analysis.insights.entities.technical.slice(0, 3).join(', ')}`);
        }
        
        // Enhanced readability information
        const readability = analysis.insights.readabilityScore;
        console.log(`  📖 Readability: ${readability.grade} (${Math.round(readability.score)}/100)`);
        if (readability.technicalLevel) {
          console.log(`    🔬 Technical Level: ${readability.technicalLevel}`);
        }
        if (readability.complexity) {
          console.log(`    🧠 Complex Sentences: ${readability.complexity.count}/${readability.complexity.total} (${Math.round(readability.complexity.percentage)}%)`);
        }
        
        console.log('\n💡 Top Recommendations:');
        const uniqueRecs = analysis.recommendations.slice(0, 5); // Should now be unique thanks to QA fix
        uniqueRecs.forEach((rec, i) => {
          const priorityEmoji = rec.priority === 'high' ? '🔥' : rec.priority === 'medium' ? '🟡' : '📝';
          console.log(`  ${priorityEmoji} [${rec.priority.toUpperCase()}] ${rec.message}`);
        });
        
        // Cache information
        if (analysis.cached !== undefined) {
          console.log('\n⚡ Performance:');
          console.log(`  💾 Cached: ${analysis.cached ? 'Yes' : 'No'}`);
          if (analysis.cached && analysis.cacheAge) {
            console.log(`  ⏱️ Cache Age: ${analysis.cacheAge}ms`);
          }
        }
        
        // Show cache stats
        const cacheStats = analyzer.getCacheStats();
        if (cacheStats.hits + cacheStats.misses > 0) {
          console.log(`  🚀 Cache Hit Rate: ${cacheStats.hitRate}%`);
          console.log(`  📈 Cache Usage: ${cacheStats.usage}% (${cacheStats.size}/${cacheStats.maxSize})`);
        }
      } catch (analysisError) {
        console.error(`  ❌ Analysis failed: ${analysisError.message}`);
        console.error(`  📍 Stack: ${analysisError.stack}`);
      }
      
    } catch (error) {
      console.error(`❌ Error analyzing ${language} content:`, error.message);
    }
  }
  
  console.log('\n🎉 Analysis Complete!');
  console.log('\n📅 QA Improvements Implemented:');
  console.log('  ✅ Fixed duplicate recommendations using Map-based deduplication');
  console.log('  ✅ Enhanced readability algorithm with sentence complexity analysis');
  console.log('  ✅ Improved content type classification with schema.org detection');
  console.log('  ✅ Added intelligent caching system for performance optimization');
  console.log('  ✅ Language-specific adjustments for technical content');
  console.log('  ✅ Priority-based recommendation sorting');
  console.log('\n📋 Summary of Improvements:');
  console.log('  ✅ Automatic language detection with confidence scoring');
  console.log('  ✅ Semantic content understanding (not just regex)');
  console.log('  ✅ Named entity extraction');
  console.log('  ✅ Content type classification');
  console.log('  ✅ Readability analysis');
  console.log('  ✅ Priority-based recommendations');
  console.log('  ✅ Cross-language compatibility');
}

// Performance comparison with the old system
function testCurrentSystem($, tests) {
  console.log('\n⚡ Current System (Regex-based):');
  
  const startTime = Date.now();
  
  // Simulate the current regex-based approach
  const bodyText = $('body').text().toLowerCase();
  const lang = $('html').attr('lang') || 'en';
  
  const qTerms = {
    en: ['what is', 'how to', 'faq'],
    es: ['qué es', 'cómo', 'preguntas'],
    de: ['was ist', 'wie man', 'faq']
  };
  
  const hasQuestions = (qTerms[lang] || qTerms.en).some(term => bodyText.includes(term));
  const hasH1 = $('h1').length > 0;
  const hasSchema = $('script[type=\"application/ld+json\"]').length > 0;
  
  let score = 0;
  if (hasH1) score += 40;
  if (hasQuestions) score += 30;
  if (hasSchema) score += 30;
  
  const duration = Date.now() - startTime;
  
  console.log(`  ⏱️  Analysis Time: ${duration}ms`);
  console.log(`  🌍 Language: ${lang} (from HTML attribute only)`);
  console.log(`  📊 Basic Score: ${score}/100`);
  console.log(`  🔍 Analysis Depth: Basic pattern matching only`);
  
  return { score, lang, duration };
}

// Run the comparison
if (require.main === module) {
  testAIAnalyzer().catch(console.error);
}

module.exports = { testAIAnalyzer };