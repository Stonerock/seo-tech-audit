import { useState } from 'react';
import { ChevronDown, ChevronRight, Database, FileText, Globe, Search, Zap, Eye, Code, Server, Download, Copy, Shield } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import type { AuditResult } from '@/types/audit';
import { getScoreStatus } from '@/lib/utils';

interface ComprehensiveDataSectionProps {
  results: AuditResult;
}

interface DataSectionProps {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  data: any;
  isExpanded?: boolean;
  onToggle?: () => void;
}

function DataSection({ title, icon: Icon, data, isExpanded = false, onToggle }: DataSectionProps) {
  // Special handling for scoring breakdown
  const isScoring = title === 'Score Breakdown';
  
  return (
    <Card className="border-border/50">
      <CardHeader 
        className="cursor-pointer hover:bg-muted/30 transition-colors"
        onClick={onToggle}
      >
        <CardTitle className="flex items-center justify-between text-base text-foreground">
          <div className="flex items-center gap-2">
            <Icon className="w-4 h-4 text-primary" />
            {title}
          </div>
          {onToggle && (
            isExpanded ? 
              <ChevronDown className="w-4 h-4 text-muted-foreground" /> :
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
          )}
        </CardTitle>
      </CardHeader>
      {isExpanded && (
        <CardContent className="pt-0">
          {isScoring && Array.isArray(data) ? (
            <div className="space-y-3">
              {data.map((item, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-muted/20 rounded-md">
                  <div>
                    <span className="text-sm font-medium text-foreground">{item.factor}</span>
                    <div className="text-xs text-muted-foreground">{item.earned}/{item.points} points</div>
                  </div>
                  <div className="text-right">
                    <div className={`text-sm font-bold ${item.earned === item.points ? 'text-green-600' : item.earned > 0 ? 'text-amber-600' : 'text-red-600'}`}>
                      {item.earned > 0 ? '✓' : '✗'} {item.earned}
                    </div>
                    <div className="text-xs text-muted-foreground">/{item.points}</div>
                  </div>
                </div>
              ))}
              <div className="border-t pt-2 mt-4">
                <div className="text-sm text-muted-foreground">
                  Total: <strong>{data.reduce((sum, item) => sum + item.earned, 0)}</strong> / {data.reduce((sum, item) => sum + item.points, 0)} points
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-muted/20 rounded-md p-4">
              <pre className="text-xs font-mono text-foreground whitespace-pre-wrap overflow-x-auto">
                {JSON.stringify(data, null, 2)}
              </pre>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}

export function ComprehensiveDataSection({ results }: ComprehensiveDataSectionProps) {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  const [showExportOptions, setShowExportOptions] = useState(false);

  const toggleSection = (sectionKey: string) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(sectionKey)) {
      newExpanded.delete(sectionKey);
    } else {
      newExpanded.add(sectionKey);
    }
    setExpandedSections(newExpanded);
  };

  const exportAsJSON = () => {
    const dataStr = JSON.stringify(results, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `seo-audit-${new URL(results.url).hostname}-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(results, null, 2));
      alert('Audit data copied to clipboard!');
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
    }
  };

  const generateCSVReport = () => {
    const csvData = [];
    csvData.push(['Metric', 'Value', 'Score', 'Status']);

    // SEO Data
    if (results.tests.seo) {
      const seo = results.tests.seo;
      csvData.push(['SEO Score', '', seo.score.toString(), getScoreStatus(seo.score)]);
      csvData.push(['Title', seo.title, '', seo.title ? 'Present' : 'Missing']);
      csvData.push(['Meta Description', seo.description, '', seo.description ? 'Present' : 'Missing']);
      csvData.push(['H1 Count', seo.h1Count.toString(), '', seo.h1Count > 0 ? 'Good' : 'Missing']);
      csvData.push(['H2 Count', seo.h2Count.toString(), '', seo.h2Count > 0 ? 'Good' : 'Missing']);
      csvData.push(['Internal Links', seo.internalLinks.toString(), '', '']);
      csvData.push(['External Links', seo.externalLinks.toString(), '', '']);
    }

    // Performance Data
    if (results.tests.performance) {
      const perf = results.tests.performance;
      csvData.push(['Performance Score', '', perf.score.toString(), getScoreStatus(perf.score)]);
      csvData.push(['Response Time', `${perf.responseTime}ms`, '', perf.responseTime < 1000 ? 'Good' : 'Slow']);
      csvData.push(['Status Code', perf.statusCode.toString(), '', perf.statusCode === 200 ? 'OK' : 'Issue']);
      csvData.push(['Content Length', `${perf.contentLength} bytes`, '', '']);
    }

    // Accessibility Data
    if (results.tests.accessibility) {
      const a11y = results.tests.accessibility;
      csvData.push(['Accessibility Score', '', a11y.score.toString(), getScoreStatus(a11y.score)]);
      csvData.push(['Images Without Alt', a11y.imagesWithoutAlt.toString(), '', a11y.imagesWithoutAlt === 0 ? 'Good' : 'Needs attention']);
      csvData.push(['Total Images', a11y.totalImages.toString(), '', '']);
      csvData.push(['Has Lang Attribute', a11y.hasLang.toString(), '', a11y.hasLang ? 'Good' : 'Missing']);
    }

    // Schema Data
    if (results.tests.schema) {
      const schema = results.tests.schema;
      csvData.push(['Schema Score', '', schema.score.toString(), getScoreStatus(schema.score)]);
      csvData.push(['Total Schemas', schema.totalSchemas.toString(), '', schema.totalSchemas > 0 ? 'Present' : 'Missing']);
      csvData.push(['JSON-LD Count', schema.jsonLdCount.toString(), '', '']);
      csvData.push(['Schema Types', schema.types.join('; '), '', '']);
    }

    const csvContent = csvData.map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `seo-audit-report-${new URL(results.url).hostname}-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Data summary for quick overview
  const dataSummary = {
    totalDataPoints: Object.keys(results.tests).length,
    availableTests: Object.keys(results.tests).filter(key => results.tests[key as keyof typeof results.tests]),
    executionTime: results.executionTime,
    mode: results.mode,
    timestamp: results.timestamp
  };

  const sections = [
    {
      key: 'scoring',
      title: 'Score Breakdown',
      icon: Search,
      data: results.tests.seo?.scoreBreakdown || 'No scoring breakdown available',
      available: !!results.tests.seo?.scoreBreakdown,
      special: true
    },
    {
      key: 'seo',
      title: 'SEO Analysis Data',
      icon: Search,
      data: results.tests.seo,
      available: !!results.tests.seo
    },
    {
      key: 'performance',
      title: 'Performance Metrics',
      icon: Zap,
      data: results.tests.performance,
      available: !!results.tests.performance
    },
    {
      key: 'accessibility',
      title: 'Accessibility Assessment',
      icon: Eye,
      data: results.tests.accessibility,
      available: !!results.tests.accessibility
    },
    {
      key: 'schema',
      title: 'Schema Markup Data',
      icon: Code,
      data: results.tests.schema,
      available: !!results.tests.schema
    },
    {
      key: 'schema-validation',
      title: 'Schema Content Validation',
      icon: Shield,
      data: results.tests.schema?.contentValidation,
      available: !!results.tests.schema?.contentValidation
    },
    {
      key: 'files',
      title: 'Technical Files Status',
      icon: FileText,
      data: results.tests.files,
      available: !!results.tests.files
    },
    {
      key: 'metadata',
      title: 'Page Metadata',
      icon: Globe,
      data: results.tests.metadata,
      available: !!results.tests.metadata
    }
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className="border-primary/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-3 text-xl">
            <Database className="w-6 h-6 text-primary" />
            Comprehensive Data Export & Analysis
          </CardTitle>
          <p className="text-sm text-muted-foreground mb-2">
            Complete technical audit data with export capabilities for further analysis and reporting
          </p>
          <div className="flex items-center gap-2 text-xs">
            <span className="font-medium text-amber-700">⚠️ Static HTML Analysis</span>
            <span className="text-muted-foreground">
              JavaScript-rendered content and dynamic elements not captured
            </span>
          </div>
        </CardHeader>
        <CardContent>
          {/* Data Summary */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="metric-display">
              <div className="metric-value text-foreground !text-foreground">{dataSummary.availableTests.length}</div>
              <div className="metric-label text-muted-foreground !text-muted-foreground">Available Tests</div>
            </div>
            <div className="metric-display">
              <div className="metric-value text-foreground !text-foreground">{dataSummary.executionTime}ms</div>
              <div className="metric-label text-muted-foreground !text-muted-foreground">Analysis Time</div>
            </div>
            <div className="metric-display">
              <div className="metric-value text-foreground !text-foreground">{dataSummary.mode}</div>
              <div className="metric-label text-muted-foreground !text-muted-foreground">Audit Mode</div>
            </div>
            <div className="metric-display">
              <div className="metric-value text-foreground !text-foreground">{new Date(dataSummary.timestamp).toLocaleTimeString()}</div>
              <div className="metric-label text-muted-foreground !text-muted-foreground">Generated</div>
            </div>
          </div>

          {/* Export Options */}
          <div className="flex flex-wrap gap-3 mb-6">
            <Button
              onClick={() => setShowExportOptions(!showExportOptions)}
              variant="outline"
              size="sm"
            >
              <Download className="w-4 h-4 mr-2" />
              Export Data
            </Button>
            
            <Button
              onClick={copyToClipboard}
              variant="outline"
              size="sm"
            >
              <Copy className="w-4 h-4 mr-2" />
              Copy to Clipboard
            </Button>

            {showExportOptions && (
              <div className="flex gap-2">
                <Button
                  onClick={exportAsJSON}
                  variant="outline"
                  size="sm"
                >
                  <FileText className="w-4 h-4 mr-2" />
                  JSON
                </Button>
                <Button
                  onClick={generateCSVReport}
                  variant="outline"
                  size="sm"
                >
                  <Database className="w-4 h-4 mr-2" />
                  CSV Report
                </Button>
              </div>
            )}
          </div>

          {/* Available Data Overview */}
          <div className="paper-meta">
            <p className="text-sm font-medium mb-2 text-foreground">Available Data Categories</p>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {sections.map((section) => (
                <div
                  key={section.key}
                  className={`flex items-center gap-2 p-2 rounded text-xs ${
                    section.available
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      : 'bg-gray-50 text-gray-500 border border-gray-200'
                  }`}
                >
                  <section.icon className="w-3 h-3" />
                  <span className="text-foreground">{section.title}</span>
                  {section.available && <span className="text-xs">✓</span>}
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Expandable Data Sections */}
      <div className="space-y-4">
        <h3 className="academic-subsection">Detailed Data Inspection</h3>
        {sections.map((section) => (
          section.available ? (
            <DataSection
              key={section.key}
              title={section.title}
              icon={section.icon}
              data={section.data}
              isExpanded={expandedSections.has(section.key)}
              onToggle={() => toggleSection(section.key)}
            />
          ) : null
        ))}
      </div>

      {/* Technical Analysis Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Server className="w-5 h-5" />
            Technical Analysis Summary
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 className="academic-subsection text-sm">Data Completeness</h4>
              <div className="space-y-2 text-sm">
                {sections.map((section) => (
                  <div key={section.key} className="flex items-center justify-between">
                    <span className="text-muted-foreground">{section.title}</span>
                    <span className={`px-2 py-1 rounded text-xs ${
                      section.available 
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'bg-gray-100 text-gray-600'
                    }`}>
                      {section.available ? 'Available' : 'Not Available'}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h4 className="academic-subsection text-sm">Audit Configuration</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Target URL:</span>
                  <span className="font-mono text-xs text-foreground">{results.url}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Analysis Mode:</span>
                  <span className="capitalize text-foreground">{results.mode}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Execution Time:</span>
                  <span className="text-foreground">{results.executionTime}ms</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Timestamp:</span>
                  <span className="font-mono text-xs text-foreground">{new Date(results.timestamp).toLocaleString()}</span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}