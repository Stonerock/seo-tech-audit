import React, { useState, useEffect } from 'react';
import { Search, Loader2, AlertCircle, CheckCircle2, Globe, BarChart3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AttentionCards } from '@/components/audit/AttentionCards';
import { AIAnalysisSection } from '@/components/audit/AIAnalysisSection';
import { BatchAuditSection } from '@/components/audit/BatchAuditSection';
import { BusinessValueSection } from '@/components/audit/BusinessValueSection';
import { ServerStatus } from '@/components/ServerStatus';
import { auditService } from '@/services/auditService';
import { isValidURL } from '@/lib/utils';
import type { AuditResult, LoadingState } from '@/types/audit';

export function AuditDashboard() {
  const [url, setUrl] = useState('');
  const [results, setResults] = useState<AuditResult | null>(null);
  const [loadingState, setLoadingState] = useState<LoadingState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [includeLighthouse, setIncludeLighthouse] = useState(false);
  const [activeTab, setActiveTab] = useState<'single' | 'batch'>('single');

  // URL validation
  const [urlError, setUrlError] = useState<string | null>(null);
  const [isUrlValid, setIsUrlValid] = useState(false);

  useEffect(() => {
    if (!url) {
      setUrlError(null);
      setIsUrlValid(false);
      return;
    }

    if (!isValidURL(url)) {
      setUrlError('Please enter a valid URL (e.g., https://example.com)');
      setIsUrlValid(false);
      return;
    }

    setUrlError(null);
    setIsUrlValid(true);
  }, [url]);

  const handleAudit = async () => {
    if (!isUrlValid || loadingState === 'loading') return;

    setLoadingState('loading');
    setError(null);
    setResults(null);

    try {
      const auditResults = await auditService.performAudit(url, { 
        includeLighthouse 
      });
      
      setResults(auditResults);
      setLoadingState('success');
    } catch (err) {
      const errorMessage = err instanceof Error 
        ? err.message 
        : 'An unexpected error occurred during the audit';
      
      setError(errorMessage);
      setLoadingState('error');
    }
  };

  const handleClearCache = async () => {
    try {
      await auditService.clearCache();
      // Show success feedback (you could add a toast here)
      console.log('Cache cleared successfully');
    } catch (err) {
      console.warn('Cache clear failed:', err);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && isUrlValid) {
      handleAudit();
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Academic paper-style navigation */}
      <nav className="border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/95">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                <span className="text-primary-foreground font-bold text-sm">A</span>
              </div>
              <span className="font-semibold text-lg">attentionisallyouneed.app</span>
            </div>
            <ServerStatus />
          </div>
        </div>
      </nav>

      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8 max-w-7xl">
        {/* Academic paper-style header */}
        <div className="text-center mb-12 space-y-4">
          <h1 className="academic-title">
            Attention is all you <span className="text-primary">need.</span>
          </h1>
          <p className="academic-subtitle max-w-3xl mx-auto">
            A rigorous, no-fuss SEO & technical audit tool — designed for the era of AI-powered search optimization.
          </p>
          <p className="text-sm text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            Because while "attention is all you need" revolutionized AI, you still need structured data, 
            semantic HTML, and the ability to explain why bounce rate isn't a ranking factor.
          </p>
        </div>

        {/* Analysis Mode Selector */}
        <Card className="mb-8 bg-card/50 border-border/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Search className="w-5 h-5" />
              Research Analysis Framework
            </CardTitle>
          </CardHeader>
          <CardContent>
            {/* Tab Selector */}
            <div className="flex gap-4 mb-6 border-b border-border">
              <button
                onClick={() => setActiveTab('single')}
                className={`pb-3 px-1 border-b-2 transition-colors ${
                  activeTab === 'single'
                    ? 'border-primary text-primary font-medium'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Globe className="w-4 h-4" />
                  Single Page Analysis
                </div>
              </button>
              <button
                onClick={() => setActiveTab('batch')}
                className={`pb-3 px-1 border-b-2 transition-colors ${
                  activeTab === 'batch'
                    ? 'border-primary text-primary font-medium'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                <div className="flex items-center gap-2">
                  <BarChart3 className="w-4 h-4" />
                  Batch Sitemap Analysis
                </div>
              </button>
            </div>

            {/* Single Page Mode */}
            {activeTab === 'single' && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-muted-foreground">
                    Target URL for comprehensive analysis
                  </label>
                  <div className="flex gap-4">
                    <div className="flex-1 space-y-1">
                      <Input
                        type="url"
                        placeholder="https://example.com"
                        value={url}
                        onChange={(e) => setUrl(e.target.value)}
                        onKeyPress={handleKeyPress}
                        className={`${urlError ? 'border-destructive' : ''}`}
                      />
                      {urlError && (
                        <p className="text-sm text-destructive flex items-center gap-1">
                          <AlertCircle className="w-4 h-4" />
                          {urlError}
                        </p>
                      )}
                    </div>
                    
                    <Button
                      onClick={handleAudit}
                      disabled={!isUrlValid || loadingState === 'loading'}
                      size="academic"
                      className="min-w-[200px]"
                    >
                      {loadingState === 'loading' ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Analyzing...
                        </>
                      ) : (
                        <>
                          <Search className="w-4 h-4 mr-2" />
                          Initiate Analysis
                        </>
                      )}
                    </Button>
                  </div>
                </div>

                {/* Options & Secondary Actions */}
                <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between pt-4 border-t border-border/50">
                  {/* Lighthouse Option */}
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={includeLighthouse}
                      onChange={(e) => setIncludeLighthouse(e.target.checked)}
                      className="rounded border-border text-primary focus:ring-primary"
                    />
                    <span className="text-muted-foreground">
                      Include Lighthouse performance metrics (slower, more comprehensive)
                    </span>
                  </label>

                  {/* Secondary Actions */}
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleClearCache}
                      className="text-xs"
                    >
                      Clear Cache
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* Batch Mode */}
            {activeTab === 'batch' && (
              <div className="space-y-4">
                <div className="paper-meta">
                  <p className="text-sm font-medium mb-1">Batch Analysis Mode</p>
                  <p className="text-xs text-muted-foreground">
                    Automatically discover and analyze multiple pages from your website's sitemap 
                    for comprehensive optimization insights. Default: 20 pages, Maximum: 50 pages.
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Batch Audit Section */}
        {activeTab === 'batch' && (
          <BatchAuditSection
            onBatchComplete={(batchResults) => {
              console.log('Batch audit completed:', batchResults);
              // Could show summary or navigate to results
            }}
          />
        )}

        {/* Single Page Results */}
        {activeTab === 'single' && (
          <>
            {/* Error Display */}
            {error && (
              <Card className="mb-8 border-destructive/20 bg-destructive/5">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-2 text-destructive">
                    <AlertCircle className="w-5 h-5" />
                    <div>
                      <h3 className="font-semibold">Analysis Failed</h3>
                      <p className="text-sm mt-1">{error}</p>
                      <p className="text-xs mt-2 text-muted-foreground">
                        Please verify the URL is accessible and try again.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Loading State */}
            {loadingState === 'loading' && (
              <Card className="mb-8 bg-primary/5 border-primary/20">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-center space-y-4 py-8">
                    <div className="text-center">
                      <Loader2 className="w-8 h-8 mx-auto mb-4 animate-spin text-primary" />
                      <h3 className="font-semibold mb-2">Conducting comprehensive analysis...</h3>
                      <p className="text-sm text-muted-foreground">
                        Analyzing SEO compliance, performance metrics, and accessibility standards.
                        <br />
                        <span className="text-xs">
                          Expected completion: 15-30 seconds
                        </span>
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Results Display */}
            {results && loadingState === 'success' && (
              <div className="space-y-8">
                {/* Analysis Metadata */}
                <div className="paper-meta flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    Analysis completed successfully
                  </div>
                  <div className="text-xs font-mono text-muted-foreground">
                    Execution: {results.executionTime}ms • Mode: {results.mode} • {new Date(results.timestamp).toLocaleString()}
                  </div>
                </div>
                
                {/* Core Metrics */}
                <AttentionCards results={results} />
                
                {/* AI Analysis Section */}
                <div className="border-t border-border pt-8">
                  <h2 className="academic-section-title">AI Optimization Analysis</h2>
                  <AIAnalysisSection results={results} />
                </div>

                {/* Business Value Section */}
                <div className="border-t border-border pt-8">
                  <h2 className="academic-section-title">Business Impact & Action Plan</h2>
                  <BusinessValueSection results={results} />
                </div>
              </div>
            )}
          </>
        )}

        {/* Academic footer */}
        <footer className="mt-16 pt-8 border-t border-border/50">
          <div className="text-center text-sm text-muted-foreground">
            <p>
              Comprehensive SEO analysis powered by modern web standards and AI-readiness protocols.
            </p>
            <p className="mt-2 text-xs">
              Built for digital agencies and technical teams who value both rigor and practical results.
            </p>
          </div>
        </footer>
      </div>
    </div>
  );
}