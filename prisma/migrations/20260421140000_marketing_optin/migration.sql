-- AlterTable
ALTER TABLE "guests"
ADD COLUMN "marketing_opt_in" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "marketing_opt_in_at" TIMESTAMP(3),
ADD COLUMN "unsubscribe_token" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "guests_unsubscribe_token_key" ON "guests"("unsubscribe_token");

-- CreateTable
CREATE TABLE "newsletter_sends" (
    "id" UUID NOT NULL,
    "subject" TEXT NOT NULL,
    "body_markdown" TEXT NOT NULL,
    "sent_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "recipient_count" INTEGER NOT NULL,
    "success_count" INTEGER NOT NULL,
    "failure_count" INTEGER NOT NULL,

    CONSTRAINT "newsletter_sends_pkey" PRIMARY KEY ("id")
);
