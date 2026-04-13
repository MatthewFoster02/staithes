-- Add the `messages` table to the `supabase_realtime` publication so
-- the Realtime server emits postgres_changes events when a row is
-- inserted. The publication is created by Supabase on every project
-- and is the canonical mechanism for opting tables into Realtime.
--
-- Wrapped in a DO block because Prisma's shadow database (used to
-- validate migrations) is bare Postgres without the Supabase
-- publication, which would otherwise fail the migration. The check
-- is a no-op against the shadow DB and applies the ALTER on real
-- Supabase databases.
--
-- Privacy model: subscribers receive every insert that matches their
-- filter (we filter by thread_id on the client). Thread ids are
-- random UUIDs — practically unguessable — so the only people who
-- can subscribe to a given thread are the participants. Acceptable
-- for a single-property single-host site; revisit if we ever go
-- multi-property.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE messages;
  END IF;
END $$;