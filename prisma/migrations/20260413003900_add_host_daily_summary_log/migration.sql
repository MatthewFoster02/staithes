-- CreateTable
CREATE TABLE "host_daily_summary_logs" (
    "id" UUID NOT NULL,
    "date" DATE NOT NULL,
    "sent_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "host_daily_summary_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "host_daily_summary_logs_date_key" ON "host_daily_summary_logs"("date");
