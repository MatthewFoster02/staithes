# Build Plan: Single-Property Short-Stay Rental Platform

## Context for the coding agent

You are building a single-property short-stay holiday rental website. The site replaces AirBnB for one property, allowing guests to browse, book, pay, and communicate directly with the hosts.

### Reference documents

These companion documents contain the full specifications. Refer to them when building:

- **Technical Specification** — Feature requirements, user experience, and functional scope
- **Data Model & Architecture** — Entity definitions, field types, relationships, system flows
- **Technology Stack** — Chosen technologies and rationale
- **System Architecture** — Component layout, API design, data flows, security, caching

### Tech stack summary

| Layer | Technology |
|---|---|
| Framework | Next.js (App Router) |
| Language | TypeScript (strict mode) |
| Database | PostgreSQL via Supabase |
| ORM | Prisma |
| Auth | Supabase Auth |
| Payments | Stripe (Checkout, webhooks) |
| Email | Resend + React Email |
| File storage | Supabase Storage |
| Scheduling | Vercel Cron |
| Hosting | Vercel |
| Styling | Tailwind CSS + shadcn/ui |
| Maps | MapTiler |

### Project structure

```
app/
  (guest)/              # Guest-facing pages (SSR/ISR)
    page.tsx            # Property listing (home page)
    book/               # Booking flow
    dashboard/          # Guest dashboard (auth required)
    messages/           # Guest messaging (auth required)
    login/              # Guest auth pages
  (admin)/              # Host admin panel (auth required, host role)
    dashboard/          # Admin overview
    bookings/           # Booking management
    calendar/           # Calendar & blocked dates
    pricing/            # Pricing rules
    property/           # Content editor
    messages/           # Message inbox
    reviews/            # Review management
    finance/            # Financial reports
    settings/           # Site configuration
  api/
    property/           # Property CRUD
    availability/       # Availability checks
    pricing/            # Price calculations
    bookings/           # Booking CRUD & actions
    webhooks/           # Stripe webhooks
    messages/           # Messaging
    reviews/            # Reviews
    admin/              # Admin-only endpoints
    cron/               # Scheduled job endpoints
components/             # Shared UI components
lib/
  db/                   # Prisma client & utilities
  auth/                 # Supabase Auth helpers
  stripe/               # Stripe client & utilities
  email/                # Resend client & templates
  pricing/              # Pricing engine
  availability/         # Availability checker
  booking/              # Booking service
prisma/
  schema.prisma         # Database schema
  migrations/           # Migration files
public/                 # Static assets
```

---

## Build phases

The project is divided into 9 phases. Each phase delivers usable functionality. **Phase 2 is the MVP launch point** — after Phase 2, the site can accept real bookings.

Each task has:
- A clear description of what to build
- Acceptance criteria (what "done" looks like)
- Dependencies on prior tasks

Estimated effort is per-task, assuming one developer working with a coding agent.

---

## Phase 1: Foundation & Property Page

**Goal:** A live, deployed site showing the property with professional presentation. No booking functionality yet, but the deployment pipeline, database, auth, and storage are all working.

**Estimated total effort: 5–7 days**

---

### Task 1.1: Project scaffolding

**What to build:**
- Initialise a Next.js project with the App Router, TypeScript strict mode, and Tailwind CSS
- Install and configure shadcn/ui (initialise with the default theme, add components as needed later)
- Set up the project directory structure as defined above
- Configure ESLint and Prettier
- Create a basic layout component with a header and footer
- Set up environment variable structure (.env.local, .env.example)

**Acceptance criteria:**
- `npm run dev` starts the dev server with no errors
- The home page renders with the layout (header, footer, placeholder content)
- TypeScript strict mode is enabled and compiling cleanly
- Tailwind classes work in components
- shadcn/ui is initialised and a test component (e.g., Button) renders correctly

**Dependencies:** None

---

### Task 1.2: Supabase setup & Prisma configuration

**What to build:**
- Create a Supabase project (or connect to an existing one)
- Install Prisma and configure it to connect to the Supabase PostgreSQL instance
- Define the initial Prisma schema with these entities:
  - `Property` (all fields from the data model document)
  - `PropertyPhoto` (all fields)
  - `Amenity` (all fields)
  - `PropertyAmenity` (join table)
  - `SiteConfiguration` (all fields)
- Run the initial migration
- Create a seed script that populates:
  - One Property record with the parents' property details (placeholder text is fine)
  - A set of standard amenities (wifi, parking, kitchen, washing machine, etc.)
  - A SiteConfiguration record with placeholder branding
- Configure the Prisma client as a singleton (important for serverless — avoid creating multiple instances)

**Acceptance criteria:**
- `npx prisma migrate dev` runs successfully
- `npx prisma db seed` populates the database with test data
- Prisma Studio (`npx prisma studio`) shows the seeded data
- The Prisma client connects from a Next.js API route and returns the property record

**Dependencies:** Task 1.1

---

### Task 1.3: Supabase Storage setup

**What to build:**
- Create Supabase Storage buckets:
  - `property-photos` (public read access)
  - `site-assets` (public read access)
- Upload 5–10 sample property photos (placeholder images are fine for development)
- Create PropertyPhoto records in the database pointing to the uploaded images
- Build a utility function for generating Supabase Storage public URLs with image transformations (thumbnail generation via Supabase's transform API)

**Acceptance criteria:**
- Photos are accessible via public URLs from Supabase Storage
- Thumbnail URLs (resized versions) are generated correctly via the transform API
- PropertyPhoto records in the database match the uploaded files
- A test page can display a photo from storage

**Dependencies:** Task 1.2

---

### Task 1.4: Property listing page — photo gallery

**What to build:**
- Build the photo gallery component for the property page
  - Grid layout showing featured photos (first 5) with a "Show all photos" button
  - Full-screen lightbox/modal for browsing all photos with swipe/arrow navigation
  - Photos grouped by category (bedroom, kitchen, etc.) in the full gallery view
  - Responsive: works on mobile (swipe) and desktop (click arrows)
  - Lazy loading for images below the fold
  - Use next/image for automatic optimisation (WebP, srcset)
- Fetch photos from the database via a server component

**Acceptance criteria:**
- Property page shows the photo grid with the first 5 images
- Clicking "Show all photos" opens the full gallery modal
- Gallery supports keyboard navigation (arrow keys, Escape to close)
- Photos load lazily and display as optimised WebP
- Thumbnails load fast; full-size images load on demand in the lightbox
- Mobile: swipe works in the lightbox
- Accessible: alt text on all images, focus management in the modal

**Dependencies:** Task 1.3

---

### Task 1.5: Property listing page — description & amenities

**What to build:**
- Property description section with the full text, expandable if long ("Read more")
- Property details summary: bedrooms, beds, bathrooms, max guests (icon + count format)
- Amenities section:
  - Grouped by category (essentials, features, safety, accessibility, outdoor)
  - Icon + name for each amenity
  - Show top 10 with "Show all amenities" expanding to the full list
- House rules section with check-in/check-out times, and all rules clearly listed
- "What guests have access to" section

**Acceptance criteria:**
- All property data is fetched server-side and rendered in the HTML (view source shows the content for SEO)
- Amenities display with icons grouped by category
- House rules are clearly formatted
- Long description truncates with a "Read more" toggle
- Responsive layout works on mobile and desktop

**Dependencies:** Task 1.2

---

### Task 1.6: Property listing page — location map

**What to build:**
- MapTiler integration:
  - Install the MapTiler SDK / maplibre-gl-js
  - Create a Map component that displays a vector tile map
  - Show an approximate location marker (offset from the exact coordinates by a small random amount)
  - Show a shaded circle around the approximate area (not a precise pin)
  - Add basic points of interest if MapTiler's POI layers cover the area
- Below the map, display a text section about the neighbourhood and getting there

**Acceptance criteria:**
- Map renders on the property page showing the approximate area
- The exact address is NOT visible (the marker is offset and there's no address label)
- Map is interactive (zoom, pan) but does not overwhelm the page
- MapTiler API key is restricted to the site domain
- Map component is lazy-loaded (not blocking initial page render)

**Dependencies:** Task 1.1

---

### Task 1.7: SEO & metadata

**What to build:**
- Configure Next.js metadata for the property page:
  - Page title, description, Open Graph tags (title, description, image), Twitter card
  - Schema.org structured data: `LodgingBusiness` type with property details, address (approximate), photos, price range
- robots.txt and sitemap.xml (static for now — one page)
- Favicon and apple-touch-icon from the site configuration

**Acceptance criteria:**
- View source on the property page shows correct meta tags and Open Graph data
- Schema.org JSON-LD is present and validates via Google's Rich Results Test
- robots.txt and sitemap.xml are accessible
- Sharing the URL on social media (or a preview tool) shows the correct image, title, and description

**Dependencies:** Task 1.5

---

### Task 1.8: Vercel deployment

**What to build:**
- Connect the Git repository to Vercel
- Configure the production domain (parents' custom domain)
- Set up environment variables in Vercel (Supabase URL, Supabase anon key, MapTiler API key)
- Configure the Supabase connection to use the connection pooler URL in production
- Verify the deployment works end-to-end

**Acceptance criteria:**
- The site is live at the custom domain with SSL
- The property page loads with photos, description, amenities, map
- Preview deployments work on feature branches
- Environment variables are correctly separated between preview and production
- Page load performance is good (Lighthouse score > 90 for performance)

**Dependencies:** Tasks 1.4, 1.5, 1.6, 1.7

---

## Phase 2: Calendar & Booking Engine (MVP)

**Goal:** Guests can select dates, see pricing, pay via Stripe, and receive a booking confirmation email. Hosts are notified of new bookings. This is the minimum viable product.

**Estimated total effort: 8–12 days**

---

### Task 2.1: Database schema — booking entities

**What to build:**
- Add to the Prisma schema:
  - `Guest` (all fields from data model)
  - `Booking` (all fields)
  - `BookingPriceSnapshot` (all fields)
  - `Payment` (all fields)
  - `BlockedDate` (all fields)
  - `PricingRule` (all fields — but only base rate + cleaning fee will be used in this phase)
  - `AutomatedEmailLog` (all fields)
- Run the migration
- Update the seed script to add:
  - A few sample blocked dates
  - A basic pricing rule (or just use the property's base_nightly_rate)

**Acceptance criteria:**
- Migration runs cleanly
- All entities are visible in Prisma Studio
- The schema matches the Data Model document's entity definitions
- Foreign key relationships are correctly defined

**Dependencies:** Task 1.2

---

### Task 2.2: Availability checking

**What to build:**
- Create `lib/availability/check.ts`:
  - Function: `checkAvailability(propertyId, checkIn, checkOut)` → `{ available: boolean, reason?: string }`
  - Queries confirmed and pending bookings for date overlap
  - Queries blocked dates for overlap
  - Checks minimum stay requirement (from property default)
  - Checks maximum stay requirement
  - Checks that check-in is in the future
  - Checks that check-out is after check-in
- Create API route `GET /api/availability?from=YYYY-MM-DD&to=YYYY-MM-DD`
  - Validates query parameters
  - Returns `{ available: boolean, reason?: string }`
- Create API route `GET /api/calendar?month=YYYY-MM`
  - Returns an array of dates for the month, each with a status: `available`, `booked`, `blocked`, `past`
  - Used by the calendar component to render availability

**Acceptance criteria:**
- Availability check correctly identifies conflicts with existing bookings
- Availability check correctly identifies conflicts with blocked dates
- Minimum stay is enforced
- Past dates are marked unavailable
- The calendar endpoint returns correct status for each day of the requested month
- Edge cases: bookings that span month boundaries, check-out day is available for new check-in (same-day turnover)

**Dependencies:** Task 2.1

---

### Task 2.3: Pricing engine

**What to build:**
- Create `lib/pricing/calculate.ts`:
  - Function: `calculatePrice(propertyId, checkIn, checkOut, guestCount)` → `PriceBreakdown`
  - PriceBreakdown type: `{ nights: number, nightlyRates: { date: string, rate: number }[], accommodationSubtotal: number, cleaningFee: number, extraGuestFee: number, total: number, currency: string }`
  - For this phase: use the property's `base_nightly_rate` for all nights (seasonal rules come in Phase 7)
  - Add cleaning fee from the property record
  - Calculate extra guest fee if `guestCount > property.base_guest_count`
  - Return the full itemised breakdown
- Create API route `GET /api/pricing?from=YYYY-MM-DD&to=YYYY-MM-DD&guests=N`
  - Validates parameters
  - Calls the pricing engine
  - Returns the breakdown as JSON

**Acceptance criteria:**
- Correct nightly rate applied for each night
- Cleaning fee added once (not per night)
- Extra guest fee calculated correctly (per night, per extra guest)
- Total is the sum of all components
- Currency comes from the property record
- Returns an error if dates are invalid or unavailable

**Dependencies:** Task 2.1

---

### Task 2.4: Availability calendar component

**What to build:**
- A date range picker component for the property page:
  - Displays a two-month calendar view (current month + next month)
  - Fetches availability from `GET /api/calendar`
  - Available dates are selectable; booked/blocked/past dates are greyed out and unclickable
  - Guest clicks a check-in date, then a check-out date to select a range
  - Selected range highlights on the calendar
  - Minimum stay is visually enforced (if min stay is 3, selecting a check-in date greys out the next 2 days as check-out options)
  - Navigation: previous/next month arrows
  - Mobile-friendly: single month view on small screens
- Below the calendar, show:
  - Selected dates summary
  - Guest count selector (adults + children, with max from property)
  - "Check price" button that calls `GET /api/pricing` and displays the breakdown
  - Price breakdown display: nightly rate × N nights, cleaning fee, extra guest fee, total

**Acceptance criteria:**
- Calendar accurately reflects availability from the API
- Unavailable dates cannot be selected
- Date range selection works intuitively (click start, click end)
- Minimum stay is enforced in the UI
- Price breakdown is displayed correctly after selecting dates and guest count
- Calendar navigation works (month to month)
- Responsive on mobile

**Dependencies:** Tasks 2.2, 2.3

---

### Task 2.5: Supabase Auth — guest authentication

**What to build:**
- Configure Supabase Auth:
  - Enable email/password sign-up
  - Enable magic link (passwordless) sign-in
  - Configure email templates in Supabase (confirmation, magic link)
  - Set redirect URLs for auth flows
- Create `lib/auth/` utilities:
  - `getSession()` — get the current Supabase session server-side
  - `getUser()` — get the current user with role
  - `requireAuth()` — middleware helper that redirects to login if not authenticated
  - `requireHost()` — middleware helper that checks for host role
- Build guest auth pages:
  - `/login` — email/password login + magic link option
  - `/register` — email/password registration (name, email, password)
  - Both redirect to the previous page (or dashboard) after auth
- Create Next.js middleware that:
  - Checks Supabase session on protected routes
  - Redirects unauthenticated users to `/login`
  - Passes user context to server components

**Acceptance criteria:**
- Guest can register with email and password
- Guest can log in with email and password
- Guest can request and use a magic link
- Protected routes redirect to login when not authenticated
- After login, the user is redirected back to where they came from
- Session persists across page navigations
- Session refresh works (token doesn't expire during a browsing session)

**Dependencies:** Task 1.2

---

### Task 2.6: Stripe integration — checkout session

**What to build:**
- Install and configure the Stripe SDK (server-side)
- Create `lib/stripe/client.ts` with the Stripe client singleton
- Create `lib/stripe/checkout.ts`:
  - Function: `createCheckoutSession(booking, priceBreakdown, successUrl, cancelUrl)` → `{ sessionId, url }`
  - Creates a Stripe Checkout Session with:
    - Line items reflecting the price breakdown (accommodation, cleaning fee, extra guest fee as separate line items)
    - Booking ID in the session metadata
    - Currency from the property
    - Success and cancel redirect URLs
- Create the booking API route `POST /api/bookings`:
  - Requires guest authentication
  - Accepts: `{ checkIn, checkOut, guestsAdults, guestsChildren, message? }`
  - Acquires a PostgreSQL advisory lock: `SELECT pg_advisory_xact_lock(hashtext($propertyId || $checkIn || $checkOut))`
  - Re-validates availability (inside the transaction)
  - Calculates the price
  - Creates the Guest record (or updates if returning guest, matched by email)
  - Creates the Booking record (status: `pending`)
  - Creates the BookingPriceSnapshot record
  - Creates the Stripe Checkout Session
  - Returns `{ bookingId, checkoutUrl }`
  - The advisory lock is released when the transaction completes

**Acceptance criteria:**
- Booking creation correctly locks against concurrent requests (test with two simultaneous requests for the same dates)
- A pending Booking and BookingPriceSnapshot are created in the database
- Stripe Checkout Session is created with correct amounts and currency
- The checkout URL redirects to Stripe's hosted payment page
- If availability check fails inside the lock, the booking is not created and an error is returned
- Metadata on the Stripe session includes the booking ID

**Dependencies:** Tasks 2.2, 2.3, 2.5

---

### Task 2.7: Stripe webhook handling

**What to build:**
- Create API route `POST /api/webhooks/stripe`:
  - Verifies the Stripe webhook signature using the webhook secret
  - Handles event: `checkout.session.completed`:
    - Looks up the booking by ID from session metadata
    - Updates booking status from `pending` to `confirmed`
    - Sets `confirmed_at` timestamp
    - Creates a Payment record (type: `charge`, status: `completed`, with Stripe transaction ID, card details)
    - Triggers the booking confirmation email (Task 2.8)
    - Triggers the host notification email (Task 2.8)
  - Handles event: `checkout.session.expired`:
    - Updates booking status to `cancelled` (session timed out, guest didn't pay)
  - Handler is idempotent: processing the same event twice has no additional effect (check if booking is already confirmed before processing)
- Configure the Stripe webhook endpoint in the Stripe dashboard (or via CLI for development)
- For local development: set up Stripe CLI to forward webhooks to localhost

**Acceptance criteria:**
- Webhook endpoint correctly verifies Stripe signatures (rejects invalid signatures with 400)
- Successful payment updates booking to confirmed and creates a Payment record
- Expired checkout session marks the booking as cancelled
- Idempotent: sending the same webhook event twice doesn't create duplicate Payment records or send duplicate emails
- Stripe CLI forwarding works in local development

**Dependencies:** Task 2.6

---

### Task 2.8: Email — booking confirmation

**What to build:**
- Install and configure Resend SDK
- Install React Email
- Create `lib/email/client.ts` with the Resend client singleton
- Create `lib/email/send.ts` with a generic send function that also logs to the AutomatedEmailLog table
- Create email templates as React Email components:
  - `emails/BookingConfirmationGuest.tsx`:
    - Guest name, property name, check-in/check-out dates, guest count
    - Price breakdown (itemised)
    - Cancellation policy summary
    - Link to guest dashboard
    - Property photo (hero image)
  - `emails/BookingNotificationHost.tsx`:
    - Guest name, email, phone
    - Check-in/check-out dates, guest count
    - Total price
    - Guest's message (if provided)
    - Link to admin panel booking detail
- Integrate email sending into the Stripe webhook handler (Task 2.7):
  - On `checkout.session.completed`: send both emails

**Acceptance criteria:**
- Booking confirmation email is sent to the guest on successful payment
- Host notification email is sent on successful payment
- Emails render correctly (test with React Email preview)
- Emails contain all relevant booking details
- AutomatedEmailLog records are created for each sent email
- Emails use the sender address and name from SiteConfiguration

**Dependencies:** Task 2.7

---

### Task 2.9: Booking flow UI

**What to build:**
- The complete guest booking flow on the property page:
  - Step 1: Date selection + guest count + price display (built in Task 2.4)
  - Step 2: "Book Now" button appears after price is shown
  - Step 2.5: If not logged in, redirect to login/register with a return URL back to the booking flow (preserving selected dates and guest count in URL params or session storage)
  - Step 3: Booking details form — confirm personal details (pre-filled from account), add phone if missing, optional message to host
  - Step 4: Review booking summary — dates, guests, price breakdown, cancellation policy, house rules agreement checkbox
  - Step 5: Click "Confirm & Pay" → POST /api/bookings → redirect to Stripe Checkout
  - After Stripe: success page showing confirmation details, or cancel page allowing retry
- Success page (`/book/confirmation/[bookingId]`):
  - Shows booking confirmed message
  - Booking reference number
  - Dates, property name, price summary
  - "Go to your dashboard" link
  - If guest is not yet logged in (edge case), prompt to create account
- Cancel/failure page:
  - "Payment was not completed" message
  - Option to try again (return to the booking summary step)

**Acceptance criteria:**
- The full flow works end-to-end: select dates → enter details → review → pay → confirmation
- Auth is handled smoothly (login/register mid-flow without losing selected dates)
- Price breakdown is shown before payment
- Guest must agree to house rules and cancellation policy before proceeding
- Stripe Checkout loads correctly and payment can be completed (test with Stripe test cards)
- Success page shows after successful payment
- Failure/cancel page shows if payment is abandoned
- Mobile responsive throughout

**Dependencies:** Tasks 2.4, 2.5, 2.6, 2.7, 2.8

---

### Task 2.10: Booking expiry cron job

**What to build:**
- Create API route `POST /api/cron/booking-expiry`:
  - Protected by CRON_SECRET header check
  - Finds all bookings with status `pending` where `created_at` is older than 30 minutes
  - Updates their status to `cancelled` (reason: "Payment not completed — booking expired")
  - Does NOT attempt Stripe refund (no payment was captured for pending bookings)
- Configure in `vercel.json`:
  ```json
  {
    "crons": [
      { "path": "/api/cron/booking-expiry", "schedule": "*/15 * * * *" }
    ]
  }
  ```

**Acceptance criteria:**
- Pending bookings older than 30 minutes are automatically cancelled
- The cancelled booking's dates become available again in the calendar
- The cron endpoint rejects requests without the correct CRON_SECRET
- Recently created pending bookings (< 30 min) are NOT cancelled

**Dependencies:** Task 2.6

---

## Phase 3: Guest & Host Dashboards

**Goal:** Both guests and hosts can view and manage bookings through dedicated dashboards.

**Estimated total effort: 6–8 days**

---

### Task 3.1: Guest dashboard

**What to build:**
- Guest dashboard page at `/(guest)/dashboard`:
  - Requires guest auth
  - Shows upcoming bookings (status: confirmed, with check-in in the future)
  - Shows past bookings (status: completed)
  - Shows cancelled bookings (collapsible/secondary)
  - Each booking card shows: property name, dates, guest count, total price, status badge
  - Clicking a booking goes to the booking detail page

**Acceptance criteria:**
- Dashboard correctly categorises bookings (upcoming, past, cancelled)
- Bookings are sorted by check-in date (nearest first for upcoming, most recent first for past)
- Empty states are handled ("No upcoming bookings")
- Only the authenticated guest's bookings are shown
- Page is responsive

**Dependencies:** Task 2.9

---

### Task 3.2: Booking detail page (guest)

**What to build:**
- Booking detail page at `/(guest)/dashboard/bookings/[id]`:
  - Requires guest auth; only the booking's guest can access
  - Shows: booking reference, status, dates, guest count
  - Shows the full price breakdown from the BookingPriceSnapshot
  - Shows the payment status and card summary (last four digits)
  - Shows the cancellation policy that was active at booking time
  - **If booking is confirmed and check-in is in the future:**
    - Shows a "Cancel Booking" button (functionality in Phase 8)
    - For now, show the button but have it display "Contact us to cancel" with the host's email
  - **If booking is confirmed and check-in has passed (or today):**
    - Shows check-in instructions: exact address, directions, key collection method, wifi password, house manual
    - This information is pulled from a check-in details section on the Property entity (add fields if needed) or from SiteConfiguration
  - **If booking is completed:**
    - Shows a "Leave a Review" link (functionality in Phase 6)

**Acceptance criteria:**
- Correct booking details are displayed
- Price breakdown matches what was shown at booking time
- Check-in instructions are only visible for confirmed bookings on or after check-in day
- The exact property address is only shown post-check-in (not before)
- Unauthorised access (wrong guest) returns 404 or redirect

**Dependencies:** Task 3.1

---

### Task 3.3: Host admin panel — layout & auth

**What to build:**
- Admin layout at `/(admin)/`:
  - Sidebar navigation: Dashboard, Bookings, Calendar, Pricing, Property, Messages, Reviews, Finance, Settings
  - Header with the host's name and a logout button
  - Requires host role authentication (redirect to login if not host)
- Create the host account:
  - A seed script or manual step to create a Supabase Auth user with a custom `user_role: host` claim in their metadata
  - Document how to set this up for new deployments
- Admin middleware:
  - Checks that the user has `user_role === 'host'` in their Supabase Auth metadata
  - Guests attempting to access `/admin/*` are redirected

**Acceptance criteria:**
- Admin panel is only accessible to the host account
- Sidebar navigation works and highlights the current page
- Layout is responsive (sidebar collapses to a hamburger menu on mobile)
- Guest accounts cannot access admin routes
- Unauthenticated requests redirect to login

**Dependencies:** Task 2.5

---

### Task 3.4: Host admin — booking management

**What to build:**
- Admin bookings list at `/(admin)/bookings`:
  - Table/list of all bookings with: guest name, dates, status, total, created date
  - Filterable by status (all, confirmed, pending, cancelled, completed)
  - Searchable by guest name or email
  - Sortable by date
  - Clicking a row opens the booking detail
- Admin booking detail at `/(admin)/bookings/[id]`:
  - All booking details: guest info (name, email, phone), dates, guest count, status
  - Price breakdown
  - Payment records (all payments associated with the booking)
  - Guest's message
  - Timeline of status changes (created, confirmed, cancelled — with timestamps)
  - For pending request-to-book bookings: Approve/Decline buttons (Phase 8, placeholder for now)

**Acceptance criteria:**
- All bookings are listed with correct details
- Filters and search work correctly
- Booking detail shows all relevant information
- Payment records are displayed with transaction IDs and status

**Dependencies:** Task 3.3

---

### Task 3.5: Host admin — calendar view

**What to build:**
- Admin calendar at `/(admin)/calendar`:
  - Monthly calendar view showing:
    - Booked dates with guest name
    - Blocked dates with reason
    - Available dates
  - Colour-coded: bookings one colour, blocked dates another, available dates neutral
  - Click on a booked date to jump to that booking's detail page
  - "Block dates" functionality:
    - Select a date range on the calendar
    - Enter a reason (personal use, maintenance, cleaning)
    - Creates a BlockedDate record
  - "Unblock dates" functionality:
    - Click a blocked date range
    - Confirm removal
    - Deletes the BlockedDate record
  - Month navigation (previous/next)

**Acceptance criteria:**
- Calendar accurately shows all bookings and blocked dates
- Host can block and unblock dates
- Newly blocked dates immediately appear as unavailable on the guest-facing calendar
- Bookings are clickable links to their detail page
- Calendar handles month boundaries correctly (bookings spanning two months)

**Dependencies:** Tasks 3.3, 2.1

---

### Task 3.6: Host admin — dashboard overview

**What to build:**
- Admin dashboard at `/(admin)/dashboard`:
  - Summary cards:
    - Today's status: any check-ins today, any check-outs today, current guest (if property is occupied)
    - This week: upcoming check-ins and check-outs
    - Pending actions: unread messages count, booking requests awaiting approval count (Phase 8)
  - Recent bookings: last 5 bookings with status
  - Quick stats: total bookings this month, revenue this month, occupancy rate this month

**Acceptance criteria:**
- Dashboard loads quickly and shows current, relevant information
- Check-in/check-out alerts are accurate based on today's date
- Revenue and occupancy stats are calculated correctly
- Cards link to the relevant detail pages

**Dependencies:** Tasks 3.3, 3.4

---

## Phase 4: Communication

**Goal:** Guests and hosts can message each other, both before and after booking.

**Estimated total effort: 5–7 days**

---

### Task 4.1: Database schema — messaging entities

**What to build:**
- Add to the Prisma schema (if not already added in Task 2.1):
  - `MessageThread` (all fields from data model)
  - `Message` (all fields)
- Run the migration
- Update the booking confirmation flow (Task 2.7) to create a MessageThread for each confirmed booking

**Acceptance criteria:**
- Migration runs cleanly
- A MessageThread is created when a booking is confirmed
- Thread links to the booking and guest correctly

**Dependencies:** Task 2.1

---

### Task 4.2: Messaging API

**What to build:**
- API route `POST /api/messages`:
  - Requires auth
  - Accepts: `{ threadId, content }`
  - Creates a Message record (sender_type based on user role)
  - Sends an email notification to the other party via Resend
  - Returns the created message
- API route `GET /api/messages/[threadId]`:
  - Requires auth
  - Returns all messages in the thread, ordered by created_at
  - Marks unread messages as read for the current user
  - Guest can only access their own threads; host can access all
- API route `POST /api/enquiries`:
  - Public (or minimal auth — email required)
  - Accepts: `{ name, email, message }`
  - Creates a Guest record (or finds existing by email)
  - Creates a MessageThread (no booking link) and first Message
  - Sends notification to the host
  - Returns the thread ID
- Email template: `emails/NewMessageNotification.tsx`
  - Shows sender name, message preview, link to the conversation

**Acceptance criteria:**
- Messages are created and retrieved correctly
- Email notifications are sent to the other party
- Guests can only access their own threads
- Host can access all threads
- Pre-booking enquiries create a standalone thread
- Read status is updated when messages are viewed

**Dependencies:** Tasks 4.1, 2.8

---

### Task 4.3: Messaging UI — guest side

**What to build:**
- Guest messages page at `/(guest)/messages`:
  - List of all message threads for the guest
  - Each thread shows: subject/booking reference, last message preview, timestamp, unread indicator
  - Sorted by most recent activity
- Thread view at `/(guest)/messages/[threadId]`:
  - Chat-style message display (guest messages on right, host on left, system messages centred)
  - Text input with send button
  - Messages load on page open, new messages appear via polling (Realtime in Phase 4.5)
  - Timestamps on each message
- Pre-booking enquiry form on the property page:
  - Name, email, message fields
  - Submits to POST /api/enquiries
  - Shows confirmation: "Your message has been sent. We'll get back to you shortly."

**Acceptance criteria:**
- Guests can see all their conversation threads
- Guests can send and receive messages
- Unread indicators show on threads with new messages
- Pre-booking enquiry form works for both logged-in and anonymous visitors
- Chat interface is responsive and mobile-friendly

**Dependencies:** Task 4.2

---

### Task 4.4: Messaging UI — admin side

**What to build:**
- Admin messages page at `/(admin)/messages`:
  - List of all message threads across all guests
  - Filterable: all, booking-related, enquiries, unread
  - Each thread shows: guest name, subject/booking reference, last message, timestamp, unread badge
  - Sorted by most recent activity (unread threads first)
- Thread view at `/(admin)/messages/[threadId]`:
  - Same chat-style interface as the guest side
  - Shows guest details in a sidebar: name, email, phone, linked booking (if any)
  - Quick action: link an enquiry thread to a booking (if the guest later books)
  - Reply input with send button

**Acceptance criteria:**
- Host can see all threads from all guests
- Host can filter and search threads
- Host can reply to messages
- Guest details are visible alongside the conversation
- Unread threads are visually distinct

**Dependencies:** Task 4.2

---

### Task 4.5: Supabase Realtime — live messaging

**What to build:**
- Configure Supabase Realtime subscription for the Message table
- On the guest thread view: subscribe to new messages in the current thread
  - New messages from the host appear instantly without page refresh
- On the admin messages page: subscribe to new messages across all threads
  - New messages from any guest appear with a notification indicator
- Ensure RLS policies allow Realtime subscriptions (guest sees only their threads, host sees all)
- Graceful fallback: if Realtime connection drops, fall back to polling every 10 seconds

**Acceptance criteria:**
- Messages appear in real time for both guest and host (< 2 second delay)
- RLS correctly scopes Realtime events (guest only sees their own messages)
- Connection drop is handled gracefully (auto-reconnect, fallback to polling)
- No duplicate messages on reconnect

**Dependencies:** Tasks 4.3, 4.4

---

## Phase 5: Automated Email Sequences

**Goal:** Guests receive timely, helpful emails throughout their stay lifecycle without the host needing to send anything manually.

**Estimated total effort: 3–4 days**

---

### Task 5.1: Email templates

**What to build:**
- Create React Email templates for all automated emails:
  - `emails/PreArrivalInfo.tsx` — sent 3 days before check-in:
    - Exact address and directions
    - Check-in instructions (key collection, lockbox code, etc.)
    - Wifi password
    - Local tips and recommendations
    - Host contact details
  - `emails/CheckInReminder.tsx` — sent morning of check-in:
    - "We're looking forward to welcoming you today"
    - Check-in time reminder
    - Key information recap
  - `emails/MidStayCheckIn.tsx` — sent mid-stay for stays ≥ 5 nights:
    - "How's everything going?"
    - Host contact details for any issues
  - `emails/CheckOutReminder.tsx` — sent day before check-out:
    - Check-out time and instructions
    - Any departure checklist (bins, keys, etc.)
  - `emails/PostStayThankYou.tsx` — sent 1 day after check-out:
    - Thank you message
    - Link to leave a review (Phase 6)
    - Invitation to book again
- All templates should:
  - Pull branding (logo, colours, site name) from SiteConfiguration
  - Include the property hero image
  - Be mobile-responsive
  - Have a consistent header/footer design across all templates

**Acceptance criteria:**
- All templates render correctly in React Email preview
- Templates are responsive (test in a few email clients via Resend's preview or Litmus)
- Branding is consistent and pulled from configuration
- Content is personalised with guest name and booking details

**Dependencies:** Task 2.8

---

### Task 5.2: Email scheduler

**What to build:**
- Create API route `POST /api/cron/email-scheduler`:
  - Protected by CRON_SECRET
  - Queries confirmed bookings with relevant date proximity:
    - Check-in in 3 days → pre-arrival email
    - Check-in today → check-in reminder
    - Currently mid-stay (check-in past, check-out future, stay ≥ 5 nights, midpoint reached) → mid-stay check-in
    - Check-out tomorrow → check-out reminder
    - Check-out was yesterday → post-stay thank you
  - For each match, checks AutomatedEmailLog to see if that email type has already been sent for that booking
  - If not sent: renders the template, sends via Resend, logs to AutomatedEmailLog
  - If send fails: logs with status `failed` (will be retried on next run because the success check looks for status `sent`)
- Configure in `vercel.json`:
  ```json
  { "path": "/api/cron/email-scheduler", "schedule": "0 * * * *" }
  ```
  (runs at the top of every hour)

**Acceptance criteria:**
- Each email type is sent at the correct time relative to the booking dates
- Emails are never sent twice for the same booking (idempotent)
- Failed sends are retried on the next hourly run
- The scheduler handles multiple bookings in the same run
- The scheduler respects the property's timezone for "morning of check-in" type emails
- Cron endpoint rejects unauthorised requests

**Dependencies:** Task 5.1

---

### Task 5.3: Daily host summary

**What to build:**
- Create email template `emails/DailyHostSummary.tsx`:
  - Today's date
  - Check-ins today (guest name, guest count)
  - Check-outs today (guest name)
  - Currently occupied (guest name, check-out date)
  - This week's upcoming check-ins
  - Pending actions: unread messages, unanswered enquiries
  - Quick link to admin panel
- Create API route `POST /api/cron/daily-summary`:
  - Protected by CRON_SECRET
  - Queries today's and this week's bookings
  - Counts unread messages
  - Sends the summary to the host email from SiteConfiguration
- Configure in `vercel.json`:
  ```json
  { "path": "/api/cron/daily-summary", "schedule": "0 8 * * *" }
  ```
  (runs daily at 8:00 UTC — adjust for property timezone)

**Acceptance criteria:**
- Host receives one summary email per day
- Email accurately reflects today's check-ins, check-outs, and upcoming bookings
- Pending action counts are correct
- Email is only sent if there is relevant content (don't send an empty summary on quiet days)

**Dependencies:** Task 5.1

---

## Phase 6: Reviews & Social Proof

**Goal:** Guests can leave reviews after their stay. Reviews are displayed on the property page to build trust for future guests.

**Estimated total effort: 3–5 days**

---

### Task 6.1: Database schema — reviews

**What to build:**
- Add `Review` entity to Prisma schema (if not already added):
  - All fields from the data model document
- Run migration
- The post-stay thank you email (Task 5.1) should link to the review submission page

**Acceptance criteria:**
- Migration runs cleanly
- Review entity has a unique constraint on booking_id (one review per booking)

**Dependencies:** Task 2.1

---

### Task 6.2: Review submission

**What to build:**
- Guest review page at `/(guest)/dashboard/bookings/[id]/review`:
  - Requires guest auth
  - Only accessible for completed bookings with no existing review
  - Star rating inputs for: overall, cleanliness, accuracy, communication, location, value
  - Text area for written review
  - Submit button
- API route `POST /api/reviews`:
  - Validates that the booking exists, is completed, belongs to the authenticated guest, and has no existing review
  - Creates the Review record
  - Sends notification to host via Resend
- Update the booking detail page (Task 3.2) to show:
  - "Leave a Review" button for completed bookings without a review
  - The submitted review for completed bookings with a review

**Acceptance criteria:**
- Star ratings work (click/tap to set, visual feedback)
- Review is saved correctly with all ratings and text
- Guest cannot review a booking that is not completed
- Guest cannot submit two reviews for the same booking
- Host is notified of new reviews

**Dependencies:** Tasks 6.1, 3.2

---

### Task 6.3: Review display on property page

**What to build:**
- Reviews section on the property page:
  - Overall average rating (prominently displayed, with star visual)
  - Average for each sub-rating (cleanliness, accuracy, etc.) as a bar or mini-chart
  - Total review count
  - Individual reviews listed by most recent:
    - Guest first name + initial (e.g., "Sarah M.")
    - Date of stay
    - Star rating
    - Review text
    - Host response (if present), visually distinct
  - Show the most recent 5 reviews with a "Show all reviews" button/link
- API route `GET /api/reviews`:
  - Public endpoint
  - Returns published reviews with guest name (first + last initial), ratings, text, host response
  - Cached (revalidated on new review submission)

**Acceptance criteria:**
- Reviews section displays correctly on the property page
- Average ratings are calculated correctly
- Reviews are ordered by most recent
- Host responses appear beneath the relevant review
- SEO: review data is in the server-rendered HTML
- Schema.org: add `AggregateRating` to the property's structured data

**Dependencies:** Task 6.2

---

### Task 6.4: Host review management

**What to build:**
- Admin reviews page at `/(admin)/reviews`:
  - List of all reviews with: guest name, date, overall rating, excerpt
  - Filter: all, responded, needs response
  - Click to view full review
- Review detail / response:
  - Full review text and all ratings
  - Text area for the host response
  - Save response button
- API route `PUT /api/reviews/[id]/respond`:
  - Host auth required
  - Accepts: `{ response }`
  - Updates the review's host_response and host_responded_at fields
  - Triggers cache revalidation for the property page reviews section

**Acceptance criteria:**
- Host can see all reviews and their response status
- Host can write and save responses
- Responses appear on the property page immediately after saving
- Host cannot edit the review itself, only add/edit their response

**Dependencies:** Tasks 6.2, 3.3

---

## Phase 7: Advanced Pricing & Financial Admin

**Goal:** Hosts can manage seasonal pricing, discounts, and view financial reports.

**Estimated total effort: 5–7 days**

---

### Task 7.1: Pricing rules management UI

**What to build:**
- Admin pricing page at `/(admin)/pricing`:
  - Current base rate display (editable)
  - List of all pricing rules with: name, type, date range, rate/multiplier, status (active/inactive)
  - "Add pricing rule" form:
    - Name, type (seasonal, last-minute, early-bird, length discount)
    - For seasonal: date range picker, nightly rate override OR multiplier, optional min stay override
    - For last-minute: days before check-in threshold, discount percentage
    - For early-bird: days in advance threshold, discount percentage
    - For length discount: minimum nights, discount percentage
    - Priority field
    - Active/inactive toggle
  - Edit and delete existing rules
- API routes `CRUD /api/admin/pricing-rules`:
  - Host auth required
  - Validates rule data (date ranges make sense, rates are positive, etc.)
  - On create/update/delete: no cache invalidation needed (pricing is calculated fresh per request)

**Acceptance criteria:**
- Host can create, edit, and deactivate pricing rules
- All rule types are supported
- Validation prevents invalid rules (end date before start date, negative rates)
- Rules are displayed in priority order

**Dependencies:** Task 3.3

---

### Task 7.2: Pricing engine — full implementation

**What to build:**
- Update `lib/pricing/calculate.ts` to handle all pricing rule types:
  - For each night in the requested range:
    - Find all active rules where the date falls within the rule's range (for seasonal) or the rule's conditions are met (for last-minute, early-bird)
    - Select the highest-priority matching rule
    - Apply the rule's nightly rate or multiplier to the base rate
  - After calculating per-night rates:
    - Check for length discount rules: if stay length meets the minimum, apply the discount to the accommodation subtotal
    - Check for last-minute rules: if booking is within the threshold days, apply the discount
    - Check for early-bird rules: if booking is beyond the threshold days, apply the discount
    - Only one discount type applies (highest value, or define a priority)
  - Return the full breakdown including which rules were applied

**Acceptance criteria:**
- Seasonal rates correctly override the base rate for matching dates
- Multipliers apply correctly (base rate × multiplier)
- Length discounts apply when stay exceeds the minimum
- Last-minute discounts apply when booking is within the threshold
- Early-bird discounts apply when booking is beyond the threshold
- Higher-priority rules take precedence
- Mixed stays (some nights seasonal, some base rate) calculate correctly
- The price breakdown includes discount descriptions

**Dependencies:** Task 7.1

---

### Task 7.3: Financial reports

**What to build:**
- Admin finance page at `/(admin)/finance`:
  - Date range selector (default: current month)
  - Summary cards: total revenue, number of bookings, average nightly rate, occupancy rate
  - Bookings table for the selected period: guest name, dates, total, payment status
  - Payment records table: all payments in the period with type (charge, refund), amount, status, date
  - Revenue chart: daily or weekly revenue bar chart for the selected period
  - CSV export button for the bookings and payments tables
- API route `GET /api/admin/finance`:
  - Host auth required
  - Accepts date range parameters
  - Returns aggregated financial data and individual records

**Acceptance criteria:**
- Revenue calculations are accurate (only include completed payments, subtract refunds)
- Occupancy rate is calculated correctly (booked nights / available nights in period)
- CSV export produces a valid file that opens correctly in Excel
- Chart displays revenue data clearly
- Date range filtering works correctly

**Dependencies:** Tasks 3.3, 2.7

---

## Phase 8: Polish & Extended Features

**Goal:** Complete the features that round out the platform — cancellation handling, request-to-book, content management, and SEO refinements.

**Estimated total effort: 6–8 days**

---

### Task 8.1: Cancellation flow

**What to build:**
- Update the guest booking detail page:
  - "Cancel Booking" button for confirmed bookings where check-in is in the future
  - Clicking shows the cancellation policy and the calculated refund amount
  - Confirm/cancel dialog
- API route `POST /api/bookings/[id]/cancel`:
  - Guest auth required (can only cancel own booking)
  - Retrieves the booking's cancellation_policy_snapshot
  - Calculates refund:
    - Flexible: full refund if > 24 hours before check-in
    - Moderate: full refund if > 5 days before check-in
    - Strict: 50% refund if > 7 days before check-in, 0% after
  - Calls Stripe refund API with the calculated amount
  - Creates a Payment record (type: refund)
  - Updates booking status to cancelled
  - Sends cancellation emails to both guest and host
- Email templates:
  - `emails/CancellationConfirmationGuest.tsx` — refund amount, timeline, booking details
  - `emails/CancellationNotificationHost.tsx` — guest name, dates, refund amount
- Update the Stripe webhook handler to process `charge.refunded` events:
  - Updates the Payment record status from pending to completed

**Acceptance criteria:**
- Refund calculation matches the cancellation policy correctly for each tier
- Stripe refund is processed for the correct amount
- Booking status updates to cancelled
- Dates become available again on the calendar
- Both guest and host receive cancellation emails
- Partial refunds work correctly (Stripe supports partial refund of a payment)

**Dependencies:** Tasks 3.2, 2.7

---

### Task 8.2: Request-to-book mode

**What to build:**
- Add a `booking_mode` field to Property: `instant` or `request`
- Admin setting to toggle between instant book and request-to-book
- When request mode is active:
  - Booking flow changes "Book Now" to "Request to Book"
  - POST /api/bookings creates the booking in `pending` status but does NOT create a Stripe Checkout Session
  - Guest receives a "Request submitted" email
  - Host receives a "New booking request" email with Approve/Decline links
- Admin booking detail: Approve and Decline buttons for pending requests
- API routes:
  - `POST /api/bookings/[id]/approve`: Host approves → creates Stripe Checkout Session → sends payment link to guest via email
  - `POST /api/bookings/[id]/decline`: Host declines → updates status → notifies guest
- Update booking expiry: pending request-to-book bookings expire after 48 hours (configurable) if not approved
- Email templates:
  - `emails/BookingRequestGuest.tsx`
  - `emails/BookingRequestHost.tsx`
  - `emails/BookingApprovedGuest.tsx` (with payment link)
  - `emails/BookingDeclinedGuest.tsx`

**Acceptance criteria:**
- Toggle between instant and request mode works
- Request mode: guest submits request without paying
- Host can approve or decline from the admin panel
- On approval, guest receives a payment link and can complete the booking
- On decline, guest is notified and dates are released
- Pending requests expire after the configured window
- The calendar shows pending requests as tentatively blocked

**Dependencies:** Tasks 3.4, 2.6

---

### Task 8.3: Property content management

**What to build:**
- Admin property editor at `/(admin)/property`:
  - Edit property details: name, description, short description, property type
  - Edit room details: bedrooms, beds, bathrooms, max guests
  - Edit check-in/check-out times
  - Edit house rules (rich text editor or structured fields)
  - Manage amenities: toggle amenities on/off, add notes
  - Photo management:
    - Upload new photos (to Supabase Storage)
    - Delete photos
    - Reorder photos (drag and drop)
    - Set category and caption for each photo
    - Thumbnail preview
  - Save triggers cache revalidation of the property page
- API routes:
  - `PUT /api/property` — update property details
  - `POST /api/property/photos` — upload photo
  - `DELETE /api/property/photos/[id]` — delete photo
  - `PUT /api/property/photos/reorder` — update sort order
  - `PUT /api/property/amenities` — update amenity selections

**Acceptance criteria:**
- Host can edit all property details without touching code
- Photo upload works with preview and progress indicator
- Photo reorder works via drag and drop
- Changes appear on the live property page within 60 seconds (ISR revalidation)
- Rich text content (description, house rules) renders correctly

**Dependencies:** Tasks 3.3, 1.3

---

### Task 8.4: Site settings management

**What to build:**
- Admin settings page at `/(admin)/settings`:
  - Site name and tagline
  - Contact email and phone
  - Branding: logo upload, primary colour, accent colour
  - SEO: default page title, meta description, OG image upload
  - Email: sender name and address (display only — domain verification is separate)
  - Cancellation policy selector (flexible, moderate, strict)
  - Booking mode selector (instant book, request to book)
  - Timezone selector
- API route `PUT /api/admin/config` — updates SiteConfiguration

**Acceptance criteria:**
- Host can update all settings
- Logo and OG image upload work
- Changes to branding are reflected across the site
- Colour changes update the Tailwind theme (via CSS custom properties)
- Cancellation policy change affects new bookings (not existing ones)

**Dependencies:** Task 3.3

---

### Task 8.5: SEO refinements

**What to build:**
- Dynamic sitemap.xml generation (include property page, review pages if paginated)
- robots.txt with sitemap reference
- Breadcrumb structured data where applicable
- `AggregateRating` in Schema.org from real review data
- Canonical URLs
- Open Graph and Twitter Card meta for all public pages
- A basic "local guide" page template (optional, for content marketing):
  - Static markdown pages about the local area
  - "Things to do near [property]" format
  - Internal links back to the property page

**Acceptance criteria:**
- Sitemap is generated dynamically and accessible at /sitemap.xml
- All structured data validates via Google's Rich Results Test
- Social sharing previews look correct for all public pages
- Lighthouse SEO score is 100

**Dependencies:** Task 1.7

---

## Phase 9: Growth Features

**Goal:** Features that help grow the business once it's running — analytics, email marketing, and multi-language support.

**Estimated total effort: 4–6 days**

---

### Task 9.1: Booking analytics

**What to build:**
- Admin analytics section (can be part of the dashboard or a separate page):
  - Occupancy rate over time (monthly chart)
  - Revenue over time (monthly chart)
  - Average booking lead time (how far in advance guests book)
  - Average length of stay
  - Cancellation rate
  - Conversion rate: require basic page view tracking (Task 9.2) to calculate visitors vs bookings
  - Top source countries (from guest country field)
  - Repeat guest rate

**Acceptance criteria:**
- All metrics are calculated correctly from booking data
- Charts display clearly and are responsive
- Date range filtering works
- Data updates as new bookings come in (no manual refresh)

**Dependencies:** Task 7.3

---

### Task 9.2: Website analytics integration

**What to build:**
- Integration point for an analytics service:
  - Add the analytics tracking script via the SiteConfiguration's `analytics_id` field
  - Support Google Analytics 4 or Plausible (privacy-friendly alternative)
  - Track: page views, calendar interactions (dates selected), booking flow start, booking completion
  - Implement via a reusable analytics component that fires events

**Acceptance criteria:**
- Analytics script loads on all public pages
- Key events are tracked (page view, booking flow steps)
- Analytics ID is configurable from the admin settings
- No analytics loaded if the field is empty (opt-in)
- Cookie consent banner integration (if using Google Analytics)

**Dependencies:** Task 8.4

---

### Task 9.3: Email marketing — guest list & newsletters

**What to build:**
- Email opt-in:
  - Checkbox during booking: "Keep me updated about availability and special offers"
  - Stores consent flag on the Guest record
  - Respects GDPR: explicit opt-in, easy unsubscribe
- Admin guest list at `/(admin)/guests` (or within settings):
  - List of all guests with opt-in status
  - Export opted-in guest emails as CSV (for import into Mailchimp, Loops, etc.)
- Optional: basic newsletter sending via Resend:
  - Compose a message in the admin panel
  - Send to all opted-in guests
  - Track sends in a simple log
  - Unsubscribe link in every email

**Acceptance criteria:**
- Opt-in checkbox appears during booking
- Guest consent is stored and respected
- Export produces a valid CSV with opted-in emails only
- If newsletter sending is implemented: emails are sent only to opted-in guests, unsubscribe works

**Dependencies:** Tasks 2.9, 3.3

---

### Task 9.4: Multi-language support (optional)

**What to build:**
- Internationalisation setup using next-intl or a similar i18n library
- Extract all UI strings into translation files
- Default language: English
- Add one additional language as a proof of concept (e.g., French, German, or Welsh depending on the property's market)
- Language switcher in the site header
- Property description and house rules: add translatable fields to the Property entity or use a separate translations table

**Acceptance criteria:**
- UI renders in the selected language
- URLs include the locale prefix (e.g., /fr/book)
- Language preference persists across page navigations
- Untranslated content falls back to English
- SEO: hreflang tags on all public pages

**Dependencies:** Task 1.5

---

## Phase dependency summary

```
Phase 1 (Foundation)
  └── Phase 2 (Booking Engine / MVP) ← LAUNCH POINT
        ├── Phase 3 (Dashboards)
        │     ├── Phase 4 (Communication)
        │     │     └── Phase 5 (Automated Emails)
        │     ├── Phase 6 (Reviews)
        │     └── Phase 7 (Pricing & Finance)
        └── Phase 8 (Polish)
              └── Phase 9 (Growth)
```

Phases 3–7 can be worked on somewhat in parallel after Phase 2 is complete, but the order above reflects the priority: dashboards first (both sides need to see what's happening), then communication (replaces manual email), then automated emails (reduces host workload), then reviews (builds trust), then advanced pricing (optimises revenue).

Phase 8 can be interleaved with Phases 6–7 as needed.

Phase 9 is genuinely optional for launch and can be deferred indefinitely.

---

## Notes for the coding agent

1. **Always check the data model document** for the complete field definitions when creating Prisma schema entities. The task descriptions reference fields but the data model is the source of truth.

2. **Test with Stripe test mode** throughout development. Use test card numbers (4242 4242 4242 4242 for success, 4000 0000 0000 0002 for decline). Switch to live mode only when deploying to production.

3. **Use the Supabase connection pooler URL** (port 6543) in production, not the direct connection URL (port 5432). This prevents connection exhaustion in Vercel's serverless environment.

4. **Every API route that modifies data** should validate input using Zod schemas. Never trust client input.

5. **Every API route that requires auth** should use the auth helpers from `lib/auth/` to verify the session and check the user's role. Fail closed: if auth is ambiguous, deny access.

6. **Advisory locks for booking creation** are critical. The lock scope should be a hash of the property ID + date range. Use `pg_advisory_xact_lock` (transaction-scoped, auto-releases) not `pg_advisory_lock` (session-scoped, requires manual release).

7. **Email templates** should be developed and previewed using React Email's dev server (`email dev`) before integrating with Resend.

8. **ISR revalidation** should be triggered via `revalidatePath` or `revalidateTag` in admin API routes that modify content, rather than relying solely on time-based revalidation.

9. **Error handling pattern**: API routes should return structured error responses `{ error: string, code: string }` with appropriate HTTP status codes. The frontend should display user-friendly error messages, not raw error strings.

10. **Commit frequently** with descriptive messages. Each task should result in at least one commit, ideally more (one per meaningful chunk of work within the task).
