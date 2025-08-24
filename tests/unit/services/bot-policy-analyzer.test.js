// tests/unit/services/bot-policy-analyzer.test.js
// Unit tests for the enhanced bot policy analyzer service

const BotPolicyAnalyzer = require('../../../services/bot-policy-analyzer');

// Mock fetchWithTimeout to avoid network calls in tests
jest.mock('../../../utils/helpers', () => ({
  fetchWithTimeout: jest.fn()
}));

// Mock validation utility
jest.mock('../../../utils/validation', () => ({
  validateRobotsTxt: jest.fn(() => ({ errors: [] }))
}));

const { fetchWithTimeout } = require('../../../utils/helpers');
const { validateRobotsTxt } = require('../../../utils/validation');

describe('Services - BotPolicyAnalyzer', () => {
  let analyzer;

  beforeEach(() => {
    analyzer = new BotPolicyAnalyzer();
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    test('should initialize with known bots database', () => {
      expect(analyzer.knownBots).toHaveProperty('Googlebot');
      expect(analyzer.knownBots).toHaveProperty('GPTBot');
      expect(analyzer.knownBots).toHaveProperty('ChatGPT-User');
      expect(analyzer.knownBots).toHaveProperty('PerplexityBot');
      expect(analyzer.knownBots.Googlebot.type).toBe('search');
      expect(analyzer.knownBots.GPTBot.type).toBe('ai-training');
    });

    test('should categorize bots correctly', () => {
      const searchBots = Object.values(analyzer.knownBots).filter(bot => bot.type === 'search');
      const aiTrainingBots = Object.values(analyzer.knownBots).filter(bot => bot.type === 'ai-training');
      const aiBrowseBots = Object.values(analyzer.knownBots).filter(bot => bot.type === 'ai-browse');
      
      expect(searchBots.length).toBeGreaterThan(0);
      expect(aiTrainingBots.length).toBeGreaterThan(0);
      expect(aiBrowseBots.length).toBeGreaterThan(0);
    });
  });

  describe('parseRobotsPolicies - Enhanced Parser', () => {
    test('should parse basic robots.txt with statistics', () => {
      const robotsContent = `
# This is a comment
User-agent: *
Disallow: /admin/
Allow: /public/

User-agent: Googlebot
Disallow: /private/

Sitemap: https://example.com/sitemap.xml
Crawl-delay: 1
`;

      const result = analyzer.parseRobotsPolicies(robotsContent);

      expect(result.policies).toHaveProperty('*');
      expect(result.policies).toHaveProperty('Googlebot');
      expect(result.sitemaps).toHaveLength(1);
      expect(result.sitemaps[0].url).toBe('https://example.com/sitemap.xml');
      expect(result.crawlDelays).toHaveProperty('Googlebot');
      expect(result.statistics.userAgents).toBe(2);
      expect(result.statistics.directives).toBe(3);
      expect(result.statistics.sitemapCount).toBe(1);
    });

    test('should detect conflicts in robots.txt', () => {
      const conflictingRobots = `
User-agent: *
Disallow: /admin/
Allow: /admin/
Disallow: /admin/
`;

      const result = analyzer.parseRobotsPolicies(conflictingRobots);

      expect(result.conflicts).toHaveLength(0); // Global conflicts are handled separately
      expect(result.policies['*'].conflicts.length).toBeGreaterThan(0);
      expect(result.warnings.some(w => w.type === 'rule_conflict')).toBe(true);
    });

    test('should detect common typos in user agents', () => {
      const typoRobots = `
User-agent: googlbot
Disallow: /

User-agent: gptbot
Disallow: /private/
`;

      const result = analyzer.parseRobotsPolicies(typoRobots);

      expect(result.warnings.some(w => w.type === 'possible_typo')).toBe(true);
      expect(result.warnings.find(w => w.type === 'possible_typo' && w.suggestion === 'googlebot')).toBeTruthy();
    });

    test('should classify path types correctly', () => {
      const robotsContent = `
User-agent: *
Disallow: /
Disallow: /admin/
Disallow: /api/*
Disallow: /search?
Disallow: /file.pdf
Allow: 
`;

      const result = analyzer.parseRobotsPolicies(robotsContent);
      const rules = result.policies['*'].rules;

      expect(rules.find(r => r.path === '/').pathType).toBe('root');
      expect(rules.find(r => r.path === '/admin/').pathType).toBe('directory');
      expect(rules.find(r => r.path === '/api/*').pathType).toBe('wildcard');
      expect(rules.find(r => r.path === '/search?').pathType).toBe('query');
      expect(rules.find(r => r.path === '/file.pdf').pathType).toBe('file');
      expect(rules.find(r => r.path === '').pathType).toBe('empty');
    });

    test('should generate advanced recommendations', () => {
      const basicRobots = `
User-agent: *
Disallow: /admin/
`;

      const result = analyzer.parseRobotsPolicies(basicRobots);

      expect(result.recommendations).toBeInstanceOf(Array);
      expect(result.recommendations.some(r => r.type === 'ai_bot_management')).toBe(true);
      expect(result.recommendations.some(r => r.type === 'missing_sitemap')).toBe(true);
    });

    test('should validate sitemap URLs', () => {
      const robotsContent = `
User-agent: *
Disallow: /admin/

Sitemap: https://example.com/sitemap.xml
Sitemap: invalid-url
Sitemap: /relative-sitemap.xml
`;

      const result = analyzer.parseRobotsPolicies(robotsContent);

      expect(result.sitemaps).toHaveLength(3);
      expect(result.sitemaps[0].valid).toBe(true);
      expect(result.sitemaps[1].valid).toBe(false);
      expect(result.sitemaps[2].valid).toBe(false);
    });

    test('should detect high crawl delays', () => {
      const robotsContent = `
User-agent: Googlebot
Crawl-delay: 15
Disallow: /admin/

User-agent: Bingbot
Crawl-delay: 5
Disallow: /private/
`;

      const result = analyzer.parseRobotsPolicies(robotsContent);

      expect(result.crawlDelays.Googlebot.delay).toBe(15);
      expect(result.crawlDelays.Bingbot.delay).toBe(5);
      expect(result.recommendations.some(r => r.type === 'high_crawl_delay')).toBe(true);
    });
  });

  describe('analyzeRobotsTxt', () => {
    test('should handle successful robots.txt fetch', async () => {
      const robotsContent = `
User-agent: *
Disallow: /admin/

User-agent: GPTBot
Disallow: /

Sitemap: https://example.com/sitemap.xml
`;

      fetchWithTimeout.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: () => Promise.resolve(robotsContent)
      });

      validateRobotsTxt.mockReturnValueOnce({ errors: [] });

      const result = await analyzer.analyzeRobotsTxt('https://example.com');

      expect(result.exists).toBe(true);
      expect(result.policies).toHaveProperty('*');
      expect(result.policies).toHaveProperty('GPTBot');
      expect(result.enhanced.sitemaps).toHaveLength(1);
      expect(result.enhanced.statistics.userAgents).toBe(2);
    });

    test('should handle missing robots.txt', async () => {
      fetchWithTimeout.mockResolvedValueOnce({
        ok: false,
        status: 404
      });

      const result = await analyzer.analyzeRobotsTxt('https://example.com');

      expect(result.exists).toBe(false);
      expect(result.issues).toContain('robots.txt not found');
      expect(result.enhanced.statistics.userAgents).toBe(0);
    });

    test('should handle network errors', async () => {
      fetchWithTimeout.mockRejectedValueOnce(new Error('Network error'));

      const result = await analyzer.analyzeRobotsTxt('https://example.com');

      expect(result.exists).toBe(false);
      expect(result.error).toBe('Network error');
      expect(result.issues[0]).toContain('Failed to fetch robots.txt');
    });
  });

  describe('getBotPolicyFromRobots', () => {
    test('should get explicit bot policy', () => {
      const policies = {
        'GPTBot': {
          rules: [
            { directive: 'disallow', path: '/', line: 'Disallow: /' }
          ],
          lineNumber: 5,
          conflicts: []
        }
      };

      const result = analyzer.getBotPolicyFromRobots('GPTBot', policies);

      expect(result.allowed).toBe(false);
      expect(result.explicit).toBe(true);
      expect(result.lineNumber).toBe(5);
      expect(result.conflicts).toEqual([]);
    });

    test('should inherit from wildcard policy', () => {
      const policies = {
        '*': {
          rules: [
            { directive: 'disallow', path: '/admin/', line: 'Disallow: /admin/' }
          ],
          lineNumber: 2,
          conflicts: []
        }
      };

      const result = analyzer.getBotPolicyFromRobots('SomeBot', policies);

      expect(result.allowed).toBe(true);
      expect(result.explicit).toBe(false);
      expect(result.inheritedFrom).toBe('*');
      expect(result.lineNumber).toBe(2);
    });

    test('should assume allowed for unknown bots', () => {
      const policies = {};

      const result = analyzer.getBotPolicyFromRobots('UnknownBot', policies);

      expect(result.allowed).toBe(true);
      expect(result.explicit).toBe(false);
      expect(result.assumedDefault).toBe(true);
      expect(result.conflicts).toEqual([]);
    });
  });

  describe('detectGlobalConflicts', () => {
    test('should detect selective blocking', () => {
      const policies = {
        '*': {
          rules: [
            { directive: 'disallow', path: '/admin/', line: 'Disallow: /admin/' }
          ]
        },
        'GPTBot': {
          rules: [
            { directive: 'disallow', path: '/', line: 'Disallow: /' }
          ]
        }
      };

      const conflicts = analyzer.detectGlobalConflicts(policies);

      expect(conflicts.some(c => c.type === 'selective_blocking')).toBe(true);
      expect(conflicts.find(c => c.type === 'selective_blocking').userAgents).toContain('GPTBot');
    });
  });

  describe('pathsOverlap', () => {
    test('should detect overlapping wildcard paths', () => {
      expect(analyzer.pathsOverlap('/api/*', '/api/v1/*')).toBe(true);
      expect(analyzer.pathsOverlap('/docs/*', '/admin/*')).toBe(false);
      expect(analyzer.pathsOverlap('/*', '/anything')).toBe(true);
    });
  });

  describe('classifyPath', () => {
    test('should classify different path types', () => {
      expect(analyzer.classifyPath('/')).toBe('root');
      expect(analyzer.classifyPath('')).toBe('empty');
      expect(analyzer.classifyPath('/api/*')).toBe('wildcard');
      expect(analyzer.classifyPath('/search?q=test')).toBe('query');
      expect(analyzer.classifyPath('/file.pdf')).toBe('file');
      expect(analyzer.classifyPath('/admin/')).toBe('directory');
      expect(analyzer.classifyPath('/about')).toBe('path');
    });
  });

  describe('generateAdvancedRecommendations', () => {
    test('should recommend missing essential bots', () => {
      const parseResult = {
        policies: {
          'SomeBot': { rules: [] }
        },
        sitemaps: [],
        crawlDelays: {},
        conflicts: []
      };

      const recommendations = analyzer.generateAdvancedRecommendations(parseResult);

      expect(recommendations.some(r => r.type === 'missing_essential_bot')).toBe(true);
      expect(recommendations.some(r => r.type === 'ai_bot_management')).toBe(true);
      expect(recommendations.some(r => r.type === 'missing_sitemap')).toBe(true);
    });

    test('should warn about high crawl delays', () => {
      const parseResult = {
        policies: {},
        sitemaps: [{ url: 'https://example.com/sitemap.xml' }],
        crawlDelays: {
          'Googlebot': { delay: 15, valid: true }
        },
        conflicts: []
      };

      const recommendations = analyzer.generateAdvancedRecommendations(parseResult);

      expect(recommendations.some(r => r.type === 'high_crawl_delay')).toBe(true);
    });
  });

  describe('isCompletelyBlocked', () => {
    test('should detect complete blocking', () => {
      const blockedRules = [
        { directive: 'disallow', path: '/' }
      ];
      const partialRules = [
        { directive: 'disallow', path: '/admin/' }
      ];

      expect(analyzer.isCompletelyBlocked(blockedRules)).toBe(true);
      expect(analyzer.isCompletelyBlocked(partialRules)).toBe(false);
    });
  });

  describe('generateOptimizedRobots - Enhanced', () => {
    let mockBotMatrix;

    beforeEach(() => {
      mockBotMatrix = {
        'Googlebot': {
          type: 'search',
          critical: true,
          company: 'Google',
          description: 'Primary Google search crawler',
          recommendations: {
            allow: 'Essential for Google search visibility',
            block: 'Will prevent Google indexing - major SEO impact'
          },
          access: { effective: { allowed: true } }
        },
        'GPTBot': {
          type: 'ai-training',
          critical: false,
          company: 'OpenAI',
          description: 'OpenAI training data collection for GPT models',
          recommendations: {
            allow: 'Allows OpenAI to use content for GPT training',
            block: 'Prevents GPT training data collection'
          },
          access: { effective: { allowed: false } }
        },
        'ChatGPT-User': {
          type: 'ai-browse',
          critical: false,
          company: 'OpenAI',
          description: 'ChatGPT browsing feature for real-time information',
          recommendations: {
            allow: 'Allows ChatGPT to browse your content for users',
            block: 'Prevents ChatGPT from accessing content during conversations'
          },
          access: { effective: { allowed: true } }
        }
      };
    });

    test('should generate comprehensive robots.txt with all templates', () => {
      const result = analyzer.generateOptimizedRobots(mockBotMatrix);

      expect(result).toHaveProperty('recommended');
      expect(result).toHaveProperty('alternatives');
      expect(result).toHaveProperty('explanations');
      expect(result).toHaveProperty('warnings');
      expect(result).toHaveProperty('impact');

      expect(result.alternatives).toHaveProperty('permissive');
      expect(result.alternatives).toHaveProperty('balanced');
      expect(result.alternatives).toHaveProperty('restrictive');

      expect(typeof result.recommended).toBe('string');
      expect(result.recommended.length).toBeGreaterThan(0);
    });

    test('should generate balanced template correctly', () => {
      const balanced = analyzer.generateTemplate(mockBotMatrix, 'balanced');

      expect(balanced).toContain('BALANCED STRATEGY');
      expect(balanced).toContain('User-agent: Googlebot');
      expect(balanced).toContain('User-agent: GPTBot');
      expect(balanced).toContain('Disallow: /');
      expect(balanced).toContain('Sitemap: /sitemap.xml');
    });

    test('should generate permissive template correctly', () => {
      const permissive = analyzer.generateTemplate(mockBotMatrix, 'permissive');

      expect(permissive).toContain('PERMISSIVE STRATEGY');
      expect(permissive).toContain('User-agent: *');
      expect(permissive).toContain('Allow: /');
      expect(permissive).toContain('Disallow: /admin/');
    });

    test('should generate restrictive template correctly', () => {
      const restrictive = analyzer.generateTemplate(mockBotMatrix, 'restrictive');

      expect(restrictive).toContain('RESTRICTIVE STRATEGY');
      expect(restrictive).toContain('User-agent: Googlebot');
      expect(restrictive).toContain('User-agent: GPTBot');
      expect(restrictive).toContain('User-agent: ChatGPT-User');
      expect(restrictive).toContain('User-agent: *');
      expect(restrictive).toContain('Disallow: /');
    });

    test('should include detailed explanations', () => {
      const result = analyzer.generateOptimizedRobots(mockBotMatrix);

      expect(result.explanations).toBeInstanceOf(Array);
      expect(result.explanations.length).toBeGreaterThan(0);
      expect(result.explanations[0]).toHaveProperty('title');
      expect(result.explanations[0]).toHaveProperty('description');
      expect(result.explanations[0]).toHaveProperty('benefits');
    });

    test('should generate appropriate warnings', () => {
      const result = analyzer.generateOptimizedRobots(mockBotMatrix, { template: 'restrictive' });

      expect(result.warnings).toBeInstanceOf(Array);
      expect(result.warnings.some(w => w.type === 'seo_impact')).toBe(true);
    });

    test('should calculate impact assessment', () => {
      const result = analyzer.generateOptimizedRobots(mockBotMatrix);

      expect(result.impact).toHaveProperty('seo');
      expect(result.impact).toHaveProperty('dataControl');
      expect(result.impact).toHaveProperty('aiIntegration');
      expect(result.impact).toHaveProperty('overall');

      expect(typeof result.impact.seo.score).toBe('number');
      expect(typeof result.impact.overall.grade).toBe('string');
      expect(['A+', 'A', 'B+', 'B', 'C', 'D']).toContain(result.impact.overall.grade);
    });

    test('should handle custom options', () => {
      const options = {
        template: 'permissive',
        customSitemap: '/custom-sitemap.xml',
        includeComments: false
      };

      const result = analyzer.generateOptimizedRobots(mockBotMatrix, options);

      expect(result.recommended).toContain('/custom-sitemap.xml');
      expect(result.recommended).not.toContain('# PERMISSIVE STRATEGY');
    });

    test('should warn about critical bots being blocked', () => {
      const matrixWithBlockedCritical = {
        ...mockBotMatrix,
        'Googlebot': {
          ...mockBotMatrix.Googlebot,
          access: { effective: { allowed: false } }
        }
      };

      const result = analyzer.generateOptimizedRobots(matrixWithBlockedCritical);
      
      expect(result.warnings.some(w => w.type === 'critical_bot_blocked')).toBe(true);
      expect(result.warnings.some(w => w.title.includes('Googlebot'))).toBe(true);
    });

    test('should include stealth crawler warnings', () => {
      const matrixWithPerplexity = {
        ...mockBotMatrix,
        'PerplexityBot': {
          type: 'ai-search',
          critical: false,
          company: 'Perplexity AI',
          description: 'Perplexity AI search crawler',
          recommendations: {
            allow: 'Allows Perplexity to use content for AI search',
            block: 'Prevents Perplexity AI search crawling'
          },
          access: { effective: { allowed: false } }
        }
      };

      const result = analyzer.generateOptimizedRobots(matrixWithPerplexity);
      
      expect(result.warnings.some(w => w.type === 'stealth_crawler')).toBe(true);
    });
  });

  describe('generateRobotsExplanations', () => {
    test('should generate comprehensive explanations', () => {
      const mockMatrix = {
        'Googlebot': {
          type: 'search',
          critical: true,
          company: 'Google',
          description: 'Primary Google search crawler',
          recommendations: {
            allow: 'Essential for Google search visibility',
            block: 'Will prevent Google indexing'
          }
        }
      };

      const explanations = analyzer.generateRobotsExplanations(mockMatrix, 'balanced');

      expect(explanations).toBeInstanceOf(Array);
      expect(explanations[0]).toHaveProperty('title');
      expect(explanations[0].title).toBe('Balanced Strategy');
      expect(explanations.some(e => e.bot === 'Googlebot')).toBe(true);
    });
  });

  describe('calculateRobotsImpact', () => {
    test('should calculate accurate impact scores', () => {
      const mockMatrix = {
        'Googlebot': {
          type: 'search',
          access: { effective: { allowed: true } }
        },
        'GPTBot': {
          type: 'ai-training',
          access: { effective: { allowed: false } }
        }
      };

      const impact = analyzer.calculateRobotsImpact(mockMatrix, 'balanced');

      expect(impact.seo.score).toBe(100); // All search bots allowed
      expect(impact.dataControl.score).toBe(100); // All AI bots blocked
      expect(impact.aiIntegration.score).toBe(0); // No AI bots allowed
      expect(typeof impact.overall.score).toBe('number');
      expect(impact.overall.score).toBeGreaterThan(0);
    });
  });
});