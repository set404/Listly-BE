-- CreateEnum
CREATE TYPE "GroupType" AS ENUM ('STANDARD', 'WISHLIST');

-- AlterTable
ALTER TABLE "Group" ADD COLUMN     "shareToken" TEXT,
ADD COLUMN     "type" "GroupType" NOT NULL DEFAULT 'STANDARD';

-- CreateIndex
CREATE UNIQUE INDEX "Group_shareToken_key" ON "Group"("shareToken");

-- CreateIndex
CREATE INDEX "Group_type_idx" ON "Group"("type");
