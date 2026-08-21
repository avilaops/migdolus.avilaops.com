# Migdolus Monitor — painel + API (Next 16 standalone).
# Build local: docker build --platform linux/amd64 -t migdolus-painel:latest .
# Deploy:      docker save migdolus-painel:latest | gzip -1 | ssh root@178.105.82.48 'gunzip | docker load'
FROM node:22-alpine AS base
RUN apk add --no-cache libc6-compat

FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

FROM base AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    FOTOS_DIR=/data/fotos
RUN addgroup -S nodejs && adduser -S nextjs -G nodejs && mkdir -p /data/fotos && chown -R nextjs:nodejs /data
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
USER nextjs
EXPOSE 3000
VOLUME ["/data/fotos"]
CMD ["node", "server.js"]
