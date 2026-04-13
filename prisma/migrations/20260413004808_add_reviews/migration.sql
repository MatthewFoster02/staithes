-- CreateTable
CREATE TABLE "reviews" (
    "id" UUID NOT NULL,
    "booking_id" UUID NOT NULL,
    "guest_id" UUID NOT NULL,
    "property_id" UUID NOT NULL,
    "rating_overall" DECIMAL(2,1) NOT NULL,
    "rating_cleanliness" DECIMAL(2,1) NOT NULL,
    "rating_accuracy" DECIMAL(2,1) NOT NULL,
    "rating_communication" DECIMAL(2,1) NOT NULL,
    "rating_location" DECIMAL(2,1) NOT NULL,
    "rating_value" DECIMAL(2,1) NOT NULL,
    "review_text" TEXT,
    "host_response" TEXT,
    "host_responded_at" TIMESTAMP(3),
    "is_published" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reviews_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "reviews_booking_id_key" ON "reviews"("booking_id");

-- CreateIndex
CREATE INDEX "reviews_property_id_is_published_created_at_idx" ON "reviews"("property_id", "is_published", "created_at");

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_guest_id_fkey" FOREIGN KEY ("guest_id") REFERENCES "guests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;
