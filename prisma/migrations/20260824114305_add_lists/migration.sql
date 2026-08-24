/*
  Warnings:

  - You are about to drop the column `groupId` on the `ListItem` table. All the data in the column will be lost.
  - Added the required column `listId` to the `ListItem` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "ListItem" DROP CONSTRAINT "ListItem_groupId_fkey";

-- DropIndex
DROP INDEX "ListItem_groupId_idx";

-- AlterTable
ALTER TABLE "ListItem" DROP COLUMN "groupId",
ADD COLUMN     "listId" TEXT NOT NULL;

-- CreateTable
CREATE TABLE "List" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "List_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "List_groupId_idx" ON "List"("groupId");

-- CreateIndex
CREATE INDEX "ListItem_listId_idx" ON "ListItem"("listId");

-- AddForeignKey
ALTER TABLE "List" ADD CONSTRAINT "List_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ListItem" ADD CONSTRAINT "ListItem_listId_fkey" FOREIGN KEY ("listId") REFERENCES "List"("id") ON DELETE CASCADE ON UPDATE CASCADE;
