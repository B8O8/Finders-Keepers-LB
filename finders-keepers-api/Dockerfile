# ---- Builder ----
FROM node:22-bookworm-slim AS builder
WORKDIR /app

# Native build deps (bcrypt, prisma engines)
RUN apt-get update && apt-get install -y --no-install-recommends \
    openssl python3 make g++ ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci

COPY . .
RUN npx prisma generate && npm run build

# ---- Runner ----
FROM node:22-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production

RUN apt-get update && apt-get install -y --no-install-recommends \
    openssl ca-certificates wget \
    && rm -rf /var/lib/apt/lists/*

# Full node_modules kept so `prisma db seed` (tsx) and the prisma CLI work at runtime.
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma.config.ts ./prisma.config.ts
COPY --from=builder /app/package.json ./package.json

EXPOSE 3000

# Apply pending migrations, then start the compiled server.
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main"]
