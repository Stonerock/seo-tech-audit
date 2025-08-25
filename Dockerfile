# Dockerfile for SEO Audit Backend - Cloud Run Optimized
# Following DevOps best practices for production deployment

FROM node:20-slim

# Install curl for health checks
RUN apt-get update && apt-get install -y curl && rm -rf /var/lib/apt/lists/*

# Security: Create non-root user
RUN groupadd -r appuser && useradd -r -g appuser appuser

# Set working directory
WORKDIR /app

# Security: Copy package files first for better layer caching
COPY package*.json ./

# Install only production dependencies
# No Playwright needed - using Browserless.io for headless browsing
ENV NODE_ENV=production
RUN npm ci --only=production --no-audit --no-fund && \
    npm cache clean --force

# Copy application code
COPY server.js ./
COPY services/ ./services/
COPY utils/ ./utils/
COPY config/ ./config/

# Create minimal utils structure if it doesn't exist
RUN mkdir -p utils && \
    echo 'const log = { info: console.log, warn: console.warn, error: console.error }; module.exports = { logger: log };' > utils/logger.js

# Security: Change ownership to non-root user
RUN chown -R appuser:appuser /app

# Switch to non-root user
USER appuser

# Environment variables
ENV NODE_ENV=production
ENV PORT=8080

# Production optimizations for Cloud Run
ENV NODE_OPTIONS="--max-old-space-size=1536"
ENV UV_THREADPOOL_SIZE=128

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:$PORT/api/health || exit 1

# Expose port
EXPOSE 8080

# Start the application
CMD ["node", "server.js"]