FROM node:22-alpine AS base
WORKDIR /app
# Alpine ships no OpenSSL by default — without it, Prisma's engine can't detect
# a libssl version, guesses wrong, and fails at runtime with a garbled response
# instead of running the migration.
RUN apk add --no-cache openssl
COPY package.json package-lock.json* ./
RUN npm install

FROM base AS builder
WORKDIR /app
COPY . .
RUN npm run prisma:generate && npm run build:api

FROM node:22-alpine AS runner
WORKDIR /app
RUN apk add --no-cache openssl
ENV NODE_ENV=production
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist/api ./dist/api
COPY --from=builder /app/prisma ./prisma
EXPOSE 4000
# Runs migrations before every boot (idempotent — a no-op once the schema is
# current). Needed because Render's free plan doesn't support preDeployCommand;
# a JSON-array CMD with an explicit shell avoids the argv-splitting quirks that
# a service-level `dockerCommand:` override in render.yaml runs into.
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/api/backend/src/main.js"]
