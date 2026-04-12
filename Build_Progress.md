# Build Progress

Tracks progress through [Build_Plan.md](Build_Plan.md). Tick tasks as they're completed. Add notes under a task for decisions, deviations, or follow-ups worth remembering.

**Legend:** `[ ]` not started · `[~]` in progress · `[x]` done · `[!]` blocked (needs user action)

---

## Phase 1: Foundation & Property Page

- [x] **Task 1.1** — Project scaffolding (Next.js, TS strict, Tailwind, shadcn/ui, structure, lint)
- [x] **Task 1.2** — Supabase setup & Prisma configuration _(local Supabase via CLI; hosted instance deferred to deploy time)_
- [x] **Task 1.3** — Supabase Storage setup
- [x] **Task 1.4** — Property listing page — photo gallery
- [x] **Task 1.5** — Property listing page — description & amenities
- [ ] **Task 1.6** — Property listing page — location map _(needs user: MapTiler API key)_
- [ ] **Task 1.7** — SEO & metadata
- [ ] **Task 1.8** — Vercel deployment _(needs user: Vercel account, domain, env vars)_

## Phase 2: Calendar & Booking Engine (MVP)

- [ ] **Task 2.1** — Database schema — booking entities
- [ ] **Task 2.2** — Availability checking
- [ ] **Task 2.3** — Pricing engine
- [ ] **Task 2.4** — Availability calendar component
- [ ] **Task 2.5** — Supabase Auth — guest authentication
- [ ] **Task 2.6** — Stripe integration — checkout session _(needs user: Stripe account + keys)_
- [ ] **Task 2.7** — Stripe webhook handling _(needs user: webhook secret)_
- [ ] **Task 2.8** — Email — booking confirmation _(needs user: Resend API key + verified domain)_
- [ ] **Task 2.9** — Booking flow UI
- [ ] **Task 2.10** — Booking expiry cron job

**🎯 MVP launch point after Phase 2**

## Phase 3: Guest & Host Dashboards

- [ ] **Task 3.1** — Guest dashboard
- [ ] **Task 3.2** — Booking detail page (guest)
- [ ] **Task 3.3** — Host admin panel — layout & auth
- [ ] **Task 3.4** — Host admin — booking management
- [ ] **Task 3.5** — Host admin — calendar view
- [ ] **Task 3.6** — Host admin — dashboard overview

## Phase 4: Communication

- [ ] **Task 4.1** — Database schema — messaging entities
- [ ] **Task 4.2** — Messaging API
- [ ] **Task 4.3** — Messaging UI — guest side
- [ ] **Task 4.4** — Messaging UI — admin side
- [ ] **Task 4.5** — Supabase Realtime — live messaging

## Phase 5: Automated Email Sequences

- [ ] **Task 5.1** — Email templates
- [ ] **Task 5.2** — Email scheduler
- [ ] **Task 5.3** — Daily host summary

## Phase 6: Reviews & Social Proof

- [ ] **Task 6.1** — Database schema — reviews
- [ ] **Task 6.2** — Review submission
- [ ] **Task 6.3** — Review display on property page
- [ ] **Task 6.4** — Host review management

## Phase 7: Advanced Pricing & Financial Admin

- [ ] **Task 7.1** — Pricing rules management UI
- [ ] **Task 7.2** — Pricing engine — full implementation
- [ ] **Task 7.3** — Financial reports

## Phase 8: Polish & Extended Features

- [ ] **Task 8.1** — Cancellation flow
- [ ] **Task 8.2** — Request-to-book mode
- [ ] **Task 8.3** — Property content management
- [ ] **Task 8.4** — Site settings management
- [ ] **Task 8.5** — SEO refinements

## Phase 9: Growth Features

- [ ] **Task 9.1** — Booking analytics
- [ ] **Task 9.2** — Website analytics integration
- [ ] **Task 9.3** — Email marketing — guest list & newsletters
- [ ] **Task 9.4** — Multi-language support (optional)

---

## Notes & decisions

_Record non-obvious choices, deviations from the plan, and things a future session would need to know. Keep it tight._

- **Task 1.1**: Scaffolded with `create-next-app` (Next 16, React 19, Tailwind v4, Turbopack, App Router, no `src/` dir, `@/*` import alias). shadcn/ui initialised with the `neutral` base via `--defaults`. Home page lives at `app/(guest)/page.tsx`; root layout in `app/layout.tsx` wraps all routes with `Header`/`Footer` from `components/layout/`. Prettier configured with `prettier-plugin-tailwindcss`. `.env.example` committed; `.env.local` gitignored.
- **Task 1.5**: Three new components — [PropertyDetails](components/property/property-details.tsx) (icon strip for guests/bedrooms/beds/bathrooms, server component), [PropertyDescription](components/property/property-description.tsx) (client; "Read more" toggle only appears when description > 320 chars), [PropertyAmenities](components/property/property-amenities.tsx) (client; preview of first 6, "Show all" dialog grouped by category). Lucide icon mapping for amenity rows lives in [lib/property/amenity-icons.ts](lib/property/amenity-icons.ts) — string→component lookup with a `Check` fallback. **React 19 / Next 16 lint gotchas hit twice and worth remembering**: (a) `react-hooks/static-components` rejects the `const Icon = item.icon; <Icon />` pattern — use `React.createElement(item.icon, props)` instead; (b) `react-hooks/preserve-manual-memoization` rejects `useMemo` because the React Compiler auto-memoises — drop manual `useMemo`/`useCallback`. Home page now has a 2-column layout on `lg+` (main content left, sticky booking placeholder right) that stacks on mobile.
- **Task 1.4**: Photo gallery component at [components/property/photo-gallery.tsx](components/property/photo-gallery.tsx) — Airbnb-style 1+4 hero grid on desktop, single hero on mobile, with a "Show all photos" button. Full-screen modal toggles between two views: a categorised grid (grouped by `PhotoCategory` enum, lazy-loaded) and a lightbox. **Lightbox is custom, not shadcn Carousel** — the shadcn `CarouselNext`/`Previous` buttons disable themselves via `canScrollNext/Prev`, and that interacted badly with `loop:true` causing the right chevron to be stuck disabled. Custom lightbox uses plain React state with modulo wrap-around for true looping, manual ←/→ keyboard handler on `window`, manual touch swipe (50px threshold), and click-outside-to-close (dark backdrop has `onClick={onClose}`; image and chevrons `stopPropagation`). Escape closes via base-ui Dialog itself. shadcn dialog component added; carousel was added but is now only used for any future non-lightbox carousels (still in `components/ui/`). **Browser-verified** before committing.
- **Task 1.3**: Created `property-photos` and `site-assets` buckets (public read) via [scripts/setup-storage.ts](scripts/setup-storage.ts) using `@supabase/supabase-js` 2.103.0 with the service role key. Script is idempotent and reads from `dev_photos/` (gitignored). Photos uploaded with predefined metadata (category, alt text, sort order) and `PropertyPhoto` rows upserted via Prisma. URL helpers in [lib/storage/photos.ts](lib/storage/photos.ts) — `propertyPhotoUrl` returns the public URL, `propertyPhotoTransformUrl`/`propertyThumbnailUrl` use Supabase's render API. **Caveat:** the transform/render API is a Supabase Pro plan feature in hosted Supabase. Enabled locally via `[storage.image_transformation] enabled = true` in `supabase/config.toml` so the helpers can be exercised in dev. On the free tier in production, fall back to next/image for optimisation. `next.config.ts` has `remotePatterns` for both local (`127.0.0.1:54421`) and hosted (`*.supabase.co`) Supabase Storage. `PropertyPhoto.url` stores the path-only value (e.g. `drone_shot.jpeg`), not the full URL — keeps the DB portable across environments. The home page now renders the highest-priority photo via next/image as the verification test.
- **Task 1.2**: Local dev uses Supabase CLI (`supabase start`) instead of a hosted instance — hosted Supabase will be wired up at deploy time. Local stack runs on bumped ports `544xx` (api 54421, db 54422, studio 54423, mailpit 54424, analytics 54427) to avoid conflict with another local Supabase project (`savi-local`) on this machine — set in `supabase/config.toml`. Prisma 7.7.0 uses the new `prisma-client` generator (output → `lib/generated/prisma`, gitignored) plus the `@prisma/adapter-pg` driver adapter — both required in v7. Connection URL is no longer in `schema.prisma`; it lives in `prisma.config.ts`, which loads `.env.local` via `dotenv` for migrations (Next.js handles runtime env loading). Singleton client at [lib/db/prisma.ts](lib/db/prisma.ts). Phase 1 schema covers `Property`, `PropertyPhoto`, `Amenity`, `PropertyAmenity`, `SiteConfiguration` only — booking/payment/messaging/review entities will be added in their respective phases. Seed populates one placeholder property (`The Staithes Cottage`) plus 15 reference amenities with 10 linked. Verified end-to-end at [`/api/property`](app/api/property/route.ts).

