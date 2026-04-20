-- AlterTable
ALTER TABLE "bookings" ADD COLUMN     "approved_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "properties" ADD COLUMN     "instant_booking_enabled" BOOLEAN NOT NULL DEFAULT true;
