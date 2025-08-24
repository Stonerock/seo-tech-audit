/**
 * Attention Analytics Component Library
 * Modern, reusable UI components for SEO audit interfaces
 * Inspired by Profound.co design principles
 */

class AttentionComponents {
    constructor() {
        this.theme = {
            colors: {
                primary: '#0066FF',
                success: '#2EA043',
                warning: '#FB8500',
                danger: '#F85149',
                dark: '#0D1117',
                gray: '#21262D',
                border: '#30363D'
            },
            fonts: {
                sans: 'Inter, system-ui, sans-serif',
                mono: 'JetBrains Mono, monospace'
            }
        };
        this.injectStyles();
    }

    injectStyles() {
        const style = document.createElement('style');
        style.textContent = `
            /* Attention Components Base Styles */
            .attention-glass-card {
                background: rgba(255, 255, 255, 0.02);
                backdrop-filter: blur(10px);
                border: 1px solid rgba(255, 255, 255, 0.05);
                transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            }
            
            .attention-glass-card:hover {
                transform: translateY(-2px);
                background: rgba(255, 255, 255, 0.04);
            }
            
            .attention-score-circle {
                position: relative;
                width: 80px;
                height: 80px;
            }
            
            .attention-score-circle svg {
                transform: rotate(-90deg);
                width: 100%;
                height: 100%;
            }
            
            .attention-score-circle .progress {
                fill: none;
                stroke-width: 6;
                stroke-linecap: round;
                transition: stroke-dasharray 1.5s ease-in-out;
            }
            
            .attention-score-text {
                position: absolute;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                font-weight: 700;
                font-size: 16px;
            }
            
            .attention-status-indicator {
                width: 8px;
                height: 8px;
                border-radius: 50%;
                display: inline-block;
                margin-right: 8px;
            }
            
            .attention-status-good { background-color: #2EA043; }
            .attention-status-warning { background-color: #FB8500; }
            .attention-status-danger { background-color: #F85149; }
            
            .attention-executive-summary {
                background: linear-gradient(135deg, #0066FF08 0%, #2EA04308 100%);
                border-left: 3px solid #0066FF;
            }
            
            .attention-business-impact {
                background: linear-gradient(135deg, #2EA04308 0%, #FB850008 100%);
                border-left: 3px solid #2EA043;
            }
        `;
        document.head.appendChild(style);
    }

    /**
     * Creates a modern metric card with score circle
     */
    createMetricCard(config) {
        // Null safety check
        if (!config || typeof config !== 'object') {
            console.warn('createMetricCard: Invalid config provided', config);
            return '<div class="attention-glass-card rounded-xl p-6"><div class="text-center text-gray-500">Loading...</div></div>';
        }
        
        const { title = 'Loading...', subtitle = '', score = 0, maxScore = 100, status = 'warning', description = 'Analyzing...' } = config;
        const percentage = Math.max(0, Math.min(100, (score / maxScore) * 100));
        const circumference = 2 * Math.PI * 34;
        const strokeDasharray = `${(percentage / 100) * circumference} ${circumference}`;
        
        const statusColor = status === 'good' ? this.theme.colors.success :
                           status === 'warning' ? this.theme.colors.warning : 
                           this.theme.colors.danger;

        return `
            <div class="attention-glass-card rounded-xl p-6">
                <div class="flex items-center justify-between mb-4">
                    <div>
                        <h3 class="font-semibold text-gray-200">${title}</h3>
                        <p class="text-sm text-gray-500">${subtitle}</p>
                    </div>
                    <div class="attention-score-circle">
                        <svg viewBox="0 0 80 80">
                            <circle cx="40" cy="40" r="34" fill="none" stroke="#30363D" stroke-width="6"></circle>
                            <circle class="progress" cx="40" cy="40" r="34" stroke="${statusColor}" stroke-dasharray="${strokeDasharray}"></circle>
                        </svg>
                        <div class="attention-score-text" style="color: ${statusColor}">${score}</div>
                    </div>
                </div>
                <div class="text-xs text-gray-500">
                    <span class="attention-status-indicator attention-status-${status}"></span>
                    ${description}
                </div>
            </div>
        `;
    }

    /**
     * Creates an executive summary dashboard
     */
    createExecutiveSummary(config) {
        // Null safety check
        if (!config || typeof config !== 'object') {
            console.warn('createExecutiveSummary: Invalid config provided', config);
            return '<div class="attention-executive-summary rounded-2xl p-8 mb-16"><div class="text-center text-gray-500">Loading executive summary...</div></div>';
        }
        
        const { overallScore = 0, metrics = [], businessImpact = [], quickWins = [] } = config;
        
        // Ensure metrics is an array and has valid data
        const validMetrics = Array.isArray(metrics) ? metrics.filter(m => m && typeof m === 'object') : [];
        const metricsHtml = validMetrics.map(metric => this.createMetricCard(metric)).join('');
        
        return `
            <div class="attention-executive-summary rounded-2xl p-8 mb-16">
                <div class="flex items-center justify-between mb-8">
                    <div>
                        <h2 class="text-2xl font-bold mb-2">Executive Summary</h2>
                        <p class="text-gray-400">For stakeholders who need the bottom line</p>
                    </div>
                    <div class="text-right">
                        <div class="text-4xl font-bold" style="color: ${this.theme.colors.primary}">${overallScore}</div>
                        <div class="text-sm text-gray-400">Overall Score</div>
                    </div>
                </div>

                <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
                    ${metricsHtml || '<div class="col-span-3 text-center text-gray-500">Metrics loading...</div>'}
                </div>

                <div class="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div class="attention-business-impact rounded-xl p-6">
                        <h3 class="font-semibold mb-3 flex items-center" style="color: ${this.theme.colors.success}">
                            <i class="fas fa-chart-line mr-2"></i>
                            Business Impact
                        </h3>
                        <ul class="space-y-2 text-sm text-gray-300">
                            ${Array.isArray(businessImpact) && businessImpact.length > 0 ? businessImpact.map(item => `<li>• ${item || 'Loading...'}</li>`).join('') : '<li>• Analyzing impact...</li>'}
                        </ul>
                    </div>
                    <div class="attention-glass-card rounded-xl p-6">
                        <h3 class="font-semibold mb-3 flex items-center" style="color: ${this.theme.colors.primary}">
                            <i class="fas fa-code mr-2"></i>
                            Quick Wins Available
                        </h3>
                        <ul class="space-y-2 text-sm text-gray-300">
                            ${Array.isArray(quickWins) && quickWins.length > 0 ? quickWins.map(item => `<li>• ${item || 'Loading...'}</li>`).join('') : '<li>• Analyzing opportunities...</li>'}
                        </ul>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Creates a detailed analysis section
     */
    createAnalysisSection(config) {
        const { icon, title, subtitle, score, status, buttonText, sectionId, content } = config;
        
        const statusColor = status === 'good' ? this.theme.colors.success :
                           status === 'warning' ? this.theme.colors.warning : 
                           this.theme.colors.danger;

        const buttonClass = status === 'good' ? 'bg-green-600 hover:bg-green-700' :
                           status === 'warning' ? 'bg-orange-600 hover:bg-orange-700' :
                           'bg-red-600 hover:bg-red-700';

        return `
            <div class="attention-glass-card rounded-2xl overflow-hidden">
                <div class="p-8 cursor-pointer" onclick="toggleSection('${sectionId}')">
                    <div class="flex items-center justify-between">
                        <div class="flex items-center space-x-6">
                            <div class="w-16 h-16 rounded-2xl flex items-center justify-center" style="background: ${statusColor}10;">
                                <i class="${icon} text-2xl" style="color: ${statusColor}"></i>
                            </div>
                            <div>
                                <h3 class="text-2xl font-bold mb-2">${title}</h3>
                                <p class="text-gray-400 text-lg">${subtitle}</p>
                            </div>
                        </div>
                        <div class="text-center">
                            <div class="text-3xl font-bold" style="color: ${statusColor}">${score}</div>
                            <button class="${buttonClass} text-white px-4 py-2 rounded-lg mt-2 transition-colors text-sm">
                                ${buttonText}
                            </button>
                        </div>
                    </div>
                </div>
                
                <div id="${sectionId}" class="collapsible">
                    <div class="px-8 pb-8 border-t" style="border-color: ${this.theme.colors.border}">
                        ${content}
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Creates a priority fix card
     */
    createPriorityFix(config) {
        // Null safety check
        if (!config || typeof config !== 'object') {
            console.warn('createPriorityFix: Invalid config provided', config);
            return '<div class="attention-glass-card rounded-2xl p-8"><div class="text-center text-gray-500">Loading fix...</div></div>';
        }
        
        const { 
            number = '?', 
            title = 'Loading fix...', 
            description = 'Analyzing...', 
            impact = 'Determining impact...', 
            aiBenefit = 'Evaluating AI benefits...', 
            effort = 'Estimating effort...' 
        } = config;
        
        return `
            <div class="attention-glass-card rounded-2xl p-8 border" style="border-color: ${this.theme.colors.primary}20;">
                <div class="flex items-center gap-4 mb-4">
                    <div class="w-12 h-12 text-white rounded-full flex items-center justify-center font-bold text-xl" style="background: ${this.theme.colors.primary}">
                        ${number}
                    </div>
                    <div>
                        <h3 class="text-2xl font-bold">${title}</h3>
                        <p class="text-gray-400">${description}</p>
                    </div>
                </div>
                <div class="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm rounded-lg p-4" style="background: ${this.theme.colors.gray}50;">
                    <div><strong style="color: ${this.theme.colors.success}">Impact:</strong> ${impact}</div>
                    <div><strong style="color: ${this.theme.colors.primary}">AI Benefit:</strong> ${aiBenefit}</div>
                    <div><strong style="color: ${this.theme.colors.warning}">Effort:</strong> ${effort}</div>
                </div>
            </div>
        `;
    }

    /**
     * Migration helper: wraps existing content with new styling
     */
    wrapExistingContent(selector, wrapperClass = 'attention-glass-card') {
        const elements = document.querySelectorAll(selector);
        elements.forEach(el => {
            if (!el.classList.contains(wrapperClass)) {
                el.classList.add(wrapperClass);
            }
        });
    }

    /**
     * Initializes collapsible sections
     */
    initializeCollapsibles() {
        const style = document.createElement('style');
        style.textContent = `
            .collapsible {
                max-height: 0;
                overflow: hidden;
                transition: max-height 0.4s cubic-bezier(0.4, 0, 0.2, 1);
            }
            .collapsible.expanded {
                max-height: 2000px;
            }
        `;
        document.head.appendChild(style);

        // Add global toggle function
        window.toggleSection = function(sectionId) {
            const section = document.getElementById(sectionId);
            if (section) {
                section.classList.toggle('expanded');
            }
        };
    }
}

// Export for use
window.AttentionComponents = AttentionComponents;