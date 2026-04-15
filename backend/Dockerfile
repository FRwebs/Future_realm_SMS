FROM node:22-alpine AS base
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install

FROM base AS builder
WORKDIR /app
COPY . .
RUN npm run prisma:generate && npm run build:api

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist/api ./dist/api
COPY --from=builder /app/prisma ./prisma
EXPOSE 4000
CMD ["node", "dist/api/backend/src/main.js"]
