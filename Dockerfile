FROM node:22-alpine AS base
WORKDIR /app
# Alpine ships no OpenSSL by default — without it, Prisma's engine can't detect
# a libssl version, guesses wrong, and fails at runtime with a garbled response.
RUN apk add --no-cache openssl
COPY package.json package-lock.json* ./
RUN npm install

FROM base AS builder
# Render injects each service env var as a Docker build arg, but only variables
# declared with ARG are visible to `next build` — and next.config.ts's rewrites()
# reads NEST_API_URL at build time to decide the /api/* proxy target. Without this,
# the build sees an empty NEST_API_URL and bakes zero rewrites into the image.
ARG NEST_API_URL
ENV NEST_API_URL=$NEST_API_URL
COPY . .
RUN npm run prisma:generate && npm run build:web

FROM node:22-alpine AS runner
WORKDIR /app
RUN apk add --no-cache openssl
ENV NODE_ENV=production
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/prisma ./prisma
EXPOSE 3000
CMD ["npm", "run", "start:web"]
