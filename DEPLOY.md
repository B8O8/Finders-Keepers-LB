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
- `SUPABASE_SERVICE_ROLE_KEY` — from your Supabase project (Settings → API)
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
cd /opt/finders-keepers && git pull && docker compose up -d --build
```

**Logs:** `docker compose logs -f <service>`  (service = api | web | admin | caddy | postgres)

**Restart one service:** `docker compose restart api`

**Database backup:**
```bash
docker compose exec postgres pg_dump -U fkadmin finders_keepers > backup_$(date +%F).sql
```

**Restore:**
```bash
cat backup.sql | docker compose exec -T postgres psql -U fkadmin finders_keepers
```

**Stop everything:** `docker compose down`  (data survives in the `pgdata` volume)

---

## Notes & scaling path

- **Secrets** live only in `/opt/finders-keepers/.env` on the server — never in git.
- **Product images** go to Supabase Storage (already configured), so the app is stateless apart from Postgres — you can move to multiple app replicas behind a load balancer later without code changes.
- **When you outgrow one box:** move Postgres to managed (Supabase/RDS) by changing `DATABASE_URL`, then run `web`/`admin`/`api` as replicas. Caddy can be swapped for a cloud load balancer.
- **Frontend API URL is baked at build time** (`NEXT_PUBLIC_API_URL`). If you change `API_DOMAIN`, rebuild with `docker compose up -d --build`.
