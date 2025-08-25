FROM node:20-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY package.json ./
COPY package-lock.json* ./

# Install only essential dependencies for fast startup
RUN npm ci --only=production --no-optional && npm cache clean --force

# Copy application code
COPY server.js ./
COPY services/ ./services/
COPY utils/ ./utils/
COPY config/ ./config/

# Create minimal utils structure if it doesn't exist
RUN mkdir -p utils && \
    echo 'const log = { info: console.log, warn: console.warn, error: console.error }; module.exports = { logger: log };' > utils/logger.js

# Set environment variables
ENV NODE_ENV=production
ENV PORT=8080

# Health check with faster interval
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
  CMD node -e "require('http').get('http://localhost:8080/api/health', (res) => process.exit(res.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"

# Expose port
EXPOSE 8080

# Start the optimized server
CMD ["node", "server.js"]