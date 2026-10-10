# syntax=docker/dockerfile:1
# Build context is the REPO ROOT so the build can see shared/api-types.ts:
#   docker build -f api/Dockerfile -t arc-api .

FROM node:22-alpine AS deps
WORKDIR /app/api
COPY api/package.json api/package-lock.json ./
RUN npm ci --no-audit --no-fund

FROM deps AS build
COPY shared ../shared
COPY api/ ./
RUN npm run build

FROM node:22-alpine AS prod-deps
WORKDIR /app/api
COPY api/package.json api/package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund && npm cache clean --force

FROM node:22-alpine AS runtime
ENV NODE_ENV=production \
    PORT=4000 \
    HOST=0.0.0.0
WORKDIR /app/api
COPY api/package.json ./
COPY --from=prod-deps /app/api/node_modules ./node_modules
COPY --from=build /app/api/dist ./dist
COPY api/drizzle ./drizzle
# The official image ships an unprivileged "node" user (uid 1000).
USER node
EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- "http://127.0.0.1:${PORT}/api/health" >/dev/null || exit 1
CMD ["node", "dist/server.js"]
