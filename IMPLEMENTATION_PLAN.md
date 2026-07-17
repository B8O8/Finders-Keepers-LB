# Finders Keepers LB — Implementation Plan

Status: **PLAN ONLY — no code written yet.** Prepared from a read-only inspection of the deployed monorepo.

---

## 1. How the current system works

**API (NestJS + Prisma 7 + Postgres).** Modules are feature-folders under `src/modules`. Auth is split: admin JWT (`jwt-auth.guard`) and customer JWT (`customer-jwt-auth.guard`). Prisma is a global module. Activity logging is a cross-cutting service used by most write paths.

**Pricing today is trivial and duplicated.** The only price is `ProductVariant.price`. Three independent places compute money:
- `cart.service.ts` → `price * quantity`
- `storefront.service.ts` → returns raw variants, price shown client-side
- `orders.service.ts checkout()` → recomputes `subtotal`, sets `discountAmount = 0`, snapshots `unitPrice`/`totalPrice` onto `OrderItem`.

**Stock is strict.** Cart add, cart update, and checkout all reject when `stock < quantity`. Checkout decrements stock in a transaction; cancel increments it back.

**Wishlist is frontend-only.** `finders-keepers-web/src/stores/wishlist-store.ts` is a Zustand+localStorage store keyed by `productId` (no variant, no server, no customer link). There is **no** wishlist table, controller, or service.

**Uploads are external.** `files.service.ts` pushes to Supabase Storage and stores a `FileAsset` row (`bucket/path/url/fileName/mimeType/size`, no title/alt). Images attach to products via `ProductImage` and to categories via `Category.imageId`.

**Categories are single-parent hierarchy; products have one optional category.** `Product.categoryId` → `Category` (`onDelete: SetNull`). Storefront category filtering is a single-relation `where.category = { slug }`.

**Mail** uses `@nestjs-modules/mailer` + `@react-email/components`, with exactly one template (`reset-password-email`). SMTP config comes from `MAIL_*` env.

**Deployment** is Docker Compose (`postgres`, `api`, `admin`, `web`, `caddy`). Caddy terminates HTTPS and reverse-proxies the three domains. `api` runs `prisma migrate deploy` then `node dist/main` as root. No persistent app volume except `pgdata` and Caddy's cert store.

---

## 2. Design decisions — CONFIRMED (2026-07-15)

| Decision | Chosen |
|---|---|
| Discount overlap | **Priority + opt-in stacking** |
| Backorder inventory | **Floor stock at 0, flag order line** |
| Media serving | **`https://api.finderskeeperslb.com/uploads/...`** |
| Primary category | **`Product.primaryCategoryId`** + join table |
| Wishlist reach | Authenticated customers; local wishlist merged on login |
| Rollout | **Single release, all 8 features** |

Original options below for reference (✅ = chosen).

1. **Discount overlap policy.** ✅ *Deterministic priority + opt-in stacking*: gather all applicable, active discounts for a variant; sort by `priority` DESC then `createdAt` ASC; the top discount applies; if it is `stackable`, subsequent `stackable` discounts also apply in order; a `nonStackable` discount never combines. Final price floored at 0, capped by `maxDiscountAmount`. Alternative: "best price always wins" (ignore priority). 
2. **Backorder inventory behavior.** ✅ *Floor stock at 0, never negative*; `OrderItem` stores `isBackorder` + `backorderQuantity`; admin sees backordered lines. Alternative: allow negative stock to represent oversell.
3. **Media serving.** ✅ *Serve `/uploads` from the API container behind existing `api.finderskeeperslb.com`* (no new DNS). Files live on a Docker named volume mounted at `/app/uploads`. Alternative: dedicated `media.finderskeeperslb.com` subdomain served directly by Caddy.
4. **Primary category.** ✅ *Add `Product.primaryCategoryId`* (nullable, must be one of the assigned categories) for breadcrumbs/SEO, plus a many-to-many join for membership.
5. **Wishlist notification reach.** Only authenticated customers with an email can be notified. ✅ *Guest/localStorage wishlists are merged into the DB wishlist on login;* pre-existing local wishlists surface once the user signs in. Guests are out of scope for email.
6. **Scope/phasing.** This is 8 large features. ✅ *Ship in 4 dependency-ordered phases* (below) rather than one big-bang PR.

---

## 3. Recommended phasing (dependency order)

- **Phase A — Foundations:** local uploads + FileAsset metadata (#7, #6); many-to-many categories (#8). These are prerequisites for discounts/targeting and image rendering.
- **Phase B — Pricing core:** Discount module + central `PricingService` + order price snapshots (#2). Storefront/cart/checkout switch to the pricing engine.
- **Phase C — Commerce UX:** backorder (#4); cart preview (#3); product create/edit parity (#5).
- **Phase D — Notifications:** persistent wishlist + sale-notification outbox + scheduler + admin visibility (#1). Depends on B.

---

## 4. Database changes (all additive; no destructive resets)

New models:
- `Discount` — name, description, publicLabel, type(`PERCENTAGE`|`FIXED`), value, startsAt, endsAt, isActive, minOrderAmount?, maxDiscountAmount?, priority, stackable, createdByAdminId, timestamps. Indexes on (isActive, startsAt, endsAt), priority.
- `DiscountTarget` — discountId, targetType(`PRODUCT`|`VARIANT`|`CATEGORY`), productId?, variantId?, categoryId?. Unique per (discountId, targetType, targetId). Enables product/variant/category and *multiple* of each.
- `ProductCategory` — productId, categoryId, unique (productId, categoryId). Join table for many-to-many.
- `WishlistItem` — customerId, productId, variantId?, createdAt, unique (customerId, productId, variantId).
- `Notification` — customerId, channel(`EMAIL`|`IN_APP`), type(`WISHLIST_SALE`), status(`PENDING`|`SENT`|`FAILED`), discountId, productId, variantId?, payload Json, error?, attempts, sentAt?, timestamps. Unique dedupe key (customerId, discountId, productId, variantId) for idempotency.

Modified models:
- `Product` — add `primaryCategoryId` (nullable FK). Keep legacy `categoryId` through the transition (backfill, then deprecate; do **not** drop in the same release).
- `ProductVariant` — add `compareAtPrice Decimal?`, `allowBackorder Boolean @default(false)`, `backorderMessage String?`, `availabilityDate DateTime?`.
- `FileAsset` — add `title String?`, `altText String?`, `caption String?`, `storageType String @default("SUPABASE")` (existing rows stay `SUPABASE`; new local uploads are `LOCAL`).
- `OrderItem` — add immutable snapshot fields: `regularPrice Decimal`, `discountAmount Decimal @default(0)`, `discountId String?`, `discountLabel String?`, `isBackorder Boolean @default(false)`, `backorderQuantity Int @default(0)`, `categorySnapshot Json?`, `imageUrl String?`.
- `Order` — (optional) `discountSnapshot Json?` for order-level promo context.

Indexes/constraints: add unique constraints listed above for idempotency + duplicate prevention; add indexes on `ProductCategory.categoryId`, `WishlistItem.customerId`, `Notification.status`, `DiscountTarget` FKs.

---

## 5. Migration strategy (production-safe)

1. **Backup first** (commands in §11).
2. Each schema change ships as its own additive migration; **no `migrate reset`, no column drops in the same release** as a backfill.
3. **Many-to-many backfill:** create `ProductCategory`, then a data migration `INSERT INTO "ProductCategory"(id, productId, categoryId) SELECT gen_random_uuid(), id, "categoryId" FROM "Product" WHERE "categoryId" IS NOT NULL;` and `UPDATE "Product" SET "primaryCategoryId" = "categoryId";`. Legacy `categoryId` stays readable for one release; a later cleanup migration removes it after code no longer references it.
4. **New nullable columns** default safely; no table rewrite locks of concern at current data size.
5. **Order of deploy:** backup → `git pull` → build images → `prisma migrate deploy` (runs automatically on api start, but can be run explicitly) → health-check → done.
6. **Rollback limitation:** once new rows exist (discounts, notifications, wishlist, multi-category links, backordered orders), migrations that added those tables cannot be reversed without data loss. Rollback = redeploy previous image tag; additive tables simply go unused. This is documented per-migration.

---

## 6. Files to CREATE

API:
- `src/modules/discounts/` — module, controller, service, `pricing.service.ts` (central engine), DTOs (`create-discount.dto.ts`, `update-discount.dto.ts`, `get-discounts.dto.ts`), `discounts.service.spec.ts`, `pricing.service.spec.ts`.
- `src/modules/wishlist/` — module, controller, service, DTOs, spec.
- `src/modules/notifications/` — module, service, `notifications.processor.ts` (cron/outbox), controller (admin visibility + retry), DTOs, spec; new mail template `mail/react-templates/wishlist-sale-email.tsx`.
- `src/modules/uploads/local-storage.service.ts` (or extend `files`) + static serving wiring in `main.ts`/`app.module.ts`.

Admin:
- `app/(admin)/discounts/` — list, create/edit form, targeting preview.
- `app/(admin)/notifications/` (or a tab) — sent/pending/failed + retry.
- Shared `products/VariantEditor.tsx`, `products/CategoryMultiSelect.tsx`, `components/ImagePicker.tsx` (title-aware).

Storefront:
- `components/cart/CartPreview.tsx` (drawer/popover), `features/wishlist` server-backed hooks, `components/product/PriceBlock.tsx` (strike-through + badge + countdown).

Deployment/docs:
- Updates to `docker-compose.yml`, `finders-keepers-api/Dockerfile`, `caddy/Caddyfile`, `.env.production.example`, `DEPLOY.md` (uploads volume + backup).

## 7. Files to MODIFY (high level)

- `prisma/schema.prisma` (+ new migrations), `prisma/seed.ts`.
- API: `cart.service.ts`, `orders.service.ts`, `storefront.service.ts`, `products.service.ts` + product DTOs, `product-variants.*`, `categories.*` (+ DTOs), `files.service.ts`/`files.controller.ts`, `app.module.ts`, `main.ts`.
- Admin: `products/ProductForm.tsx`, `products/[id]/page.tsx`, `categories/page.tsx`, `lib/api.ts`, `types/index.ts`, `Header.tsx`.
- Web: `stores/cart-store.ts`, `stores/wishlist-store.ts`, `services/storefront.service.ts`, `features/cart/cart-page.tsx`, `features/products/product-card.tsx`, `features/products/product-details.tsx`, `features/wishlist/wishlist-page.tsx`, `components/layout/navbar.tsx`.

---

## 8. Central pricing engine (the spine of the whole thing)

A single `PricingService.priceVariant(variant, { product, categories, discounts, now })` returns `{ regularPrice, finalPrice, discountAmount, discountPercent, appliedDiscountId, publicLabel, onSale, expiresAt }`. **Every** surface calls it: storefront listings/detail, cart build, checkout recompute, admin preview, and wishlist notification composition. Money is never trusted from the client; checkout re-derives everything server-side and writes immutable snapshots to `OrderItem`. Discounts are computed from `Discount`/`DiscountTarget` records — product prices are never mutated in place.

---

## 9. Security considerations

Admin-only guards on all discount/notification/upload-admin routes; customer-JWT on wishlist. Upload hardening: MIME + extension allowlist, size + optional dimension checks, UUID collision-safe names, path-traversal prevention, no executable types, never expose server FS paths (serve only via mapped `/uploads/<uuid>.<ext>` URL). Delete only removes the physical file when no `FileAsset`/`ProductImage`/`Category` still references it. Notifications are idempotent via unique dedupe key; failures are logged and retried, never rolled back into the discount transaction. No secrets committed — uploads volume and SMTP/storage config stay in server `.env`.

---

## 10. Testing & acceptance (from your list, mapped to suites)

Unit (Jest, api): percentage calc, fixed calc, expiry excluded, overlap priority, zero-price floor, product/variant/category discount matching, multi-category matching, wishlist idempotency, no-duplicate emails, cart recalculation, order snapshot immutability, backorder on/off, duplicate SKU, exactly-one-default-variant, upload validation, path security, category backfill. Manual matrix: mobile/desktop storefront, admin create/edit product, discount create/edit, cart preview, wishlist notification, Docker upload persistence across rebuild, HTTPS image access.

Acceptance criteria are defined per feature (e.g., "creating a variant-level discount makes the storefront show strike-through + badge and cart/checkout/order totals all match the engine to the cent"; "rebuilding containers preserves uploaded images"; "a product can be saved with 3 categories and appears under all 3 category pages").

---

## 11. Deployment & safety commands (used at ship time)

Local: `npm ci` · `npx prisma validate` · `npx prisma generate` · `npm run lint` · `tsc --noEmit` · `npm test` · `npm run build` (api + both Next apps) · commit · push.

Production (per release): enter repo → **backup DB** (`docker compose exec postgres pg_dump -U $POSTGRES_USER $POSTGRES_DB > backup_$(date +%F).sql`) → **backup uploads** (`docker run --rm -v finders-keepers_uploads:/data -v $PWD:/backup alpine tar czf /backup/uploads_$(date +%F).tgz -C /data .`) → `git pull` → `docker compose up -d --build` (migrations auto-apply) → `docker compose ps` + logs → verify 3 URLs → rollback = `git checkout <prev>` + `docker compose up -d --build` (additive tables become inert). **Never** `migrate reset`, never remove `pgdata`/`uploads` volumes.

---

## 12. Compatibility risks

- Switching cart/checkout to the pricing engine must reproduce current totals exactly when no discount exists (regression risk on money).
- Keeping legacy `Product.categoryId` during transition avoids breaking existing reads; removing it is a later, separate step.
- Storefront currently sorts `price_asc/desc` by variant count (a pre-existing bug) — will be corrected as part of pricing work.
- Backorder must not weaken existing in-stock validation for non-backorder items.
- Existing Supabase image URLs must keep rendering after the switch to local storage (dual storageType support).
