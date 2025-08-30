import { Activity, Clock, Zap, Shield, TrendingUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import type { PSIResult } from '@/types/audit';

interface PSIPerformanceSectionProps {
  psiData: PSIResult;
}

export function PSIPerformanceSection({ psiData }: PSIPerformanceSectionProps) {
  // Safety check for undefined performance data - more robust checking
  if (!psiData || !psiData.performance || typeof psiData.performance.score === 'undefined') {
    console.log('PSI data missing:', { psiData, hasPerformance: !!psiData?.performance, score: psiData?.performance?.score });
    return (
      <Card className="border-amber-200 bg-amber-50/50">
        <CardContent className="p-6">
          <div className="text-center text-muted-foreground">
            <Activity className="w-8 h-8 mx-auto mb-2" />
            <p>Performance data not available</p>
            <p className="text-xs mt-1">PSI analysis may have failed or timed out</p>
          </div>
        </CardContent>
      </Card>
    );
  }
  const getScoreColor = (score: number) => {
    if (score >= 90) return 'text-emerald-600';
    if (score >= 70) return 'text-green-600';
    if (score >= 50) return 'text-amber-600';
    return 'text-red-600';
  };

  const getScoreStatus = (score: number): 'excellent' | 'good' | 'warning' | 'poor' => {
    if (score >= 90) return 'excellent';
    if (score >= 70) return 'good';
    if (score >= 50) return 'warning';
    return 'poor';
  };

  const getVitalColor = (status: 'good' | 'needs-improvement' | 'poor') => {
    switch (status) {
      case 'good': return 'text-emerald-600 bg-emerald-50 border-emerald-200';
      case 'needs-improvement': return 'text-amber-600 bg-amber-50 border-amber-200';
      case 'poor': return 'text-red-600 bg-red-50 border-red-200';
    }
  };

  const getVitalLabel = (status: 'good' | 'needs-improvement' | 'poor') => {
    switch (status) {
      case 'good': return 'Good';
      case 'needs-improvement': return 'Needs Improvement';
      case 'poor': return 'Poor';
    }
  };

  return (
    <div className="space-y-6">
      {/* PSI Performance Overview */}
      <Card className="border-primary/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-3 text-xl">
            <Activity className="w-6 h-6 text-primary" />
            PageSpeed Insights Performance
            {psiData.cached && (
              <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full">
                Cached
              </span>
            )}
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Real-world performance data from Google's PageSpeed Insights API
          </p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            {/* Performance Score */}
            <div className="text-center space-y-2">
              <div className={`text-4xl font-bold ${getScoreColor(psiData.performance?.score || 0)}`}>
                {psiData.performance?.score || 0}
              </div>
              <div className="text-sm text-muted-foreground">Performance Score</div>
              <Progress 
                value={psiData.performance?.score || 0} 
                status={getScoreStatus(psiData.performance?.score || 0)} 
                className="h-2" 
              />
            </div>

            {/* SEO Score */}
            {psiData.seo && (
              <div className="text-center space-y-2">
                <div className={`text-4xl font-bold ${getScoreColor(psiData.seo.score)}`}>
                  {psiData.seo.score}
                </div>
                <div className="text-sm text-muted-foreground">SEO Score</div>
                <Progress 
                  value={psiData.seo.score} 
                  status={getScoreStatus(psiData.seo.score)} 
                  className="h-2" 
                />
              </div>
            )}

            {/* Accessibility Score */}
            {psiData.accessibility && (
              <div className="text-center space-y-2">
                <div className={`text-4xl font-bold ${getScoreColor(psiData.accessibility.score)}`}>
                  {psiData.accessibility.score}
                </div>
                <div className="text-sm text-muted-foreground">Accessibility Score</div>
                <Progress 
                  value={psiData.accessibility.score} 
                  status={getScoreStatus(psiData.accessibility.score)} 
                  className="h-2" 
                />
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Core Web Vitals */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Zap className="w-5 h-5" />
            Core Web Vitals
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Key metrics that measure real-world user experience
          </p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Largest Contentful Paint */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-medium text-sm">Largest Contentful Paint</h4>
                  <p className="text-xl font-bold">{psiData.performance.metrics.lcp}</p>
                </div>
                <Clock className="w-5 h-5 text-muted-foreground" />
              </div>
              <div className={`text-xs px-2 py-1 rounded border ${getVitalColor(psiData.performance.coreWebVitals.lcp)}`}>
                {getVitalLabel(psiData.performance.coreWebVitals.lcp)}
              </div>
            </div>

            {/* First Contentful Paint */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-medium text-sm">First Contentful Paint</h4>
                  <p className="text-xl font-bold">{psiData.performance.metrics.fcp}</p>
                </div>
                <TrendingUp className="w-5 h-5 text-muted-foreground" />
              </div>
              <div className={`text-xs px-2 py-1 rounded border ${getVitalColor(psiData.performance.coreWebVitals.fcp)}`}>
                {getVitalLabel(psiData.performance.coreWebVitals.fcp)}
              </div>
            </div>

            {/* Cumulative Layout Shift */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-medium text-sm">Cumulative Layout Shift</h4>
                  <p className="text-xl font-bold">{psiData.performance.metrics.cls}</p>
                </div>
                <Shield className="w-5 h-5 text-muted-foreground" />
              </div>
              <div className={`text-xs px-2 py-1 rounded border ${getVitalColor(psiData.performance.coreWebVitals.cls)}`}>
                {getVitalLabel(psiData.performance.coreWebVitals.cls)}
              </div>
            </div>

            {/* Interaction to Next Paint */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-medium text-sm">Interaction to Next Paint</h4>
                  <p className="text-xl font-bold">{psiData.performance.metrics.inp}</p>
                </div>
                <Activity className="w-5 h-5 text-muted-foreground" />
              </div>
              <div className={`text-xs px-2 py-1 rounded border ${getVitalColor(psiData.performance.coreWebVitals.inp)}`}>
                {getVitalLabel(psiData.performance.coreWebVitals.inp)}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Performance Metrics */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Clock className="w-5 h-5" />
            Additional Performance Metrics
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Speed Index</span>
                <span className="font-medium">{psiData.performance.metrics.speedIndex}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Total Blocking Time</span>
                <span className="font-medium">{psiData.performance.metrics.tbt}</span>
              </div>
            </div>
            <div className="space-y-3">
              <div className="text-xs text-muted-foreground">
                <p>Tested on: {psiData.environment.emulatedDevice || 'Mobile Device'}</p>
                {psiData.environment.networkThrottling && (
                  <p>Network throttling: {psiData.environment.networkThrottling}ms latency</p>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Performance Opportunities */}
      {psiData.opportunities.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <TrendingUp className="w-5 h-5" />
              Performance Opportunities
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Top optimization opportunities to improve performance
            </p>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {psiData.opportunities.slice(0, 5).map((opportunity, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-muted/30 rounded">
                  <div className="flex-1">
                    <h4 className="font-medium text-sm">{opportunity.title}</h4>
                    <p className="text-xs text-muted-foreground mt-1">{opportunity.description}</p>
                  </div>
                  <div className="text-right text-xs">
                    <span className="font-bold text-amber-600">
                      {opportunity.impact > 1000 
                        ? `${Math.round(opportunity.impact / 1000 * 10) / 10}s`
                        : `${opportunity.impact}ms`
                      }
                    </span>
                    <div className="text-muted-foreground">potential savings</div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}