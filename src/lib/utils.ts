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
 * Calculate attention score - preserve your existing logic
 */
export function calculateAttentionScores(results: any): AttentionScores {
  const seo = results?.tests?.seo?.score || 0;
  const performance = results?.tests?.performance?.score || 0;
  const accessibility = results?.tests?.accessibility?.score || 0;
  const schema = results?.tests?.schema?.score || 0;
  const files = calculateFilesScore(results?.tests?.files);
  
  // Your existing weighted calculation
  const overall = Math.round(
    (seo * 0.3 + performance * 0.25 + accessibility * 0.2 + schema * 0.15 + files * 0.1)
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