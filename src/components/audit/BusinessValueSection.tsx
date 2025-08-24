import { useState } from 'react';
import { Target, TrendingUp, Brain, Lightbulb, AlertTriangle, CheckCircle2, ArrowRight, Zap } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import type { AuditResult } from '@/types/audit';
import { getScoreStatus } from '@/lib/utils';

interface BusinessValueSectionProps {
  results: AuditResult;
}

export function BusinessValueSection({ results }: BusinessValueSectionProps) {
  const [showImplementationGuide, setShowImplementationGuide] = useState(false);

  // Calculate AI readiness impact on business
  const calculateBusinessImpact = () => {
    const issues = [];
    const opportunities = [];
    const quickWins = [];
    
    // Schema markup analysis for business impact
    if (!results.tests.schema || results.tests.schema.totalSchemas === 0) {
      issues.push({
        type: 'critical',
        area: 'AI Visibility',
        issue: 'Your website is invisible to AI search engines like ChatGPT, Claude, and Google AI Overviews',
        impact: 'Missing out on AI-driven traffic and customer discovery',
        solution: 'Add structured data to help AI understand your business',
        effort: 'Medium'
      });
      quickWins.push({
        action: 'Implement basic Organization schema',
        benefit: 'AI tools can identify and describe your business',
        timeframe: '1-2 hours'
      });
    } else if (results.tests.schema.types.length < 3) {
      opportunities.push({
        area: 'AI Understanding',
        current: `AI sees ${results.tests.schema.types.length} content type(s)`,
        opportunity: 'Add more schema types to improve AI comprehension',
        benefit: 'Better representation in AI search results'
      });
    }

    // SEO structure for AI parsing
    if (results.tests.seo) {
      if (results.tests.seo.h1Count !== 1) {
        issues.push({
          type: 'warning',
          area: 'Content Structure', 
          issue: `${results.tests.seo.h1Count} H1 headings found (should be exactly 1)`,
          impact: 'AI tools struggle to understand page topic and hierarchy',
          solution: 'Use one clear H1 that describes the main page topic',
          effort: 'Easy'
        });
        quickWins.push({
          action: 'Fix heading hierarchy (one H1, logical H2-H6)',
          benefit: 'AI can better extract and summarize your content',
          timeframe: '30 minutes'
        });
      }

      if (!results.tests.seo.description || results.tests.seo.description.length < 100) {
        issues.push({
          type: 'warning',
          area: 'AI Summarization',
          issue: 'Missing or short meta description',
          impact: 'AI tools lack context for accurate content summarization',
          solution: 'Write descriptive meta descriptions (120-160 characters)',
          effort: 'Easy'
        });
      }
    }

    // Technical foundations
    if (results.tests.files) {
      if (!results.tests.files.sitemap?.exists) {
        issues.push({
          type: 'warning',
          area: 'AI Crawling',
          issue: 'No sitemap.xml found',
          impact: 'AI crawlers may miss important pages on your site',
          solution: 'Create an XML sitemap listing all important pages',
          effort: 'Easy'
        });
      }

      if (!results.tests.files.robots?.exists) {
        quickWins.push({
          action: 'Add robots.txt file',
          benefit: 'Guide AI crawlers to your most important content',
          timeframe: '15 minutes'
        });
      }
    }

    // Performance impact on AI indexing
    if (results.tests.performance && results.tests.performance.responseTime > 3000) {
      issues.push({
        type: 'warning',
        area: 'AI Indexing',
        issue: `Slow loading time (${results.tests.performance.responseTime}ms)`,
        impact: 'AI crawlers may timeout or skip slow pages',
        solution: 'Optimize images, reduce server response time',
        effort: 'Medium'
      });
    }

    return { issues, opportunities, quickWins };
  };

  const businessImpact = calculateBusinessImpact();
  const overallScore = calculateOverallAIReadiness();

  function calculateOverallAIReadiness() {
    let score = 0;

    // Schema data (40% weight)
    const schemaScore = (results.tests.schema?.totalSchemas || 0) > 0 ? 
      Math.min(40, (results.tests.schema?.totalSchemas || 0) * 15) : 0;
    score += schemaScore;

    // Content structure (30% weight)  
    const seoScore = results.tests.seo ? 
      (results.tests.seo.title ? 10 : 0) +
      (results.tests.seo.description ? 10 : 0) +
      (results.tests.seo.h1Count === 1 ? 10 : 0) : 0;
    score += seoScore;

    // Technical foundations (20% weight)
    const techScore = results.tests.files ?
      (results.tests.files.sitemap?.exists ? 10 : 0) +
      (results.tests.files.robots?.exists ? 10 : 0) : 0;
    score += techScore;

    // Performance (10% weight)
    const responseTime = results.tests.performance?.responseTime || 5000;
    const perfScore = responseTime < 2000 ? 10 : responseTime < 4000 ? 5 : 0;
    score += perfScore;

    return Math.round(score);
  }

  const getImpactColor = (type: string) => {
    return type === 'critical' ? 'text-red-600' : 'text-amber-600';
  };

  const getImpactBg = (type: string) => {
    return type === 'critical' ? 'bg-red-50 border-red-200' : 'bg-amber-50 border-amber-200';
  };

  return (
    <div className="space-y-6">
      {/* AI Readiness Score for Business */}
      <Card className="border-primary/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-3 text-xl">
            <Brain className="w-6 h-6 text-primary" />
            AI Search Readiness Report
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            How well your website works with AI tools like ChatGPT, Claude, Google AI Overviews, and AI-powered search
          </p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            <div className="text-center">
              <div className={`text-4xl font-bold mb-2 ${getScoreStatus(overallScore) === 'excellent' ? 'text-emerald-600' :
                getScoreStatus(overallScore) === 'good' ? 'text-green-600' :
                getScoreStatus(overallScore) === 'warning' ? 'text-amber-600' : 'text-red-600'}`}>
                {overallScore}%
              </div>
              <div className="text-sm text-muted-foreground font-medium">AI Readiness Score</div>
            </div>
            
            <div className="text-center">
              <div className="text-4xl font-bold mb-2 text-primary">
                {businessImpact.issues.filter(i => i.type === 'critical').length}
              </div>
              <div className="text-sm text-muted-foreground font-medium">Critical Issues</div>
            </div>
            
            <div className="text-center">
              <div className="text-4xl font-bold mb-2 text-emerald-600">
                {businessImpact.quickWins.length}
              </div>
              <div className="text-sm text-muted-foreground font-medium">Quick Wins</div>
            </div>
          </div>

          <div className="paper-meta">
            <p className="text-sm font-medium mb-1">What This Means for Your Business</p>
            <p className="text-xs text-foreground">
              {overallScore >= 80 ? 
                "Your website is well-optimized for AI search engines. Customers can easily discover your business through AI tools." :
                overallScore >= 60 ?
                "Your website has good AI compatibility, but improvements could increase your visibility in AI search results." :
                overallScore >= 40 ?
                "Your website needs significant improvements to be discovered by AI search engines and tools." :
                "Your website is largely invisible to AI search engines. You're missing potential customers who use AI tools to find businesses."
              }
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Critical Issues */}
      {businessImpact.issues.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg text-foreground">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              Issues Affecting Your AI Visibility
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {businessImpact.issues.map((issue, index) => (
              <div key={index} className={`p-4 rounded-lg border ${getImpactBg(issue.type)}`}>
                <div className="flex items-start gap-3">
                  <AlertTriangle className={`w-5 h-5 mt-0.5 ${getImpactColor(issue.type)}`} />
                  <div className="flex-1">
                    <h4 className="font-semibold text-foreground mb-1">{issue.area}: {issue.issue}</h4>
                    <p className="text-sm text-muted-foreground mb-2">{issue.impact}</p>
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-foreground">{issue.solution}</p>
                      <span className={`px-2 py-1 text-xs rounded ${
                        issue.effort === 'Easy' ? 'bg-green-100 text-green-700' :
                        issue.effort === 'Medium' ? 'bg-amber-100 text-amber-700' :
                        'bg-red-100 text-red-700'
                      }`}>
                        {issue.effort}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Quick Wins */}
      {businessImpact.quickWins.length > 0 && (
        <Card className="border-emerald-200 bg-emerald-50/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg text-foreground">
              <Zap className="w-5 h-5 text-emerald-600" />
              Quick Wins to Improve AI Visibility
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Easy improvements that will help AI tools better understand and promote your business
            </p>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {businessImpact.quickWins.map((win, index) => (
                <div key={index} className="flex items-start gap-3 p-3 bg-white rounded-lg border border-emerald-200">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 mt-0.5" />
                  <div>
                    <h4 className="font-medium text-foreground mb-1">{win.action}</h4>
                    <p className="text-sm text-muted-foreground mb-2">{win.benefit}</p>
                    <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-1 rounded">
                      {win.timeframe}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Business Opportunities */}
      {businessImpact.opportunities.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg text-foreground">
              <TrendingUp className="w-5 h-5 text-blue-600" />
              Opportunities for Growth
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {businessImpact.opportunities.map((opp, index) => (
              <div key={index} className="flex items-start gap-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
                <Lightbulb className="w-5 h-5 text-blue-600 mt-0.5" />
                <div>
                  <h4 className="font-medium text-foreground">{opp.area}</h4>
                  <p className="text-sm text-muted-foreground mt-1">{opp.current}</p>
                  <p className="text-sm font-medium text-foreground mt-1">{opp.opportunity}</p>
                  <p className="text-xs text-blue-700 mt-1">{opp.benefit}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Implementation Guide Toggle */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between text-lg text-foreground">
            <div className="flex items-center gap-2">
              <Target className="w-5 h-5" />
              Implementation Guide
            </div>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => setShowImplementationGuide(!showImplementationGuide)}
            >
              {showImplementationGuide ? 'Hide Guide' : 'Show Implementation Steps'}
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </CardTitle>
        </CardHeader>
        {showImplementationGuide && (
          <CardContent>
            <div className="space-y-4">
              <div className="p-4 bg-primary/5 rounded-lg border border-primary/20">
                <h4 className="font-semibold text-foreground mb-2">Priority 1: Add Structured Data</h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• Add Organization schema to your homepage</li>
                  <li>• Include business name, address, phone number, and website</li>
                  <li>• Add appropriate schema for your business type (LocalBusiness, Store, etc.)</li>
                  <li>• Test your structured data with Google's Rich Results Test</li>
                </ul>
              </div>
              
              <div className="p-4 bg-secondary/50 rounded-lg border border-border">
                <h4 className="font-semibold text-foreground mb-2">Priority 2: Optimize Content Structure</h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• Use exactly one H1 tag per page that clearly describes the page topic</li>
                  <li>• Create logical heading hierarchy (H1 → H2 → H3)</li>
                  <li>• Write comprehensive meta descriptions (120-160 characters)</li>
                  <li>• Use descriptive, keyword-rich page titles</li>
                </ul>
              </div>

              <div className="p-4 bg-emerald-50 rounded-lg border border-emerald-200">
                <h4 className="font-semibold text-foreground mb-2">Priority 3: Technical Foundations</h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• Create and submit an XML sitemap</li>
                  <li>• Add robots.txt file with proper directives</li>
                  <li>• Optimize page loading speeds (under 2 seconds)</li>
                  <li>• Ensure mobile-friendly responsive design</li>
                </ul>
              </div>
            </div>
          </CardContent>
        )}
      </Card>
    </div>
  );
}