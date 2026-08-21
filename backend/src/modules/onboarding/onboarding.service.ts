import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { z } from "zod";

import { hashPassword, verifyPassword } from "../../../../src/lib/auth/password";
import { prisma } from "../../../../src/lib/db/prisma";
import { sendNotification } from "../../../../src/lib/integrations/notifications";
import { sendEmail } from "../../../../src/lib/integrations/mailer";
import type { Role, SessionUser } from "../../../../src/lib/domain/types";

const registerSchoolSchema = z.object({
  schoolName: z.string().trim().min(2, "School name must be at least 2 characters"),
  slug: z.string().trim().optional(),
  category: z.enum(["NURSERY", "PRIMARY", "SECONDARY", "COLLEGE", "MIXED"]).default("MIXED"),
  ownerName: z.string().trim().min(2, "Owner name must be at least 2 characters"),
  ownerEmail: z.string().trim().email("Enter a valid email address"),
  ownerPhone: z.string().trim().optional(),
  password: z.string().min(8, "Password must be at least 8 characters"),
  address: z.string().trim().optional(),
  city: z.string().trim().optional(),
  state: z.string().trim().optional(),
  cacNumber: z.string().trim().optional(),
  ministryApprovalNumber: z.string().trim().optional()
});

const teacherPositionSchema = z.enum(["SUBJECT_TEACHER", "CLASS_TEACHER", "HEAD_OF_DEPARTMENT"]);

const registerTeacherSchema = z.object({
  firstName: z.string().trim().min(1, "First name is required"),
  lastName: z.string().trim().min(1, "Last name is required"),
  gender: z.enum(["MALE", "FEMALE", "OTHER"]).optional(),
  phone: z.string().trim().optional(),
  email: z.string().trim().email("Enter a valid email address"),
  position: teacherPositionSchema.default("SUBJECT_TEACHER"),
  country: z.string().trim().optional(),
  schoolName: z.string().trim().optional(),
  subjects: z.array(z.string()).default([]),
  level: z.enum(["Primary", "JSS", "SSS"]).optional(),
  password: z.string().min(8, "Password must be at least 8 characters")
});

const verifyEmailSchema = z.object({
  email: z.string().trim().email("Enter a valid email address"),
  code: z.string().trim().min(4).max(8)
});

const resendVerificationSchema = z.object({
  email: z.string().trim().email("Enter a valid email address")
});

const TRIAL_DAYS = 14;
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

function flagSchoolForReview(input: {
  cacNumber?: string;
  ministryApprovalNumber?: string;
  address?: string;
  city?: string;
  state?: string;
  ownerEmail: string;
}): string | null {
  const reasons: string[] = [];

  if (!input.cacNumber && !input.ministryApprovalNumber) {
    reasons.push("No CAC or Ministry of Education approval number provided");
  }
  if (!input.address && !input.city && !input.state) {
    reasons.push("No physical address on file");
  }
  const emailDomain = input.ownerEmail.split("@")[1]?.toLowerCase();
  if (emailDomain && FREE_EMAIL_DOMAINS.has(emailDomain) && !input.cacNumber) {
    reasons.push("Owner registered with a personal webmail address and no CAC number");
  }

  return reasons.length > 0 ? reasons.join("; ") : null;
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

const teacherPositionToRole: Record<z.infer<typeof teacherPositionSchema>, Role> = {
  SUBJECT_TEACHER: "SUBJECT_TEACHER",
  CLASS_TEACHER: "CLASS_TEACHER",
  HEAD_OF_DEPARTMENT: "HEAD_OF_DEPARTMENT"
};

@Injectable()
export class OnboardingService {
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

  async registerSchool(payload: unknown) {
    const parsed = registerSchoolSchema.parse(payload);
    const ownerEmail = parsed.ownerEmail.toLowerCase();

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
    const trialEndsAt = new Date(Date.now() + TRIAL_DAYS * 24 * 60 * 60 * 1000);
    const flaggedForReviewReason = flagSchoolForReview({
      cacNumber: parsed.cacNumber,
      ministryApprovalNumber: parsed.ministryApprovalNumber,
      address: parsed.address,
      city: parsed.city,
      state: parsed.state,
      ownerEmail
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
        state: parsed.state,
        cacNumber: parsed.cacNumber,
        ministryApprovalNumber: parsed.ministryApprovalNumber,
        flaggedForReviewReason,
        country: "Nigeria",
        plan: "BASIC",
        status: "TRIAL",
        billingStatus: "TRIAL",
        trialEndsAt,
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
            passwordHash: hashPassword(parsed.password),
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

    await sendNotification({
      channel: "EMAIL",
      recipient: ownerEmail,
      title: "Welcome to FutureRealm SMS",
      body: `Your school workspace for ${school.name} is ready. Your 14-day trial ends on ${trialEndsAt.toDateString()}.`
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
      school: { id: school.id, name: school.name, slug: school.slug, trialEndsAt }
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
    const role = teacherPositionToRole[parsed.position];

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
            passwordHash: hashPassword(parsed.password),
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
          level: parsed.level || null
        }
      }
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
      school: { id: workspace.id, name: workspace.name, slug: workspace.slug, trialEndsAt: null }
    };
  }

  async checkSlugAvailability(rawSlug: string) {
    const evaluation = await this.evaluateSlug(rawSlug);
    return evaluation;
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
      includedModules: plan.includedModules as string[]
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
}
