-- CreateTable
CREATE TABLE "WebAddressRecord" (
    "id" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "schoolId" TEXT,
    "state" TEXT NOT NULL DEFAULT 'LIVE',
    "countryScope" TEXT NOT NULL DEFAULT 'Nigeria',
    "reservedReason" TEXT,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "retiredAt" TIMESTAMP(3),
    "releaseEligibleAt" TIMESTAMP(3),
    "redirectFromAddress" TEXT,
    "redirectExpiresAt" TIMESTAMP(3),
    "changeReason" TEXT,
    "changedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WebAddressRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AddressDispute" (
    "id" TEXT NOT NULL,
    "claimedAddress" TEXT NOT NULL,
    "webAddressRecordId" TEXT,
    "claimantSchoolName" TEXT NOT NULL,
    "claimantContactName" TEXT NOT NULL,
    "claimantContactEmail" TEXT NOT NULL,
    "claimantContactPhone" TEXT,
    "evidenceNotes" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'EVIDENCE_PENDING',
    "holderNotifiedAt" TIMESTAMP(3),
    "holderResponseDueAt" TIMESTAMP(3),
    "holderRespondedAt" TIMESTAMP(3),
    "holderResponse" TEXT,
    "outcome" TEXT,
    "qualifiedAddressOffered" TEXT,
    "decidedById" TEXT,
    "decidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AddressDispute_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OwnershipTransfer" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "outgoingOwnerId" TEXT NOT NULL,
    "incomingOwnerId" TEXT,
    "triggerType" TEXT NOT NULL,
    "evidenceNotes" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'EVIDENCE_COLLECTED',
    "noticeSentAt" TIMESTAMP(3),
    "holdExpiresAt" TIMESTAMP(3),
    "objectionNote" TEXT,
    "approver1Id" TEXT,
    "approver1At" TIMESTAMP(3),
    "approver2Id" TEXT,
    "approver2At" TIMESTAMP(3),
    "executedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OwnershipTransfer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WebAddressRecord_address_key" ON "WebAddressRecord"("address");

-- CreateIndex
CREATE INDEX "WebAddressRecord_state_idx" ON "WebAddressRecord"("state");

-- CreateIndex
CREATE INDEX "WebAddressRecord_schoolId_idx" ON "WebAddressRecord"("schoolId");

-- CreateIndex
CREATE INDEX "AddressDispute_status_idx" ON "AddressDispute"("status");

-- CreateIndex
CREATE INDEX "OwnershipTransfer_schoolId_idx" ON "OwnershipTransfer"("schoolId");

-- CreateIndex
CREATE INDEX "OwnershipTransfer_status_idx" ON "OwnershipTransfer"("status");

-- AddForeignKey
ALTER TABLE "WebAddressRecord" ADD CONSTRAINT "WebAddressRecord_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AddressDispute" ADD CONSTRAINT "AddressDispute_webAddressRecordId_fkey" FOREIGN KEY ("webAddressRecordId") REFERENCES "WebAddressRecord"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AddressDispute" ADD CONSTRAINT "AddressDispute_decidedById_fkey" FOREIGN KEY ("decidedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OwnershipTransfer" ADD CONSTRAINT "OwnershipTransfer_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OwnershipTransfer" ADD CONSTRAINT "OwnershipTransfer_outgoingOwnerId_fkey" FOREIGN KEY ("outgoingOwnerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OwnershipTransfer" ADD CONSTRAINT "OwnershipTransfer_incomingOwnerId_fkey" FOREIGN KEY ("incomingOwnerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OwnershipTransfer" ADD CONSTRAINT "OwnershipTransfer_approver1Id_fkey" FOREIGN KEY ("approver1Id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OwnershipTransfer" ADD CONSTRAINT "OwnershipTransfer_approver2Id_fkey" FOREIGN KEY ("approver2Id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

