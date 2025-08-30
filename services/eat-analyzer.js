// services/eat-analyzer.js
// E-A-T (Expertise, Authoritativeness, Trustworthiness) Analysis for AI-era SEO

class EATAnalyzer {
    constructor() {
        // Authority signals for modern content evaluation
        this.authorityIndicators = {
            credentials: [
                'phd', 'md', 'professor', 'dr.', 'dr ', 'ceo', 'cto', 'founder', 
                'director', 'expert', 'specialist', 'certified', 'licensed'
            ],
            institutions: [
                'university', 'college', 'institute', 'academy', 'hospital',
                'clinic', 'laboratory', 'research', 'government', 'ministry'
            ],
            publications: [
                'published', 'journal', 'research', 'study', 'paper', 'book',
                'article', 'publication', 'peer-reviewed', 'academic'
            ]
        };
        
        this.trustSignals = [
            'contact', 'privacy', 'terms', 'about', 'copyright', 'disclaimer',
            'policy', 'legal', 'address', 'phone', 'email'
        ];
    }

    /**
     * Comprehensive E-A-T analysis for a webpage
     * @param {Object} $ - Cheerio DOM object
     * @param {string} url - Page URL
     * @param {Object} schemaData - Structured data from page
     * @returns {Object} - E-A-T analysis results
     */
    async analyzeEAT($, url, schemaData = []) {
        const startTime = Date.now();
        
        // Detect page type to adjust E-A-T criteria appropriately
        const pageType = this.detectPageType($, url);
        
        const analysis = {
            expertise: await this.analyzeExpertise($, schemaData, pageType),
            authoritativeness: await this.analyzeAuthoritativeness($, url, schemaData, pageType),
            trustworthiness: await this.analyzeTrustworthiness($, url),
            overallScore: 0,
            recommendations: [],
            pageType: pageType,
            executionTime: 0
        };
        
        // Calculate composite E-A-T score
        analysis.overallScore = this.calculateEATScore(analysis);
        
        // Generate recommendations
        analysis.recommendations = this.generateEATRecommendations(analysis);
        
        analysis.executionTime = Date.now() - startTime;
        return analysis;
    }

    /**
     * Analyze expertise signals on the page
     */
    async analyzeExpertise($, schemaData, pageType) {
        const expertise = {
            score: 0,
            signals: [],
            authors: [],
            credentials: [],
            topicExpertise: 0
        };

        // Author detection from multiple sources - adjust expectations based on page type
        const authors = this.detectAuthors($, schemaData);
        expertise.authors = authors;
        
        // For homepages and service pages, don't penalize for lack of individual authors
        if (!pageType.expectsAuthors && authors.length === 0) {
            expertise.signals.push(`No individual authors expected for ${pageType.type} - using organizational expertise`);
        }

        // Credential analysis
        const pageText = $('body').text().toLowerCase();
        const authorBios = this.extractAuthorBios($);
        
        authors.forEach(author => {
            const credentials = this.analyzeAuthorCredentials(author, authorBios, pageText);
            expertise.credentials.push({
                author: author.name,
                credentials: credentials.found,
                score: credentials.score,
                bio: credentials.bio
            });
            expertise.score += credentials.score;
        });

        // Topic expertise indicators
        const topicSignals = this.analyzeTopicExpertise($, pageText);
        expertise.topicExpertise = topicSignals.score;
        expertise.signals = topicSignals.signals;
        expertise.score += topicSignals.score;

        return expertise;
    }

    /**
     * Analyze authoritativeness signals
     */
    async analyzeAuthoritativeness($, url, schemaData, pageType) {
        const authority = {
            score: 0,
            signals: [],
            citations: [],
            externalReferences: 0,
            authorLinks: 0,
            institutionalAffiliation: false
        };

        // Citation and reference analysis - adjust expectations based on page type
        const citations = this.detectCitations($);
        authority.citations = citations;
        authority.score += citations.length * 5; // 5 points per citation
        
        // For homepages, don't expect citations - focus on institutional authority
        if (!pageType.expectsCitations && citations.length === 0) {
            authority.signals.push(`Citations not expected for ${pageType.type} - evaluating organizational authority`);
        }

        // External authoritative links
        const authoritativeLinks = this.analyzeAuthoritativeLinks($, url);
        authority.externalReferences = authoritativeLinks.count;
        authority.authorLinks = authoritativeLinks.authorLinks;
        authority.score += Math.min(authoritativeLinks.score, 30); // Max 30 points

        // Institutional affiliation
        const institutional = this.detectInstitutionalSignals($, schemaData);
        authority.institutionalAffiliation = institutional.found;
        authority.score += institutional.score;
        authority.signals = institutional.signals;

        return authority;
    }

    /**
     * Analyze trustworthiness signals
     */
    async analyzeTrustworthiness($, url) {
        const trust = {
            score: 0,
            signals: [],
            hasContactInfo: false,
            hasPrivacyPolicy: false,
            hasAboutPage: false,
            hasSecureConnection: false,
            transparencyScore: 0
        };

        // Basic trust signals
        trust.hasSecureConnection = url.startsWith('https://');
        if (trust.hasSecureConnection) trust.score += 10;

        // Contact information
        const contactInfo = this.analyzeContactInformation($);
        trust.hasContactInfo = contactInfo.found;
        trust.score += contactInfo.score;
        trust.signals.push(...contactInfo.signals);

        // Legal pages and transparency
        const legalPages = this.analyzeLegalPages($);
        trust.hasPrivacyPolicy = legalPages.hasPrivacy;
        trust.hasAboutPage = legalPages.hasAbout;
        trust.transparencyScore = legalPages.score;
        trust.score += legalPages.score;
        trust.signals.push(...legalPages.signals);

        return trust;
    }

    /**
     * Detect authors from multiple sources with confidence scoring
     */
    detectAuthors($, schemaData) {
        const authors = [];
        const seenAuthors = new Set();

        // 1. Schema markup authors (highest confidence)
        schemaData.forEach(schema => {
            const schemaArray = Array.isArray(schema) ? schema : [schema];
            schemaArray.forEach(item => {
                if (item.author) {
                    const authorName = typeof item.author === 'string' ? item.author : item.author.name;
                    if (authorName && !seenAuthors.has(authorName.toLowerCase())) {
                        authors.push({
                            name: authorName,
                            source: 'schema',
                            confidence: 0.9,
                            type: item.author.type || 'Person',
                            url: typeof item.author === 'object' ? item.author.url : null
                        });
                        seenAuthors.add(authorName.toLowerCase());
                    }
                }
            });
        });

        // 2. Meta tags (medium confidence)
        const metaAuthor = $('meta[name="author"]').attr('content');
        if (metaAuthor && !seenAuthors.has(metaAuthor.toLowerCase())) {
            authors.push({
                name: metaAuthor,
                source: 'meta',
                confidence: 0.7,
                type: 'Person'
            });
            seenAuthors.add(metaAuthor.toLowerCase());
        }

        // 3. Byline patterns (medium confidence) - STRICT validation to prevent hallucination
        const bylinePatterns = [
            /by\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,2})\b/gi,  // Max 3 words
            /author:\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,2})\b/gi,
            /written\s+by\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,2})\b/gi
        ];

        const pageText = $('body').text();
        bylinePatterns.forEach(pattern => {
            let match;
            while ((match = pattern.exec(pageText)) !== null) {
                const authorName = match[1].trim();
                
                // STRICT VALIDATION: Only accept realistic author names
                if (this.isValidAuthorName(authorName) && !seenAuthors.has(authorName.toLowerCase())) {
                    authors.push({
                        name: authorName,
                        source: 'byline',
                        confidence: 0.6,
                        type: 'Person'
                    });
                    seenAuthors.add(authorName.toLowerCase());
                }
            }
        });

        // Filter out low confidence authors (prevent showing unreliable data)
        const validAuthors = authors.filter(author => author.confidence >= 0.5);
        return validAuthors.slice(0, 3); // Limit to top 3 valid authors
    }

    /**
     * Validate if a string is a realistic author name (prevent hallucination)
     */
    isValidAuthorName(name) {
        if (!name || typeof name !== 'string') return false;
        
        // Basic length check
        if (name.length < 4 || name.length > 50) return false;
        
        // Must contain only letters, spaces, periods, hyphens
        if (!/^[A-Za-z\s\.\-]+$/.test(name)) return false;
        
        // Must have 2-3 words max (First Last, First Middle Last)
        const words = name.trim().split(/\s+/);
        if (words.length < 2 || words.length > 3) return false;
        
        // Each word must be at least 2 characters
        if (words.some(word => word.length < 2)) return false;
        
        // Blacklist generic phrases that aren't author names
        const blacklist = [
            'working with', 'many companies', 'organizations', 'millions of', 
            'people every', 'every day', 'companies and', 'and organizations',
            'with many', 'of people', 'the platform', 'independent people',
            'all you', 'you need', 'need to', 'to know', 'more information'
        ];
        
        const lowerName = name.toLowerCase();
        if (blacklist.some(phrase => lowerName.includes(phrase))) return false;
        
        return true;
    }

    /**
     * Detect page type to apply appropriate E-A-T criteria
     */
    detectPageType($, url) {
        const urlPath = new URL(url).pathname.toLowerCase();
        const pageTitle = $('title').text().toLowerCase();
        const h1Text = $('h1').first().text().toLowerCase();
        
        // Homepage detection
        if (urlPath === '/' || urlPath === '/en/' || urlPath === '/index.html' || 
            pageTitle.includes('homepage') || pageTitle.includes('home page')) {
            return {
                type: 'homepage',
                expectsAuthors: false,
                expectsCitations: false,
                description: 'Corporate homepage - focus on organizational trust signals'
            };
        }
        
        // Article/Blog detection
        if (urlPath.includes('/blog/') || urlPath.includes('/news/') || urlPath.includes('/article/') ||
            urlPath.includes('/story/') || urlPath.includes('/press/') || pageTitle.includes('blog') ||
            $('article').length > 0 || $('[itemtype*="Article"]').length > 0) {
            return {
                type: 'article',
                expectsAuthors: true,
                expectsCitations: true,
                description: 'Article/blog content - requires author attribution and citations'
            };
        }
        
        // Service/Product pages
        if (urlPath.includes('/service') || urlPath.includes('/product') || urlPath.includes('/solution')) {
            return {
                type: 'service',
                expectsAuthors: false,
                expectsCitations: false,
                description: 'Service/product page - focus on organizational expertise'
            };
        }
        
        // Default to content page
        return {
            type: 'content',
            expectsAuthors: true,
            expectsCitations: true,
            description: 'Content page - standard E-A-T criteria apply'
        };
    }

    /**
     * Advanced author credential analysis
     */
    analyzeAuthorCredentials(author, authorBios, pageText) {
        const credentials = {
            found: [],
            score: 0,
            bio: null
        };

        // Find author bio
        const bio = authorBios.find(bio => 
            bio.text.toLowerCase().includes(author.name.toLowerCase())
        );
        if (bio) {
            credentials.bio = bio.text;
            credentials.score += 10; // Bonus for having a bio
        }

        const textToAnalyze = bio ? bio.text.toLowerCase() : pageText;

        // Credential detection with scoring
        this.authorityIndicators.credentials.forEach(credential => {
            if (textToAnalyze.includes(credential)) {
                credentials.found.push(credential);
                credentials.score += this.getCredentialScore(credential);
            }
        });

        // Institution affiliation
        this.authorityIndicators.institutions.forEach(institution => {
            if (textToAnalyze.includes(institution)) {
                credentials.found.push(`${institution} affiliation`);
                credentials.score += 15; // Higher score for institutional backing
            }
        });

        // Publication history
        this.authorityIndicators.publications.forEach(publication => {
            if (textToAnalyze.includes(publication)) {
                credentials.found.push(`${publication} experience`);
                credentials.score += 8;
            }
        });

        return credentials;
    }

    /**
     * Extract author bios from common patterns
     */
    extractAuthorBios($) {
        const bios = [];
        
        // Common bio selectors
        const bioSelectors = [
            '.author-bio', '.bio', '.about-author', '.author-info',
            '[class*="author"]', '[class*="bio"]', '.contributor',
            '.profile', '.author-box', '.byline-author'
        ];

        bioSelectors.forEach(selector => {
            $(selector).each((i, el) => {
                const text = $(el).text().trim();
                if (text.length > 50 && text.length < 1000) { // Reasonable bio length
                    bios.push({
                        text,
                        selector,
                        length: text.length
                    });
                }
            });
        });

        return bios;
    }

    /**
     * Analyze topic expertise indicators
     */
    analyzeTopicExpertise($, pageText) {
        const signals = [];
        let score = 0;

        // Technical depth indicators
        const technicalTerms = this.countTechnicalTerms(pageText);
        if (technicalTerms > 10) {
            signals.push(`${technicalTerms} technical terms used`);
            score += Math.min(technicalTerms * 2, 20);
        }

        // Data and statistics
        const dataPoints = this.countDataReferences(pageText);
        if (dataPoints > 0) {
            signals.push(`${dataPoints} data points/statistics cited`);
            score += Math.min(dataPoints * 5, 25);
        }

        // Content depth
        const contentDepth = this.analyzeContentDepth($);
        score += contentDepth.score;
        signals.push(...contentDepth.signals);

        return { score: Math.min(score, 50), signals };
    }

    /**
     * Detect citations and references
     */
    detectCitations($) {
        const citations = [];
        
        // Look for common citation patterns
        const citationPatterns = [
            /\[(\d+)\]/g, // [1], [2], etc.
            /\(([^)]*\d{4}[^)]*)\)/g, // (Author, 2023)
            /https?:\/\/[^\s]+/g // URLs as references
        ];

        const pageText = $('body').text();
        citationPatterns.forEach((pattern, index) => {
            const matches = pageText.match(pattern) || [];
            matches.forEach(match => {
                citations.push({
                    text: match,
                    type: index === 0 ? 'numbered' : index === 1 ? 'academic' : 'url',
                    confidence: index < 2 ? 0.8 : 0.5
                });
            });
        });

        // Look for reference sections
        const refSections = $('h2, h3, h4').filter((i, el) => {
            const text = $(el).text().toLowerCase();
            return text.includes('reference') || text.includes('source') || 
                   text.includes('citation') || text.includes('bibliography');
        });

        if (refSections.length > 0) {
            citations.push({
                text: 'Dedicated reference section found',
                type: 'section',
                confidence: 0.9
            });
        }

        return citations.slice(0, 20); // Limit to top 20 citations
    }

    /**
     * Analyze authoritative external links
     */
    analyzeAuthoritativeLinks($, currentUrl) {
        const currentDomain = new URL(currentUrl).hostname;
        let authoritativeScore = 0;
        let authorLinks = 0;
        
        // Authoritative domains (academic, government, established media)
        const authoritativeDomains = [
            // Academic
            '.edu', '.ac.uk', 'arxiv.org', 'scholar.google.com', 'researchgate.net',
            // Government
            '.gov', '.gov.uk', 'europa.eu', 'who.int', 'cdc.gov',
            // Established media
            'reuters.com', 'bbc.com', 'nytimes.com', 'wsj.com', 'economist.com',
            // Professional
            'linkedin.com', 'orcid.org', 'publons.com'
        ];

        $('a[href^="http"]').each((i, link) => {
            const href = $(link).attr('href');
            const linkText = $(link).text().toLowerCase();
            
            if (href && !href.includes(currentDomain)) {
                // Check against authoritative domains
                const isAuthoritative = authoritativeDomains.some(domain => 
                    href.includes(domain)
                );
                
                if (isAuthoritative) {
                    authoritativeScore += 3;
                    
                    // Extra points for author profile links
                    if (linkText.includes('author') || linkText.includes('profile') || 
                        linkText.includes('linkedin') || linkText.includes('orcid')) {
                        authorLinks++;
                        authoritativeScore += 5;
                    }
                }
            }
        });

        return {
            score: Math.min(authoritativeScore, 50),
            count: authoritativeScore / 3,
            authorLinks
        };
    }

    /**
     * Detect institutional signals
     */
    detectInstitutionalSignals($, schemaData) {
        const signals = [];
        let score = 0;
        let found = false;

        // Schema-based institutional detection
        schemaData.forEach(schema => {
            const schemaArray = Array.isArray(schema) ? schema : [schema];
            schemaArray.forEach(item => {
                if (item['@type'] === 'Organization' || item.publisher?.type === 'Organization') {
                    const org = item.publisher || item;
                    if (org.name) {
                        signals.push(`Organization: ${org.name}`);
                        score += 15;
                        found = true;
                        
                        // Extra points for institutional domains
                        if (org.url && (org.url.includes('.edu') || org.url.includes('.gov'))) {
                            signals.push('Institutional domain affiliation');
                            score += 10;
                        }
                    }
                }
            });
        });

        // Text-based institutional detection
        const pageText = $('body').text().toLowerCase();
        this.authorityIndicators.institutions.forEach(institution => {
            if (pageText.includes(institution)) {
                signals.push(`${institution} mentioned`);
                score += 5;
                found = true;
            }
        });

        return { found, score: Math.min(score, 40), signals };
    }

    /**
     * Analyze contact information and transparency
     */
    analyzeContactInformation($) {
        const contact = {
            found: false,
            score: 0,
            signals: []
        };

        // Email detection
        const emailPattern = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
        const pageText = $('body').text();
        const emails = pageText.match(emailPattern) || [];
        
        if (emails.length > 0) {
            contact.found = true;
            contact.score += 10;
            contact.signals.push(`${emails.length} email address(es) found`);
        }

        // Phone number detection
        const phonePattern = /(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g;
        const phones = pageText.match(phonePattern) || [];
        
        if (phones.length > 0) {
            contact.score += 10;
            contact.signals.push(`${phones.length} phone number(s) found`);
        }

        // Address detection
        const addressIndicators = ['address', 'street', 'avenue', 'road', 'suite', 'floor'];
        const hasAddress = addressIndicators.some(indicator => 
            pageText.toLowerCase().includes(indicator)
        );
        
        if (hasAddress) {
            contact.score += 8;
            contact.signals.push('Physical address information');
        }

        return contact;
    }

    /**
     * Analyze legal pages and policies
     */
    analyzeLegalPages($) {
        const legal = {
            hasPrivacy: false,
            hasAbout: false,
            hasTerms: false,
            score: 0,
            signals: []
        };

        // Check for legal page links
        $('a').each((i, link) => {
            const href = $(link).attr('href') || '';
            const text = $(link).text().toLowerCase();
            
            if (href.includes('privacy') || text.includes('privacy')) {
                legal.hasPrivacy = true;
                legal.score += 10;
                legal.signals.push('Privacy policy available');
            }
            
            if (href.includes('about') || text.includes('about')) {
                legal.hasAbout = true;
                legal.score += 8;
                legal.signals.push('About page available');
            }
            
            if (href.includes('terms') || text.includes('terms')) {
                legal.hasTerms = true;
                legal.score += 5;
                legal.signals.push('Terms of service available');
            }
        });

        return legal;
    }

    /**
     * Count technical terms for expertise assessment
     */
    countTechnicalTerms(text) {
        // Common technical indicators across domains
        const techPatterns = [
            /\b\w+[Ii]mplementation\b/g,
            /\b\w+[Aa]lgorithm\b/g,
            /\b\w+[Mm]ethodology\b/g,
            /\b\w+[Aa]nalysis\b/g,
            /\b\w+[Pp]rotocol\b/g,
            /\b\w+[Ff]ramework\b/g
        ];

        let count = 0;
        techPatterns.forEach(pattern => {
            const matches = text.match(pattern) || [];
            count += matches.length;
        });

        return count;
    }

    /**
     * Count data references and statistics
     */
    countDataReferences(text) {
        const dataPatterns = [
            /\b\d+%\b/g, // Percentages
            /\b\d+,\d+\b/g, // Formatted numbers
            /\b\d+\.\d+\b/g, // Decimals
            /study\s+shows?/gi,
            /research\s+(indicates|shows|finds)/gi,
            /according\s+to\s+\w+/gi
        ];

        let count = 0;
        dataPatterns.forEach(pattern => {
            const matches = text.match(pattern) || [];
            count += matches.length;
        });

        return Math.min(count, 20); // Cap at 20 for scoring
    }

    /**
     * Analyze content depth and comprehensiveness
     */
    analyzeContentDepth($) {
        const depth = {
            score: 0,
            signals: []
        };

        // Word count
        const wordCount = $('body').text().split(/\s+/).length;
        if (wordCount > 1000) {
            depth.score += 10;
            depth.signals.push(`Comprehensive content (${wordCount} words)`);
        }

        // Section structure
        const sections = $('h2, h3').length;
        if (sections > 3) {
            depth.score += 8;
            depth.signals.push(`Well-structured content (${sections} sections)`);
        }

        // Media richness
        const images = $('img').length;
        const videos = $('video, iframe[src*="youtube"], iframe[src*="vimeo"]').length;
        if (images + videos > 2) {
            depth.score += 5;
            depth.signals.push('Media-rich content');
        }

        return depth;
    }

    /**
     * Get credential scoring weights
     */
    getCredentialScore(credential) {
        const scoring = {
            'phd': 20, 'md': 20, 'professor': 18, 'dr.': 15, 'dr ': 15,
            'ceo': 12, 'cto': 12, 'founder': 10, 'director': 10,
            'expert': 8, 'specialist': 8, 'certified': 6, 'licensed': 6
        };
        return scoring[credential] || 5;
    }

    /**
     * Calculate composite E-A-T score
     */
    calculateEATScore(analysis) {
        // Weighted scoring: Expertise 40%, Authoritativeness 35%, Trustworthiness 25%
        const expertiseScore = Math.min(analysis.expertise.score, 100);
        const authorityScore = Math.min(analysis.authoritativeness.score, 100);
        const trustScore = Math.min(analysis.trustworthiness.score, 100);

        const weighted = (expertiseScore * 0.4) + (authorityScore * 0.35) + (trustScore * 0.25);
        return Math.round(Math.min(weighted, 100));
    }

    /**
     * Generate E-A-T improvement recommendations
     */
    generateEATRecommendations(analysis) {
        const recommendations = [];

        // Expertise recommendations
        if (analysis.expertise.score < 30) {
            recommendations.push({
                priority: 'high',
                category: 'expertise',
                title: 'Add Author Information',
                description: 'Include author bios with credentials and expertise indicators'
            });
        }

        if (analysis.expertise.authors.length === 0) {
            recommendations.push({
                priority: 'high',
                category: 'expertise',
                title: 'Identify Content Authors',
                description: 'Add clear authorship attribution using schema markup or bylines'
            });
        }

        // Authority recommendations
        if (analysis.authoritativeness.citations.length === 0) {
            recommendations.push({
                priority: 'medium',
                category: 'authority',
                title: 'Add Citations and References',
                description: 'Include references to authoritative sources to support claims'
            });
        }

        if (analysis.authoritativeness.externalReferences < 3) {
            recommendations.push({
                priority: 'medium',
                category: 'authority',
                title: 'Link to Authoritative Sources',
                description: 'Add links to academic, government, or industry-leading sources'
            });
        }

        // Trust recommendations
        if (!analysis.trustworthiness.hasContactInfo) {
            recommendations.push({
                priority: 'high',
                category: 'trust',
                title: 'Add Contact Information',
                description: 'Provide clear contact details for transparency and trust'
            });
        }

        if (!analysis.trustworthiness.hasPrivacyPolicy) {
            recommendations.push({
                priority: 'medium',
                category: 'trust',
                title: 'Create Privacy Policy',
                description: 'Add privacy policy to establish trust and legal compliance'
            });
        }

        return recommendations.slice(0, 6); // Top 6 recommendations
    }
}

module.exports = EATAnalyzer;