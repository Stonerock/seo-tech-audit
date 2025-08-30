import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import type { ScoreStatus, AttentionScores } from '@/types/audit';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Get score status based on numeric score - preserve your logic
 */
export function getScoreStatus(score: number): ScoreStatus {
  if (score >= 90) return 'excellent';
  if (score >= 80) return 'good';
  if (score >= 60) return 'warning';
  return 'poor';
}

/**
 * Get score color class based on status
 */
export function getScoreColorClass(status: ScoreStatus): string {
  const colors = {
    excellent: 'text-emerald-400',
    good: 'text-green-400',
    warning: 'text-amber-400',
    poor: 'text-red-400',
  };
  return colors[status];
}

/**
 * Calculate AI-era attention scores with focus on machine comprehension
 */
export function calculateAttentionScores(results: any): AttentionScores {
  const seo = results?.tests?.seo?.score || 0;
  const performance = results?.tests?.performance?.score || 0;
  const accessibility = results?.tests?.accessibility?.score || 0;
  // Use AI-readiness score if available, fallback to legacy schema score
  const schema = results?.tests?.schema?.aiReadinessScore || results?.tests?.schema?.score || 0;
  const files = calculateFilesScore(results?.tests?.files);
  
  // AI-era weighted calculation: Schema intelligence takes priority
  // Schema (40%) + SEO (25%) + Performance (20%) + Accessibility (10%) + Files (5%)
  const overall = Math.round(
    (schema * 0.4 + seo * 0.25 + performance * 0.2 + accessibility * 0.1 + files * 0.05)
  );

  return {
    overall,
    seo,
    performance,
    accessibility,
    schema,
    files,
  };
}

/**
 * Calculate new 5-category AI comprehension scores (100% specification)
 */
export function calculateNewCategoryScores(results: any) {
  // Check for detailed aiOptimization data first, then fallback to basic aeo data
  const ai = results?.tests?.aiOptimization || results?.tests?.aeo;
  
  if (!ai) {
    return {
      overall: 0,
      machineComprehension: 0,
      contentStructure: 0,
      technicalQuality: 0,
      accessibility: 0,
      trustGovernance: 0
    };
  }

  // If we have detailed category data, use it
  if (ai.machineComprehension || ai.contentStructure || ai.technicalQuality || ai.accessibility || ai.trustGovernance) {
    const machineComprehension = Math.round(
      (ai.machineComprehension?.structuredData?.score || 0) * 15/15 +
      (ai.machineComprehension?.entityClarity?.score || 0) * 10/10 + 
      (ai.machineComprehension?.semanticHTML?.score || 0) * 5/5
    ) * 30/30;

    const contentStructure = Math.round(
      (ai.contentStructure?.sectionGranularity?.score || 0) * 10/10 +
      (ai.contentStructure?.paragraphReadability?.score || 0) * 5/5 +
      (ai.contentStructure?.answerSignals?.score || 0) * 5/5 +
      (ai.contentStructure?.deepLinking?.score || 0) * 5/5
    ) * 25/25;

    const technicalQuality = Math.round(
      (ai.technicalQuality?.coreWebVitals?.score || 0) * 10/10 +
      (ai.technicalQuality?.crawlability?.score || 0) * 8/8 +
      (ai.technicalQuality?.renderingStrategy?.score || 0) * 7/7
    ) * 25/25;

    const accessibility = Math.round(
      (ai.accessibility?.altTextCoverage?.score || 0) * 4/4 +
      (ai.accessibility?.contrastAndLandmarks?.score || 0) * 3/3
    ) * 7/7;

    const trustGovernance = Math.round(
      (ai.trustGovernance?.authorExpertise?.score || 0) * 5/5 +
      (ai.trustGovernance?.publisherTransparency?.score || 0) * 4/4 +
      (ai.trustGovernance?.externalCorroboration?.score || 0) * 3/3 +
      (ai.trustGovernance?.llmsTxtGovernance?.score || 0) * 1/1
    ) * 13/13;

    const overall = Math.round(
      (machineComprehension * 0.30) +
      (contentStructure * 0.25) +
      (technicalQuality * 0.25) +
      (accessibility * 0.07) +
      (trustGovernance * 0.13)
    );

    return {
      overall,
      machineComprehension,
      contentStructure,
      technicalQuality,
      accessibility,
      trustGovernance
    };
  }

  // Fallback: Use basic aeo score and derive estimated category scores
  const baseScore = ai.score || 0;
  const seoScore = results?.tests?.seo?.score || 0;
  const performanceScore = results?.tests?.performance?.score || 0;
  const accessibilityScore = results?.tests?.accessibility?.score || 0;
  
  // Estimate category scores from available data
  const machineComprehension = Math.min(baseScore + 10, 100); // Schema tends to be better
  const contentStructure = Math.max(baseScore - 5, 0); // Content structure impacts base score
  const technicalQuality = Math.round((performanceScore + seoScore) / 2); // Average of perf/SEO
  const accessibility = accessibilityScore || Math.max(baseScore - 15, 0); // Use accessibility if available
  const trustGovernance = Math.max(baseScore - 10, 0); // Trust signals affect base score
  
  const overall = Math.round(
    (machineComprehension * 0.30) +
    (contentStructure * 0.25) +
    (technicalQuality * 0.25) +
    (accessibility * 0.07) +
    (trustGovernance * 0.13)
  );

  return {
    overall,
    machineComprehension,
    contentStructure,
    technicalQuality,
    accessibility,
    trustGovernance
  };
}

/**
 * Calculate files score - preserve your logic
 */
function calculateFilesScore(files: any): number {
  if (!files) return 0;
  
  let score = 0;
  if (files.robots?.exists) score += 30;
  if (files.sitemap?.exists) score += 40;
  if (files.rss?.exists) score += 15;
  if (files.llms?.exists) score += 15;
  
  return Math.min(score, 100);
}

/**
 * Format bytes - utility function
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

/**
 * Format duration - utility function
 */
export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const seconds = ms / 1000;
  if (seconds < 60) return `${seconds.toFixed(1)}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  return `${minutes}m ${remainingSeconds}s`;
}

/**
 * Truncate text - utility function
 */
export function truncateText(text: string, length = 100): string {
  if (text.length <= length) return text;
  return text.substring(0, length) + '...';
}

/**
 * Generate witty insights - preserve your personality
 */
export function getScoreInterpretation(score: number): string {
  if (score >= 90) return 'exceptional';
  if (score >= 80) return 'strong';
  if (score >= 70) return 'adequate';
  if (score >= 60) return 'concerning';
  return 'requires immediate attention';
}

/**
 * Generate academic-style witty copy - your brand voice
 */
export function getWittyCopy(type: string, score: number): string {
  const wittyResponses = {
    seo: {
      excellent: "SEO game stronger than your morning coffee ☕",
      good: "Google approves of your optimization efforts 👍",
      warning: "Your SEO needs some love and attention 💕",
      poor: "Google is giving you the silent treatment 🤐"
    },
    performance: {
      excellent: "Faster than a researcher finding typos in their own paper ⚡",
      good: "Loading speed that won't test user patience ⏱️",
      warning: "Users are questioning their life choices while waiting 🤔",
      poor: "Slower than peer review process 🐌"
    },
    accessibility: {
      excellent: "More inclusive than a diverse research team 🌟",
      good: "Accessibility compliance looking solid 👌",
      warning: "Some users might feel left out 😕",
      poor: "Accessibility barriers higher than academic paywalls 🚧"
    },
    schema: {
      excellent: "AI-readiness level: PhD dissertation 🎓",
      good: "Schema markup that makes AI assistants happy 🤖",
      warning: "Your structured data needs some structure 📊",
      poor: "Machines are confused, humans are lost 🤷"
    }
  };

  const status = getScoreStatus(score);
  return wittyResponses[type as keyof typeof wittyResponses]?.[status] || 
         "Analysis complete, results may vary ¯\\_(ツ)_/¯";
}

/**
 * Debounce function for search inputs
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

/**
 * Check if URL is valid
 */
export function isValidURL(string: string): boolean {
  try {
    new URL(string);
    return true;
  } catch {
    return false;
  }
}