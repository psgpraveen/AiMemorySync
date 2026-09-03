-- CreateEnum
CREATE TYPE "ProjectIdentityType" AS ENUM ('GIT_REMOTE', 'MONOREPO_SUBPROJECT', 'PACKAGE_MANIFEST', 'WORKSPACE_DIGEST', 'PLATFORM_SESSION');

-- AlterTable
ALTER TABLE "projects" ADD COLUMN     "creationSource" VARCHAR(50) NOT NULL DEFAULT 'MANUAL';

-- CreateTable
CREATE TABLE "project_identities" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "type" "ProjectIdentityType" NOT NULL,
    "value" TEXT NOT NULL,
    "identityHash" CHAR(64) NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "confidence" INTEGER NOT NULL DEFAULT 100,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_identities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_sources" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "platform" VARCHAR(50) NOT NULL,
    "externalId" VARCHAR(255),
    "localPathDigest" CHAR(64),
    "metadata" JSONB,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_sources_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "project_identities_projectId_idx" ON "project_identities"("projectId");

-- CreateIndex
CREATE INDEX "project_identities_type_identityHash_idx" ON "project_identities"("type", "identityHash");

-- CreateIndex
CREATE UNIQUE INDEX "project_identities_type_identityHash_key" ON "project_identities"("type", "identityHash");

-- CreateIndex
CREATE INDEX "project_sources_projectId_idx" ON "project_sources"("projectId");

-- CreateIndex
CREATE INDEX "project_sources_platform_externalId_idx" ON "project_sources"("platform", "externalId");

-- AddForeignKey
ALTER TABLE "project_identities" ADD CONSTRAINT "project_identities_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_sources" ADD CONSTRAINT "project_sources_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
