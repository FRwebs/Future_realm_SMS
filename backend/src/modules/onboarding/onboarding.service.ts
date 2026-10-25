import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import { z } from "zod";

import { hashPassword, verifyPassword } from "../../../../src/lib/auth/password";
import { rememberPassword } from "../../../../src/lib/auth/password-history";
import { issueUserCode } from "../../../../src/lib/auth/user-code";
import { prisma } from "../../../../src/lib/db/prisma";
import { sendNotification } from "../../../../src/lib/integrations/notifications";
import { sendEmail } from "../../../../src/lib/integrations/mailer";
import type { SessionPayload } from "../../../../src/lib/auth/session-core";
import type { Role, SessionUser } from "../../../../src/lib/domain/types";
import { ConfigStore } from "../staff-access/staff-access.shared";
import { partnerEngine } from "../partners/partner-engine.service";
import { platformPolicy } from "../platform-policy/policy.service";
import { ProvisioningService, type ProvisionStep } from "./provisioning.service";

function planModules(value: unknown) {
  if (Array.isArray(value)) return value.map((item) => String(item));
  if (value && typeof value === "object") {
    const modules = (value as Record<string, unknown>).modules;
    if (Array.isArray(modules)) return modules.map((item) => String(item));
  }
  return [];
}

const registerSchoolSchema = z.object({
  schoolName: z.string().trim().min(2, "School name must be at least 2 characters"),
  slug: z.string().trim().optional(),
  category: z.enum(["NURSERY", "PRIMARY", "SECONDARY", "COLLEGE", "MIXED"]).default("MIXED"),
  ownerName: z.string().trim().min(2, "Owner name must be at least 2 characters"),
  ownerEmail: z.string().trim().email("Enter a valid email address"),
  ownerPhone: z.string().trim().optional(),
  // The position/title the person picked at signup (Proprietor, Principal, Bursar, ...). The
  // account itself is always created as SCHOOL_OWNER regardless — whoever stands up the school
  // keeps full control no matter their formal title — this is only recorded for their profile.
  position: z.string().trim().optional(),
  password: z.string().min(8, "Password must be at least 8 characters"),
  address: z.string().trim().optional(),
  city: z.string().trim().optional(),
  // Second-level administrative division (LGA in Nigeria, County in Kenya, District in Ghana, ...) —
  // which label applies is a frontend concern; this column just stores whatever was entered.
  lga: z.string().trim().optional(),
  state: z.string().trim().optional(),
  country: z.string().trim().min(2).default("Nigeria"),
  website: z.string().trim().optional(),
  // Organisation type (Private, Mission/Faith-based, NGO, Public, ...) — distinct from `category`,
  // which is the educational level(s) offered.
  schoolType: z.string().trim().optional(),
  curriculumPreference: z.string().trim().optional(),
  studentCount: z.coerce.number().int().positive().optional(),
  // Nigeria calls these "CAC registration number" / "Ministry of Education approval number";
  // every other country has its own two-registration-number pair. The columns keep their
  // original Nigeria-derived names, but store whatever the frontend labels for the selected
  // country — there's no per-country validation on the values themselves.
  cacNumber: z.string().trim().optional(),
  ministryApprovalNumber: z.string().trim().optional(),
  /** "Start my free trial" begins the 30 days now; "Not yet" still creates the school and leaves them for the dashboard. */
  startTrial: z.boolean().default(true),
  levels: z.array(z.string()).default([]),
  /** The reference code of the partner who introduced the school, carried on their link. */
  partnerCode: z.string().trim().optional()
});

// The six positions the mockup offers a solo teacher signup don't all have a matching real
// UserRole — HEAD_OF_DEPARTMENT/CLASS_TEACHER/SUBJECT_TEACHER/TEACHING_ASSISTANT exist; Year Head
// and Private Tutor don't. Each label maps to the nearest real role for permissions; the literal
// label the person picked is kept as-is in `jobTitle` on their profile, so nothing about their
// stated title is lost or misrepresented.
const TEACHER_POSITION_TO_ROLE: Record<string, "SUBJECT_TEACHER" | "CLASS_TEACHER" | "HEAD_OF_DEPARTMENT" | "TEACHING_ASSISTANT"> = {
  "Subject Teacher": "SUBJECT_TEACHER",
  "Form Teacher / Class Teacher": "CLASS_TEACHER",
  "Head of Department": "HEAD_OF_DEPARTMENT",
  "Year Head": "HEAD_OF_DEPARTMENT",
  "Teaching Assistant": "TEACHING_ASSISTANT",
  "Private Tutor": "SUBJECT_TEACHER"
};

const registerTeacherSchema = z.object({
  firstName: z.string().trim().min(1, "First name is required"),
  lastName: z.string().trim().min(1, "Last name is required"),
  gender: z.enum(["MALE", "FEMALE", "OTHER"]).optional(),
  phone: z.string().trim().optional(),
  email: z.string().trim().email("Enter a valid email address"),
  position: z.string().trim().min(1).default("Subject Teacher"),
  country: z.string().trim().optional(),
  schoolName: z.string().trim().optional(),
  city: z.string().trim().optional(),
  /** Whether the teacher agreed to be written to on WhatsApp. Absent means no. */
  whatsappOptIn: z.boolean().optional(),
  subjects: z.array(z.string()).default([]),
  levels: z.array(z.string()).default([]),
  /** A school already on the platform that the teacher asked to be linked to. */
  joinSchoolId: z.string().trim().optional(),
  password: z.string().min(8, "Password must be at least 8 characters")
});

const verifyEmailSchema = z.object({
  email: z.string().trim().email("Enter a valid email address"),
  code: z.string().trim().min(4).max(8)
});

const resendVerificationSchema = z.object({
  email: z.string().trim().email("Enter a valid email address")
});

const OTP_LENGTH = 6;
const OTP_TTL_MINUTES = 15;
const OTP_MAX_ATTEMPTS = 3;
const OTP_MAX_PER_WINDOW = 3;
const OTP_WINDOW_MINUTES = 15;

const BLOCKED_SLUGS = [
  "admin",
  "api",
  "app",
  "www",
  "mail",
  "support",
  "waec",
  "neco",
  "jamb",
  "futurerealm",
  "onboarding",
  "login",
  "dashboard",
  "super-admin"
];
const SLUG_PATTERN = /^[a-z0-9-]{3,30}$/;

const onboardingChecklist = [
  { key: "SCHOOL_PROFILE", label: "Confirm your school profile and branding" },
  { key: "ACADEMIC_SESSION", label: "Set up your first academic session and term" },
  { key: "CLASSES", label: "Add your classes and arms" },
  { key: "STAFF", label: "Invite your teachers and staff" },
  { key: "STUDENTS", label: "Add your first students" },
  { key: "FEES", label: "Set up your fee structure" }
];

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function splitName(value: string) {
  const [firstName, ...rest] = value.trim().split(/\s+/);
  return {
    firstName: firstName || "School",
    lastName: rest.join(" ") || "Owner"
  };
}

const FREE_EMAIL_DOMAINS = new Set(["gmail.com", "yahoo.com", "outlook.com", "hotmail.com", "icloud.com", "yahoo.co.uk"]);

// M2.9.1 — signal set, weights and thresholds are the country-configurable part of risk
// assessment. This is the Nigeria configuration; a second country adds a parallel function
// and a lookup by school.country, not an edit to the validators below.
const NIGERIA_PHONE_PATTERN = /^(\+?234|0)[7-9][0-1]\d{8}$/;

/**
 * A school can only sign up in a country somebody has opened in Curriculum & Academics → Country Settings. The profile
 * supplies the currency, and its phone pattern is what the owner's number is checked against. With no profiles at all
 * (a fresh install) Nigeria stays open, so signup never dead-ends before anyone has configured anything.
 */
async function openCountry(country: string | undefined) {
  const name = country || "Nigeria";
  const profiles = await prisma.countryProfile.count();
  const profile = await prisma.countryProfile.findUnique({ where: { country: name } });
  if (!profile) {
    if (profiles === 0 && name === "Nigeria") return { country: name, currency: "NGN", phonePattern: NIGERIA_PHONE_PATTERN.source };
    throw new BadRequestException(`We are not open in ${name} yet.`);
  }
  if (!profile.isLive) throw new BadRequestException(`We are not open in ${name} yet.`);
  return { country: name, currency: profile.currency, phonePattern: profile.phonePattern };
}

function phoneMatches(pattern: string | null | undefined, phone: string | undefined) {
  if (!phone) return false;
  if (!pattern) return true;
  try {
    return new RegExp(pattern).test(phone.replace(/[\s-]/g, ""));
  } catch {
    return true; // a pattern that does not compile must not lock every signup out
  }
}

function normalizeSchoolName(name: string) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

interface RiskSignal {
  label: string;
  weight: number;
  triggered: boolean;
}

interface RiskAssessment {
  score: number;
  signals: RiskSignal[];
  flaggedForReviewReason: string | null;
}

// M2.9.1/2.9.2 — automated multi-signal scoring. Runs once at signup (fast, in-database
// checks only — no outbound fetch, so it never delays provisioning). Score starts at 100
// and each triggered negative signal deducts its weight; below RISK_SCORE_THRESHOLD the
// school enters the back-office review queue (M2.9.2) while continuing to work normally.
const RISK_SCORE_THRESHOLD = 80;

async function computeRiskAssessment(input: {
  schoolName: string;
  state?: string;
  country?: string;
  cacNumber?: string;
  ministryApprovalNumber?: string;
  address?: string;
  city?: string;
  ownerEmail: string;
  ownerPhone?: string;
  signupIp?: string;
  phonePattern?: string | null;
}): Promise<RiskAssessment> {
  const emailDomain = input.ownerEmail.split("@")[1]?.toLowerCase();
  const hasRegistration = Boolean(input.cacNumber || input.ministryApprovalNumber);
  const hasAddress = Boolean(input.address || input.city || input.state);
  const isFreeEmail = Boolean(emailDomain && FREE_EMAIL_DOMAINS.has(emailDomain));
  // The phone-format check is Nigeria-specific (see isValidNigerianPhone above) — outside
  // Nigeria there's no pattern to check against yet, so a school there never gets flagged
  // on this signal purely for having a phone number this validator doesn't recognise.
  const phoneMissingOrInvalid = !input.ownerPhone || !phoneMatches(input.phonePattern ?? NIGERIA_PHONE_PATTERN.source, input.ownerPhone);

  const duplicateOwner = await prisma.school.findFirst({
    where: {
      deletedAt: null,
      OR: [{ ownerEmail: input.ownerEmail }, ...(input.ownerPhone ? [{ ownerPhone: input.ownerPhone }] : [])]
    },
    select: { id: true }
  });

  let duplicateName = false;
  if (input.state) {
    const normalized = normalizeSchoolName(input.schoolName);
    const candidates = await prisma.school.findMany({
      where: { deletedAt: null, state: input.state },
      select: { name: true }
    });
    duplicateName = candidates.some((candidate) => normalizeSchoolName(candidate.name) === normalized);
  }

  let repeatedSignupsFromConnection = false;
  if (input.signupIp) {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const count = await prisma.school.count({ where: { signupIp: input.signupIp, createdAt: { gte: since } } });
    repeatedSignupsFromConnection = count >= 2;
  }

  const signals: RiskSignal[] = [
    { label: "No CAC or Ministry of Education approval number provided", weight: -25, triggered: !hasRegistration },
    { label: "No physical address on file", weight: -15, triggered: !hasAddress },
    { label: "Owner registered with a personal webmail address and no CAC number", weight: -20, triggered: isFreeEmail && !hasRegistration },
    { label: "Phone number missing or not a recognised format for the country", weight: -10, triggered: phoneMissingOrInvalid },
    { label: "Same person (email or phone) already registered another school", weight: -30, triggered: Boolean(duplicateOwner) },
    { label: "School name closely matches an existing school in the same state", weight: -20, triggered: duplicateName },
    { label: "Several signups from the same connection within 24 hours", weight: -15, triggered: repeatedSignupsFromConnection }
  ];

  const score = Math.max(0, 100 + signals.filter((signal) => signal.triggered).reduce((sum, signal) => sum + signal.weight, 0));
  const triggeredReasons = signals.filter((signal) => signal.triggered).map((signal) => signal.label);

  return {
    score,
    signals,
    flaggedForReviewReason: score < RISK_SCORE_THRESHOLD ? triggeredReasons.join("; ") : null
  };
}

function featureDefaults() {
  return {
    admissions: true,
    students: true,
    staff: true,
    classes: true,
    subjects: true,
    timetable: true,
    attendance: true,
    academics: true,
    finance: true,
    communications: true,
    configuration: true,
    operations: true
  };
}

function generateOtpCode() {
  return Array.from({ length: OTP_LENGTH }, () => Math.floor(Math.random() * 10)).join("");
}

interface SlugEvaluation {
  slug: string;
  tone: "idle" | "good" | "warn" | "bad";
  badge: string;
  note: string;
  available: boolean;
}

@Injectable()
export class OnboardingService {
  constructor(private readonly provisioning: ProvisioningService) {}

  async evaluateSlug(rawSlug: string): Promise<SlugEvaluation> {
    const slug = (rawSlug || "").toLowerCase().trim();

    if (!slug) {
      return {
        slug,
        tone: "idle",
        badge: "Type to check",
        note: "Lowercase letters and numbers only, 3–30 characters.",
        available: false
      };
    }
    if (BLOCKED_SLUGS.includes(slug)) {
      return {
        slug,
        tone: "bad",
        badge: "Not allowed",
        note: `Reserved names cannot be used. Try adding your city — for example ${slug}-lagos.`,
        available: false
      };
    }
    if (!SLUG_PATTERN.test(slug)) {
      return {
        slug,
        tone: "bad",
        badge: slug.length < 3 ? "Too short" : "Invalid format",
        note: "Use lowercase letters, numbers and hyphens only, 3–30 characters.",
        available: false
      };
    }

    const existing = await prisma.school.findUnique({ where: { slug } });
    if (existing) {
      return {
        slug,
        tone: "warn",
        badge: "Already taken",
        note: `Try ${slug}-lagos, ${slug}-ikeja or ${slug}school — we never add numbers automatically.`,
        available: false
      };
    }

    return {
      slug,
      tone: "good",
      badge: "Available",
      note: `This becomes your permanent address: ${slug}.futurerealm.school`,
      available: true
    };
  }

  private async issueVerificationCode(userId: string, email: string) {
    const code = generateOtpCode();
    const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000);

    await prisma.emailVerificationCode.create({
      data: {
        userId,
        email,
        codeHash: hashPassword(code),
        expiresAt
      }
    });

    await sendEmail({
      to: email,
      subject: "Your FutureRealm SMS verification code",
      text: `Your 6-digit verification code is ${code}. It expires in ${OTP_TTL_MINUTES} minutes and allows ${OTP_MAX_ATTEMPTS} attempts. We never send passwords by email.`
    });
  }

  /** The countries a school can sign up in right now: the ones opened in Country Settings. */
  /** The website's "Stay updated" box. The address is kept as a lead for the sales team — once, however many times it is sent. */
  async joinNewsletter(payload: unknown) {
    const parsed = z.object({ email: z.string().trim().toLowerCase().email("That does not look like an email address.").max(200) }).safeParse(payload);
    if (!parsed.success) throw new BadRequestException(parsed.error.issues[0]?.message ?? "That does not look like an email address.");
    const email = parsed.data.email;
    const existing = await prisma.lead.findFirst({ where: { email, source: "Website · Stay updated" }, select: { id: true } });
    if (!existing) await prisma.lead.create({ data: { prospectName: email, contactName: email, email, source: "Website · Stay updated", notes: "Asked for launch notes and rollout news." } });
    return { joined: true };
  }

  async openCountryNames() {
    const live = await prisma.countryProfile.findMany({ where: { isLive: true }, orderBy: { country: "asc" }, select: { country: true } });
    if (live.length) return live.map((row) => row.country);
    return (await prisma.countryProfile.count()) === 0 ? ["Nigeria"] : [];
  }

  async registerSchool(payload: unknown, signupIp?: string) {
    const startedAt = Date.now();
    const parsed = registerSchoolSchema.parse(payload);
    const ownerEmail = parsed.ownerEmail.toLowerCase();
    const open = await openCountry(parsed.country);

    const existingUser = await prisma.user.findUnique({ where: { email: ownerEmail } });
    if (existingUser) {
      throw new ConflictException("An account with this email already exists. Please sign in instead.");
    }

    let slug: string;
    if (parsed.slug) {
      const evaluation = await this.evaluateSlug(parsed.slug);
      if (!evaluation.available) {
        throw new ConflictException(evaluation.note);
      }
      slug = evaluation.slug;
    } else {
      const baseSlug = slugify(parsed.schoolName) || "school";
      slug = `${baseSlug}-${Date.now().toString(36)}`;
    }

    const schoolCode = `SCH-${Date.now().toString(36).toUpperCase()}`;
    const ownerNameParts = splitName(parsed.ownerName);
    const trialDays = (await platformPolicy.get()).trial.days;
    const trialStartedAt = parsed.startTrial ? new Date() : null;
    const trialEndsAt = trialStartedAt ? new Date(trialStartedAt.getTime() + trialDays * 24 * 60 * 60 * 1000) : null;
    const userCode = await issueUserCode("ADMIN");
    const passwordHash = hashPassword(parsed.password);
    const riskAssessment = await computeRiskAssessment({
      schoolName: parsed.schoolName,
      state: parsed.state,
      country: parsed.country,
      cacNumber: parsed.cacNumber,
      ministryApprovalNumber: parsed.ministryApprovalNumber,
      address: parsed.address,
      city: parsed.city,
      ownerEmail,
      ownerPhone: parsed.ownerPhone,
      signupIp,
      phonePattern: open.phonePattern
    });

    const school = await prisma.school.create({
      data: {
        name: parsed.schoolName,
        slug,
        subdomain: slug,
        schoolCode,
        category: parsed.category,
        ownerName: parsed.ownerName,
        ownerEmail,
        ownerPhone: parsed.ownerPhone,
        address: parsed.address,
        city: parsed.city,
        lga: parsed.lga,
        state: parsed.state,
        website: parsed.website,
        schoolType: parsed.schoolType,
        curriculumPreference: parsed.curriculumPreference,
        estimatedStudentCount: parsed.studentCount,
        cacNumber: parsed.cacNumber,
        ministryApprovalNumber: parsed.ministryApprovalNumber,
        flaggedForReviewReason: riskAssessment.flaggedForReviewReason,
        riskScore: riskAssessment.score,
        riskSignals: riskAssessment.signals as unknown as Prisma.InputJsonValue,
        signupIp: signupIp ?? null,
        country: open.country,
        currency: open.currency,
        plan: "BASIC",
        status: "TRIAL",
        billingStatus: "TRIAL",
        trialEndsAt,
        trialStartedAt,
        nextBillingAt: trialEndsAt,
        featureFlags: featureDefaults(),
        healthScore: 65,
        onboardingChecklistItems: {
          create: onboardingChecklist.map((item) => ({ key: item.key, label: item.label }))
        },
        users: {
          create: {
            email: ownerEmail,
            firstName: ownerNameParts.firstName,
            lastName: ownerNameParts.lastName,
            phone: parsed.ownerPhone,
            jobTitle: parsed.position,
            userCode,
            passwordHash,
            passwordChangedAt: new Date(),
            role: "SCHOOL_OWNER"
          }
        }
      },
      include: { users: true }
    });

    const owner = school.users[0];

    await prisma.auditLog.create({
      data: {
        schoolId: school.id,
        actorId: owner.id,
        action: "CREATE",
        entityType: "School",
        entityId: school.id,
        metadata: { source: "SELF_SERVICE_ONBOARDING", schoolName: school.name, plan: school.plan }
      }
    });

    await rememberPassword(owner.id, passwordHash);
    const address = `${school.slug}.futurerealm.school`;
    await partnerEngine.attributeAtSignup(school.id, school.name, parsed.partnerCode).catch(() => undefined);
    const academics = await this.provisioning.academics(school.id, owner.id, { country: parsed.country, levels: parsed.levels, withSample: true });
    const [curriculum, ladder, sample] = [academics.find((step) => step.key === "curriculum"), academics.find((step) => step.key === "ladder"), academics.find((step) => step.key === "sample")];
    const setup: ProvisionStep[] = [
      { key: "school", label: "School record created and your web address goes live", detail: address },
      ...(curriculum ? [curriculum] : []),
      ...(ladder ? [ladder] : []),
      this.provisioning.roleTemplates(),
      { key: "admin", label: "Admin account created — permanent 6-digit User ID issued", detail: `User ID ${userCode}` },
      ...(sample ? [sample] : []),
      await this.provisioning.issueTrial(prisma, school.id, owner.id, ownerEmail),
      { key: "audit", label: "Audit logging switched on and a background risk check run", detail: riskAssessment.flaggedForReviewReason ? "Held for a quick review while you keep working" : "Nothing to review" },
    ];

    // What the school was given and how long it took — the Back Office reads this back as its provisioning log.
    await prisma.auditLog.create({ data: { schoolId: school.id, actorId: owner.id, action: "CREATE", entityType: "Provisioning", entityId: school.id, metadata: { summary: `Provisioned ${school.name}`, elapsedMs: Date.now() - startedAt, steps: setup, clean: !setup.some((step) => /could not/i.test(step.label)) } as unknown as Prisma.InputJsonValue } });

    await sendNotification({
      channel: "EMAIL",
      recipient: ownerEmail,
      title: "Welcome to FutureRealm SMS",
      body: `Your school workspace for ${school.name} is ready at ${address}. Your User ID is ${userCode} — it is permanent, and you can sign in with it or with this email address. ${trialEndsAt ? `Your 30-day trial ends on ${trialEndsAt.toDateString()}.` : "Your 30-day trial begins when you start it from your dashboard."}`
    });

    await this.issueVerificationCode(owner.id, ownerEmail);

    const sessionUser: Omit<SessionUser, "csrfToken"> = {
      userId: owner.id,
      schoolId: school.id,
      role: owner.role as Role,
      email: owner.email,
      name: `${owner.firstName} ${owner.lastName}`
    };

    return {
      sessionUser,
      school: { id: school.id, name: school.name, slug: school.slug, trialEndsAt },
      account: { userCode, address, trialStarted: Boolean(trialStartedAt), setup }
    };
  }

  async registerTeacher(payload: unknown) {
    const parsed = registerTeacherSchema.parse(payload);
    const email = parsed.email.toLowerCase();

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      throw new ConflictException("An account with this email already exists. Please sign in instead.");
    }

    const baseSlug = slugify(`teacher-${parsed.firstName}-${parsed.lastName}`) || "teacher";
    const slug = `${baseSlug}-${Date.now().toString(36)}`;
    const schoolCode = `IND-${Date.now().toString(36).toUpperCase()}`;
    const role = TEACHER_POSITION_TO_ROLE[parsed.position] ?? "SUBJECT_TEACHER";
    const userCode = await issueUserCode("TEACHER");
    const passwordHash = hashPassword(parsed.password);
    const target = parsed.joinSchoolId ? await prisma.school.findFirst({ where: { id: parsed.joinSchoolId, deletedAt: null, isPersonalWorkspace: false }, select: { id: true, name: true } }) : null;

    const workspace = await prisma.school.create({
      data: {
        name: `${parsed.firstName} ${parsed.lastName}'s Workspace`,
        slug,
        subdomain: slug,
        schoolCode,
        category: "MIXED",
        isPersonalWorkspace: true,
        country: parsed.country || "Nigeria",
        plan: "BASIC",
        status: "ACTIVE",
        billingStatus: "ACTIVE",
        featureFlags: featureDefaults(),
        healthScore: 100,
        users: {
          create: {
            email,
            firstName: parsed.firstName,
            lastName: parsed.lastName,
            phone: parsed.phone,
            gender: parsed.gender,
            country: parsed.country,
            city: parsed.city,
            jobTitle: parsed.position,
            userCode,
            passwordHash,
            passwordChangedAt: new Date(),
            role
          }
        }
      },
      include: { users: true }
    });

    const teacher = workspace.users[0];

    await prisma.auditLog.create({
      data: {
        schoolId: workspace.id,
        actorId: teacher.id,
        action: "CREATE",
        entityType: "School",
        entityId: workspace.id,
        metadata: {
          source: "INDEPENDENT_TEACHER_SELF_SIGNUP",
          claimedSchoolName: parsed.schoolName || null,
          subjects: parsed.subjects,
          levels: parsed.levels,
          positionLabel: parsed.position
        }
      }
    });

    await rememberPassword(teacher.id, passwordHash);
    if (parsed.whatsappOptIn) await prisma.consentRecord.create({ data: { userId: teacher.id, channel: "WHATSAPP", schoolId: workspace.id, source: "Teacher signup", optedIn: true } });
    const joinRequest = target
      ? await prisma.schoolJoinRequest.create({ data: { userId: teacher.id, schoolId: target.id, nameClaimed: parsed.schoolName ?? target.name, subjects: parsed.subjects, levels: parsed.levels } })
      : null;
    if (target && joinRequest) {
      const admins = await prisma.user.findMany({ where: { schoolId: target.id, isActive: true, deletedAt: null, role: { in: ["SCHOOL_OWNER", "PROPRIETOR", "PRINCIPAL", "ADMINISTRATOR"] } }, select: { id: true } });
      if (admins.length) await prisma.notificationLog.createMany({ data: admins.map((admin) => ({ schoolId: target.id, userId: admin.id, channel: "IN_APP" as const, title: "A teacher asked to join your school", body: `${parsed.firstName} ${parsed.lastName} (${parsed.position}) asked to be linked to ${target.name}. Decide under Approvals & Workflow.`, status: "QUEUED", sentAt: new Date() })) });
    }
    await sendNotification({
      channel: "EMAIL",
      recipient: email,
      title: "Welcome to FutureRealm SMS",
      body: `Your teaching workspace is ready. Your User ID is ${userCode} — it is permanent, and you can sign in with it or with this email address.${target ? ` Your request to join ${target.name} has been sent; an administrator there decides, and your account works either way.` : ""}`
    });
    await this.issueVerificationCode(teacher.id, email);

    const sessionUser: Omit<SessionUser, "csrfToken"> = {
      userId: teacher.id,
      schoolId: workspace.id,
      role: teacher.role as Role,
      email: teacher.email,
      name: `${teacher.firstName} ${teacher.lastName}`
    };

    return {
      sessionUser,
      school: { id: workspace.id, name: workspace.name, slug: workspace.slug, trialEndsAt: null },
      account: { userCode, address: "app.futurerealm.school", trialStarted: false, joinRequest: target ? { school: target.name, status: "PENDING" } : null, setup: [] as ProvisionStep[] }
    };
  }

  async checkSlugAvailability(rawSlug: string) {
    const evaluation = await this.evaluateSlug(rawSlug);
    return evaluation;
  }

  /** Public, unauthenticated fuzzy match for the teacher signup's "School you teach at" field —
   * name only, nothing sensitive, so a match can be shown before the teacher has an account. */
  async searchSchoolsByName(rawQuery: string) {
    const query = (rawQuery || "").trim();
    if (query.length < 2) return [];
    const schools = await prisma.school.findMany({
      where: { deletedAt: null, isPersonalWorkspace: false, name: { contains: query, mode: "insensitive" } },
      select: { id: true, name: true, city: true, state: true },
      take: 5,
      orderBy: { name: "asc" }
    });
    return schools.map((school) => ({
      id: school.id,
      name: school.name,
      location: [school.city, school.state].filter(Boolean).join(", ") || null
    }));
  }

  async listPublicPlans() {
    const plans = await prisma.platformSubscriptionPlan.findMany({
      where: { isActive: true },
      orderBy: { monthlyPrice: "asc" }
    });
    return plans.map((plan) => ({
      slug: plan.slug,
      name: plan.name,
      plan: plan.plan,
      monthlyPrice: Number(plan.monthlyPrice),
      annualPrice: Number(plan.annualPrice),
      studentLimit: plan.studentLimit,
      staffLimit: plan.staffLimit,
      apiAccess: plan.apiAccess,
      customBranding: plan.customBranding,
      includedModules: planModules(plan.includedModules)
    }));
  }

  async verifyEmail(payload: unknown) {
    const parsed = verifyEmailSchema.parse(payload);
    const email = parsed.email.toLowerCase();

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      throw new NotFoundException("No account found for this email address.");
    }
    if (user.emailVerifiedAt) {
      return { verified: true, alreadyVerified: true };
    }

    const record = await prisma.emailVerificationCode.findFirst({
      where: {
        userId: user.id,
        purpose: "SIGNUP_VERIFY",
        consumedAt: null,
        expiresAt: { gt: new Date() }
      },
      orderBy: { createdAt: "desc" }
    });

    if (!record) {
      throw new BadRequestException("Your code has expired. Request a new one.");
    }
    if (record.attempts >= OTP_MAX_ATTEMPTS) {
      throw new BadRequestException("Too many attempts. Request a new code.");
    }

    const isValid = verifyPassword(parsed.code, record.codeHash);
    if (!isValid) {
      await prisma.emailVerificationCode.update({
        where: { id: record.id },
        data: { attempts: { increment: 1 } }
      });
      throw new BadRequestException("Incorrect code. Please try again.");
    }

    await prisma.$transaction([
      prisma.emailVerificationCode.update({ where: { id: record.id }, data: { consumedAt: new Date() } }),
      prisma.user.update({ where: { id: user.id }, data: { emailVerifiedAt: new Date() } })
    ]);

    return { verified: true, alreadyVerified: false };
  }

  async resendVerification(payload: unknown) {
    const parsed = resendVerificationSchema.parse(payload);
    const email = parsed.email.toLowerCase();

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      throw new NotFoundException("No account found for this email address.");
    }
    if (user.emailVerifiedAt) {
      return { sent: false, alreadyVerified: true };
    }

    const windowStart = new Date(Date.now() - OTP_WINDOW_MINUTES * 60 * 1000);
    const recentCount = await prisma.emailVerificationCode.count({
      where: { userId: user.id, purpose: "SIGNUP_VERIFY", createdAt: { gt: windowStart } }
    });
    if (recentCount >= OTP_MAX_PER_WINDOW) {
      throw new BadRequestException("Too many codes requested. Please wait a few minutes and try again.");
    }

    await this.issueVerificationCode(user.id, email);
    return { sent: true, alreadyVerified: false };
  }

  /* ───────────────────────── after signup ───────────────────────── */

  private assertLeader(session: SessionPayload) {
    if (!["SCHOOL_OWNER", "PROPRIETOR", "PRINCIPAL", "ADMINISTRATOR"].includes(String(session.role))) {
      throw new ForbiddenException("Only the school's proprietor, principal or administrator can do this.");
    }
  }

  /** "Not yet" at signup still created the school. The thirty days begin here, when somebody chooses. */
  async startTrial(session: SessionPayload) {
    this.assertLeader(session);
    const school = await prisma.school.findUnique({ where: { id: session.schoolId } });
    if (!school || school.isPersonalWorkspace) throw new NotFoundException("There is no school trial to start here.");
    if (school.trialStartedAt) throw new BadRequestException("The trial has already started.");
    if (school.billingStatus !== "TRIAL") throw new BadRequestException("This school is already on a paid plan.");
    const startedAt = new Date();
    const trialDays = (await platformPolicy.get()).trial.days;
    const endsAt = new Date(startedAt.getTime() + trialDays * 86_400_000);
    await prisma.school.update({ where: { id: school.id }, data: { trialStartedAt: startedAt, trialEndsAt: endsAt, nextBillingAt: endsAt } });
    await prisma.auditLog.create({ data: { schoolId: school.id, actorId: session.userId, action: "UPDATE", entityType: "School", entityId: school.id, metadata: { summary: "Free trial started", endsAt: endsAt.toISOString() } } });
    return { startedAt: startedAt.toISOString(), endsAt: endsAt.toISOString(), days: trialDays };
  }

  /** What the dashboard says about the trial. */
  async trialStatus(session: SessionPayload) {
    const school = await prisma.school.findUnique({ where: { id: session.schoolId }, select: { isPersonalWorkspace: true, status: true, billingStatus: true, trialStartedAt: true, trialEndsAt: true } });
    const policy = await platformPolicy.get();
    if (!school || school.isPersonalWorkspace || school.billingStatus !== "TRIAL") return { state: "none" as const };
    if (!school.trialStartedAt) return { state: "not-started" as const, days: policy.trial.days };
    const left = Math.max(0, Math.ceil(((school.trialEndsAt?.getTime() ?? 0) - Date.now()) / 86_400_000));
    if (school.status === "GRACE_PERIOD") {
      const lockOn = new Date((school.trialEndsAt?.getTime() ?? Date.now()) + policy.trial.readOnlyDays * 86_400_000);
      return { state: "read-only" as const, lockOn: lockOn.toISOString(), daysToLock: Math.max(0, Math.ceil((lockOn.getTime() - Date.now()) / 86_400_000)) };
    }
    return { state: left > 0 ? ("running" as const) : ("ended" as const), daysLeft: left, endsAt: school.trialEndsAt?.toISOString() ?? null };
  }

  /** Is the sample class still there? */
  async sampleStatus(session: SessionPayload) {
    const manifest = await new ConfigStore(session.schoolId, "sample-data").get<{ students: number; days: number; subjects: number }>("manifest");
    return manifest ? { loaded: true, students: manifest.data.students, days: manifest.data.days, subjects: manifest.data.subjects } : { loaded: false };
  }

  async clearSample(session: SessionPayload) {
    this.assertLeader(session);
    const result = await this.provisioning.clearSample(session.schoolId, session.userId);
    return { removed: result.removed, fields: [["Removed", `${result.removed} sample students, with their attendance, scores and report cards`], ["Kept", "Your classes, subjects, grading scale and everything you added"]] };
  }

  /** The address on the account was wrong: change it while it is still unverified, and send the code to the new one. */
  async changeEmail(session: SessionPayload, payload: unknown) {
    const { email } = z.object({ email: z.string().trim().email("Enter a valid email address") }).parse(payload);
    const next = email.toLowerCase();
    const user = await prisma.user.findUnique({ where: { id: session.userId } });
    if (!user) throw new NotFoundException("No account found.");
    if (user.emailVerifiedAt) throw new BadRequestException("This email address is already verified. Change it from your profile.");
    if (next === user.email) return { email: next, changed: false };
    if (await prisma.user.findUnique({ where: { email: next }, select: { id: true } })) throw new ConflictException("An account with that email address already exists.");
    await prisma.$transaction([
      prisma.user.update({ where: { id: user.id }, data: { email: next } }),
      prisma.emailVerificationCode.updateMany({ where: { userId: user.id, consumedAt: null }, data: { consumedAt: new Date() } }),
      ...(user.email === (await prisma.school.findUnique({ where: { id: user.schoolId }, select: { ownerEmail: true } }))?.ownerEmail ? [prisma.school.update({ where: { id: user.schoolId }, data: { ownerEmail: next } })] : []),
    ]);
    await prisma.auditLog.create({ data: { schoolId: user.schoolId, actorId: user.id, action: "UPDATE", entityType: "User", entityId: user.id, metadata: { summary: "Sign-up email corrected before verification", from: user.email, to: next } } });
    await this.issueVerificationCode(user.id, next);
    return { email: next, changed: true };
  }

  /* ───────────────────────── teachers asking to join ───────────────────────── */

  async joinRequests(session: SessionPayload) {
    this.assertLeader(session);
    const rows = await prisma.schoolJoinRequest.findMany({ where: { schoolId: session.schoolId }, orderBy: { createdAt: "desc" }, take: 100, include: { user: { select: { id: true, firstName: true, lastName: true, email: true, phone: true, jobTitle: true, userCode: true } } } });
    return rows.map((row) => ({ id: row.id, status: row.status, name: `${row.user.firstName} ${row.user.lastName}`.trim(), position: row.user.jobTitle, email: row.user.email, phone: row.user.phone, userCode: row.user.userCode, subjects: row.subjects, levels: row.levels, claimed: row.nameClaimed, note: row.note, at: row.createdAt.toISOString() }));
  }

  /** Approving links the teacher's own account to this school: they keep the login and the User ID, and gain the school. */
  async decideJoinRequest(session: SessionPayload, id: string, payload: unknown) {
    this.assertLeader(session);
    const input = z.object({ decision: z.enum(["APPROVE", "DECLINE"]), note: z.string().trim().max(300).optional() }).parse(payload);
    const request = await prisma.schoolJoinRequest.findFirst({ where: { id, schoolId: session.schoolId, status: "PENDING" }, include: { user: { include: { school: true } } } });
    if (!request) throw new NotFoundException("That request has already been decided, or does not exist.");
    const teacher = request.user;
    const targetSchool = await prisma.school.findUnique({ where: { id: session.schoolId }, select: { name: true } });
    if (input.decision === "DECLINE") {
      await prisma.schoolJoinRequest.update({ where: { id }, data: { status: "DECLINED", decidedAt: new Date(), decidedById: session.userId, note: input.note ?? null } });
      await prisma.notificationLog.create({ data: { schoolId: teacher.schoolId, userId: teacher.id, channel: "IN_APP", title: "Your request to join a school was declined", body: `${targetSchool?.name ?? "The school"} did not link your account.${input.note ? ` ${input.note}` : ""} Your own workspace is unchanged.`, status: "QUEUED", sentAt: new Date() } });
      return { decision: "DECLINE", fields: [["Teacher", `${teacher.firstName} ${teacher.lastName}`.trim()], ["Result", "Declined — their own workspace is unchanged"]] };
    }
    const workspaceId = teacher.schoolId;
    const employeeNo = `T-${(teacher.userCode ?? teacher.id.slice(-5)).replace(/^TC-/, "")}`;
    await prisma.$transaction([
      prisma.user.update({ where: { id: teacher.id }, data: { schoolId: session.schoolId } }),
      prisma.staffProfile.create({ data: { schoolId: session.schoolId, userId: teacher.id, employeeNo, designation: teacher.jobTitle ?? "Teacher", staffType: "ACADEMIC", employmentDate: new Date(), notes: "Linked from a teacher's own workspace" } }),
      prisma.schoolJoinRequest.update({ where: { id }, data: { status: "APPROVED", decidedAt: new Date(), decidedById: session.userId, note: input.note ?? null } }),
      ...(workspaceId !== session.schoolId ? [prisma.school.update({ where: { id: workspaceId }, data: { status: "ARCHIVED", archivedAt: new Date(), statusReason: "Teacher linked to a school" } })] : []),
    ]);
    await prisma.auditLog.create({ data: { schoolId: session.schoolId, actorId: session.userId, action: "UPDATE", entityType: "User", entityId: teacher.id, metadata: { summary: `Teacher linked to the school · ${teacher.firstName} ${teacher.lastName}`.trim(), userCode: teacher.userCode } } });
    await prisma.notificationLog.create({ data: { schoolId: session.schoolId, userId: teacher.id, channel: "IN_APP", title: "You are now linked to a school", body: "Your account keeps its login and its User ID, and now belongs to the school. Sign in again to see it.", status: "QUEUED", sentAt: new Date() } });
    return { decision: "APPROVE", fields: [["Teacher", `${teacher.firstName} ${teacher.lastName}`.trim()], ["Result", "Linked — they sign in again to see the school"], ["User ID", teacher.userCode ?? "—"]] };
  }
}
