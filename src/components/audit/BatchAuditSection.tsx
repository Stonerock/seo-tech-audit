import { useState } from 'react';
import { Search, Loader2, AlertCircle, CheckCircle2, MapPin, BarChart3, Globe, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { auditService } from '@/services/auditService';
import { isValidURL } from '@/lib/utils';

interface BatchAuditSectionProps {
  onBatchComplete?: (results: any) => void;
}

export function BatchAuditSection({ onBatchComplete }: BatchAuditSectionProps) {
  const [url, setUrl] = useState('');
  const [maxUrls, setMaxUrls] = useState(20);
  const [isDiscovering, setIsDiscovering] = useState(false);
  const [isBatchRunning, setIsBatchRunning] = useState(false);
  const [discoveryResults, setDiscoveryResults] = useState<any>(null);
  const [batchResults, setBatchResults] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [urlError, setUrlError] = useState<string | null>(null);

  // URL validation
  const isUrlValid = url && isValidURL(url) && !urlError;

  const handleUrlChange = (value: string) => {
    setUrl(value);
    if (value && !isValidURL(value)) {
      setUrlError('Please enter a valid URL (e.g., https://example.com)');
    } else {
      setUrlError(null);
    }
  };

  const handleDiscoverSitemap = async () => {
    if (!isUrlValid || isDiscovering) return;

    setIsDiscovering(true);
    setError(null);
    setDiscoveryResults(null);
    setBatchResults(null);

    try {
      const results = await auditService.discoverSitemapUrls(url, maxUrls);
      setDiscoveryResults(results);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to discover sitemap URLs';
      setError(errorMessage);
    } finally {
      setIsDiscovering(false);
    }
  };

  const handleBatchAudit = async () => {
    if (!isUrlValid || isBatchRunning) return;

    setIsBatchRunning(true);
    setError(null);
    setBatchResults(null);

    try {
      const results = await auditService.performBatchAudit(url, maxUrls);
      setBatchResults(results);
      onBatchComplete?.(results);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Batch audit failed';
      setError(errorMessage);
    } finally {
      setIsBatchRunning(false);
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 90) return 'text-emerald-600';
    if (score >= 70) return 'text-green-600';
    if (score >= 50) return 'text-amber-600';
    return 'text-red-600';
  };

  const getScoreStatus = (score: number) => {
    if (score >= 90) return 'excellent';
    if (score >= 70) return 'good';
    if (score >= 50) return 'warning';
    return 'poor';
  };

  return (
    <div className="space-y-6">
      {/* Batch Audit Input */}
      <Card className="border-primary/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-3 text-xl">
            <MapPin className="w-6 h-6 text-primary" />
            Sitemap-Based Batch Analysis
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Discover and audit multiple pages from your website's sitemap for comprehensive analysis
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* URL Input */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2 space-y-1">
              <label className="block text-sm font-medium text-muted-foreground">
                Website URL
              </label>
              <Input
                type="url"
                placeholder="https://example.com"
                value={url}
                onChange={(e) => handleUrlChange(e.target.value)}
                className={urlError ? 'border-destructive' : ''}
              />
              {urlError && (
                <p className="text-sm text-destructive flex items-center gap-1">
                  <AlertCircle className="w-4 h-4" />
                  {urlError}
                </p>
              )}
            </div>

            <div className="space-y-1">
              <label className="block text-sm font-medium text-muted-foreground">
                Max Pages (1-50)
              </label>
              <Input
                type="number"
                min="1"
                max="50"
                value={maxUrls}
                onChange={(e) => setMaxUrls(Math.min(50, Math.max(1, parseInt(e.target.value) || 20)))}
                className="w-full"
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-3">
            <Button
              onClick={handleDiscoverSitemap}
              disabled={!isUrlValid || isDiscovering}
              variant="outline"
              className="flex-1"
            >
              {isDiscovering ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Discovering...
                </>
              ) : (
                <>
                  <Search className="w-4 h-4 mr-2" />
                  Discover Sitemap URLs
                </>
              )}
            </Button>

            <Button
              onClick={handleBatchAudit}
              disabled={!isUrlValid || isBatchRunning}
              size="academic"
              className="flex-1"
            >
              {isBatchRunning ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Running Batch Analysis...
                </>
              ) : (
                <>
                  <BarChart3 className="w-4 h-4 mr-2" />
                  Start Batch Audit
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Error Display */}
      {error && (
        <Card className="border-destructive/20 bg-destructive/5">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-destructive">
              <AlertCircle className="w-5 h-5" />
              <div>
                <h3 className="font-semibold">Batch Analysis Failed</h3>
                <p className="text-sm mt-1">{error}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Discovery Results */}
      {discoveryResults && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Globe className="w-5 h-5" />
              Sitemap Discovery Results
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div className="metric-display">
                <div className="metric-value">{discoveryResults.discoveredUrls}</div>
                <div className="metric-label">URLs Discovered</div>
              </div>
              <div className="metric-display">
                <div className="metric-value">{discoveryResults.sitemaps.filter((s: any) => s.status === 'found').length}</div>
                <div className="metric-label">Sitemaps Found</div>
              </div>
              <div className="metric-display">
                <div className="metric-value">{discoveryResults.executionTime}ms</div>
                <div className="metric-label">Discovery Time</div>
              </div>
            </div>

            {/* Sitemap Status */}
            <div className="space-y-2">
              <h4 className="font-semibold text-sm">Discovered Sitemaps</h4>
              {discoveryResults.sitemaps.map((sitemap: any, index: number) => (
                <div key={index} className="flex items-center justify-between p-3 bg-muted/50 rounded">
                  <span className="font-mono text-sm">{sitemap.url}</span>
                  <div className="flex items-center gap-2">
                    {sitemap.status === 'found' ? (
                      <>
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-1 rounded">
                          {sitemap.type || 'found'}
                        </span>
                      </>
                    ) : (
                      <>
                        <AlertCircle className="w-4 h-4 text-red-400" />
                        <span className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded">
                          not found
                        </span>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {discoveryResults.urls.length > 0 && (
              <div className="mt-6 p-4 bg-primary/5 rounded-lg">
                <p className="text-sm text-muted-foreground mb-2">
                  Ready to audit {discoveryResults.urls.length} pages. Click "Start Batch Audit" to analyze all discovered URLs.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Batch Results */}
      {batchResults && (
        <div className="space-y-6">
          {/* Summary Card */}
          <Card className="border-primary/30">
            <CardHeader>
              <CardTitle className="flex items-center gap-3 text-xl">
                <BarChart3 className="w-6 h-6 text-primary" />
                Batch Audit Summary
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div className="metric-display">
                  <div className="metric-value">{batchResults.summary.completed}</div>
                  <div className="metric-label">Completed</div>
                </div>
                <div className="metric-display">
                  <div className="metric-value">{batchResults.summary.failed}</div>
                  <div className="metric-label">Failed</div>
                </div>
                <div className="metric-display">
                  <div className={`metric-value ${getScoreColor(batchResults.summary.avgScore)}`}>
                    {batchResults.summary.avgScore}
                  </div>
                  <div className="metric-label">Avg Score</div>
                </div>
                <div className="metric-display">
                  <div className="metric-value">{Math.round(batchResults.executionTime / 1000)}s</div>
                  <div className="metric-label">Total Time</div>
                </div>
              </div>

              <Progress 
                value={batchResults.summary.avgScore} 
                status={getScoreStatus(batchResults.summary.avgScore)} 
                className="h-3 mb-4" 
              />

              <div className="paper-meta">
                <p className="text-sm font-medium mb-1">Analysis Overview</p>
                <p className="text-xs text-muted-foreground">
                  Analyzed {batchResults.totalUrls} pages from {batchResults.baseUrl} 
                  with an average optimization score of {batchResults.summary.avgScore}/100
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Individual Results */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Clock className="w-5 h-5" />
                Individual Page Results
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 max-h-96 overflow-y-auto academic-scrollbar">
                {batchResults.results.map((result: any, index: number) => (
                  <div key={index} className="flex items-center justify-between p-4 border border-border rounded-lg">
                    <div className="flex-1 mr-4">
                      <div className="font-mono text-sm text-primary mb-1">
                        {result.url.replace(batchResults.baseUrl, '')}
                      </div>
                      {result.success ? (
                        <div className="flex items-center gap-3 text-xs">
                          <span className={`font-bold ${getScoreColor(result.scores?.overall || 0)}`}>
                            Score: {result.scores?.overall || 0}
                          </span>
                          <span className="text-muted-foreground">
                            {result.executionTime}ms
                          </span>
                          {result.keyFindings && result.keyFindings.length > 0 && (
                            <span className="text-amber-600">
                              {result.keyFindings.length} issues
                            </span>
                          )}
                        </div>
                      ) : (
                        <div className="text-xs text-destructive">
                          Error: {result.error}
                        </div>
                      )}
                    </div>
                    
                    <div className="text-right">
                      {result.success ? (
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                          <div className="text-xs space-y-1">
                            {result.scores && (
                              <>
                                <div>SEO: {result.scores.seo}</div>
                                <div>Perf: {result.scores.performance}</div>
                                {result.psiMetrics?.performance && (
                                  <div className={`font-medium ${getScoreColor(result.psiMetrics.performance.score)}`}>
                                    PSI: {result.psiMetrics.performance.score}
                                  </div>
                                )}
                                <div>A11y: {result.scores.accessibility}</div>
                              </>
                            )}
                          </div>
                        </div>
                      ) : (
                        <AlertCircle className="w-4 h-4 text-destructive" />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}