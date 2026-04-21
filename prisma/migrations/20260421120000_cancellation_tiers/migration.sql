-- AlterTable
ALTER TABLE "properties"
ADD COLUMN "cancellation_tiers" JSONB NOT NULL DEFAULT '[]'::jsonb;

-- Backfill existing rows from the cancellation_policy preset so the
-- refund engine has something to work with until the host customises.
UPDATE "properties" SET "cancellation_tiers" = '[{"minDays":1,"percent":100}]'::jsonb
  WHERE "cancellation_policy" = 'flexible' AND "cancellation_tiers" = '[]'::jsonb;

UPDATE "properties" SET "cancellation_tiers" = '[{"minDays":5,"percent":100},{"minDays":3,"percent":50}]'::jsonb
  WHERE "cancellation_policy" = 'moderate' AND "cancellation_tiers" = '[]'::jsonb;

UPDATE "properties" SET "cancellation_tiers" = '[{"minDays":14,"percent":100},{"minDays":7,"percent":50}]'::jsonb
  WHERE "cancellation_policy" = 'strict' AND "cancellation_tiers" = '[]'::jsonb;
