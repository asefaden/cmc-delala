# ---- Stage 1: Build the frontend ----
FROM node:18-alpine AS frontend-build
WORKDIR /frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# ---- Stage 2: Production ----
FROM node:18-alpine
WORKDIR /app

# Copy backend package files and install production deps
COPY backend/package*.json ./
RUN npm ci --production

# Copy backend source
COPY backend/ ./

# Copy built frontend from Stage 1
# server.js looks for ../frontend/dist relative to __dirname (/app)
# So the frontend dist must be at /app/../frontend/dist = /frontend/dist
COPY --from=frontend-build /frontend/dist /frontend/dist

# Ensure uploads directory exists and is writable
RUN mkdir -p /app/uploads && chmod 755 /app/uploads

# Remove .env if accidentally included
RUN rm -f .env

EXPOSE 3000

ENV NODE_ENV=production

HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

CMD ["node", "server.js"]