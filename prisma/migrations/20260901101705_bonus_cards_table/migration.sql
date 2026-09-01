/*
  Warnings:

  - You are about to drop the column `bonusImageUrl` on the `Group` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Group" DROP COLUMN "bonusImageUrl";

-- CreateTable
CREATE TABLE "BonusCard" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BonusCard_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BonusCard_groupId_idx" ON "BonusCard"("groupId");

-- AddForeignKey
ALTER TABLE "BonusCard" ADD CONSTRAINT "BonusCard_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;
