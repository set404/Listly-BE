-- AlterTable
ALTER TABLE "ListItem" ADD COLUMN     "order" INTEGER NOT NULL DEFAULT 0;

-- Backfill: preserve each list's current display order (by createdAt) as
-- its items' initial "order" value, so existing lists don't visually
-- reshuffle the moment ordering becomes explicit.
UPDATE "ListItem" AS t
SET "order" = sub.rn
FROM (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY "listId" ORDER BY "createdAt" ASC) - 1 AS rn
  FROM "ListItem"
) AS sub
WHERE t.id = sub.id;
