# Build Progress

Tracks progress through [Build_Plan.md](Build_Plan.md). Tick tasks as they're completed. Add notes under a task for decisions, deviations, or follow-ups worth remembering.

**Legend:** `[ ]` not started · `[~]` in progress · `[x]` done · `[!]` blocked (needs user action)

---

## Phase 1: Foundation & Property Page

- [ ] **Task 1.1** — Project scaffolding (Next.js, TS strict, Tailwind, shadcn/ui, structure, lint)
- [ ] **Task 1.2** — Supabase setup & Prisma configuration _(needs user: create Supabase project, provide keys)_
- [ ] **Task 1.3** — Supabase Storage setup _(needs user: upload sample photos or confirm placeholders)_
- [ ] **Task 1.4** — Property listing page — photo gallery
- [ ] **Task 1.5** — Property listing page — description & amenities
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
