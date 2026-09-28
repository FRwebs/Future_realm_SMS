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
#
# TEMPORARY — remove once production is green. The first statement clears one
# specific stuck migration so this container can boot at all. Production holds a
# failed `_prisma_migrations` row for 20260920223920_scheme_of_work_fees_payroll
# (a `db push` had already created its objects, so it died on 42710), and while a
# failed row is present `migrate deploy` applies nothing and exits non-zero — so
# this CMD never reached `node` and the API crash-looped. The free plan has no
# Shell tab to fix it by hand from, hence doing it here.
#
# `|| true` is the whole safety story: once the row is cleared, later boots get
# P3012 "not in a failed state" and carry on. It names one migration, so it can
# never touch another. Still, delete these two lines after the first good deploy
# — left in, it would auto-retry that migration forever if it ever legitimately
# failed, which is exactly the signal you want to see instead.
# See docs/production-migration-recovery.md.
CMD ["sh", "-c", "npx prisma migrate resolve --rolled-back 20260920223920_scheme_of_work_fees_payroll || true; npx prisma migrate deploy && node dist/api/backend/src/main.js"]
