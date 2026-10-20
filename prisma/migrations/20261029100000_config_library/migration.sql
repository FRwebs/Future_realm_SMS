-- DropIndex
DROP INDEX "CurriculumTemplate_name_key";

-- DropIndex
DROP INDEX "GradingScaleTemplate_name_key";

-- AlterTable
ALTER TABLE "CurriculumTemplate" ADD COLUMN     "baseOnId" TEXT,
ADD COLUMN     "effectiveFrom" TIMESTAMP(3),
ADD COLUMN     "language" TEXT,
ADD COLUMN     "lifecycle" TEXT NOT NULL DEFAULT 'ACTIVE',
ADD COLUMN     "owner" TEXT,
ADD COLUMN     "supersededAt" TIMESTAMP(3),
ADD COLUMN     "validatedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "GradingScaleTemplate" ADD COLUMN     "lifecycle" TEXT NOT NULL DEFAULT 'ACTIVE',
ADD COLUMN     "supersededAt" TIMESTAMP(3),
ADD COLUMN     "validatedAt" TIMESTAMP(3),
ADD COLUMN     "version" TEXT NOT NULL DEFAULT '1.0';

-- CreateTable
CREATE TABLE "TemplateSubjectMapping" (
    "id" TEXT NOT NULL,
    "fromTemplateId" TEXT NOT NULL,
    "toTemplateId" TEXT NOT NULL,
    "fromSubject" TEXT NOT NULL,
    "toSubject" TEXT NOT NULL,
    "relationship" TEXT NOT NULL DEFAULT 'RENAMED',
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TemplateSubjectMapping_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CountryProfile" (
    "id" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'NGN',
    "phonePattern" TEXT,
    "phonePrefixes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "educationAuthority" TEXT,
    "registrationAuthority" TEXT,
    "defaultChannel" TEXT,
    "consentAge" INTEGER,
    "dataProtectionRegime" TEXT,
    "verificationSources" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "isLive" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CountryProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TemplateAdoption" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "templateName" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "adoptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TemplateAdoption_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TemplateSubjectMapping_fromTemplateId_toTemplateId_fromSubj_key" ON "TemplateSubjectMapping"("fromTemplateId", "toTemplateId", "fromSubject", "toSubject");

-- CreateIndex
CREATE UNIQUE INDEX "CountryProfile_country_key" ON "CountryProfile"("country");

-- CreateIndex
CREATE INDEX "TemplateAdoption_schoolId_idx" ON "TemplateAdoption"("schoolId");

-- CreateIndex
CREATE INDEX "TemplateAdoption_templateId_idx" ON "TemplateAdoption"("templateId");

-- CreateIndex
CREATE UNIQUE INDEX "CurriculumTemplate_name_version_key" ON "CurriculumTemplate"("name", "version");

-- CreateIndex
CREATE UNIQUE INDEX "GradingScaleTemplate_name_version_key" ON "GradingScaleTemplate"("name", "version");


-- A template switched off before lifecycles existed is archived.
UPDATE "CurriculumTemplate" SET "lifecycle" = 'ARCHIVED' WHERE "isActive" = false;
UPDATE "GradingScaleTemplate" SET "lifecycle" = 'ARCHIVED' WHERE "isActive" = false;

-- Nigeria is the one country the platform runs in today; its profile records what the code already assumes.
INSERT INTO "CountryProfile" ("id", "country", "currency", "phonePattern", "phonePrefixes", "educationAuthority", "registrationAuthority", "defaultChannel", "consentAge", "dataProtectionRegime", "verificationSources", "isLive", "updatedAt")
VALUES ('country_nigeria', 'Nigeria', 'NGN', '^(\+?234|0)[789][01]\d{8}$', ARRAY['0701','0702','0703','0704','0705','0706','0707','0708','0709','0802','0803','0804','0805','0806','0807','0808','0809','0810','0811','0812','0813','0814','0815','0816','0817','0818','0819','0901','0902','0903','0904','0905','0906','0907','0908','0909','0911','0912','0913','0915','0916'], 'State Ministry of Education', 'Corporate Affairs Commission (CAC)', 'SMS', 18, 'NDPA 2023 and GAID 2025', ARRAY['CAC registry search','State Ministry of Education approval list','Nigeria Data Protection Commission register'], true, CURRENT_TIMESTAMP)
ON CONFLICT ("country") DO NOTHING;
