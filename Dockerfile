# ============================================
# Multi-stage Dockerfile for CMC Delala App
# Stage 1: Build frontend (Vite)
# Stage 2: Production (Node.js + backend + built frontend)
# ============================================

# --- Stage 1: Build frontend ---
FROM node:20-alpine AS frontend-builder

WORKDIR /app

# Copy frontend package files first (better Docker layer caching)
COPY frontend/package.json frontend/package-lock.json ./

# Install frontend dependencies
RUN npm ci

# Copy frontend source code (includes .env files needed for Vite build)
COPY frontend/ ./

# Build Vite → outDir: "../dist" resolves to /dist (parent of WORKDIR /app)
RUN npm run build

# Verify build output exists before proceeding
RUN echo "--- Verifying frontend build output ---" \
    && ls -la /dist/ \
    && test -f /dist/index.html \
    && echo "--- Frontend build OK ---" \
    || (echo "ERROR: /dist/index.html not found after Vite build!" && exit 1)


# --- Stage 2: Production ---
FROM node:20-alpine AS production

# Set production environment
ENV NODE_ENV=production

WORKDIR /workspace

# Copy backend package files
COPY backend/package.json backend/package-lock.json* ./

# Install backend dependencies only (no devDependencies)
RUN npm ci --omit=dev

# Copy backend source code
COPY backend/ ./

# Copy built frontend from Stage 1
COPY --from=frontend-builder /dist /workspace/dist

# Verify frontend files are in place
RUN echo "--- Verifying production frontend ---" \
    && ls -la /workspace/dist/ \
    && test -f /workspace/dist/index.html \
    && echo "--- Production frontend OK ---" \
    || (echo "ERROR: /workspace/dist/index.html not found!" && exit 1)

# Create uploads directory
RUN mkdir -p /workspace/uploads

# Expose the application port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

# Start the server
CMD ["node", "server.js"]