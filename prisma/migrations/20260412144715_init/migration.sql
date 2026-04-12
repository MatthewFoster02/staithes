-- CreateEnum
CREATE TYPE "PropertyType" AS ENUM ('house', 'flat', 'cottage', 'cabin', 'other');

-- CreateEnum
CREATE TYPE "PropertyStatus" AS ENUM ('active', 'paused', 'hidden');

-- CreateEnum
CREATE TYPE "CancellationPolicy" AS ENUM ('flexible', 'moderate', 'strict');

-- CreateEnum
CREATE TYPE "PhotoCategory" AS ENUM ('exterior', 'living', 'bedroom', 'kitchen', 'bathroom', 'garden', 'other');

-- CreateEnum
CREATE TYPE "AmenityCategory" AS ENUM ('essentials', 'features', 'safety', 'accessibility', 'outdoor');

-- CreateTable
CREATE TABLE "properties" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "short_description" TEXT,
    "property_type" "PropertyType" NOT NULL,
    "address_full" TEXT NOT NULL,
    "address_approx" TEXT NOT NULL,
    "latitude" DECIMAL(10,7) NOT NULL,
    "longitude" DECIMAL(10,7) NOT NULL,
    "max_guests" INTEGER NOT NULL,
    "bedrooms" INTEGER NOT NULL,
    "beds" INTEGER NOT NULL,
    "bathrooms" DECIMAL(3,1) NOT NULL,
    "check_in_time" TEXT NOT NULL,
    "check_out_time" TEXT NOT NULL,
    "min_stay_default" INTEGER NOT NULL DEFAULT 1,
    "max_stay" INTEGER,
    "base_nightly_rate" DECIMAL(10,2) NOT NULL,
    "cleaning_fee" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "extra_guest_fee" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "base_guest_count" INTEGER NOT NULL,
    "currency" CHAR(3) NOT NULL DEFAULT 'GBP',
    "house_rules" TEXT,
    "cancellation_policy" "CancellationPolicy" NOT NULL DEFAULT 'moderate',
    "status" "PropertyStatus" NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "properties_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "property_photos" (
    "id" UUID NOT NULL,
    "property_id" UUID NOT NULL,
    "url" TEXT NOT NULL,
    "thumbnail_url" TEXT,
    "caption" TEXT,
    "category" "PhotoCategory" NOT NULL DEFAULT 'other',
    "alt_text" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "property_photos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "amenities" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "icon" TEXT NOT NULL,
    "category" "AmenityCategory" NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "amenities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "property_amenities" (
    "property_id" UUID NOT NULL,
    "amenity_id" UUID NOT NULL,
    "notes" TEXT,

    CONSTRAINT "property_amenities_pkey" PRIMARY KEY ("property_id","amenity_id")
);

-- CreateTable
CREATE TABLE "site_configuration" (
    "id" UUID NOT NULL,
    "site_name" TEXT NOT NULL,
    "tagline" TEXT,
    "logo_url" TEXT,
    "primary_colour" TEXT,
    "accent_colour" TEXT,
    "contact_email" TEXT NOT NULL,
    "contact_phone" TEXT,
    "sender_email" TEXT,
    "sender_name" TEXT,
    "seo_title" TEXT,
    "seo_description" TEXT,
    "og_image_url" TEXT,
    "analytics_id" TEXT,
    "timezone" TEXT NOT NULL DEFAULT 'Europe/London',
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "site_configuration_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "properties_slug_key" ON "properties"("slug");

-- CreateIndex
CREATE INDEX "property_photos_property_id_sort_order_idx" ON "property_photos"("property_id", "sort_order");

-- CreateIndex
CREATE UNIQUE INDEX "amenities_name_key" ON "amenities"("name");

-- AddForeignKey
ALTER TABLE "property_photos" ADD CONSTRAINT "property_photos_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "property_amenities" ADD CONSTRAINT "property_amenities_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "property_amenities" ADD CONSTRAINT "property_amenities_amenity_id_fkey" FOREIGN KEY ("amenity_id") REFERENCES "amenities"("id") ON DELETE CASCADE ON UPDATE CASCADE;
