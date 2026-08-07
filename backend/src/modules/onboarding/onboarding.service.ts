import { ConflictException, Injectable } from "@nestjs/common";
import { z } from "zod";

import { hashPassword } from "../../../../src/lib/auth/password";
import { prisma } from "../../../../src/lib/db/prisma";
import { sendNotification } from "../../../../src/lib/integrations/notifications";
import type { Role, SessionUser } from "../../../../src/lib/domain/types";

const registerSchoolSchema = z.object({
  schoolName: z.string().trim().min(2, "School name must be at least 2 characters"),
  category: z.enum(["NURSERY", "PRIMARY", "SECONDARY", "COLLEGE", "MIXED"]).default("MIXED"),
  ownerName: z.string().trim().min(2, "Owner name must be at least 2 characters"),
  ownerEmail: z.string().trim().email("Enter a valid email address"),
  ownerPhone: z.string().trim().optional(),
  password: z.string().min(8, "Password must be at least 8 characters"),
  address: z.string().trim().optional(),
  city: z.string().trim().optional(),
  state: z.string().trim().optional()
});

const TRIAL_DAYS = 14;

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

@Injectable()
export class OnboardingService {
  async registerSchool(payload: unknown) {
    const parsed = registerSchoolSchema.parse(payload);
    const ownerEmail = parsed.ownerEmail.toLowerCase();

    const existingUser = await prisma.user.findUnique({ where: { email: ownerEmail } });
    if (existingUser) {
      throw new ConflictException("An account with this email already exists. Please sign in instead.");
    }

    const baseSlug = slugify(parsed.schoolName) || "school";
    const slug = `${baseSlug}-${Date.now().toString(36)}`;
    const schoolCode = `SCH-${Date.now().toString(36).toUpperCase()}`;
    const ownerNameParts = splitName(parsed.ownerName);
    const trialEndsAt = new Date(Date.now() + TRIAL_DAYS * 24 * 60 * 60 * 1000);

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
}
