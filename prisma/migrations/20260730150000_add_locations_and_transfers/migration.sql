-- A transfer moves stock between two locations, so a movement line can no longer
-- assume the location of its header: it carries its own, and a transfer writes
-- both of its halves as ordinary signed lines. Summing quantity_base per product
-- and location over confirmed movements is the stock on hand, with nothing to
-- interpret — the same property that made quantity_base signed in the first place.

-- AlterEnum
ALTER TYPE "MovementType" ADD VALUE 'TRANSFER';

-- AlterTable
ALTER TABLE "movements" ADD COLUMN "destination_location_id" UUID;

-- Added nullable, backfilled, and only then made NOT NULL: every line written so
-- far belongs to the location of its movement, and there is one of those.
ALTER TABLE "movement_items" ADD COLUMN "location_id" UUID;

UPDATE "movement_items" mi
SET "location_id" = m."location_id"
FROM "movements" m
WHERE m."id" = mi."movement_id";

ALTER TABLE "movement_items" ALTER COLUMN "location_id" SET NOT NULL;

-- DropIndex
DROP INDEX "movement_items_product_id_idx";

-- CreateIndex
CREATE INDEX "movement_items_product_id_location_id_idx" ON "movement_items"("product_id", "location_id");

-- AddForeignKey
ALTER TABLE "movements" ADD CONSTRAINT "movements_destination_location_id_fkey" FOREIGN KEY ("destination_location_id") REFERENCES "locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movement_items" ADD CONSTRAINT "movement_items_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
