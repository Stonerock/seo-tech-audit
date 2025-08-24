import type { AuditResult, AuditOptions } from '@/types/audit';

class APIError extends Error {
  constructor(message: string, public status: number) {
    super(message);
    this.name = 'APIError';
  }
}

export class AuditService {
  private baseURL: string;
  private cache = new Map<string, { data: AuditResult; timestamp: number }>();
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

  constructor() {
    // Environment-based URL configuration (no more hardcoded URLs!)
    this.baseURL = import.meta.env.VITE_BACKEND_URL || 
      (import.meta.env.MODE === 'development' 
        ? 'http://localhost:8080'
        : 'https://seo-audit-backend-458683085682.us-central1.run.app'
      );
  }

  /**
   * Perform audit - preserves your existing API call logic
   */
  async performAudit(url: string, options: AuditOptions = {}): Promise<AuditResult> {
    const cacheKey = `audit_${url}_${JSON.stringify(options)}`;
    
    // Check cache first
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.CACHE_DURATION) {
      return cached.data;
    }

    try {
      const response = await fetch(`${this.baseURL}/api/audit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url, options }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new APIError(
          errorData.error || `HTTP ${response.status}: ${response.statusText}`,
          response.status
        );
      }

      const result: AuditResult = await response.json();
      
      // Cache the result
      this.cache.set(cacheKey, { data: result, timestamp: Date.now() });
      
      return result;
    } catch (error) {
      if (error instanceof APIError) {
        throw error;
      }
      
      // Handle network errors
      throw new APIError(
        error instanceof Error ? error.message : 'Network error occurred',
        0
      );
    }
  }

  /**
   * Enhanced audit with heavy dependencies - preserve your lazy loading logic
   */
  async performEnhancedAudit(url: string, options: AuditOptions = {}): Promise<AuditResult> {
    try {
      const response = await fetch(`${this.baseURL}/api/audit/enhanced`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url, options }),
      });

      if (!response.ok) {
        // Fallback to lightweight audit if enhanced fails
        console.warn('Enhanced audit failed, falling back to lightweight mode');
        return this.performAudit(url, options);
      }

      return await response.json();
    } catch (error) {
      // Graceful fallback - preserve your error handling approach
      console.warn('Enhanced audit error, falling back to lightweight mode:', error);
      return this.performAudit(url, options);
    }
  }

  /**
   * Sitemap discovery - find URLs in sitemap
   */
  async discoverSitemapUrls(url: string, maxUrls = 20): Promise<{
    success: boolean;
    baseUrl: string;
    sitemaps: Array<{ url: string; status: string; type?: string }>;
    discoveredUrls: number;
    urls: string[];
    maxUrls: number;
    executionTime: number;
    timestamp: string;
    nextStep: string;
  }> {
    try {
      const response = await fetch(`${this.baseURL}/api/sitemap-audit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url, maxUrls, mode: 'discover' }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new APIError(
          errorData.error || `Sitemap discovery failed: ${response.statusText}`,
          response.status
        );
      }

      return await response.json();
    } catch (error) {
      if (error instanceof APIError) {
        throw error;
      }
      throw new APIError('Failed to discover sitemap URLs', 0);
    }
  }

  /**
   * Batch audit - audit multiple URLs from sitemap
   */
  async performBatchAudit(url: string, maxUrls = 20): Promise<{
    success: boolean;
    baseUrl: string;
    sitemaps: Array<{ url: string; status: string; type?: string }>;
    totalUrls: number;
    maxUrls: number;
    results: Array<{
      url: string;
      success: boolean;
      executionTime: number;
      scores?: {
        seo: number;
        performance: number;
        accessibility: number;
        overall: number;
      };
      keyFindings?: string[];
      error?: string;
    }>;
    summary: {
      completed: number;
      failed: number;
      avgScore: number;
      totalExecutionTime: number;
    };
    timestamp: string;
    executionTime: number;
  }> {
    try {
      const response = await fetch(`${this.baseURL}/api/sitemap-audit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url, maxUrls, mode: 'batch' }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new APIError(
          errorData.error || `Batch audit failed: ${response.statusText}`,
          response.status
        );
      }

      return await response.json();
    } catch (error) {
      if (error instanceof APIError) {
        throw error;
      }
      throw new APIError('Failed to perform batch audit', 0);
    }
  }

  /**
   * Clear cache - preserve your cache management
   */
  async clearCache(): Promise<void> {
    try {
      // Clear local cache
      this.cache.clear();
      
      // Clear server cache
      const response = await fetch(`${this.baseURL}/api/cache/clear`, {
        method: 'POST',
      });

      if (!response.ok) {
        throw new APIError('Failed to clear server cache', response.status);
      }
    } catch (error) {
      console.warn('Cache clear warning:', error);
      // Don't throw - cache clearing shouldn't break the app
    }
  }

  /**
   * Generate LLMS.txt - preserve your existing logic
   */
  async generateLLMSTxt(url: string): Promise<{
    content: string;
    url: string;
    instructions: string;
  }> {
    try {
      const response = await fetch(`${this.baseURL}/api/llms/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url }),
      });

      if (!response.ok) {
        throw new APIError('LLMS.txt generation failed', response.status);
      }

      return await response.json();
    } catch (error) {
      if (error instanceof APIError) {
        throw error;
      }
      throw new APIError('Failed to generate LLMS.txt', 0);
    }
  }

  /**
   * Check server health - preserve your health check logic
   */
  async checkHealth(): Promise<{
    status: string;
    timestamp: string;
    uptime: number;
    mode: string;
    memory: {
      used: string;
      total: string;
    };
  }> {
    try {
      const response = await fetch(`${this.baseURL}/api/health`);
      
      if (!response.ok) {
        throw new APIError('Health check failed', response.status);
      }

      return await response.json();
    } catch (error) {
      if (error instanceof APIError) {
        throw error;
      }
      throw new APIError('Unable to reach server', 0);
    }
  }

  /**
   * Get cache size for debugging
   */
  getCacheSize(): number {
    return this.cache.size;
  }

  /**
   * Get current backend URL for debugging
   */
  getBackendURL(): string {
    return this.baseURL;
  }
}

// Export singleton instance
export const auditService = new AuditService();