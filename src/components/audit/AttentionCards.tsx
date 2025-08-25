import { TrendingUp, Zap, Eye, FileText, Search, Code } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { calculateAttentionScores, getScoreStatus, getWittyCopy } from '@/lib/utils';
import type { AuditResult } from '@/types/audit';

interface AttentionCardsProps {
  results: AuditResult;
}

export function AttentionCards({ results }: AttentionCardsProps) {
  const scores = calculateAttentionScores(results);

  const cards = [
    {
      title: 'SEO Foundation',
      score: scores.seo,
      icon: Search,
      description: 'Search engine optimization compliance and best practices',
      gradient: 'from-blue-500/10 to-blue-600/10',
      borderColor: 'border-blue-500/20',
    },
    {
      title: 'Performance Metrics',
      score: scores.performance,
      icon: Zap,
      description: 'Loading speed, resource efficiency, and Core Web Vitals',
      gradient: 'from-emerald-500/10 to-emerald-600/10',
      borderColor: 'border-emerald-500/20',
    },
    {
      title: 'Accessibility Standards',
      score: scores.accessibility,
      icon: Eye,
      description: 'WCAG compliance and inclusive design principles',
      gradient: 'from-purple-500/10 to-purple-600/10',
      borderColor: 'border-purple-500/20',
    },
    {
      title: 'Schema Markup',
      score: scores.schema,
      icon: Code,
      description: 'Structured data for AI-powered search comprehension',
      gradient: 'from-indigo-500/10 to-indigo-600/10',
      borderColor: 'border-indigo-500/20',
    },
  ];

  return (
    <div className="space-y-8">
      {/* Overall Attention Score */}
      <Card className="border-primary/30 shadow-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-3 text-xl font-serif">
            <TrendingUp className="w-6 h-6 text-primary" />
            AI Comprehension Analysis
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            How well AI systems can understand and interpret your website's content and purpose
          </p>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between mb-6">
            <div className="space-y-2">
              <div className="score-display">{scores.overall}</div>
              <div className="text-sm font-medium text-muted-foreground">
                AI Readiness Score
              </div>
            </div>
            <div className="text-right space-y-1">
              <div className={`text-sm font-medium px-3 py-1 rounded-full border ${
                getScoreStatus(scores.overall) === 'excellent' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                getScoreStatus(scores.overall) === 'good' ? 'bg-green-50 text-green-700 border-green-200' :
                getScoreStatus(scores.overall) === 'warning' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                'bg-red-50 text-red-700 border-red-200'
              }`}>
                {getScoreStatus(scores.overall).toUpperCase()}
              </div>
              <div className="text-xs text-muted-foreground font-mono">
                {results.executionTime}ms analysis
              </div>
            </div>
          </div>
          <Progress 
            value={scores.overall} 
            status={getScoreStatus(scores.overall)} 
            className="h-2 mb-4"
          />
          <div className="paper-meta">
            <p className="text-sm italic text-muted-foreground">
              {getWittyCopy('seo', scores.overall)}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Individual Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {cards.map((card) => {
          const Icon = card.icon;
          const status = getScoreStatus(card.score);
          
          return (
            <Card 
              key={card.title} 
              className="metric-card hover:shadow-lg transition-all duration-200"
            >
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Icon className="w-5 h-5" />
                  {card.title}
                </CardTitle>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {card.description}
                </p>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="text-3xl font-bold text-foreground">{card.score}</div>
                    <div className={`text-sm font-medium px-3 py-1 rounded-full ${
                      status === 'excellent' ? 'bg-emerald-500/20 text-emerald-400' :
                      status === 'good' ? 'bg-green-500/20 text-green-400' :
                      status === 'warning' ? 'bg-amber-500/20 text-amber-400' :
                      'bg-red-500/20 text-red-400'
                    }`}>
                      {status}
                    </div>
                  </div>
                  
                  <Progress value={card.score} status={status} className="h-2" />
                  
                  {/* Show business type and AI-readiness info if this is the schema card */}
                  {card.title === 'Schema Markup' && results.tests.schema && (
                    <div className="mt-2 space-y-2">
                      {/* Business Type Detection */}
                      {results.tests.schema.businessType && (
                        <div className="space-y-1">
                          <p className="text-xs font-medium text-foreground">Business Type:</p>
                          <div className="flex items-center gap-2">
                            <span className="inline-block px-2 py-1 text-xs bg-blue-50 text-blue-700 rounded border border-blue-200 font-medium">
                              {results.tests.schema.businessType.detected}
                            </span>
                            <span className={`text-xs px-1.5 py-0.5 rounded ${
                              results.tests.schema.businessType.confidence === 'high' ? 'bg-green-100 text-green-600' :
                              results.tests.schema.businessType.confidence === 'medium' ? 'bg-yellow-100 text-yellow-600' :
                              'bg-gray-100 text-gray-600'
                            }`}>
                              {results.tests.schema.businessType.confidence} confidence
                            </span>
                            {results.tests.schema.businessType.scope === 'english-only' && (
                              <span className="text-xs px-1.5 py-0.5 bg-orange-100 text-orange-600 rounded" title="Detection based on English keywords">
                                🇬🇧 EN
                              </span>
                            )}
                          </div>
                        </div>
                      )}
                      
                      {/* Schema Types */}
                      {results.tests.schema.types && results.tests.schema.types.length > 0 && (
                        <div className="space-y-1">
                          <p className="text-xs font-medium text-foreground">Schema Types ({results.tests.schema.types.length}):</p>
                          <div className="flex flex-wrap gap-1">
                            {results.tests.schema.types.slice(0, 3).map((type: string, index: number) => (
                              <span 
                                key={index}
                                className="inline-block px-1.5 py-0.5 text-xs bg-indigo-50 text-indigo-700 rounded border border-indigo-200"
                              >
                                {type}
                              </span>
                            ))}
                            {results.tests.schema.types.length > 3 && (
                              <span className="text-xs text-muted-foreground font-mono">
                                +{results.tests.schema.types.length - 3}
                              </span>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                  
                  <p className="text-xs text-muted-foreground italic">
                    {getWittyCopy(card.title.toLowerCase().split(' ')[0], card.score)}
                  </p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Technical Details (Academic Paper Style) */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg border-b border-border pb-3">
            <FileText className="w-5 h-5" />
            Technical Analysis Summary
          </CardTitle>
        </CardHeader>
        <CardContent className="academic-prose">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Methodology */}
            <div>
              <h4 className="academic-subsection text-foreground font-medium">Methodology</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>• <strong className="text-foreground">Mode:</strong> {results.mode} analysis</li>
                <li>• <strong className="text-foreground">Execution time:</strong> {results.executionTime}ms</li>
                <li>• <strong className="text-foreground">Timestamp:</strong> {new Date(results.timestamp).toLocaleString()}</li>
                <li>• <strong className="text-foreground">Target:</strong> <code className="text-primary">{results.url}</code></li>
              </ul>
            </div>

            {/* Key Findings */}
            <div>
              <h4 className="academic-subsection text-foreground font-medium">Key Findings</h4>
              <div className="space-y-2 text-sm">
                {results.tests.seo && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">SEO Title Length:</span>
                    <span className="font-mono">{results.tests.seo.title?.length || 0} chars</span>
                  </div>
                )}
                {results.tests.performance && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Response Time:</span>
                    <span className="font-mono">{results.tests.performance.responseTime}ms</span>
                  </div>
                )}
                {results.tests.accessibility && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Accessibility Issues:</span>
                    <span className="font-mono">{results.tests.accessibility.issues?.length || 0}</span>
                  </div>
                )}
                {results.tests.schema && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Schema Types:</span>
                    <span className="font-mono">{results.tests.schema.types?.length || 0}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Academic-style conclusion */}
          <div className="mt-6 pt-6 border-t border-border">
            <p className="text-sm text-muted-foreground italic leading-relaxed">
              <strong className="text-foreground">AI Comprehension Assessment:</strong> Your website achieves an AI readiness score of{' '}
              <span className="text-foreground font-semibold">{scores.overall}/100</span>, indicating{' '}
              <span className="text-primary">{getScoreStatus(scores.overall)}</span> machine comprehension capability.
              This reflects how effectively AI systems can understand your business, content, and purpose.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}