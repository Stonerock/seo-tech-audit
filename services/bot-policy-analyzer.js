// services/bot-policy-analyzer.js
// Comprehensive multi-bot access analysis - UNIQUE market differentiator

const { fetchWithTimeout } = require('../utils/helpers');
const { validateRobotsTxt } = require('../utils/validation');

class BotPolicyAnalyzer {
  constructor() {
    // Comprehensive bot database with latest AI crawlers
    this.knownBots = {
      // Search engine bots
      'Googlebot': {
        type: 'search',
        critical: true,
        company: 'Google',
        description: 'Primary Google search crawler',
        userAgentPattern: /googlebot/i,
        recommendations: {
          allow: 'Essential for Google search visibility',
          block: 'Will prevent Google indexing - major SEO impact'
        }
      },
      'Bingbot': {
        type: 'search',
        critical: true,
        company: 'Microsoft',
        description: 'Microsoft Bing search crawler',
        userAgentPattern: /bingbot/i,
        recommendations: {
          allow: 'Important for Bing search visibility',
          block: 'Will prevent Bing indexing'
        }
      },
      
      // AI training bots
      'Google-Extended': {
        type: 'ai-training',
        critical: false,
        company: 'Google',
        description: 'Google AI training data collection (separate from search)',
        userAgentPattern: /google-extended/i,
        recommendations: {
          allow: 'Allows Google to use content for AI training (Bard, etc.)',
          block: 'Prevents AI training while maintaining search indexing'
        }
      },
      'GPTBot': {
        type: 'ai-training',
        critical: false,
        company: 'OpenAI',
        description: 'OpenAI training data collection for GPT models',
        userAgentPattern: /gptbot/i,
        recommendations: {
          allow: 'Allows OpenAI to use content for GPT training',
          block: 'Prevents GPT training data collection'
        }
      },
      'CCBot': {
        type: 'ai-training',
        critical: false,
        company: 'Common Crawl',
        description: 'Common Crawl data collection (used by many AI companies)',
        userAgentPattern: /ccbot/i,
        recommendations: {
          allow: 'Allows broad AI training data collection',
          block: 'Prevents Common Crawl data collection (affects multiple AI systems)'
        }
      },
      
      // AI browsing/search bots
      'ChatGPT-User': {
        type: 'ai-browse',
        critical: false,
        company: 'OpenAI',
        description: 'ChatGPT browsing feature for real-time information',
        userAgentPattern: /chatgpt-user/i,
        recommendations: {
          allow: 'Allows ChatGPT to browse your content for users',
          block: 'Prevents ChatGPT from accessing content during conversations'
        }
      },
      'PerplexityBot': {
        type: 'ai-search',
        critical: false,
        company: 'Perplexity AI',
        description: 'Perplexity AI search and answer generation',
        userAgentPattern: /perplexitybot/i,
        stealthWarning: true,
        recommendations: {
          allow: 'Allows Perplexity to index and cite your content',
          block: 'Prevents Perplexity AI from accessing content'
        }
      },
      'Claude-Web': {
        type: 'ai-browse',
        critical: false,
        company: 'Anthropic',
        description: 'Claude AI web browsing capabilities',
        userAgentPattern: /claude-web/i,
        recommendations: {
          allow: 'Allows Claude to browse your content',
          block: 'Prevents Claude web browsing access'
        }
      },
      
      // Extended AI ecosystem
      'Applebot-Extended': {
        type: 'ai-training',
        critical: false,
        company: 'Apple',
        description: 'Apple AI training data collection',
        userAgentPattern: /applebot-extended/i,
        recommendations: {
          allow: 'Allows Apple AI training (Siri, etc.)',
          block: 'Prevents Apple AI training while maintaining search indexing'
        }
      },
      'anthropic-ai': {
        type: 'ai-training',
        critical: false,
        company: 'Anthropic',
        description: 'Anthropic AI training crawler',
        userAgentPattern: /anthropic-ai/i,
        recommendations: {
          allow: 'Allows Anthropic to train Claude models',
          block: 'Prevents Anthropic AI training'
        }
      },
      'ClaudeBot': {
        type: 'ai-training',
        critical: false,
        company: 'Anthropic',
        description: 'Claude AI training crawler',
        userAgentPattern: /claudebot/i,
        recommendations: {
          allow: 'Allows Claude model training',
          block: 'Prevents Claude training data collection'
        }
      }
    };
  }

  /**
   * Perform comprehensive multi-bot access analysis
   * @param {string} url - Domain URL to analyze
   * @returns {Object} - Complete bot policy analysis
   */
  async analyzeMultiBotAccess(url) {
    const urlObj = new URL(url);
    const domain = urlObj.origin;
    
    console.log(`🤖 Analyzing multi-bot access for ${domain}...`);
    
    const analysis = {
      domain,
      timestamp: new Date().toISOString(),
      botMatrix: {},
      conflicts: [],
      recommendations: [],
      stealthWarnings: [],
      optimizedRobotsTxt: '',
      summary: {
        totalBots: Object.keys(this.knownBots).length,
        allowed: 0,
        blocked: 0,
        conflicts: 0,
        criticalIssues: 0
      }
    };

    try {
      // 1. Analyze robots.txt
      const robotsAnalysis = await this.analyzeRobotsTxt(domain);
      
      // 2. Check HTTP headers for bot policies
      const headersAnalysis = await this.analyzeBotHeaders(domain);
      
      // 3. Generate bot access matrix
      analysis.botMatrix = this.generateBotMatrix(robotsAnalysis, headersAnalysis);
      
      // 4. Detect conflicts between robots.txt and headers
      analysis.conflicts = this.detectConflicts(robotsAnalysis, headersAnalysis);
      
      // 5. Generate recommendations
      analysis.recommendations = this.generatePolicyRecommendations(analysis.botMatrix, analysis.conflicts);
      
      // 6. Check for stealth crawler warnings
      analysis.stealthWarnings = this.checkStealthCrawlers(robotsAnalysis);
      
      // 7. Generate optimized robots.txt
      analysis.optimizedRobotsTxt = this.generateOptimizedRobots(analysis.botMatrix);
      
      // 8. Calculate summary statistics
      analysis.summary = this.calculateSummary(analysis.botMatrix, analysis.conflicts);
      
      console.log(`✅ Multi-bot analysis complete: ${analysis.summary.allowed} allowed, ${analysis.summary.blocked} blocked, ${analysis.conflicts.length} conflicts`);
      
      return analysis;
      
    } catch (error) {
      console.error('❌ Multi-bot analysis error:', error);
      throw new Error(`Multi-bot analysis failed: ${error.message}`);
    }
  }

  /**
   * Analyze robots.txt with enhanced parsing and conflict detection
   * @param {string} domain - Domain to analyze
   * @returns {Object} - Comprehensive robots.txt analysis
   */
  async analyzeRobotsTxt(domain) {
    const robotsUrl = `${domain}/robots.txt`;
    
    try {
      const response = await fetchWithTimeout(robotsUrl, 10000);
      
      if (!response.ok) {
        return {
          exists: false,
          url: robotsUrl,
          status: response.status,
          policies: {},
          issues: ['robots.txt not found'],
          enhanced: {
            sitemaps: [],
            crawlDelays: {},
            conflicts: [],
            warnings: [],
            statistics: {
              totalLines: 0,
              validLines: 0,
              userAgents: 0,
              directives: 0
            }
          }
        };
      }
      
      const content = await response.text();
      const validation = validateRobotsTxt(content);
      
      // Use enhanced parser
      const parseResult = this.parseRobotsPolicies(content);
      
      return {
        exists: true,
        url: robotsUrl,
        status: response.status,
        content: content.substring(0, 2000), // Limit for response size
        policies: parseResult.policies,
        validation,
        issues: validation.errors || [],
        enhanced: {
          sitemaps: parseResult.sitemaps,
          crawlDelays: parseResult.crawlDelays,
          conflicts: parseResult.conflicts,
          warnings: parseResult.warnings,
          recommendations: parseResult.recommendations,
          statistics: parseResult.statistics,
          lineAnalysis: parseResult.lineAnalysis
        }
      };
      
    } catch (error) {
      return {
        exists: false,
        url: robotsUrl,
        error: error.message,
        policies: {},
        issues: [`Failed to fetch robots.txt: ${error.message}`],
        enhanced: {
          sitemaps: [],
          crawlDelays: {},
          conflicts: [],
          warnings: [],
          statistics: {
            totalLines: 0,
            validLines: 0,
            userAgents: 0,
            directives: 0
          }
        }
      };
    }
  }

  /**
   * Advanced robots.txt parser with conflict detection and validation
   * @param {string} content - robots.txt content
   * @returns {Object} - Advanced parsing results with conflict detection
   */
  parseRobotsPolicies(content) {
    const result = {
      policies: {},
      sitemaps: [],
      crawlDelays: {},
      globalRules: [],
      conflicts: [],
      warnings: [],
      lineAnalysis: [],
      statistics: {
        totalLines: 0,
        validLines: 0,
        commentLines: 0,
        emptyLines: 0,
        userAgents: 0,
        directives: 0,
        sitemapCount: 0
      }
    };

    const lines = content.split('\n').map((line, index) => ({ 
      content: line.trim(), 
      original: line,
      lineNumber: index + 1 
    }));
    
    result.statistics.totalLines = lines.length;
    
    let currentUserAgent = null;
    let currentRules = [];
    let currentUserAgentLine = null;
    
    for (const lineObj of lines) {
      const line = lineObj.content;
      const lineNumber = lineObj.lineNumber;
      
      // Track line types
      if (!line) {
        result.statistics.emptyLines++;
        continue;
      }
      
      if (line.startsWith('#')) {
        result.statistics.commentLines++;
        continue;
      }
      
      result.statistics.validLines++;
      
      // Parse directives
      if (line.toLowerCase().startsWith('user-agent:')) {
        // Save previous user agent rules
        if (currentUserAgent) {
          result.policies[currentUserAgent] = {
            rules: [...currentRules],
            lineNumber: currentUserAgentLine,
            conflicts: this.detectUserAgentConflicts(currentUserAgent, currentRules)
          };
        }
        
        // Start new user agent
        currentUserAgent = line.substring(11).trim();
        currentUserAgentLine = lineNumber;
        currentRules = [];
        result.statistics.userAgents++;
        
        // Validate user agent
        this.validateUserAgent(currentUserAgent, lineNumber, result);
        
      } else if (line.toLowerCase().startsWith('sitemap:')) {
        const sitemapUrl = line.substring(8).trim();
        result.sitemaps.push({
          url: sitemapUrl,
          lineNumber: lineNumber,
          valid: this.isValidUrl(sitemapUrl)
        });
        result.statistics.sitemapCount++;
        
      } else if (line.toLowerCase().startsWith('crawl-delay:')) {
        const delay = line.substring(12).trim();
        if (currentUserAgent) {
          result.crawlDelays[currentUserAgent] = {
            delay: parseInt(delay),
            lineNumber: lineNumber,
            valid: !isNaN(parseInt(delay)) && parseInt(delay) >= 0
          };
        } else {
          result.warnings.push({
            type: 'orphaned_directive',
            message: 'Crawl-delay directive without user-agent',
            lineNumber: lineNumber,
            severity: 'medium'
          });
        }
        
      } else if (currentUserAgent && (line.toLowerCase().startsWith('disallow:') || line.toLowerCase().startsWith('allow:'))) {
        const directive = line.split(':')[0].toLowerCase();
        const path = line.substring(line.indexOf(':') + 1).trim();
        
        const rule = {
          directive,
          path,
          line: line,
          lineNumber: lineNumber,
          pathType: this.classifyPath(path),
          conflicts: []
        };
        
        // Check for rule conflicts
        this.detectRuleConflicts(rule, currentRules, result);
        
        currentRules.push(rule);
        result.statistics.directives++;
        
      } else {
        // Unknown directive
        result.warnings.push({
          type: 'unknown_directive',
          message: `Unknown directive: ${line}`,
          lineNumber: lineNumber,
          severity: 'low'
        });
      }
      
      result.lineAnalysis.push({
        lineNumber: lineNumber,
        content: line,
        type: this.classifyLineType(line),
        userAgent: currentUserAgent
      });
    }
    
    // Save last user agent rules
    if (currentUserAgent) {
      result.policies[currentUserAgent] = {
        rules: currentRules,
        lineNumber: currentUserAgentLine,
        conflicts: this.detectUserAgentConflicts(currentUserAgent, currentRules)
      };
    }
    
    // Detect global conflicts
    result.conflicts = this.detectGlobalConflicts(result.policies);
    
    // Generate advanced recommendations
    result.recommendations = this.generateAdvancedRecommendations(result);
    
    return result;
  }

  /**
   * Validate user agent string
   * @param {string} userAgent - User agent string
   * @param {number} lineNumber - Line number
   * @param {Object} result - Result object to add warnings to
   */
  validateUserAgent(userAgent, lineNumber, result) {
    if (!userAgent) {
      result.warnings.push({
        type: 'empty_user_agent',
        message: 'Empty user-agent directive',
        lineNumber: lineNumber,
        severity: 'high'
      });
      return;
    }
    
    // Check for common typos
    const commonTypos = {
      'googlbot': 'googlebot',
      'googelbot': 'googlebot',
      'gptbot': 'GPTBot',
      'openai': 'GPTBot'
    };
    
    const lowerAgent = userAgent.toLowerCase();
    if (commonTypos[lowerAgent]) {
      result.warnings.push({
        type: 'possible_typo',
        message: `Possible typo in user-agent '${userAgent}', did you mean '${commonTypos[lowerAgent]}'?`,
        lineNumber: lineNumber,
        severity: 'medium',
        suggestion: commonTypos[lowerAgent]
      });
    }
    
    // Check for deprecated bots
    const deprecated = ['slurp', 'msnbot', 'teoma'];
    if (deprecated.includes(lowerAgent)) {
      result.warnings.push({
        type: 'deprecated_bot',
        message: `Bot '${userAgent}' is deprecated and may no longer be active`,
        lineNumber: lineNumber,
        severity: 'low'
      });
    }
  }

  /**
   * Classify path type for better conflict detection
   * @param {string} path - Path from robots.txt rule
   * @returns {string} - Path classification
   */
  classifyPath(path) {
    if (path === '') return 'empty';
    if (!path || path === '/') return 'root';
    if (path.includes('*')) return 'wildcard';
    if (path.includes('?')) return 'query';
    if (path.includes('.')) return 'file';
    if (path.endsWith('/')) return 'directory';
    return 'path';
  }

  /**
   * Classify line type for analysis
   * @param {string} line - Line content
   * @returns {string} - Line type
   */
  classifyLineType(line) {
    if (!line) return 'empty';
    if (line.startsWith('#')) return 'comment';
    if (line.toLowerCase().startsWith('user-agent:')) return 'user-agent';
    if (line.toLowerCase().startsWith('disallow:')) return 'disallow';
    if (line.toLowerCase().startsWith('allow:')) return 'allow';
    if (line.toLowerCase().startsWith('sitemap:')) return 'sitemap';
    if (line.toLowerCase().startsWith('crawl-delay:')) return 'crawl-delay';
    return 'unknown';
  }

  /**
   * Detect conflicts within user agent rules
   * @param {string} userAgent - User agent
   * @param {Array} rules - Rules for the user agent
   * @returns {Array} - Array of conflicts
   */
  detectUserAgentConflicts(userAgent, rules) {
    const conflicts = [];
    
    for (let i = 0; i < rules.length; i++) {
      for (let j = i + 1; j < rules.length; j++) {
        const rule1 = rules[i];
        const rule2 = rules[j];
        
        // Check for contradictory rules
        if (rule1.path === rule2.path && rule1.directive !== rule2.directive) {
          conflicts.push({
            type: 'contradictory_rules',
            message: `Conflicting rules for path '${rule1.path}': ${rule1.directive} vs ${rule2.directive}`,
            rules: [rule1, rule2],
            severity: 'high',
            resolution: `The ${rule2.directive} rule (line ${rule2.lineNumber}) will override the ${rule1.directive} rule (line ${rule1.lineNumber})`
          });
        }
        
        // Check for redundant rules
        if (rule1.path === rule2.path && rule1.directive === rule2.directive) {
          conflicts.push({
            type: 'redundant_rule',
            message: `Duplicate rule for path '${rule1.path}'`,
            rules: [rule1, rule2],
            severity: 'low',
            resolution: `Remove duplicate rule on line ${rule2.lineNumber}`
          });
        }
        
        // Check for overlapping wildcard rules
        if (rule1.pathType === 'wildcard' || rule2.pathType === 'wildcard') {
          if (this.pathsOverlap(rule1.path, rule2.path)) {
            conflicts.push({
              type: 'overlapping_wildcards',
              message: `Overlapping wildcard rules: '${rule1.path}' and '${rule2.path}'`,
              rules: [rule1, rule2],
              severity: 'medium',
              resolution: 'Consider consolidating or reordering rules for clarity'
            });
          }
        }
      }
    }
    
    return conflicts;
  }

  /**
   * Detect rule conflicts as they're added
   * @param {Object} newRule - New rule being added
   * @param {Array} existingRules - Existing rules
   * @param {Object} result - Result object to add warnings to
   */
  detectRuleConflicts(newRule, existingRules, result) {
    existingRules.forEach(existingRule => {
      // Check for immediate conflicts
      if (newRule.path === existingRule.path && newRule.directive !== existingRule.directive) {
        result.warnings.push({
          type: 'rule_conflict',
          message: `Conflicting rules for path '${newRule.path}' on lines ${existingRule.lineNumber} and ${newRule.lineNumber}`,
          lineNumber: newRule.lineNumber,
          severity: 'high',
          relatedLine: existingRule.lineNumber
        });
      }
    });
  }

  /**
   * Detect global conflicts between different user agents
   * @param {Object} policies - All user agent policies
   * @returns {Array} - Array of global conflicts
   */
  detectGlobalConflicts(policies) {
    const conflicts = [];
    const userAgents = Object.keys(policies);
    
    // Check for conflicts between specific bots and wildcard
    if (policies['*']) {
      userAgents.forEach(userAgent => {
        if (userAgent !== '*') {
          const botRules = policies[userAgent].rules;
          const wildcardRules = policies['*'].rules;
          
          // Check if bot has more restrictive rules than wildcard
          const botBlocked = this.isCompletelyBlocked(botRules);
          const wildcardBlocked = this.isCompletelyBlocked(wildcardRules);
          
          if (botBlocked && !wildcardBlocked) {
            conflicts.push({
              type: 'selective_blocking',
              message: `Bot '${userAgent}' is specifically blocked while wildcard (*) allows access`,
              severity: 'medium',
              userAgents: [userAgent, '*'],
              impact: 'This is intentional selective blocking'
            });
          }
        }
      });
    }
    
    return conflicts;
  }

  /**
   * Check if rules completely block a bot
   * @param {Array} rules - Rules array
   * @returns {boolean} - True if completely blocked
   */
  isCompletelyBlocked(rules) {
    return rules.some(rule => 
      rule.directive === 'disallow' && (rule.path === '/' || rule.path === '')
    );
  }

  /**
   * Check if two paths overlap (for wildcard detection)
   * @param {string} path1 - First path
   * @param {string} path2 - Second path
   * @returns {boolean} - True if paths overlap
   */
  pathsOverlap(path1, path2) {
    // Convert wildcards to regex for overlap detection
    const regex1 = new RegExp('^' + path1.replace(/\*/g, '.*') + '$');
    const regex2 = new RegExp('^' + path2.replace(/\*/g, '.*') + '$');
    
    // Test if either path matches the other's pattern
    return regex1.test(path2) || regex2.test(path1);
  }

  /**
   * Generate advanced recommendations based on analysis
   * @param {Object} result - Parsing result
   * @returns {Array} - Array of recommendations
   */
  generateAdvancedRecommendations(result) {
    const recommendations = [];
    
    // Check for missing essential bots
    const essentialBots = ['Googlebot', 'Bingbot'];
    const definedBots = Object.keys(result.policies);
    
    essentialBots.forEach(bot => {
      if (!definedBots.includes(bot) && !definedBots.includes('*')) {
        recommendations.push({
          type: 'missing_essential_bot',
          priority: 'high',
          message: `Consider adding explicit rules for ${bot}`,
          action: `Add 'User-agent: ${bot}' section`,
          benefit: 'Ensures clear search engine access policy'
        });
      }
    });
    
    // Check for AI bot management
    const aiBotsInPolicies = definedBots.filter(bot => 
      ['GPTBot', 'ChatGPT-User', 'Google-Extended', 'CCBot', 'PerplexityBot'].includes(bot)
    );
    
    if (aiBotsInPolicies.length === 0) {
      recommendations.push({
        type: 'ai_bot_management',
        priority: 'medium',
        message: 'No AI bot policies detected',
        action: 'Consider adding explicit AI bot rules for data control',
        benefit: 'Control how AI systems use your content for training'
      });
    }
    
    // Check for sitemap
    if (result.sitemaps.length === 0) {
      recommendations.push({
        type: 'missing_sitemap',
        priority: 'medium',
        message: 'No sitemap declared in robots.txt',
        action: 'Add "Sitemap: /sitemap.xml" directive',
        benefit: 'Helps search engines discover your content'
      });
    }
    
    // Check for crawl delays
    const botsWithDelays = Object.keys(result.crawlDelays);
    if (botsWithDelays.length > 0) {
      botsWithDelays.forEach(bot => {
        const delay = result.crawlDelays[bot].delay;
        if (delay > 10) {
          recommendations.push({
            type: 'high_crawl_delay',
            priority: 'low',
            message: `High crawl delay (${delay}s) for ${bot}`,
            action: 'Consider reducing crawl delay for better indexing',
            benefit: 'Faster content discovery and indexing'
          });
        }
      });
    }
    
    return recommendations;
  }

  /**
   * Simple URL validation
   * @param {string} url - URL to validate
   * @returns {boolean} - True if valid
   */
  isValidUrl(url) {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Analyze HTTP headers for bot-related policies
   * @param {string} domain - Domain to analyze
   * @returns {Object} - Headers analysis
   */
  async analyzeBotHeaders(domain) {
    try {
      const response = await fetchWithTimeout(domain, 10000);
      const headers = {};
      
      response.headers.forEach((value, key) => {
        headers[key.toLowerCase()] = value;
      });
      
      return {
        'x-robots-tag': headers['x-robots-tag'] || null,
        'user-agent': headers['user-agent'] || null,
        'server': headers['server'] || null,
        'cf-ray': headers['cf-ray'] || null, // Cloudflare detection
        'via': headers['via'] || null,
        allHeaders: headers
      };
      
    } catch (error) {
      return {
        error: error.message,
        allHeaders: {}
      };
    }
  }

  /**
   * Generate bot access matrix
   * @param {Object} robotsAnalysis - Robots.txt analysis
   * @param {Object} headersAnalysis - Headers analysis
   * @returns {Object} - Bot access matrix
   */
  generateBotMatrix(robotsAnalysis, headersAnalysis) {
    const matrix = {};
    
    Object.keys(this.knownBots).forEach(botName => {
      const botInfo = this.knownBots[botName];
      
      // Check robots.txt policy
      const robotsPolicy = this.getBotPolicyFromRobots(botName, robotsAnalysis.policies);
      
      // Check header policy
      const headerPolicy = this.getBotPolicyFromHeaders(botName, headersAnalysis);
      
      matrix[botName] = {
        ...botInfo,
        access: {
          robotsTxt: robotsPolicy,
          headers: headerPolicy,
          effective: this.calculateEffectivePolicy(robotsPolicy, headerPolicy),
          conflicts: robotsPolicy.allowed !== headerPolicy.allowed
        }
      };
    });
    
    return matrix;
  }

  /**
   * Get bot policy from robots.txt (updated for enhanced parser)
   * @param {string} botName - Bot name
   * @param {Object} policies - Parsed robots policies
   * @returns {Object} - Bot policy from robots.txt
   */
  getBotPolicyFromRobots(botName, policies) {
    // Check for explicit bot mention
    if (policies[botName]) {
      const botPolicy = policies[botName];
      const rules = botPolicy.rules || botPolicy; // Handle both old and new structure
      
      const isBlocked = rules.some(rule => 
        rule.directive === 'disallow' && (rule.path === '/' || rule.path === '')
      );
      
      return {
        allowed: !isBlocked,
        explicit: true,
        rules: rules,
        lineNumber: botPolicy.lineNumber,
        conflicts: botPolicy.conflicts || []
      };
    }
    
    // Check wildcard policy
    if (policies['*']) {
      const wildcardPolicy = policies['*'];
      const rules = wildcardPolicy.rules || wildcardPolicy; // Handle both old and new structure
      
      const isBlocked = rules.some(rule => 
        rule.directive === 'disallow' && (rule.path === '/' || rule.path === '')
      );
      
      return {
        allowed: !isBlocked,
        explicit: false,
        rules: rules,
        inheritedFrom: '*',
        lineNumber: wildcardPolicy.lineNumber,
        conflicts: wildcardPolicy.conflicts || []
      };
    }
    
    // No explicit policy - assume allowed
    return {
      allowed: true,
      explicit: false,
      rules: [],
      assumedDefault: true,
      conflicts: []
    };
  }

  /**
   * Get bot policy from HTTP headers
   * @param {string} botName - Bot name
   * @param {Object} headers - Headers analysis
   * @returns {Object} - Bot policy from headers
   */
  getBotPolicyFromHeaders(botName, headers) {
    const xRobotsTag = headers['x-robots-tag'];
    
    if (!xRobotsTag) {
      return {
        allowed: true,
        explicit: false,
        source: 'default'
      };
    }
    
    // Check for restrictive directives
    const restrictive = ['noindex', 'nofollow', 'nosnippet', 'noai', 'noimageai'];
    const hasRestrictions = restrictive.some(directive => 
      xRobotsTag.toLowerCase().includes(directive)
    );
    
    return {
      allowed: !hasRestrictions,
      explicit: true,
      source: 'x-robots-tag',
      value: xRobotsTag,
      restrictions: restrictive.filter(directive => 
        xRobotsTag.toLowerCase().includes(directive)
      )
    };
  }

  /**
   * Calculate effective policy considering both robots.txt and headers
   * @param {Object} robotsPolicy - Policy from robots.txt
   * @param {Object} headerPolicy - Policy from headers
   * @returns {Object} - Effective policy
   */
  calculateEffectivePolicy(robotsPolicy, headerPolicy) {
    // Most restrictive policy wins
    const allowed = robotsPolicy.allowed && headerPolicy.allowed;
    
    return {
      allowed,
      sources: [
        ...(robotsPolicy.explicit ? ['robots.txt'] : []),
        ...(headerPolicy.explicit ? ['headers'] : [])
      ],
      reasoning: this.explainPolicyReasoning(robotsPolicy, headerPolicy, allowed)
    };
  }

  /**
   * Explain policy reasoning
   * @param {Object} robotsPolicy - Robots policy
   * @param {Object} headerPolicy - Header policy
   * @param {boolean} allowed - Final allowed status
   * @returns {string} - Explanation
   */
  explainPolicyReasoning(robotsPolicy, headerPolicy, allowed) {
    if (robotsPolicy.explicit && headerPolicy.explicit) {
      if (robotsPolicy.allowed !== headerPolicy.allowed) {
        return allowed ? 
          'Conflicting policies - most permissive applied' : 
          'Conflicting policies - most restrictive applied';
      }
      return 'Consistent policies across robots.txt and headers';
    }
    
    if (robotsPolicy.explicit) {
      return 'Policy determined by robots.txt';
    }
    
    if (headerPolicy.explicit) {
      return 'Policy determined by HTTP headers';
    }
    
    return 'No explicit policy - default allowed';
  }

  /**
   * Detect conflicts between robots.txt and headers
   * @param {Object} robotsAnalysis - Robots analysis
   * @param {Object} headersAnalysis - Headers analysis
   * @returns {Array} - Array of conflicts
   */
  detectConflicts(robotsAnalysis, headersAnalysis) {
    const conflicts = [];
    
    // Check for X-Robots-Tag conflicts
    const xRobotsTag = headersAnalysis['x-robots-tag'];
    
    if (xRobotsTag && robotsAnalysis.exists) {
      // Example conflict detection
      if (xRobotsTag.includes('noindex') && !this.hasGlobalDisallow(robotsAnalysis.policies)) {
        conflicts.push({
          type: 'policy_conflict',
          severity: 'high',
          description: 'X-Robots-Tag blocks indexing but robots.txt allows crawling',
          impact: 'Search engines may receive mixed signals',
          recommendation: 'Align X-Robots-Tag with robots.txt policy'
        });
      }
    }
    
    return conflicts;
  }

  /**
   * Check if robots.txt has global disallow (updated for enhanced parser)
   * @param {Object} policies - Robots policies
   * @returns {boolean} - True if globally disallowed
   */
  hasGlobalDisallow(policies) {
    if (policies['*']) {
      const wildcardPolicy = policies['*'];
      const rules = wildcardPolicy.rules || wildcardPolicy; // Handle both old and new structure
      
      return rules.some(rule => 
        rule.directive === 'disallow' && (rule.path === '/' || rule.path === '')
      );
    }
    return false;
  }

  /**
   * Generate policy recommendations
   * @param {Object} botMatrix - Bot access matrix
   * @param {Array} conflicts - Detected conflicts
   * @returns {Array} - Array of recommendations
   */
  generatePolicyRecommendations(botMatrix, conflicts) {
    const recommendations = [];
    
    // Check for critical bots being blocked
    Object.entries(botMatrix).forEach(([botName, botData]) => {
      if (botData.critical && !botData.access.effective.allowed) {
        recommendations.push({
          type: 'critical_warning',
          priority: 'high',
          bot: botName,
          message: `Critical bot ${botName} is blocked - this will severely impact ${botData.type} functionality`,
          action: `Review and update robots.txt to allow ${botName}`,
          impact: botData.recommendations.block
        });
      }
    });
    
    // Check for AI training bots
    const aiTrainingBots = Object.entries(botMatrix).filter(([name, data]) => data.type === 'ai-training');
    const allowedAI = aiTrainingBots.filter(([name, data]) => data.access.effective.allowed);
    const blockedAI = aiTrainingBots.filter(([name, data]) => !data.access.effective.allowed);
    
    if (allowedAI.length > 0 && blockedAI.length > 0) {
      recommendations.push({
        type: 'consistency_issue',
        priority: 'medium',
        message: 'Inconsistent AI training bot policies detected',
        details: `Allowing: ${allowedAI.map(([name]) => name).join(', ')}. Blocking: ${blockedAI.map(([name]) => name).join(', ')}`,
        action: 'Consider standardizing AI training bot access policy'
      });
    }
    
    // Add conflict-based recommendations
    conflicts.forEach(conflict => {
      recommendations.push({
        type: 'conflict_resolution',
        priority: conflict.severity,
        message: conflict.description,
        action: conflict.recommendation,
        impact: conflict.impact
      });
    });
    
    return recommendations;
  }

  /**
   * Check for stealth crawler warnings
   * @param {Object} robotsAnalysis - Robots analysis
   * @returns {Array} - Array of stealth warnings
   */
  checkStealthCrawlers(robotsAnalysis) {
    const warnings = [];
    
    // Check for PerplexityBot stealth crawling warning
    const perplexityBot = this.knownBots['PerplexityBot'];
    if (perplexityBot.stealthWarning) {
      const policy = this.getBotPolicyFromRobots('PerplexityBot', robotsAnalysis.policies);
      if (!policy.allowed) {
        warnings.push({
          bot: 'PerplexityBot',
          type: 'stealth_warning',
          severity: 'medium',
          message: 'PerplexityBot may ignore robots.txt restrictions',
          details: 'Perplexity AI has been reported to crawl content despite robots.txt blocks',
          recommendation: 'Consider server-level blocking if strict prevention is required',
          sources: ['User reports', 'Community discussions']
        });
      }
    }
    
    return warnings;
  }

  /**
   * Generate comprehensive optimized robots.txt with detailed explanations
   * @param {Object} botMatrix - Bot access matrix
   * @param {Object} options - Generation options
   * @returns {Object} - Comprehensive robots.txt recommendations
   */
  generateOptimizedRobots(botMatrix, options = {}) {
    const {
      includeComments = true,
      template = 'balanced', // 'permissive', 'balanced', 'restrictive'
      customSitemap = '/sitemap.xml',
      includeWarnings = true
    } = options;

    const result = {
      recommended: '',
      alternatives: {},
      explanations: [],
      warnings: [],
      impact: {},
      templates: ['permissive', 'balanced', 'restrictive']
    };

    // Generate different templates
    result.alternatives.permissive = this.generateTemplate(botMatrix, 'permissive', { includeComments, customSitemap });
    result.alternatives.balanced = this.generateTemplate(botMatrix, 'balanced', { includeComments, customSitemap });
    result.alternatives.restrictive = this.generateTemplate(botMatrix, 'restrictive', { includeComments, customSitemap });

    // Set recommended based on template choice
    result.recommended = result.alternatives[template];

    // Generate comprehensive explanations
    result.explanations = this.generateRobotsExplanations(botMatrix, template);

    // Generate warnings
    if (includeWarnings) {
      result.warnings = this.generateRobotsWarnings(botMatrix, template);
    }

    // Calculate impact assessment
    result.impact = this.calculateRobotsImpact(botMatrix, template);

    return result;
  }

  /**
   * Generate robots.txt template based on strategy
   * @param {Object} botMatrix - Bot access matrix
   * @param {string} strategy - Template strategy
   * @param {Object} options - Template options
   * @returns {string} - Generated robots.txt content
   */
  generateTemplate(botMatrix, strategy, options = {}) {
    const { includeComments = true, customSitemap = '/sitemap.xml' } = options;
    const lines = [];

    // Header
    if (includeComments) {
      lines.push('# robots.txt - Generated by SEO Audit Tool');
      lines.push(`# Strategy: ${strategy.toUpperCase()}`);
      lines.push(`# Generated: ${new Date().toISOString().split('T')[0]}`);
      lines.push('#');
      lines.push('# For more information about robots.txt:');
      lines.push('# https://developers.google.com/search/docs/crawling-indexing/robots/intro');
      lines.push('');
    }

    // Strategy-specific generation
    switch (strategy) {
      case 'permissive':
        lines.push(...this.generatePermissiveTemplate(botMatrix, includeComments));
        break;
      case 'balanced':
        lines.push(...this.generateBalancedTemplate(botMatrix, includeComments));
        break;
      case 'restrictive':
        lines.push(...this.generateRestrictiveTemplate(botMatrix, includeComments));
        break;
    }

    // Common elements
    if (includeComments) {
      lines.push('');
      lines.push('# Sitemap Declaration');
      lines.push('# Help search engines discover your content');
    }
    lines.push(`Sitemap: ${customSitemap}`);

    if (includeComments) {
      lines.push('');
      lines.push('# Additional Recommendations:');
      lines.push('# 1. Monitor your robots.txt in Google Search Console');
      lines.push('# 2. Test changes before deploying to production');
      lines.push('# 3. Consider server-level blocking for sensitive content');
      lines.push('# 4. Review this file periodically as new bots emerge');
    }

    return lines.join('\n');
  }

  /**
   * Generate permissive template (allow most bots)
   * @param {Object} botMatrix - Bot access matrix
   * @param {boolean} includeComments - Include explanatory comments
   * @returns {Array} - Template lines
   */
  generatePermissiveTemplate(botMatrix, includeComments) {
    const lines = [];

    if (includeComments) {
      lines.push('# PERMISSIVE STRATEGY');
      lines.push('# Allows most bots while blocking only clearly harmful ones');
      lines.push('# Best for: Public websites, blogs, marketing sites');
      lines.push('');
    }

    // Allow all by default
    if (includeComments) {
      lines.push('# Default policy - allow all legitimate crawlers');
    }
    lines.push('User-agent: *');
    lines.push('Allow: /');
    
    if (includeComments) {
      lines.push('# Block only sensitive areas');
    }
    lines.push('Disallow: /admin/');
    lines.push('Disallow: /private/');
    lines.push('Disallow: /.env');
    lines.push('');

    // Only block clearly problematic bots
    const problematicBots = Object.entries(botMatrix).filter(([name, data]) => {
      return name === 'SomeSpamBot'; // Example - would need real bot detection
    });

    if (problematicBots.length > 0 && includeComments) {
      lines.push('# Block known problematic crawlers');
      problematicBots.forEach(([botName]) => {
        lines.push(`User-agent: ${botName}`);
        lines.push('Disallow: /');
        lines.push('');
      });
    }

    return lines;
  }

  /**
   * Generate balanced template (selective AI bot blocking)
   * @param {Object} botMatrix - Bot access matrix
   * @param {boolean} includeComments - Include explanatory comments
   * @returns {Array} - Template lines
   */
  generateBalancedTemplate(botMatrix, includeComments) {
    const lines = [];

    if (includeComments) {
      lines.push('# BALANCED STRATEGY');
      lines.push('# Allows search engines, blocks most AI training bots');
      lines.push('# Best for: Business websites, content creators, agencies');
      lines.push('');
    }

    // Search engines - always allow
    const searchBots = Object.entries(botMatrix).filter(([name, data]) => data.type === 'search');
    if (searchBots.length > 0) {
      if (includeComments) {
        lines.push('# Search Engines - Essential for SEO');
      }
      searchBots.forEach(([botName, botData]) => {
        if (includeComments) {
          lines.push(`# ${botData.description}`);
        }
        lines.push(`User-agent: ${botName}`);
        lines.push('Allow: /');
        lines.push('');
      });
    }

    // AI training bots - selectively block
    const aiTrainingBots = Object.entries(botMatrix).filter(([name, data]) => data.type === 'ai-training');
    if (aiTrainingBots.length > 0) {
      if (includeComments) {
        lines.push('# AI Training Bots - Block to prevent data usage');
        lines.push('# Remove specific bots if you want to allow AI training');
      }
      aiTrainingBots.forEach(([botName, botData]) => {
        if (includeComments) {
          lines.push(`# ${botData.description || 'AI training bot'}`);
          if (botData.recommendations && botData.recommendations.block) {
            lines.push(`# Impact: ${botData.recommendations.block}`);
          } else {
            lines.push('# Impact: Blocks AI training data collection');
          }
        }
        lines.push(`User-agent: ${botName}`);
        lines.push('Disallow: /');
        lines.push('');
      });
    }

    // AI browsing bots - case by case
    const aiBrowseBots = Object.entries(botMatrix).filter(([name, data]) => data.type === 'ai-browse');
    if (aiBrowseBots.length > 0 && includeComments) {
      lines.push('# AI Browsing Bots - Allow for user assistance');
      lines.push('# These help users access your content through AI assistants');
      aiBrowseBots.forEach(([botName, botData]) => {
        lines.push(`# ${botName}: ${botData.description || 'AI browsing bot'}`);
        if (botData.recommendations && botData.recommendations.allow) {
          lines.push(`# Recommendation: ${botData.recommendations.allow}`);
        } else {
          lines.push('# Recommendation: Allows AI assistant access');
        }
      });
      lines.push('');
    }

    // Default policy for unlisted bots
    if (includeComments) {
      lines.push('# Default policy for other bots');
    }
    lines.push('User-agent: *');
    lines.push('Allow: /');
    lines.push('Disallow: /admin/');
    lines.push('Disallow: /private/');
    lines.push('');

    return lines;
  }

  /**
   * Generate restrictive template (block most AI bots)
   * @param {Object} botMatrix - Bot access matrix
   * @param {boolean} includeComments - Include explanatory comments
   * @returns {Array} - Template lines
   */
  generateRestrictiveTemplate(botMatrix, includeComments) {
    const lines = [];

    if (includeComments) {
      lines.push('# RESTRICTIVE STRATEGY');
      lines.push('# Only allows essential search engines');
      lines.push('# Best for: Private content, premium sites, strict data control');
      lines.push('');
    }

    // Only allow critical search bots
    const criticalBots = Object.entries(botMatrix).filter(([name, data]) => data.critical);
    if (criticalBots.length > 0) {
      if (includeComments) {
        lines.push('# Critical Search Engines Only');
      }
      criticalBots.forEach(([botName, botData]) => {
        if (includeComments) {
          lines.push(`# ${botData.description}`);
        }
        lines.push(`User-agent: ${botName}`);
        lines.push('Allow: /');
        lines.push('');
      });
    }

    // Block all AI bots
    const aiBots = Object.entries(botMatrix).filter(([name, data]) => 
      ['ai-training', 'ai-browse', 'ai-search'].includes(data.type)
    );
    if (aiBots.length > 0) {
      if (includeComments) {
        lines.push('# Block All AI Bots');
        lines.push('# Prevents AI training and browsing');
      }
      aiBots.forEach(([botName, botData]) => {
        if (includeComments) {
          lines.push(`# ${botData.description}`);
        }
        lines.push(`User-agent: ${botName}`);
        lines.push('Disallow: /');
        lines.push('');
      });
    }

    // Restrictive default
    if (includeComments) {
      lines.push('# Default - Block unknown bots');
      lines.push('# Be cautious with new crawlers');
    }
    lines.push('User-agent: *');
    lines.push('Disallow: /');
    lines.push('');

    return lines;
  }

  /**
   * Generate detailed explanations for robots.txt recommendations
   * @param {Object} botMatrix - Bot access matrix
   * @param {string} template - Chosen template
   * @returns {Array} - Array of explanations
   */
  generateRobotsExplanations(botMatrix, template) {
    const explanations = [];

    // Template explanation
    const templateExplanations = {
      permissive: {
        title: 'Permissive Strategy',
        description: 'Maximizes content discoverability while protecting sensitive areas',
        benefits: ['Better SEO performance', 'Broader content reach', 'AI assistant integration'],
        tradeoffs: ['Less data control', 'AI training participation']
      },
      balanced: {
        title: 'Balanced Strategy', 
        description: 'Allows search engines while blocking most AI training bots',
        benefits: ['Strong SEO', 'Data control', 'Selective AI participation'],
        tradeoffs: ['May miss some AI benefits', 'Requires maintenance']
      },
      restrictive: {
        title: 'Restrictive Strategy',
        description: 'Maximum data protection with minimal bot access',
        benefits: ['Complete data control', 'Privacy protection', 'Bandwidth savings'],
        tradeoffs: ['Reduced discoverability', 'Limited AI integration']
      }
    };

    explanations.push(templateExplanations[template]);

    // Bot-specific explanations
    Object.entries(botMatrix).forEach(([botName, botData]) => {
      explanations.push({
        bot: botName,
        type: botData.type,
        company: botData.company,
        description: botData.description,
        allowRecommendation: botData.recommendations.allow,
        blockRecommendation: botData.recommendations.block,
        critical: botData.critical,
        impact: botData.critical ? 'High SEO impact if blocked' : 'Low to medium impact'
      });
    });

    return explanations;
  }

  /**
   * Generate warnings for robots.txt recommendations
   * @param {Object} botMatrix - Bot access matrix
   * @param {string} template - Chosen template
   * @returns {Array} - Array of warnings
   */
  generateRobotsWarnings(botMatrix, template) {
    const warnings = [];

    // Template-specific warnings
    if (template === 'restrictive') {
      warnings.push({
        type: 'seo_impact',
        severity: 'high',
        title: 'Potential SEO Impact',
        message: 'Restrictive robots.txt may reduce search engine visibility',
        recommendation: 'Monitor search console for crawl errors',
        action: 'Consider allowing more search engines if traffic drops'
      });
    }

    if (template === 'permissive') {
      warnings.push({
        type: 'data_usage',
        severity: 'medium',
        title: 'AI Training Data Usage',
        message: 'Your content may be used for AI model training',
        recommendation: 'Review AI bot policies if data control is important',
        action: 'Consider balanced approach for better control'
      });
    }

    // Critical bot warnings
    const blockedCriticalBots = Object.entries(botMatrix).filter(
      ([name, data]) => data.critical && !data.access.effective.allowed
    );

    blockedCriticalBots.forEach(([botName, botData]) => {
      warnings.push({
        type: 'critical_bot_blocked',
        severity: 'critical',
        title: `Critical Bot Blocked: ${botName}`,
        message: `${botName} is essential for ${botData.type} functionality`,
        recommendation: `Allow ${botName} to maintain ${botData.type} performance`,
        action: `Add "User-agent: ${botName}\nAllow: /" to robots.txt`
      });
    });

    // Stealth crawler warnings
    const stealthBots = ['PerplexityBot'];
    stealthBots.forEach(botName => {
      if (botMatrix[botName]) {
        warnings.push({
          type: 'stealth_crawler',
          severity: 'medium',
          title: `Stealth Crawler Alert: ${botName}`,
          message: 'This bot may ignore robots.txt restrictions',
          recommendation: 'Use server-level blocking for strict enforcement',
          action: 'Consider IP-based blocking or user-agent filtering'
        });
      }
    });

    return warnings;
  }

  /**
   * Calculate impact assessment for robots.txt strategy
   * @param {Object} botMatrix - Bot access matrix
   * @param {string} template - Chosen template
   * @returns {Object} - Impact assessment
   */
  calculateRobotsImpact(botMatrix, template) {
    const bots = Object.values(botMatrix);
    const searchBots = bots.filter(bot => bot.type === 'search');
    const aiBots = bots.filter(bot => bot.type.startsWith('ai-'));

    const impact = {
      seo: { score: 0, factors: [] },
      dataControl: { score: 0, factors: [] },
      aiIntegration: { score: 0, factors: [] },
      overall: { score: 0, grade: 'B' }
    };

    // Calculate SEO impact
    const allowedSearchBots = searchBots.filter(bot => bot.access.effective.allowed).length;
    const totalSearchBots = searchBots.length;
    impact.seo.score = totalSearchBots > 0 ? (allowedSearchBots / totalSearchBots) * 100 : 100;
    impact.seo.factors.push(`${allowedSearchBots}/${totalSearchBots} search engines allowed`);

    // Calculate data control
    const blockedAiBots = aiBots.filter(bot => !bot.access.effective.allowed).length;
    const totalAiBots = aiBots.length;
    impact.dataControl.score = totalAiBots > 0 ? (blockedAiBots / totalAiBots) * 100 : 100;
    impact.dataControl.factors.push(`${blockedAiBots}/${totalAiBots} AI bots blocked`);

    // Calculate AI integration
    const allowedAiBots = aiBots.filter(bot => bot.access.effective.allowed).length;
    impact.aiIntegration.score = totalAiBots > 0 ? (allowedAiBots / totalAiBots) * 100 : 0;
    impact.aiIntegration.factors.push(`${allowedAiBots}/${totalAiBots} AI bots allowed`);

    // Overall assessment
    const weights = { seo: 0.5, dataControl: 0.3, aiIntegration: 0.2 };
    impact.overall.score = Math.round(
      impact.seo.score * weights.seo +
      impact.dataControl.score * weights.dataControl +
      impact.aiIntegration.score * weights.aiIntegration
    );

    // Assign grade
    if (impact.overall.score >= 90) impact.overall.grade = 'A+';
    else if (impact.overall.score >= 80) impact.overall.grade = 'A';
    else if (impact.overall.score >= 70) impact.overall.grade = 'B+';
    else if (impact.overall.score >= 60) impact.overall.grade = 'B';
    else if (impact.overall.score >= 50) impact.overall.grade = 'C';
    else impact.overall.grade = 'D';

    return impact;
  }

  /**
   * Calculate summary statistics
   * @param {Object} botMatrix - Bot access matrix
   * @param {Array} conflicts - Detected conflicts
   * @returns {Object} - Summary statistics
   */
  calculateSummary(botMatrix, conflicts) {
    const bots = Object.values(botMatrix);
    
    return {
      totalBots: bots.length,
      allowed: bots.filter(bot => bot.access.effective.allowed).length,
      blocked: bots.filter(bot => !bot.access.effective.allowed).length,
      conflicts: conflicts.length,
      criticalIssues: bots.filter(bot => bot.critical && !bot.access.effective.allowed).length,
      byType: {
        search: bots.filter(bot => bot.type === 'search').length,
        'ai-training': bots.filter(bot => bot.type === 'ai-training').length,
        'ai-browse': bots.filter(bot => bot.type === 'ai-browse').length,
        'ai-search': bots.filter(bot => bot.type === 'ai-search').length
      }
    };
  }
}

module.exports = BotPolicyAnalyzer;