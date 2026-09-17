-- AlterTable
ALTER TABLE "Group" ADD COLUMN     "defaultCurrency" TEXT NOT NULL DEFAULT 'USD';

-- AlterTable
ALTER TABLE "ListItem" ADD COLUMN     "currency" TEXT;

-- Backfill: any item that already has a price (there's no UI for setting one
-- without a currency) gets its group's default currency, so existing priced
-- items don't end up looking currency-less.
UPDATE "ListItem" AS t
SET "currency" = 'USD'
WHERE t.price IS NOT NULL;
