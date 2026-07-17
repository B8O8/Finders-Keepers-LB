# Finders Keepers — Production Deployment

Single-box Docker deployment. The whole stack (Postgres + API + admin + storefront + Caddy reverse proxy with automatic HTTPS) runs with one `docker compose up`.

```
                          Internet
                             │
                     ┌───────▼────────┐
                     │  Caddy (443)   │  auto Let's Encrypt + renewal
                     └──┬─────┬─────┬─┘
        finderskeeperslb│     │admin│api.finderskeeperslb
                        ▼     ▼     ▼
                     ┌────┐ ┌─────┐ ┌────┐
                     │web │ │admin│ │api │  (Next.js / NestJS)
                     └────┘ └─────┘ └─┬──┘
                                      ▼
                                 ┌─────────┐
                                 │ postgres│  (volume: pgdata)
                                 └─────────┘
```

Server: `192.248.186.253` (Ubuntu 26.04). Repo: `https://github.com/B8O8/Finders-Keepers-LB.git`

---

## STEP 1 — Push the code to GitHub (run on your Windows PC in PowerShell)

You currently have three nested git repos inside the project, which is why `git add .` failed. Flatten them into one repo:

```powershell
cd "C:\Projects\Finders Keepers LB"

# Remove the nested repos (your files stay; only their .git history is dropped)
Remove-Item -Recurse -Force finders-keepers-admin\.git
Remove-Item -Recurse -Force finders-keepers-api\.git
Remove-Item -Recurse -Force finders-keepers-web\.git

# Clean up temp check files (ignore errors if absent)
Remove-Item -Force .dockerignore-test, .sandbox-write-test -ErrorAction SilentlyContinue

# Commit everything to the single root repo
git add .
git status                      # <-- confirm NO .env files are listed (only .env.production.example)
git commit -m "Production deploy setup: Docker + Caddy"
git branch -M main

# Point at your GitHub repo (use set-url if origin already exists)
git remote add origin https://github.com/B8O8/Finders-Keepers-LB.git 2>$null; `
  git remote set-url origin https://github.com/B8O8/Finders-Keepers-LB.git

git push -u origin main
```

**Before pushing, double-check no secrets are staged:**

```powershell
git ls-files | Select-String "\.env"
```

This must return **only** `.env.production.example`. If it lists `finders-keepers-api/.env` or any `.env.local`, stop and tell me — the `.gitignore` should prevent it.

---

## STEP 2 — Point DNS at the server

In your domain's DNS, create three **A records** pointing at `192.248.186.253`:

| Type | Name / Host | Value           |
|------|-------------|-----------------|
| A    | `@`         | 192.248.186.253 |
| A    | `www`       | 192.248.186.253 |
| A    | `admin`     | 192.248.186.253 |
| A    | `api`       | 192.248.186.253 |

DNS must resolve **before** Step 6, or Caddy can't issue HTTPS certificates. Check with `nslookup api.finderskeeperslb.com`.

---

## STEP 3 — Install Docker on the server

SSH in (`ssh root@192.248.186.253`), then:

```bash
apt update && apt install -y git ufw

# Docker (official convenience script — handles the Ubuntu version automatically)
curl -fsSL https://get.docker.com | sh

# Verify
docker --version && docker compose version
```

If the script errors on Ubuntu 26.04 not being recognized yet, run it forcing the previous LTS codename:
`curl -fsSL https://get.docker.com | VERSION_CODENAME=noble sh`

---

## STEP 4 — Firewall

```bash
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable
```

Postgres is **not** exposed to the internet — it's only reachable inside the Docker network.

---

## STEP 5 — Clone and configure

```bash
git clone https://github.com/B8O8/Finders-Keepers-LB.git /opt/finders-keepers
cd /opt/finders-keepers

cp .env.production.example .env
```

Generate strong secrets:

```bash
for k in JWT_SECRET JWT_REFRESH_SECRET CUSTOMER_JWT_SECRET CUSTOMER_JWT_REFRESH_SECRET; do
  echo "$k=$(openssl rand -hex 32)"
done
```

Then edit `.env` (`nano .env`) and set **real** values for:

- `WEB_DOMAIN`, `ADMIN_DOMAIN`, `API_DOMAIN` — your actual domains
- `ACME_EMAIL` — your email (Let's Encrypt notices)
- `POSTGRES_PASSWORD` — a strong password
- the four `JWT_*` secrets — paste the generated values above
- `MINIO_ROOT_USER`, `MINIO_ROOT_PASSWORD` — object storage credentials
  (`openssl rand -hex 24`). Compose refuses to start if these are unset, rather
  than let MinIO fall back to its default `minioadmin` login.
- `MAIL_USER`, `MAIL_PASSWORD` — your Hostinger SMTP credentials

---

## STEP 6 — Build and launch

```bash
docker compose up -d --build
```

First build takes a few minutes. Watch it come up:

```bash
docker compose ps
docker compose logs -f api      # Ctrl-C to stop following
```

The API automatically runs `prisma migrate deploy` on startup, creating all tables. Caddy automatically obtains HTTPS certificates for the three domains (give it ~30 seconds after DNS resolves).

---

## STEP 7 — Seed the first admin + store settings

```bash
docker compose exec api npx prisma db seed
```

This creates:

- **Super-admin login** — `admin@finderskeeperslb.com` / `Admin@123456`
- Default store settings

**Log into the admin panel and change this password immediately** (or run `docker compose exec api node scripts/reset-admin-password.js`).

---

## STEP 8 — Verify

| URL                                   | Expect                       |
|---------------------------------------|------------------------------|
| `https://finderskeeperslb.com`        | Storefront                   |
| `https://admin.finderskeeperslb.com`  | Admin login                  |
| `https://api.finderskeeperslb.com/api`| Swagger API docs             |

All three should be valid HTTPS (padlock), no cert warnings.

---

## Day-2 operations

**Deploy new code:**
```bash
cd ~/Finders-Keepers-LB
docker compose exec postgres pg_dump -U fkadmin finders_keepers > ~/backup_$(date +%F_%H%M).sql
git pull
docker compose build --no-cache
docker compose up -d
docker compose exec api npx prisma migrate status   # expect "Database schema is up to date!"
```

> **Why `--no-cache`.** Docker has been observed reporting `COPY . . CACHED` on a
> genuinely changed context (a Docker Desktop / Windows file-sharing quirk), then
> printing a green `✔ Built` for an image containing **none** of the new code. A
> passing build log is not evidence that your code was compiled. On a release
> that matters, do not trust the cache.

> **Caddy config changes need more than `up -d`.** `docker compose up -d` only
> recreates a container when its *config* changes (image, env, ports, volume
> definitions). Editing `caddy/Caddyfile` changes none of those, so Caddy keeps
> running the config it started with. After any Caddyfile edit:
> ```bash
> docker compose exec caddy caddy reload --config /etc/caddy/Caddyfile
> ```
> Then **verify what it actually compiled** — `reload` reports success for a
> config that loaded fine but isn't the one you wrote:
> ```bash
> docker compose exec caddy caddy adapt --config /etc/caddy/Caddyfile 2>/dev/null \
>   | grep -o "minio:9000\|api:3000"      # minio MUST come first
> ```
> (The compose file mounts `./caddy` as a directory rather than the Caddyfile
> itself. Bind-mounting a single file pins its inode, and `git pull` replaces the
> file rather than editing it — so the container would never see an update. Do
> not "simplify" that back to a single-file mount.)

**Logs:** `docker compose logs -f <service>`  (service = api | web | admin | caddy | minio | postgres)

**Restart one service:** `docker compose restart api`

**Database backup:**
```bash
docker compose exec postgres pg_dump -U fkadmin finders_keepers > backup_$(date +%F).sql
```

**Restore:**
```bash
cat backup.sql | docker compose exec -T postgres psql -U fkadmin finders_keepers
```

---

## Uploaded media (MinIO)

Uploaded images live in the **MinIO** `uploads` bucket on this server
(`finders-keepers_minio_data` volume) and are served read-only at
`https://api.finderskeeperslb.com/uploads/...`.

**Why the bucket is called `uploads` — do not rename it.** MinIO serves objects
at `/<bucket>/<key>`, so bucket `uploads` + key `product/<uuid>.jpg` resolves at
`/uploads/product/<uuid>.jpg` — exactly the path stored in every image URL in the
database. Caddy proxies `/uploads/*` straight to `minio:9000` with no rewrite.
Rename the bucket and every image on the site 404s.

**Security posture.**
- The bucket policy grants anonymous `s3:GetObject` **and nothing else**. It must
  never grant `s3:ListBucket` — that would let anyone enumerate the whole media
  library from a browser. Verified: `GET /uploads/` returns **403**.
- Caddy additionally rejects any non-GET/HEAD on `/uploads/*` with **405**, so the
  S3 write API is never exposed to the internet even if a policy were wrong.
- MinIO publishes **no ports**. The API reaches it on the internal Docker network;
  the public only reaches it through Caddy.
- Uploads are validated on MIME **and** extension (see `upload-rules.ts`), capped
  at 5MB, and stored under server-generated UUID keys — a client filename never
  reaches storage.
- `MINIO_ROOT_PASSWORD` grants full read/write over all media. Treat it like the
  database password. Compose **refuses to start** if it is unset, so MinIO can
  never silently fall back to its default `minioadmin` credentials.

**Inspect:**
```bash
docker compose logs api | grep -i minio      # expect: MinIO ready: bucket "uploads", public read only
docker volume inspect finders-keepers_minio_data
```

**Back up uploaded media** (run alongside the database backup):
```bash
cd ~/Finders-Keepers-LB
docker run --rm \
  -v finders-keepers_minio_data:/data:ro \
  -v "$PWD":/backup \
  alpine tar czf /backup/minio_$(date +%F).tgz -C /data .
```

**Restore uploaded media:**
```bash
docker compose stop minio
docker run --rm \
  -v finders-keepers_minio_data:/data \
  -v "$PWD":/backup \
  alpine sh -c "rm -rf /data/* && tar xzf /backup/minio_YYYY-MM-DD.tgz -C /data"
docker compose up -d minio
```

> **Never** run `docker compose down -v` on this server: it destroys `pgdata`,
> `minio_data` and `uploads`. Use `docker compose down` (without `-v`).

**Supabase is gone.** The SDK, the `SUPABASE_*` env vars and the delete path have
all been removed. No `storageType = SUPABASE` rows exist.

**The legacy `uploads` volume** holds any `storageType = LOCAL` asset from the
brief disk-storage release. It is mounted read-only-in-practice at `/app/uploads`
and kept as a rollback path. Nothing new is ever written there. Once
`SELECT COUNT(*) FROM "FileAsset" WHERE "storageType" = 'LOCAL'` returns 0 for
good, the volume, `LocalStorageService` and `UPLOADS_DIR` can all be deleted.

**Stop everything:** `docker compose down`  (data survives in the `pgdata` volume)

---

## Notes & scaling path

- **Secrets** live only in `~/Finders-Keepers-LB/.env` on the server — never in git.
- **Product images** go to MinIO, which speaks the S3 API. The app is stateless apart from Postgres and MinIO, so it can move to multiple replicas behind a load balancer without code changes — and migrating to real S3/R2 later means changing the endpoint and credentials, not the code.
- **When you outgrow one box:** move Postgres to managed (Supabase/RDS) by changing `DATABASE_URL`, then run `web`/`admin`/`api` as replicas. Caddy can be swapped for a cloud load balancer.
- **Frontend API URL is baked at build time** (`NEXT_PUBLIC_API_URL`). If you change `API_DOMAIN`, rebuild with `docker compose up -d --build`.
