FROM node:18-alpine

WORKDIR /app

# Copy package files first for better layer caching
COPY package*.json ./

# Install production dependencies only
RUN npm install --production

# Copy application source
# NOTE: .env is NOT copied — environment variables must be provided
# at runtime via the hosting platform's environment variable settings,
# docker run --env-file, or docker-compose environment section.
COPY . .

# Remove .env if it was accidentally included (e.g. from a local build context)
RUN rm -f .env

# Ensure the uploads directory exists and is writable
RUN mkdir -p /app/public/uploads && chmod 755 /app/public/uploads

EXPOSE 3000

# Environment defaults — override these in your hosting platform
ENV NODE_ENV=production

# Health check for the reverse proxy / load balancer
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

CMD ["node", "server.js"]