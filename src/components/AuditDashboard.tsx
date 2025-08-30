import React, { useState, useEffect } from 'react';
import { Search, Loader2, AlertCircle, CheckCircle2, Globe, BarChart3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AttentionCards } from '@/components/audit/AttentionCards';
import { AEOAnalysis } from '@/components/audit/AEOAnalysis';
import { AIAnalysisSection } from '@/components/audit/AIAnalysisSection';
import { BatchAuditSection } from '@/components/audit/BatchAuditSection';
import { BusinessValueSection } from '@/components/audit/BusinessValueSection';
import { PSIPerformanceSection } from '@/components/audit/PSIPerformanceSection';
import { EATAnalysisSection } from '@/components/audit/EATAnalysisSection';
import { ServerStatus } from '@/components/ServerStatus';
import { AuditProgressBar, DEFAULT_AUDIT_STEPS } from '@/components/AuditProgressBar';
import { auditService } from '@/services/auditService';
import { isValidURL } from '@/lib/utils';
import type { AuditResult, LoadingState } from '@/types/audit';

export function AuditDashboard() {
  const [url, setUrl] = useState('');
  const [results, setResults] = useState<AuditResult | null>(null);
  const [loadingState, setLoadingState] = useState<LoadingState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'single' | 'batch'>('single');
  
  // Progress tracking
  const [auditSteps, setAuditSteps] = useState(DEFAULT_AUDIT_STEPS);
  const [currentStep, setCurrentStep] = useState('');
  const [auditStartTime, setAuditStartTime] = useState(0);

  // URL validation
  const [urlError, setUrlError] = useState<string | null>(null);
  const [isUrlValid, setIsUrlValid] = useState(false);
  
  // Analysis options
  const [fullAnalysis, setFullAnalysis] = useState(false);

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
    
    // Initialize progress tracking
    setAuditStartTime(Date.now());
    setAuditSteps(DEFAULT_AUDIT_STEPS.map(step => ({ ...step, status: 'pending' })));
    setCurrentStep('fetch');

    // Simulate step progression (since we don't have real-time backend progress)
    const stepSequence = ['fetch', 'seo', 'performance', 'schema', 'accessibility', 'psi', 'ai-optimization', 'finalize'];
    let stepIndex = 0;

    const progressInterval = setInterval(() => {
      if (stepIndex < stepSequence.length - 1) {
        const currentStepId = stepSequence[stepIndex];
        const nextStepId = stepSequence[stepIndex + 1];
        
        // Mark current step as completed
        setAuditSteps(prev => prev.map(step => 
          step.id === currentStepId 
            ? { ...step, status: 'completed', actualDuration: Math.floor((Date.now() - auditStartTime) / 1000) }
            : step
        ));
        
        // Start next step
        setCurrentStep(nextStepId);
        setAuditSteps(prev => prev.map(step => 
          step.id === nextStepId 
            ? { ...step, status: 'running' }
            : step
        ));
        
        stepIndex++;
      }
    }, 2000); // Update every 2 seconds

    try {
      const auditResults = await auditService.performAudit(url, { 
        includePSI: true, // Always include PageSpeed Insights for Core Web Vitals
        fullAnalysis: fullAnalysis // Enable browserless.io for enhanced analysis
      });
      
      clearInterval(progressInterval);
      
      // Mark final step as completed
      setAuditSteps(prev => prev.map(step => 
        step.id === 'finalize' 
          ? { ...step, status: 'completed', actualDuration: Math.floor((Date.now() - auditStartTime) / 1000) }
          : step
      ));
      
      setResults(auditResults);
      setLoadingState('success');
    } catch (err) {
      clearInterval(progressInterval);
      
      // Mark current step as error
      setAuditSteps(prev => prev.map(step => 
        step.id === currentStep 
          ? { ...step, status: 'error' }
          : step
      ));
      
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
            A no-fuss audit tool — designed for the era of AI-powered search optimization.
          </p>
          <p className="text-sm text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            Because while "attention is all you need" revolutionized AI, in search you still need structured data, 
            semantic HTML, and the ability to explain why bounce rate isn't a ranking factor. And if you're 
            curious about the future, experiments like llms.txt may one day help AI make better sense of your site.
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
                  
                  {/* Analysis Options */}
                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                      <input
                        type="checkbox"
                        checked={fullAnalysis}
                        onChange={(e) => setFullAnalysis(e.target.checked)}
                        className="rounded border-border text-primary focus:ring-primary"
                      />
                      <span className="text-muted-foreground">
                        Use full analysis 
                        <span className="text-xs text-muted-foreground/70 ml-1">(browserless.io rendering)</span>
                      </span>
                    </label>
                  </div>

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
            {/* Enhanced Error Display */}
            {error && (
              <Card className="mb-8 border-destructive/20 bg-destructive/5">
                <CardContent className="pt-6">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-destructive mt-1" />
                    <div className="flex-1">
                      <h3 className="font-semibold text-destructive">Analysis Failed</h3>
                      <p className="text-sm mt-1 text-foreground">{error}</p>
                      
                      <div className="mt-4 p-3 bg-amber-50 rounded-lg border border-amber-200">
                        <h4 className="text-sm font-medium text-amber-800 mb-2">💡 Troubleshooting Tips</h4>
                        <ul className="text-xs text-amber-700 space-y-1">
                          <li>• <strong>Dynamic/SPA sites</strong>: Our tool analyzes static HTML. JavaScript-heavy sites may show limited results.</li>
                          <li>• <strong>Timeout issues</strong>: Large or slow sites may exceed analysis limits. The tool will retry automatically with longer timeouts.</li>
                          <li>• <strong>Access blocked</strong>: Check if robots.txt or firewalls block our crawler.</li>
                          <li>• <strong>Private sites</strong>: Sites requiring authentication cannot be analyzed.</li>
                          <li>• <strong>Heavy JavaScript</strong>: Sites that depend heavily on JavaScript rendering may need specialized analysis.</li>
                        </ul>
                        
                        <div className="mt-3 pt-3 border-t border-amber-200">
                          <p className="text-xs text-amber-700">
                            <strong>Alternative:</strong> For JavaScript-heavy sites, consider running this analysis on 
                            static snapshots or server-side rendered versions.
                          </p>
                          {error.includes('JavaScript-heavy') && (
                            <div className="mt-2 p-2 bg-blue-50 rounded border border-blue-200">
                              <p className="text-xs text-blue-700">
                                <strong>🤖 Dynamic Site Detected:</strong> This site may require JavaScript to display full content. 
                                Our analysis focuses on static HTML and may miss dynamically loaded elements.
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Loading State with Progress */}
            {loadingState === 'loading' && (
              <div className="mb-8">
                <AuditProgressBar
                  currentStep={currentStep}
                  steps={auditSteps}
                  startTime={auditStartTime}
                  onCancel={() => {
                    setLoadingState('idle');
                    setCurrentStep('');
                  }}
                />
              </div>
            )}

            {/* Results Display */}
            {results && loadingState === 'success' && (
              <div className="space-y-8">
                {/* Target URL Header */}
                <Card className="border-primary/20 bg-primary/5">
                  <CardContent className="pt-6">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <Globe className="w-5 h-5 text-primary" />
                          <span className="text-sm font-medium text-foreground">Analysis Target</span>
                        </div>
                        <div className="font-mono text-lg text-primary font-medium break-all mb-3">
                          {results.url}
                        </div>
                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          <span>Analyzed: {new Date(results.timestamp).toLocaleString()}</span>
                          <span>Mode: {results.mode}</span>
                          <span>Duration: {results.executionTime}ms</span>
                        </div>
                      </div>
                      
                      <div className="flex gap-2 ml-4">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            const exportData = {
                              ...results,
                              exportedAt: new Date().toISOString(),
                              generatedBy: 'AttentionIsAllYouNeed SEO Audit Tool'
                            };
                            const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
                            const url = URL.createObjectURL(blob);
                            const link = document.createElement('a');
                            link.href = url;
                            link.download = `seo-audit-${new URL(results.url).hostname}-${new Date().toISOString().split('T')[0]}.json`;
                            document.body.appendChild(link);
                            link.click();
                            document.body.removeChild(link);
                            URL.revokeObjectURL(url);
                          }}
                          className="text-xs"
                        >
                          📥 Export JSON
                        </Button>
                        
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={async (event) => {
                            try {
                              const shareData = `SEO Audit Report for ${results.url}
                              
AI Readiness: ${Math.round((results.tests.schema?.score || 0) * 0.4 + (results.tests.seo?.score || 0) * 0.3 + (results.tests.files ? 20 : 0) + (results.tests.accessibility?.score || 0) * 0.1)}%
Generated: ${new Date(results.timestamp).toLocaleDateString()}
Analysis Tool: AttentionIsAllYouNeed.app`;
                              
                              await navigator.clipboard.writeText(shareData);
                              // Show success feedback briefly
                              const btn = event.currentTarget as HTMLButtonElement;
                              const originalText = btn.textContent;
                              btn.textContent = '✅ Copied!';
                              setTimeout(() => btn.textContent = originalText, 2000);
                            } catch (err) {
                              console.warn('Copy failed:', err);
                            }
                          }}
                          className="text-xs"
                        >
                          📋 Share Summary
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>

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
                
                {/* PSI Performance Section */}
                {results.psiMetrics && (
                  <div className="border-t border-border pt-8">
                    <h2 className="academic-section-title">PageSpeed Insights Performance</h2>
                    <PSIPerformanceSection psiData={results.psiMetrics} />
                  </div>
                )}
                
                {/* AEO Analysis Section */}
                {results.tests.aeo && (
                  <div className="border-t border-border pt-8">
                    <h2 className="academic-section-title">Answer Engine Optimization (AEO)</h2>
                    <AEOAnalysis aeoResult={results.tests.aeo} />
                  </div>
                )}
                
                {/* AI Analysis Section */}
                <div className="border-t border-border pt-8">
                  <h2 className="academic-section-title">AI Optimization Analysis</h2>
                  <AIAnalysisSection results={results} />
                </div>

                {/* E-A-T Analysis Section */}
                {results.tests.eat && (
                  <div className="border-t border-border pt-8">
                    <h2 className="academic-section-title">Content Authority & Credibility (E-A-T)</h2>
                    <EATAnalysisSection eatResult={results.tests.eat} />
                  </div>
                )}

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