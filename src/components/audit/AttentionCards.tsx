import { TrendingUp, Zap, Eye, FileText, Search } from 'lucide-react';
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
  ];

  return (
    <div className="space-y-8">
      {/* Overall Attention Score */}
      <Card className="border-primary/30 shadow-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-3 text-xl font-serif">
            <TrendingUp className="w-6 h-6 text-primary" />
            Composite Analysis Summary
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Quantitative assessment of technical optimization and AI-readiness factors
          </p>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between mb-6">
            <div className="space-y-2">
              <div className="score-display">{scores.overall}</div>
              <div className="text-sm font-medium text-muted-foreground">
                Overall Optimization Index
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
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
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
              </div>
            </div>
          </div>

          {/* Academic-style conclusion */}
          <div className="mt-6 pt-6 border-t border-border">
            <p className="text-sm text-muted-foreground italic leading-relaxed">
              <strong className="text-foreground">Conclusion:</strong> Analysis indicates a composite attention readiness score of{' '}
              <span className="text-foreground font-semibold">{scores.overall}/100</span>, suggesting{' '}
              <span className="text-primary">{getScoreStatus(scores.overall)}</span> alignment with 
              contemporary search engine optimization paradigms and AI-readiness protocols.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}