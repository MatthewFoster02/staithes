import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
loadEnv({ path: ".env" });

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../lib/generated/prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  // --- Site configuration (singleton) ---
  const siteConfig = await prisma.siteConfiguration.findFirst();
  if (!siteConfig) {
    await prisma.siteConfiguration.create({
      data: {
        siteName: "Staithes",
        tagline: "A peaceful coastal escape",
        contactEmail: "hello@example.com",
        primaryColour: "#0f172a",
        accentColour: "#0ea5e9",
        seoTitle: "Staithes — coastal holiday rental",
        seoDescription:
          "Book a stay at our coastal property — direct, simple, and friendly.",
        timezone: "Europe/London",
      },
    });
    console.log("✓ Created SiteConfiguration");
  } else {
    console.log("• SiteConfiguration already exists, skipping");
  }

  // --- Amenities (reference list) ---
  const amenities = [
    { name: "Free WiFi", icon: "wifi", category: "essentials" as const, sortOrder: 10 },
    { name: "Free parking on premises", icon: "parking-circle", category: "essentials" as const, sortOrder: 20 },
    { name: "Kitchen", icon: "utensils", category: "essentials" as const, sortOrder: 30 },
    { name: "Washing machine", icon: "washing-machine", category: "essentials" as const, sortOrder: 40 },
    { name: "Dryer", icon: "wind", category: "essentials" as const, sortOrder: 50 },
    { name: "Heating", icon: "thermometer-sun", category: "essentials" as const, sortOrder: 60 },
    { name: "TV", icon: "tv", category: "features" as const, sortOrder: 70 },
    { name: "Coffee machine", icon: "coffee", category: "features" as const, sortOrder: 80 },
    { name: "Dishwasher", icon: "utensils-crossed", category: "features" as const, sortOrder: 90 },
    { name: "Garden", icon: "trees", category: "outdoor" as const, sortOrder: 100 },
    { name: "Patio or balcony", icon: "sun", category: "outdoor" as const, sortOrder: 110 },
    { name: "Smoke alarm", icon: "bell-ring", category: "safety" as const, sortOrder: 120 },
    { name: "Carbon monoxide alarm", icon: "shield-alert", category: "safety" as const, sortOrder: 130 },
    { name: "First aid kit", icon: "first-aid", category: "safety" as const, sortOrder: 140 },
    { name: "Step-free entrance", icon: "accessibility", category: "accessibility" as const, sortOrder: 150 },
  ];

  for (const amenity of amenities) {
    await prisma.amenity.upsert({
      where: { name: amenity.name },
      update: amenity,
      create: amenity,
    });
  }
  console.log(`✓ Upserted ${amenities.length} amenities`);

  // --- Property (placeholder) ---
  const existing = await prisma.property.findUnique({ where: { slug: "staithes" } });
  if (!existing) {
    const property = await prisma.property.create({
      data: {
        name: "The Staithes Cottage",
        slug: "staithes",
        description:
          "A charming coastal cottage in a quiet fishing village, with sea views, a cosy log burner, and easy access to clifftop walks. Placeholder text — to be replaced with the real property description.",
        shortDescription: "Coastal cottage with sea views",
        propertyType: "cottage",
        addressFull: "1 Example Lane, Staithes, North Yorkshire, TS13 5AA",
        addressApprox: "Staithes, North Yorkshire",
        latitude: 54.5582,
        longitude: -0.7892,
        maxGuests: 6,
        bedrooms: 3,
        beds: 4,
        bathrooms: 2,
        checkInTime: "16:00",
        checkOutTime: "10:00",
        minStayDefault: 2,
        maxStay: 28,
        baseNightlyRate: 145.0,
        cleaningFee: 60.0,
        extraGuestFee: 15.0,
        baseGuestCount: 4,
        currency: "GBP",
        houseRules:
          "No smoking. No parties or events. Pets considered on request. Quiet hours 22:00–08:00.",
        cancellationPolicy: "moderate",
        status: "active",
      },
    });

    // Link a sensible default set of amenities to the property
    const linked = await prisma.amenity.findMany({
      where: {
        name: {
          in: [
            "Free WiFi",
            "Free parking on premises",
            "Kitchen",
            "Washing machine",
            "Heating",
            "TV",
            "Coffee machine",
            "Garden",
            "Smoke alarm",
            "Carbon monoxide alarm",
          ],
        },
      },
    });
    await prisma.propertyAmenity.createMany({
      data: linked.map((a) => ({ propertyId: property.id, amenityId: a.id })),
      skipDuplicates: true,
    });
    console.log(`✓ Created Property "${property.name}" with ${linked.length} amenities`);
  } else {
    console.log("• Property already exists, skipping");
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
