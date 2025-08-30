# Minimal working Dockerfile - Authentication fix only
FROM node:20-slim

WORKDIR /app

# Copy package.json but remove "type": "module" to avoid ES module issues
COPY package*.json ./
ENV NODE_ENV=production
RUN npm ci --only=production --no-audit --no-fund && npm cache clean --force

# Ensure CommonJS runtime even if repo has "type": "module"
RUN sed -i '/"type"\s*:\s*"module"/d' package.json || true

# Copy application files
COPY . .

# Ensure package.json stays CommonJS after copy
RUN sed -i '/"type"\s*:\s*"module"/d' package.json || true

# Verify app code is CommonJS (no .mjs or type: module) excluding node_modules
RUN echo "Verifying app code is CJS..." \
 && ! find . -path ./node_modules -prune -o -type f -name "*.mjs" -print | grep . \
 && ! find . -path ./node_modules -prune -o -type f -name "package.json" -exec grep -l '\"type\"[[:space:]]*:[[:space:]]*\"module\"' {} \; | grep . \
 || (echo "ESM artifacts detected in app code" && exit 1)

EXPOSE 8080

USER node

ENV PORT=8080
ENV ENABLE_LOCAL_PLAYWRIGHT=0

CMD ["node", "server.js"]