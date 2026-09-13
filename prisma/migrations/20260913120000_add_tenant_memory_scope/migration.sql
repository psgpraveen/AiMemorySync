-- AlterTable: Add tenantId column to memories as nullable
ALTER TABLE "memories" ADD COLUMN "tenantId" TEXT;

-- Backfill: Populate tenantId from parent Project
UPDATE "memories" m
SET "tenantId" = p."tenantId"
FROM "projects" p
WHERE m."projectId" = p.id;

-- Fallback for safety: Ensure no NULL tenantId remains
UPDATE "memories"
SET "tenantId" = '00000000-0000-0000-0000-000000000001'
WHERE "tenantId" IS NULL;

-- AlterTable: Enforce NOT NULL on tenantId
ALTER TABLE "memories" ALTER COLUMN "tenantId" SET NOT NULL;

-- AlterTable: Make projectId optional (nullable)
ALTER TABLE "memories" ALTER COLUMN "projectId" DROP NOT NULL;

-- AddForeignKey: Link memories to tenants
ALTER TABLE "memories" ADD CONSTRAINT "memories_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateIndex: Add tenant-scoped indexes
CREATE INDEX "memories_tenantId_status_idx" ON "memories"("tenantId", "status");
CREATE INDEX "memories_tenantId_projectId_status_idx" ON "memories"("tenantId", "projectId", "status");
CREATE INDEX "memories_tenantId_contentHash_idx" ON "memories"("tenantId", "contentHash");
