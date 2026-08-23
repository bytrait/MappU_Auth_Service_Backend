-- Extend ReferenceCode with token lifecycle fields (label / startDate / expiryDate / updatedAt)
-- and add lookup indexes used by multi-token resolution.

ALTER TABLE "ReferenceCode"
  ADD COLUMN "label"      TEXT,
  ADD COLUMN "startDate"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "expiryDate" TIMESTAMP(3),
  ADD COLUMN "updatedAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateIndex
CREATE INDEX "ReferenceCode_targetId_type_isActive_idx"
  ON "ReferenceCode"("targetId", "type", "isActive");

-- CreateIndex
CREATE INDEX "ReferenceCode_targetId_type_expiryDate_idx"
  ON "ReferenceCode"("targetId", "type", "expiryDate");
