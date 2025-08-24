// Preserve your existing audit result structure
export interface AuditResult {
  url: string;
  timestamp: string;
  executionTime: number;
  mode: 'lightweight' | 'enhanced';
  tests: {
    seo?: SEOResult;
    performance?: PerformanceResult;
    accessibility?: AccessibilityResult;
    files?: FilesResult;
    metadata?: MetadataResult;
    schema?: SchemaResult;
  };
  overallScore?: number;
}

export interface SEOResult {
  score: number;
  title: string;
  description: string;
  h1Count: number;
  h2Count: number;
  internalLinks: number;
  externalLinks: number;
  hasSchema?: boolean;
  issues?: string[];
}

export interface PerformanceResult {
  score: number;
  responseTime: number;
  statusCode: number;
  contentLength: number;
  contentType: string;
  server: string;
  cacheControl: string;
  compression: string;
  metrics?: {
    firstContentfulPaint: number;
    loadComplete: number;
    resources: number;
    memory: {
      usedJSHeapSize: number;
    };
  };
  scores?: {
    overall: 'good' | 'needs-improvement' | 'poor';
    fcp: 'good' | 'needs-improvement' | 'poor';
    loadTime: 'good' | 'needs-improvement' | 'poor';
  };
}

export interface AccessibilityResult {
  score: number;
  issues: string[];
  imagesWithoutAlt: number;
  totalImages: number;
  hasLang: boolean;
  lang: string | null;
  heuristics?: {
    images: {
      percentage: number;
      withoutAlt: number;
    };
    headings: {
      h1Count: number;
    };
    links: {
      empty: number;
    };
    lang: string | null;
  };
}

export interface FilesResult {
  robots: {
    exists: boolean;
    url: string;
  };
  sitemap: {
    exists: boolean;
    url: string;
  };
  rss?: {
    exists: boolean;
    url: string;
  };
  llms?: {
    exists: boolean;
    url: string;
  };
}

export interface MetadataResult {
  title: string;
  description: string;
  canonical: string;
  viewport: string;
  robots: string;
  issues: string[];
  og: {
    title: string;
    description: string;
    image: string;
    url: string;
  };
}

export interface SchemaResult {
  types: string[];
  totalSchemas: number;
  jsonLdCount: number;
  microdataCount: number;
  issues: string[];
  score: number;
}

// Options for audit requests
export interface AuditOptions {
  includeLighthouse?: boolean;
  timeout?: number;
  includeScreenshot?: boolean;
}

// Status types for UI components
export type ScoreStatus = 'excellent' | 'good' | 'warning' | 'poor';
export type LoadingState = 'idle' | 'loading' | 'success' | 'error';

// Academic paper-style insight types
export interface AuditInsight {
  type: 'critical' | 'warning' | 'info' | 'success';
  title: string;
  finding: string;
  explanation: string;
  recommendation: string;
  impact: 'high' | 'medium' | 'low';
  confidence: number; // 0-100
}

// Attention score breakdown (preserve your scoring logic)
export interface AttentionScores {
  overall: number;
  seo: number;
  performance: number;
  accessibility: number;
  schema: number;
  files: number;
}

// Export summary for reports
export interface ExportSummary {
  url: string;
  auditDate: string;
  overallScore: number;
  keyFindings: string[];
  recommendations: string[];
  technicalDetails: AuditResult;
}