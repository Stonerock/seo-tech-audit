# SEO Audit Tool

A comprehensive SEO and technical audit tool designed for digital agencies and developers. Because "attention is all you need" in AI, but apparently you also need proper schema markup, robots.txt, and the ability to explain to clients why their bounce rate is higher than their conversion rate.

## Features

- **Single Page Analysis**: Complete SEO, accessibility, and performance audit (the works)
- **Sitemap Crawling**: Analyze entire websites (up to 200 pages, because who has time for more?)
- **Schema Validation**: Automatic content type detection and schema recommendations
- **AI Readiness**: Optimization for Google AI Overviews and LLM crawlers (future-proofing included)
- **Fix Priorities**: Actionable task list with effort estimates and impact analysis (no more "fix everything" requests)
- **Multiple Export Formats**: CSV reports, action plans, and client-ready summaries

### AI Optimization Features ✨

Because the robots are taking over search results, might as well help them understand your content:

- **🏆 AI Surfaces Readiness Score**: Comprehensive 0-100 scoring system with 6 weighted sub-metrics for AI optimization
- **Google AI Overview Optimization**: Featured snippet potential, entity recognition, Q&A structure analysis
- **Content Structure Analysis**: AI-readable hierarchy, optimal paragraph lengths, content completeness scoring

#### AI Surfaces Readiness Score

Our proprietary scoring system evaluates content readiness for AI systems across 6 key dimensions:

- **Answer Clarity (25%)**: Clear headings, Q&A format, direct answers, readability
- **Structured Data (20%)**: Schema.org markup, JSON-LD implementation, AI-friendly schemas
- **Extractable Facts (20%)**: Factual content, data points, statistics, concrete information
- **Citations & Sources (15%)**: External links, authoritative sources, credible references
- **Content Recency (10%)**: Last modified dates, fresh content, current information
- **Technical Optimization (10%)**: Page speed, mobile-friendly, robots.txt accessibility

**Unique Features:**
- Interactive scoring methodology explanation
- Detailed per-metric analysis and recommendations
- Integration with Fix Priorities for actionable tasks
- Export functionality for client reports
- Visual dashboard with gradient scoring display

## Tech Stack

- **Frontend**: Vanilla HTML/CSS/JS with Tailwind CSS
- **Backend**: Node.js + Express
- **Analysis**: Puppeteer, Lighthouse, axe-core
- **External APIs**: PageSpeed Insights, WebPageTest (optional)

## Quick Start

### Prerequisites
- Node.js 18+ 
- npm

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd seo-audit-tool

# Install dependencies
npm install

# Start the server
npm start
```

The tool will be available at `http://localhost:3001`

### First Run
- Puppeteer will download Chromium automatically (may take a few minutes)
- No additional configuration required for basic usage

## Configuration

### Environment Variables (Optional)

Create a `.env` file in the project root:

```env
# External API keys (optional)
PSI_API_KEY=your_pagespeed_insights_key
WPT_API_KEY=your_webpagetest_key
WPT_LOCATION=eu-west-1

# Server configuration
PORT=3001

# Sitemap analysis limits
SITEMAP_MAX_URLS=50

# Enable Lighthouse by default
LIGHTHOUSE=1
```

### API Keys Setup

**PageSpeed Insights**: Get your API key from [Google Cloud Console](https://console.cloud.google.com/apis/credentials)

**WebPageTest**: Register at [WebPageTest](https://www.webpagetest.org/getkey.php)

## Usage

### Single Page Audit

1. Enter a URL in the input field
2. Optionally enable Lighthouse (slower but more detailed, like a thorough code review)
3. Click "Full Analysis"
4. Review results and try not to cry at the accessibility score
5. Export reports and prepare your client presentation

### Sitemap Analysis

1. Enter a website URL
2. Set the number of pages to analyze (1-200, default 50 because we're not monsters)
3. Click "Sitemap Scan"
4. Get comprehensive site-wide analysis with schema recommendations
5. Watch as the tool finds schema issues you didn't know existed

### Fix Priorities

After any audit (the moment of truth):
1. Click "Fix Priorities" to see actionable tasks ranked by urgency
2. Tasks are categorized by urgency (Critical = fix now, Low = someday maybe)
3. Each task includes effort estimate and business impact (so you can prioritize properly)
4. Export as CSV for client reports or Markdown for your development backlog

### AI Surfaces Readiness Analysis

The tool's flagship feature provides comprehensive AI optimization scoring:
- **AI Surfaces Readiness Score**: 0-100 scoring with 6 weighted sub-metrics for complete AI optimization
- **Interactive analysis**: Click the (i) icon to understand scoring methodology
- **Detailed breakdown**: "Detailed Analysis" button opens comprehensive per-metric analysis
- **Actionable insights**: Specific recommendations for each sub-metric
- **Export reports**: Download detailed AI readiness reports for clients
- **Fix Priorities integration**: AI issues automatically appear in actionable task lists

Additional AI Analysis:
- **Google AI Overview optimization**: Featured snippet potential and entity recognition
- **Content structure scoring**: AI-readable hierarchy and content completeness

## API Endpoints

### Core Endpoints

```bash
# Health check
GET /api/health

# Single page audit
POST /api/audit
Content-Type: application/json
{
  "url": "https://example.com",
  "lighthouse": true
}

# Sitemap-based audit
POST /api/sitemap-audit
Content-Type: application/json
{
  "url": "https://example.com",
  "maxUrls": 50
}

# Generate llms.txt
POST /api/llms/generate
Content-Type: application/json
{
  "url": "https://example.com"
}

# Clear cache
POST /api/cache/clear
```

## Development

### Scripts

```bash
npm start       # Production server
npm run dev     # Development with nodemon
npm test        # Run tests (placeholder)
```

### Project Structure

```
├── server.js           # Express server and audit logic
├── index.html          # Frontend application
├── package.json        # Dependencies and scripts
├── .env.example        # Environment template
└── README.md           # This file
```

### Adding New Audit Tests

1. Create test function in `server.js`
2. Add to main audit pipeline
3. Update frontend display logic
4. Include in fix priorities system

## Troubleshooting

### Common Issues

**Puppeteer Download Fails**
```bash
# Skip download and use system Chrome
PUPPETEER_SKIP_DOWNLOAD=1 npm install
# Set Chrome path
export PUPPETEER_EXECUTABLE_PATH="/usr/bin/google-chrome"
```

**Port Already in Use**
```bash
PORT=3002 npm start
```

**Memory Issues with Large Sites**
- Reduce `SITEMAP_MAX_URLS`
- Increase Node.js memory: `node --max-old-space-size=4096 server.js`

**Lighthouse Timeouts**
- Disable Lighthouse for problematic sites
- Check network connectivity and site response times

### Performance Tips

- Use environment variables for production
- Enable caching for repeated audits
- Set appropriate `SITEMAP_MAX_URLS` for your use case
- Consider running multiple instances for high-volume usage

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

### Code Style

- Use consistent indentation (2 spaces)
- Add JSDoc comments for complex functions
- Follow existing patterns for audit functions
- Test with various website types

## License

MIT License - see LICENSE file for details

---

**Built for digital agencies and SEO professionals who need more than "you should improve your SEO"**  

Comprehensive auditing with actionable insights, because saying "add more keywords" isn't a strategy anymore. Now with AI optimization features, because apparently humans weren't complicated enough to optimize for.
