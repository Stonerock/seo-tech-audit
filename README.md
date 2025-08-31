# SEO Audit Tool

A technical SEO audit platform that analyzes websites for performance, accessibility, and AI optimization.

## Features

- Single page and sitemap-based website analysis
- SEO, performance, and accessibility audits
- Schema markup validation and recommendations
- AI optimization scoring for search visibility
- Priority-based fix recommendations
- Export reports in multiple formats

## Installation

```bash
git clone https://github.com/Stonerock/seo-tech-audit.git
cd seo-tech-audit
npm install
npm start
```

The application runs at `http://localhost:8080`

## Configuration

Create a `.env` file:

```env
PORT=8080
PAGESPEED_API_KEY=your_api_key_here
USE_PSI_METRICS=true
NODE_ENV=production
API_KEYS=your_api_key_1,your_api_key_2
```

## Usage

### Web Interface
1. Open the application in your browser
2. Enter a URL to analyze
3. Choose analysis options (fast mode, JavaScript rendering)
4. View results and export reports

### API

```bash
# Single page audit
GET /api/audit?url=https://example.com

# Health check
GET /api/health

# API documentation
GET /api/docs
```

## Security Features

- API key authentication required in production
- Rate limiting (10 requests per 15 minutes for audits)
- SSRF protection blocks private networks
- Input validation for all URLs
- Security headers on all responses

## Directory Structure

```
├── config/          # Configuration files
├── deployment/      # Deployment scripts
├── docs/           # Documentation
├── middleware/     # Security and middleware
├── services/       # Core business logic
├── tests/          # Test suites
├── utils/          # Utility functions
└── src/            # Frontend source
```

## Development

```bash
npm run dev         # Development server with auto-reload
npm test            # Run security tests
npm run lint        # Code linting
```

## API Authentication

In production, include an API key in requests:

```bash
# Header method
curl -H "X-API-Key: your_key" https://api.example.com/audit?url=https://example.com

# Query parameter method
curl https://api.example.com/audit?url=https://example.com&api_key=your_key
```

## License

MIT