-- CreateEnum
CREATE TYPE "TenantRole" AS ENUM ('OWNER', 'ADMIN', 'MEMBER', 'VIEWER');

-- CreateTable
CREATE TABLE "tenants" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "slug" VARCHAR(100) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "passwordHash" VARCHAR(255) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_members" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "TenantRole" NOT NULL DEFAULT 'MEMBER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenant_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "sessionToken" VARCHAR(128) NOT NULL,
    "userId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "userAgent" TEXT,
    "ipAddress" VARCHAR(45),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tenants_slug_key" ON "tenants"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "tenant_members_userId_idx" ON "tenant_members"("userId");

-- CreateIndex
CREATE INDEX "tenant_members_tenantId_idx" ON "tenant_members"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "tenant_members_tenantId_userId_key" ON "tenant_members"("tenantId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_sessionToken_key" ON "sessions"("sessionToken");

-- CreateIndex
CREATE INDEX "sessions_userId_idx" ON "sessions"("userId");

-- CreateIndex
CREATE INDEX "sessions_tenantId_idx" ON "sessions"("tenantId");

-- CreateIndex
CREATE INDEX "sessions_sessionToken_idx" ON "sessions"("sessionToken");

-- AddForeignKey
ALTER TABLE "tenant_members" ADD CONSTRAINT "tenant_members_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_members" ADD CONSTRAINT "tenant_members_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- =========================================================================
-- STAGE B: Create deterministic Legacy Tenant for existing non-tenant data
-- =========================================================================
INSERT INTO "tenants" ("id", "name", "slug", "createdAt", "updatedAt")
VALUES ('00000000-0000-0000-0000-000000000001', 'Legacy Workspace', 'legacy-workspace', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;

-- =========================================================================
-- STAGE D: Backfill Projects into Legacy Tenant
-- =========================================================================
-- 1. Add tenantId as nullable first
ALTER TABLE "projects" ADD COLUMN "tenantId" TEXT;

-- 2. Backfill existing projects with the legacy tenant id
UPDATE "projects"
SET "tenantId" = '00000000-0000-0000-0000-000000000001'
WHERE "tenantId" IS NULL;

-- 3. Now enforce NOT NULL
ALTER TABLE "projects" ALTER COLUMN "tenantId" SET NOT NULL;

-- 4. Replace global slug uniqueness with tenant-scoped slug uniqueness
DROP INDEX IF EXISTS "projects_slug_key";
CREATE UNIQUE INDEX "projects_tenantId_slug_key" ON "projects"("tenantId", "slug");
CREATE INDEX "projects_tenantId_idx" ON "projects"("tenantId");

-- 5. Add ForeignKey from projects to tenants
ALTER TABLE "projects" ADD CONSTRAINT "projects_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- =========================================================================
-- STAGE E & F: Backfill ApiKeys into Legacy Tenant
-- =========================================================================
-- 1. Add tenantId, projectId, and createdById as nullable first
ALTER TABLE "api_keys" ADD COLUMN "tenantId" TEXT;
ALTER TABLE "api_keys" ADD COLUMN "projectId" TEXT;
ALTER TABLE "api_keys" ADD COLUMN "createdById" TEXT;

-- 2. Backfill existing api keys with the legacy tenant id
UPDATE "api_keys"
SET "tenantId" = '00000000-0000-0000-0000-000000000001'
WHERE "tenantId" IS NULL;

-- 3. Enforce NOT NULL on tenantId
ALTER TABLE "api_keys" ALTER COLUMN "tenantId" SET NOT NULL;

-- 4. Create Indexes
CREATE INDEX "api_keys_tenantId_idx" ON "api_keys"("tenantId");
CREATE INDEX "api_keys_projectId_idx" ON "api_keys"("projectId");

-- 5. Add ForeignKeys
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
