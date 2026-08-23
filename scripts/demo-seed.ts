// Demo data seeder — builds a realistic year of trading history so the
// admin dashboards, analytics, finance charts and public review section
// all have something to show. Destructive: wipes existing bookings,
// payments, reviews, threads, messages and guests, then rebuilds.
//
// Run with: npx tsx scripts/demo-seed.ts

import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
loadEnv({ path: ".env" });

import { createClient } from "@supabase/supabase-js";
import { prisma } from "../lib/db/prisma";
import { Prisma } from "../lib/generated/prisma/client";
import { calculatePrice } from "../lib/pricing/calculate";
import { parseISODate, addDays, todayUTC } from "../lib/availability/dates";

const { Decimal } = Prisma;

const DEMO_PASSWORD = "demo1234";
const HOST_EMAIL = (process.env.HOST_EMAILS ?? "").split(",")[0].trim();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

const d = parseISODate;
const at = (iso: string, hour = 10) => new Date(`${iso}T${String(hour).padStart(2, "0")}:00:00.000Z`);

// ---------------------------------------------------------------------------
// Cast of guests
// ---------------------------------------------------------------------------

interface GuestSpec {
  key: string;
  first: string;
  last: string;
  email: string;
  phone: string;
  country: string;
  optIn: boolean;
  authUser?: boolean;
  notes?: string;
}

const GUESTS: GuestSpec[] = [
  { key: "emma", first: "Emma", last: "Harrington", email: "emma.harrington@example.com", phone: "+44 7700 900112", country: "GB", optIn: true, authUser: true, notes: "Repeat guest — third stay. Always leaves the place spotless." },
  { key: "james", first: "James", last: "Okonkwo", email: "james.okonkwo@example.com", phone: "+44 7700 900233", country: "GB", optIn: true },
  { key: "priya", first: "Priya", last: "Raman", email: "priya.raman@example.com", phone: "+44 7700 900344", country: "GB", optIn: true },
  { key: "tom", first: "Tom", last: "Whitfield", email: "tom.whitfield@example.com", phone: "+44 7700 900455", country: "GB", optIn: false },
  { key: "sarah", first: "Sarah", last: "Lindqvist", email: "sarah.lindqvist@example.com", phone: "+46 70 123 4567", country: "SE", optIn: true },
  { key: "daniel", first: "Daniel", last: "Mercer", email: "daniel.mercer@example.com", phone: "+44 7700 900566", country: "GB", optIn: true },
  { key: "aoife", first: "Aoife", last: "Brennan", email: "aoife.brennan@example.com", phone: "+353 85 123 4567", country: "IE", optIn: true, notes: "Booked the Christmas week two years running." },
  { key: "marcus", first: "Marcus", last: "Rowley", email: "marcus.rowley@example.com", phone: "+44 7700 900677", country: "GB", optIn: false },
  { key: "chloe", first: "Chloe", last: "Nakamura", email: "chloe.nakamura@example.com", phone: "+44 7700 900788", country: "GB", optIn: true },
  { key: "ben", first: "Ben", last: "Ashworth", email: "ben.ashworth@example.com", phone: "+44 7700 900899", country: "GB", optIn: false },
  { key: "isabelle", first: "Isabelle", last: "Duval", email: "isabelle.duval@example.com", phone: "+33 6 12 34 56 78", country: "FR", optIn: true },
  { key: "rob", first: "Rob", last: "Castellano", email: "rob.castellano@example.com", phone: "+44 7700 900911", country: "GB", optIn: true },
  { key: "nina", first: "Nina", last: "Petrova", email: "nina.petrova@example.com", phone: "+44 7700 901022", country: "GB", optIn: false },
  { key: "greg", first: "Greg", last: "Tanner", email: "greg.tanner@example.com", phone: "+44 7700 901133", country: "GB", optIn: true },
  // One-time guests — most people book a cottage once, and the repeat-guest
  // metric is only interesting if that's reflected.
  { key: "hannah", first: "Hannah", last: "Wills", email: "hannah.wills@example.com", phone: "+44 7700 901244", country: "GB", optIn: false },
  { key: "oliver", first: "Oliver", last: "Grant", email: "oliver.grant@example.com", phone: "+44 7700 901355", country: "GB", optIn: true },
  { key: "freya", first: "Freya", last: "Lindholm", email: "freya.lindholm@example.com", phone: "+46 70 987 6543", country: "SE", optIn: false },
  { key: "callum", first: "Callum", last: "Reid", email: "callum.reid@example.com", phone: "+44 7700 901466", country: "GB", optIn: true },
  { key: "sofia", first: "Sofia", last: "Marchetti", email: "sofia.marchetti@example.com", phone: "+39 340 123 4567", country: "IT", optIn: false },
  { key: "lucy", first: "Lucy", last: "Bennett", email: "lucy.bennett@example.com", phone: "+44 7700 901577", country: "GB", optIn: true },
  { key: "adam", first: "Adam", last: "Cross", email: "adam.cross@example.com", phone: "+44 7700 901688", country: "GB", optIn: false },
  { key: "maya", first: "Maya", last: "Osei", email: "maya.osei@example.com", phone: "+44 7700 901799", country: "GB", optIn: true },
];

// ---------------------------------------------------------------------------
// Bookings
// ---------------------------------------------------------------------------

type Status = "completed" | "confirmed" | "cancelled" | "pending";

interface BookingSpec {
  guest: string;
  in: string;
  out: string;
  adults: number;
  children?: number;
  status: Status;
  type?: "instant" | "request";
  bookedDaysAhead: number;
  message?: string;
  cancelReason?: string;
  refund?: number;
}

const BOOKINGS: BookingSpec[] = [
  // --- last twelve months of completed stays ---
  { guest: "emma", in: "2025-09-05", out: "2025-09-08", adults: 2, status: "completed", bookedDaysAhead: 34 },
  { guest: "hannah", in: "2025-09-19", out: "2025-09-21", adults: 2, status: "completed", bookedDaysAhead: 21 },
  { guest: "priya", in: "2025-10-03", out: "2025-10-10", adults: 4, status: "completed", bookedDaysAhead: 62, message: "Celebrating my parents' anniversary — any chance of a late check-out on the Friday?" },
  { guest: "tom", in: "2025-10-24", out: "2025-10-27", adults: 2, children: 2, status: "completed", bookedDaysAhead: 40 },
  { guest: "oliver", in: "2025-11-07", out: "2025-11-10", adults: 2, status: "completed", bookedDaysAhead: 18 },
  { guest: "freya", in: "2025-11-21", out: "2025-11-23", adults: 2, status: "completed", bookedDaysAhead: 12 },
  { guest: "aoife", in: "2025-12-19", out: "2025-12-27", adults: 4, children: 2, status: "completed", bookedDaysAhead: 96, message: "Christmas with the whole family. Is the log burner ready to use?" },
  { guest: "callum", in: "2026-01-16", out: "2026-01-18", adults: 2, status: "completed", bookedDaysAhead: 9 },
  { guest: "chloe", in: "2026-02-13", out: "2026-02-16", adults: 2, status: "completed", bookedDaysAhead: 30 },
  { guest: "sofia", in: "2026-02-27", out: "2026-03-02", adults: 3, status: "completed", bookedDaysAhead: 25 },
  { guest: "isabelle", in: "2026-03-13", out: "2026-03-16", adults: 2, status: "completed", bookedDaysAhead: 47 },
  { guest: "rob", in: "2026-03-27", out: "2026-03-30", adults: 4, status: "completed", bookedDaysAhead: 33 },
  { guest: "lucy", in: "2026-04-10", out: "2026-04-13", adults: 2, children: 1, status: "completed", bookedDaysAhead: 27 },
  { guest: "adam", in: "2026-04-24", out: "2026-04-27", adults: 2, status: "completed", bookedDaysAhead: 15 },
  { guest: "emma", in: "2026-05-08", out: "2026-05-11", adults: 2, status: "completed", bookedDaysAhead: 51 },
  { guest: "james", in: "2026-05-22", out: "2026-05-26", adults: 4, status: "completed", bookedDaysAhead: 38 },
  { guest: "priya", in: "2026-06-05", out: "2026-06-08", adults: 2, status: "completed", bookedDaysAhead: 44 },
  { guest: "tom", in: "2026-06-19", out: "2026-06-26", adults: 4, children: 2, status: "completed", bookedDaysAhead: 71 },
  { guest: "sarah", in: "2026-07-03", out: "2026-07-10", adults: 4, status: "completed", bookedDaysAhead: 88 },
  { guest: "daniel", in: "2026-07-17", out: "2026-07-24", adults: 2, children: 2, status: "completed", bookedDaysAhead: 65 },
  { guest: "aoife", in: "2026-07-31", out: "2026-08-07", adults: 4, children: 2, status: "completed", bookedDaysAhead: 110 },
  { guest: "marcus", in: "2026-08-08", out: "2026-08-15", adults: 4, status: "completed", bookedDaysAhead: 57 },
  { guest: "chloe", in: "2026-08-16", out: "2026-08-21", adults: 2, children: 1, status: "completed", bookedDaysAhead: 42 },

  // --- a stay mid-flight and one arriving today, so the dashboard's
  //     arrivals / check-outs tiles have something in them ---
  { guest: "ben", in: "2026-08-21", out: "2026-08-23", adults: 2, status: "confirmed", bookedDaysAhead: 11 },
  { guest: "isabelle", in: "2026-08-23", out: "2026-08-26", adults: 2, status: "confirmed", bookedDaysAhead: 19 },

  // --- cancellations, so the finance page shows refunds ---
  { guest: "ben", in: "2026-01-30", out: "2026-02-02", adults: 2, status: "cancelled", bookedDaysAhead: 30, cancelReason: "Change of plans — family illness.", refund: 1 },
  { guest: "maya", in: "2026-06-12", out: "2026-06-15", adults: 2, status: "cancelled", bookedDaysAhead: 40, cancelReason: "Cancelled inside the 14-day window.", refund: 0.5 },

  // --- upcoming, already paid ---
  { guest: "nina", in: "2026-09-04", out: "2026-09-07", adults: 2, status: "confirmed", bookedDaysAhead: 26 },
  { guest: "greg", in: "2026-09-25", out: "2026-09-29", adults: 2, children: 2, status: "confirmed", bookedDaysAhead: 33 },
  { guest: "emma", in: "2026-10-09", out: "2026-10-13", adults: 2, status: "confirmed", bookedDaysAhead: 45, message: "Third time back! Same cot for the little one if that's still possible?" },
  { guest: "rob", in: "2026-10-23", out: "2026-10-26", adults: 4, status: "confirmed", bookedDaysAhead: 30 },

  // --- a live request-to-book waiting on the host ---
  { guest: "chloe", in: "2026-09-18", out: "2026-09-21", adults: 2, status: "pending", type: "request", bookedDaysAhead: 3, message: "Hoping to squeeze in a long weekend before the school term properly kicks off. We stayed in August and loved it." },
];

// ---------------------------------------------------------------------------
// Reviews
// ---------------------------------------------------------------------------

interface ReviewSpec {
  guest: string;
  in: string;
  overall: number;
  cleanliness: number;
  accuracy: number;
  communication: number;
  location: number;
  value: number;
  text: string;
  hostResponse?: string;
}

const REVIEWS: ReviewSpec[] = [
  { guest: "emma", in: "2025-09-05", overall: 5, cleanliness: 5, accuracy: 5, communication: 5, location: 5, value: 4.5,
    text: "We came for three nights and immediately wished we'd booked a week. The cottage is even better than the photos — spotless, warm, and the view from the front room is worth the trip on its own. Ten minutes down the bank and you're at the harbour.",
    hostResponse: "Thank you Emma — you were wonderfully easy guests. The kettle's always on if you fancy coming back." },
  { guest: "priya", in: "2025-10-03", overall: 5, cleanliness: 5, accuracy: 5, communication: 5, location: 5, value: 5,
    text: "Booked this for my parents' anniversary and it was perfect. Plenty of room for four of us, the kitchen is properly equipped, and the late check-out on the last day was a lovely touch. The clifftop walk towards Port Mulgrave is stunning.",
    hostResponse: "So glad the anniversary went well — and thank you for leaving it so tidy." },
  { guest: "tom", in: "2025-10-24", overall: 4.5, cleanliness: 5, accuracy: 4.5, communication: 5, location: 5, value: 4,
    text: "Great half-term base with two young children. Garden is safely enclosed, which mattered to us. Parking is at the top of the village rather than at the door, so pack light — but that's Staithes, not the cottage." },
  { guest: "aoife", in: "2025-12-19", overall: 5, cleanliness: 5, accuracy: 5, communication: 5, location: 4.5, value: 5,
    text: "Christmas here was magic. Log burner lit within ten minutes of arriving, six of us round the table on Christmas Day, and a frosty walk on the beach on Boxing Day. Everything you need was already there, right down to a corkscrew that works.",
    hostResponse: "A proper Staithes Christmas. Delighted it worked for the whole family — see you next year hopefully." },
  { guest: "chloe", in: "2026-02-13", overall: 5, cleanliness: 5, accuracy: 5, communication: 5, location: 5, value: 4.5,
    text: "A wild, stormy February weekend and the cottage was a fortress — cosy, quiet and warm. Booking took about two minutes and the check-in instructions arrived exactly when they said they would." },
  { guest: "isabelle", in: "2026-03-13", overall: 4.5, cleanliness: 4.5, accuracy: 5, communication: 5, location: 5, value: 4.5,
    text: "Un weekend parfait. The village is tiny and beautiful, the cottage is comfortable and full of light, and the host answered every message within the hour. We will come back in summer." },
  { guest: "rob", in: "2026-03-27", overall: 5, cleanliness: 5, accuracy: 5, communication: 4.5, location: 5, value: 5,
    text: "Four of us, three nights, zero complaints. Beds are genuinely comfortable — not always a given in an old cottage. The pub is a two-minute stagger away." },
  { guest: "emma", in: "2026-05-08", overall: 5, cleanliness: 5, accuracy: 5, communication: 5, location: 5, value: 5,
    text: "Second stay, still faultless. Booked directly again which is refreshing — no fees stacked on top, and you can message the owner rather than a call centre.",
    hostResponse: "Always a pleasure Emma. Thanks for coming back to us direct." },
  { guest: "priya", in: "2026-06-05", overall: 4.5, cleanliness: 4.5, accuracy: 4.5, communication: 5, location: 5, value: 4.5,
    text: "Lovely June break. Only note is that the second bedroom gets the morning sun very early — a blackout blind would be a nice addition. Everything else was excellent." },
  { guest: "tom", in: "2026-06-19", overall: 5, cleanliness: 5, accuracy: 5, communication: 5, location: 5, value: 4.5,
    text: "A full week and the children never got bored — rockpools, the beach, the little museum, and the garden for the evenings. The weekly discount made it noticeably cheaper than the listing sites too.",
    hostResponse: "That's exactly why we moved to booking direct. Glad the rockpools delivered." },
  { guest: "daniel", in: "2026-07-17", overall: 5, cleanliness: 5, accuracy: 5, communication: 5, location: 5, value: 4,
    text: "Peak-summer prices, but you're getting a whole cottage in the prettiest village on the Yorkshire coast. Immaculate on arrival and the pre-arrival email had everything we needed." },
  { guest: "marcus", in: "2026-08-08", overall: 4.5, cleanliness: 5, accuracy: 4.5, communication: 4.5, location: 5, value: 4,
    text: "Excellent week. Steep walk back up from the harbour with shopping is the only downside, and that's the price of admission for somewhere this pretty." },
  { guest: "aoife", in: "2026-07-31", overall: 5, cleanliness: 5, accuracy: 5, communication: 5, location: 5, value: 5,
    text: "Our second stay this year. Booking, paying and messaging all in one place makes it genuinely easy, and the cottage never disappoints." },
];

// ---------------------------------------------------------------------------
// Seed
// ---------------------------------------------------------------------------

async function ensureAuthUser(email: string, password: string) {
  const { data: list } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const existing = list?.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
  if (existing) {
    await supabase.auth.admin.updateUserById(existing.id, { password, email_confirm: true });
    return existing.id;
  }
  const { data, error } = await supabase.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw error;
  return data.user!.id;
}

async function main() {
  const property = await prisma.property.findUniqueOrThrow({ where: { slug: "staithes" } });
  const today = todayUTC();

  console.log("Clearing existing transactional data…");
  await prisma.automatedEmailLog.deleteMany();
  await prisma.review.deleteMany();
  await prisma.message.deleteMany();
  await prisma.messageThread.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.bookingPriceSnapshot.deleteMany();
  await prisma.booking.deleteMany();
  await prisma.blockedDate.deleteMany();
  await prisma.guest.deleteMany();

  // --- accounts -----------------------------------------------------------
  if (!HOST_EMAIL) throw new Error("HOST_EMAILS is not set in .env.local");
  const hostId = await ensureAuthUser(HOST_EMAIL, DEMO_PASSWORD);
  console.log(`✓ Host account ready: ${HOST_EMAIL} / ${DEMO_PASSWORD}`);

  // --- guests -------------------------------------------------------------
  const guestIds: Record<string, string> = {};
  let guestIndex = 0;
  for (const g of GUESTS) {
    const id = g.authUser ? await ensureAuthUser(g.email, DEMO_PASSWORD) : crypto.randomUUID();
    guestIds[g.key] = id;
    // Accounts were created over the course of the year, not all at once.
    const joined = addDays(today, -(360 - guestIndex * 15));
    await prisma.guest.create({
      data: {
        id,
        email: g.email,
        firstName: g.first,
        lastName: g.last,
        phone: g.phone,
        country: g.country,
        isVerified: true,
        notesInternal: g.notes ?? null,
        marketingOptIn: g.optIn,
        marketingOptInAt: g.optIn ? addDays(joined, 1) : null,
        unsubscribeToken: g.optIn ? crypto.randomUUID().replace(/-/g, "") : null,
        createdAt: joined,
        lastLoginAt: addDays(today, -((guestIndex * 5) % 60) - 1),
      },
    });
    guestIndex += 1;
  }
  const demoGuest = GUESTS.find((g) => g.authUser)!;
  console.log(`✓ ${GUESTS.length} guests (demo login: ${demoGuest.email} / ${DEMO_PASSWORD})`);

  // --- bookings -----------------------------------------------------------
  const bookingIds = new Map<string, string>();
  const key = (g: string, i: string) => `${g}:${i}`;

  for (const b of BOOKINGS) {
    const checkIn = d(b.in);
    const checkOut = d(b.out);
    // Lead time is measured back from check-in, but a booking obviously
    // cannot have been made in the future — for stays that are still
    // ahead of us, pull the creation date back to a plausible recent day.
    const leadFrom = new Date(checkIn.getTime() - b.bookedDaysAhead * 86_400_000);
    const createdAt = at(
      (leadFrom >= today
        ? addDays(today, -((b.bookedDaysAhead % 25) + 2))
        : leadFrom
      ).toISOString().slice(0, 10),
      11,
    );

    const priced = await calculatePrice({
      propertyId: property.id,
      checkIn,
      checkOut,
      numAdults: b.adults,
      numChildren: b.children ?? 0,
      now: createdAt,
    });
    if (!priced.ok) throw new Error(`Pricing failed for ${b.guest} ${b.in}: ${priced.error}`);
    const p = priced.breakdown;

    const confirmedAt = b.status === "pending" ? null : createdAt;
    const completedAt = b.status === "completed" ? at(b.out, 11) : null;
    const cancelledAt = b.status === "cancelled" ? at(
      new Date(checkIn.getTime() - 10 * 86_400_000).toISOString().slice(0, 10), 14,
    ) : null;

    const booking = await prisma.booking.create({
      data: {
        propertyId: property.id,
        guestId: guestIds[b.guest],
        checkIn,
        checkOut,
        numGuestsAdults: b.adults,
        numGuestsChildren: b.children ?? 0,
        status: b.status,
        bookingType: b.type ?? "instant",
        totalPrice: new Decimal(p.total),
        currency: p.currency,
        cancellationPolicySnapshot: {
          policy: property.cancellationPolicy,
          capturedAt: createdAt.toISOString(),
          checkInTime: property.checkInTime,
          checkOutTime: property.checkOutTime,
        },
        guestMessage: b.message ?? null,
        checkInInstructionsSent: b.status === "completed",
        cancellationReason: b.cancelReason ?? null,
        createdAt,
        confirmedAt,
        completedAt,
        cancelledAt,
        approvedAt: null,
        priceSnapshot: {
          create: {
            nightlyRates: p.nightlyRates as unknown as Prisma.InputJsonValue,
            numNights: p.numNights,
            subtotalAccommodation: new Decimal(p.subtotalAccommodation),
            cleaningFee: new Decimal(p.cleaningFee),
            extraGuestFeeTotal: new Decimal(p.extraGuestFeeTotal),
            discountAmount: new Decimal(p.discountAmount),
            discountDescription: p.discountDescription,
            serviceFee: new Decimal(p.serviceFee),
            taxAmount: new Decimal(p.taxAmount),
            taxDescription: p.taxDescription,
            total: new Decimal(p.total),
            currency: p.currency,
            createdAt,
          },
        },
      },
    });
    bookingIds.set(key(b.guest, b.in), booking.id);

    // Payments — the pending request has not been charged yet.
    if (b.status !== "pending") {
      await prisma.payment.create({
        data: {
          bookingId: booking.id,
          type: "charge",
          amount: new Decimal(p.total),
          currency: p.currency,
          status: b.status === "cancelled" && b.refund === 1 ? "refunded" : "completed",
          gateway: "stripe",
          gatewayTransactionId: `pi_demo_${booking.id.slice(0, 12).replace(/-/g, "")}`,
          cardLastFour: "4242",
          cardBrand: "visa",
          createdAt,
          completedAt: createdAt,
        },
      });
      if (b.refund && cancelledAt) {
        await prisma.payment.create({
          data: {
            bookingId: booking.id,
            type: "refund",
            amount: new Decimal(p.total).mul(b.refund).toDecimalPlaces(2),
            currency: p.currency,
            status: "completed",
            gateway: "stripe",
            gatewayTransactionId: `re_demo_${booking.id.slice(0, 12).replace(/-/g, "")}`,
            refundReason: b.cancelReason ?? null,
            createdAt: cancelledAt,
            completedAt: cancelledAt,
          },
        });
      }
    }

    // A believable email trail on completed stays.
    if (b.status === "completed") {
      const trail: Array<[string, string, Date]> = [
        ["confirmation", "Your booking at The Staithes Cottage is confirmed", createdAt],
        ["pre_arrival", "Getting ready for your stay", at(new Date(checkIn.getTime() - 7 * 86_400_000).toISOString().slice(0, 10), 9)],
        ["check_in_reminder", "Check-in details for tomorrow", at(new Date(checkIn.getTime() - 1 * 86_400_000).toISOString().slice(0, 10), 9)],
        ["check_out_reminder", "Check-out is tomorrow at 10:00", at(new Date(checkOut.getTime() - 1 * 86_400_000).toISOString().slice(0, 10), 9)],
        ["post_stay_thanks", "Thank you for staying with us", at(b.out, 12)],
        ["review_request", "How was your stay?", at(new Date(checkOut.getTime() + 2 * 86_400_000).toISOString().slice(0, 10), 10)],
      ];
      for (const [type, subject, sentAt] of trail) {
        await prisma.automatedEmailLog.create({
          data: {
            bookingId: booking.id,
            emailType: type as never,
            recipientEmail: GUESTS.find((g) => g.key === b.guest)!.email,
            subject,
            status: "delivered",
            sentAt,
            deliveredAt: sentAt,
          },
        });
      }
    }
  }
  console.log(`✓ ${BOOKINGS.length} bookings with price snapshots, payments and email logs`);

  // --- reviews ------------------------------------------------------------
  for (const r of REVIEWS) {
    const bookingId = bookingIds.get(key(r.guest, r.in));
    if (!bookingId) throw new Error(`No booking for review ${r.guest} ${r.in}`);
    const booking = await prisma.booking.findUniqueOrThrow({ where: { id: bookingId } });
    const created = at(new Date(booking.checkOut.getTime() + 3 * 86_400_000).toISOString().slice(0, 10), 19);
    await prisma.review.create({
      data: {
        bookingId,
        guestId: guestIds[r.guest],
        propertyId: property.id,
        ratingOverall: new Decimal(r.overall),
        ratingCleanliness: new Decimal(r.cleanliness),
        ratingAccuracy: new Decimal(r.accuracy),
        ratingCommunication: new Decimal(r.communication),
        ratingLocation: new Decimal(r.location),
        ratingValue: new Decimal(r.value),
        reviewText: r.text,
        hostResponse: r.hostResponse ?? null,
        hostRespondedAt: r.hostResponse ? at(new Date(created.getTime() + 86_400_000).toISOString().slice(0, 10), 8) : null,
        isPublished: true,
        createdAt: created,
      },
    });
  }
  console.log(`✓ ${REVIEWS.length} published reviews`);

  // --- message threads ----------------------------------------------------
  async function thread(
    guestKey: string,
    bookingKey: string | null,
    subject: string,
    msgs: Array<[sender: "guest" | "host", content: string, iso: string, read: boolean]>,
  ) {
    const bookingId = bookingKey ? bookingIds.get(bookingKey)! : null;
    const last = msgs[msgs.length - 1];
    const t = await prisma.messageThread.create({
      data: {
        propertyId: property.id,
        guestId: guestIds[guestKey],
        bookingId,
        subject,
        status: "open",
        createdAt: at(msgs[0][2], 9),
        // Thread lists sort and label by updatedAt — without this every
        // thread would read "just now" straight after seeding.
        updatedAt: at(last[2], last[0] === "guest" ? 9 : 14),
      },
    });
    for (const [sender, content, iso, read] of msgs) {
      await prisma.message.create({
        data: {
          threadId: t.id,
          senderType: sender,
          senderId: sender === "guest" ? guestIds[guestKey] : null,
          content,
          isRead: read,
          createdAt: at(iso, sender === "guest" ? 9 : 14),
        },
      });
    }
  }

  await thread("chloe", key("chloe", "2026-09-18"), "September long weekend", [
    ["guest", "Hello again! We've just put in a request for 18–21 September. We stayed in August and the children haven't stopped talking about the rockpools. Is there any flexibility on a late check-out on the Monday?", "2026-08-22", false],
  ]);

  await thread("nina", key("nina", "2026-09-04"), "Parking and arrival", [
    ["guest", "Looking forward to September. Where exactly should we park, and how far is the walk down to the cottage with bags?", "2026-08-14", true],
    ["host", "Hi Nina — the village car park is at the top of the bank, about a five minute walk down. There's a drop-off point right by the cottage for bags first, then park up. I'll send full directions a week before you arrive.", "2026-08-14", true],
    ["guest", "Perfect, thank you. That's exactly what we needed to know.", "2026-08-15", true],
  ]);

  await thread("emma", key("emma", "2026-10-09"), "Cot for October stay", [
    ["guest", "Hi! Booked again for October — could we have the travel cot in the second bedroom like last time?", "2026-08-18", true],
    ["host", "Of course Emma, it's yours. I'll have it made up before you arrive, and I've left the stair gate up too. Looking forward to having you back.", "2026-08-19", false],
  ]);

  await thread("greg", key("greg", "2026-09-25"), "Dogs", [
    ["guest", "Is there any chance you'd consider a small, very well behaved spaniel for our September stay?", "2026-08-20", true],
    ["host", "We do consider dogs on request — a spaniel is absolutely fine. There's an outdoor tap by the back door for sandy paws.", "2026-08-20", true],
  ]);
  console.log("✓ 4 message threads (2 unread — one for the host, one for the guest)");

  // --- a blocked window ---------------------------------------------------
  await prisma.blockedDate.create({
    data: {
      propertyId: property.id,
      dateStart: d("2026-11-02"),
      dateEnd: d("2026-11-06"),
      reason: "Boiler service and repaint of the back bedroom",
    },
  });
  console.log("✓ 1 blocked maintenance window (2–6 November)");

  const revenue = await prisma.booking.aggregate({
    where: { status: { in: ["confirmed", "completed"] } },
    _sum: { totalPrice: true },
  });
  console.log(`\nDone. Booked revenue on the books: £${revenue._sum.totalPrice?.toFixed(2)}`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
