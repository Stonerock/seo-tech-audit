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
    aeo?: AEOResult;
    eat?: EATResult;
    lighthouse?: LighthouseResult;
  };
  psiMetrics?: PSIResult;
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
  // New JavaScript analysis properties
  jsAnalysis?: {
    needsJS: boolean;
    confidence: 'high' | 'medium' | 'low';
    score: number;
    indicators: {
      hasReact: boolean;
      hasVue: boolean;
      hasAngular: boolean;
      hasNext: boolean;
      hasNuxt: boolean;
      hasSPARoot: boolean;
      hasMinimalContent: boolean;
      hasExternalScripts: boolean;
      hasInlineScripts: boolean;
      hasModuleScripts: boolean;
      hasLoadingStates: boolean;
      hasAsyncAttributes: boolean;
      hasPlaceholders: boolean;
      hasJSRequiredMeta: boolean;
      hasPreloadJS: boolean;
    };
    recommendation: string;
  };
  scoreBreakdown?: Array<{
    factor: string;
    points: number;
    earned: number;
  }>;
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
  redirectAnalysis?: {
    totalRedirects: number;
    redirectChain: Array<{
      url: string;
      status: number;
      responseTime: number;
      isRedirect: boolean;
    }>;
    finalUrl: string;
    originalUrl: string;
    hasRedirects: boolean;
    redirectTime: number;
  };
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
    enhanced?: {
      type: string | null;
      urlCount: number;
      hasLastmod: boolean;
      isValidXML: boolean;
      httpsConsistent: boolean;
      errors: string[];
      score: number;
    };
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
  canonicalAnalysis?: {
    url: string;
    present: boolean;
    count: number;
    isValid: boolean;
    isSelfReferencing: boolean;
    issues: string[];
  };
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
  // New AI-era fields
  businessType?: {
    type: string;
    confidence: 'high' | 'medium' | 'low';
    method: 'schema' | 'keywords-en' | 'default';
    detected: string;
    language?: string;
    scope?: 'english-only';
  };
  schemaFields?: Record<string, number>;
  missingFields?: Record<string, number>;
  aiReadinessScore?: number;
  fieldCoveragePercent?: number;
  contentValidation?: {
    issues: string[];
    warnings: string[];
    score: number;
    validItems: number;
    totalChecks: number;
    matchPercentage: number;
  };
}

// Options for audit requests
export interface AuditOptions {
  includeLighthouse?: boolean;
  includePSI?: boolean;
  timeout?: number;
  includeScreenshot?: boolean;
  fastMode?: boolean;
  fullAnalysis?: boolean; // Enables browserless.io rendering
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

// AEO (Answer Engine Optimization) result interface
export interface AEOResult {
  score: number;
  language: string;
  faq: {
    schemaDetected: boolean;
    patternsFound: number;
    patternsScope: 'multilingual-safe' | 'english-only';
  };
  headingStructure: {
    hierarchy: boolean;
    depth: number;
    counts: {
      h1: number;
      h2: number;
      h3: number;
      h4: number;
      h5: number;
      h6: number;
    };
    scope: 'multilingual-safe';
    // Enhanced hierarchy analysis
    detailsAnalysis?: {
      h1Count: number;
      hierarchyValid: boolean;
      hierarchyIssues: string[];
      nestingDepth: number;
      orphanedHeadings: Array<{
        heading: string;
        level: string;
        position: number;
      }>;
      skippedLevels: string[];
      emptyHeadings: number;
      duplicateHeadings: string[];
      questionCount: number;
      averageLength: number;
      levelDistribution: {
        h1: number;
        h2: number;
        h3: number;
        h4: number;
        h5: number;
        h6: number;
      };
    };
    analysisScore?: number;
    analysisIssues?: string[];
    analysisStrengths?: string[];
  };
  listStructure: {
    unordered: number;
    ordered: number;
    total: number;
    scope: 'multilingual-safe';
  };
  conversationalTone?: {
    score: number;
    factors: {
      questionWords: number;
      personalPronouns: number;
      contractionsFound: number;
      avgSentenceLength: number;
    };
    scope: 'english-only';
  };
  recommendations: Array<{
    priority: 'high' | 'medium' | 'low';
    title: string;
    description: string;
    scope: 'multilingual-safe' | 'english-only';
  }>;
}

// Lighthouse result interface for performance analysis
export interface LighthouseResult {
  categories?: {
    performance?: {
      score: number;
      title: string;
    };
    accessibility?: {
      score: number;
      title: string;
    };
    'best-practices'?: {
      score: number;
      title: string;
    };
    seo?: {
      score: number;
      title: string;
    };
  };
  audits?: {
    [key: string]: {
      id: string;
      title: string;
      description: string;
      score: number | null;
      numericValue?: number;
      displayValue?: string;
    };
  };
  lighthouseVersion?: string;
  fetchTime?: string;
  finalUrl?: string;
}

// E-A-T (Expertise, Authoritativeness, Trustworthiness) result interface
export interface EATResult {
  overallScore: number;
  executionTime: number;
  expertise: {
    score: number;
    signals: string[];
    authors: Array<{
      name: string;
      source: 'schema' | 'meta' | 'byline';
      confidence: number;
      type: string;
      url?: string | null;
    }>;
    credentials: Array<{
      author: string;
      credentials: string[];
      score: number;
      bio: string | null;
    }>;
    topicExpertise: number;
  };
  authoritativeness: {
    score: number;
    signals: string[];
    citations: Array<{
      text: string;
      type: 'numbered' | 'academic' | 'url' | 'section';
      confidence: number;
    }>;
    externalReferences: number;
    authorLinks: number;
    institutionalAffiliation: boolean;
  };
  trustworthiness: {
    score: number;
    signals: string[];
    hasContactInfo: boolean;
    hasPrivacyPolicy: boolean;
    hasAboutPage: boolean;
    hasSecureConnection: boolean;
    transparencyScore: number;
  };
  recommendations: Array<{
    priority: 'high' | 'medium' | 'low';
    category: 'expertise' | 'authority' | 'trust';
    title: string;
    description: string;
  }>;
}

// PageSpeed Insights result interface
export interface PSIResult {
  url: string;
  timestamp: string;
  cached: boolean;
  performance: {
    score: number;
    metrics: {
      fcp: string;
      lcp: string;
      inp: string; // Interaction to Next Paint (replaced FID in Mar 2024)
      cls: string;
      speedIndex: string;
      tbt: string;
    };
    coreWebVitals: {
      fcp: 'good' | 'needs-improvement' | 'poor';
      lcp: 'good' | 'needs-improvement' | 'poor';
      cls: 'good' | 'needs-improvement' | 'poor';
      inp: 'good' | 'needs-improvement' | 'poor'; // INP replaced FID as Core Web Vital
    };
  };
  seo?: {
    score: number;
    audits: Array<{
      id: string;
      title: string;
      description: string;
      score: number;
      passed: boolean;
    }>;
  };
  accessibility?: {
    score: number;
    audits: Array<{
      id: string;
      title: string;
      description: string;
      score: number;
      passed: boolean;
    }>;
  };
  opportunities: Array<{
    title: string;
    description: string;
    impact: number;
    score: number;
  }>;
  environment: {
    userAgent?: string;
    networkThrottling?: number;
    emulatedDevice?: string;
  };
}