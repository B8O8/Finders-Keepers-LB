# ---- Builder ----
FROM node:24-bookworm-slim AS builder
WORKDIR /app

# Native build deps (bcrypt, prisma engines).
# Retries + a clean index guard against transient Debian mirror failures
# ("Hash Sum mismatch"), which otherwise fail a deploy for reasons unrelated
# to the application.
RUN rm -rf /var/lib/apt/lists/* \
    && apt-get update -o Acquire::Retries=5 \
    && apt-get install -y --no-install-recommends -o Acquire::Retries=5 \
       openssl python3 make g++ ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci

COPY . .
RUN npx prisma generate && npm run build

# ---- Runner ----
FROM node:24-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production

RUN rm -rf /var/lib/apt/lists/* \
    && apt-get update -o Acquire::Retries=5 \
    && apt-get install -y --no-install-recommends -o Acquire::Retries=5 \
       openssl ca-certificates wget \
    && rm -rf /var/lib/apt/lists/*

# Full node_modules kept so `prisma db seed` (tsx) and the prisma CLI work at runtime.
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma.config.ts ./prisma.config.ts
COPY --from=builder /app/package.json ./package.json

# Mount point for the persistent uploads volume. Created here so the directory
# exists (with correct ownership) even before the volume is attached.
# The API process runs as root in this image, so it can write to the volume;
# files are written 0644 (non-executable) by LocalStorageService.
RUN mkdir -p /app/uploads
VOLUME ["/app/uploads"]

EXPOSE 3000

# Apply pending migrations, then start the compiled server.
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main"]
