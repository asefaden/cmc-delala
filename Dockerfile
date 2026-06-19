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

# Copy frontend source code
COPY frontend/ ./

# Build Vite → outputs to ../dist (configured in vite.config.js)
RUN npm run build


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
# Vite outDir: "../dist" in /app → outputs to /dist in the builder stage
COPY --from=frontend-builder /dist /workspace/dist

# Create uploads directory
RUN mkdir -p /workspace/uploads

# Expose the application port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

# Start the server
CMD ["node", "server.js"]