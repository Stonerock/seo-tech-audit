import { Brain, Search, FileText, Globe, Shield } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { getScoreStatus } from '@/lib/utils';
import type { AuditResult } from '@/types/audit';

interface AIAnalysisSectionProps {
  results: AuditResult;
}

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
      findings: results.tests.schema ? [
        `${results.tests.schema.totalSchemas} schema types detected`,
        `${results.tests.schema.jsonLdCount} JSON-LD scripts found`,
        results.tests.schema.types.length > 0 ? `Types: ${results.tests.schema.types.join(', ')}` : 'No structured data found'
      ] : ['Schema analysis unavailable']
    },
    {
      title: 'Content Structure',
      icon: Search,
      score: results.tests.seo ? Math.min(100, (results.tests.seo.h1Count === 1 ? 50 : 0) + (results.tests.seo.h2Count * 5)) : 0,
      description: 'Hierarchical content organization for AI parsing',
      findings: results.tests.seo ? [
        `${results.tests.seo.h1Count} H1 heading${results.tests.seo.h1Count !== 1 ? 's' : ''} (optimal: 1)`,
        `${results.tests.seo.h2Count} H2 headings for section structure`,
        `Title: ${results.tests.seo.title?.length || 0} characters`
      ] : ['Content analysis unavailable']
    },
    {
      title: 'Crawlability',
      icon: Globe,
      score: results.tests.files ? 
        (results.tests.files.robots.exists ? 50 : 0) + 
        (results.tests.files.sitemap.exists ? 50 : 0) : 0,
      description: 'Technical foundations for AI crawler access',
      findings: results.tests.files ? [
        `robots.txt: ${results.tests.files.robots.exists ? '✓ Present' : '✗ Missing'}`,
        `sitemap.xml: ${results.tests.files.sitemap.exists ? '✓ Present' : '✗ Missing'}`,
        `llms.txt: ${results.tests.files.llms?.exists ? '✓ Present' : '✗ Missing (optional)'}`
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
            <p className="text-sm font-medium mb-1">Methodology</p>
            <p className="text-xs text-muted-foreground">
              Composite score based on structured data implementation (40%), 
              content hierarchy (30%), crawlability signals (20%), 
              and accessibility compliance (10%).
            </p>
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
                <CardTitle className="flex items-center gap-2 text-base">
                  <Icon className="w-4 h-4 text-primary" />
                  {factor.title}
                </CardTitle>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {factor.description}
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
                  {results.tests.seo?.h1Count !== 1 && (
                    <li>• Optimize heading hierarchy (exactly one H1, logical H2-H6 structure)</li>
                  )}
                  {!results.tests.files?.robots?.exists && (
                    <li>• Create robots.txt file to guide AI crawler behavior</li>
                  )}
                  {!results.tests.files?.sitemap?.exists && (
                    <li>• Generate XML sitemap for comprehensive content indexing</li>
                  )}
                  {(results.tests.accessibility?.imagesWithoutAlt || 0) > 0 && (
                    <li>• Add descriptive alt text to {results.tests.accessibility?.imagesWithoutAlt || 0} images</li>
                  )}
                </ul>
              </div>
              <div>
                <h4 className="font-semibold text-sm text-foreground mb-2">Technical Implementation</h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• Schema.org markup for enhanced entity recognition</li>
                  <li>• Semantic HTML5 elements for content context</li>
                  <li>• Clear information architecture with logical navigation</li>
                  <li>• Comprehensive meta descriptions for AI summarization</li>
                  <li>• LLMS.txt file for AI training preferences (optional)</li>
                </ul>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}