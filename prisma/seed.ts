import { PrismaClient, PrismaPromise, UserRole } from "@prisma/client";

import { isPlatformRole } from "../src/lib/auth/role-architecture";
import { hashPassword } from "../src/lib/auth/password";
import {
  nigerianTermGradeBands,
  resolveGradeLabel,
} from "../src/lib/domain/grading";
import { nigerianSubjectDefaults } from "../src/lib/nigerian-subjects";
import {
  permissionCatalog,
  systemRoleLabels,
  systemRolePermissionKeys,
} from "../src/lib/permissions/catalog";
import { nigeriaClassOptions } from "../src/lib/school-options";

function withSeedConnectionLimit(rawUrl?: string) {
  if (!rawUrl) return rawUrl;
  try {
    const parsed = new URL(rawUrl);
    if (!parsed.searchParams.has("connection_limit")) {
      parsed.searchParams.set("connection_limit", "1");
    }
    return parsed.toString();
  } catch {
    return rawUrl;
  }
}

const seedDatabaseUrl = withSeedConnectionLimit(
  process.env.DIRECT_URL || process.env.DATABASE_URL,
);

const prisma = new PrismaClient(
  seedDatabaseUrl
    ? {
        datasources: {
          db: {
            url: seedDatabaseUrl,
          },
        },
      }
    : undefined,
);

const systemRoleCache = new Map<string, string | null>();
const SEEDED_STUDENTS_PER_CLASS = 10;
const SEEDED_GUARDIANS_PER_CLASS = 3;

function seedUserRole(value: string) {
  return value as UserRole;
}

const sectionAssessmentDefaults = [
  {
    name: "Assignment",
    code: "ASSIGNMENT",
    type: "ASSIGNMENT",
    weight: 10,
    maxScore: 10,
    order: 1,
  },
  {
    name: "Classwork",
    code: "CLASSWORK",
    type: "CLASSWORK",
    weight: 10,
    maxScore: 10,
    order: 2,
  },
  {
    name: "Test 1",
    code: "TEST_1",
    type: "TEST",
    weight: 10,
    maxScore: 10,
    order: 3,
  },
  {
    name: "Test 2",
    code: "TEST_2",
    type: "TEST",
    weight: 10,
    maxScore: 10,
    order: 4,
  },
  {
    name: "Project",
    code: "PROJECT",
    type: "PROJECT",
    weight: 10,
    maxScore: 10,
    order: 5,
  },
  {
    name: "Practical",
    code: "PRACTICAL",
    type: "PRACTICAL",
    weight: 10,
    maxScore: 10,
    order: 6,
  },
  {
    name: "Terminal Examination",
    code: "EXAM",
    type: "EXAMINATION",
    weight: 40,
    maxScore: 40,
    order: 7,
  },
] as const;

const academicSections = [
  "CRECHE",
  "NURSERY",
  "PRIMARY",
  "JUNIOR_SECONDARY",
  "SENIOR_SECONDARY",
] as const;

const cohortNames = [
  ["Ayo", "Balogun", "MALE"],
  ["Zainab", "Lawal", "FEMALE"],
  ["Chiamaka", "Nwosu", "FEMALE"],
  ["Favour", "Okafor", "FEMALE"],
  ["Malik", "Adebayo", "MALE"],
  ["Ruth", "Ekanem", "FEMALE"],
  ["Tomiwa", "Akinola", "MALE"],
  ["Nifemi", "Ojo", "FEMALE"],
  ["David", "Ibe", "MALE"],
] as const;

const secondaryCohortProfiles = [
  ["Ayomide", "MALE"],
  ["Ebunoluwa", "FEMALE"],
  ["Chinonso", "MALE"],
  ["Temiloluwa", "FEMALE"],
  ["Oluwaseun", "MALE"],
  ["Somtochukwu", "FEMALE"],
  ["Kehinde", "MALE"],
  ["Ifeoluwa", "FEMALE"],
  ["Daniel", "MALE"],
  ["Adaobi", "FEMALE"],
  ["Timilehin", "MALE"],
  ["Opeyemi", "FEMALE"],
  ["Ayobami", "MALE"],
  ["Mmesoma", "FEMALE"],
  ["Fiyinfoluwa", "MALE"],
  ["Chisom", "FEMALE"],
  ["Abdulrahman", "MALE"],
  ["Onyinyechi", "FEMALE"],
  ["Tobechukwu", "MALE"],
  ["Anjolaoluwa", "FEMALE"],
  ["Victory", "MALE"],
  ["Damilola", "FEMALE"],
  ["Imoleayo", "MALE"],
  ["Amarachi", "FEMALE"],
  ["Pelumi", "MALE"],
  ["Mariam", "FEMALE"],
  ["Toluwanimi", "MALE"],
  ["Oluwatamilore", "FEMALE"],
  ["Michael", "MALE"],
  ["Olaitan", "FEMALE"],
  ["Samuel", "MALE"],
  ["Praise", "FEMALE"],
  ["Joshua", "MALE"],
  ["Mercy", "FEMALE"],
  ["Tobi", "MALE"],
  ["Favour", "FEMALE"],
  ["Godwin", "MALE"],
  ["Deborah", "FEMALE"],
  ["Emmanuel", "MALE"],
  ["Esther", "FEMALE"],
  ["Azeez", "MALE"],
  ["Hadassah", "FEMALE"],
  ["Bright", "MALE"],
  ["Olufunke", "FEMALE"],
  ["Davidson", "MALE"],
  ["Happiness", "FEMALE"],
  ["Elijah", "MALE"],
  ["Winifred", "FEMALE"],
  ["Jonathan", "MALE"],
  ["Simi", "FEMALE"],
] as const;

const secondaryCohortLastNames = [
  "Adeyemi",
  "Okonkwo",
  "Bassey",
  "Adebayo",
  "Nwachukwu",
  "Bakare",
  "Ekanem",
  "Ogunleye",
  "Mohammed",
  "Ibeh",
] as const;

const guardianMotherNames = [
  "Kemi",
  "Amina",
  "Chinwe",
  "Bisi",
  "Ngozi",
  "Hauwa",
  "Funmilayo",
  "Ifeoma",
  "Ruth",
  "Zainab",
] as const;

const guardianFatherNames = [
  "Adewale",
  "Musa",
  "Chinedu",
  "Tunde",
  "Ibrahim",
  "Emeka",
  "Segun",
  "Sani",
  "Paul",
  "Kunle",
] as const;

function buildSecondaryCohortNames(size: number) {
  return Array.from({ length: size }, (_, index) => {
    const [firstName, gender] = secondaryCohortProfiles[index % secondaryCohortProfiles.length];
    const lastName =
      secondaryCohortLastNames[
        Math.floor(index / secondaryCohortProfiles.length) % secondaryCohortLastNames.length
      ];
    return [firstName, lastName, gender] as const;
  });
}

function normalizeForEmail(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function buildStudentPortalEmail(student: {
  admissionNumber: string;
  studentNumber: string | null;
}) {
  const base = normalizeForEmail(student.studentNumber ?? student.admissionNumber);
  return `${base}@students.greenfieldcollege.ng`;
}

function buildGuardianPortalEmail(guardian: {
  firstName: string;
  lastName: string;
  phone: string;
}) {
  const namePart = normalizeForEmail(`${guardian.firstName}-${guardian.lastName}`);
  const phoneTail = guardian.phone.replace(/\D/g, "").slice(-4) || "0000";
  return `${namePart}-${phoneTail}@parents.greenfieldcollege.ng`;
}

function printCredentialGroup(title: string, entries: string[], password = "FutureRealm123!") {
  console.log(`\n${title}`);
  for (const entry of entries) {
    console.log(`  - ${entry}`);
  }
  console.log(`  Password: ${password}`);
}

type SeedSchemeTopic = {
  topic: string;
  subtopics?: string[];
  behaviouralObjectives?: string;
  content?: string;
  teachingMethods?: string[];
  teachingAids?: string[];
  referenceMaterials?: string[];
  evaluation?: string;
  assignment?: string;
  weekType?: "TEACHING" | "REVISION" | "EXAM" | "HOLIDAY" | "ACTIVITY";
};

async function createSeedSchemeOfWork({
  schoolId,
  academicSessionId,
  termId,
  subjectId,
  classId,
  teacherId,
  submittedById,
  approvedById,
  topics,
  coveredTeachingWeeks = 0,
}: {
  schoolId: string;
  academicSessionId: string;
  termId: string;
  subjectId: string;
  classId: string;
  teacherId?: string | null;
  submittedById?: string | null;
  approvedById?: string | null;
  topics: SeedSchemeTopic[];
  coveredTeachingWeeks?: number;
}) {
  const scheme = await prisma.schemeOfWork.create({
    data: {
      schoolId,
      academicSessionId,
      termId,
      subjectId,
      classId,
      teacherId: teacherId ?? null,
      status: "APPROVED",
      submittedAt: submittedById ? new Date("2026-02-10T08:00:00.000Z") : null,
      submittedById: submittedById ?? null,
      approvedAt: approvedById ? new Date("2026-02-12T10:00:00.000Z") : null,
      approvedById: approvedById ?? null,
    },
  });

  let coveredCounter = 0;
  const teachingDates = [
    "2026-02-16",
    "2026-02-23",
    "2026-03-02",
    "2026-03-09",
    "2026-03-16",
    "2026-03-23",
    "2026-03-30",
    "2026-04-06",
    "2026-04-13",
  ];

  await prisma.sowTopic.createMany({
    data: topics.map((topic, index) => {
      const weekType = topic.weekType ?? "TEACHING";
      const shouldCover = weekType === "TEACHING" && coveredCounter < coveredTeachingWeeks;
      const coveredDate = shouldCover ? new Date(`${teachingDates[coveredCounter] ?? teachingDates.at(-1)}T08:00:00.000Z`) : null;
      if (shouldCover) coveredCounter += 1;

      return {
        schoolId,
        schemeOfWorkId: scheme.id,
        weekNumber: index + 1,
        topic: topic.topic,
        subtopics: topic.subtopics ?? [],
        behaviouralObjectives: topic.behaviouralObjectives ?? null,
        content: topic.content ?? null,
        teachingMethods: topic.teachingMethods ?? [],
        teachingAids: topic.teachingAids ?? [],
        referenceMaterials: topic.referenceMaterials ?? [],
        evaluation: topic.evaluation ?? null,
        assignment: topic.assignment ?? null,
        isCovered: shouldCover,
        coveredDate,
        coveredById: shouldCover ? teacherId ?? null : null,
        actualTopicTaught: shouldCover ? topic.topic : null,
        coverageNotes: shouldCover ? "Delivered according to term plan with class exercise and short feedback notes." : null,
        weekType,
        sortOrder: index + 1,
      };
    }),
  });

  return scheme;
}

async function runSeedBatches(
  operations: Array<() => PrismaPromise<unknown>>,
  batchSize = 20,
) {
  for (let index = 0; index < operations.length; index += batchSize) {
    const chunk = operations
      .slice(index, index + batchSize)
      .map((operation) => operation());
    await prisma.$transaction(chunk);
  }
}

async function runSequential<T>(operations: Array<() => Promise<T>>) {
  const results: T[] = [];
  for (const operation of operations) {
    results.push(await operation());
  }
  return results;
}

async function clearDatabase() {
  const operations: Array<() => PrismaPromise<unknown>> = [
    prisma.webhookDeliveryLog.deleteMany(),
    prisma.webhookEndpoint.deleteMany(),
    prisma.apiUsageLog.deleteMany(),
    prisma.apiKey.deleteMany(),
    prisma.knowledgeBaseArticle.deleteMany(),
    prisma.backupRecord.deleteMany(),
    prisma.ipAccessRule.deleteMany(),
    prisma.loginAttempt.deleteMany(),
    prisma.platformSession.deleteMany(),
    prisma.maintenanceWindow.deleteMany(),
    prisma.emailTemplate.deleteMany(),
    prisma.dataPrivacyRequest.deleteMany(),
    prisma.npsResponse.deleteMany(),
    prisma.lead.deleteMany(),
    prisma.crmNote.deleteMany(),
    prisma.crmInteraction.deleteMany(),
    prisma.platformAnnouncementView.deleteMany(),
    prisma.platformAnnouncement.deleteMany(),
    prisma.platformFeatureFlagOverride.deleteMany(),
    prisma.platformFeatureFlag.deleteMany(),
    prisma.ticketMessage.deleteMany(),
    prisma.supportTicket.deleteMany(),
    prisma.taxRate.deleteMany(),
    prisma.platformRefund.deleteMany(),
    prisma.promoCode.deleteMany(),
    prisma.platformDiscount.deleteMany(),
    prisma.platformBillingTransaction.deleteMany(),
    prisma.platformInvoice.deleteMany(),
    prisma.platformSubscriptionPlan.deleteMany(),
    prisma.schoolGroup.deleteMany(),
    prisma.platformSetting.deleteMany(),
    prisma.userPermissionOverride.deleteMany(),
    prisma.userRoleAssignment.deleteMany(),
    prisma.rolePermission.deleteMany(),
    prisma.role.deleteMany(),
    prisma.permission.deleteMany(),
    prisma.profileEditRequest.deleteMany(),
    prisma.profileDocument.deleteMany(),
    prisma.syncDraft.deleteMany(),
    prisma.auditLog.deleteMany(),
    prisma.notificationLog.deleteMany(),
    prisma.subjectCombination.deleteMany(),
    prisma.promotionRule.deleteMany(),
    prisma.resultEntryWindow.deleteMany(),
    prisma.budgetLine.deleteMany(),
    prisma.budget.deleteMany(),
    prisma.transportVehicle.deleteMany(),
    prisma.invigilationAssignment.deleteMany(),
    prisma.examSeatingPlan.deleteMany(),
    prisma.externalExam.deleteMany(),
    prisma.parentMeeting.deleteMany(),
    prisma.idCard.deleteMany(),
    prisma.facilityMaintenanceLog.deleteMany(),
    prisma.inventoryItem.deleteMany(),
    prisma.visitorLog.deleteMany(),
    prisma.questionBankItem.deleteMany(),
    prisma.lessonPlan.deleteMany(),
    prisma.studentTopicProgress.deleteMany(),
    prisma.sowTopicResource.deleteMany(),
    prisma.sowTopic.deleteMany(),
    prisma.schemeOfWork.deleteMany(),
    prisma.learningMaterial.deleteMany(),
    prisma.healthVisit.deleteMany(),
    prisma.counselingRecord.deleteMany(),
    prisma.disciplineRecord.deleteMany(),
    prisma.internalMessage.deleteMany(),
    prisma.announcement.deleteMany(),
    prisma.assignmentSubmission.deleteMany(),
    prisma.assignment.deleteMany(),
    prisma.trainingParticipant.deleteMany(),
    prisma.trainingProgram.deleteMany(),
    prisma.staffAttendanceAudit.deleteMany(),
    prisma.staffAttendancePolicy.deleteMany(),
    prisma.curriculumTopic.deleteMany(),
    prisma.receipt.deleteMany(),
    prisma.paymentAllocation.deleteMany(),
    prisma.invoiceAdjustment.deleteMany(),
    prisma.installmentPlanItem.deleteMany(),
    prisma.installmentPlan.deleteMany(),
    prisma.financialClearance.deleteMany(),
    prisma.payment.deleteMany(),
    prisma.invoiceItem.deleteMany(),
    prisma.invoice.deleteMany(),
    prisma.feeStructureItem.deleteMany(),
    prisma.feeStructure.deleteMany(),
    prisma.studentAttendance.deleteMany(),
    prisma.reportCard.deleteMany(),
    prisma.seniorSecondaryResultArchive.deleteMany(),
    prisma.broadsheetApprovalHistory.deleteMany(),
    prisma.broadsheet.deleteMany(),
    prisma.assessmentScoreAudit.deleteMany(),
    prisma.assessmentCandidate.deleteMany(),
    prisma.scoreEntry.deleteMany(),
    prisma.academicAssessment.deleteMany(),
    prisma.resultApproval.deleteMany(),
    prisma.resultPublication.deleteMany(),
    prisma.resultSheet.deleteMany(),
    prisma.sectionAssessmentComponent.deleteMany(),
    prisma.assessmentComponent.deleteMany(),
    prisma.gradeBand.deleteMany(),
    prisma.gradingScheme.deleteMany(),
    prisma.classSubject.deleteMany(),
    prisma.subject.deleteMany(),
    prisma.subjectCategory.deleteMany(),
    prisma.leaveRequest.deleteMany(),
    prisma.staffAttendance.deleteMany(),
    prisma.libraryLoan.deleteMany(),
    prisma.libraryBook.deleteMany(),
    prisma.transportAssignment.deleteMany(),
    prisma.transportRoute.deleteMany(),
    prisma.hostelAllocation.deleteMany(),
    prisma.hostelRoom.deleteMany(),
    prisma.hostelBuilding.deleteMany(),
    prisma.enrollmentConversionLog.deleteMany(),
    prisma.admissionPaymentLink.deleteMany(),
    prisma.admissionComment.deleteMany(),
    prisma.admissionStatusHistory.deleteMany(),
    prisma.admissionOffer.deleteMany(),
    prisma.admissionScreening.deleteMany(),
    prisma.admissionDocument.deleteMany(),
    prisma.admissionReview.deleteMany(),
    prisma.admissionApplication.deleteMany(),
    prisma.admissionConfig.deleteMany(),
    prisma.studentDocument.deleteMany(),
    prisma.behaviorLog.deleteMany(),
    prisma.medicalRecord.deleteMany(),
    prisma.studentGuardian.deleteMany(),
    prisma.promotionRecord.deleteMany(),
    prisma.student.deleteMany(),
    prisma.guardian.deleteMany(),
    prisma.staffProfile.deleteMany(),
    prisma.integrationConfig.deleteMany(),
    prisma.calendarEvent.deleteMany(),
    prisma.examTimetableEntry.deleteMany(),
    prisma.timetablePublishLog.deleteMany(),
    prisma.timetableEntry.deleteMany(),
    prisma.classRoom.deleteMany(),
    prisma.classLevel.deleteMany(),
    prisma.department.deleteMany(),
    prisma.term.deleteMany(),
    prisma.academicSession.deleteMany(),
    prisma.campus.deleteMany(),
    prisma.user.deleteMany(),
    prisma.school.deleteMany(),
  ].map((operation) => () => operation);

  console.log(
    `Clearing existing data in ${Math.ceil(operations.length / 20)} batches using ${process.env.DIRECT_URL ? "DIRECT_URL" : "DATABASE_URL"}...`,
  );

  await runSeedBatches(operations);
}

async function seedPermissionsAndRoles(schoolId: string, createdById: string) {
  await prisma.permission.createMany({
    data: permissionCatalog.map((permissionItem) => ({
      key: permissionItem.key,
      module: permissionItem.module,
      label: permissionItem.label,
      description: permissionItem.description,
    })),
    skipDuplicates: true,
  });

  const permissions = await prisma.permission.findMany();
  const permissionByKey = new Map(
    permissions.map((permissionItem) => [
      permissionItem.key,
      permissionItem.id,
    ]),
  );

  for (const [role, keys] of Object.entries(systemRolePermissionKeys)) {
    if (isPlatformRole(role)) continue;
    const label = systemRoleLabels[role as keyof typeof systemRoleLabels];
    if (!label) continue;
    const systemRole = await prisma.role.create({
      data: {
        schoolId,
        name: label.name,
        slug: role.toLowerCase(),
        description: label.description,
        isSystem: true,
        systemRole: role as UserRole,
        createdById,
      },
    });
    await prisma.rolePermission.createMany({
      data: keys
        .map((key) => permissionByKey.get(key))
        .filter(Boolean)
        .map((permissionId) => ({
          roleId: systemRole.id,
          permissionId: permissionId as string,
        })),
      skipDuplicates: true,
    });
  }
}

async function assignSystemRole(
  schoolId: string,
  userId: string,
  role: UserRole,
  assignedById: string,
) {
  const cacheKey = `${schoolId}:${role}`;
  let systemRoleId = systemRoleCache.get(cacheKey);

  if (systemRoleId === undefined) {
    const systemRole = await prisma.role.findFirst({
      where: { schoolId, systemRole: role },
      select: { id: true },
    });
    systemRoleId = systemRole?.id ?? null;
    systemRoleCache.set(cacheKey, systemRoleId);
  }

  if (!systemRoleId) return;
  await prisma.userRoleAssignment.create({
    data: { schoolId, userId, roleId: systemRoleId, assignedById },
  });
}

async function provisionStudentPortalAccounts({
  schoolId,
  passwordHash,
  assignedById,
}: {
  schoolId: string;
  passwordHash: string;
  assignedById: string;
}) {
  const studentsWithoutUsers = await prisma.student.findMany({
    where: {
      schoolId,
      userId: null,
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      admissionNumber: true,
      studentNumber: true,
    },
    orderBy: [{ admissionNumber: "asc" }],
  });

  console.log(
    `[seed 05] Provisioning ${studentsWithoutUsers.length} student portal account(s)...`,
  );

  for (const [index, student] of studentsWithoutUsers.entries()) {
    const user = await prisma.user.create({
      data: {
        schoolId,
        email: buildStudentPortalEmail(student),
        firstName: student.firstName,
        lastName: student.lastName,
        passwordHash,
        role: "STUDENT",
      },
    });

    await prisma.student.update({
      where: { id: student.id },
      data: { userId: user.id },
    });

    await assignSystemRole(schoolId, user.id, "STUDENT", assignedById);

    if ((index + 1) % 25 === 0 || index === studentsWithoutUsers.length - 1) {
      console.log(
        `[seed 05] Student portal accounts: ${index + 1}/${studentsWithoutUsers.length}`,
      );
    }
  }
}

async function resetStudentPortalPasswords({
  schoolId,
  passwordHash,
}: {
  schoolId: string;
  passwordHash: string;
}) {
  const linkedStudentUsers = await prisma.student.findMany({
    where: {
      schoolId,
      userId: { not: null },
    },
    select: {
      userId: true,
    },
  });

  const userIds = linkedStudentUsers
    .map((item) => item.userId)
    .filter((item): item is string => Boolean(item));

  if (userIds.length === 0) return;

  await prisma.user.updateMany({
    where: { schoolId, id: { in: userIds } },
    data: { passwordHash },
  });
}

async function provisionGuardianPortalAccounts({
  schoolId,
  passwordHash,
  assignedById,
}: {
  schoolId: string;
  passwordHash: string;
  assignedById: string;
}) {
  const guardiansWithoutUsers = await prisma.guardian.findMany({
    where: {
      schoolId,
      userId: null,
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      phone: true,
    },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  });

  console.log(
    `[seed 05] Provisioning ${guardiansWithoutUsers.length} guardian portal account(s)...`,
  );

  for (const [index, guardian] of guardiansWithoutUsers.entries()) {
    const user = await prisma.user.create({
      data: {
        schoolId,
        email: buildGuardianPortalEmail(guardian),
        firstName: guardian.firstName,
        lastName: guardian.lastName,
        passwordHash,
        role: "PARENT",
      },
    });

    await prisma.guardian.update({
      where: { id: guardian.id },
      data: { userId: user.id },
    });

    await assignSystemRole(schoolId, user.id, "PARENT", assignedById);

    if ((index + 1) % 25 === 0 || index === guardiansWithoutUsers.length - 1) {
      console.log(
        `[seed 05] Guardian portal accounts: ${index + 1}/${guardiansWithoutUsers.length}`,
      );
    }
  }
}

async function provisionStudentGuardians({
  schoolId,
  assignedById,
  passwordHash,
}: {
  schoolId: string;
  assignedById: string;
  passwordHash: string;
}) {
  const existingGuardianLinks = await prisma.student.findMany({
    where: {
      schoolId,
      currentClassId: { not: null },
      guardians: { some: {} },
    },
    select: {
      currentClassId: true,
      guardians: {
        select: { guardianId: true },
      },
    },
  });

  const remainingGuardianSlotsByClass = new Map<string, number>();
  for (const student of existingGuardianLinks) {
    const classId = student.currentClassId;
    if (!classId) continue;
    const current = remainingGuardianSlotsByClass.get(classId) ?? SEEDED_GUARDIANS_PER_CLASS;
    remainingGuardianSlotsByClass.set(
      classId,
      Math.max(0, current - student.guardians.length),
    );
  }

  const studentsWithoutGuardians = await prisma.student.findMany({
    where: {
      schoolId,
      guardians: {
        none: {},
      },
    },
    select: {
      id: true,
      currentClassId: true,
      firstName: true,
      lastName: true,
      admissionNumber: true,
      gender: true,
      stateOfOrigin: true,
    },
    orderBy: [{ currentClassId: "asc" }, { admissionNumber: "asc" }],
  });

  const eligibleStudents = studentsWithoutGuardians.filter((student) => {
    const classId = student.currentClassId;
    if (!classId) return false;
    const remaining = remainingGuardianSlotsByClass.get(classId);
    if (remaining === undefined) return true;
    return remaining > 0;
  });

  const classesWithNoExistingGuardianLinks = new Set<string>();
  for (const student of studentsWithoutGuardians) {
    const classId = student.currentClassId;
    if (!classId || remainingGuardianSlotsByClass.has(classId)) continue;
    classesWithNoExistingGuardianLinks.add(classId);
  }

  const guardianLinksTarget =
    [...remainingGuardianSlotsByClass.values()].reduce(
      (sum, value) => sum + Math.max(0, value),
      0,
    ) +
    classesWithNoExistingGuardianLinks.size * SEEDED_GUARDIANS_PER_CLASS;

  console.log(
    `[seed 05] Creating up to ${guardianLinksTarget} guardian link(s) to reach ${SEEDED_GUARDIANS_PER_CLASS} guardian link(s) per class...`,
  );

  let processedCount = 0;

  for (const student of eligibleStudents) {
    const classId = student.currentClassId;
    if (!classId) continue;

    const remaining = remainingGuardianSlotsByClass.get(classId) ?? SEEDED_GUARDIANS_PER_CLASS;
    if (remaining <= 0) continue;

    const relationship = processedCount % 2 === 0 ? "Mother" : "Father";
    const guardianFirstName =
      relationship === "Mother"
        ? guardianMotherNames[processedCount % guardianMotherNames.length]
        : guardianFatherNames[processedCount % guardianFatherNames.length];
    const phone = `0805${String(processedCount + 1).padStart(7, "0")}`;
    const guardian = await prisma.guardian.create({
      data: {
        schoolId,
        firstName: guardianFirstName,
        lastName: student.lastName,
        phone,
        email: `${normalizeForEmail(student.admissionNumber)}@parents.greenfieldcollege.ng`,
        relationship,
        occupation:
          relationship === "Mother" ? "Business Owner" : "Civil Servant",
        address: `${student.stateOfOrigin ?? "Oyo"} Residence, Ibadan`,
      },
    });

    await prisma.studentGuardian.create({
      data: {
        studentId: student.id,
        guardianId: guardian.id,
        isPrimary: true,
      },
    });

    remainingGuardianSlotsByClass.set(classId, remaining - 1);
    processedCount += 1;

    if (processedCount % 25 === 0 || processedCount === guardianLinksTarget) {
      console.log(
        `[seed 05] Guardian links created: ${processedCount}/${guardianLinksTarget}`,
      );
    }
  }

  await provisionGuardianPortalAccounts({ schoolId, passwordHash, assignedById });
}

async function assertSeedAllowed() {
  // This seed WIPES every table before inserting the demo dataset. Guard against
  // running it against a database that already holds data (e.g. production).
  if (process.env.SEED_FORCE === "true") {
    console.warn(
      "[seed] SEED_FORCE=true — clearing and reseeding regardless of existing data.",
    );
    return;
  }

  const [schoolCount, userCount] = await Promise.all([
    prisma.school.count(),
    prisma.user.count(),
  ]);

  if (schoolCount > 0 || userCount > 0) {
    throw new Error(
      `Refusing to seed: this database already contains data (${schoolCount} schools, ${userCount} users).\n` +
        "The seed script DELETES all data before inserting the demo dataset, so running it here would wipe real data.\n" +
        "If you genuinely intend to reset this database, re-run with SEED_FORCE=true.",
    );
  }
}

async function main() {
  let stage = 0;
  const logStage = (label: string) => {
    console.log(`\n[seed ${String(++stage).padStart(2, "0")}] ${label}`);
  };

  logStage("Checking the target database is safe to seed");
  await assertSeedAllowed();

  logStage("Clearing existing data");
  await clearDatabase();

  logStage("Creating school, platform settings, and academic context");
  const school = await prisma.school.create({
    data: {
      name: "Greenfield College, Ibadan",
      slug: "greenfield-college",
      category: "MIXED",
      isGroup: true,
      address: "Plot 12, Ring Road, Ibadan",
      city: "Ibadan",
      state: "Oyo",
      ownerName: "Olubunmi Akinyele",
      ownerEmail: "proprietor@greenfieldcollege.ng",
      ownerPhone: "08036660016",
      subdomain: "greenfield-college",
      schoolCode: "GFC-IBD-001",
      lowBandwidthMode: true,
      primaryColor: "#25593f",
      secondaryColor: "#c28c3d",
      plan: "ENTERPRISE",
      status: "ACTIVE",
      billingStatus: "ACTIVE",
      lastPaymentAt: new Date("2026-04-01"),
      nextBillingAt: new Date("2026-05-01"),
      healthScore: 86,
      storageUsedGb: 18.4,
      studentLimit: 3000,
      staffLimit: 250,
      storageLimitGb: 500,
      smsLimitPerMonth: 50000,
      emailLimitPerMonth: 100000,
      dpaStatus: "SIGNED",
      featureFlags: {
        transport: true,
        library: true,
        hostel: true,
        fees: true,
        "e-learning": true,
        messaging: true,
        report_cards: true,
      },
    },
  });

  await prisma.platformSetting.create({
    data: {
      maintenanceMode: false,
      platformAnnouncement:
        "Welcome to FutureRealm SMS. Review term data and pending approvals before publishing reports.",
      defaultGradingScale: [
        { grade: "A", min: 70, max: 100, remark: "Excellent" },
        { grade: "B", min: 60, max: 69, remark: "Very good" },
        { grade: "C", min: 50, max: 59, remark: "Good" },
        { grade: "D", min: 45, max: 49, remark: "Fair" },
        { grade: "E", min: 40, max: 44, remark: "Pass" },
        { grade: "F", min: 0, max: 39, remark: "Needs improvement" },
      ],
      globalModuleAvailability: {
        transport: true,
        library: true,
        hostel: true,
        fees: true,
        "e-learning": true,
        messaging: true,
        report_cards: true,
      },
    },
  });

  await prisma.platformSubscriptionPlan.createMany({
    data: [
      {
        name: "Basic",
        slug: "basic",
        plan: "BASIC",
        monthlyPrice: 45000,
        annualPrice: 450000,
        studentLimit: 300,
        staffLimit: 35,
        storageLimitGb: 25,
        smsUnitsPerMonth: 1000,
        emailSendsPerMonth: 5000,
        supportTier: "EMAIL",
        apiAccess: false,
        customBranding: false,
        includedModules: [
          "students",
          "attendance",
          "results",
          "fees",
          "announcements",
        ],
      },
      {
        name: "Standard",
        slug: "standard",
        plan: "STANDARD",
        monthlyPrice: 120000,
        annualPrice: 1200000,
        studentLimit: 1200,
        staffLimit: 120,
        storageLimitGb: 150,
        smsUnitsPerMonth: 10000,
        emailSendsPerMonth: 35000,
        supportTier: "PRIORITY",
        apiAccess: true,
        customBranding: true,
        includedModules: [
          "students",
          "attendance",
          "results",
          "fees",
          "admissions",
          "library",
          "transport",
          "messaging",
          "analytics",
        ],
      },
      {
        name: "Professional",
        slug: "professional",
        plan: "PROFESSIONAL",
        monthlyPrice: 180000,
        annualPrice: 1800000,
        studentLimit: 2200,
        staffLimit: 180,
        storageLimitGb: 300,
        smsUnitsPerMonth: 25000,
        emailSendsPerMonth: 70000,
        supportTier: "PRIORITY",
        apiAccess: true,
        customBranding: true,
        includedModules: [
          "students",
          "attendance",
          "results",
          "fees",
          "admissions",
          "library",
          "transport",
          "hostel",
          "health",
          "discipline",
          "analytics",
          "report_cards",
        ],
      },
      {
        name: "Enterprise",
        slug: "enterprise",
        plan: "ENTERPRISE",
        monthlyPrice: 250000,
        annualPrice: 2500000,
        studentLimit: null,
        staffLimit: null,
        storageLimitGb: 500,
        smsUnitsPerMonth: 50000,
        emailSendsPerMonth: 100000,
        supportTier: "DEDICATED",
        apiAccess: true,
        customBranding: true,
        includedModules: ["all"],
      },
    ],
  });

  const campus = await prisma.campus.create({
    data: {
      schoolId: school.id,
      name: "Ibadan Main Campus",
      code: "IBD-MAIN",
      address: "Plot 12, Ring Road, Ibadan",
      phone: "08030000000",
    },
  });

  const session = await prisma.academicSession.create({
    data: {
      schoolId: school.id,
      name: "2025/2026",
      startDate: new Date("2025-09-01"),
      endDate: new Date("2026-07-31"),
      isCurrent: true,
    },
  });

  const firstTerm = await prisma.term.create({
    data: {
      schoolId: school.id,
      academicSessionId: session.id,
      name: "First Term",
      order: 1,
      startDate: new Date("2025-09-01"),
      endDate: new Date("2025-12-15"),
      isCurrent: false,
    },
  });

  const secondTerm = await prisma.term.create({
    data: {
      schoolId: school.id,
      academicSessionId: session.id,
      name: "Second Term",
      order: 2,
      startDate: new Date("2026-01-08"),
      endDate: new Date("2026-04-30"),
      isCurrent: true,
    },
  });

  const thirdTerm = await prisma.term.create({
    data: {
      schoolId: school.id,
      academicSessionId: session.id,
      name: "Third Term",
      order: 3,
      startDate: new Date("2026-05-08"),
      endDate: new Date("2026-07-31"),
      isCurrent: false,
    },
  });

  await prisma.academicSession.updateMany({
    where: { schoolId: school.id },
    data: { isCurrent: false },
  });
  await prisma.academicSession.update({
    where: { id: session.id },
    data: { isCurrent: true },
  });

  await prisma.term.updateMany({
    where: { schoolId: school.id },
    data: { isCurrent: false },
  });
  await prisma.term.update({
    where: { id: secondTerm.id },
    data: { isCurrent: true },
  });

  await prisma.configurationItem.create({
    data: {
      schoolId: school.id,
      resource: "academic-context",
      name: "Current Academic Context",
      code: "CURRENT_ACADEMIC_CONTEXT",
      description:
        "Tracks the active academic session and term used across dashboards, attendance, results, and timetable workflows.",
      isDefault: true,
      displayOrder: 1,
      data: {
        academicSessionId: session.id,
        academicSessionName: session.name,
        activeTermId: secondTerm.id,
        activeTermName: secondTerm.name,
        availableTerms: [
          { id: firstTerm.id, name: firstTerm.name, order: firstTerm.order, isCurrent: false },
          { id: secondTerm.id, name: secondTerm.name, order: secondTerm.order, isCurrent: true },
          { id: thirdTerm.id, name: thirdTerm.name, order: thirdTerm.order, isCurrent: false },
        ],
      },
    },
  });

  logStage("Creating departments, class levels, and classroom structure");
  const scienceDepartment = await prisma.department.create({
    data: {
      schoolId: school.id,
      name: "Sciences",
      code: "SCI",
    },
  });
  const [
    mathematicsDepartment,
    languagesDepartment,
    socialSciencesDepartment,
    technicalDepartment,
    artsDepartment,
    commercialDepartment,
    valuesDepartment,
    healthDepartment,
    earlyYearsDepartment,
  ] = await runSequential([
    () =>
      prisma.department.create({
        data: { schoolId: school.id, name: "Mathematics", code: "MATH" },
      }),
    () =>
      prisma.department.create({
        data: { schoolId: school.id, name: "Languages", code: "LANG" },
      }),
    () =>
      prisma.department.create({
        data: { schoolId: school.id, name: "Social Sciences", code: "SOC" },
      }),
    () =>
      prisma.department.create({
        data: {
          schoolId: school.id,
          name: "Technical & Vocational",
          code: "TECH",
        },
      }),
    () =>
      prisma.department.create({
        data: { schoolId: school.id, name: "Arts & Culture", code: "ART" },
      }),
    () =>
      prisma.department.create({
        data: { schoolId: school.id, name: "Commercial Studies", code: "COM" },
      }),
    () =>
      prisma.department.create({
        data: {
          schoolId: school.id,
          name: "Religious Studies & Values Education",
          code: "VALUE",
        },
      }),
    () =>
      prisma.department.create({
        data: {
          schoolId: school.id,
          name: "Physical & Health Education",
          code: "PHE",
        },
      }),
    () =>
      prisma.department.create({
        data: {
          schoolId: school.id,
          name: "Early Years & Primary",
          code: "BASIC",
        },
      }),
  ]);

  function departmentForSubject(
    subject: (typeof nigerianSubjectDefaults)[number],
  ) {
    if (["CRECHE", "NURSERY", "PRIMARY"].includes(subject.section))
      return earlyYearsDepartment.id;
    if (/mathematics/i.test(subject.name)) return mathematicsDepartment.id;
    if (/english|language|french|arabic|literature/i.test(subject.name))
      return languagesDepartment.id;
    if (
      /biology|chemistry|physics|science|agriculture|geography/i.test(
        subject.name,
      )
    )
      return scienceDepartment.id;
    if (/accounting|commerce|marketing|economics|business/i.test(subject.name))
      return commercialDepartment.id;
    if (
      /technology|digital|trade|technical|drawing|hardware|installation|fashion|livestock|horticulture|cosmetology/i.test(
        subject.name,
      )
    ) {
      return technicalDepartment.id;
    }
    if (/history|government|citizenship|heritage|social/i.test(subject.name))
      return socialSciencesDepartment.id;
    if (/religious|islamic|christian|national values/i.test(subject.name))
      return valuesDepartment.id;
    if (
      /health|physical|food|nutrition|home management|catering/i.test(
        subject.name,
      )
    )
      return healthDepartment.id;
    if (/art|music|creative|cultural/i.test(subject.name))
      return artsDepartment.id;
    return socialSciencesDepartment.id;
  }

  const classLevels = await runSequential(
    nigeriaClassOptions.map((option) => () =>
      prisma.classLevel.create({
        data: {
          schoolId: school.id,
          name: option.label,
          section:
            option.section === "PRIMARY"
              ? "PRIMARY"
              : option.section === "CRECHE" || option.section === "NURSERY"
                ? "NURSERY"
                : "SECONDARY",
          schoolSection: option.section,
          order: option.order,
        },
      }),
    ),
  );
  const classLevelByValue = new Map(
    nigeriaClassOptions.map((option, index) => [
      option.value,
      classLevels[index],
    ]),
  );
  const juniorLevel = classLevelByValue.get("JSS_2")!;
  const seniorLevel = classLevelByValue.get("SSS_1")!;
  const primaryLevel = classLevelByValue.get("PRIMARY_6")!;
  const primary4Level = classLevelByValue.get("PRIMARY_4")!;
  const jss1Level = classLevelByValue.get("JSS_1")!;
  const ss2Level = classLevelByValue.get("SSS_2")!;

  const jss2Gold = await prisma.classRoom.create({
    data: {
      schoolId: school.id,
      campusId: campus.id,
      classLevelId: juniorLevel.id,
      departmentId: scienceDepartment.id,
      name: "JSS 2",
      arm: "Gold",
      capacity: 60,
    },
  });

  const ss1Emerald = await prisma.classRoom.create({
    data: {
      schoolId: school.id,
      campusId: campus.id,
      classLevelId: seniorLevel.id,
      departmentId: scienceDepartment.id,
      name: "SS 1",
      arm: "Emerald",
      capacity: 60,
    },
  });

  const primary6Coral = await prisma.classRoom.create({
    data: {
      schoolId: school.id,
      campusId: campus.id,
      classLevelId: primaryLevel.id,
      name: "Primary 6",
      arm: "Coral",
      capacity: 50,
    },
  });

  const primary4Blue = await prisma.classRoom.create({
    data: {
      schoolId: school.id,
      campusId: campus.id,
      classLevelId: primary4Level.id,
      name: "Primary 4",
      arm: "Blue",
      capacity: 50,
    },
  });

  const jss1Silver = await prisma.classRoom.create({
    data: {
      schoolId: school.id,
      campusId: campus.id,
      classLevelId: jss1Level.id,
      departmentId: scienceDepartment.id,
      name: "JSS 1",
      arm: "Silver",
      capacity: 60,
    },
  });

  const ss2Topaz = await prisma.classRoom.create({
    data: {
      schoolId: school.id,
      campusId: campus.id,
      classLevelId: ss2Level.id,
      departmentId: scienceDepartment.id,
      name: "SS 2",
      arm: "Topaz",
      capacity: 60,
    },
  });

  await prisma.classRoom.createMany({
    data: [
      {
        schoolId: school.id,
        campusId: campus.id,
        classLevelId: classLevelByValue.get("CRECHE")!.id,
        name: "Crèche",
        arm: "A",
        capacity: 50,
      },
      {
        schoolId: school.id,
        campusId: campus.id,
        classLevelId: classLevelByValue.get("NURSERY_1")!.id,
        name: "Nursery 1",
        arm: "A",
        capacity: 50,
      },
      {
        schoolId: school.id,
        campusId: campus.id,
        classLevelId: classLevelByValue.get("NURSERY_2")!.id,
        name: "Nursery 2",
        arm: "B",
        capacity: 50,
      },
      {
        schoolId: school.id,
        campusId: campus.id,
        classLevelId: classLevelByValue.get("KG_RECEPTION")!.id,
        name: "KG / Reception",
        arm: "C",
        capacity: 50,
      },
      {
        schoolId: school.id,
        campusId: campus.id,
        classLevelId: classLevelByValue.get("PRIMARY_1")!.id,
        name: "Primary 1",
        arm: "A",
        capacity: 50,
      },
      {
        schoolId: school.id,
        campusId: campus.id,
        classLevelId: classLevelByValue.get("JSS_3")!.id,
        departmentId: scienceDepartment.id,
        name: "JSS 3",
        arm: "B",
        capacity: 60,
      },
      {
        schoolId: school.id,
        campusId: campus.id,
        classLevelId: classLevelByValue.get("SSS_3")!.id,
        departmentId: scienceDepartment.id,
        name: "SSS 3",
        arm: "C",
        capacity: 60,
      },
    ],
  });

  const jss3Bronze = await prisma.classRoom.findFirstOrThrow({
    where: { schoolId: school.id, name: "JSS 3", arm: "B" },
  });

  const ss3Crimson = await prisma.classRoom.findFirstOrThrow({
    where: { schoolId: school.id, name: "SSS 3", arm: "C" },
  });

  const crecheA = await prisma.classRoom.findFirstOrThrow({
    where: { schoolId: school.id, name: "Crèche", arm: "A" },
  });

  const nursery1A = await prisma.classRoom.findFirstOrThrow({
    where: { schoolId: school.id, name: "Nursery 1", arm: "A" },
  });

  const nursery2B = await prisma.classRoom.findFirstOrThrow({
    where: { schoolId: school.id, name: "Nursery 2", arm: "B" },
  });

  const receptionC = await prisma.classRoom.findFirstOrThrow({
    where: { schoolId: school.id, name: "KG / Reception", arm: "C" },
  });

  const primary1A = await prisma.classRoom.findFirstOrThrow({
    where: { schoolId: school.id, name: "Primary 1", arm: "A" },
  });

  const passwordHash = hashPassword("FutureRealm123!");

  const admin = await prisma.user.create({
    data: {
      schoolId: school.id,
      email: "admin@futurerealm.sms",
      firstName: "Amina",
      lastName: "Okonkwo",
      passwordHash,
      role: "SUPER_ADMIN",
    },
  });

  const platformAdminUser = await prisma.user.create({
    data: {
      schoolId: school.id,
      email: "platform.admin@futurerealm.sms",
      firstName: "Ife",
      lastName: "Salami",
      passwordHash,
      role: seedUserRole("PLATFORM_ADMIN"),
    },
  });

  const supportAgentUser = await prisma.user.create({
    data: {
      schoolId: school.id,
      email: "support@futurerealm.sms",
      firstName: "Tara",
      lastName: "George",
      passwordHash,
      role: seedUserRole("SUPPORT_AGENT"),
    },
  });

  const salesManagerUser = await prisma.user.create({
    data: {
      schoolId: school.id,
      email: "sales@futurerealm.sms",
      firstName: "Nosa",
      lastName: "Igbinovia",
      passwordHash,
      role: seedUserRole("SALES_MANAGER"),
    },
  });

  const financeManagerUser = await prisma.user.create({
    data: {
      schoolId: school.id,
      email: "finance@futurerealm.sms",
      firstName: "Hadiza",
      lastName: "Bature",
      passwordHash,
      role: seedUserRole("FINANCE_MANAGER"),
    },
  });

  const developerUser = await prisma.user.create({
    data: {
      schoolId: school.id,
      email: "developer@futurerealm.sms",
      firstName: "Chuka",
      lastName: "Nnamdi",
      passwordHash,
      role: seedUserRole("DEVELOPER"),
    },
  });

  const principalUser = await prisma.user.create({
    data: {
      schoolId: school.id,
      email: "principal@greenfieldcollege.ng",
      phone: "08036660010",
      firstName: "Tunde",
      lastName: "Adeyemi",
      passwordHash,
      role: "PRINCIPAL",
    },
  });

  await prisma.school.update({
    where: { id: school.id },
    data: { accountManagerId: salesManagerUser.id },
  });

  const vpAcademicsUser = await prisma.user.create({
    data: {
      schoolId: school.id,
      email: "vp.academics@greenfieldcollege.ng",
      phone: "08036660013",
      firstName: "Olamide",
      lastName: "Fashola",
      passwordHash,
      role: "VICE_PRINCIPAL_ACADEMICS",
    },
  });

  const examOfficerUser = await prisma.user.create({
    data: {
      schoolId: school.id,
      email: "exam.officer@greenfieldcollege.ng",
      phone: "08036660014",
      firstName: "Chinedu",
      lastName: "Nwankwo",
      passwordHash,
      role: "EXAM_OFFICER",
    },
  });

  const hodUser = await prisma.user.create({
    data: {
      schoolId: school.id,
      email: "hod.science@greenfieldcollege.ng",
      phone: "08036660015",
      firstName: "Rukayat",
      lastName: "Adeleke",
      passwordHash,
      role: "HEAD_OF_DEPARTMENT",
    },
  });

  const proprietorUser = await prisma.user.create({
    data: {
      schoolId: school.id,
      email: "proprietor@greenfieldcollege.ng",
      phone: "08036660016",
      firstName: "Olubunmi",
      lastName: "Akinyele",
      passwordHash,
      role: "PROPRIETOR",
    },
  });

  const administratorUser = await prisma.user.create({
    data: {
      schoolId: school.id,
      email: "administrator@greenfieldcollege.ng",
      phone: "08036660017",
      firstName: "Segun",
      lastName: "Olatunji",
      passwordHash,
      role: "ADMINISTRATOR",
    },
  });

  const headTeacherUser = await prisma.user.create({
    data: {
      schoolId: school.id,
      email: "head.teacher@greenfieldcollege.ng",
      phone: "08036660018",
      firstName: "Blessing",
      lastName: "Udo",
      passwordHash,
      role: "HEAD_TEACHER",
    },
  });

  const vpAdministrationUser = await prisma.user.create({
    data: {
      schoolId: school.id,
      email: "vp.admin@greenfieldcollege.ng",
      phone: "08036660019",
      firstName: "Morenike",
      lastName: "Sanni",
      passwordHash,
      role: "VICE_PRINCIPAL_ADMINISTRATION",
    },
  });

  const vpSpecialDutiesUser = await prisma.user.create({
    data: {
      schoolId: school.id,
      email: "vp.special@greenfieldcollege.ng",
      phone: "08036660020",
      firstName: "Uche",
      lastName: "Ezeani",
      passwordHash,
      role: "VICE_PRINCIPAL_SPECIAL_DUTIES",
    },
  });

  const adminOfficerUser = await prisma.user.create({
    data: {
      schoolId: school.id,
      email: "admin.officer@greenfieldcollege.ng",
      phone: "08036660011",
      firstName: "Musa",
      lastName: "Bello",
      passwordHash,
      role: "ADMIN_OFFICER",
    },
  });

  const admissionsOfficerUser = await prisma.user.create({
    data: {
      schoolId: school.id,
      email: "admissions@greenfieldcollege.ng",
      phone: "08036660012",
      firstName: "Adaeze",
      lastName: "Okoro",
      passwordHash,
      role: "ADMISSIONS_OFFICER",
    },
  });

  const teacherUser = await prisma.user.create({
    data: {
      schoolId: school.id,
      email: "teacher@greenfieldcollege.ng",
      phone: "08036660001",
      firstName: "Boma",
      lastName: "Hart",
      passwordHash,
      role: "TEACHER",
    },
  });

  const teacherPrimaryUser = await prisma.user.create({
    data: {
      schoolId: school.id,
      email: "teacher.primary@greenfieldcollege.ng",
      phone: "08036660002",
      firstName: "Sade",
      lastName: "Bello",
      passwordHash,
      role: "TEACHER",
    },
  });

  const teacherEnglishUser = await prisma.user.create({
    data: {
      schoolId: school.id,
      email: "teacher.english@greenfieldcollege.ng",
      phone: "08036660003",
      firstName: "Kemi",
      lastName: "Afolayan",
      passwordHash,
      role: "TEACHER",
    },
  });

  const classTeacherUser = await prisma.user.create({
    data: {
      schoolId: school.id,
      email: "class.teacher@greenfieldcollege.ng",
      phone: "08036660021",
      firstName: "Aisha",
      lastName: "Bamidele",
      passwordHash,
      role: "CLASS_TEACHER",
    },
  });

  const subjectTeacherUser = await prisma.user.create({
    data: {
      schoolId: school.id,
      email: "subject.teacher@greenfieldcollege.ng",
      phone: "08036660022",
      firstName: "Paul",
      lastName: "Onyeka",
      passwordHash,
      role: "SUBJECT_TEACHER",
    },
  });

  const bursarUser = await prisma.user.create({
    data: {
      schoolId: school.id,
      email: "bursar@greenfieldcollege.ng",
      firstName: "Ngozi",
      lastName: "Eze",
      passwordHash,
      role: "ACCOUNTANT",
    },
  });

  const counsellorUser = await prisma.user.create({
    data: {
      schoolId: school.id,
      email: "counsellor@greenfieldcollege.ng",
      phone: "08036660023",
      firstName: "Temitope",
      lastName: "Adeniyi",
      passwordHash,
      role: "GUIDANCE_COUNSELLOR",
    },
  });

  const nurseUser = await prisma.user.create({
    data: {
      schoolId: school.id,
      email: "nurse@greenfieldcollege.ng",
      phone: "08036660024",
      firstName: "Efe",
      lastName: "Okafor",
      passwordHash,
      role: "NURSE",
    },
  });

  const receptionistUser = await prisma.user.create({
    data: {
      schoolId: school.id,
      email: "frontdesk@greenfieldcollege.ng",
      phone: "08036660025",
      firstName: "Joy",
      lastName: "Adebola",
      passwordHash,
      role: "RECEPTIONIST",
    },
  });

  const librarianUser = await prisma.user.create({
    data: {
      schoolId: school.id,
      email: "librarian@greenfieldcollege.ng",
      phone: "08036660026",
      firstName: "Mfon",
      lastName: "Etim",
      passwordHash,
      role: "LIBRARIAN",
    },
  });

  const transportUser = await prisma.user.create({
    data: {
      schoolId: school.id,
      email: "transport@greenfieldcollege.ng",
      phone: "08036660027",
      firstName: "Adewale",
      lastName: "Musa",
      passwordHash,
      role: "TRANSPORT_MANAGER",
    },
  });

  const hostelUser = await prisma.user.create({
    data: {
      schoolId: school.id,
      email: "hostel@greenfieldcollege.ng",
      phone: "08036660028",
      firstName: "Hauwa",
      lastName: "Garba",
      passwordHash,
      role: "HOSTEL_MISTRESS",
    },
  });

  const ictUser = await prisma.user.create({
    data: {
      schoolId: school.id,
      email: "ict@greenfieldcollege.ng",
      phone: "08036660029",
      firstName: "Kelvin",
      lastName: "Okorie",
      passwordHash,
      role: "ICT_CBT_ADMIN",
    },
  });

  const parentUser = await prisma.user.create({
    data: {
      schoolId: school.id,
      email: "parent@greenfieldcollege.ng",
      firstName: "Funke",
      lastName: "Yusuf",
      passwordHash,
      role: "PARENT",
    },
  });

  const parentChineloUser = await prisma.user.create({
    data: {
      schoolId: school.id,
      email: "chinelo.obi@greenfieldcollege.ng",
      firstName: "Chinelo",
      lastName: "Obi",
      passwordHash,
      role: "PARENT",
    },
  });

  const parentSalisuUser = await prisma.user.create({
    data: {
      schoolId: school.id,
      email: "salisu.mohammed@greenfieldcollege.ng",
      firstName: "Salisu",
      lastName: "Mohammed",
      passwordHash,
      role: "PARENT",
    },
  });

  const studentUser = await prisma.user.create({
    data: {
      schoolId: school.id,
      email: "student@greenfieldcollege.ng",
      firstName: "Daniel",
      lastName: "Yusuf",
      passwordHash,
      role: "STUDENT",
    },
  });

  const studentMaryamUser = await prisma.user.create({
    data: {
      schoolId: school.id,
      email: "maryam.yusuf@greenfieldcollege.ng",
      firstName: "Maryam",
      lastName: "Yusuf",
      passwordHash,
      role: "STUDENT",
    },
  });

  const studentAmarachiUser = await prisma.user.create({
    data: {
      schoolId: school.id,
      email: "amarachi.obi@greenfieldcollege.ng",
      firstName: "Amarachi",
      lastName: "Obi",
      passwordHash,
      role: "STUDENT",
    },
  });

  const studentIbrahimUser = await prisma.user.create({
    data: {
      schoolId: school.id,
      email: "ibrahim.salisu@greenfieldcollege.ng",
      firstName: "Ibrahim",
      lastName: "Salisu",
      passwordHash,
      role: "STUDENT",
    },
  });

  const studentEstherUser = await prisma.user.create({
    data: {
      schoolId: school.id,
      email: "esther.adewale@greenfieldcollege.ng",
      firstName: "Esther",
      lastName: "Adewale",
      passwordHash,
      role: "STUDENT",
    },
  });

  logStage("Creating users, permissions, roles, and staff profiles");
  await seedPermissionsAndRoles(school.id, admin.id);
  await runSequential([
    () => assignSystemRole(school.id, proprietorUser.id, "PROPRIETOR", admin.id),
    () => assignSystemRole(school.id, administratorUser.id, "SCHOOL_OWNER", admin.id),
    () => assignSystemRole(school.id, principalUser.id, "PRINCIPAL", admin.id),
    () => assignSystemRole(school.id, headTeacherUser.id, "HEAD_TEACHER", admin.id),
    () =>
      assignSystemRole(
        school.id,
        vpAcademicsUser.id,
        "VICE_PRINCIPAL_ACADEMICS",
        admin.id,
      ),
    () =>
      assignSystemRole(
        school.id,
        vpAdministrationUser.id,
        "VICE_PRINCIPAL_ADMINISTRATION",
        admin.id,
      ),
    () =>
      assignSystemRole(
        school.id,
        vpSpecialDutiesUser.id,
        "VICE_PRINCIPAL_SPECIAL_DUTIES",
        admin.id,
      ),
    () => assignSystemRole(school.id, adminOfficerUser.id, "ADMIN_OFFICER", admin.id),
    () =>
      assignSystemRole(
        school.id,
        admissionsOfficerUser.id,
        "ADMISSIONS_OFFICER",
        admin.id,
      ),
    () => assignSystemRole(school.id, examOfficerUser.id, "EXAM_OFFICER", admin.id),
    () => assignSystemRole(school.id, hodUser.id, "HEAD_OF_DEPARTMENT", admin.id),
    () => assignSystemRole(school.id, teacherUser.id, "TEACHER", admin.id),
    () => assignSystemRole(school.id, teacherPrimaryUser.id, "TEACHER", admin.id),
    () => assignSystemRole(school.id, teacherEnglishUser.id, "TEACHER", admin.id),
    () => assignSystemRole(school.id, classTeacherUser.id, "CLASS_TEACHER", admin.id),
    () =>
      assignSystemRole(
        school.id,
        subjectTeacherUser.id,
        "SUBJECT_TEACHER",
        admin.id,
      ),
    () => assignSystemRole(school.id, bursarUser.id, "ACCOUNTANT", admin.id),
    () =>
      assignSystemRole(
        school.id,
        counsellorUser.id,
        "GUIDANCE_COUNSELLOR",
        admin.id,
      ),
    () => assignSystemRole(school.id, nurseUser.id, "NURSE", admin.id),
    () => assignSystemRole(school.id, receptionistUser.id, "RECEPTIONIST", admin.id),
    () => assignSystemRole(school.id, librarianUser.id, "LIBRARIAN", admin.id),
    () =>
      assignSystemRole(
        school.id,
        transportUser.id,
        "TRANSPORT_MANAGER",
        admin.id,
      ),
    () => assignSystemRole(school.id, hostelUser.id, "HOSTEL_MISTRESS", admin.id),
    () => assignSystemRole(school.id, ictUser.id, "ICT_CBT_ADMIN", admin.id),
    () => assignSystemRole(school.id, parentUser.id, "PARENT", admin.id),
    () => assignSystemRole(school.id, parentChineloUser.id, "PARENT", admin.id),
    () => assignSystemRole(school.id, parentSalisuUser.id, "PARENT", admin.id),
    () => assignSystemRole(school.id, studentUser.id, "STUDENT", admin.id),
    () => assignSystemRole(school.id, studentMaryamUser.id, "STUDENT", admin.id),
    () => assignSystemRole(school.id, studentAmarachiUser.id, "STUDENT", admin.id),
    () => assignSystemRole(school.id, studentIbrahimUser.id, "STUDENT", admin.id),
    () => assignSystemRole(school.id, studentEstherUser.id, "STUDENT", admin.id),
  ]);

  await prisma.staffProfile.createMany({
    data: [
      {
        schoolId: school.id,
        campusId: campus.id,
        departmentId: scienceDepartment.id,
        userId: principalUser.id,
        employeeNo: "EMP-001",
        designation: "Principal",
        employmentDate: new Date("2021-08-10"),
        emergencyContactName: "Sade Adeyemi",
        emergencyContactPhone: "08050000010",
      },
      {
        schoolId: school.id,
        campusId: campus.id,
        departmentId: scienceDepartment.id,
        userId: vpAcademicsUser.id,
        employeeNo: "EMP-008",
        designation: "Vice Principal Academics",
        employmentDate: new Date("2021-09-01"),
        emergencyContactName: "Kunle Fashola",
        emergencyContactPhone: "08050008888",
      },
      {
        schoolId: school.id,
        campusId: campus.id,
        departmentId: scienceDepartment.id,
        userId: examOfficerUser.id,
        employeeNo: "EMP-009",
        designation: "Exam Officer",
        employmentDate: new Date("2022-01-10"),
        emergencyContactName: "Ijeoma Nwankwo",
        emergencyContactPhone: "08050009999",
      },
      {
        schoolId: school.id,
        campusId: campus.id,
        departmentId: scienceDepartment.id,
        userId: hodUser.id,
        employeeNo: "EMP-010",
        designation: "Head of Department",
        employmentDate: new Date("2020-09-14"),
        emergencyContactName: "Femi Adeleke",
        emergencyContactPhone: "08050001010",
      },
      {
        schoolId: school.id,
        campusId: campus.id,
        userId: proprietorUser.id,
        employeeNo: "EMP-011",
        designation: "Proprietor",
        employmentDate: new Date("2019-08-01"),
        emergencyContactName: "Family Office",
        emergencyContactPhone: "08050001112",
      },
      {
        schoolId: school.id,
        campusId: campus.id,
        userId: administratorUser.id,
        employeeNo: "EMP-012",
        designation: "School Administrator",
        employmentDate: new Date("2020-08-15"),
        emergencyContactName: "Bisi Olatunji",
        emergencyContactPhone: "08050001113",
      },
      {
        schoolId: school.id,
        campusId: campus.id,
        userId: headTeacherUser.id,
        employeeNo: "EMP-013",
        designation: "Head Teacher",
        employmentDate: new Date("2021-01-11"),
        emergencyContactName: "Ekemini Udo",
        emergencyContactPhone: "08050001114",
      },
      {
        schoolId: school.id,
        campusId: campus.id,
        userId: vpAdministrationUser.id,
        employeeNo: "EMP-014",
        designation: "Vice Principal Administration",
        employmentDate: new Date("2021-10-04"),
        emergencyContactName: "Yinka Sanni",
        emergencyContactPhone: "08050001115",
      },
      {
        schoolId: school.id,
        campusId: campus.id,
        userId: vpSpecialDutiesUser.id,
        employeeNo: "EMP-015",
        designation: "Vice Principal Special Duties",
        employmentDate: new Date("2022-02-14"),
        emergencyContactName: "Ngozi Ezeani",
        emergencyContactPhone: "08050001116",
      },
      {
        schoolId: school.id,
        campusId: campus.id,
        userId: adminOfficerUser.id,
        employeeNo: "EMP-006",
        designation: "Admin Officer",
        employmentDate: new Date("2022-04-18"),
        emergencyContactName: "Hauwa Bello",
        emergencyContactPhone: "08050006666",
      },
      {
        schoolId: school.id,
        campusId: campus.id,
        userId: admissionsOfficerUser.id,
        employeeNo: "EMP-007",
        designation: "Admissions Officer",
        employmentDate: new Date("2022-06-06"),
        emergencyContactName: "Chuka Okoro",
        emergencyContactPhone: "08050007777",
      },
      {
        schoolId: school.id,
        campusId: campus.id,
        departmentId: scienceDepartment.id,
        userId: teacherUser.id,
        employeeNo: "EMP-002",
        designation: "Subject Teacher",
        employmentDate: new Date("2022-01-15"),
        emergencyContactName: "Tari Hart",
        emergencyContactPhone: "08050001111",
      },
      {
        schoolId: school.id,
        campusId: campus.id,
        userId: teacherPrimaryUser.id,
        employeeNo: "EMP-004",
        designation: "Primary Class Teacher",
        employmentDate: new Date("2022-09-01"),
        emergencyContactName: "Kunle Bello",
        emergencyContactPhone: "08050002222",
      },
      {
        schoolId: school.id,
        campusId: campus.id,
        userId: teacherEnglishUser.id,
        employeeNo: "EMP-005",
        designation: "English / Humanities Teacher",
        employmentDate: new Date("2023-01-09"),
        emergencyContactName: "Bisi Afolayan",
        emergencyContactPhone: "08050003333",
      },
      {
        schoolId: school.id,
        campusId: campus.id,
        departmentId: scienceDepartment.id,
        userId: classTeacherUser.id,
        employeeNo: "EMP-016",
        designation: "Class Teacher / Form Teacher",
        employmentDate: new Date("2022-09-12"),
        emergencyContactName: "Yemi Bamidele",
        emergencyContactPhone: "08050001616",
      },
      {
        schoolId: school.id,
        campusId: campus.id,
        departmentId: scienceDepartment.id,
        userId: subjectTeacherUser.id,
        employeeNo: "EMP-017",
        designation: "Subject Teacher",
        employmentDate: new Date("2023-04-03"),
        emergencyContactName: "Ada Onyeka",
        emergencyContactPhone: "08050001717",
      },
      {
        schoolId: school.id,
        campusId: campus.id,
        userId: bursarUser.id,
        employeeNo: "EMP-003",
        designation: "Bursar",
        employmentDate: new Date("2023-02-01"),
        emergencyContactName: "Ifeanyi Eze",
        emergencyContactPhone: "08050004444",
      },
      {
        schoolId: school.id,
        campusId: campus.id,
        userId: counsellorUser.id,
        employeeNo: "EMP-018",
        designation: "Guidance Counsellor",
        employmentDate: new Date("2022-11-01"),
        emergencyContactName: "Tola Adeniyi",
        emergencyContactPhone: "08050001818",
      },
      {
        schoolId: school.id,
        campusId: campus.id,
        userId: nurseUser.id,
        employeeNo: "EMP-019",
        designation: "School Nurse / Sick Bay Officer",
        employmentDate: new Date("2022-03-07"),
        emergencyContactName: "Chika Okafor",
        emergencyContactPhone: "08050001919",
      },
      {
        schoolId: school.id,
        campusId: campus.id,
        userId: receptionistUser.id,
        employeeNo: "EMP-020",
        designation: "Receptionist / Front Desk",
        employmentDate: new Date("2023-05-15"),
        emergencyContactName: "Bola Adebola",
        emergencyContactPhone: "08050002020",
      },
      {
        schoolId: school.id,
        campusId: campus.id,
        userId: librarianUser.id,
        employeeNo: "EMP-021",
        designation: "Librarian",
        employmentDate: new Date("2021-11-10"),
        emergencyContactName: "Uduak Etim",
        emergencyContactPhone: "08050002121",
      },
      {
        schoolId: school.id,
        campusId: campus.id,
        userId: transportUser.id,
        employeeNo: "EMP-022",
        designation: "Transport Coordinator",
        employmentDate: new Date("2021-07-12"),
        emergencyContactName: "Yusuf Musa",
        emergencyContactPhone: "08050002223",
      },
      {
        schoolId: school.id,
        campusId: campus.id,
        userId: hostelUser.id,
        employeeNo: "EMP-023",
        designation: "Hostel Mistress / Matron",
        employmentDate: new Date("2020-10-05"),
        emergencyContactName: "Amina Garba",
        emergencyContactPhone: "08050002323",
      },
      {
        schoolId: school.id,
        campusId: campus.id,
        userId: ictUser.id,
        employeeNo: "EMP-024",
        designation: "ICT / CBT Administrator",
        employmentDate: new Date("2023-08-01"),
        emergencyContactName: "Ada Okorie",
        emergencyContactPhone: "08050002424",
      },
    ],
  });

  await runSequential([
    () =>
      prisma.classRoom.update({
        where: { id: jss2Gold.id },
        data: { classTeacherId: classTeacherUser.id },
      }),
    () =>
      prisma.classRoom.update({
        where: { id: jss1Silver.id },
        data: { classTeacherId: subjectTeacherUser.id },
      }),
    () =>
      prisma.classRoom.update({
        where: { id: primary4Blue.id },
        data: { classTeacherId: teacherPrimaryUser.id },
      }),
    () =>
      prisma.classRoom.update({
        where: { id: primary6Coral.id },
        data: { classTeacherId: teacherPrimaryUser.id },
      }),
    () =>
      prisma.classRoom.update({
        where: { id: ss1Emerald.id },
        data: { classTeacherId: teacherUser.id },
      }),
    () =>
      prisma.classRoom.update({
        where: { id: ss2Topaz.id },
        data: { classTeacherId: teacherEnglishUser.id },
      }),
    () =>
      prisma.classRoom.update({
        where: { id: jss3Bronze.id },
        data: { classTeacherId: classTeacherUser.id },
      }),
    () =>
      prisma.classRoom.update({
        where: { id: ss3Crimson.id },
        data: { classTeacherId: teacherUser.id },
      }),
  ]);

  await prisma.classAcademicAssignment.createMany({
    data: [
      {
        schoolId: school.id,
        classId: primary4Blue.id,
        academicSessionId: session.id,
        termId: secondTerm.id,
        classTeacherId: teacherPrimaryUser.id,
      },
      {
        schoolId: school.id,
        classId: primary6Coral.id,
        academicSessionId: session.id,
        termId: secondTerm.id,
        classTeacherId: teacherPrimaryUser.id,
      },
      {
        schoolId: school.id,
        classId: jss1Silver.id,
        academicSessionId: session.id,
        termId: secondTerm.id,
        classTeacherId: subjectTeacherUser.id,
      },
      {
        schoolId: school.id,
        classId: jss2Gold.id,
        academicSessionId: session.id,
        termId: secondTerm.id,
        classTeacherId: classTeacherUser.id,
      },
      {
        schoolId: school.id,
        classId: ss1Emerald.id,
        academicSessionId: session.id,
        termId: secondTerm.id,
        classTeacherId: teacherUser.id,
      },
      {
        schoolId: school.id,
        classId: ss2Topaz.id,
        academicSessionId: session.id,
        termId: secondTerm.id,
        classTeacherId: teacherEnglishUser.id,
      },
      {
        schoolId: school.id,
        classId: jss3Bronze.id,
        academicSessionId: session.id,
        termId: secondTerm.id,
        classTeacherId: classTeacherUser.id,
      },
      {
        schoolId: school.id,
        classId: ss3Crimson.id,
        academicSessionId: session.id,
        termId: secondTerm.id,
        classTeacherId: teacherUser.id,
      },
    ],
    skipDuplicates: true,
  });

  logStage("Creating guardians, students, portal accounts, and medical records");
  const guardian = await prisma.guardian.create({
    data: {
      schoolId: school.id,
      userId: parentUser.id,
      firstName: "Funke",
      lastName: "Yusuf",
      phone: "08030000000",
      email: "parent@greenfieldcollege.ng",
      relationship: "Mother",
      address: "Bodija, Ibadan",
    },
  });

  const guardianChinelo = await prisma.guardian.create({
    data: {
      schoolId: school.id,
      userId: parentChineloUser.id,
      firstName: "Chinelo",
      lastName: "Obi",
      phone: "08031112223",
      email: "chinelo.obi@greenfieldcollege.ng",
      relationship: "Mother",
      address: "Jericho, Ibadan",
    },
  });

  const guardianSalisu = await prisma.guardian.create({
    data: {
      schoolId: school.id,
      userId: parentSalisuUser.id,
      firstName: "Salisu",
      lastName: "Mohammed",
      phone: "08032223334",
      email: "salisu.mohammed@greenfieldcollege.ng",
      relationship: "Father",
      address: "Akobo, Ibadan",
    },
  });

  const guardianAdesola = await prisma.guardian.create({
    data: {
      schoolId: school.id,
      firstName: "Adesola",
      lastName: "Adewale",
      phone: "08034445566",
      email: "adesola.adewale@example.com",
      relationship: "Mother",
      address: "Challenge, Ibadan",
    },
  });

  const guardianIfeoma = await prisma.guardian.create({
    data: {
      schoolId: school.id,
      firstName: "Ifeoma",
      lastName: "Okeke",
      phone: "08037778899",
      email: "ifeoma.okeke@example.com",
      relationship: "Mother",
      address: "Oluyole, Ibadan",
    },
  });

  const studentDaniel = await prisma.student.create({
    data: {
      schoolId: school.id,
      campusId: campus.id,
      userId: studentUser.id,
      currentClassId: jss2Gold.id,
      currentSessionId: session.id,
      admissionNumber: "GFC/25/0001",
      studentNumber: "STD-0001",
      firstName: "Daniel",
      lastName: "Yusuf",
      gender: "MALE",
      dateOfBirth: new Date("2013-04-10"),
      admissionDate: new Date("2025-09-05"),
      nationality: "Nigerian",
      stateOfOrigin: "Oyo",
    },
  });

  const studentAmarachi = await prisma.student.create({
    data: {
      schoolId: school.id,
      campusId: campus.id,
      userId: studentAmarachiUser.id,
      currentClassId: ss1Emerald.id,
      currentSessionId: session.id,
      admissionNumber: "GFC/25/0002",
      studentNumber: "STD-0002",
      firstName: "Amarachi",
      lastName: "Obi",
      gender: "FEMALE",
      dateOfBirth: new Date("2011-09-14"),
      admissionDate: new Date("2025-09-05"),
    },
  });

  const studentIbrahim = await prisma.student.create({
    data: {
      schoolId: school.id,
      campusId: campus.id,
      userId: studentIbrahimUser.id,
      currentClassId: primary6Coral.id,
      currentSessionId: session.id,
      admissionNumber: "GFC/25/0003",
      studentNumber: "STD-0003",
      firstName: "Ibrahim",
      lastName: "Salisu",
      gender: "MALE",
      dateOfBirth: new Date("2014-01-20"),
      admissionDate: new Date("2025-09-05"),
    },
  });

  const studentMaryam = await prisma.student.create({
    data: {
      schoolId: school.id,
      campusId: campus.id,
      userId: studentMaryamUser.id,
      currentClassId: primary4Blue.id,
      currentSessionId: session.id,
      admissionNumber: "GFC/25/0004",
      studentNumber: "STD-0004",
      firstName: "Maryam",
      lastName: "Yusuf",
      gender: "FEMALE",
      dateOfBirth: new Date("2015-02-11"),
      admissionDate: new Date("2025-09-05"),
      nationality: "Nigerian",
      stateOfOrigin: "Oyo",
    },
  });

  const studentEsther = await prisma.student.create({
    data: {
      schoolId: school.id,
      campusId: campus.id,
      userId: studentEstherUser.id,
      currentClassId: jss1Silver.id,
      currentSessionId: session.id,
      admissionNumber: "GFC/25/0005",
      studentNumber: "STD-0005",
      firstName: "Esther",
      lastName: "Adewale",
      gender: "FEMALE",
      dateOfBirth: new Date("2013-07-19"),
      admissionDate: new Date("2025-09-05"),
      nationality: "Nigerian",
      stateOfOrigin: "Lagos",
    },
  });

  const studentChisom = await prisma.student.create({
    data: {
      schoolId: school.id,
      campusId: campus.id,
      currentClassId: ss2Topaz.id,
      currentSessionId: session.id,
      admissionNumber: "GFC/25/0006",
      studentNumber: "STD-0006",
      firstName: "Chisom",
      lastName: "Okeke",
      gender: "FEMALE",
      dateOfBirth: new Date("2010-03-05"),
      admissionDate: new Date("2025-09-05"),
      nationality: "Nigerian",
      stateOfOrigin: "Imo",
    },
  });

  const primaryCohortPlans = [
    { classRoom: crecheA, prefix: "CRE", birthYear: 2021, target: SEEDED_STUDENTS_PER_CLASS, manualCount: 0 },
    { classRoom: nursery1A, prefix: "NUR1", birthYear: 2020, target: SEEDED_STUDENTS_PER_CLASS, manualCount: 0 },
    { classRoom: nursery2B, prefix: "NUR2", birthYear: 2019, target: SEEDED_STUDENTS_PER_CLASS, manualCount: 0 },
    { classRoom: receptionC, prefix: "KGR", birthYear: 2018, target: SEEDED_STUDENTS_PER_CLASS, manualCount: 0 },
    { classRoom: primary1A, prefix: "PRI1", birthYear: 2017, target: SEEDED_STUDENTS_PER_CLASS, manualCount: 0 },
    { classRoom: primary4Blue, prefix: "PRI4", birthYear: 2014, target: SEEDED_STUDENTS_PER_CLASS, manualCount: 1 },
    { classRoom: primary6Coral, prefix: "PRI6", birthYear: 2012, target: SEEDED_STUDENTS_PER_CLASS, manualCount: 1 },
  ];

  for (const plan of primaryCohortPlans) {
    const additionalCount = Math.max(plan.target - plan.manualCount, 0);
    const generatedNames = buildSecondaryCohortNames(additionalCount);

    await prisma.student.createMany({
      data: generatedNames.map(([firstName, lastName, gender], index) => ({
        schoolId: school.id,
        campusId: campus.id,
        currentClassId: plan.classRoom.id,
        currentSessionId: session.id,
        admissionNumber: `GFC/25/${plan.prefix}-${String(index + 1).padStart(2, "0")}`,
        studentNumber: `STD-${plan.prefix}-${String(index + 1).padStart(2, "0")}`,
        firstName,
        lastName,
        gender,
        dateOfBirth: new Date(
          `${plan.birthYear}-${String((index % 9) + 1).padStart(2, "0")}-12`,
        ),
        admissionDate: new Date("2025-09-05"),
        nationality: "Nigerian",
        stateOfOrigin: [
          "Oyo",
          "Lagos",
          "Anambra",
          "Kaduna",
          "Rivers",
          "Akwa Ibom",
          "Osun",
          "Enugu",
          "Kano",
          "Ogun",
        ][index % 10],
      })),
    });
  }

  const secondaryCohortPlans = [
    { classRoom: jss1Silver, prefix: "JSS1", birthYear: 2013, target: SEEDED_STUDENTS_PER_CLASS, manualCount: 1 },
    { classRoom: jss2Gold, prefix: "JSS2", birthYear: 2012, target: SEEDED_STUDENTS_PER_CLASS, manualCount: 1 },
    { classRoom: jss3Bronze, prefix: "JSS3", birthYear: 2011, target: SEEDED_STUDENTS_PER_CLASS, manualCount: 0 },
    { classRoom: ss1Emerald, prefix: "SS1", birthYear: 2010, target: SEEDED_STUDENTS_PER_CLASS, manualCount: 1 },
    { classRoom: ss2Topaz, prefix: "SS2", birthYear: 2009, target: SEEDED_STUDENTS_PER_CLASS, manualCount: 1 },
    { classRoom: ss3Crimson, prefix: "SS3", birthYear: 2008, target: SEEDED_STUDENTS_PER_CLASS, manualCount: 0 },
  ];

  for (const plan of secondaryCohortPlans) {
    const additionalCount = Math.max(plan.target - plan.manualCount, 0);
    const generatedNames = buildSecondaryCohortNames(additionalCount);

    await prisma.student.createMany({
      data: generatedNames.map(([firstName, lastName, gender], index) => ({
        schoolId: school.id,
        campusId: campus.id,
        currentClassId: plan.classRoom.id,
        currentSessionId: session.id,
        admissionNumber: `GFC/25/${plan.prefix}-${String(index + 1).padStart(2, "0")}`,
        studentNumber: `STD-${plan.prefix}-${String(index + 1).padStart(2, "0")}`,
        firstName,
        lastName,
        gender,
        dateOfBirth: new Date(
          `${plan.birthYear}-${String((index % 9) + 1).padStart(2, "0")}-12`,
        ),
        admissionDate: new Date("2025-09-05"),
        nationality: "Nigerian",
        stateOfOrigin: [
          "Oyo",
          "Lagos",
          "Anambra",
          "Kaduna",
          "Rivers",
          "Akwa Ibom",
          "Osun",
          "Enugu",
          "Kano",
          "Ogun",
        ][index % 10],
      })),
    });
  }

  await provisionStudentPortalAccounts({
    schoolId: school.id,
    passwordHash,
    assignedById: admin.id,
  });

  await resetStudentPortalPasswords({
    schoolId: school.id,
    passwordHash,
  });

  await prisma.studentGuardian.createMany({
    data: [
      {
        studentId: studentDaniel.id,
        guardianId: guardian.id,
        isPrimary: true,
      },
      {
        studentId: studentMaryam.id,
        guardianId: guardian.id,
        isPrimary: true,
      },
      {
        studentId: studentAmarachi.id,
        guardianId: guardianChinelo.id,
        isPrimary: true,
      },
      {
        studentId: studentIbrahim.id,
        guardianId: guardianSalisu.id,
        isPrimary: true,
      },
      {
        studentId: studentEsther.id,
        guardianId: guardianAdesola.id,
        isPrimary: true,
      },
      {
        studentId: studentChisom.id,
        guardianId: guardianIfeoma.id,
        isPrimary: true,
      },
    ],
  });

  await provisionStudentGuardians({
    schoolId: school.id,
    assignedById: admin.id,
    passwordHash,
  });

  await prisma.medicalRecord.createMany({
    data: [
      {
        studentId: studentDaniel.id,
        bloodGroup: "O+",
        genotype: "AA",
        allergies: "Dust",
      },
      {
        studentId: studentAmarachi.id,
        bloodGroup: "A+",
        genotype: "AS",
        allergies: "Peanuts",
        conditions: "Carries inhaler during sports.",
      },
      {
        studentId: studentIbrahim.id,
        bloodGroup: "B+",
        genotype: "AA",
        conditions: "Recently treated for malaria",
      },
      {
        studentId: studentMaryam.id,
        bloodGroup: "O+",
        genotype: "AA",
      },
      {
        studentId: studentEsther.id,
        bloodGroup: "AB+",
        genotype: "AS",
        allergies: "Penicillin",
      },
      {
        studentId: studentChisom.id,
        bloodGroup: "A-",
        genotype: "AA",
      },
    ],
  });

  logStage("Creating subjects, class assignments, and timetable");
  await prisma.subject.createMany({
    data: nigerianSubjectDefaults.map((subject) => ({
      schoolId: school.id,
      departmentId: departmentForSubject(subject),
      name: subject.name,
      code: subject.code,
      section: subject.section,
      applicableClassLevels: subject.applicableClassLevels,
      isCore: subject.isCore,
      isOptional: subject.isOptional ?? false,
      religionSpecific: subject.religionSpecific ?? false,
      trackSpecific: subject.trackSpecific,
      tradeSubject: subject.tradeSubject ?? false,
      status: "ACTIVE",
    })),
  });
  const seededSubjects = await prisma.subject.findMany({
    where: { schoolId: school.id },
  });
  const subjectByCode = new Map(
    seededSubjects.map((subject) => [subject.code, subject]),
  );
  const math = subjectByCode.get("JSS2")!;
  const biology = subjectByCode.get("SSSCI1")!;
  const basicScience = subjectByCode.get("UP4")!;
  const english = subjectByCode.get("SSCORE1")!;
  const economics = subjectByCode.get("SSBUS4")!;
  const primaryEnglish = subjectByCode.get("UP1")!;
  const primaryMath = subjectByCode.get("UP2")!;
  const jssEnglish = subjectByCode.get("JSS1")!;

  await prisma.subjectCategory.createMany({
    data: [
      { schoolId: school.id, name: "Core / Compulsory", sortOrder: 1 },
      { schoolId: school.id, name: "Sciences", sortOrder: 2 },
      { schoolId: school.id, name: "Mathematics", sortOrder: 3 },
      { schoolId: school.id, name: "Languages", sortOrder: 4 },
      { schoolId: school.id, name: "Social Sciences", sortOrder: 5 },
      { schoolId: school.id, name: "Commercial Studies", sortOrder: 6 },
      { schoolId: school.id, name: "Technical & Vocational", sortOrder: 7 },
      { schoolId: school.id, name: "Arts & Creative", sortOrder: 8 },
      { schoolId: school.id, name: "Religious Studies", sortOrder: 9 },
      { schoolId: school.id, name: "Physical Education", sortOrder: 10 },
      { schoolId: school.id, name: "Information Technology", sortOrder: 11 },
    ],
    skipDuplicates: true,
  });

  const subjectCategories = await prisma.subjectCategory.findMany({
    where: { schoolId: school.id },
  });
  const subjectCategoryByName = new Map(subjectCategories.map((category) => [category.name, category]));

  await prisma.subject.update({
    where: { id: jssEnglish.id },
    data: { subjectCategoryId: subjectCategoryByName.get("Languages")?.id },
  });
  await prisma.subject.update({
    where: { id: english.id },
    data: { subjectCategoryId: subjectCategoryByName.get("Languages")?.id },
  });
  await prisma.subject.update({
    where: { id: primaryEnglish.id },
    data: { subjectCategoryId: subjectCategoryByName.get("Languages")?.id },
  });
  await prisma.subject.update({
    where: { id: math.id },
    data: { subjectCategoryId: subjectCategoryByName.get("Mathematics")?.id },
  });
  await prisma.subject.update({
    where: { id: primaryMath.id },
    data: { subjectCategoryId: subjectCategoryByName.get("Mathematics")?.id },
  });
  await prisma.subject.update({
    where: { id: biology.id },
    data: { subjectCategoryId: subjectCategoryByName.get("Sciences")?.id },
  });
  await prisma.subject.update({
    where: { id: basicScience.id },
    data: { subjectCategoryId: subjectCategoryByName.get("Sciences")?.id },
  });
  await prisma.subject.update({
    where: { id: economics.id },
    data: { subjectCategoryId: subjectCategoryByName.get("Commercial Studies")?.id },
  });

  const subjectOrThrow = (code: string) => {
    const subject = subjectByCode.get(code);
    if (!subject) {
      throw new Error(`Missing seeded subject with code ${code}`);
    }
    return subject;
  };

  const classSubjectPlan = [
    { classId: primary4Blue.id, code: "UP1", teacherId: teacherPrimaryUser.id },
    { classId: primary4Blue.id, code: "UP2", teacherId: teacherPrimaryUser.id },
    { classId: primary4Blue.id, code: "UP4", teacherId: subjectTeacherUser.id },
    { classId: primary4Blue.id, code: "UP5", teacherId: teacherPrimaryUser.id },
    { classId: primary4Blue.id, code: "UP6", teacherId: subjectTeacherUser.id },
    { classId: primary4Blue.id, code: "UP7", teacherId: teacherPrimaryUser.id },
    { classId: primary4Blue.id, code: "UP8", teacherId: teacherEnglishUser.id },
    { classId: primary4Blue.id, code: "UP9", teacherId: teacherEnglishUser.id },
    { classId: primary4Blue.id, code: "UP10", teacherId: teacherEnglishUser.id },
    { classId: primary4Blue.id, code: "UP11", teacherId: subjectTeacherUser.id },
    { classId: primary6Coral.id, code: "UP1", teacherId: teacherPrimaryUser.id },
    { classId: primary6Coral.id, code: "UP2", teacherId: teacherPrimaryUser.id },
    { classId: primary6Coral.id, code: "UP4", teacherId: subjectTeacherUser.id },
    { classId: primary6Coral.id, code: "UP5", teacherId: teacherPrimaryUser.id },
    { classId: primary6Coral.id, code: "UP6", teacherId: subjectTeacherUser.id },
    { classId: primary6Coral.id, code: "UP7", teacherId: teacherPrimaryUser.id },
    { classId: primary6Coral.id, code: "UP8", teacherId: teacherEnglishUser.id },
    { classId: primary6Coral.id, code: "UP9", teacherId: teacherEnglishUser.id },
    { classId: primary6Coral.id, code: "UP10", teacherId: teacherEnglishUser.id },
    { classId: primary6Coral.id, code: "UP11", teacherId: subjectTeacherUser.id },
    { classId: jss1Silver.id, code: "JSS1", teacherId: teacherEnglishUser.id },
    { classId: jss1Silver.id, code: "JSS2", teacherId: teacherUser.id },
    { classId: jss1Silver.id, code: "JSS4", teacherId: teacherUser.id },
    { classId: jss1Silver.id, code: "JSS5", teacherId: subjectTeacherUser.id },
    { classId: jss1Silver.id, code: "JSS6", teacherId: subjectTeacherUser.id },
    { classId: jss1Silver.id, code: "JSS7", teacherId: subjectTeacherUser.id },
    { classId: jss1Silver.id, code: "JSS8", teacherId: teacherEnglishUser.id },
    { classId: jss1Silver.id, code: "JSS9", teacherId: subjectTeacherUser.id },
    { classId: jss1Silver.id, code: "JSS10", teacherId: teacherEnglishUser.id },
    { classId: jss1Silver.id, code: "JSS11", teacherId: subjectTeacherUser.id },
    { classId: jss1Silver.id, code: "JSS12", teacherId: subjectTeacherUser.id },
    { classId: jss2Gold.id, code: "JSS1", teacherId: teacherEnglishUser.id },
    { classId: jss2Gold.id, code: "JSS2", teacherId: teacherUser.id },
    { classId: jss2Gold.id, code: "JSS4", teacherId: teacherUser.id },
    { classId: jss2Gold.id, code: "JSS5", teacherId: classTeacherUser.id },
    { classId: jss2Gold.id, code: "JSS6", teacherId: subjectTeacherUser.id },
    { classId: jss2Gold.id, code: "JSS7", teacherId: classTeacherUser.id },
    { classId: jss2Gold.id, code: "JSS8", teacherId: teacherEnglishUser.id },
    { classId: jss2Gold.id, code: "JSS9", teacherId: classTeacherUser.id },
    { classId: jss2Gold.id, code: "JSS10", teacherId: teacherEnglishUser.id },
    { classId: jss2Gold.id, code: "JSS11", teacherId: classTeacherUser.id },
    { classId: jss2Gold.id, code: "JSS12", teacherId: subjectTeacherUser.id },
    { classId: jss3Bronze.id, code: "JSS1", teacherId: teacherEnglishUser.id },
    { classId: jss3Bronze.id, code: "JSS2", teacherId: teacherUser.id },
    { classId: jss3Bronze.id, code: "JSS4", teacherId: teacherUser.id },
    { classId: jss3Bronze.id, code: "JSS5", teacherId: classTeacherUser.id },
    { classId: jss3Bronze.id, code: "JSS6", teacherId: subjectTeacherUser.id },
    { classId: jss3Bronze.id, code: "JSS7", teacherId: classTeacherUser.id },
    { classId: jss3Bronze.id, code: "JSS8", teacherId: teacherEnglishUser.id },
    { classId: jss3Bronze.id, code: "JSS9", teacherId: classTeacherUser.id },
    { classId: jss3Bronze.id, code: "JSS10", teacherId: teacherEnglishUser.id },
    { classId: jss3Bronze.id, code: "JSS11", teacherId: classTeacherUser.id },
    { classId: jss3Bronze.id, code: "JSS12", teacherId: subjectTeacherUser.id },
    { classId: ss1Emerald.id, code: "SSCORE1", teacherId: teacherEnglishUser.id },
    { classId: ss1Emerald.id, code: "SSCORE2", teacherId: teacherUser.id },
    { classId: ss1Emerald.id, code: "SSCORE3", teacherId: teacherEnglishUser.id },
    { classId: ss1Emerald.id, code: "SSCORE4", teacherId: subjectTeacherUser.id },
    { classId: ss1Emerald.id, code: "SSCORE5", teacherId: subjectTeacherUser.id },
    { classId: ss1Emerald.id, code: "SSSCI1", teacherId: teacherUser.id },
    { classId: ss1Emerald.id, code: "SSSCI2", teacherId: subjectTeacherUser.id },
    { classId: ss1Emerald.id, code: "SSSCI3", teacherId: subjectTeacherUser.id },
    { classId: ss1Emerald.id, code: "SSSCI9", teacherId: teacherEnglishUser.id },
    { classId: ss2Topaz.id, code: "SSCORE1", teacherId: teacherEnglishUser.id },
    { classId: ss2Topaz.id, code: "SSCORE2", teacherId: teacherUser.id },
    { classId: ss2Topaz.id, code: "SSCORE3", teacherId: teacherEnglishUser.id },
    { classId: ss2Topaz.id, code: "SSCORE4", teacherId: subjectTeacherUser.id },
    { classId: ss2Topaz.id, code: "SSCORE5", teacherId: subjectTeacherUser.id },
    { classId: ss2Topaz.id, code: "SSBUS1", teacherId: teacherEnglishUser.id },
    { classId: ss2Topaz.id, code: "SSBUS2", teacherId: teacherEnglishUser.id },
    { classId: ss2Topaz.id, code: "SSBUS4", teacherId: teacherEnglishUser.id },
    { classId: ss2Topaz.id, code: "SSHUM2", teacherId: teacherEnglishUser.id },
    { classId: ss2Topaz.id, code: "SSHUM10", teacherId: teacherEnglishUser.id },
    { classId: ss3Crimson.id, code: "SSCORE1", teacherId: teacherEnglishUser.id },
    { classId: ss3Crimson.id, code: "SSCORE2", teacherId: teacherUser.id },
    { classId: ss3Crimson.id, code: "SSCORE3", teacherId: teacherEnglishUser.id },
    { classId: ss3Crimson.id, code: "SSCORE4", teacherId: subjectTeacherUser.id },
    { classId: ss3Crimson.id, code: "SSCORE5", teacherId: subjectTeacherUser.id },
    { classId: ss3Crimson.id, code: "SSSCI1", teacherId: teacherUser.id },
    { classId: ss3Crimson.id, code: "SSSCI2", teacherId: subjectTeacherUser.id },
    { classId: ss3Crimson.id, code: "SSSCI3", teacherId: subjectTeacherUser.id },
    { classId: ss3Crimson.id, code: "SSSCI9", teacherId: teacherEnglishUser.id },
  ] as const;

  await prisma.classSubject.createMany({
    data: classSubjectPlan.map((item) => ({
      schoolId: school.id,
      classId: item.classId,
      subjectId: subjectOrThrow(item.code).id,
      teacherId: item.teacherId,
    })),
    skipDuplicates: true,
  });

  const timetablePeriods = [
    { startsAt: "07:45", endsAt: "08:25", venue: "Main classroom" },
    { startsAt: "08:25", endsAt: "09:05", venue: "Main classroom" },
    { startsAt: "09:05", endsAt: "09:45", venue: "Main classroom" },
    { startsAt: "10:05", endsAt: "10:45", venue: "Main classroom" },
    { startsAt: "10:45", endsAt: "11:25", venue: "Main classroom" },
    { startsAt: "11:25", endsAt: "12:05", venue: "Main classroom" },
    { startsAt: "12:45", endsAt: "13:25", venue: "Main classroom" },
    { startsAt: "13:25", endsAt: "14:05", venue: "Main classroom" },
  ];
  const timetableAssignments = await prisma.classSubject.findMany({
    where: { schoolId: school.id },
    include: { classRoom: true, subject: true },
  });
  const assignmentsByClass = new Map<string, typeof timetableAssignments>();
  for (const assignment of timetableAssignments) {
    assignmentsByClass.set(assignment.classId, [
      ...(assignmentsByClass.get(assignment.classId) ?? []),
      assignment,
    ]);
  }
  const timetableSeedRows = Array.from(assignmentsByClass.entries()).flatMap(
    ([classId, assignments]) =>
      [1, 2, 3, 4, 5].flatMap((dayOfWeek) =>
        timetablePeriods.map((period, index) => {
          const assignment = assignments[(dayOfWeek + index) % assignments.length];
          return {
            schoolId: school.id,
            termId: secondTerm.id,
            classId,
            subjectId: assignment.subjectId,
            teacherId: assignment.teacherId,
            dayOfWeek,
            periodNumber: index + 1,
            startsAt: period.startsAt,
            endsAt: period.endsAt,
            venue:
              index === 2 && assignment.subject.name.includes("Science")
                ? "Science Laboratory"
                : period.venue,
          };
        }),
      ),
  );
  const uniqueTimetableRows = Array.from(
    new Map(
      timetableSeedRows.map((row) => [
        `${row.classId}:${row.dayOfWeek}:${row.periodNumber}:${row.termId}`,
        row,
      ]),
    ).values(),
  );
  await prisma.timetableEntry.createMany({
    data: uniqueTimetableRows,
    skipDuplicates: true,
  });
  const gradingScheme = await prisma.gradingScheme.create({
    data: {
      schoolId: school.id,
      name: "Nigerian Termly A-F Default",
      description:
        "Default Nigerian termly grade bands: A 70-100, B 60-69, C 50-59, D 45-49, E 40-44, F 0-39.",
      isActive: true,
      rankingEnabled: true,
      passMark: 40,
      bands: {
        create: nigerianTermGradeBands.map((band, index) => ({
          schoolId: school.id,
          label: band.label,
          minScore: band.min,
          maxScore: band.max,
          remark: band.remark,
          order: index + 1,
        })),
      },
    },
  });

  const ca = await prisma.assessmentComponent.create({
    data: {
      schoolId: school.id,
      termId: secondTerm.id,
      name: "Continuous Assessment",
      code: "CA",
      weight: 40,
      maxScore: 40,
      order: 1,
    },
  });

  const exam = await prisma.assessmentComponent.create({
    data: {
      schoolId: school.id,
      termId: secondTerm.id,
      name: "Exam",
      code: "EXAM",
      weight: 60,
      maxScore: 60,
      order: 2,
    },
  });

  await prisma.sectionAssessmentComponent.createMany({
    data: academicSections.flatMap((section) =>
      sectionAssessmentDefaults.map((component) => ({
        schoolId: school.id,
        academicSessionId: session.id,
        termId: secondTerm.id,
        section,
        name: component.name,
        code: component.code,
        type: component.type,
        weight: component.weight,
        maxScore: component.maxScore,
        order: component.order,
      })),
    ),
  });

  logStage("Generating results, assessments, broadsheets, and report cards");
  await prisma.resultSheet.create({
    data: {
      schoolId: school.id,
      studentId: studentDaniel.id,
      termId: firstTerm.id,
      classId: jss2Gold.id,
      createdById: teacherUser.id,
      totalScore: 75.1,
      averageScore: 75.1,
      grade: "A",
      position: 6,
      teacherComment: "Promising first term.",
      principalComment: "More revision needed in mathematics.",
      status: "PUBLISHED",
      gradingSchemeId: gradingScheme.id,
      approvedAt: new Date("2025-12-17"),
      lockedAt: new Date("2025-12-18"),
      publishedAt: new Date("2025-12-18"),
    },
  });
  const secondTermResultPlans = [
    {
      classRoom: primary4Blue,
      createdById: teacherPrimaryUser.id,
      subjectCodes: ["UP1", "UP2", "UP4", "UP5", "UP6", "UP7", "UP8", "UP9", "UP10", "UP11"],
    },
    {
      classRoom: primary6Coral,
      createdById: teacherPrimaryUser.id,
      subjectCodes: ["UP1", "UP2", "UP4", "UP5", "UP6", "UP7", "UP8", "UP9", "UP10", "UP11"],
    },
    {
      classRoom: jss1Silver,
      createdById: subjectTeacherUser.id,
      subjectCodes: ["JSS1", "JSS2", "JSS4", "JSS5", "JSS6", "JSS7", "JSS8", "JSS9", "JSS10", "JSS11", "JSS12"],
    },
    {
      classRoom: jss2Gold,
      createdById: classTeacherUser.id,
      subjectCodes: ["JSS1", "JSS2", "JSS4", "JSS5", "JSS6", "JSS7", "JSS8", "JSS9", "JSS10", "JSS11", "JSS12"],
    },
    {
      classRoom: jss3Bronze,
      createdById: classTeacherUser.id,
      subjectCodes: ["JSS1", "JSS2", "JSS4", "JSS5", "JSS6", "JSS7", "JSS8", "JSS9", "JSS10", "JSS11", "JSS12"],
    },
    {
      classRoom: ss1Emerald,
      createdById: teacherUser.id,
      subjectCodes: ["SSCORE1", "SSCORE2", "SSCORE3", "SSCORE4", "SSCORE5", "SSSCI1", "SSSCI2", "SSSCI3", "SSSCI9"],
    },
    {
      classRoom: ss2Topaz,
      createdById: teacherEnglishUser.id,
      subjectCodes: ["SSCORE1", "SSCORE2", "SSCORE3", "SSCORE4", "SSCORE5", "SSBUS1", "SSBUS2", "SSBUS4", "SSHUM2", "SSHUM10"],
    },
    {
      classRoom: ss3Crimson,
      createdById: teacherUser.id,
      subjectCodes: ["SSCORE1", "SSCORE2", "SSCORE3", "SSCORE4", "SSCORE5", "SSSCI1", "SSSCI2", "SSSCI3", "SSSCI9"],
    },
  ] as const;

  const scoringPlanByClass = new Map(
    secondTermResultPlans.map((plan) => [plan.classRoom.id, plan]),
  );
  const secondTermStudents = await prisma.student.findMany({
    where: {
      schoolId: school.id,
      currentClassId: { in: secondTermResultPlans.map((plan) => plan.classRoom.id) },
      status: "ACTIVE",
    },
    orderBy: [{ currentClassId: "asc" }, { lastName: "asc" }, { firstName: "asc" }],
  });
  const studentsByClass = new Map<string, typeof secondTermStudents>();

  for (const student of secondTermStudents) {
    const existing = studentsByClass.get(student.currentClassId ?? "") ?? [];
    existing.push(student);
    studentsByClass.set(student.currentClassId ?? "", existing);
  }

  const assignmentRows = await prisma.classSubject.findMany({
    where: {
      schoolId: school.id,
      classId: { in: secondTermResultPlans.map((plan) => plan.classRoom.id) },
    },
    include: { subject: true },
  });
  const resultAssignmentsByClass = new Map<string, typeof assignmentRows>();

  for (const assignment of assignmentRows) {
    const existing = resultAssignmentsByClass.get(assignment.classId) ?? [];
    existing.push(assignment);
    resultAssignmentsByClass.set(assignment.classId, existing);
  }

  const generatedRowsByClass = new Map<
    string,
    Array<{
      studentId: string;
      studentName: string;
      admissionNumber: string;
      subjects: Array<{
        subject: string;
        caTotal: number;
        examTotal: number;
        total: number;
        grade: string;
        remark: string;
      }>;
      total: number;
      average: number;
      attendance: string;
      classTeacherRemark: string;
      principalRemark: string;
      promotionStatus: string;
      position: number;
    }>
  >();

  for (const [classIndex, plan] of secondTermResultPlans.entries()) {
    const classStudents = studentsByClass.get(plan.classRoom.id) ?? [];
    const planCodes: string[] = [...plan.subjectCodes];
    const classAssignments = (resultAssignmentsByClass.get(plan.classRoom.id) ?? [])
      .filter((assignment) => planCodes.includes(assignment.subject.code))
      .sort(
        (left, right) =>
          planCodes.indexOf(left.subject.code) -
          planCodes.indexOf(right.subject.code),
      );

    const rows = [];

    for (const [studentIndex, student] of classStudents.entries()) {
      const subjectRows = classAssignments.map((assignment, subjectIndex) => {
        const seed = (classIndex + 3) * 17 + (studentIndex + 5) * 11 + (subjectIndex + 7) * 5;
        const caScore = Math.max(14, Math.min(38, 18 + (seed % 19)));
        const examScore = Math.max(24, Math.min(57, 28 + ((seed * 2) % 30)));
        const total = Number((caScore + examScore).toFixed(1));
        const band = resolveGradeLabel(total, nigerianTermGradeBands);

        return {
          assignment,
          caScore,
          examScore,
          total,
          band,
        };
      });

      const totalScore = Number(
        subjectRows.reduce((sum, item) => sum + item.total, 0).toFixed(2),
      );
      const averageScore = Number((totalScore / subjectRows.length).toFixed(2));
      const band = resolveGradeLabel(averageScore, nigerianTermGradeBands);
      const teacherComment =
        averageScore >= 75
          ? "Strong class participation, steady homework completion, and confident subject delivery."
          : averageScore >= 60
            ? "Good effort across subjects. Keep revising class notes and tests."
            : "Needs closer revision support and steadier daily practice.";
      const principalComment =
        averageScore >= 75
          ? "Excellent progress this term. Maintain the standard."
          : averageScore >= 60
            ? "Satisfactory progress. Keep building consistency."
            : "More support and structured follow-up are advised.";

      const sheet = await prisma.resultSheet.upsert({
        where: {
          studentId_termId: {
            studentId: student.id,
            termId: secondTerm.id,
          },
        },
        update: {
          classId: plan.classRoom.id,
          totalScore,
          averageScore,
          grade: band.label,
          teacherComment,
          principalComment,
          status: "PUBLISHED",
          gradingSchemeId: gradingScheme.id,
          approvedAt: new Date("2026-04-07"),
          lockedAt: new Date("2026-04-08"),
          publishedAt: new Date("2026-04-08"),
        },
        create: {
          schoolId: school.id,
          studentId: student.id,
          termId: secondTerm.id,
          classId: plan.classRoom.id,
          createdById: plan.createdById,
          totalScore,
          averageScore,
          grade: band.label,
          teacherComment,
          principalComment,
          status: "PUBLISHED",
          gradingSchemeId: gradingScheme.id,
          approvedAt: new Date("2026-04-07"),
          lockedAt: new Date("2026-04-08"),
          publishedAt: new Date("2026-04-08"),
        },
      });

      await prisma.scoreEntry.deleteMany({
        where: { schoolId: school.id, resultSheetId: sheet.id },
      });

      await prisma.scoreEntry.createMany({
        data: subjectRows.flatMap((item) => [
          {
            schoolId: school.id,
            studentId: student.id,
            resultSheetId: sheet.id,
            subjectId: item.assignment.subjectId,
            assessmentComponentId: ca.id,
            enteredById: item.assignment.teacherId ?? plan.createdById,
            score: item.caScore,
            maxScore: 40,
          },
          {
            schoolId: school.id,
            studentId: student.id,
            resultSheetId: sheet.id,
            subjectId: item.assignment.subjectId,
            assessmentComponentId: exam.id,
            enteredById: item.assignment.teacherId ?? plan.createdById,
            score: item.examScore,
            maxScore: 60,
          },
        ]),
      });

      rows.push({
        studentId: student.id,
        studentName: [student.firstName, student.middleName, student.lastName].filter(Boolean).join(" "),
        admissionNumber: student.admissionNumber,
        subjects: subjectRows.map((item) => ({
          subject: item.assignment.subject.name,
          caTotal: item.caScore,
          examTotal: item.examScore,
          total: item.total,
          grade: item.band.label,
          remark: item.band.remark,
        })),
        total: totalScore,
        average: averageScore,
        attendance: `${Math.max(86, 97 - ((studentIndex + classIndex) % 8))}%`,
        classTeacherRemark: teacherComment,
        principalRemark: principalComment,
        promotionStatus: averageScore >= 40 ? "Promoted / Good standing" : "Review required",
        position: 0,
      });
    }

    const rankedRows = [...rows]
      .sort((left, right) => right.average - left.average || left.studentName.localeCompare(right.studentName))
      .map((row, index) => ({ ...row, position: index + 1 }));

    await runSequential(
      rankedRows.map((row) => () =>
        prisma.resultSheet.update({
          where: {
            studentId_termId: { studentId: row.studentId, termId: secondTerm.id },
          },
          data: { position: row.position },
        }),
      ),
    );

    generatedRowsByClass.set(plan.classRoom.id, rankedRows);
  }

  const jss2StudentsForResults = studentsByClass.get(jss2Gold.id) ?? [];
  const jss2BroadsheetRows = generatedRowsByClass.get(jss2Gold.id) ?? [];

  await prisma.scoreEntry.updateMany({
    where: { schoolId: school.id },
    data: { isDraft: false, submittedAt: new Date("2026-04-07") },
  });

  const mathTest = await prisma.academicAssessment.create({
    data: {
      schoolId: school.id,
      academicSessionId: session.id,
      termId: secondTerm.id,
      classId: jss2Gold.id,
      subjectId: math.id,
      teacherId: teacherUser.id,
      createdById: examOfficerUser.id,
      title: "Second Term Mathematics Test 2",
      arm: "Gold",
      assessmentType: "TEST",
      maxScore: 20,
      weight: 20,
      assessmentDate: new Date("2026-04-18"),
      submissionMode: "PAPER",
      status: "MARKED",
    },
  });

  await prisma.academicAssessment.createMany({
    data: [
      {
        schoolId: school.id,
        academicSessionId: session.id,
        termId: secondTerm.id,
        classId: jss2Gold.id,
        subjectId: jssEnglish.id,
        teacherId: teacherEnglishUser.id,
        createdById: examOfficerUser.id,
        title: "Second Term English Language Examination",
        arm: "Gold",
        assessmentType: "EXAMINATION",
        maxScore: 60,
        weight: 60,
        assessmentDate: new Date("2026-04-24"),
        submissionMode: "PAPER",
        status: "APPROVED",
      },
      {
        schoolId: school.id,
        academicSessionId: session.id,
        termId: secondTerm.id,
        classId: ss1Emerald.id,
        subjectId: biology.id,
        teacherId: teacherUser.id,
        createdById: vpAcademicsUser.id,
        title: "SS 1 Biology Practical",
        arm: "Emerald",
        assessmentType: "PRACTICAL",
        maxScore: 20,
        weight: 20,
        assessmentDate: new Date("2026-04-21"),
        submissionMode: "PRACTICAL",
        status: "ACTIVE",
      },
      {
        schoolId: school.id,
        academicSessionId: session.id,
        termId: secondTerm.id,
        classId: primary6Coral.id,
        subjectId: basicScience.id,
        teacherId: teacherPrimaryUser.id,
        createdById: headTeacherUser.id,
        title: "Primary 6 Basic Science Project",
        arm: "Coral",
        assessmentType: "PROJECT",
        maxScore: 20,
        weight: 20,
        assessmentDate: new Date("2026-04-19"),
        submissionMode: "PAPER",
        status: "ACTIVE",
      },
    ],
  });

  const jss2MathCaEntries = await prisma.scoreEntry.findMany({
    where: {
      schoolId: school.id,
      studentId: { in: jss2StudentsForResults.map((student) => student.id) },
      subjectId: math.id,
      assessmentComponentId: ca.id,
    },
  });
  const jss2MathCaByStudent = new Map(
    jss2MathCaEntries.map((entry) => [entry.studentId, entry]),
  );

  await prisma.assessmentCandidate.createMany({
    data: jss2StudentsForResults.map((student, index) => ({
      schoolId: school.id,
      assessmentId: mathTest.id,
      studentId: student.id,
      scoreEntryId: jss2MathCaByStudent.get(student.id)?.id,
      attendanceState: index === 8 ? "EXCUSED" : "PRESENT",
      score: index === 8 ? undefined : Math.min(20, 14 + (index % 7)),
      scoreFlag: index === 8 ? "ABSENT" : "NONE",
      comment: index === 8 ? "Excused by parent medical note." : undefined,
      enteredById: teacherUser.id,
      lastEditedById: teacherUser.id,
      enteredAt: new Date("2026-04-18T11:30:00.000Z"),
    })),
  });

  await prisma.assessmentScoreAudit.create({
    data: {
      schoolId: school.id,
      assessmentId: mathTest.id,
      scoreEntryId: jss2MathCaByStudent.get(studentDaniel.id)?.id,
      actorId: teacherUser.id,
      newScore: 18,
      action: "SCORE_ENTERED",
      note: "Seeded test score for moderation workflow.",
    },
  });

  const jss2Broadsheet = await prisma.broadsheet.create({
    data: {
      schoolId: school.id,
      academicSessionId: session.id,
      termId: secondTerm.id,
      classId: jss2Gold.id,
      compiledById: examOfficerUser.id,
      status: "PUBLISHED",
      approvalStage: "PUBLISHED",
      rankingEnabled: true,
      missingScoreWarnings: [],
      data: {
        rows: jss2BroadsheetRows,
      },
      approvedAt: new Date("2026-04-07"),
      publishedAt: new Date("2026-04-08"),
      lockedAt: new Date("2026-04-08"),
    },
  });

  await prisma.broadsheetApprovalHistory.createMany({
    data: [
      {
        schoolId: school.id,
        broadsheetId: jss2Broadsheet.id,
        actorId: hodUser.id,
        stage: "HEAD_OF_DEPARTMENT",
        action: "APPROVE",
        note: "Subject entries moderated.",
      },
      {
        schoolId: school.id,
        broadsheetId: jss2Broadsheet.id,
        actorId: examOfficerUser.id,
        stage: "EXAM_OFFICER",
        action: "COMPILE",
        note: "Broadsheet compiled.",
      },
      {
        schoolId: school.id,
        broadsheetId: jss2Broadsheet.id,
        actorId: vpAcademicsUser.id,
        stage: "VICE_PRINCIPAL_ACADEMICS",
        action: "APPROVE",
        note: "Class result verified.",
      },
      {
        schoolId: school.id,
        broadsheetId: jss2Broadsheet.id,
        actorId: principalUser.id,
        stage: "PRINCIPAL",
        action: "PUBLISH",
        note: "Approved for parent and student portals.",
      },
    ],
  });

  await prisma.reportCard.createMany({
    data: jss2BroadsheetRows.map((row) => ({
      schoolId: school.id,
      broadsheetId: jss2Broadsheet.id,
      studentId: row.studentId,
      academicSessionId: session.id,
      termId: secondTerm.id,
      classId: jss2Gold.id,
      generatedById: examOfficerUser.id,
      status: "PUBLISHED",
      data: {
        ...row,
        className: "JSS 2 - Gold",
        term: "Second Term",
        session: "2025/2026",
        grade: resolveGradeLabel(row.average, nigerianTermGradeBands).label,
      },
      publishedAt: new Date("2026-04-08"),
      lockedAt: new Date("2026-04-08"),
    })),
  });

  await prisma.seniorSecondaryResultArchive.createMany({
    data: [
      {
        schoolId: school.id,
        studentId: studentAmarachi.id,
        academicSessionId: session.id,
        termId: secondTerm.id,
        classId: ss1Emerald.id,
        subjectId: biology.id,
        sessionLabel: "2025/2026 Second Term",
        className: "SSS 1 - Emerald",
        subject: biology.name,
        total: 84.5,
        grade: "A",
        remark: "External exam readiness profile: strong science foundation.",
        data: {
          track: "SCIENCE",
          caTotal: 29,
          examTotal: 52,
          readiness: "High",
        },
      },
      {
        schoolId: school.id,
        studentId: studentChisom.id,
        academicSessionId: session.id,
        termId: secondTerm.id,
        classId: ss2Topaz.id,
        subjectId: economics.id,
        sessionLabel: "2025/2026 Second Term",
        className: "SSS 2 - Topaz",
        subject: economics.name,
        total: 88.2,
        grade: "A",
        remark:
          "External exam readiness profile: business track distinction candidate.",
        data: {
          track: "BUSINESS",
          caTotal: 35,
          examTotal: 53.2,
          readiness: "High",
        },
      },
    ],
  });

  await prisma.studentAttendance.createMany({
    data: [
      {
        schoolId: school.id,
        studentId: studentDaniel.id,
        classId: jss2Gold.id,
        termId: secondTerm.id,
        markedById: classTeacherUser.id,
        date: new Date("2026-04-08"),
        status: "PRESENT",
      },
      {
        schoolId: school.id,
        studentId: studentAmarachi.id,
        classId: ss1Emerald.id,
        termId: secondTerm.id,
        markedById: teacherUser.id,
        date: new Date("2026-04-08"),
        status: "LATE",
        reason: "Bus delay",
      },
      {
        schoolId: school.id,
        studentId: studentIbrahim.id,
        classId: primary6Coral.id,
        termId: secondTerm.id,
        markedById: teacherPrimaryUser.id,
        date: new Date("2026-04-08"),
        status: "ABSENT",
        reason: "Reported ill by parent",
      },
      {
        schoolId: school.id,
        studentId: studentMaryam.id,
        classId: primary4Blue.id,
        termId: secondTerm.id,
        markedById: teacherPrimaryUser.id,
        date: new Date("2026-04-08"),
        status: "PRESENT",
      },
      {
        schoolId: school.id,
        studentId: studentEsther.id,
        classId: jss1Silver.id,
        termId: secondTerm.id,
        markedById: subjectTeacherUser.id,
        date: new Date("2026-04-08"),
        status: "PRESENT",
      },
      {
        schoolId: school.id,
        studentId: studentChisom.id,
        classId: ss2Topaz.id,
        termId: secondTerm.id,
        markedById: teacherEnglishUser.id,
        date: new Date("2026-04-08"),
        status: "PRESENT",
      },
    ],
  });
  const attendanceStudents = await prisma.student.findMany({
    where: { schoolId: school.id, currentClassId: { not: null } },
    select: { id: true, currentClassId: true },
  });
  const attendanceAssignments = await prisma.classRoom.findMany({
    where: {
      schoolId: school.id,
      id: { in: [...primaryCohortPlans, ...secondaryCohortPlans].map((plan) => plan.classRoom.id) },
    },
    select: { id: true, classTeacherId: true, assistantClassTeacherId: true },
  });
  const attendanceMarkerByClass = new Map(
    attendanceAssignments
      .filter((assignment) => assignment.classTeacherId || assignment.assistantClassTeacherId)
      .map((assignment) => [
        assignment.id,
        (assignment.classTeacherId ?? assignment.assistantClassTeacherId) as string,
      ]),
  );
  const schoolDays = Array.from({ length: 28 }, (_, index) => {
    const date = new Date("2026-04-18T00:00:00.000Z");
    date.setUTCDate(date.getUTCDate() - index);
    return date;
  })
    .filter((date) => {
      const day = date.getUTCDay();
      return day >= 1 && day <= 5;
    })
    .slice(0, 20)
    .reverse();

  await prisma.studentAttendance.createMany({
    data: attendanceStudents.flatMap((student, studentIndex) =>
      schoolDays.map((date, dayIndex) => {
        const markerId =
          attendanceMarkerByClass.get(student.currentClassId ?? "") ??
          teacherUser.id;
        const seed = studentIndex + dayIndex;
        const status =
          seed % 23 === 0
            ? "ABSENT"
            : seed % 11 === 0
              ? "LATE"
              : seed % 17 === 0
                ? "EXCUSED"
                : "PRESENT";
        return {
          schoolId: school.id,
          studentId: student.id,
          classId: student.currentClassId!,
          termId: secondTerm.id,
          markedById: markerId,
          date,
          status,
          reason:
            status === "ABSENT"
              ? "Parent follow-up required"
              : status === "LATE"
                ? "Arrived after morning assembly"
                : undefined,
        };
      }),
    ),
    skipDuplicates: true,
  });

  const scienceAssignment = await prisma.assignment.create({
    data: {
      schoolId: school.id,
      classId: jss2Gold.id,
      subjectId: math.id,
      teacherId: teacherUser.id,
      title: "Algebra revision worksheet",
      description:
        "Complete questions 1 to 20 on simultaneous equations before the next Mathematics period.",
      dueAt: new Date("2026-04-17T15:00:00.000Z"),
      status: "PUBLISHED",
    },
  });

  await prisma.assignmentSubmission.create({
    data: {
      schoolId: school.id,
      assignmentId: scienceAssignment.id,
      studentId: studentDaniel.id,
      submittedAt: new Date("2026-04-10T14:30:00.000Z"),
      comment: "Submitted via class captain collection.",
      score: 32,
      feedback: "Good method. Recheck word problem setup.",
      gradedAt: new Date("2026-04-11T09:00:00.000Z"),
    },
  });

  logStage("Creating attendance, assignments, admissions, and finance records");
  await prisma.admissionConfig.create({
    data: {
      schoolId: school.id,
      academicSessionId: session.id,
      termId: secondTerm.id,
      name: "2026 O-Level Admissions Cycle",
      minAge: 9,
      maxAge: 17,
      requiredDocuments: [
        "Birth certificate",
        "Previous school result",
        "Passport photograph",
        "Medical form",
      ],
      formFields: [
        "biodata",
        "guardian",
        "address",
        "emergencyContact",
        "medical",
        "previousSchool",
      ],
      applicationFeeAmount: 10000,
      applicationFeeRequired: true,
      screeningRequired: true,
      principalApprovalRequired: true,
      bursarClearanceRequired: true,
      offerExpiryDays: 14,
      branding: { letterTitle: "Admission Offer", signatory: "Principal" },
      communicationTemplates: {
        submitted: "Your admission application has been received.",
        documents: "Please upload the requested admission documents.",
        screening: "Your admission screening has been scheduled.",
        offer: "Your admission offer is ready.",
      },
      openClasses: {
        connect: [
          { id: jss1Silver.id },
          { id: jss2Gold.id },
          { id: ss1Emerald.id },
          { id: primary4Blue.id },
        ],
      },
    },
  });

  await prisma.admissionApplication.create({
    data: {
      schoolId: school.id,
      campusId: campus.id,
      academicSessionId: session.id,
      termId: secondTerm.id,
      desiredClassId: jss2Gold.id,
      reviewerId: admissionsOfficerUser.id,
      applicationNo: "ADM-2026-0012",
      firstName: "Samuel",
      lastName: "Balogun",
      gender: "MALE",
      dateOfBirth: new Date("2014-03-02"),
      guardianName: "Kemi Balogun",
      guardianPhone: "08034567890",
      guardianEmail: "kemi.balogun@example.com",
      address: "12 Aleshinloye Street, Ibadan",
      previousSchool: "Bright Stars Primary School",
      applicationFeeStatus: "VERIFIED",
      status: "SCREENING_SCHEDULED",
      notes: "Screening scheduled after fee verification.",
      reviews: {
        create: {
          reviewerId: admissionsOfficerUser.id,
          decision: "REVIEWING",
          notes:
            "Documents complete. Entrance assessment is suitable for JSS 1 Gold.",
          reviewedAt: new Date("2026-04-05T09:00:00.000Z"),
        },
      },
      screenings: {
        create: {
          schoolId: school.id,
          interviewerId: teacherUser.id,
          scheduledAt: new Date("2026-04-15T09:00:00.000Z"),
          venue: "ICT Lab",
        },
      },
      documents: {
        create: [
          {
            label: "Birth certificate",
            fileUrl: "s3://demo/admissions/samuel-birth-certificate.pdf",
            mimeType: "application/pdf",
            sizeBytes: 240000,
            isVerified: true,
            verifiedAt: new Date("2026-04-05T09:30:00.000Z"),
          },
          {
            label: "Previous school result",
            fileUrl: "s3://demo/admissions/samuel-previous-result.pdf",
            mimeType: "application/pdf",
            sizeBytes: 310000,
            isVerified: true,
            verifiedAt: new Date("2026-04-05T09:30:00.000Z"),
          },
        ],
      },
      paymentLinks: {
        create: {
          schoolId: school.id,
          verifiedById: bursarUser.id,
          reference: "ADM-FEE-0012",
          amount: 10000,
          status: "VERIFIED",
          verifiedAt: new Date("2026-04-05T10:00:00.000Z"),
          metadata: { source: "Manual bursary verification" },
        },
      },
      history: {
        create: [
          {
            schoolId: school.id,
            toStatus: "SUBMITTED",
            changedById: admissionsOfficerUser.id,
            note: "Walk-in application captured.",
          },
          {
            schoolId: school.id,
            fromStatus: "SUBMITTED",
            toStatus: "REVIEWING",
            changedById: admissionsOfficerUser.id,
            note: "Documents and class fit checked.",
          },
          {
            schoolId: school.id,
            fromStatus: "PAYMENT_PENDING",
            toStatus: "SCREENING_SCHEDULED",
            changedById: admissionsOfficerUser.id,
            note: "Screening scheduled after fee verification.",
          },
        ],
      },
    },
  });

  await prisma.admissionApplication.create({
    data: {
      schoolId: school.id,
      campusId: campus.id,
      academicSessionId: session.id,
      termId: secondTerm.id,
      desiredClassId: primary4Blue.id,
      reviewerId: admissionsOfficerUser.id,
      applicationNo: "ADM-2026-0013",
      firstName: "Miriam",
      lastName: "Yusuf",
      gender: "FEMALE",
      dateOfBirth: new Date("2015-05-10"),
      guardianName: "Aisha Yusuf",
      guardianPhone: "08021239876",
      guardianEmail: "aisha.yusuf@example.com",
      address: "Agodi GRA, Ibadan",
      previousSchool: "Al-Falah Primary School",
      applicationFeeStatus: "WAIVED",
      feeWaived: true,
      status: "OFFER_SENT",
      decidedAt: new Date("2026-04-04T12:00:00.000Z"),
      notes: "Approved for Primary 4 Blue after screening.",
      reviews: {
        create: [
          {
            reviewerId: admissionsOfficerUser.id,
            decision: "REVIEWING",
            notes: "Transfer record and guardian details verified.",
            reviewedAt: new Date("2026-04-03T09:00:00.000Z"),
          },
          {
            reviewerId: principalUser.id,
            decision: "APPROVED",
            notes: "Approved for Primary 4 Blue after screening.",
            reviewedAt: new Date("2026-04-04T12:00:00.000Z"),
          },
        ],
      },
      screenings: {
        create: {
          schoolId: school.id,
          interviewerId: teacherPrimaryUser.id,
          scheduledAt: new Date("2026-04-04T09:00:00.000Z"),
          venue: "Primary Block",
          score: 76,
          maxScore: 100,
          result: "PASS",
          recommendation: "Recommend for admission",
          remarks: "Good transfer record and class readiness.",
          completedAt: new Date("2026-04-04T10:00:00.000Z"),
        },
      },
      offers: {
        create: {
          schoolId: school.id,
          issuedById: admissionsOfficerUser.id,
          offerNumber: "OFFER-2026-0013",
          status: "SENT",
          checklist: ["Acceptance fee", "Medical form", "Passport photograph"],
          conditions: "Submit original transfer certificate before resumption.",
          sentAt: new Date("2026-04-05T09:00:00.000Z"),
          expiresAt: new Date("2026-04-19T09:00:00.000Z"),
        },
      },
      history: {
        create: [
          {
            schoolId: school.id,
            toStatus: "SUBMITTED",
            changedById: admissionsOfficerUser.id,
            note: "Online application received.",
          },
          {
            schoolId: school.id,
            fromStatus: "RECOMMENDED",
            toStatus: "APPROVED",
            changedById: principalUser.id,
            note: "Principal approved admission.",
          },
          {
            schoolId: school.id,
            fromStatus: "APPROVED",
            toStatus: "OFFER_SENT",
            changedById: admissionsOfficerUser.id,
            note: "Offer letter issued.",
          },
        ],
      },
    },
  });

  await prisma.admissionApplication.create({
    data: {
      schoolId: school.id,
      campusId: campus.id,
      academicSessionId: session.id,
      termId: secondTerm.id,
      desiredClassId: ss1Emerald.id,
      applicationNo: "ADM-2026-0014",
      firstName: "Chidera",
      lastName: "Nwosu",
      gender: "MALE",
      dateOfBirth: new Date("2010-09-19"),
      guardianName: "Ikechukwu Nwosu",
      guardianPhone: "07062223311",
      guardianEmail: "ikechukwu.nwosu@example.com",
      previousSchool: "City Model College",
      applicationFeeStatus: "PENDING",
      status: "SUBMITTED",
      duplicateFlag: false,
      history: {
        create: {
          schoolId: school.id,
          toStatus: "SUBMITTED",
          changedById: admissionsOfficerUser.id,
          note: "Application submitted by guardian.",
        },
      },
    },
  });

  const feeStructure = await prisma.feeStructure.create({
    data: {
      schoolId: school.id,
      academicSessionId: session.id,
      termId: secondTerm.id,
      classId: jss2Gold.id,
      name: "JSS 2 Second Term Fees",
      currency: "NGN",
      items: {
        create: [
          { label: "Tuition", amount: 200000 },
          { label: "Transport", amount: 60000 },
          { label: "Development Levy", amount: 25000 },
        ],
      },
    },
  });

  const danielInvoice = await prisma.invoice.create({
    data: {
      schoolId: school.id,
      studentId: studentDaniel.id,
      feeStructureId: feeStructure.id,
      createdById: bursarUser.id,
      invoiceNumber: "INV-2026-001",
      issuedOn: new Date("2026-04-01"),
      dueOn: new Date("2026-04-14"),
      subtotal: 285000,
      discount: 0,
      fine: 0,
      total: 285000,
      balance: 125000,
      status: "PARTIALLY_PAID",
      items: {
        create: [
          { description: "Tuition", amount: 200000, quantity: 1 },
          { description: "Transport", amount: 60000, quantity: 1 },
          { description: "Development Levy", amount: 25000, quantity: 1 },
        ],
      },
    },
  });

  const danielPayment = await prisma.payment.create({
    data: {
      schoolId: school.id,
      studentId: studentDaniel.id,
      invoiceId: danielInvoice.id,
      recordedById: bursarUser.id,
      reference: "PAY-2026-001",
      amount: 160000,
      status: "SUCCESS",
      method: "TRANSFER",
      provider: "PAYSTACK",
      paidAt: new Date("2026-04-03"),
      verifiedAt: new Date("2026-04-03"),
    },
  });

  await prisma.paymentAllocation.create({
    data: {
      schoolId: school.id,
      paymentId: danielPayment.id,
      invoiceId: danielInvoice.id,
      amount: 160000,
      metadata: { seed: true },
    },
  });

  await prisma.receipt.create({
    data: {
      schoolId: school.id,
      invoiceId: danielInvoice.id,
      paymentId: danielPayment.id,
      issuedById: bursarUser.id,
      receiptNumber: "RCT-2026-001",
      amount: 160000,
      issuedAt: new Date("2026-04-03"),
      metadata: { paymentReference: "PAY-2026-001" },
    },
  });

  await prisma.installmentPlan.create({
    data: {
      schoolId: school.id,
      studentId: studentDaniel.id,
      invoiceId: danielInvoice.id,
      createdById: bursarUser.id,
      planNumber: "PLAN-2026-001",
      totalAmount: 125000,
      balance: 125000,
      notes:
        "Parent agreed to clear the remaining balance in two installments.",
      items: {
        create: [
          { dueOn: new Date("2026-04-18"), amount: 62500 },
          { dueOn: new Date("2026-05-02"), amount: 62500 },
        ],
      },
    },
  });

  await prisma.invoice.createMany({
    data: [
      {
        schoolId: school.id,
        studentId: studentAmarachi.id,
        createdById: bursarUser.id,
        invoiceNumber: "INV-2026-002",
        issuedOn: new Date("2026-04-01"),
        dueOn: new Date("2026-04-10"),
        subtotal: 335000,
        discount: 0,
        fine: 0,
        total: 335000,
        balance: 0,
        status: "PAID",
      },
      {
        schoolId: school.id,
        studentId: studentIbrahim.id,
        createdById: bursarUser.id,
        invoiceNumber: "INV-2026-003",
        issuedOn: new Date("2026-04-01"),
        dueOn: new Date("2026-04-12"),
        subtotal: 210000,
        discount: 0,
        fine: 0,
        total: 210000,
        balance: 45000,
        status: "PARTIALLY_PAID",
      },
      {
        schoolId: school.id,
        studentId: studentMaryam.id,
        createdById: bursarUser.id,
        invoiceNumber: "INV-2026-004",
        issuedOn: new Date("2026-04-01"),
        dueOn: new Date("2026-04-08"),
        subtotal: 180000,
        discount: 0,
        fine: 0,
        total: 180000,
        balance: 0,
        status: "PAID",
      },
      {
        schoolId: school.id,
        studentId: studentEsther.id,
        createdById: bursarUser.id,
        invoiceNumber: "INV-2026-005",
        issuedOn: new Date("2026-04-01"),
        dueOn: new Date("2026-04-12"),
        subtotal: 225000,
        discount: 0,
        fine: 0,
        total: 225000,
        balance: 30000,
        status: "PARTIALLY_PAID",
      },
      {
        schoolId: school.id,
        studentId: studentChisom.id,
        createdById: bursarUser.id,
        invoiceNumber: "INV-2026-006",
        issuedOn: new Date("2026-04-01"),
        dueOn: new Date("2026-04-09"),
        subtotal: 340000,
        discount: 0,
        fine: 0,
        total: 340000,
        balance: 0,
        status: "PAID",
      },
    ],
  });

  await prisma.behaviorLog.createMany({
    data: [
      {
        studentId: studentDaniel.id,
        category: "Merit",
        description: "Volunteered to support the library reading club setup.",
        severity: "LOW",
      },
      {
        studentId: studentAmarachi.id,
        category: "Health / pastoral",
        description:
          "Reported shortness of breath during athletics; nurse and guardian were notified.",
        severity: "MEDIUM",
      },
      {
        studentId: studentIbrahim.id,
        category: "Attendance follow-up",
        description:
          "Class teacher logged repeated lateness due to transport route delay.",
        severity: "MEDIUM",
      },
      {
        studentId: studentMaryam.id,
        category: "Merit",
        description:
          "Outstanding reading fluency improvement during literacy week.",
        severity: "LOW",
      },
      {
        studentId: studentEsther.id,
        category: "Pastoral",
        description: "Follow-up note after repeated late homework submission.",
        severity: "MEDIUM",
      },
      {
        studentId: studentChisom.id,
        category: "Merit",
        description:
          "Led the SS2 debate prep team and supported junior learners.",
        severity: "LOW",
      },
    ],
  });

  await prisma.promotionRecord.createMany({
    data: [
      {
        schoolId: school.id,
        studentId: studentDaniel.id,
        fromClassId: jss1Silver.id,
        toClassId: jss2Gold.id,
        fromSessionId: session.id,
        toSessionId: session.id,
        decision: "Promoted after first term review",
      },
      {
        schoolId: school.id,
        studentId: studentAmarachi.id,
        fromClassId: jss2Gold.id,
        toClassId: ss1Emerald.id,
        fromSessionId: session.id,
        toSessionId: session.id,
        decision: "Admitted into science stream",
      },
      {
        schoolId: school.id,
        studentId: studentIbrahim.id,
        fromClassId: primary4Blue.id,
        toClassId: primary6Coral.id,
        fromSessionId: session.id,
        toSessionId: session.id,
        decision: "Promoted with literacy intervention note",
      },
      {
        schoolId: school.id,
        studentId: studentMaryam.id,
        fromClassId: primary4Blue.id,
        toClassId: primary4Blue.id,
        fromSessionId: session.id,
        toSessionId: session.id,
        decision: "Promoted after first year placement review",
      },
      {
        schoolId: school.id,
        studentId: studentEsther.id,
        toClassId: jss1Silver.id,
        toSessionId: session.id,
        decision: "New admission onboarded into junior secondary",
      },
      {
        schoolId: school.id,
        studentId: studentChisom.id,
        fromClassId: ss1Emerald.id,
        toClassId: ss2Topaz.id,
        fromSessionId: session.id,
        toSessionId: session.id,
        decision: "Promoted on distinction list",
      },
    ],
  });

  logStage("Creating operations modules: announcements, transport, hostel, library, discipline, counseling, and clinic visits");
  await prisma.announcement.createMany({
    data: [
      {
        schoolId: school.id,
        createdById: principalUser.id,
        title: "Second term inter-house sports holds on April 18",
        body: "Parents should ensure students come in house jerseys and water bottles.",
        audience: "School-wide",
        channel: "IN_APP",
      },
      {
        schoolId: school.id,
        createdById: bursarUser.id,
        title: "Fee deadline reminder for transport families",
        body: "Transport balances should be cleared before Friday to avoid route suspension.",
        audience: "Parents",
        channel: "SMS",
      },
    ],
  });

  const route = await prisma.transportRoute.create({
    data: {
      schoolId: school.id,
      name: "Bodija Route",
      code: "TR-001",
      driverName: "Adewale Musa",
      driverPhone: "08045551234",
      vehicleRegNo: "FST-204AA",
      capacity: 28,
    },
  });

  await prisma.transportAssignment.create({
    data: {
      schoolId: school.id,
      routeId: route.id,
      studentId: studentDaniel.id,
      stopName: "Bodija Gate",
      amount: 60000,
    },
  });

  const hostel = await prisma.hostelBuilding.create({
    data: {
      schoolId: school.id,
      name: "Emerald House",
      gender: "MALE",
    },
  });

  const hostelRoom = await prisma.hostelRoom.create({
    data: {
      schoolId: school.id,
      hostelBuildingId: hostel.id,
      name: "Room A1",
      capacity: 6,
    },
  });

  await prisma.hostelAllocation.create({
    data: {
      schoolId: school.id,
      roomId: hostelRoom.id,
      studentId: studentDaniel.id,
      academicSessionId: session.id,
      startDate: new Date("2025-09-10"),
    },
  });

  const book = await prisma.libraryBook.create({
    data: {
      schoolId: school.id,
      isbn: "9789780000012",
      title: "New General Mathematics",
      author: "M. F. Macrae",
      copiesTotal: 20,
      copiesAvailable: 19,
      shelfCode: "MAT-1",
    },
  });

  const teacherProfile = await prisma.staffProfile.findUniqueOrThrow({
    where: {
      userId: teacherUser.id,
    },
  });

  const teacherEnglishProfile = await prisma.staffProfile.findUniqueOrThrow({
    where: {
      userId: teacherEnglishUser.id,
    },
  });

  const classTeacherProfile = await prisma.staffProfile.findUniqueOrThrow({
    where: {
      userId: classTeacherUser.id,
    },
  });

  const ictProfile = await prisma.staffProfile.findUniqueOrThrow({
    where: {
      userId: ictUser.id,
    },
  });

  await prisma.disciplineRecord.createMany({
    data: [
      {
        schoolId: school.id,
        studentId: studentEsther.id,
        classId: jss1Silver.id,
        reporterId: classTeacherUser.id,
        escalatedToId: vpAdministrationUser.id,
        referredCounselorId: counsellorUser.id,
        category: "Repeated lateness",
        severity: "MEDIUM",
        description:
          "Student arrived after assembly three times this week; parent meeting and counselling follow-up scheduled.",
        status: "ESCALATED",
        parentNotifiedAt: new Date("2026-04-09T08:20:00.000Z"),
      },
      {
        schoolId: school.id,
        studentId: studentDaniel.id,
        classId: jss2Gold.id,
        reporterId: teacherUser.id,
        category: "Class disruption",
        severity: "LOW",
        description:
          "Minor disruption during Mathematics period; class teacher issued verbal warning.",
        sanction: "Verbal warning",
        outcome: "Student apologised and returned to classwork.",
        status: "RESOLVED",
        resolvedAt: new Date("2026-04-08T11:00:00.000Z"),
      },
    ],
  });

  await prisma.counselingRecord.create({
    data: {
      schoolId: school.id,
      studentId: studentEsther.id,
      counselorId: counsellorUser.id,
      category: "Punctuality and adjustment",
      summary:
        "Initial welfare conversation completed. Student reports transport instability from home.",
      confidentialNote:
        "Counsellor will follow up privately after parent meeting.",
      principalVisible: true,
      sessionDate: new Date("2026-04-10T10:00:00.000Z"),
      followUpDate: new Date("2026-04-17T10:00:00.000Z"),
    },
  });

  await prisma.healthVisit.createMany({
    data: [
      {
        schoolId: school.id,
        studentId: studentAmarachi.id,
        nurseId: nurseUser.id,
        complaint: "Shortness of breath after athletics practice",
        treatment: "Rested in sick bay and used prescribed inhaler.",
        medication: "Guardian-supplied inhaler",
        referral: "Monitor during sports; guardian informed.",
        parentNotifiedAt: new Date("2026-04-08T13:20:00.000Z"),
      },
      {
        schoolId: school.id,
        studentId: studentIbrahim.id,
        nurseId: nurseUser.id,
        complaint: "Headache and mild fever",
        treatment: "Temperature checked and parent called for pickup.",
        referral: "Advised malaria test at family clinic.",
        parentNotifiedAt: new Date("2026-04-09T12:15:00.000Z"),
      },
    ],
  });

  logStage("Creating learning content, curriculum data, schemes of work, and staff training");
  await prisma.learningMaterial.createMany({
    data: [
      {
        schoolId: school.id,
        classId: jss2Gold.id,
        subjectId: math.id,
        teacherId: teacherUser.id,
        title: "Simultaneous Equations Revision Notes",
        description:
          "Teacher notes and worked examples for JSS 2 second term revision.",
        fileUrl: "s3://demo/materials/jss2-simultaneous-equations.pdf",
        status: "PUBLISHED",
        publishedAt: new Date("2026-04-08T12:00:00.000Z"),
      },
      {
        schoolId: school.id,
        classId: ss1Emerald.id,
        subjectId: biology.id,
        teacherId: teacherUser.id,
        title: "Photosynthesis Practical Guide",
        description:
          "Local leaf-starch experiment guide for SS 1 Biology practical.",
        fileUrl: "s3://demo/materials/ss1-photosynthesis-practical.pdf",
        status: "PUBLISHED",
        publishedAt: new Date("2026-04-08T12:30:00.000Z"),
      },
    ],
  });

  await prisma.lessonPlan.createMany({
    data: [
      {
        schoolId: school.id,
        academicSessionId: session.id,
        termId: secondTerm.id,
        classId: jss2Gold.id,
        subjectId: math.id,
        teacherId: teacherUser.id,
        departmentId: scienceDepartment.id,
        weekNumber: 5,
        topic: "Word problems involving simultaneous equations",
        objectives:
          "Learners translate market-day and age word problems into two linear equations.",
        resources:
          "NERDC Basic Mathematics JSS2, board examples, peer worksheet.",
        status: "SUBMITTED",
        submittedAt: new Date("2026-04-08T15:00:00.000Z"),
      },
      {
        schoolId: school.id,
        academicSessionId: session.id,
        termId: secondTerm.id,
        classId: ss1Emerald.id,
        subjectId: biology.id,
        teacherId: teacherUser.id,
        departmentId: scienceDepartment.id,
        weekNumber: 5,
        topic: "Mineral requirements in plants",
        objectives:
          "Students describe macro and micro nutrient deficiencies using Nigerian crop examples.",
        resources: "School farm leaf samples and Biology laboratory chart.",
        status: "APPROVED",
        submittedAt: new Date("2026-04-06T15:00:00.000Z"),
        approvedById: hodUser.id,
        approvedAt: new Date("2026-04-07T08:00:00.000Z"),
        reviewNote: "Approved with practical demonstration included.",
      },
    ],
  });

  await prisma.questionBankItem.createMany({
    data: [
      {
        schoolId: school.id,
        classId: jss2Gold.id,
        subjectId: math.id,
        departmentId: scienceDepartment.id,
        teacherId: teacherUser.id,
        assessmentType: "Test",
        question: "Solve 2x + y = 11 and x - y = 1 using elimination.",
        answerGuide: "x = 4, y = 3 with elimination steps shown.",
        difficulty: "MEDIUM",
        status: "SUBMITTED",
      },
      {
        schoolId: school.id,
        classId: ss1Emerald.id,
        subjectId: biology.id,
        departmentId: scienceDepartment.id,
        teacherId: teacherUser.id,
        assessmentType: "Practical",
        question:
          "Describe how to test a green leaf for starch after exposure to sunlight.",
        answerGuide:
          "Boil leaf, decolourise with alcohol, rinse, add iodine and observe blue-black colour.",
        difficulty: "MEDIUM",
        status: "APPROVED",
        approvedById: hodUser.id,
        approvedAt: new Date("2026-04-07T09:30:00.000Z"),
      },
    ],
  });

  await prisma.visitorLog.createMany({
    data: [
      {
        schoolId: school.id,
        createdById: receptionistUser.id,
        hostUserId: principalUser.id,
        visitorName: "Mrs Kemi Balogun",
        phone: "08034567890",
        purpose: "Admission follow-up with the Principal",
        hostName: "Principal",
        passNumber: "VIS-2026-0418-01",
        status: "SIGNED_IN",
        timeIn: new Date("2026-04-18T09:05:00.000Z"),
      },
      {
        schoolId: school.id,
        createdById: receptionistUser.id,
        hostUserId: bursarUser.id,
        visitorName: "Mr Salisu Mohammed",
        phone: "08032223334",
        purpose: "Fee payment clarification",
        hostName: "Bursar",
        passNumber: "VIS-2026-0418-02",
        status: "SIGNED_OUT",
        timeIn: new Date("2026-04-18T08:35:00.000Z"),
        timeOut: new Date("2026-04-18T09:10:00.000Z"),
      },
    ],
  });

  await prisma.inventoryItem.createMany({
    data: [
      {
        schoolId: school.id,
        category: "Medical supplies",
        name: "First aid gloves",
        sku: "MED-GLOVES",
        quantity: 8,
        unit: "boxes",
        location: "Sick Bay",
        reorderLevel: 10,
      },
      {
        schoolId: school.id,
        category: "Hostel supplies",
        name: "Mattress protectors",
        sku: "HST-MAT-PROT",
        quantity: 35,
        unit: "pieces",
        location: "Emerald House Store",
        reorderLevel: 20,
      },
      {
        schoolId: school.id,
        category: "ICT",
        name: "CBT headset",
        sku: "ICT-HS-001",
        quantity: 42,
        unit: "pieces",
        location: "ICT Lab",
        reorderLevel: 15,
      },
    ],
  });

  await prisma.facilityMaintenanceLog.createMany({
    data: [
      {
        schoolId: school.id,
        reportedById: vpAdministrationUser.id,
        facilityName: "Primary block borehole pump",
        category: "Water",
        issue: "Intermittent water pressure during break period.",
        priority: "HIGH",
        assignedTo: "Facilities contractor",
        cost: 45000,
      },
      {
        schoolId: school.id,
        reportedById: ictUser.id,
        facilityName: "ICT Lab projector",
        category: "ICT",
        issue: "Projector bulb dim and needs replacement before CBT mock.",
        priority: "NORMAL",
        assignedTo: "ICT unit",
      },
    ],
  });

  const examTimetable = await prisma.examTimetableEntry.create({
    data: {
      schoolId: school.id,
      termId: secondTerm.id,
      classId: jss2Gold.id,
      subjectId: math.id,
      examDate: new Date("2026-04-24"),
      startsAt: "09:00",
      endsAt: "11:00",
      venue: "Hall A",
    },
  });

  const seatingCandidates = jss2StudentsForResults.slice(0, 6);
  await prisma.examSeatingPlan.createMany({
    data: seatingCandidates.map((student, index) => ({
      schoolId: school.id,
      examTimetableEntryId: examTimetable.id,
      studentId: student.id,
      hall: "Hall A",
      seatNumber: `A-${String(index + 1).padStart(2, "0")}`,
    })),
  });

  await prisma.invigilationAssignment.create({
    data: {
      schoolId: school.id,
      examTimetableEntryId: examTimetable.id,
      staffId: teacherEnglishProfile.id,
      hall: "Hall A",
      startsAt: new Date("2026-04-24T08:45:00.000Z"),
      endsAt: new Date("2026-04-24T11:15:00.000Z"),
      status: "ASSIGNED",
    },
  });

  await prisma.transportVehicle.create({
    data: {
      schoolId: school.id,
      routeId: route.id,
      plateNumber: "OY0-458GF",
      model: "Toyota Coaster",
      capacity: 28,
      driverName: "Adewale Musa",
      driverPhone: "08045551234",
      status: "ACTIVE",
    },
  });

  await prisma.parentMeeting.create({
    data: {
      schoolId: school.id,
      studentId: studentEsther.id,
      guardianId: guardianAdesola.id,
      staffId: classTeacherProfile.id,
      scheduledById: classTeacherUser.id,
      title: "Punctuality support meeting",
      scheduledAt: new Date("2026-04-19T09:00:00.000Z"),
      notes:
        "Discuss transport plan, morning routine, and class teacher follow-up.",
    },
  });

  await prisma.externalExam.createMany({
    data: [
      {
        schoolId: school.id,
        academicSessionId: session.id,
        classId: ss2Topaz.id,
        name: "WAEC Internal Readiness Mock",
        body: "WAEC",
        status: "REGISTRATION_OPEN",
        registrationOpens: new Date("2026-04-01"),
        registrationCloses: new Date("2026-04-30"),
        examDate: new Date("2026-05-20"),
      },
      {
        schoolId: school.id,
        academicSessionId: session.id,
        classId: jss2Gold.id,
        name: "BECE Mock Examination",
        body: "State BECE",
        status: "DRAFT",
        registrationOpens: new Date("2026-05-01"),
        registrationCloses: new Date("2026-05-15"),
        examDate: new Date("2026-06-03"),
      },
    ],
  });

  await prisma.idCard.createMany({
    data: [
      {
        schoolId: school.id,
        userId: studentUser.id,
        studentId: studentDaniel.id,
        cardNumber: "GFC-STU-0001",
        type: "STUDENT",
        printedAt: new Date("2026-01-12"),
        expiresAt: new Date("2026-12-31"),
      },
      {
        schoolId: school.id,
        userId: ictUser.id,
        staffId: ictProfile.id,
        cardNumber: "GFC-STF-0024",
        type: "STAFF",
        printedAt: new Date("2026-01-12"),
        expiresAt: new Date("2026-12-31"),
      },
    ],
  });

  await prisma.resultEntryWindow.create({
    data: {
      schoolId: school.id,
      academicSessionId: session.id,
      termId: secondTerm.id,
      classId: jss2Gold.id,
      departmentId: scienceDepartment.id,
      createdById: vpAcademicsUser.id,
      title: "JSS 2 Second Term Result Entry",
      opensAt: new Date("2026-04-01T07:00:00.000Z"),
      closesAt: new Date("2026-04-20T17:00:00.000Z"),
      status: "OPEN",
    },
  });

  await prisma.promotionRule.create({
    data: {
      schoolId: school.id,
      name: "Default Nigerian Promotion Rule",
      minAttendanceRate: 75,
      minSubjectsPassed: 5,
      passMark: 40,
      isActive: true,
    },
  });

  await prisma.subjectCombination.create({
    data: {
      schoolId: school.id,
      studentId: studentAmarachi.id,
      academicSessionId: session.id,
      classId: ss1Emerald.id,
      track: "SCIENCE",
      subjectIds: [english.id, biology.id, math.id],
      approvedById: vpAcademicsUser.id,
      approvedAt: new Date("2026-01-15T10:00:00.000Z"),
    },
  });

  await prisma.budget.create({
    data: {
      schoolId: school.id,
      academicSessionId: session.id,
      approvedById: proprietorUser.id,
      title: "2025/2026 Operational Budget",
      totalAmount: 18500000,
      status: "APPROVED",
      approvedAt: new Date("2025-08-20"),
      lines: {
        create: [
          {
            schoolId: school.id,
            category: "Academic resources",
            allocated: 4500000,
            spent: 2750000,
          },
          {
            schoolId: school.id,
            category: "Facilities and maintenance",
            allocated: 3500000,
            spent: 1825000,
          },
          {
            schoolId: school.id,
            category: "Staff development",
            allocated: 1500000,
            spent: 650000,
          },
          {
            schoolId: school.id,
            category: "Transport operations",
            allocated: 2800000,
            spent: 1490000,
          },
        ],
      },
    },
  });

  const platformInvoice = await prisma.platformInvoice.create({
    data: {
      schoolId: school.id,
      invoiceNo: "FR-INV-2026-0001",
      amount: 250000,
      taxAmount: 18750,
      currency: "NGN",
      status: "PAID",
      issuedAt: new Date("2026-04-01"),
      dueAt: new Date("2026-04-07"),
      paidAt: new Date("2026-04-01"),
      metadata: { billingCycle: "monthly", plan: "ENTERPRISE" },
    },
  });

  await prisma.platformBillingTransaction.create({
    data: {
      schoolId: school.id,
      invoiceId: platformInvoice.id,
      amount: 250000,
      currency: "NGN",
      method: "BANK_TRANSFER",
      status: "SUCCESS",
      reference: "FR-PAY-2026-0001",
      processedAt: new Date("2026-04-01T10:00:00.000Z"),
      metadata: { reconciled: true },
    },
  });

  await prisma.platformDiscount.create({
    data: {
      schoolId: school.id,
      type: "PERCENTAGE",
      value: 10,
      reason: "Enterprise annual renewal loyalty discount",
      appliedBy: financeManagerUser.id,
      expiresAt: new Date("2026-12-31"),
    },
  });

  const supportTicket = await prisma.supportTicket.create({
    data: {
      schoolId: school.id,
      createdById: principalUser.id,
      assignedToId: supportAgentUser.id,
      ticketNo: "SUP-2026-0001",
      category: "TECHNICAL_BUG",
      subject: "Parent portal result PDF preview loads slowly",
      description:
        "Principal reported that parents on mobile data experience slow report-card preview loading.",
      priority: "HIGH",
      status: "IN_PROGRESS",
      slaDueAt: new Date("2026-04-19T12:00:00.000Z"),
    },
  });

  await prisma.ticketMessage.createMany({
    data: [
      {
        ticketId: supportTicket.id,
        authorId: principalUser.id,
        body: "Parents report that report-card PDFs take too long to preview on mobile.",
        internalOnly: false,
      },
      {
        ticketId: supportTicket.id,
        authorId: supportAgentUser.id,
        body: "Reproduced on low-bandwidth mode. Escalating to technical admin to inspect PDF asset size.",
        internalOnly: true,
      },
    ],
  });

  const featureFlag = await prisma.platformFeatureFlag.create({
    data: {
      key: "results.fast_pdf_preview",
      name: "Fast report-card PDF preview",
      description:
        "Streams compressed report-card previews for low-bandwidth parent portals.",
      enabledGlobally: false,
      rolloutPercent: 20,
      createdById: developerUser.id,
    },
  });

  await prisma.platformFeatureFlagOverride.create({
    data: {
      flagId: featureFlag.id,
      schoolId: school.id,
      enabled: true,
      setById: developerUser.id,
    },
  });

  const platformAnnouncement = await prisma.platformAnnouncement.create({
    data: {
      authorId: platformAdminUser.id,
      title: "Scheduled maintenance for reporting engine",
      body: "FutureRealm will optimise PDF and analytics services on Saturday from 11:00pm to 11:45pm WAT.",
      type: "WARNING",
      target: { audience: "ALL_SCHOOLS", country: "Nigeria" },
      publishedAt: new Date("2026-04-18T09:00:00.000Z"),
      expiresAt: new Date("2026-04-21T09:00:00.000Z"),
    },
  });

  await prisma.platformAnnouncementView.create({
    data: {
      announcementId: platformAnnouncement.id,
      schoolId: school.id,
      viewedAt: new Date("2026-04-18T09:30:00.000Z"),
    },
  });

  await prisma.maintenanceWindow.create({
    data: {
      createdById: developerUser.id,
      title: "Reporting engine optimisation",
      message:
        "Report-card PDF previews may be briefly unavailable while we optimise the reporting service.",
      startsAt: new Date("2026-04-18T22:00:00.000Z"),
      endsAt: new Date("2026-04-18T22:45:00.000Z"),
      isActive: false,
      whitelist: { schools: [school.id] },
    },
  });

  await prisma.crmInteraction.createMany({
    data: [
      {
        schoolId: school.id,
        createdById: salesManagerUser.id,
        type: "Quarterly Business Review",
        summary:
          "Reviewed adoption milestones, parent portal uptake, and enterprise renewal.",
        outcome: "School is satisfied but wants faster report-card previews.",
        nextAction: "Schedule training for bursary report exports.",
        followUpAt: new Date("2026-05-05T10:00:00.000Z"),
      },
      {
        schoolId: school.id,
        createdById: supportAgentUser.id,
        type: "Support call",
        summary:
          "Walked ICT admin through clearing browser cache and testing parent PDF previews.",
        outcome: "Issue partially mitigated pending fast preview rollout.",
      },
    ],
  });

  await prisma.crmNote.create({
    data: {
      schoolId: school.id,
      createdById: salesManagerUser.id,
      note: "Champion customer; likely candidate for multi-campus expansion if analytics module remains reliable.",
      tags: ["champion", "upsell-candidate", "enterprise"],
    },
  });

  await prisma.lead.createMany({
    data: [
      {
        assignedToId: salesManagerUser.id,
        prospectName: "Bright Future Schools Group",
        contactName: "Mrs Ronke Alabi",
        email: "ronke.alabi@example.com",
        phone: "08060001122",
        source: "Referral",
        stage: "DEMO_SCHEDULED",
        estimatedMrr: 180000,
        notes: "Interested in multi-campus billing and parent portal.",
      },
      {
        assignedToId: salesManagerUser.id,
        prospectName: "Unity Model College",
        contactName: "Mr Musa Danladi",
        email: "musa.danladi@example.com",
        source: "Website",
        stage: "TRIAL",
        estimatedMrr: 120000,
        notes: "Trial expires in 10 days; needs admissions import help.",
      },
    ],
  });

  await prisma.onboardingChecklistItem.createMany({
    data: [
      {
        schoolId: school.id,
        key: "profile",
        label: "School profile completed",
        completedAt: new Date("2025-09-02"),
      },
      {
        schoolId: school.id,
        key: "academic_year",
        label: "Academic year configured",
        completedAt: new Date("2025-09-02"),
      },
      {
        schoolId: school.id,
        key: "classes_subjects",
        label: "Classes and subjects set up",
        completedAt: new Date("2025-09-04"),
      },
      {
        schoolId: school.id,
        key: "first_attendance",
        label: "First attendance taken",
        completedAt: new Date("2025-09-08"),
      },
      {
        schoolId: school.id,
        key: "first_result",
        label: "First result published",
        completedAt: new Date("2025-12-18"),
      },
    ],
  });

  await prisma.npsResponse.create({
    data: {
      schoolId: school.id,
      score: 9,
      role: "Principal",
      comment:
        "The workflow now matches how our teachers and bursar actually work.",
    },
  });

  await prisma.dataPrivacyRequest.create({
    data: {
      schoolId: school.id,
      userId: parentUser.id,
      handledById: platformAdminUser.id,
      type: "EXPORT",
      status: "IN_REVIEW",
      subject: "Parent data export request",
      details:
        "Parent requested a copy of all portal profile and child linkage data.",
    },
  });

  await prisma.platformSession.createMany({
    data: [
      {
        userId: admin.id,
        schoolId: school.id,
        tokenHash: "demo-session-owner",
        ipAddress: "102.89.44.10",
        device: "Chrome on macOS",
        lastActivityAt: new Date("2026-04-18T18:40:00.000Z"),
        expiresAt: new Date("2026-04-19T02:40:00.000Z"),
      },
      {
        userId: supportAgentUser.id,
        schoolId: school.id,
        tokenHash: "demo-session-support",
        ipAddress: "102.89.44.11",
        device: "Chrome on Windows",
        lastActivityAt: new Date("2026-04-18T18:25:00.000Z"),
        expiresAt: new Date("2026-04-19T02:25:00.000Z"),
      },
    ],
  });

  await prisma.loginAttempt.createMany({
    data: [
      {
        userId: admin.id,
        schoolId: school.id,
        email: "admin@futurerealm.sms",
        success: true,
        ipAddress: "102.89.44.10",
        device: "Chrome on macOS",
      },
      {
        email: "unknown@example.com",
        success: false,
        reason: "Invalid credentials",
        ipAddress: "196.45.10.2",
        device: "Mobile Safari",
      },
    ],
  });

  await prisma.backupRecord.create({
    data: {
      schoolId: school.id,
      scope: "SCHOOL",
      status: "SUCCESS",
      sizeMb: 1240,
      location: "s3://future-realm-backups/greenfield/2026-04-18.tar.gz",
      startedAt: new Date("2026-04-18T02:00:00.000Z"),
      endedAt: new Date("2026-04-18T02:08:00.000Z"),
    },
  });

  await prisma.systemLog.createMany({
    data: [
      {
        level: "INFO",
        source: "billing.cron",
        message: "Trial expiry scan completed",
        metadata: { warningsSent: 2 },
      },
      {
        level: "WARN",
        source: "pdf.report-card",
        message: "Slow report-card preview detected",
        schoolId: school.id,
        metadata: { durationMs: 4200 },
      },
    ],
  });

  await prisma.emailTemplate.createMany({
    data: [
      {
        key: "welcome_school_owner",
        subject: "Welcome to FutureRealm SMS",
        body: "Hello {{ownerName}}, your school account is ready.",
        variables: ["ownerName", "schoolName"],
      },
      {
        key: "trial_expiry_warning",
        subject: "Your FutureRealm SMS trial expires soon",
        body: "Your trial expires on {{trialEndsAt}}.",
        variables: ["schoolName", "trialEndsAt"],
      },
      {
        key: "invoice_notice",
        subject: "FutureRealm SMS invoice {{invoiceNo}}",
        body: "Your invoice of {{amount}} is due on {{dueAt}}.",
        variables: ["invoiceNo", "amount", "dueAt"],
      },
    ],
  });

  await prisma.knowledgeBaseArticle.create({
    data: {
      authorId: supportAgentUser.id,
      title: "How to publish term results",
      slug: "publish-term-results",
      category: "Results",
      roleTarget: "Principal",
      body: "Use Results > Approvals to review HOD and VP Academics checks, then publish report cards.",
      videoUrl: "https://example.com/tutorials/results-publishing",
      status: "PUBLISHED",
      publishedAt: new Date("2026-04-01"),
    },
  });

  await prisma.taxRate.create({
    data: {
      country: "Nigeria",
      region: "Oyo",
      rate: 7.5,
    },
  });

  await prisma.leaveRequest.createMany({
    data: [
      {
        schoolId: school.id,
        staffId: teacherProfile.id,
        type: "Personal leave",
        startDate: new Date("2026-04-22"),
        endDate: new Date("2026-04-23"),
        reason: "Family travel outside Ibadan",
        status: "PENDING",
      },
      {
        schoolId: school.id,
        staffId: teacherEnglishProfile.id,
        type: "Training leave",
        startDate: new Date("2026-04-07"),
        endDate: new Date("2026-04-09"),
        reason: "State curriculum workshop",
        status: "APPROVED",
      },
    ],
  });

  await prisma.staffAttendance.createMany({
    data: [
      {
        schoolId: school.id,
        userId: teacherUser.id,
        date: new Date("2026-04-08"),
        status: "PRESENT",
        checkInAt: new Date("2026-04-08T07:41:00.000Z"),
        notes: "Morning briefing attended.",
      },
      {
        schoolId: school.id,
        userId: teacherUser.id,
        date: new Date("2026-04-07"),
        status: "PRESENT",
        checkInAt: new Date("2026-04-07T07:38:00.000Z"),
        checkOutAt: new Date("2026-04-07T15:41:00.000Z"),
      },
      {
        schoolId: school.id,
        userId: teacherPrimaryUser.id,
        date: new Date("2026-04-08"),
        status: "PRESENT",
        checkInAt: new Date("2026-04-08T07:28:00.000Z"),
      },
      {
        schoolId: school.id,
        userId: teacherPrimaryUser.id,
        date: new Date("2026-04-07"),
        status: "PRESENT",
        checkInAt: new Date("2026-04-07T07:31:00.000Z"),
        checkOutAt: new Date("2026-04-07T15:22:00.000Z"),
      },
      {
        schoolId: school.id,
        userId: teacherEnglishUser.id,
        date: new Date("2026-04-08"),
        status: "PRESENT",
        checkInAt: new Date("2026-04-08T07:35:00.000Z"),
      },
      {
        schoolId: school.id,
        userId: teacherEnglishUser.id,
        date: new Date("2026-04-07"),
        status: "ON_LEAVE",
        notes: "Approved curriculum workshop leave.",
      },
    ],
  });

  await prisma.staffAttendancePolicy.create({
    data: {
      schoolId: school.id,
      resumptionTime: "07:45",
      closingTime: "15:30",
      graceMinutes: 10,
      timezone: "Africa/Lagos",
    },
  });

  await prisma.curriculumTopic.createMany({
    data: [
      {
        schoolId: school.id,
        academicSessionId: session.id,
        termId: secondTerm.id,
        classId: jss2Gold.id,
        subjectId: math.id,
        teacherId: teacherUser.id,
        weekNumber: 4,
        topic: "Simultaneous equations",
        subTopic: "Elimination method",
        learningObjectives:
          "Learners solve two-variable linear equations using elimination and substitution.",
        recommendedResources: "NERDC Basic Mathematics JSS2, pages 84-91.",
        assignmentNote: "Exercise 4A, questions 1-10.",
        status: "ACTIVE",
        progressStatus: "IN_PROGRESS",
      },
      {
        schoolId: school.id,
        academicSessionId: session.id,
        termId: secondTerm.id,
        classId: jss2Gold.id,
        subjectId: math.id,
        teacherId: teacherUser.id,
        weekNumber: 5,
        topic: "Word problems involving simultaneous equations",
        subTopic: "Age and number problems",
        learningObjectives:
          "Learners translate word problems into algebraic equations.",
        recommendedResources: "WAEC/NECO-style class practice questions.",
        assignmentNote: "Prepare five word problems from market-day examples.",
        status: "ACTIVE",
        progressStatus: "NOT_STARTED",
      },
      {
        schoolId: school.id,
        academicSessionId: session.id,
        termId: secondTerm.id,
        classId: ss1Emerald.id,
        subjectId: biology.id,
        teacherId: teacherUser.id,
        weekNumber: 4,
        topic: "Nutrition in plants",
        subTopic: "Photosynthesis and mineral requirements",
        learningObjectives:
          "Students explain photosynthesis and identify limiting factors.",
        recommendedResources:
          "Senior Secondary Biology, local leaf-starch experiment.",
        assignmentNote: "Draw and label the photosynthesis experiment setup.",
        status: "ACTIVE",
        progressStatus: "TAUGHT",
        actualDateTaught: new Date("2026-04-08"),
      },
    ],
  });
  const jss1EnglishScheme = [
    [
      "Revision of Parts of Speech",
      "Nouns, pronouns, verbs and adjectives in Nigerian classroom examples",
    ],
    [
      "Comprehension: Nigerian Folktales",
      "Main ideas, supporting details and vocabulary in context",
    ],
    [
      "Vocabulary Development",
      "Synonyms, antonyms and words commonly used in school life",
    ],
    ["Sentence Construction", "Simple, compound and complex sentences"],
    ["Informal Letter Writing", "Address, salutation, body, closing and tone"],
    ["Oral English: Vowel Sounds", "Short vowels, long vowels and diphthongs"],
    [
      "Punctuation and Capitalisation",
      "Full stop, comma, question mark, apostrophe and proper nouns",
    ],
    [
      "Narrative Composition",
      "Plot, setting, characters and Nigerian community settings",
    ],
    ["Direct and Indirect Speech", "Reporting speech and tense changes"],
    [
      "Adverbs and Prepositions",
      "Adverbs of manner/time/place and common prepositions",
    ],
    [
      "Comprehension: Civic Responsibility",
      "Reading passages on school rules and national values",
    ],
    ["Summary Writing", "Identifying key points and writing concise summaries"],
    [
      "Revision and Examination Practice",
      "Past questions, time management and error correction",
    ],
  ];
  await prisma.curriculumTopic.createMany({
    data: jss1EnglishScheme.map(([topic, subTopic], index) => ({
      schoolId: school.id,
      academicSessionId: session.id,
      termId: secondTerm.id,
      classId: jss1Silver.id,
      subjectId: jssEnglish.id,
      teacherId: teacherEnglishUser.id,
      weekNumber: index + 1,
      topic,
      subTopic,
      learningObjectives:
        index < 7
          ? "Learners demonstrate understanding through class exercises, oral drills, and written practice."
          : "Learners prepare to apply the concept in upcoming classwork, homework, and termly assessment.",
      recommendedResources:
        "NERDC English Studies JSS1; New Oxford Secondary English JSS1; teacher-prepared worksheets.",
      assignmentNote:
        index < 7
          ? "Complete workbook practice and correction notes."
          : "Prepare examples from home and school contexts for next lesson.",
      status: "ACTIVE",
      progressStatus: index < 7 ? "TAUGHT" : "NOT_STARTED",
      actualDateTaught:
        index < 7
          ? new Date(`2026-03-${String(2 + index * 3).padStart(2, "0")}`)
          : undefined,
    })),
  });

  const jss1EnglishSowTopics: SeedSchemeTopic[] = [
    {
      topic: "Reading Comprehension: Narrative Texts",
      subtopics: ["Meaning of narrative texts", "Skimming and scanning", "Answering comprehension questions"],
      behaviouralObjectives: "Learners define narrative texts, identify sequence of events, and answer comprehension questions correctly.",
      teachingMethods: ["Guided reading", "Discussion", "Question and answer"],
      teachingAids: ["Passage handout", "Dictionary", "Whiteboard"],
      referenceMaterials: ["NERDC English Studies JSS1", "New Oxford Secondary English JSS1"],
      evaluation: "Short comprehension exercise with vocabulary questions.",
      assignment: "Read a short folktale and list five events in sequence.",
    },
    {
      topic: "Nouns and Pronouns",
      subtopics: ["Common nouns", "Proper nouns", "Personal pronouns", "Possessive pronouns"],
      behaviouralObjectives: "Learners identify nouns and pronouns and use them correctly in simple sentences.",
      teachingMethods: ["Demonstration", "Drill", "Pair work"],
      teachingAids: ["Word cards", "Charts"],
      referenceMaterials: ["Countdown English JSS1 Chapter 3"],
      evaluation: "Class drill on replacing nouns with correct pronouns.",
      assignment: "Write ten sentences using proper nouns from your community.",
    },
    {
      topic: "Verbs and Basic Tenses",
      subtopics: ["Action verbs", "Present tense", "Past tense", "Future tense"],
      behaviouralObjectives: "Learners identify verbs and change sentences from one tense to another.",
      teachingMethods: ["Explanation", "Substitution drill", "Peer correction"],
      teachingAids: ["Verb chart", "Exercise books"],
      referenceMaterials: ["NERDC English Studies JSS1"],
      evaluation: "Rewrite five sentences in the past tense.",
      assignment: "Compose eight sentences showing present and future actions.",
    },
    {
      topic: "Adjectives and Adverbs",
      subtopics: ["Descriptive adjectives", "Adverbs of manner", "Comparison"],
      behaviouralObjectives: "Learners distinguish adjectives from adverbs and use them correctly.",
      teachingMethods: ["Discovery learning", "Game activity"],
      teachingAids: ["Picture cards", "Comparison chart"],
      referenceMaterials: ["New Oxford English JSS1 Unit 5"],
      evaluation: "Fill in the correct adjective or adverb in ten sentences.",
      assignment: "Describe your classroom using six adjectives and two adverbs.",
    },
    {
      topic: "Sentence Structure: Simple and Compound Sentences",
      subtopics: ["Subject and predicate", "Simple sentences", "Compound sentences"],
      behaviouralObjectives: "Learners form simple and compound sentences and punctuate them correctly.",
      teachingMethods: ["Explanation", "Sentence building", "Pair work"],
      teachingAids: ["Sentence strips", "Conjunction chart"],
      referenceMaterials: ["Countdown English JSS1 Sentence Structure"],
      evaluation: "Combine simple sentences into compound sentences.",
      assignment: "Write five simple and five compound sentences about school life.",
    },
    {
      topic: "Comprehension: Informational Text",
      subtopics: ["Main idea", "Supporting details", "Signal words", "Summary writing"],
      behaviouralObjectives: "Learners identify the main idea and supporting details in informational passages.",
      teachingMethods: ["Guided reading", "Graphic organizer"],
      teachingAids: ["Passage handout", "Highlighters"],
      referenceMaterials: ["Essential English for JSS"],
      evaluation: "Answer comprehension and summary questions from a civic passage.",
      assignment: "Summarize the class passage in five clear sentences.",
    },
    {
      topic: "Informal Letter Writing",
      subtopics: ["Address", "Salutation", "Body", "Closing"],
      behaviouralObjectives: "Learners write an informal letter with correct structure and tone.",
      teachingMethods: ["Model demonstration", "Guided writing", "Peer review"],
      teachingAids: ["Sample letter", "Exercise books"],
      referenceMaterials: ["Countdown English JSS1 Letter Writing"],
      evaluation: "In-class informal letter on first week in JSS.",
      assignment: "Write a letter to your cousin describing your school.",
    },
    {
      topic: "Mid-Term Revision",
      subtopics: ["Grammar review", "Comprehension review", "Letter writing review"],
      behaviouralObjectives: "Learners consolidate weeks 1 to 7 and prepare for mid-term assessment.",
      teachingMethods: ["Revision exercise", "Question and answer"],
      teachingAids: ["Revision notes"],
      referenceMaterials: ["All class notes so far"],
      evaluation: "Mid-term revision test.",
      assignment: "Revise correction notes and grammar drills.",
      weekType: "REVISION",
    },
    {
      topic: "Oral English: Vowel Sounds",
      subtopics: ["Short vowels", "Long vowels", "Diphthongs", "Minimal pairs"],
      behaviouralObjectives: "Learners identify and pronounce common vowel sounds accurately.",
      teachingMethods: ["Repetition drill", "Audio practice"],
      teachingAids: ["Vowel chart", "Audio device"],
      referenceMaterials: ["Oral English for Schools and Colleges"],
      evaluation: "Pronounce minimal pairs and selected classroom words.",
      assignment: "Practice ten words with long vowel sounds at home.",
    },
    {
      topic: "Narrative Composition",
      subtopics: ["Plot", "Setting", "Characters", "Beginning, middle, end"],
      behaviouralObjectives: "Learners plan and write a simple narrative essay using familiar Nigerian settings.",
      teachingMethods: ["Story mapping", "Guided writing"],
      teachingAids: ["Story map", "Model essay"],
      referenceMaterials: ["New Oxford English JSS1 Composition"],
      evaluation: "Write a narrative composition titled 'A Memorable Day at School'.",
      assignment: "Complete and edit your narrative essay.",
    },
    {
      topic: "Vocabulary Development",
      subtopics: ["Synonyms", "Antonyms", "Context clues"],
      behaviouralObjectives: "Learners build vocabulary through synonyms, antonyms, and context clues.",
      teachingMethods: ["Word games", "Partner work"],
      teachingAids: ["Vocabulary cards", "Dictionary"],
      referenceMaterials: ["English Vocabulary in Use Elementary"],
      evaluation: "Vocabulary worksheet and sentence construction.",
      assignment: "Use ten new words in original sentences.",
    },
    {
      topic: "Punctuation and Capitalisation",
      subtopics: ["Comma", "Full stop", "Apostrophe", "Quotation marks"],
      behaviouralObjectives: "Learners apply punctuation and capitalisation rules in written work.",
      teachingMethods: ["Error correction", "Dictation"],
      teachingAids: ["Punctuation chart", "Correction strips"],
      referenceMaterials: ["Countdown English JSS1 Punctuation Chapter"],
      evaluation: "Correct an unpunctuated paragraph.",
      assignment: "Copy ten sentences and insert the correct punctuation marks.",
    },
    {
      topic: "Revision and Examination Practice",
      subtopics: ["Past questions", "Time management", "Common errors"],
      behaviouralObjectives: "Learners revise the term's work and answer practice questions confidently.",
      teachingMethods: ["Timed exercise", "Review discussion"],
      teachingAids: ["Past questions", "Revision guide"],
      referenceMaterials: ["School revision pack"],
      evaluation: "Timed mock paper on comprehension, grammar, and composition.",
      assignment: "Revise all correction notes for the terminal examination.",
      weekType: "REVISION",
    },
  ];

  const jss2EnglishSowTopics: SeedSchemeTopic[] = [
    { topic: "Reading for Main Ideas and Inference", subtopics: ["Topic sentence", "Supporting details", "Inference"], behaviouralObjectives: "Learners identify main ideas and make valid inferences from passages.", teachingMethods: ["Guided reading", "Discussion"], teachingAids: ["Passage handout"], evaluation: "Comprehension exercise on community service.", assignment: "Write the main idea of two newspaper paragraphs." },
    { topic: "Clauses and Sentence Patterns", subtopics: ["Independent clauses", "Dependent clauses", "Sentence patterns"], behaviouralObjectives: "Learners distinguish clause types and build correct sentences.", teachingMethods: ["Explanation", "Sentence drill"], teachingAids: ["Sentence strips"], evaluation: "Identify clauses in ten example sentences.", assignment: "Create six sentences using different clause patterns." },
    { topic: "Figures of Speech", subtopics: ["Simile", "Metaphor", "Personification", "Hyperbole"], behaviouralObjectives: "Learners identify common figures of speech and use them in expressions.", teachingMethods: ["Demonstration", "Creative writing"], teachingAids: ["Poem extracts"], evaluation: "Match examples to figures of speech.", assignment: "Write four examples from school and home life." },
    { topic: "Summary Writing", subtopics: ["Picking key points", "Note making", "Concise language"], behaviouralObjectives: "Learners identify key points and write concise summaries.", teachingMethods: ["Model analysis", "Guided practice"], teachingAids: ["Summary passage"], evaluation: "Summarize a passage in five clear sentences.", assignment: "Practice one summary from the class text." },
    { topic: "Formal Letter Writing", subtopics: ["Writer's address", "Receiver's address", "Subject line", "Formal tone"], behaviouralObjectives: "Learners write formal letters using correct format and tone.", teachingMethods: ["Model demonstration", "Guided writing"], teachingAids: ["Formal letter sample"], evaluation: "Write a formal letter requesting books for the library.", assignment: "Rewrite the class formal letter neatly." },
    { topic: "Speech Work: Consonant Sounds", subtopics: ["Voiced consonants", "Voiceless consonants", "Minimal pairs"], behaviouralObjectives: "Learners identify and pronounce common consonant sounds accurately.", teachingMethods: ["Oral drill", "Audio practice"], teachingAids: ["Consonant chart"], evaluation: "Pronunciation exercise using selected word pairs.", assignment: "Practice ten consonant sounds at home." },
    { topic: "Direct and Indirect Speech", subtopics: ["Quotation marks", "Reporting verbs", "Tense changes"], behaviouralObjectives: "Learners change direct speech to indirect speech correctly.", teachingMethods: ["Explanation", "Guided examples"], teachingAids: ["Dialogue samples"], evaluation: "Transform eight direct statements to reported speech.", assignment: "Write five examples of direct and indirect speech." },
    { topic: "Mid-Term Revision", subtopics: ["Comprehension", "Letter writing", "Grammar review"], behaviouralObjectives: "Learners consolidate the first half of the term and prepare for assessment.", teachingMethods: ["Revision", "Quiz"], teachingAids: ["Revision notes"], evaluation: "Mid-term assessment.", assignment: "Revise note corrections and grammar exercises.", weekType: "REVISION" },
    { topic: "Debate and Speaking Skills", subtopics: ["Constructing arguments", "Speaking confidently", "Listening respectfully"], behaviouralObjectives: "Learners speak logically and confidently during guided debate.", teachingMethods: ["Debate", "Group work"], teachingAids: ["Debate motion cards"], evaluation: "Class debate on whether uniforms should be compulsory.", assignment: "Prepare three points for the next debate." },
    { topic: "Comprehension: Argumentative Text", subtopics: ["Fact and opinion", "Author's viewpoint", "Supporting evidence"], behaviouralObjectives: "Learners distinguish fact from opinion in argumentative passages.", teachingMethods: ["Guided reading", "Discussion"], teachingAids: ["Argumentative passage handout"], evaluation: "Answer inference questions from the class passage.", assignment: "List four facts and four opinions from a newspaper article." },
    { topic: "Vocabulary Through Word Formation", subtopics: ["Prefixes", "Suffixes", "Root words"], behaviouralObjectives: "Learners use prefixes and suffixes to derive word meanings.", teachingMethods: ["Word building game", "Worksheet"], teachingAids: ["Word cards"], evaluation: "Create new words from base words with correct prefixes and suffixes.", assignment: "Write ten derived words from class examples." },
    { topic: "Expository Composition", subtopics: ["Introduction", "Body paragraphs", "Conclusion"], behaviouralObjectives: "Learners write an expository essay with clear structure and supporting details.", teachingMethods: ["Model essay analysis", "Guided writing"], teachingAids: ["Essay plan"], evaluation: "Write an essay on keeping the school environment clean.", assignment: "Rewrite your essay after corrections." },
    { topic: "Revision and Examination Practice", subtopics: ["Past questions", "Error correction", "Essay planning"], behaviouralObjectives: "Learners revise all major skills covered this term and practise timed responses.", teachingMethods: ["Mock test", "Review discussion"], teachingAids: ["Past questions"], evaluation: "Timed examination practice.", assignment: "Study all corrected scripts and notes.", weekType: "REVISION" },
  ];

  const jss3EnglishSowTopics: SeedSchemeTopic[] = [
    { topic: "Comprehension and Critical Response", subtopics: ["Main ideas", "Tone", "Inference", "Author's purpose"], behaviouralObjectives: "Learners read closely and give reasoned responses to questions.", teachingMethods: ["Guided reading", "Discussion"], teachingAids: ["Passage handout"], evaluation: "Critical response questions on a passage about civic duty.", assignment: "Summarize the author's message in one paragraph." },
    { topic: "Essay Writing: Argumentative Essays", subtopics: ["Forming arguments", "Supporting evidence", "Counter arguments"], behaviouralObjectives: "Learners present clear arguments in well-structured essays.", teachingMethods: ["Model essay review", "Guided writing"], teachingAids: ["Essay outline"], evaluation: "Short argumentative essay in class.", assignment: "Write a full essay on a class debate topic." },
    { topic: "Summary and Note Making", subtopics: ["Key points", "Topic sentences", "Concise language"], behaviouralObjectives: "Learners identify and condense key ideas without distortion.", teachingMethods: ["Demonstration", "Pair work"], teachingAids: ["Summary passage"], evaluation: "Summary exercise from an expository passage.", assignment: "Practise one summary from a textbook passage." },
    { topic: "Registers and Vocabulary Choice", subtopics: ["Formal register", "Informal register", "Technical vocabulary"], behaviouralObjectives: "Learners choose vocabulary suitable for audience and purpose.", teachingMethods: ["Examples", "Role play"], teachingAids: ["Dialogue strips"], evaluation: "Identify the correct register for communication contexts.", assignment: "Rewrite an informal note as a formal message." },
    { topic: "Speech Work and Stress Patterns", subtopics: ["Word stress", "Sentence stress", "Meaning changes"], behaviouralObjectives: "Learners place stress correctly in common words and statements.", teachingMethods: ["Oral drill", "Audio modelling"], teachingAids: ["Pronunciation chart"], evaluation: "Read a short passage with attention to stress.", assignment: "Practise stress patterns for twenty selected words." },
    { topic: "Revision of Grammar Structures", subtopics: ["Tenses", "Clauses", "Concord", "Punctuation"], behaviouralObjectives: "Learners revise core grammar structures for JSS final assessment.", teachingMethods: ["Revision drill", "Quiz"], teachingAids: ["Revision notes"], evaluation: "Grammar test covering major structures.", assignment: "Complete revision worksheet." },
    { topic: "Letter Writing and Examination Format", subtopics: ["Informal letter", "Formal letter", "Article writing"], behaviouralObjectives: "Learners select the correct writing format for examination questions.", teachingMethods: ["Comparison table", "Guided correction"], teachingAids: ["Format samples"], evaluation: "Outline the correct response format for three questions.", assignment: "Write one formal and one informal letter." },
    { topic: "Mid-Term Revision", subtopics: ["Essay review", "Grammar review", "Comprehension review"], behaviouralObjectives: "Learners consolidate weeks 1 to 7 and identify weak areas.", teachingMethods: ["Revision", "Mock quiz"], teachingAids: ["Past scripts"], evaluation: "Mid-term revision paper.", assignment: "Review all marked exercises and corrections.", weekType: "REVISION" },
    { topic: "Literature and Appreciation", subtopics: ["Poetry appreciation", "Theme", "Imagery", "Moral lessons"], behaviouralObjectives: "Learners identify basic literary devices and themes in simple poems.", teachingMethods: ["Reading aloud", "Discussion"], teachingAids: ["Poem handout"], evaluation: "Explain the theme of the selected poem.", assignment: "Write five lines about your favourite poem." },
    { topic: "Comprehension: Examination Practice", subtopics: ["Time allocation", "Reading strategy", "Answer planning"], behaviouralObjectives: "Learners improve speed and accuracy in examination comprehension practice.", teachingMethods: ["Timed practice", "Feedback review"], teachingAids: ["Past comprehension passages"], evaluation: "Timed comprehension section.", assignment: "Practise one more passage at home." },
    { topic: "Essay Editing and Error Correction", subtopics: ["Common composition errors", "Sentence improvement", "Punctuation review"], behaviouralObjectives: "Learners edit compositions and identify recurring writing errors.", teachingMethods: ["Peer editing", "Teacher correction"], teachingAids: ["Error correction strips"], evaluation: "Edit an error-filled essay and justify corrections.", assignment: "Rewrite corrected essay neatly." },
    { topic: "Oral English Revision", subtopics: ["Consonants", "Vowels", "Stress", "Pronunciation review"], behaviouralObjectives: "Learners revise oral English features likely to appear in assessment.", teachingMethods: ["Drill", "Repetition"], teachingAids: ["Pronunciation chart"], evaluation: "Teacher-led oral response drill.", assignment: "Practise class pronunciation list." },
    { topic: "Final Revision and Examination Drill", subtopics: ["Past questions", "Essay planning", "Summary practice"], behaviouralObjectives: "Learners revise all core English components in preparation for terminal examination.", teachingMethods: ["Mock test", "Feedback"], teachingAids: ["Past questions"], evaluation: "Full revision drill under timed conditions.", assignment: "Study all revision topics and teacher feedback.", weekType: "REVISION" },
  ];

  const jss1MathSowTopics: SeedSchemeTopic[] = [
    { topic: "Whole Numbers and Place Value", subtopics: ["Place value chart", "Reading large numbers", "Expanded form"], behaviouralObjectives: "Learners read, write, and expand whole numbers correctly.", teachingMethods: ["Explanation", "Number drill"], teachingAids: ["Place value chart"], evaluation: "Write and expand given numbers.", assignment: "Practise ten place value questions." },
    { topic: "Operations on Whole Numbers", subtopics: ["Addition", "Subtraction", "Multiplication", "Division"], behaviouralObjectives: "Learners solve operations on whole numbers accurately.", teachingMethods: ["Worked examples", "Class exercise"], teachingAids: ["Board examples"], evaluation: "Solve mixed operation questions.", assignment: "Complete exercise on basic operations." },
    { topic: "Fractions", subtopics: ["Proper fractions", "Improper fractions", "Equivalent fractions"], behaviouralObjectives: "Learners identify and simplify fractions.", teachingMethods: ["Demonstration", "Practice"], teachingAids: ["Fraction strips"], evaluation: "Simplify and compare fractions.", assignment: "Answer ten fraction questions." },
    { topic: "Decimals", subtopics: ["Place value in decimals", "Addition and subtraction of decimals"], behaviouralObjectives: "Learners read decimals and perform simple operations on them.", teachingMethods: ["Explanation", "Guided practice"], teachingAids: ["Decimal chart"], evaluation: "Add and subtract decimals correctly.", assignment: "Worksheet on decimal operations." },
    { topic: "Percentages", subtopics: ["Meaning of percent", "Converting fractions and decimals"], behaviouralObjectives: "Learners convert between fractions, decimals, and percentages.", teachingMethods: ["Demonstration", "Question and answer"], teachingAids: ["Percent chart"], evaluation: "Convert numbers to percentages and vice versa.", assignment: "Solve practical percentage questions." },
    { topic: "Simple Algebraic Expressions", subtopics: ["Variables", "Terms", "Simplifying expressions"], behaviouralObjectives: "Learners identify algebraic terms and simplify simple expressions.", teachingMethods: ["Explanation", "Practice drill"], teachingAids: ["Algebra chart"], evaluation: "Simplify five algebraic expressions.", assignment: "Practise class exercise on algebraic terms." },
    { topic: "Linear Equations in One Variable", subtopics: ["Balancing method", "Checking solutions"], behaviouralObjectives: "Learners solve simple linear equations using balancing steps.", teachingMethods: ["Worked examples", "Pair practice"], teachingAids: ["Equation cards"], evaluation: "Solve simple equations and verify answers.", assignment: "Solve ten equations in your workbook." },
    { topic: "Mid-Term Revision", subtopics: ["Numbers", "Fractions", "Decimals", "Algebra"], behaviouralObjectives: "Learners review all first-half topics and prepare for assessment.", teachingMethods: ["Revision quiz", "Correction session"], teachingAids: ["Revision notes"], evaluation: "Mid-term revision test.", assignment: "Study corrected examples.", weekType: "REVISION" },
    { topic: "Geometry: Lines and Angles", subtopics: ["Types of lines", "Types of angles", "Measuring angles"], behaviouralObjectives: "Learners identify and measure angles accurately.", teachingMethods: ["Demonstration", "Practical work"], teachingAids: ["Protractor", "Ruler"], evaluation: "Measure and classify given angles.", assignment: "Draw lines and angles in your notebook." },
    { topic: "Plane Shapes", subtopics: ["Triangles", "Quadrilaterals", "Properties of shapes"], behaviouralObjectives: "Learners identify common plane shapes and state their properties.", teachingMethods: ["Illustration", "Shape hunt"], teachingAids: ["Shape cut-outs"], evaluation: "State properties of listed shapes.", assignment: "Draw five plane shapes and label their sides." },
    { topic: "Perimeter of Plane Figures", subtopics: ["Formula for perimeter", "Worked examples"], behaviouralObjectives: "Learners calculate perimeter of simple figures correctly.", teachingMethods: ["Explanation", "Exercise"], teachingAids: ["Ruler", "Worksheet"], evaluation: "Find the perimeter of given shapes.", assignment: "Calculate perimeter from five homework figures." },
    { topic: "Data Representation", subtopics: ["Tally chart", "Pictogram", "Bar chart"], behaviouralObjectives: "Learners collect simple data and display it using charts.", teachingMethods: ["Group activity", "Discussion"], teachingAids: ["Graph sheet", "Chart paper"], evaluation: "Draw a simple bar chart from class data.", assignment: "Record home survey data and present it in a tally table." },
    { topic: "Revision and Examination Drill", subtopics: ["Past questions", "Error correction", "Formula recall"], behaviouralObjectives: "Learners revise the term's mathematics topics and practise solving mixed questions.", teachingMethods: ["Mock test", "Correction drill"], teachingAids: ["Past questions"], evaluation: "Timed revision paper.", assignment: "Revise all formulas and corrected work.", weekType: "REVISION" },
  ];

  const ss1BiologySowTopics: SeedSchemeTopic[] = [
    { topic: "Biology as a Science", subtopics: ["Meaning of biology", "Branches of biology", "Importance of biology"], behaviouralObjectives: "Students explain biology and identify its major branches.", teachingMethods: ["Lecture", "Discussion"], teachingAids: ["Chart", "Textbook"], evaluation: "Short note on branches of biology.", assignment: "List three careers related to biology." },
    { topic: "Characteristics of Living Things", subtopics: ["Movement", "Respiration", "Growth", "Reproduction"], behaviouralObjectives: "Students state and explain key characteristics of living things.", teachingMethods: ["Explanation", "Observation"], teachingAids: ["Specimens", "Charts"], evaluation: "Identify characteristics in everyday organisms.", assignment: "Observe organisms around your home and list living characteristics." },
    { topic: "Classification of Living Things", subtopics: ["Kingdoms", "Taxonomy", "Binomial nomenclature"], behaviouralObjectives: "Students classify living things into broad groups.", teachingMethods: ["Lecture", "Guided sorting"], teachingAids: ["Classification chart"], evaluation: "Group selected organisms into kingdoms.", assignment: "Write examples of organisms in each kingdom." },
    { topic: "Cell Structure and Organization", subtopics: ["Plant cell", "Animal cell", "Cell organelles"], behaviouralObjectives: "Students draw and label plant and animal cells.", teachingMethods: ["Demonstration", "Drawing practice"], teachingAids: ["Microscope images", "Charts"], evaluation: "Label a cell diagram correctly.", assignment: "Draw plant and animal cells in your notebook." },
    { topic: "Nutrition in Plants", subtopics: ["Photosynthesis", "Mineral requirements", "Limiting factors"], behaviouralObjectives: "Students explain photosynthesis and factors that affect it.", teachingMethods: ["Explanation", "Experiment discussion"], teachingAids: ["Leaf specimen", "Experiment setup"], evaluation: "Explain the starch test in leaves.", assignment: "Draw and label the photosynthesis experiment setup." },
    { topic: "Nutrition in Animals", subtopics: ["Food classes", "Balanced diet", "Digestive system"], behaviouralObjectives: "Students identify food classes and explain balanced diet.", teachingMethods: ["Discussion", "Chart work"], teachingAids: ["Digestive system chart"], evaluation: "State the importance of each class of food.", assignment: "Prepare a balanced diet chart for a teenager." },
    { topic: "Ecological Concepts", subtopics: ["Habitat", "Population", "Community", "Ecosystem"], behaviouralObjectives: "Students explain basic ecological terms and give examples.", teachingMethods: ["Field observation", "Discussion"], teachingAids: ["Nature pictures"], evaluation: "Define habitat, population, community, and ecosystem.", assignment: "Describe an ecosystem in your locality." },
    { topic: "Mid-Term Revision", subtopics: ["Cells", "Nutrition", "Ecology", "Classification"], behaviouralObjectives: "Students consolidate first-half topics and prepare for assessment.", teachingMethods: ["Revision", "Quiz"], teachingAids: ["Revision notes"], evaluation: "Mid-term biology revision test.", assignment: "Revise class notes and diagrams.", weekType: "REVISION" },
    { topic: "Micro-Organisms", subtopics: ["Useful micro-organisms", "Harmful micro-organisms", "Prevention of disease"], behaviouralObjectives: "Students identify useful and harmful micro-organisms.", teachingMethods: ["Explanation", "Discussion"], teachingAids: ["Micro-organism chart"], evaluation: "Differentiate useful and harmful micro-organisms.", assignment: "List five diseases caused by micro-organisms." },
    { topic: "Reproduction in Flowering Plants", subtopics: ["Parts of a flower", "Pollination", "Fertilization"], behaviouralObjectives: "Students describe reproduction in flowering plants.", teachingMethods: ["Practical demonstration", "Drawing"], teachingAids: ["Flower specimen", "Chart"], evaluation: "Label a flower and explain pollination.", assignment: "Collect and press a flower for class discussion." },
    { topic: "Seed Germination", subtopics: ["Conditions for germination", "Types of germination"], behaviouralObjectives: "Students state conditions necessary for germination.", teachingMethods: ["Experiment", "Observation"], teachingAids: ["Bean seeds", "Cotton wool", "Water"], evaluation: "State conditions necessary for seed germination.", assignment: "Set up a simple germination experiment at home." },
    { topic: "Conservation of Natural Resources", subtopics: ["Deforestation", "Soil erosion", "Wildlife conservation"], behaviouralObjectives: "Students explain the need for conservation of natural resources.", teachingMethods: ["Discussion", "Case study"], teachingAids: ["Pictures", "Local examples"], evaluation: "Write a short note on conservation.", assignment: "Identify two conservation challenges in your state." },
    { topic: "Revision and Examination Practice", subtopics: ["Past questions", "Diagram practice", "Short answers"], behaviouralObjectives: "Students revise all major biology themes covered this term.", teachingMethods: ["Mock test", "Feedback review"], teachingAids: ["Past questions", "Marking guide"], evaluation: "Timed biology revision paper.", assignment: "Study all corrected questions and diagrams.", weekType: "REVISION" },
  ];

  await createSeedSchemeOfWork({
    schoolId: school.id,
    academicSessionId: session.id,
    termId: secondTerm.id,
    subjectId: jssEnglish.id,
    classId: jss1Silver.id,
    teacherId: teacherEnglishUser.id,
    submittedById: teacherEnglishUser.id,
    approvedById: principalUser.id,
    topics: jss1EnglishSowTopics,
    coveredTeachingWeeks: 7,
  });

  await createSeedSchemeOfWork({
    schoolId: school.id,
    academicSessionId: session.id,
    termId: secondTerm.id,
    subjectId: jssEnglish.id,
    classId: jss2Gold.id,
    teacherId: teacherEnglishUser.id,
    submittedById: teacherEnglishUser.id,
    approvedById: principalUser.id,
    topics: jss2EnglishSowTopics,
    coveredTeachingWeeks: 6,
  });

  if (jss3Bronze) {
    await createSeedSchemeOfWork({
      schoolId: school.id,
      academicSessionId: session.id,
      termId: secondTerm.id,
      subjectId: jssEnglish.id,
      classId: jss3Bronze.id,
      teacherId: teacherEnglishUser.id,
      submittedById: teacherEnglishUser.id,
      approvedById: principalUser.id,
      topics: jss3EnglishSowTopics,
      coveredTeachingWeeks: 5,
    });
  }

  await createSeedSchemeOfWork({
    schoolId: school.id,
    academicSessionId: session.id,
    termId: secondTerm.id,
    subjectId: math.id,
    classId: jss1Silver.id,
    teacherId: teacherUser.id,
    submittedById: teacherUser.id,
    approvedById: principalUser.id,
    topics: jss1MathSowTopics,
    coveredTeachingWeeks: 6,
  });

  await createSeedSchemeOfWork({
    schoolId: school.id,
    academicSessionId: session.id,
    termId: secondTerm.id,
    subjectId: biology.id,
    classId: ss1Emerald.id,
    teacherId: teacherUser.id,
    submittedById: teacherUser.id,
    approvedById: principalUser.id,
    topics: ss1BiologySowTopics,
    coveredTeachingWeeks: 5,
  });

  const teacherPrimaryProfile = await prisma.staffProfile.findUniqueOrThrow({
    where: {
      userId: teacherPrimaryUser.id,
    },
  });

  const curriculumTraining = await prisma.trainingProgram.create({
    data: {
      schoolId: school.id,
      createdById: principalUser.id,
      title: "Second Term Scheme of Work Orientation",
      description:
        "Internal CPD session for Nigerian curriculum coverage, weekly lesson topics, and assessment alignment.",
      category: "CURRICULUM_ORIENTATION",
      trainingType: "INTERNAL",
      startsAt: new Date("2026-04-18T09:00:00.000Z"),
      endsAt: new Date("2026-04-18T12:00:00.000Z"),
      durationHours: 3,
      facilitator: "Principal / Head Teacher",
      provider: "Greenfield College",
      location: "ICT Lab",
      mandatory: true,
    },
  });

  await prisma.trainingParticipant.createMany({
    data: [
      {
        schoolId: school.id,
        trainingProgramId: curriculumTraining.id,
        userId: teacherUser.id,
        staffId: teacherProfile.id,
        status: "COMPLETED",
        attendedAt: new Date("2026-04-18T09:05:00.000Z"),
        completedAt: new Date("2026-04-18T12:00:00.000Z"),
        cpdPoints: 3,
        notes: "Completed curriculum mapping practical.",
      },
      {
        schoolId: school.id,
        trainingProgramId: curriculumTraining.id,
        userId: teacherPrimaryUser.id,
        staffId: teacherPrimaryProfile.id,
        status: "INVITED",
        cpdPoints: 0,
        notes: "Pending mandatory curriculum orientation.",
      },
      {
        schoolId: school.id,
        trainingProgramId: curriculumTraining.id,
        userId: teacherEnglishUser.id,
        staffId: teacherEnglishProfile.id,
        status: "ATTENDED",
        attendedAt: new Date("2026-04-18T09:10:00.000Z"),
        cpdPoints: 1.5,
        notes: "Certificate pending upload.",
      },
    ],
  });

  await prisma.libraryLoan.create({
    data: {
      schoolId: school.id,
      bookId: book.id,
      staffId: teacherProfile.id,
      borrowedAt: new Date("2026-04-02"),
      dueAt: new Date("2026-04-16"),
      fineAmount: 0,
    },
  });

  await prisma.integrationConfig.createMany({
    data: [
      {
        schoolId: school.id,
        provider: "PAYSTACK",
        settings: { mode: "sandbox", publicKey: "pk_test_xxx" },
        enabled: false,
      },
      {
        schoolId: school.id,
        provider: "FLUTTERWAVE",
        settings: { mode: "sandbox", publicKey: "FLWPUBK_TEST-xxx" },
        enabled: false,
      },
    ],
  });

  logStage("Writing final audit trail and seed summary");
  await prisma.auditLog.create({
    data: {
      schoolId: school.id,
      actorId: admin.id,
      action: "CREATE",
      entityType: "seed",
      entityId: school.id,
      metadata: { note: "Initial school seed completed" },
    },
  });

  const [
    userCount,
    studentCount,
    parentCount,
    guardianCount,
    classCount,
    activeAcademicSession,
    activeTerm,
    sampleGeneratedStudentUsers,
    sampleGeneratedParentUsers,
  ] = await Promise.all([
    prisma.user.count({ where: { schoolId: school.id } }),
    prisma.student.count({ where: { schoolId: school.id } }),
    prisma.user.count({ where: { schoolId: school.id, role: "PARENT" } }),
    prisma.guardian.count({ where: { schoolId: school.id } }),
    prisma.classRoom.count({ where: { schoolId: school.id } }),
    prisma.academicSession.findFirst({
      where: { schoolId: school.id, isCurrent: true },
      select: { name: true },
    }),
    prisma.term.findFirst({
      where: { schoolId: school.id, isCurrent: true },
      select: { name: true },
    }),
    prisma.user.findMany({
      where: {
        schoolId: school.id,
        role: "STUDENT",
        email: { contains: "@students.greenfieldcollege.ng" },
      },
      select: { email: true },
      orderBy: { email: "asc" },
      take: 5,
    }),
    prisma.user.findMany({
      where: {
        schoolId: school.id,
        role: "PARENT",
        email: { contains: "@parents.greenfieldcollege.ng" },
      },
      select: { email: true },
      orderBy: { email: "asc" },
      take: 5,
    }),
  ]);

  console.log("\n================ SEED COMPLETE ================");
  console.log(
    `School: ${school.name}`,
  );
  console.log(
    `Active academic context: ${activeAcademicSession?.name ?? "Not set"} · ${activeTerm?.name ?? "Not set"}`,
  );
  console.log(
    `Totals: ${classCount} classes · ${studentCount} students · ${guardianCount} guardians · ${parentCount} parent users · ${userCount} total users`,
  );

  printCredentialGroup("Platform Access", [
    "admin@futurerealm.sms",
    "platform.admin@futurerealm.sms",
    "support@futurerealm.sms",
    "sales@futurerealm.sms",
    "finance@futurerealm.sms",
    "developer@futurerealm.sms",
  ]);

  printCredentialGroup("School Leadership", [
    "principal@greenfieldcollege.ng",
    "proprietor@greenfieldcollege.ng",
    "administrator@greenfieldcollege.ng",
    "head.teacher@greenfieldcollege.ng",
    "vp.academics@greenfieldcollege.ng",
    "vp.admin@greenfieldcollege.ng",
    "vp.special@greenfieldcollege.ng",
  ]);

  printCredentialGroup("School Operations", [
    "admin.officer@greenfieldcollege.ng",
    "admissions@greenfieldcollege.ng",
    "bursar@greenfieldcollege.ng",
    "counsellor@greenfieldcollege.ng",
    "nurse@greenfieldcollege.ng",
    "frontdesk@greenfieldcollege.ng",
    "librarian@greenfieldcollege.ng",
    "transport@greenfieldcollege.ng",
    "hostel@greenfieldcollege.ng",
    "ict@greenfieldcollege.ng",
  ]);

  printCredentialGroup("Teaching Accounts", [
    "teacher@greenfieldcollege.ng",
    "teacher.primary@greenfieldcollege.ng",
    "teacher.english@greenfieldcollege.ng",
    "class.teacher@greenfieldcollege.ng",
    "subject.teacher@greenfieldcollege.ng",
  ]);

  printCredentialGroup("Named Parent Accounts", [
    "parent@greenfieldcollege.ng",
    "chinelo.obi@greenfieldcollege.ng",
    "salisu.mohammed@greenfieldcollege.ng",
  ]);

  printCredentialGroup("Named Student Accounts", [
    "student@greenfieldcollege.ng",
    "maryam.yusuf@greenfieldcollege.ng",
    "amarachi.obi@greenfieldcollege.ng",
    "ibrahim.salisu@greenfieldcollege.ng",
    "esther.adewale@greenfieldcollege.ng",
  ]);

  printCredentialGroup(
    "Sample Generated Parent Accounts",
    sampleGeneratedParentUsers.map((item) => item.email),
  );

  printCredentialGroup(
    "Sample Generated Student Accounts",
    sampleGeneratedStudentUsers.map((item) => item.email),
  );

  console.log("==============================================\n");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
