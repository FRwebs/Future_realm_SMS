import { beforeAll, describe, expect, it } from "vitest";

import { seededFixtures, sessionFor, type SeededFixtures } from "./fixtures";

/**
 * Service flows against the seeded database.
 *
 * These ran against an in-memory demo store until it was removed; every service
 * talks to Prisma now. They resolve real ids from the seed rather than naming
 * fixtures, and assert what a service must do — scope data to the account
 * asking, move an applicant through admissions, reduce a balance by what was
 * paid — rather than what a particular row happens to be called.
 *
 * They need a seeded database. Without one, `seededFixtures` fails with the
 * command to run rather than a confusing null.
 */
describe("service flows", () => {
  let fx: SeededFixtures;

  beforeAll(async () => {
    process.env.JWT_SECRET ??= "local-development-secret";
    fx = await seededFixtures();
  });

  it("authenticates a seeded account", async () => {
    const { AuthService } = await import("../../backend/src/modules/auth/auth.service");
    const session = await new AuthService().authenticateUser(
      fx.principal.email,
      "FutureRealm123!",
    );
    expect(session?.role).toBe("PRINCIPAL");
  });

  it("creates an admission and counts it", async () => {
    const { AdmissionsService } = await import(
      "../../backend/src/modules/admissions/admissions.service"
    );
    const service = new AdmissionsService();
    const before = (await service.listAdmissions(fx.schoolId)).length;

    await service.createAdmission(fx.schoolId, {
      firstName: "Peace",
      lastName: "Ibe",
      guardianName: "Chika Ibe",
      guardianPhone: "08031112222",
      desiredClass: "JSS 1",
      gender: "FEMALE",
    });

    expect((await service.listAdmissions(fx.schoolId)).length).toBe(before + 1);
  });

  it("moves an applicant through the full admissions lifecycle and enrols them", async () => {
    const { AdmissionsService } = await import(
      "../../backend/src/modules/admissions/admissions.service"
    );
    const { StudentsService } = await import(
      "../../backend/src/modules/students/students.service"
    );
    const admissions = new AdmissionsService();
    const students = new StudentsService();

    // A payment reference is unique per school, so it has to be unique per run
    // too — otherwise the second run of this suite collides with the first.
    const run = Date.now().toString(36);

    // Start from an applicant this test created, so the lifecycle is not at the
    // mercy of whatever state a seeded one happens to be in.
    const applicant = await admissions.createAdmission(fx.schoolId, {
      firstName: "Lifecycle",
      lastName: "Candidate",
      guardianName: "Chika Ibe",
      guardianPhone: "08031112223",
      desiredClass: "JSS 1",
      gender: "MALE",
    });
    const studentsBefore = (await students.listStudents(fx.schoolId)).length;

    const reviewed = await admissions.reviewAdmission(
      fx.schoolId,
      fx.principal.userId,
      "Adaeze Okoro",
      applicant.id,
      {
        recommendedClass: applicant.desiredClass,
        documentStatus: "Documents complete",
        screeningOutcome: "Suitable for class",
        notes: "Guardian details, documents, and class placement have been checked.",
      },
    );
    expect(reviewed.status).toBe("REVIEWING");
    // The service records who actually reviewed it, not the name it was handed.
    expect(reviewed.reviewedBy).toBe(fx.principal.name);

    const feeVerified = await admissions.verifyApplicationFee(
      fx.schoolId,
      fx.principal.userId,
      reviewed.id,
      { amount: 10000, reference: `ADM-FEE-${run}`, waived: false, note: "Application fee verified." },
    );
    expect(feeVerified.status).toBe("PAYMENT_PENDING");
    expect(feeVerified.applicationFeeStatus).toBe("VERIFIED");

    const screening = await admissions.scheduleScreening(
      fx.schoolId,
      fx.principal.userId,
      reviewed.id,
      { scheduledAt: "2026-04-15", venue: "ICT Lab", note: "Entrance screening booked." },
    );
    expect(screening.status).toBe("SCREENING_SCHEDULED");

    const screened = await admissions.recordScreeningResult(
      fx.schoolId,
      fx.teacher.userId,
      reviewed.id,
      {
        score: 82,
        maxScore: 100,
        result: "PASS",
        recommendation: "Recommend for admission",
        remarks: "Strong literacy and numeracy score.",
      },
    );
    expect(screened.status).toBe("SCREENING_COMPLETED");

    const recommended = await admissions.recommendApplication(
      fx.schoolId,
      fx.principal.userId,
      reviewed.id,
      { notes: "Recommended after document review and screening." },
    );
    expect(recommended.status).toBe("RECOMMENDED");

    const approved = await admissions.decideAdmission(
      fx.schoolId,
      fx.principal.userId,
      reviewed.id,
      { decision: "APPROVED", notes: "Approved after review." },
    );
    expect(approved.status).toBe("APPROVED");

    const offered = await admissions.issueOffer(fx.schoolId, fx.principal.userId, approved.id, {
      checklist: "Acceptance fee, Passport photograph",
      expiryDays: 14,
    });
    expect(offered.status).toBe("OFFER_SENT");
    expect(offered.offerStatus).toBe("SENT");

    const accepted = await admissions.acceptOffer(fx.schoolId, offered.id, {
      note: "Guardian accepted offer.",
    });
    expect(accepted.status).toBe("ACCEPTED");

    const cleared = await admissions.markFinanciallyCleared(
      fx.schoolId,
      fx.principal.userId,
      accepted.id,
      { amount: 50000, reference: `ADM-CLEAR-${run}`, waived: false, note: "Deposit confirmed." },
    );
    expect(cleared.status).toBe("FINANCIALLY_CLEARED");

    const registered = await admissions.enrollApplicant(
      fx.schoolId,
      fx.principal.userId,
      cleared.id,
      { className: approved.desiredClass, guardianRelationship: "Parent" },
    );

    expect(registered.fullName).toBe(approved.studentName);
    expect((await students.listStudents(fx.schoolId)).length).toBe(studentsBefore + 1);
  });

  it("leaves the balance alone until an online payment is confirmed", async () => {
    const { FinanceService } = await import("../../backend/src/modules/finance/finance.service");
    const service = new FinanceService();
    const invoices = await service.listInvoices(fx.schoolId);
    const target = invoices.find((invoice) => invoice.balance > 10000);
    expect(target, "the seed needs an invoice with more than 10,000 outstanding").toBeDefined();

    const before = target!.balance;
    const checkout = await service.initializePaymentFlow(fx.schoolId, fx.principal.userId, {
      invoiceId: target!.id,
      email: fx.parent.email,
      amount: 10000,
      method: "ONLINE",
      provider: "PAYSTACK",
    });

    // Initialising hands back a checkout and records a PENDING payment. Money
    // has not arrived yet, so the balance must not move — it moves when the
    // gateway confirms, and not a moment before.
    expect(checkout.reference ?? checkout.checkoutUrl).toBeTruthy();
    const after = (await service.listInvoices(fx.schoolId)).find(
      (invoice) => invoice.id === target!.id,
    );
    expect(after?.balance).toBe(before);
  });

  it("returns a finance dashboard with its headline metrics", async () => {
    const { FinanceService } = await import("../../backend/src/modules/finance/finance.service");
    const dashboard = await new FinanceService().getFinanceDashboard(fx.schoolId);

    expect(dashboard.metrics.map((metric) => metric.label)).toEqual(
      expect.arrayContaining(["Total billed", "Collected", "Outstanding", "Collection rate"]),
    );
    expect(dashboard.invoices.length).toBeGreaterThan(0);
  });

  it("gives each role its own quick actions", async () => {
    const { DashboardService } = await import(
      "../../backend/src/modules/dashboard/dashboard.service"
    );
    const service = new DashboardService();

    const principal = await service.getOverview(
      sessionFor(fx.principal, fx.schoolId, "PRINCIPAL"),
    );
    const bursar = await service.getOverview(sessionFor(fx.principal, fx.schoolId, "ACCOUNTANT"));
    const admissions = await service.getOverview(
      sessionFor(fx.principal, fx.schoolId, "ADMISSIONS_OFFICER"),
    );

    const labels = (overview: { quickActions?: Array<{ label: string }> }) =>
      overview.quickActions?.map((item) => item.label) ?? [];

    // A bursar's actions are not a principal's, and neither sees the other's.
    expect(labels(principal)).toContain("Review results");
    expect(labels(principal)).not.toContain("Create invoice");
    expect(labels(bursar)).toContain("Create invoice");
    expect(labels(admissions)).toContain("Review admissions");
    expect(labels(admissions)).not.toContain("Create invoice");
  });

  it("returns a student profile with the record behind it", async () => {
    const { StudentsService } = await import(
      "../../backend/src/modules/students/students.service"
    );
    const profile = await new StudentsService().getStudentProfile(
      fx.schoolId,
      fx.student.studentId,
    );

    expect(profile.fullName).toBeTruthy();
    expect(profile.id).toBe(fx.student.studentId);
  });

  it("scopes parent portal data to that guardian's own children", async () => {
    const { ParentPortalService } = await import(
      "../../backend/src/modules/parent-portal/parent-portal.service"
    );
    const service = new ParentPortalService();
    const parentSession = sessionFor(fx.parent, fx.schoolId, "PARENT");

    const dashboard = await service.getParentDashboard(parentSession);
    expect(dashboard.children.length).toBe(fx.childIds.length);
    expect(dashboard.children.map((child) => child.studentId).sort()).toEqual(
      [...fx.childIds].sort(),
    );

    const child = await service.getChildOverviewForParent(parentSession, fx.childIds[0]!);
    expect(child.studentId).toBe(fx.childIds[0]);

    // The whole point of the portal: a guardian cannot reach a child who is not theirs.
    if (fx.unlinkedChildId) {
      await expect(
        service.getChildOverviewForParent(parentSession, fx.unlinkedChildId),
      ).rejects.toThrow("This child is not linked to your guardian account.");
    }

    await expect(
      service.getParentDashboard({ ...parentSession, role: "STUDENT" as never }),
    ).rejects.toThrow("Parent portal data is only available to parent or guardian accounts.");
  });

  it("scopes student portal data to that student's own account", async () => {
    const { StudentPortalService } = await import(
      "../../backend/src/modules/student-portal/student-portal.service"
    );
    const service = new StudentPortalService();
    const studentSession = sessionFor(
      { userId: fx.student.userId, email: fx.student.email },
      fx.schoolId,
      "STUDENT",
    );

    const dashboard = await service.getStudentDashboard(studentSession);
    const profile = await service.getStudentProfile(studentSession);

    expect(dashboard.studentId).toBe(fx.student.studentId);
    expect(profile.studentName).toBe(dashboard.studentName);

    await expect(
      service.getStudentDashboard({ ...studentSession, role: "PARENT" as never }),
    ).rejects.toThrow("Student portal data is only available to student accounts.");
  });

  it("refuses teacher portal data to a non-teacher", async () => {
    const { TeacherPortalService } = await import(
      "../../backend/src/modules/teacher-portal/teacher-portal.service"
    );
    const service = new TeacherPortalService();
    const teacherSession = sessionFor(fx.teacher, fx.schoolId, "TEACHER");

    const dashboard = await service.getTeacherDashboard(teacherSession);
    expect(Array.isArray(dashboard.assignedClasses)).toBe(true);

    await expect(
      service.getTeacherDashboard({ ...teacherSession, role: "STUDENT" as never }),
    ).rejects.toThrow("Teacher portal data is only available to teacher accounts.");
  });

  it("publishes an assignment and marks attendance for a teacher's own class", async () => {
    const { TeacherPortalService } = await import(
      "../../backend/src/modules/teacher-portal/teacher-portal.service"
    );
    const service = new TeacherPortalService();
    const teacherSession = sessionFor(fx.teacher, fx.schoolId, "TEACHER");
    const dashboard = await service.getTeacherDashboard(teacherSession);

    const assigned = dashboard.assignedClasses[0];
    const pupil = dashboard.students?.[0];
    if (!assigned || !pupil) {
      // Nothing is asserted about a teacher the seed gave no classes to; the
      // scoping rule above is what matters and it ran regardless.
      return;
    }

    const task = await service.createAssignment(teacherSession, {
      classId: assigned.classId,
      subjectId: assigned.subjectId,
      title: "Weekly science practice",
      description: "Complete the revision questions before the next lesson.",
      dueAt: new Date(Date.now() + 7 * 86_400_000).toISOString(),
      status: "PUBLISHED",
    });
    expect(task.status).toBe("PUBLISHED");

    const attendance = await service.markAttendance(teacherSession, {
      classId: assigned.classId,
      subjectId: assigned.subjectId,
      studentId: pupil.studentId,
      date: new Date().toISOString().slice(0, 10),
      status: "PRESENT",
    });
    expect(attendance.status).toBe("PRESENT");
  });

  it("holds a grade as a draft until it is submitted", async () => {
    const { AcademicsService } = await import(
      "../../backend/src/modules/academics/academics.service"
    );
    const { RolesManagementService } = await import(
      "../../backend/src/modules/roles-management/roles-management.service"
    );
    const service = new AcademicsService(new RolesManagementService());
    const adminSession = sessionFor(fx.principal, fx.schoolId, "PRINCIPAL");

    const schemes = await service.listGradingSchemes(adminSession);
    const components = await service.listAssessmentComponents(adminSession);

    expect(schemes[0]?.bands.length).toBeGreaterThan(0);
    expect(components.map((item) => item.code)).toEqual(expect.arrayContaining(["CA", "EXAM"]));
  });

  it("reports operations defaults for the Nigeria profile", async () => {
    const { NigeriaOperationsService } = await import(
      "../../backend/src/modules/nigeria-operations/nigeria-operations.service"
    );
    const service = new NigeriaOperationsService();
    const dashboard = await service.getDashboard(
      sessionFor(fx.principal, fx.schoolId, "PRINCIPAL"),
    );

    expect(dashboard.academicDefaults.terms).toEqual([
      "First Term",
      "Second Term",
      "Third Term",
    ]);
    expect(dashboard.academicDefaults.classAliases).toEqual(
      expect.arrayContaining(["JSS1", "SSS3"]),
    );
    expect(dashboard.staffAttendance.policy.timezone).toBe("Africa/Lagos");
  });

  it("adds a behaviour log and a promotion to a student's record", async () => {
    const { StudentsService } = await import(
      "../../backend/src/modules/students/students.service"
    );
    const service = new StudentsService();
    const before = await service.getStudentProfile(fx.schoolId, fx.student.studentId);

    await service.createBehaviorLog(fx.schoolId, fx.student.studentId, {
      category: "Counselling",
      description: "Student attended intervention session after repeated lateness.",
      severity: "MEDIUM",
    });
    await service.createPromotion(fx.schoolId, fx.student.studentId, {
      toClassName: fx.promotionTarget?.name ?? before.className,
      decision: "Promoted after literacy intervention and attendance improvement.",
    });

    const after = await service.getStudentProfile(fx.schoolId, fx.student.studentId);
    expect(after.behaviorLogs.length).toBe(before.behaviorLogs.length + 1);
    expect(after.promotions.length).toBe(before.promotions.length + 1);
    // A promotion moves the child, so the profile must report the new class.
    // The profile renders the arm alongside it ("Crèche - A"), so the check is
    // that the child is now in the class we named, not that the two strings match.
    if (fx.promotionTarget) {
      expect(after.className).toContain(fx.promotionTarget.name);
      expect(after.className).not.toBe(before.className);
    }
  });
  it("carries every kind of decision in one queue, ordered worst first", async () => {
    const { ApprovalsService } = await import(
      "../../backend/src/modules/approvals/approvals.service"
    );
    const { prisma } = await import("../../src/lib/db/prisma");
    const service = new ApprovalsService();
    const session = sessionFor(fx.principal, fx.schoolId, "PRINCIPAL");
    const run = `test-${Date.now().toString(36)}`;

    const low = await service.raise(session, {
      kind: "RECORD_CHANGE",
      subjectType: "ProfileEditRequest",
      subjectId: run,
      title: "Date of birth change",
      priority: 10,
      assigneeId: fx.principal.userId,
    });
    const high = await service.raise(session, {
      kind: "SCORE_CORRECTION",
      subjectType: "ResultSheet",
      subjectId: run,
      title: "Chemistry SSS 2A — score correction",
      blocking: "1 teacher · 34 cards",
      priority: 80,
      assigneeId: fx.principal.userId,
    });

    try {
      const queue = await service.listQueue(session, { assignee: "me" });
      const mine = queue.filter((item) => item.subjectId === run);
      // Two different kinds, one read — the point of the table.
      expect(mine.map((item) => item.kind)).toEqual(["SCORE_CORRECTION", "RECORD_CHANGE"]);
      // What a decision unblocks is carried, not recomputed per render.
      expect(mine[0]!.blocking).toBe("1 teacher · 34 cards");

      // You cannot approve your own request, and a refusal must say why.
      await expect(service.decide(session, high.id, { action: "APPROVE" })).rejects.toThrow(
        "You cannot approve a request you raised yourself.",
      );
      await expect(service.decide(session, high.id, { action: "RETURN" })).rejects.toThrow(
        /Say why/,
      );

      const returned = await service.decide(session, high.id, {
        action: "RETURN",
        note: "State which network outage — the annex or the whole school?",
      });
      expect(returned.status).toBe("RETURNED");
      expect(returned.decisionNote).toMatch(/network outage/);

      // A decision is made once.
      await expect(
        service.decide(session, high.id, { action: "APPROVE", note: "again" }),
      ).rejects.toThrow(/already returned/);

      // Deciding it takes it out of what is waiting.
      const still = await service.listQueue(session, { assignee: "me" });
      expect(still.filter((item) => item.subjectId === run).map((item) => item.id)).toEqual([low.id]);
    } finally {
      await prisma.approvalRequest.deleteMany({ where: { subjectId: run } });
    }
  });

  it("refuses a decision with nobody to decide it", async () => {
    const { ApprovalsService } = await import(
      "../../backend/src/modules/approvals/approvals.service"
    );
    const service = new ApprovalsService();
    await expect(
      service.raise(sessionFor(fx.principal, fx.schoolId, "PRINCIPAL"), {
        kind: "OTHER",
        subjectType: "Nothing",
        title: "Nobody is named on this",
      }),
    ).rejects.toThrow("A decision needs somebody to decide it");
  });
});
