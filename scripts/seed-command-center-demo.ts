import { PrismaClient } from "@prisma/client";

import { hashPassword } from "../src/lib/auth/password";

const prisma = new PrismaClient();

const DAY = 24 * 60 * 60 * 1000;
const passwordHash = hashPassword("FutureRealm123!");

function daysAgo(n: number) {
  return new Date(Date.now() - n * DAY);
}

function daysFromNow(n: number) {
  return new Date(Date.now() + n * DAY);
}

function slugify(name: string) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

type SchoolSeed = {
  name: string;
  city: string;
  state: string;
  plan: "BASIC" | "STANDARD" | "PROFESSIONAL" | "ENTERPRISE" | "CUSTOM";
  status: "ACTIVE" | "TRIAL" | "SUSPENDED" | "GRACE_PERIOD";
  billingStatus: "TRIAL" | "ACTIVE" | "OVERDUE" | "SUSPENDED" | "CANCELLED";
  healthScore: number;
  createdAt: Date;
  trialEndsAt?: Date;
  flaggedForReviewReason?: string;
  updatedAtOverride?: Date;
};

const schoolSeeds: SchoolSeed[] = [
  { name: "Grace International Academy", city: "Lekki", state: "Lagos", plan: "PROFESSIONAL", status: "ACTIVE", billingStatus: "ACTIVE", healthScore: 88, createdAt: daysAgo(210) },
  { name: "Crestwood Schools", city: "Ikeja", state: "Lagos", plan: "STANDARD", status: "ACTIVE", billingStatus: "OVERDUE", healthScore: 42, createdAt: daysAgo(180) },
  { name: "Kings & Queens College", city: "Ikoyi", state: "Lagos", plan: "ENTERPRISE", status: "ACTIVE", billingStatus: "ACTIVE", healthScore: 91, createdAt: daysAgo(340) },
  { name: "Bright Path Academy", city: "Surulere", state: "Lagos", plan: "BASIC", status: "ACTIVE", billingStatus: "ACTIVE", healthScore: 76, createdAt: daysAgo(25), updatedAtOverride: daysAgo(1) },
  { name: "Harmony College", city: "Yaba", state: "Lagos", plan: "STANDARD", status: "TRIAL", billingStatus: "TRIAL", healthScore: 64, createdAt: daysAgo(20), trialEndsAt: daysFromNow(5) },
  { name: "Unity Model School", city: "Wuse", state: "Abuja (FCT)", plan: "BASIC", status: "TRIAL", billingStatus: "TRIAL", healthScore: 55, createdAt: daysAgo(9), trialEndsAt: daysFromNow(21), updatedAtOverride: daysAgo(7) },
  { name: "Al-Noor Academy", city: "Garki", state: "Abuja (FCT)", plan: "STANDARD", status: "ACTIVE", billingStatus: "ACTIVE", healthScore: 82, createdAt: daysAgo(150) },
  { name: "Zion Comprehensive", city: "Maitama", state: "Abuja (FCT)", plan: "PROFESSIONAL", status: "GRACE_PERIOD", billingStatus: "OVERDUE", healthScore: 38, createdAt: daysAgo(400) },
  { name: "New Dawn International", city: "GRA Phase 2", state: "Port Harcourt", plan: "STANDARD", status: "ACTIVE", billingStatus: "ACTIVE", healthScore: 71, createdAt: daysAgo(60) },
  { name: "Beacon Light Academy", city: "Trans Amadi", state: "Port Harcourt", plan: "BASIC", status: "SUSPENDED", billingStatus: "SUSPENDED", healthScore: 21, createdAt: daysAgo(500) },
  { name: "Sunrise Model College", city: "Bodija", state: "Ibadan", plan: "BASIC", status: "TRIAL", billingStatus: "TRIAL", healthScore: 60, createdAt: daysAgo(15), trialEndsAt: daysFromNow(3), flaggedForReviewReason: "Auto-flagged: trial ending within 3 days with no CAC number on file" },
  { name: "Providence High School", city: "Ring Road", state: "Ibadan", plan: "CUSTOM", status: "ACTIVE", billingStatus: "ACTIVE", healthScore: 95, createdAt: daysAgo(600) },
  { name: "GSR Education Complex", city: "Sabon Gari", state: "Kano", plan: "STANDARD", status: "ACTIVE", billingStatus: "ACTIVE", healthScore: 79, createdAt: daysAgo(90), updatedAtOverride: daysAgo(2) },
  { name: "Coal City Comprehensive", city: "Independence Layout", state: "Enugu", plan: "BASIC", status: "TRIAL", billingStatus: "TRIAL", healthScore: 58, createdAt: daysAgo(6), trialEndsAt: daysFromNow(24) },
  { name: "Northern Lights Academy", city: "Barnawa", state: "Kaduna", plan: "BASIC", status: "ACTIVE", billingStatus: "ACTIVE", healthScore: 84, createdAt: daysAgo(45) },
];

async function main() {
  console.log(`Seeding ${schoolSeeds.length} schools and related Command Center demo data...`);

  const createdSchoolIds: Record<string, string> = {};

  for (const seed of schoolSeeds) {
    const slugBase = slugify(seed.name);
    let slug = slugBase;
    let suffix = 1;
    // eslint-disable-next-line no-await-in-loop
    while (await prisma.school.findUnique({ where: { slug } })) {
      slug = `${slugBase}-${suffix}`;
      suffix += 1;
    }

    // eslint-disable-next-line no-await-in-loop
    const school = await prisma.school.create({
      data: {
        name: seed.name,
        slug,
        category: "MIXED",
        city: seed.city,
        state: seed.state,
        country: "Nigeria",
        plan: seed.plan,
        status: seed.status,
        billingStatus: seed.billingStatus,
        healthScore: seed.healthScore,
        createdAt: seed.createdAt,
        updatedAt: seed.updatedAtOverride ?? new Date(),
        trialEndsAt: seed.trialEndsAt ?? null,
        flaggedForReviewReason: seed.flaggedForReviewReason ?? null,
        verifiedAt: seed.flaggedForReviewReason ? null : seed.createdAt,
        ownerName: `${seed.name.split(" ")[0]} Admin`,
        ownerEmail: `owner@${slug}.demo`,
      },
    });
    createdSchoolIds[seed.name] = school.id;

    // eslint-disable-next-line no-await-in-loop
    await prisma.user.create({
      data: {
        schoolId: school.id,
        email: `admin@${slug}.demo`,
        firstName: seed.name.split(" ")[0],
        lastName: "Admin",
        passwordHash,
        role: "SCHOOL_OWNER",
        lastLoginAt: seed.updatedAtOverride ?? daysAgo(Math.floor(Math.random() * 3)),
        emailVerifiedAt: seed.createdAt,
      },
    });
  }
  console.log(`Created ${schoolSeeds.length} schools with owner accounts.`);

  // --- Billing: invoices + transactions to populate revenue snapshot cards ---
  const billingTargets = ["Grace International Academy", "Crestwood Schools", "Kings & Queens College", "Al-Noor Academy", "New Dawn International", "Zion Comprehensive", "Providence High School"];
  let invoiceSeq = 1;
  let txnSeq = 1;

  for (const name of billingTargets) {
    const schoolId = createdSchoolIds[name];
    if (!schoolId) continue;

    if (name === "Zion Comprehensive" || name === "Crestwood Schools") {
      // Overdue invoice, unpaid
      const daysOverdue = name === "Zion Comprehensive" ? 65 : 12;
      // eslint-disable-next-line no-await-in-loop
      await prisma.platformInvoice.create({
        data: {
          schoolId,
          invoiceNo: `DEMO-INV-${String(invoiceSeq++).padStart(4, "0")}`,
          amount: 185000,
          status: "OVERDUE",
          issuedAt: daysAgo(daysOverdue + 30),
          dueAt: daysAgo(daysOverdue),
        },
      });
      continue;
    }

    // eslint-disable-next-line no-await-in-loop
    const invoice = await prisma.platformInvoice.create({
      data: {
        schoolId,
        invoiceNo: `DEMO-INV-${String(invoiceSeq++).padStart(4, "0")}`,
        amount: 210000,
        status: "PAID",
        issuedAt: daysAgo(10),
        dueAt: daysAgo(3),
        paidAt: daysAgo(4),
      },
    });

    const reconciled = name !== "Providence High School";
    // eslint-disable-next-line no-await-in-loop
    await prisma.platformBillingTransaction.create({
      data: {
        schoolId,
        invoiceId: invoice.id,
        amount: 210000,
        method: "TRANSFER",
        status: "SUCCESS",
        reference: `DEMO-TXN-${String(txnSeq++).padStart(4, "0")}`,
        processedAt: daysAgo(4),
        reconciledAt: reconciled ? daysAgo(2) : null,
      },
    });
  }

  // Notification-credit revenue
  const notifSchoolId = createdSchoolIds["GSR Education Complex"];
  if (notifSchoolId) {
    await prisma.platformBillingTransaction.create({
      data: {
        schoolId: notifSchoolId,
        amount: 28000,
        method: "CARD",
        status: "SUCCESS",
        reference: `DEMO-TXN-${String(txnSeq++).padStart(4, "0")}`,
        processedAt: daysAgo(5),
        reconciledAt: daysAgo(4),
        metadata: { type: "notification_credit" },
      },
    });
  }
  console.log("Seeded invoices and billing transactions.");

  // --- Support tickets ---
  const ticketSchool = createdSchoolIds["Grace International Academy"] ?? Object.values(createdSchoolIds)[0];
  const ticketSchool2 = createdSchoolIds["Crestwood Schools"] ?? Object.values(createdSchoolIds)[1];
  const ticketSpecs = [
    { schoolId: ticketSchool, category: "TECHNICAL_BUG", subject: "Published results not visible to parents", priority: "CRITICAL", status: "OPEN", slaDueAt: daysAgo(1), createdAt: daysAgo(2) },
    { schoolId: ticketSchool2, category: "DATA_CORRECTION_REQUEST", subject: "Score entry not saving for JSS2 Maths", priority: "HIGH", status: "IN_PROGRESS", slaDueAt: daysFromNow(1), createdAt: daysAgo(1) },
    { schoolId: ticketSchool, category: "SYNC_OFFLINE_ISSUE", subject: "Offline attendance records missing after sync", priority: "CRITICAL", status: "OPEN", slaDueAt: daysAgo(2), createdAt: daysAgo(3) },
    { schoolId: ticketSchool2, category: "ACCOUNT_ACCESS", subject: "Awaiting corrected student list", priority: "MEDIUM", status: "AWAITING_SCHOOL_RESPONSE", slaDueAt: daysFromNow(3), createdAt: daysAgo(4) },
    { schoolId: ticketSchool, category: "BILLING", subject: "Password reset for bursar", priority: "LOW", status: "RESOLVED", slaDueAt: daysAgo(1), createdAt: daysAgo(3), resolvedAt: daysAgo(1) },
    { schoolId: ticketSchool2, category: "FEATURE_REQUEST", subject: "Training session recording request", priority: "LOW", status: "RESOLVED", slaDueAt: daysAgo(9), createdAt: daysAgo(10), resolvedAt: daysAgo(9) },
    { schoolId: ticketSchool, category: "OTHER", subject: "Fee receipt formatting query", priority: "MEDIUM", status: "CLOSED", slaDueAt: daysAgo(15), createdAt: daysAgo(16), resolvedAt: daysAgo(15) },
  ] as const;

  let ticketSeq = 8800;
  for (const spec of ticketSpecs) {
    if (!spec.schoolId) continue;
    // eslint-disable-next-line no-await-in-loop
    await prisma.supportTicket.create({
      data: {
        schoolId: spec.schoolId,
        ticketNo: `TCK-${ticketSeq++}`,
        category: spec.category,
        subject: spec.subject,
        description: spec.subject,
        priority: spec.priority,
        status: spec.status,
        slaDueAt: spec.slaDueAt,
        createdAt: spec.createdAt,
        resolvedAt: "resolvedAt" in spec ? spec.resolvedAt : null,
      },
    });
  }
  console.log(`Seeded ${ticketSpecs.length} support tickets.`);

  // --- Data privacy requests + security incident (Regulatory obligations watch) ---
  const privacySchoolId = createdSchoolIds["Harmony College"];
  if (privacySchoolId) {
    await prisma.dataPrivacyRequest.create({
      data: {
        schoolId: privacySchoolId,
        type: "EXPORT",
        status: "OPEN",
        subject: "Parent requesting full data export",
        createdAt: daysAgo(4),
      },
    });
    await prisma.dataPrivacyRequest.create({
      data: {
        schoolId: privacySchoolId,
        type: "ERASURE",
        status: "IN_REVIEW",
        subject: "Withdrawn student erasure request",
        createdAt: daysAgo(18),
      },
    });
  }

  await prisma.securityIncident.create({
    data: {
      type: "UNAUTHORIZED_ACCESS_ATTEMPT",
      severity: "HIGH",
      description: "Repeated failed admin logins from an unrecognised IP range",
      status: "INVESTIGATING",
      detectedAt: daysAgo(1),
    },
  });
  console.log("Seeded data privacy requests and a security incident.");

  // --- Partner + converted deal (Channel & commission) ---
  const partner = await prisma.partner.create({
    data: {
      name: "GSR Education Partners",
      territory: "Lagos",
      commissionRatePercent: 20,
      isActive: true,
    },
  });

  const dealSchoolId = createdSchoolIds["Grace International Academy"];
  if (dealSchoolId) {
    await prisma.partnerDeal.create({
      data: {
        partnerId: partner.id,
        schoolId: dealSchoolId,
        prospectSchoolName: "Grace International Academy",
        prospectLocation: "Lekki, Lagos",
        expectedTier: "PROFESSIONAL",
        registeredAt: daysAgo(200),
        validUntil: daysFromNow(165),
        status: "CONVERTED",
        commissionRatePercent: 20,
        convertedAt: daysAgo(190),
      },
    });
  }
  console.log("Seeded a partner and a converted deal.");

  console.log("Done.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
