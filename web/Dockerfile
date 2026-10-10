# Build context is the repo root (see docker-compose.yml) so the shared API types are available.
FROM node:22-alpine AS deps
WORKDIR /app/web
COPY web/package.json web/package-lock.json ./
RUN npm ci

FROM node:22-alpine AS build
WORKDIR /app/web
ARG API_URL=http://api:4000
ENV API_URL=$API_URL \
    NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/web/node_modules ./node_modules
COPY web/ ./
COPY shared/ ../shared/
RUN npm run build

FROM node:22-alpine AS run
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0
RUN addgroup -S arc && adduser -S arc -G arc
COPY --from=build --chown=arc:arc /app/web/.next/standalone ./
COPY --from=build --chown=arc:arc /app/web/.next/static ./.next/static
COPY --from=build --chown=arc:arc /app/web/public ./public
USER arc
EXPOSE 3000
CMD ["node", "server.js"]
