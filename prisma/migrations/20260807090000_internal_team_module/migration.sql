-- Module 11 (Internal Team & Role Management): departments, permission templates, permission grid, time-bound grants.

CREATE TABLE IF NOT EXISTS "InternalDepartment" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "leadId" TEXT,
  "permissionCeiling" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "InternalDepartment_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "InternalDepartment_name_key" ON "InternalDepartment"("name");
DO $$ BEGIN
  ALTER TABLE "InternalDepartment" ADD CONSTRAINT "InternalDepartment_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "InternalPermissionTemplate" (
  "id" TEXT NOT NULL,
  "roleName" TEXT NOT NULL,
  "defaultGrid" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "InternalPermissionTemplate_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "InternalPermissionTemplate_roleName_key" ON "InternalPermissionTemplate"("roleName");

CREATE TABLE IF NOT EXISTS "InternalPermissionGrid" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "moduleId" TEXT NOT NULL,
  "accessLevel" TEXT NOT NULL DEFAULT 'NONE',
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "InternalPermissionGrid_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "InternalPermissionGrid_userId_moduleId_key" ON "InternalPermissionGrid"("userId", "moduleId");
DO $$ BEGIN
  ALTER TABLE "InternalPermissionGrid" ADD CONSTRAINT "InternalPermissionGrid_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "InternalAccessGrant" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "grantedById" TEXT,
  "moduleId" TEXT NOT NULL,
  "functionId" TEXT,
  "expiresAt" TIMESTAMP(3),
  "revokedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "InternalAccessGrant_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "InternalAccessGrant_userId_idx" ON "InternalAccessGrant"("userId");
CREATE INDEX IF NOT EXISTS "InternalAccessGrant_expiresAt_idx" ON "InternalAccessGrant"("expiresAt");
DO $$ BEGIN
  ALTER TABLE "InternalAccessGrant" ADD CONSTRAINT "InternalAccessGrant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "InternalAccessGrant" ADD CONSTRAINT "InternalAccessGrant_grantedById_fkey" FOREIGN KEY ("grantedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
