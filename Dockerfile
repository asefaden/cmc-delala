FROM node:20-alpine AS builder

WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

FROM node:20-bookworm-slim

WORKDIR /app
COPY backend/ ./backend/
COPY --from=builder /app/frontend/dist/ ./dist/
COPY package.json ./
COPY backend/package.json ./backend/

RUN apt-get update && apt-get install -y --no-install-recommends \
    libatomic1 \
    g++ \
    make \
    python3 \
    && rm -rf /var/lib/apt/lists/*

RUN npm ci --prefix backend && npm prune --prefix backend --production

EXPOSE 3000
ENV NODE_ENV=production
CMD ["node", "backend/server.js"]
