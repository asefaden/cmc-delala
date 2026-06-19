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

EXPOSE 3000

# Environment defaults — override these in your hosting platform
ENV NODE_ENV=production

CMD ["node", "server.js"]