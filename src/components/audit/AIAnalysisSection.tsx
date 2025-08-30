import { Brain, Search, FileText, Globe, Shield } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { getScoreStatus } from '@/lib/utils';
import type { AuditResult } from '@/types/audit';

interface AIAnalysisSectionProps {
  results: AuditResult;
}

// Helper function to analyze title length
const getTitleLengthAnalysis = (length: number): string => {
  if (length === 0) return '(⚠️ Missing title)';
  if (length < 30) return '(⚠️ Too short - expand for better context)';
  if (length <= 60) return '(✅ Good length for most searches)';
  if (length <= 70) return '(⚡ Acceptable - may truncate on mobile)';
  return '(⚠️ Too long - will be truncated in search results)';
};

// Helper function to analyze heading hierarchy
const getHeadingAnalysis = (h1Count: number): string => {
  if (h1Count === 0) return '(🚨 Missing H1 - add main page heading)';
  if (h1Count === 1) return '(✅ Perfect hierarchy)';
  if (h1Count <= 3) return '(⚠️ Multiple H1s - merge or restructure)';
  return '(🚨 Too many H1s - serious hierarchy issues)';
};

export function AIAnalysisSection({ results }: AIAnalysisSectionProps) {
  // Calculate AI readiness score based on multiple factors
  const calculateAIReadiness = () => {
    let score = 0;
    let maxScore = 0;

    // Schema markup (40 points)
    if (results.tests.schema) {
      maxScore += 40;
      score += Math.min(results.tests.schema.score * 0.4, 40);
    }

    // SEO structure (30 points)
    if (results.tests.seo) {
      maxScore += 30;
      if (results.tests.seo.title && results.tests.seo.description) score += 15;
      if (results.tests.seo.h1Count === 1) score += 10;
      if (results.tests.seo.h2Count > 0) score += 5;
    }

    // Technical files (20 points)
    if (results.tests.files) {
      maxScore += 20;
      if (results.tests.files.robots.exists) score += 10;
      if (results.tests.files.sitemap.exists) score += 10;
    }

    // Accessibility (10 points)
    if (results.tests.accessibility) {
      maxScore += 10;
      if (results.tests.accessibility.hasLang) score += 5;
      if (results.tests.accessibility.imagesWithoutAlt === 0) score += 5;
    }

    return maxScore > 0 ? Math.round((score / maxScore) * 100) : 0;
  };

  const aiReadinessScore = calculateAIReadiness();
  const aiStatus = getScoreStatus(aiReadinessScore);

  const aiFactors = [
    {
      title: 'Structured Data',
      icon: FileText,
      score: results.tests.schema?.score || 0,
      description: 'JSON-LD and microdata for AI comprehension',
      helpLink: 'https://developers.google.com/search/docs/appearance/structured-data/intro',
      findings: results.tests.schema ? [
        `${results.tests.schema.totalSchemas} schema types detected`,
        `${results.tests.schema.jsonLdCount} JSON-LD scripts found`,
        results.tests.schema.types?.length > 0 ? `Types: ${results.tests.schema.types.join(', ')}` : 'No structured data found',
        results.tests.schema.businessType ? `Business type: ${results.tests.schema.businessType.type} (${Math.round((Number(results.tests.schema.businessType.confidence) || 0) * 100)}% confidence)` : '',
        results.tests.schema.aiReadinessScore ? `AI readiness: ${results.tests.schema.aiReadinessScore}/100 for detected business type` : '',
        results.tests.schema.contentValidation?.matchPercentage ? `Content match: ${results.tests.schema.contentValidation.matchPercentage}% schema-to-content accuracy` : ''
      ].filter(Boolean) : ['Schema analysis unavailable']
    },
    {
      title: 'Content Structure',
      icon: Search,
      score: results.tests.seo ? Math.min(100, (results.tests.seo.h1Count === 1 ? 50 : 0) + (results.tests.seo.h2Count * 5)) : 0,
      description: 'Hierarchical content organization for AI parsing',
      helpLink: 'https://developers.google.com/search/docs/appearance/title-link',
      findings: results.tests.seo ? [
        `${results.tests.seo.h1Count} H1 heading${results.tests.seo.h1Count !== 1 ? 's' : ''} ${getHeadingAnalysis(results.tests.seo.h1Count)}`,
        `${results.tests.seo.h2Count} H2 headings for section structure`,
        `Title: ${results.tests.seo.title?.length || 0} characters ${getTitleLengthAnalysis(results.tests.seo.title?.length || 0)}`
      ] : ['Content analysis unavailable']
    },
    {
      title: 'Site-wide Files',
      icon: Globe,
      score: results.tests.files ? 
        (results.tests.files.robots.exists ? 40 : 0) + 
        (results.tests.files.sitemap.exists ? 40 : 0) + 
        (results.tests.files.llms?.exists ? 20 : 0) : 0,
      description: 'Site-level technical files for AI crawler guidance',
      helpLink: 'https://developers.google.com/search/docs/crawling-indexing/robots/intro',
      findings: results.tests.files ? [
        `robots.txt: ${results.tests.files.robots.exists ? '✓ Present' : '✗ Missing'} (site-wide)`,
        `sitemap.xml: ${results.tests.files.sitemap.exists ? '✓ Present' : '✗ Missing'} (site-wide)`,
        `llms.txt: ${results.tests.files.llms?.exists ? '✓ Present' : '✗ Missing (site-wide, optional)'}`
      ] : ['File analysis unavailable']
    }
  ];

  return (
    <div className="space-y-6">
      {/* Overall AI Readiness Score */}
      <Card className="border-primary/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-3 text-xl">
            <Brain className="w-6 h-6 text-primary" />
            AI Readiness Assessment
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Evaluation of content structure and technical implementation for AI search optimization
          </p>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between mb-4">
            <div className="space-y-1">
              <div className="score-display">{aiReadinessScore}</div>
              <div className="text-sm text-muted-foreground">
                AI Optimization Index
              </div>
            </div>
            <div className="text-right">
              <div className={`text-sm font-medium px-3 py-1 rounded-full ${
                aiStatus === 'excellent' ? 'bg-emerald-100 text-emerald-700' :
                aiStatus === 'good' ? 'bg-green-100 text-green-700' :
                aiStatus === 'warning' ? 'bg-amber-100 text-amber-700' :
                'bg-red-100 text-red-700'
              }`}>
                {aiStatus.toUpperCase()}
              </div>
            </div>
          </div>
          <Progress value={aiReadinessScore} status={aiStatus} className="h-3 mb-3" />
          <div className="paper-meta">
            <p className="text-sm font-medium mb-1">Scoring Methodology</p>
            <p className="text-xs text-muted-foreground mb-2">
              AI optimization formula: <strong>Schema markup</strong> 40% (machine understanding) + 
              <strong>Content structure</strong> 30% (H1/meta tags) + <strong>Technical files</strong> 20% (robots/sitemap) + 
              <strong>Accessibility</strong> 10% (language/images). Based on modern AI search requirements.
            </p>
            <div className="flex items-center gap-2 text-xs">
              <span className="font-medium text-amber-700">⚠️ Static Analysis Only</span>
              <span className="text-muted-foreground">
                JavaScript-rendered content not analyzed
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Detailed AI Factors */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {aiFactors.map((factor) => {
          const Icon = factor.icon;
          const status = getScoreStatus(factor.score);
          
          return (
            <Card key={factor.title} className="metric-card">
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center justify-between text-base">
                  <div className="flex items-center gap-2">
                    <Icon className="w-4 h-4 text-primary" />
                    {factor.title}
                  </div>
                  {factor.helpLink && (
                    <a 
                      href={factor.helpLink} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-xs text-primary hover:text-primary/80 transition-colors"
                      title="View Google documentation"
                    >
                      📖 Guide
                    </a>
                  )}
                </CardTitle>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {factor.description}
                  {factor.helpLink && (
                    <a 
                      href={factor.helpLink} 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      className="ml-2 text-primary hover:underline"
                    >
                      Learn more →
                    </a>
                  )}
                </p>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="font-mono text-2xl font-bold text-primary">{factor.score}</div>
                    <div className={`text-xs font-medium px-2 py-1 rounded ${
                      status === 'excellent' ? 'bg-emerald-100 text-emerald-700' :
                      status === 'good' ? 'bg-green-100 text-green-700' :
                      status === 'warning' ? 'bg-amber-100 text-amber-700' :
                      'bg-red-100 text-red-700'
                    }`}>
                      {status}
                    </div>
                  </div>
                  
                  <Progress value={factor.score} status={status} className="h-1.5" />
                  
                  <div className="space-y-1">
                    {factor.findings.map((finding, idx) => (
                      <div key={idx} className="text-xs text-muted-foreground font-mono">
                        {finding}
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* AI Analysis Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg border-b border-border pb-3 mb-0">
            <Shield className="w-5 h-5" />
            AI Optimization Recommendations
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="prose prose-sm max-w-none">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h4 className="font-semibold text-sm text-foreground mb-2">Priority Actions</h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  {aiReadinessScore < 70 && results.tests.schema?.totalSchemas === 0 && (
                    <li>• Implement JSON-LD structured data for content type detection</li>
                  )}
                  {results.tests.schema?.businessType?.type && (results.tests.schema?.aiReadinessScore || 0) < 70 && (
                    <li>• Enhance {results.tests.schema.businessType.type} schema with missing critical fields</li>
                  )}
                  {results.tests.schema?.types && results.tests.schema.types.includes('Organization') && !results.tests.schema.types.includes('logo') && (
                    <li>• Add logo field to Organization schema for brand recognition</li>
                  )}
                  {results.tests.schema?.contentValidation?.issues && results.tests.schema.contentValidation.issues.length > 0 && (
                    <li>• Fix schema-content mismatches: {results.tests.schema.contentValidation.issues[0]}</li>
                  )}
                  {results.tests.schema?.contentValidation?.matchPercentage && results.tests.schema.contentValidation.matchPercentage < 70 && (
                    <li>• Review structured data accuracy - only {results.tests.schema.contentValidation.matchPercentage}% content match</li>
                  )}
                  {results.tests.seo?.h1Count === 0 && (
                    <li>• Add H1 heading for main content structure</li>
                  )}
                  {!results.tests.files?.robots?.exists && (
                    <li>• Create robots.txt file at site root to guide AI crawler behavior</li>
                  )}
                  {!results.tests.files?.sitemap?.exists && (
                    <li>• Generate XML sitemap at site root for comprehensive content indexing</li>
                  )}
                  {(results.tests.accessibility?.imagesWithoutAlt || 0) > 0 && (
                    <li>• Add descriptive alt text to {results.tests.accessibility?.imagesWithoutAlt || 0} images</li>
                  )}
                </ul>
              </div>
              <div>
                <h4 className="font-semibold text-sm text-foreground mb-2">AI-Era Technical Implementation</h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• <a href="https://schema.org/Organization" target="_blank" className="text-primary hover:underline">Schema.org markup</a> for enhanced entity recognition</li>
                  {results.tests.schema?.businessType?.type === 'FAQ' && (
                    <li>• <a href="https://developers.google.com/search/docs/appearance/structured-data/faqpage" target="_blank" className="text-primary hover:underline">FAQ Schema</a> for direct answer extraction in AI search</li>
                  )}
                  {results.tests.schema?.businessType?.type === 'HowTo' && (
                    <li>• <a href="https://developers.google.com/search/docs/appearance/structured-data/how-to" target="_blank" className="text-primary hover:underline">HowTo Schema</a> for step-by-step content recognition</li>
                  )}
                  {results.tests.schema?.businessType?.type === 'NewsArticle' && (
                    <li>• <a href="https://developers.google.com/search/docs/appearance/structured-data/article" target="_blank" className="text-primary hover:underline">Article Schema</a> with authorship and E-A-T signals</li>
                  )}
                  <li>• Semantic HTML5 elements for content context</li>
                  <li>• Clear information architecture with logical navigation</li>
                  <li>• Comprehensive meta descriptions for AI summarization</li>
                  <li>• <strong>llms.txt</strong>: Experimental file to control AI training data usage <a href="https://llmstxt.org" target="_blank" className="text-primary hover:underline text-xs">(Learn more)</a></li>
                </ul>
                
                <div className="mt-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
                  <h5 className="text-xs font-semibold text-blue-800 mb-1">🤖 About llms.txt</h5>
                  <p className="text-xs text-blue-700">
                    An emerging standard to control how AI systems access your content. 
                    Similar to robots.txt but for AI training. Still experimental - use if you want 
                    granular control over AI data usage.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}