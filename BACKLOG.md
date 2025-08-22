# SEO Audit Tool - Development Backlog

## 🎯 **TIER 1: High Impact, High Demand (Next Sprint)**

### 1. AI Surfaces Readiness Score ⭐⭐⭐⭐⭐
**Status**: ✅ Implemented (v0.1)
**Effort**: 2-3 days  
**Impact**: Maximum - Core differentiator  

**Requirements**:
- Rollup score (0-100) combining multiple AI readiness factors
- Sub-metrics: Answer clarity, structured data, extractable facts, citations, recency, speed
- Ground checks in Google's "AI features and your website" guidance
- Visual dashboard with color-coded metrics
- Integration with Fix Priorities system

**Acceptance Criteria**:
- [x] Overall AI readiness score calculation (0–100, grade A–F)
- [x] Sub-metric breakdowns with explanations/weights
- [x] Visual score display with recommendations
- [ ] Integration with existing Fix Priorities (planned follow-up)
- [x] Export functionality for client reports (CSV)

**Implementation Details**:
- Backend (server.js)
  - Added `computeAISurfaces($, tests)` → returns `{ score, grade, weights, subs, recommendations }`
  - Weighted sub-metrics (sum to 100): Answer Clarity 25, Structured Data 20, Extractable Facts 20, Citations 15, Recency 10, Technical 10
  - Integrated into audit pipeline as `tests.aiSurfaces`
- Frontend (index.html)
  - New AI Surfaces card under AI section: total score, grade, color-coded
  - Sub-metrics grid with individual scores and weights
  - Recommendations list from backend
  - CSV export: `exportAISurfacesCsv()` (single‑URL)

**Notes**:
- Sub-metrics pull signals from existing tests: schema/metadata/performance/headers + Cheerio content heuristics
- The “Fix Priorities” mapping is not yet wired; see Follow-ups

**Follow-ups** (to complete full scope):
- Map lowest scoring sub-metrics → Fix Priorities with effort tiers
  - Critical (<30): 6–8 h, High (30–50): 4–6 h, Medium (50–70): 2–4 h
- Modal with detailed per-metric rationale and examples
- Batch CSV export including AI Surfaces score per URL

---

### 2. Multi-bot Access and Policy Audit ⭐⭐⭐⭐⭐
**Status**: 🔄 Ready for Development  
**Effort**: 3-4 days  
**Impact**: Maximum - Unique market position  

**Requirements**:
- Parse robots.txt and HTTP headers for comprehensive bot analysis
- Check access status for all major AI bots:
  - Googlebot and Google-Extended (with training opt-out clarification)
  - GPTBot and ChatGPT-User
  - PerplexityBot (with stealth crawling warnings)
  - Anthropic's Claude bots
- Identify conflicts and policy inconsistencies
- Generate recommended robots.txt diff
- WAF rule suggestions for problematic bots

**Acceptance Criteria**:
- [ ] Complete bot access matrix display
- [ ] Conflict detection and reporting
- [ ] Recommended robots.txt generator
- [ ] WAF rule suggestions
- [ ] Educational content about bot behaviors
- [ ] Export bot policy summary

---

### 3. Structured Data Depth Analysis ⭐⭐⭐⭐
**Status**: 🔄 Ready for Development  
**Effort**: 2 days  
**Impact**: High - Extends existing functionality  

**Requirements**:
- Extend current schema validation beyond presence checking
- Prioritize AI-friendly schema types: Article, HowTo, QAPage, FAQPage, Product, Event, Organization, Person, BreadcrumbList
- Validate required and recommended properties per schema type
- "Richness score" based on property completeness
- Identify missing properties with business impact

**Acceptance Criteria**:
- [ ] Schema richness scoring system
- [ ] Property-level validation
- [ ] Missing property recommendations
- [ ] AI-relevance priority scoring
- [ ] Visual schema completeness dashboard

---

### 4. E-E-A-T Signals Audit ⭐⭐⭐⭐
**Status**: 🔄 Ready for Development  
**Effort**: 3-4 days  
**Impact**: High - Agency selling point  

**Requirements**:
- Audit authorship signals: bylines, author bio pages, author schema
- Check editorial policies and contact information
- Evaluate content expertise indicators
- Map findings to Google's E-E-A-T framework
- Generate concrete improvement tasks

**Acceptance Criteria**:
- [ ] E-E-A-T score calculation
- [ ] Author information detection
- [ ] Editorial policy analysis
- [ ] Contact information validation
- [ ] Expertise signal detection
- [ ] Actionable E-E-A-T improvement tasks

---

## 🥈 **TIER 2: Strong Value, Medium Complexity (Next Month)**

### 5. Extractability Check ⭐⭐⭐⭐
**Status**: 📋 Backlog  
**Effort**: 3-4 days  
**Impact**: High - Technical differentiation  

Compare DOM before/after JS execution, detect extraction barriers.

### 6. Answer Block Detector ⭐⭐⭐⭐
**Status**: 📋 Backlog  
**Effort**: 2-3 days  
**Impact**: High - Direct AI Overview optimization  

Heuristic detection of AI-friendly answer formats.

### 7. Verifiability and Citation Density ⭐⭐⭐
**Status**: 📋 Backlog  
**Effort**: 3 days  
**Impact**: Medium-High - Content quality focus  

Source quality scoring and citation analysis.

### 8. Enhanced llms.txt Generator ⭐⭐⭐
**Status**: 📋 Backlog  
**Effort**: 2 days  
**Impact**: Medium - Builds on existing  

Community spec validation and enhanced curation.

---

## 🥉 **TIER 3: Nice to Have (Future Releases)**

### 9. Entity and Knowledge Graph Grounding ⭐⭐⭐
**Status**: 📋 Backlog  
**Effort**: 5-6 days  
**Impact**: Medium - Technical complexity  

Wikipedia/Wikidata entity verification and scoring.

### 10. Freshness Gradient ⭐⭐⭐
**Status**: 📋 Backlog  
**Effort**: 2-3 days  
**Impact**: Medium - Content sites focus  

Sitemap-based freshness analysis.

### 11. Competitive AIO Gap Finder ⭐⭐⭐
**Status**: 📋 Backlog  
**Effort**: 4-5 days  
**Impact**: High potential - Requires validation  

Multi-site comparison for AI optimization gaps.

---

## 🔧 **TIER 4: Technical/Niche Features (Consider for Specialized Use Cases)**

### 12. Bot Traffic Analysis
**Status**: 📋 Backlog  
**Effort**: 4-5 days  
**Requirements**: Log upload functionality, complex analysis  

### 13. Snippet-Safe Design Lint
**Status**: 📋 Backlog  
**Effort**: 3-4 days  
**Audience**: Technical teams, limited broader appeal  

### 14. Zero-JS Preview
**Status**: 📋 Backlog  
**Effort**: 2-3 days  
**Note**: May overlap with Extractability Check  

### 15. Local LLM Testing
**Status**: 📋 Backlog  
**Effort**: 6-8 days  
**Complexity**: Resource intensive, deployment challenges  

---

## 🚀 **Sprint Planning**

### Sprint 1 (Week 1-2): Foundation AI Features
- AI Surfaces Readiness Score
- Multi-bot Access and Policy Audit

### Sprint 2 (Week 3): Data Enhancement
- Structured Data Depth Analysis
- E-E-A-T Signals Audit

### Sprint 3 (Week 4): Content Analysis
- Answer Block Detector
- Extractability Check

---

## 📊 **Success Metrics**

**Tier 1 Completion Success Criteria**:
- [ ] Unique AI readiness scoring unavailable in competitors
- [ ] Comprehensive bot policy management
- [ ] Deep schema analysis beyond basic validation
- [ ] Professional E-E-A-T evaluation framework
- [ ] Agency-ready reporting for all features
- [ ] Integration with existing Fix Priorities system

**Market Validation**:
- User feedback on AI readiness scoring accuracy
- Adoption rate of generated robots.txt recommendations
- Client report usage of new features
- Competitive analysis showing unique positioning

---

## 🔄 **Backlog Maintenance**

**Review Schedule**: Weekly  
**Priority Reassessment**: After each Tier 1 feature completion  
**User Feedback Integration**: Continuous  
**Market Trend Updates**: Monthly  

**Last Updated**: 2025-08-21  
**Next Review**: 2025-08-28