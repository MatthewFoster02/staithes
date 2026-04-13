-- CreateEnum
CREATE TYPE "AutomatedEmailType" AS ENUM ('confirmation', 'pre_arrival', 'check_in_reminder', 'mid_stay', 'check_out_reminder', 'post_stay_thanks', 'review_request');

-- CreateEnum
CREATE TYPE "AutomatedEmailStatus" AS ENUM ('sent', 'delivered', 'bounced', 'failed');

-- CreateTable
CREATE TABLE "automated_email_logs" (
    "id" UUID NOT NULL,
    "booking_id" UUID NOT NULL,
    "email_type" "AutomatedEmailType" NOT NULL,
    "recipient_email" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "status" "AutomatedEmailStatus" NOT NULL DEFAULT 'sent',
    "sent_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "delivered_at" TIMESTAMP(3),

    CONSTRAINT "automated_email_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "automated_email_logs_sent_at_idx" ON "automated_email_logs"("sent_at");

-- CreateIndex
CREATE UNIQUE INDEX "automated_email_logs_booking_id_email_type_key" ON "automated_email_logs"("booking_id", "email_type");

-- AddForeignKey
ALTER TABLE "automated_email_logs" ADD CONSTRAINT "automated_email_logs_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
