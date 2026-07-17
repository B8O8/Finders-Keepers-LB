# Manual Test Checklist — Post-Deploy

Run this against the live site **after** deploying, in order. Everything here is
something automated tests cannot reach: real browsers, real uploads, real email,
real DNS and TLS.

Automated coverage that you do **not** need to repeat manually:

| Already proven by executed tests | Where |
|---|---|
| Pricing maths, stacking, priority, caps, zero-floor | 84 unit tests |
| Discount → storefront → cart → checkout → order agree on price | 12 e2e tests |
| Stock decrement, backorder split, floor at 0 | e2e + unit |
| All 24 migrations on clean **and** legacy databases | migration tests |
| Notification claim safety across 2 workers | concurrency test |

---

## 0. Before you start

- [ ] `docker compose ps` — all 5 services `Up`, postgres `(healthy)`
- [ ] `docker compose logs --tail=50 api` — no errors after "Nest application successfully started"
- [ ] `docker compose logs --tail=50 caddy` — certificates obtained, no ACME failures
- [ ] `https://finderskeeperslb.com` — padlock, no cert warning
- [ ] `https://admin.finderskeeperslb.com` — padlock
- [ ] `https://api.finderskeeperslb.com/api` — Swagger loads

---

## 1. Uploads moved to this server (feature 7)

- [ ] Admin → Products → open a product → **Upload Image**
- [ ] Image appears immediately in the grid
- [ ] Right-click the image → copy address → URL is `https://api.finderskeeperslb.com/uploads/...`
      (**not** `supabase.co`)
- [ ] Open that URL directly in a new tab — the image loads
- [ ] `docker compose exec api ls -la /app/uploads` — the file is there, mode `-rw-r--r--`, UUID filename
- [ ] **Persistence:** `docker compose up -d --force-recreate api`, wait 20s, reload the
      image URL — still loads (this is the one that matters; a failure here means
      customer images vanish on every deploy)
- [ ] An **old** Supabase image elsewhere in the catalogue still displays

## 2. Image titles & metadata (feature 6)

- [ ] Every image tile shows a title, size and upload date
- [ ] Hover an image → **Details** → dialog shows file name, size, type, uploaded date, storage
- [ ] Storage reads "This server" for a new upload, "Supabase (legacy)" for an old one
- [ ] Edit **Title** and **Alt text** → Save → tile relabels immediately
- [ ] Reload the page — the change persisted
- [ ] Clear the title → it falls back to the file name (never blank)
- [ ] A legacy Supabase image with no title still shows a name, not an empty label
- [ ] Tiles without alt text show the amber "No alt text" hint
- [ ] Category → edit → **Category Image** → upload → save → thumbnail shows in the list

## 3. Multiple categories per product (feature 8)

- [ ] Admin → Product → assign **three** categories, set one as primary
- [ ] Save → reopen → all three still selected, primary preserved
- [ ] Storefront product page → breadcrumb shows the **primary** category
- [ ] "Also in" chips show the other two, each links to its category page
- [ ] Product appears on **all three** category pages
- [ ] **Remove one category** → product still appears on the other two ← critical
- [ ] Product URL stays `/products/<slug>` (never `/category/<c>/products/<slug>`)
- [ ] Sub-category page: `/category/<child-slug>` shows the real category name,
      not a de-slugged guess ("Men's Watches", not "Mens Watches")
- [ ] `/products` filter sidebar lists sub-categories, not only top-level
- [ ] Clicking a sub-category filter actually filters
- [ ] `https://finderskeeperslb.com/sitemap.xml` — lists every category (incl. children)
      and each product **once**
- [ ] `https://finderskeeperslb.com/robots.txt` — `Sitemap:` line points at the real
      domain (**not** `localhost`; if it says localhost the image was built with the
      wrong env — rebuild on the server)
- [ ] View source on a product page → `<title>`, `<meta name="description">`,
      `<link rel="canonical">` all present and correct

## 4. Discounts (feature 2)

- [ ] Admin → Discounts → create 20% off a product, active now
- [ ] Storefront: product shows struck-through $100 and $80
- [ ] Cart shows $80 × qty
- [ ] **Checkout: the order confirmation charges $80** ← the one that costs money
- [ ] Admin → Orders → the order line shows regular $100, unit $80, discount label
- [ ] Deactivate the discount → storefront returns to $100 immediately
- [ ] Create a second **stackable** discount at lower priority → both apply
- [ ] Create a second **non-stackable** at lower priority → only the winner applies
- [ ] Set an end date in the past → discount disappears from the storefront
- [ ] Delete a discount that has orders → the **orders keep their prices** (audit trail)

## 5. Cart preview in header (feature 3)

- [ ] Add item → header cart count increments without a page reload
- [ ] Hover/click cart icon → preview lists items with images and prices
- [ ] Prices in the preview match the product page
- [ ] Change quantity in the preview → total updates
- [ ] **Images in the preview load** (this is `next/image`; a locally-uploaded
      image failing here means the `remotePatterns` fix didn't take)
- [ ] Preview survives a page refresh

## 6. Out of stock & backorder (feature 4)

- [ ] Set a variant to stock 0, backorder **off** → storefront shows it, marked out of
      stock, add-to-cart disabled
- [ ] Set stock 0, backorder **on**, with a message → add-to-cart enabled, message shows
- [ ] Order it → order succeeds
- [ ] Admin → Orders → line flagged as backorder with the shortfall quantity
- [ ] Variant stock reads **0**, never negative
- [ ] Set stock 1, backorder on, order 4 → `backorderQuantity` = 3

## 7. Product create form parity (feature 5)

- [ ] Admin → New Product → the variant section exposes the same fields as variant edit:
      name, sku, plu, barcode, price, compare-at, cost, weight, stock, backorder,
      backorder message, availability date, default, active
- [ ] Create a product with 2 variants in one pass → both saved correctly
- [ ] No "create then immediately edit" needed to finish configuring it

## 8. Wishlist sale notifications (feature 1)

- [ ] Log in as a customer, add a product to the wishlist
- [ ] Log out, log back in → wishlist merged, item still there
- [ ] Admin → create a discount on that product
- [ ] Admin → Notifications → a PENDING row appears for that customer
- [ ] Wait for the cron (or POST `/notifications/process`) → status flips to SENT
- [ ] **Customer receives the email**, with correct product name and discount %
- [ ] Re-run enqueue for the same discount → **no duplicate** email (dedupe)
- [ ] Admin → Notifications → stats show sent/failed counts
- [ ] Force a failure (bad SMTP) → row goes FAILED with an error, retry works

---

## 9. Regression — things that must NOT have broken

- [ ] Existing products still display with their old Supabase images
- [ ] Existing orders still open in admin with their original prices
- [ ] Customer login / signup / password reset
- [ ] POS import
- [ ] Product reviews
- [ ] Admin roles & permissions
- [ ] Activity logs still recording

---

## If something fails

Capture before changing anything:

```bash
docker compose logs --tail=200 api > /tmp/api.log
docker compose logs --tail=100 caddy > /tmp/caddy.log
docker compose ps
```

Rollback is in `DEPLOY.md`. The migrations are additive and the legacy
`categoryId` column is retained for one release, so a rollback to the previous
image works without a database restore.
