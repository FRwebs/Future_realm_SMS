import { beforeEach, describe, expect, it, vi } from "vitest";

describe("demo-mode service flows", () => {
  beforeEach(() => {
    process.env.DEMO_MODE = "true";
    process.env.JWT_SECRET = "local-development-secret";
    vi.resetModules();
  });

  it("authenticates a seeded demo account", async () => {
    const { AuthService } = await import("../../backend/src/modules/auth/auth.service");
    const session = await new AuthService().authenticateUser("principal@greenfieldcollege.ng", "FutureRealm123!");
    expect(session?.role).toBe("PRINCIPAL");
  });

  it("creates an admission in the in-memory demo store", async () => {
    const { AdmissionsService } = await import("../../backend/src/modules/admissions/admissions.service");
    const service = new AdmissionsService();
    const before = (await service.listAdmissions("school_greenfield")).length;
    await service.createAdmission("school_greenfield", {
      firstName: "Peace",
      lastName: "Ibe",
      guardianName: "Chika Ibe",
      guardianPhone: "08031112222",
      desiredClass: "JSS 1 - Gold",
      gender: "FEMALE"
    });
    const after = (await service.listAdmissions("school_greenfield")).length;
    expect(after).toBe(before + 1);
  });

  it("moves an applicant through the full admissions lifecycle and enrollment", async () => {
    const { AdmissionsService } = await import("../../backend/src/modules/admissions/admissions.service");
    const { StudentsService } = await import("../../backend/src/modules/students/students.service");
    const admissionsService = new AdmissionsService();
    const studentsService = new StudentsService();
    const studentsBeforeCount = (await studentsService.listStudents("school_greenfield")).length;
    const submittedApplicant = (await admissionsService.listAdmissions("school_greenfield")).find(
      (item) => item.status === "SUBMITTED"
    );

    expect(submittedApplicant).toBeDefined();
    const reviewed = await admissionsService.reviewAdmission(
      "school_greenfield",
      "user_admissions",
      "Adaeze Okoro",
      submittedApplicant!.id,
      {
        recommendedClass: submittedApplicant!.desiredClass,
        documentStatus: "Documents complete",
        screeningOutcome: "Suitable for class",
        notes: "Guardian details, documents, and class placement have been checked."
      }
    );
    expect(reviewed.status).toBe("REVIEWING");
    expect(reviewed.reviewedBy).toBe("Adaeze Okoro");

    const feeVerified = await admissionsService.verifyApplicationFee("school_greenfield", "user_accountant", reviewed.id, {
      amount: 10000,
      reference: "ADM-FEE-TEST",
      waived: false,
      note: "Application fee verified by bursary."
    });
    expect(feeVerified.status).toBe("PAYMENT_PENDING");
    expect(feeVerified.applicationFeeStatus).toBe("VERIFIED");

    const screening = await admissionsService.scheduleScreening("school_greenfield", "user_admissions", reviewed.id, {
      scheduledAt: "2026-04-15",
      venue: "ICT Lab",
      note: "Entrance screening booked."
    });
    expect(screening.status).toBe("SCREENING_SCHEDULED");

    const screened = await admissionsService.recordScreeningResult("school_greenfield", "user_teacher", reviewed.id, {
      score: 82,
      maxScore: 100,
      result: "PASS",
      recommendation: "Recommend for admission",
      remarks: "Strong literacy and numeracy score."
    });
    expect(screened.status).toBe("SCREENING_COMPLETED");

    const recommended = await admissionsService.recommendApplication("school_greenfield", "user_admissions", reviewed.id, {
      notes: "Recommended after document review and screening."
    });
    expect(recommended.status).toBe("RECOMMENDED");

    const approved = await admissionsService.decideAdmission("school_greenfield", "user_principal", reviewed.id, {
      decision: "APPROVED",
      notes: "Approved after Admissions Officer review."
    });
    expect(approved.status).toBe("APPROVED");

    const offered = await admissionsService.issueOffer("school_greenfield", "user_admissions", approved.id, {
      checklist: "Acceptance fee, Passport photograph",
      expiryDays: 14
    });
    expect(offered.status).toBe("OFFER_SENT");
    expect(offered.offerStatus).toBe("SENT");

    const accepted = await admissionsService.acceptOffer("school_greenfield", offered.id, {
      note: "Guardian accepted offer."
    });
    expect(accepted.status).toBe("ACCEPTED");

    const cleared = await admissionsService.markFinanciallyCleared("school_greenfield", "user_accountant", accepted.id, {
      amount: 50000,
      reference: "ADM-CLEAR-TEST",
      waived: false,
      note: "Acceptance deposit confirmed."
    });
    expect(cleared.status).toBe("FINANCIALLY_CLEARED");

    const registered = await admissionsService.enrollApplicant("school_greenfield", "user_admin", cleared.id, {
      className: approved.desiredClass,
      guardianRelationship: "Parent"
    });
    const studentsAfter = await studentsService.listStudents("school_greenfield");

    expect(registered.fullName).toBe(approved.studentName);
    expect(studentsAfter.length).toBe(studentsBeforeCount + 1);
  });

  it("updates invoice balance when a demo payment is initialized", async () => {
    const { FinanceService } = await import("../../backend/src/modules/finance/finance.service");
    const service = new FinanceService();
    const [invoice] = await service.listInvoices("school_greenfield");
    const balanceBefore = invoice.balance;
    await service.initializePaymentFlow("school_greenfield", "user_accountant", {
      invoiceId: invoice.id,
      email: "parent@example.com",
      amount: 10000,
      method: "ONLINE",
      provider: "PAYSTACK"
    });
    const [updated] = await service.listInvoices("school_greenfield");
    expect(updated.balance).toBe(balanceBefore - 10000);
    expect(updated.receiptNumber).toBeDefined();
  });

  it("returns production-style finance dashboard data in demo mode", async () => {
    const { FinanceService } = await import("../../backend/src/modules/finance/finance.service");
    const service = new FinanceService();
    const dashboard = await service.getFinanceDashboard("school_greenfield");

    expect(dashboard.metrics.map((metric) => metric.label)).toEqual(
      expect.arrayContaining(["Total billed", "Collected", "Outstanding", "Collection rate"])
    );
    expect(dashboard.feeStructures[0]?.items.length).toBeGreaterThan(0);
    expect(dashboard.invoices.length).toBeGreaterThan(0);
  });

  it("returns role-aware admin dashboard widgets in demo mode", async () => {
    const { DashboardService } = await import("../../backend/src/modules/dashboard/dashboard.service");
    const service = new DashboardService();
    const baseSession = {
      userId: "user_principal",
      schoolId: "school_greenfield",
      email: "principal@greenfieldcollege.ng",
      name: "Tunde Adeyemi",
      csrfToken: "test",
      iat: 0,
      exp: 9999999999
    };

    const principal = await service.getOverview({ ...baseSession, role: "PRINCIPAL" as const });
    const bursar = await service.getOverview({ ...baseSession, userId: "user_accountant", email: "bursar@greenfieldcollege.ng", role: "ACCOUNTANT" as const });
    const admissions = await service.getOverview({ ...baseSession, userId: "user_admissions", email: "admissions@greenfieldcollege.ng", role: "ADMISSIONS_OFFICER" as const });

    expect(principal.quickActions?.map((item) => item.label)).toContain("Review results");
    expect(principal.quickActions?.map((item) => item.label)).not.toContain("Create invoice");
    expect(bursar.quickActions?.map((item) => item.label)).toContain("Create invoice");
    expect(admissions.quickActions?.map((item) => item.label)).toEqual(["Review admissions"]);
  });

  it("returns a detailed student profile in demo mode", async () => {
    const { StudentsService } = await import("../../backend/src/modules/students/students.service");
    const service = new StudentsService();
    const profile = await service.getStudentProfile("school_greenfield", "stu_1");

    expect(profile.fullName).toBe("Daniel Yusuf");
    expect(profile.guardianName).toBe("Funke Yusuf");
    expect(profile.documents.length).toBeGreaterThan(0);
  });

  it("resolves a parent portal with multiple children", async () => {
    const { getDemoParentPortalByEmail } = await import("../../src/lib/demo/data");
    const portal = getDemoParentPortalByEmail("parent@greenfieldcollege.ng");

    expect(portal.children).toHaveLength(2);
    expect(portal.children.map((child) => child.className)).toEqual(
      expect.arrayContaining(["JSS 2 - Gold", "Primary 4 - Blue"])
    );
  });

  it("returns parent-scoped portal data only for linked children", async () => {
    const { ParentPortalService } = await import("../../backend/src/modules/parent-portal/parent-portal.service");
    const service = new ParentPortalService();
    const parentSession = {
      userId: "user_parent",
      schoolId: "school_greenfield",
      role: "PARENT" as const,
      email: "parent@greenfieldcollege.ng",
      name: "Funke Yusuf",
      csrfToken: "test",
      iat: 0,
      exp: 9999999999
    };

    const dashboard = await service.getParentDashboard(parentSession);
    const child = await service.getChildOverviewForParent(parentSession, "stu_1");

    expect(dashboard.children).toHaveLength(2);
    expect(dashboard.children.map((item) => item.studentName)).toEqual(
      expect.arrayContaining(["Daniel Yusuf", "Maryam Yusuf"])
    );
    expect(child.studentName).toBe("Daniel Yusuf");
    expect(child.resultHistory.length).toBeGreaterThan(0);

    await expect(service.getChildOverviewForParent(parentSession, "stu_2")).rejects.toThrow(
      "This child is not linked to your guardian account."
    );
    await expect(service.getParentDashboard({ ...parentSession, role: "STUDENT" as const })).rejects.toThrow(
      "Parent portal data is only available to parent or guardian accounts."
    );
  });

  it("resolves a student portal with timetable and result history", async () => {
    const { getDemoStudentPortalByEmail } = await import("../../src/lib/demo/data");
    const portal = getDemoStudentPortalByEmail("amarachi.obi@greenfieldcollege.ng");

    expect(portal.studentId).toBe("stu_2");
    expect(portal.weeklyTimetable.length).toBeGreaterThan(0);
    expect(portal.resultHistory[0]?.subjects.length).toBeGreaterThan(0);
  });

  it("returns student-scoped portal data only for student sessions", async () => {
    const { StudentPortalService } = await import("../../backend/src/modules/student-portal/student-portal.service");
    const service = new StudentPortalService();
    const studentSession = {
      userId: "user_student",
      schoolId: "school_greenfield",
      role: "STUDENT" as const,
      email: "student@greenfieldcollege.ng",
      name: "Daniel Yusuf",
      csrfToken: "test",
      iat: 0,
      exp: 9999999999
    };

    const dashboard = await service.getStudentDashboard(studentSession);
    const profile = await service.getStudentProfile(studentSession);

    expect(dashboard.studentId).toBe("stu_1");
    expect(dashboard.studentName).toBe("Daniel Yusuf");
    expect(profile.studentName).toBe("Daniel Yusuf");
    expect(profile.subjects.length).toBeGreaterThan(0);

    await expect(service.getStudentDashboard({ ...studentSession, role: "PARENT" as const })).rejects.toThrow(
      "Student portal data is only available to student accounts."
    );
  });

  it("returns a principal-ready teacher directory in demo mode", async () => {
    const { getDemoTeacherActivities, getDemoTeacherProfileById, getDemoTeachers } = await import("../../src/lib/demo/data");
    const teachers = getDemoTeachers();
    const activities = getDemoTeacherActivities();
    const profile = getDemoTeacherProfileById("tch_1");

    expect(teachers.length).toBeGreaterThanOrEqual(3);
    expect(activities.length).toBeGreaterThan(0);
    expect(activities.map((item) => item.teacherId)).toContain("tch_1");
    expect(teachers[0]?.subjects.length).toBeGreaterThan(0);
    expect(profile.classAssignments.length).toBeGreaterThan(0);
    expect(profile.recentActivities.length).toBeGreaterThan(0);
    expect(profile.operationalNotes.length).toBeGreaterThan(0);
  });

  it("returns teacher-scoped portal workflows in demo mode", async () => {
    const { TeacherPortalService } = await import("../../backend/src/modules/teacher-portal/teacher-portal.service");
    const service = new TeacherPortalService();
    const teacherSession = {
      userId: "user_teacher",
      schoolId: "school_greenfield",
      role: "TEACHER" as const,
      email: "teacher@greenfieldcollege.ng",
      name: "Boma Hart",
      csrfToken: "test",
      iat: 0,
      exp: 9999999999
    };

    const dashboard = await service.getTeacherDashboard(teacherSession);
    const task = await service.createAssignment(teacherSession, {
      classId: dashboard.assignedClasses[0]?.classId,
      subjectId: dashboard.assignedClasses[0]?.subjectId,
      title: "Weekly science practice",
      description: "Complete the revision questions before the next lesson.",
      dueAt: new Date(Date.now() + 7 * 86400000).toISOString(),
      status: "PUBLISHED"
    });
    const attendance = await service.markAttendance(teacherSession, {
      classId: dashboard.assignedClasses[0]?.classId,
      subjectId: dashboard.assignedClasses[0]?.subjectId,
      studentId: dashboard.students?.[0]?.studentId,
      date: "2026-04-12",
      status: "PRESENT"
    });
    const score = await service.enterAssessmentScores(teacherSession, {
      classId: dashboard.assignedClasses[0]?.classId,
      subjectId: dashboard.assignedClasses[0]?.subjectId,
      studentId: dashboard.students?.[0]?.studentId,
      continuousAssessment: 30,
      exam: 50
    });

    expect(dashboard.assignedClasses.length).toBeGreaterThan(0);
    expect(dashboard.weeklyTimetable.length).toBeGreaterThan(0);
    expect(task.status).toBe("PUBLISHED");
    expect(attendance.status).toBe("PRESENT");
    expect(score.grade).toBe("A1");
    await expect(service.getTeacherDashboard({ ...teacherSession, role: "STUDENT" as const })).rejects.toThrow(
      "Teacher portal data is only available to teacher accounts."
    );
  });

  it("supports result grading setup and draft submission in demo mode", async () => {
    const { AcademicsService } = await import("../../backend/src/modules/academics/academics.service");
    const service = new AcademicsService();
    const teacherSession = {
      userId: "user_teacher",
      schoolId: "school_greenfield",
      role: "TEACHER" as const,
      email: "teacher@greenfieldcollege.ng",
      name: "Boma Hart",
      csrfToken: "test",
      iat: 0,
      exp: 9999999999
    };
    const adminSession = {
      ...teacherSession,
      userId: "user_principal",
      role: "PRINCIPAL" as const,
      email: "principal@greenfieldcollege.ng",
      name: "Tunde Adeyemi"
    };

    const schemes = await service.listGradingSchemes(adminSession);
    const components = await service.listAssessmentComponents(adminSession);
    const draft = await service.upsertGrade(teacherSession, {
      studentName: "Daniel Yusuf",
      className: "JSS 2 - Gold",
      subject: "Mathematics",
      continuousAssessment: 30,
      exam: 45
    });
    const submitted = await service.upsertGrade(teacherSession, {
      studentName: "Daniel Yusuf",
      className: "JSS 2 - Gold",
      subject: "Mathematics",
      continuousAssessment: 32,
      exam: 48
    }, false);
    const analytics = await service.getResultAnalytics(adminSession);

    expect(schemes[0]?.bands.length).toBeGreaterThan(0);
    expect(components.map((item) => item.code)).toEqual(expect.arrayContaining(["CA", "EXAM"]));
    expect(draft.status).toBe("DRAFT");
    expect(submitted.status).toBe("SUBMITTED");
    expect(submitted.grade).toBe("A1");
    expect(analytics.metrics.length).toBeGreaterThan(0);
  });

  it("supports Nigerian assessment setup, score capture, broadsheet, and report-card flow in demo mode", async () => {
    const { AcademicsService } = await import("../../backend/src/modules/academics/academics.service");
    const service = new AcademicsService();
    const adminSession = {
      userId: "user_principal",
      schoolId: "school_greenfield",
      role: "PRINCIPAL" as const,
      email: "principal@greenfieldcollege.ng",
      name: "Tunde Adeyemi",
      csrfToken: "test",
      iat: 0,
      exp: 9999999999
    };

    const component = await service.createSectionAssessmentComponent(adminSession, {
      section: "JUNIOR_SECONDARY",
      name: "Terminal Examination",
      code: "EXAM",
      type: "EXAMINATION",
      weight: 100,
      maxScore: 100,
      order: 1
    });
    const assessment = await service.createAcademicAssessment(adminSession, {
      title: "Second Term Mathematics Test 2",
      className: "JSS 2",
      subject: "Mathematics",
      assessmentType: "TEST",
      maxScore: 20,
      weight: 20,
      assessmentDate: "2026-04-18",
      submissionMode: "PAPER"
    });
    const scored = await service.recordAssessmentScores(adminSession, {
      assessmentId: assessment.id,
      scores: [{ studentId: "stu_1", score: 18, attendanceState: "PRESENT", scoreFlag: "NONE" }]
    });
    const broadsheet = await service.compileBroadsheet(adminSession, { classId: "class_jss2_gold" });
    const reviewed = await service.reviewBroadsheet(adminSession, { broadsheetId: broadsheet.id, action: "APPROVE", note: "Checked by Principal." });
    const reportCards = await service.listReportCards(adminSession);

    expect(component.section).toBe("JUNIOR_SECONDARY");
    expect(assessment.candidateCount).toBeGreaterThan(0);
    expect(scored.candidates?.length).toBeGreaterThan(0);
    expect(broadsheet.rows.length).toBeGreaterThan(0);
    expect(reviewed.approvals[0]?.action).toBe("APPROVE");
    expect(reportCards[0]?.reportCardUrl).toContain("/api/v1/reports/report-card/");
  });

  it("returns Nigeria-specific operations dashboard data in demo mode", async () => {
    const { NigeriaOperationsService } = await import("../../backend/src/modules/nigeria-operations/nigeria-operations.service");
    const service = new NigeriaOperationsService();
    const principalSession = {
      userId: "user_principal",
      schoolId: "school_greenfield",
      role: "PRINCIPAL" as const,
      email: "principal@greenfieldcollege.ng",
      name: "Tunde Adeyemi",
      csrfToken: "test",
      iat: 0,
      exp: 9999999999
    };

    const dashboard = await service.getDashboard(principalSession);
    const curriculum = await service.listCurriculum({ ...principalSession, userId: "user_teacher", role: "TEACHER" as const });
    const training = await service.listTrainingPrograms({ ...principalSession, userId: "user_teacher", role: "TEACHER" as const });

    expect(dashboard.academicDefaults.terms).toEqual(["First Term", "Second Term", "Third Term"]);
    expect(dashboard.academicDefaults.classAliases).toEqual(expect.arrayContaining(["JSS1", "SSS3"]));
    expect(dashboard.curriculum.completionRate).toBeGreaterThan(0);
    expect(dashboard.staffAttendance.policy.timezone).toBe("Africa/Lagos");
    expect(dashboard.training.pendingMandatory).toBeGreaterThan(0);
    expect(curriculum[0]?.topic).toMatch(/equations/i);
    expect(training[0]?.category).toBe("CURRICULUM_ORIENTATION");
  });

  it("adds behavior logs and promotions for a demo student", async () => {
    const { StudentsService } = await import("../../backend/src/modules/students/students.service");
    const service = new StudentsService();
    const profileBefore = await service.getStudentProfile("school_greenfield", "stu_3");
    const behaviorCountBefore = profileBefore.behaviorLogs.length;
    const promotionCountBefore = profileBefore.promotions.length;

    await service.createBehaviorLog("school_greenfield", "stu_3", {
      category: "Counselling",
      description: "Student attended intervention session after repeated lateness.",
      severity: "MEDIUM"
    });
    await service.createPromotion("school_greenfield", "stu_3", {
      toClassName: "JSS 1 - Coral",
      toSessionName: "2026/2027",
      decision: "Promoted after literacy intervention and attendance improvement."
    });

    const profileAfter = await service.getStudentProfile("school_greenfield", "stu_3");
    expect(profileAfter.behaviorLogs.length).toBe(behaviorCountBefore + 1);
    expect(profileAfter.promotions.length).toBe(promotionCountBefore + 1);
    expect(profileAfter.className).toBe("JSS 1 - Coral");
  });
});
