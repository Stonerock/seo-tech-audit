# SEO Audit Tool

A comprehensive SEO and technical audit tool designed for digital agencies and developers. Analyze single pages or entire sites via sitemap with actionable prioritized recommendations.

## Features

- **Single Page Analysis**: Complete SEO, accessibility, and performance audit
- **Sitemap Crawling**: Analyze entire websites (up to 200 pages)
- **Schema Validation**: Automatic content type detection and schema recommendations
- **AI Readiness**: Optimization for Google AI Overviews and LLM crawlers
- **Fix Priorities**: Actionable task list with effort estimates and impact analysis
- **Multiple Export Formats**: CSV reports, action plans, and client-ready summaries

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
2. Optionally enable Lighthouse (slower but more detailed)
3. Click "Full Analysis"
4. Review results and export reports

### Sitemap Analysis

1. Enter a website URL
2. Set the number of pages to analyze (1-200)
3. Click "Sitemap Scan"
4. Get comprehensive site-wide analysis with schema recommendations

### Fix Priorities

After any audit:
1. Click "Fix Priorities" to see actionable tasks
2. Tasks are categorized by urgency (Critical, High, Medium, Low)
3. Each task includes effort estimate and business impact
4. Export as CSV for client reports or Markdown for development teams

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

**Built for digital agencies and SEO professionals**  
Comprehensive auditing with actionable insights for better website optimization.