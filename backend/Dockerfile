# Dockerfile for Sparktree SaaS Backend — Production
FROM node:22-alpine AS builder

WORKDIR /app

# Install all deps (including devDeps for TypeScript build)
COPY package*.json ./
RUN npm ci

# Copy source and build
COPY . .
RUN npm run build

# ─── Production image ───────────────────────────────────────────────────────
FROM node:22-alpine

WORKDIR /app

# Install only production deps
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

# Copy compiled JS from builder
COPY --from=builder /app/dist ./dist

# Persistent storage for WhatsApp sessions (mount a Docker volume here)
RUN mkdir -p /app/whatsapp_sessions && chmod 777 /app/whatsapp_sessions
ENV AUTH_STATE_PATH=/app/whatsapp_sessions

EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

CMD ["node", "dist/src/api.js"]
