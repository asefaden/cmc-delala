# ===========================================
# Backend Dockerfile - Node.js API Server
# ===========================================
FROM node:20-alpine

# Add dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# Set working directory
WORKDIR /app

# Copy package files first for better layer caching
COPY package.json package-lock.json ./

# Install production dependencies only
RUN npm ci --omit=dev && npm cache clean --force

# Copy application code
COPY . .

# Create uploads directory with proper permissions
RUN mkdir -p /app/uploads && chown -R node:node /app

# Switch to non-root user
USER node

# Expose backend port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

# Start the server with dumb-init for proper PID 1 signal handling
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "server.js"]