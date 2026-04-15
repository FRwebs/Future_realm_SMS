import { PrismaClient } from "@prisma/client";

import { hashPassword } from "../src/lib/auth/password";
import { nigerianTermGradeBands, resolveGradeLabel } from "../src/lib/domain/grading";
import { nigerianSubjectDefaults } from "../src/lib/nigerian-subjects";
import { nigeriaClassOptions } from "../src/lib/school-options";

const prisma = new PrismaClient();

const sectionAssessmentDefaults = [
  { name: "Assignment", code: "ASSIGNMENT", type: "ASSIGNMENT", weight: 10, maxScore: 10, order: 1 },
  { name: "Classwork", code: "CLASSWORK", type: "CLASSWORK", weight: 10, maxScore: 10, order: 2 },
  { name: "Test 1", code: "TEST_1", type: "TEST", weight: 10, maxScore: 10, order: 3 },
  { name: "Test 2", code: "TEST_2", type: "TEST", weight: 10, maxScore: 10, order: 4 },
  { name: "Project", code: "PROJECT", type: "PROJECT", weight: 10, maxScore: 10, order: 5 },
  { name: "Practical", code: "PRACTICAL", type: "PRACTICAL", weight: 10, maxScore: 10, order: 6 },
  { name: "Terminal Examination", code: "EXAM", type: "EXAMINATION", weight: 40, maxScore: 40, order: 7 }
] as const;

const academicSections = ["CRECHE", "NURSERY", "PRIMARY", "JUNIOR_SECONDARY", "SENIOR_SECONDARY"] as const;

const cohortNames = [
  ["Ayo", "Balogun", "MALE"],
  ["Zainab", "Lawal", "FEMALE"],
  ["Chiamaka", "Nwosu", "FEMALE"],
  ["Favour", "Okafor", "FEMALE"],
  ["Malik", "Adebayo", "MALE"],
  ["Ruth", "Ekanem", "FEMALE"],
  ["Tomiwa", "Akinola", "MALE"],
  ["Nifemi", "Ojo", "FEMALE"],
  ["David", "Ibe", "MALE"]
] as const;

async function clearDatabase() {
  await prisma.$transaction([
    prisma.syncDraft.deleteMany(),
    prisma.auditLog.deleteMany(),
    prisma.notificationLog.deleteMany(),
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
    prisma.timetableEntry.deleteMany(),
    prisma.classRoom.deleteMany(),
    prisma.classLevel.deleteMany(),
    prisma.department.deleteMany(),
    prisma.term.deleteMany(),
    prisma.academicSession.deleteMany(),
    prisma.campus.deleteMany(),
    prisma.user.deleteMany(),
    prisma.school.deleteMany()
  ]);
}

async function main() {
  await clearDatabase();

  const school = await prisma.school.create({
    data: {
      name: "Greenfield College, Ibadan",
      slug: "greenfield-college",
      category: "MIXED",
      isGroup: true,
      address: "Plot 12, Ring Road, Ibadan",
      state: "Oyo",
      lowBandwidthMode: true,
      primaryColor: "#25593f",
      secondaryColor: "#c28c3d"
    }
  });

  const campus = await prisma.campus.create({
    data: {
      schoolId: school.id,
      name: "Ibadan Main Campus",
      code: "IBD-MAIN",
      address: "Plot 12, Ring Road, Ibadan",
      phone: "08030000000"
    }
  });

  const session = await prisma.academicSession.create({
    data: {
      schoolId: school.id,
      name: "2025/2026",
      startDate: new Date("2025-09-01"),
      endDate: new Date("2026-07-31"),
      isCurrent: true
    }
  });

  const firstTerm = await prisma.term.create({
    data: {
      schoolId: school.id,
      academicSessionId: session.id,
      name: "First Term",
      order: 1,
      startDate: new Date("2025-09-01"),
      endDate: new Date("2025-12-15"),
      isCurrent: false
    }
  });

  const secondTerm = await prisma.term.create({
    data: {
      schoolId: school.id,
      academicSessionId: session.id,
      name: "Second Term",
      order: 2,
      startDate: new Date("2026-01-08"),
      endDate: new Date("2026-04-30"),
      isCurrent: true
    }
  });

  const thirdTerm = await prisma.term.create({
    data: {
      schoolId: school.id,
      academicSessionId: session.id,
      name: "Third Term",
      order: 3,
      startDate: new Date("2026-05-08"),
      endDate: new Date("2026-07-31"),
      isCurrent: false
    }
  });
  const scienceDepartment = await prisma.department.create({
    data: {
      schoolId: school.id,
      name: "Science",
      code: "SCI"
    }
  });

  const classLevels = await Promise.all(
    nigeriaClassOptions.map((option) =>
      prisma.classLevel.create({
        data: {
          schoolId: school.id,
          name: option.label,
          section: option.section === "PRIMARY" ? "PRIMARY" : option.section === "CRECHE" || option.section === "NURSERY" ? "NURSERY" : "SECONDARY",
          schoolSection: option.section,
          order: option.order
        }
      })
    )
  );
  const classLevelByValue = new Map(nigeriaClassOptions.map((option, index) => [option.value, classLevels[index]]));
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
      capacity: 35
    }
  });

  const ss1Emerald = await prisma.classRoom.create({
    data: {
      schoolId: school.id,
      campusId: campus.id,
      classLevelId: seniorLevel.id,
      departmentId: scienceDepartment.id,
      name: "SS 1",
      arm: "Emerald",
      capacity: 40
    }
  });

  const primary6Coral = await prisma.classRoom.create({
    data: {
      schoolId: school.id,
      campusId: campus.id,
      classLevelId: primaryLevel.id,
      name: "Primary 6",
      arm: "Coral",
      capacity: 30
    }
  });

  const primary4Blue = await prisma.classRoom.create({
    data: {
      schoolId: school.id,
      campusId: campus.id,
      classLevelId: primary4Level.id,
      name: "Primary 4",
      arm: "Blue",
      capacity: 28
    }
  });

  const jss1Silver = await prisma.classRoom.create({
    data: {
      schoolId: school.id,
      campusId: campus.id,
      classLevelId: jss1Level.id,
      departmentId: scienceDepartment.id,
      name: "JSS 1",
      arm: "Silver",
      capacity: 34
    }
  });

  const ss2Topaz = await prisma.classRoom.create({
    data: {
      schoolId: school.id,
      campusId: campus.id,
      classLevelId: ss2Level.id,
      departmentId: scienceDepartment.id,
      name: "SS 2",
      arm: "Topaz",
      capacity: 38
    }
  });

  await prisma.classRoom.createMany({
    data: [
      { schoolId: school.id, campusId: campus.id, classLevelId: classLevelByValue.get("CRECHE")!.id, name: "Crèche", arm: "A", capacity: 18 },
      { schoolId: school.id, campusId: campus.id, classLevelId: classLevelByValue.get("NURSERY_1")!.id, name: "Nursery 1", arm: "A", capacity: 22 },
      { schoolId: school.id, campusId: campus.id, classLevelId: classLevelByValue.get("NURSERY_2")!.id, name: "Nursery 2", arm: "B", capacity: 22 },
      { schoolId: school.id, campusId: campus.id, classLevelId: classLevelByValue.get("KG_RECEPTION")!.id, name: "KG / Reception", arm: "C", capacity: 24 },
      { schoolId: school.id, campusId: campus.id, classLevelId: classLevelByValue.get("PRIMARY_1")!.id, name: "Primary 1", arm: "A", capacity: 28 },
      { schoolId: school.id, campusId: campus.id, classLevelId: classLevelByValue.get("JSS_3")!.id, departmentId: scienceDepartment.id, name: "JSS 3", arm: "B", capacity: 36 },
      { schoolId: school.id, campusId: campus.id, classLevelId: classLevelByValue.get("SSS_3")!.id, departmentId: scienceDepartment.id, name: "SSS 3", arm: "C", capacity: 38 }
    ]
  });

  const passwordHash = hashPassword("FutureRealm123!");

  const admin = await prisma.user.create({
    data: {
      schoolId: school.id,
      email: "admin@futurerealm.sms",
      firstName: "Amina",
      lastName: "Okonkwo",
      passwordHash,
      role: "SUPER_ADMIN"
    }
  });

  const principalUser = await prisma.user.create({
    data: {
      schoolId: school.id,
      email: "principal@greenfieldcollege.ng",
      phone: "08036660010",
      firstName: "Tunde",
      lastName: "Adeyemi",
      passwordHash,
      role: "PRINCIPAL"
    }
  });

  const vpAcademicsUser = await prisma.user.create({
    data: {
      schoolId: school.id,
      email: "vp.academics@greenfieldcollege.ng",
      phone: "08036660013",
      firstName: "Olamide",
      lastName: "Fashola",
      passwordHash,
      role: "VICE_PRINCIPAL_ACADEMICS"
    }
  });

  const examOfficerUser = await prisma.user.create({
    data: {
      schoolId: school.id,
      email: "exam.officer@greenfieldcollege.ng",
      phone: "08036660014",
      firstName: "Chinedu",
      lastName: "Nwankwo",
      passwordHash,
      role: "EXAM_OFFICER"
    }
  });

  const hodUser = await prisma.user.create({
    data: {
      schoolId: school.id,
      email: "hod.science@greenfieldcollege.ng",
      phone: "08036660015",
      firstName: "Rukayat",
      lastName: "Adeleke",
      passwordHash,
      role: "HEAD_OF_DEPARTMENT"
    }
  });

  const proprietorUser = await prisma.user.create({
    data: {
      schoolId: school.id,
      email: "proprietor@greenfieldcollege.ng",
      phone: "08036660016",
      firstName: "Olubunmi",
      lastName: "Akinyele",
      passwordHash,
      role: "PROPRIETOR"
    }
  });

  const administratorUser = await prisma.user.create({
    data: {
      schoolId: school.id,
      email: "administrator@greenfieldcollege.ng",
      phone: "08036660017",
      firstName: "Segun",
      lastName: "Olatunji",
      passwordHash,
      role: "ADMINISTRATOR"
    }
  });

  const headTeacherUser = await prisma.user.create({
    data: {
      schoolId: school.id,
      email: "head.teacher@greenfieldcollege.ng",
      phone: "08036660018",
      firstName: "Blessing",
      lastName: "Udo",
      passwordHash,
      role: "HEAD_TEACHER"
    }
  });

  const vpAdministrationUser = await prisma.user.create({
    data: {
      schoolId: school.id,
      email: "vp.admin@greenfieldcollege.ng",
      phone: "08036660019",
      firstName: "Morenike",
      lastName: "Sanni",
      passwordHash,
      role: "VICE_PRINCIPAL_ADMINISTRATION"
    }
  });

  const vpSpecialDutiesUser = await prisma.user.create({
    data: {
      schoolId: school.id,
      email: "vp.special@greenfieldcollege.ng",
      phone: "08036660020",
      firstName: "Uche",
      lastName: "Ezeani",
      passwordHash,
      role: "VICE_PRINCIPAL_SPECIAL_DUTIES"
    }
  });

  const adminOfficerUser = await prisma.user.create({
    data: {
      schoolId: school.id,
      email: "admin.officer@greenfieldcollege.ng",
      phone: "08036660011",
      firstName: "Musa",
      lastName: "Bello",
      passwordHash,
      role: "ADMIN_OFFICER"
    }
  });

  const admissionsOfficerUser = await prisma.user.create({
    data: {
      schoolId: school.id,
      email: "admissions@greenfieldcollege.ng",
      phone: "08036660012",
      firstName: "Adaeze",
      lastName: "Okoro",
      passwordHash,
      role: "ADMISSIONS_OFFICER"
    }
  });

  const teacherUser = await prisma.user.create({
    data: {
      schoolId: school.id,
      email: "teacher@greenfieldcollege.ng",
      phone: "08036660001",
      firstName: "Boma",
      lastName: "Hart",
      passwordHash,
      role: "TEACHER"
    }
  });

  const teacherPrimaryUser = await prisma.user.create({
    data: {
      schoolId: school.id,
      email: "teacher.primary@greenfieldcollege.ng",
      phone: "08036660002",
      firstName: "Sade",
      lastName: "Bello",
      passwordHash,
      role: "TEACHER"
    }
  });

  const teacherEnglishUser = await prisma.user.create({
    data: {
      schoolId: school.id,
      email: "teacher.english@greenfieldcollege.ng",
      phone: "08036660003",
      firstName: "Kemi",
      lastName: "Afolayan",
      passwordHash,
      role: "TEACHER"
    }
  });

  const classTeacherUser = await prisma.user.create({
    data: {
      schoolId: school.id,
      email: "class.teacher@greenfieldcollege.ng",
      phone: "08036660021",
      firstName: "Aisha",
      lastName: "Bamidele",
      passwordHash,
      role: "CLASS_TEACHER"
    }
  });

  const subjectTeacherUser = await prisma.user.create({
    data: {
      schoolId: school.id,
      email: "subject.teacher@greenfieldcollege.ng",
      phone: "08036660022",
      firstName: "Paul",
      lastName: "Onyeka",
      passwordHash,
      role: "SUBJECT_TEACHER"
    }
  });

  const bursarUser = await prisma.user.create({
    data: {
      schoolId: school.id,
      email: "bursar@greenfieldcollege.ng",
      firstName: "Ngozi",
      lastName: "Eze",
      passwordHash,
      role: "ACCOUNTANT"
    }
  });

  const parentUser = await prisma.user.create({
    data: {
      schoolId: school.id,
      email: "parent@greenfieldcollege.ng",
      firstName: "Funke",
      lastName: "Yusuf",
      passwordHash,
      role: "PARENT"
    }
  });

  const parentChineloUser = await prisma.user.create({
    data: {
      schoolId: school.id,
      email: "chinelo.obi@greenfieldcollege.ng",
      firstName: "Chinelo",
      lastName: "Obi",
      passwordHash,
      role: "PARENT"
    }
  });

  const parentSalisuUser = await prisma.user.create({
    data: {
      schoolId: school.id,
      email: "salisu.mohammed@greenfieldcollege.ng",
      firstName: "Salisu",
      lastName: "Mohammed",
      passwordHash,
      role: "PARENT"
    }
  });

  const studentUser = await prisma.user.create({
    data: {
      schoolId: school.id,
      email: "student@greenfieldcollege.ng",
      firstName: "Daniel",
      lastName: "Yusuf",
      passwordHash,
      role: "STUDENT"
    }
  });

  const studentMaryamUser = await prisma.user.create({
    data: {
      schoolId: school.id,
      email: "maryam.yusuf@greenfieldcollege.ng",
      firstName: "Maryam",
      lastName: "Yusuf",
      passwordHash,
      role: "STUDENT"
    }
  });

  const studentAmarachiUser = await prisma.user.create({
    data: {
      schoolId: school.id,
      email: "amarachi.obi@greenfieldcollege.ng",
      firstName: "Amarachi",
      lastName: "Obi",
      passwordHash,
      role: "STUDENT"
    }
  });

  const studentIbrahimUser = await prisma.user.create({
    data: {
      schoolId: school.id,
      email: "ibrahim.salisu@greenfieldcollege.ng",
      firstName: "Ibrahim",
      lastName: "Salisu",
      passwordHash,
      role: "STUDENT"
    }
  });

  const studentEstherUser = await prisma.user.create({
    data: {
      schoolId: school.id,
      email: "esther.adewale@greenfieldcollege.ng",
      firstName: "Esther",
      lastName: "Adewale",
      passwordHash,
      role: "STUDENT"
    }
  });

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
        emergencyContactPhone: "08050000010"
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
        emergencyContactPhone: "08050008888"
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
        emergencyContactPhone: "08050009999"
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
        emergencyContactPhone: "08050001010"
      },
      {
        schoolId: school.id,
        campusId: campus.id,
        userId: proprietorUser.id,
        employeeNo: "EMP-011",
        designation: "Proprietor",
        employmentDate: new Date("2019-08-01"),
        emergencyContactName: "Family Office",
        emergencyContactPhone: "08050001112"
      },
      {
        schoolId: school.id,
        campusId: campus.id,
        userId: administratorUser.id,
        employeeNo: "EMP-012",
        designation: "School Administrator",
        employmentDate: new Date("2020-08-15"),
        emergencyContactName: "Bisi Olatunji",
        emergencyContactPhone: "08050001113"
      },
      {
        schoolId: school.id,
        campusId: campus.id,
        userId: headTeacherUser.id,
        employeeNo: "EMP-013",
        designation: "Head Teacher",
        employmentDate: new Date("2021-01-11"),
        emergencyContactName: "Ekemini Udo",
        emergencyContactPhone: "08050001114"
      },
      {
        schoolId: school.id,
        campusId: campus.id,
        userId: vpAdministrationUser.id,
        employeeNo: "EMP-014",
        designation: "Vice Principal Administration",
        employmentDate: new Date("2021-10-04"),
        emergencyContactName: "Yinka Sanni",
        emergencyContactPhone: "08050001115"
      },
      {
        schoolId: school.id,
        campusId: campus.id,
        userId: vpSpecialDutiesUser.id,
        employeeNo: "EMP-015",
        designation: "Vice Principal Special Duties",
        employmentDate: new Date("2022-02-14"),
        emergencyContactName: "Ngozi Ezeani",
        emergencyContactPhone: "08050001116"
      },
      {
        schoolId: school.id,
        campusId: campus.id,
        userId: adminOfficerUser.id,
        employeeNo: "EMP-006",
        designation: "Admin Officer",
        employmentDate: new Date("2022-04-18"),
        emergencyContactName: "Hauwa Bello",
        emergencyContactPhone: "08050006666"
      },
      {
        schoolId: school.id,
        campusId: campus.id,
        userId: admissionsOfficerUser.id,
        employeeNo: "EMP-007",
        designation: "Admissions Officer",
        employmentDate: new Date("2022-06-06"),
        emergencyContactName: "Chuka Okoro",
        emergencyContactPhone: "08050007777"
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
        emergencyContactPhone: "08050001111"
      },
      {
        schoolId: school.id,
        campusId: campus.id,
        userId: teacherPrimaryUser.id,
        employeeNo: "EMP-004",
        designation: "Primary Class Teacher",
        employmentDate: new Date("2022-09-01"),
        emergencyContactName: "Kunle Bello",
        emergencyContactPhone: "08050002222"
      },
      {
        schoolId: school.id,
        campusId: campus.id,
        userId: teacherEnglishUser.id,
        employeeNo: "EMP-005",
        designation: "English / Humanities Teacher",
        employmentDate: new Date("2023-01-09"),
        emergencyContactName: "Bisi Afolayan",
        emergencyContactPhone: "08050003333"
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
        emergencyContactPhone: "08050001616"
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
        emergencyContactPhone: "08050001717"
      },
      {
        schoolId: school.id,
        campusId: campus.id,
        userId: bursarUser.id,
        employeeNo: "EMP-003",
        designation: "Bursar",
        employmentDate: new Date("2023-02-01"),
        emergencyContactName: "Ifeanyi Eze",
        emergencyContactPhone: "08050004444"
      }
    ]
  });

  await Promise.all([
    prisma.classRoom.update({ where: { id: jss2Gold.id }, data: { classTeacherId: classTeacherUser.id } }),
    prisma.classRoom.update({ where: { id: jss1Silver.id }, data: { classTeacherId: classTeacherUser.id } }),
    prisma.classRoom.update({ where: { id: primary4Blue.id }, data: { classTeacherId: headTeacherUser.id } }),
    prisma.classRoom.update({ where: { id: primary6Coral.id }, data: { classTeacherId: teacherPrimaryUser.id } }),
    prisma.classRoom.update({ where: { id: ss1Emerald.id }, data: { classTeacherId: vpAcademicsUser.id } }),
    prisma.classRoom.update({ where: { id: ss2Topaz.id }, data: { classTeacherId: teacherEnglishUser.id } })
  ]);

  const guardian = await prisma.guardian.create({
    data: {
      schoolId: school.id,
      userId: parentUser.id,
      firstName: "Funke",
      lastName: "Yusuf",
      phone: "08030000000",
      email: "parent@greenfieldcollege.ng",
      relationship: "Mother",
      address: "Bodija, Ibadan"
    }
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
      address: "Jericho, Ibadan"
    }
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
      address: "Akobo, Ibadan"
    }
  });

  const guardianAdesola = await prisma.guardian.create({
    data: {
      schoolId: school.id,
      firstName: "Adesola",
      lastName: "Adewale",
      phone: "08034445566",
      email: "adesola.adewale@example.com",
      relationship: "Mother",
      address: "Challenge, Ibadan"
    }
  });

  const guardianIfeoma = await prisma.guardian.create({
    data: {
      schoolId: school.id,
      firstName: "Ifeoma",
      lastName: "Okeke",
      phone: "08037778899",
      email: "ifeoma.okeke@example.com",
      relationship: "Mother",
      address: "Oluyole, Ibadan"
    }
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
      stateOfOrigin: "Oyo"
    }
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
      admissionDate: new Date("2025-09-05")
    }
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
      admissionDate: new Date("2025-09-05")
    }
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
      stateOfOrigin: "Oyo"
    }
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
      stateOfOrigin: "Lagos"
    }
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
      stateOfOrigin: "Imo"
    }
  });

  const cohortPlans = [
    { classRoom: primary4Blue, prefix: "PRI4", birthYear: 2016 },
    { classRoom: primary6Coral, prefix: "PRI6", birthYear: 2014 },
    { classRoom: jss1Silver, prefix: "JSS1", birthYear: 2013 },
    { classRoom: jss2Gold, prefix: "JSS2", birthYear: 2012 },
    { classRoom: ss1Emerald, prefix: "SS1", birthYear: 2010 },
    { classRoom: ss2Topaz, prefix: "SS2", birthYear: 2009 }
  ];

  for (const plan of cohortPlans) {
    await prisma.student.createMany({
      data: cohortNames.map(([firstName, lastName, gender], index) => ({
        schoolId: school.id,
        campusId: campus.id,
        currentClassId: plan.classRoom.id,
        currentSessionId: session.id,
        admissionNumber: `GFC/25/${plan.prefix}-${String(index + 1).padStart(2, "0")}`,
        studentNumber: `STD-${plan.prefix}-${String(index + 1).padStart(2, "0")}`,
        firstName,
        lastName,
        gender,
        dateOfBirth: new Date(`${plan.birthYear}-${String((index % 9) + 1).padStart(2, "0")}-12`),
        admissionDate: new Date("2025-09-05"),
        nationality: "Nigerian",
        stateOfOrigin: ["Oyo", "Lagos", "Anambra", "Kaduna", "Rivers", "Akwa Ibom"][index % 6]
      }))
    });
  }

  await prisma.studentGuardian.createMany({
    data: [
      {
        studentId: studentDaniel.id,
        guardianId: guardian.id,
        isPrimary: true
      },
      {
        studentId: studentMaryam.id,
        guardianId: guardian.id,
        isPrimary: true
      },
      {
        studentId: studentAmarachi.id,
        guardianId: guardianChinelo.id,
        isPrimary: true
      },
      {
        studentId: studentIbrahim.id,
        guardianId: guardianSalisu.id,
        isPrimary: true
      },
      {
        studentId: studentEsther.id,
        guardianId: guardianAdesola.id,
        isPrimary: true
      },
      {
        studentId: studentChisom.id,
        guardianId: guardianIfeoma.id,
        isPrimary: true
      }
    ]
  });

  await prisma.medicalRecord.createMany({
    data: [
      {
        studentId: studentDaniel.id,
        bloodGroup: "O+",
        genotype: "AA",
        allergies: "Dust"
      },
      {
        studentId: studentAmarachi.id,
        bloodGroup: "A+",
        genotype: "AS",
        allergies: "Peanuts",
        conditions: "Carries inhaler during sports."
      },
      {
        studentId: studentIbrahim.id,
        bloodGroup: "B+",
        genotype: "AA",
        conditions: "Recently treated for malaria"
      },
      {
        studentId: studentMaryam.id,
        bloodGroup: "O+",
        genotype: "AA"
      },
      {
        studentId: studentEsther.id,
        bloodGroup: "AB+",
        genotype: "AS",
        allergies: "Penicillin"
      },
      {
        studentId: studentChisom.id,
        bloodGroup: "A-",
        genotype: "AA"
      }
    ]
  });

  await prisma.subject.createMany({
    data: nigerianSubjectDefaults.map((subject) => ({
      schoolId: school.id,
      departmentId: ["SENIOR_SECONDARY", "JUNIOR_SECONDARY"].includes(subject.section) ? scienceDepartment.id : undefined,
      name: subject.name,
      code: subject.code,
      section: subject.section,
      applicableClassLevels: subject.applicableClassLevels,
      isCore: subject.isCore,
      isOptional: subject.isOptional ?? false,
      religionSpecific: subject.religionSpecific ?? false,
      trackSpecific: subject.trackSpecific,
      tradeSubject: subject.tradeSubject ?? false,
      status: "ACTIVE"
    }))
  });
  const seededSubjects = await prisma.subject.findMany({ where: { schoolId: school.id } });
  const subjectByCode = new Map(seededSubjects.map((subject) => [subject.code, subject]));
  const math = subjectByCode.get("JSS2")!;
  const biology = subjectByCode.get("SSSCI1")!;
  const basicScience = subjectByCode.get("UP4")!;
  const english = subjectByCode.get("SSCORE1")!;
  const economics = subjectByCode.get("SSBUS4")!;
  const primaryEnglish = subjectByCode.get("UP1")!;
  const primaryMath = subjectByCode.get("UP2")!;
  const jssEnglish = subjectByCode.get("JSS1")!;

  await prisma.classSubject.createMany({
    data: [
      { schoolId: school.id, classId: jss2Gold.id, subjectId: math.id, teacherId: teacherUser.id },
      { schoolId: school.id, classId: jss2Gold.id, subjectId: jssEnglish.id, teacherId: teacherEnglishUser.id },
      { schoolId: school.id, classId: ss1Emerald.id, subjectId: biology.id, teacherId: teacherUser.id },
      { schoolId: school.id, classId: ss1Emerald.id, subjectId: english.id, teacherId: teacherEnglishUser.id },
      { schoolId: school.id, classId: primary6Coral.id, subjectId: basicScience.id, teacherId: teacherUser.id },
      { schoolId: school.id, classId: primary6Coral.id, subjectId: primaryEnglish.id, teacherId: teacherPrimaryUser.id },
      { schoolId: school.id, classId: primary4Blue.id, subjectId: primaryEnglish.id, teacherId: teacherPrimaryUser.id },
      { schoolId: school.id, classId: primary4Blue.id, subjectId: primaryMath.id, teacherId: teacherPrimaryUser.id },
      { schoolId: school.id, classId: jss1Silver.id, subjectId: math.id, teacherId: teacherUser.id },
      { schoolId: school.id, classId: jss1Silver.id, subjectId: jssEnglish.id, teacherId: teacherEnglishUser.id },
      { schoolId: school.id, classId: ss2Topaz.id, subjectId: english.id, teacherId: teacherEnglishUser.id },
      { schoolId: school.id, classId: ss2Topaz.id, subjectId: economics.id, teacherId: teacherEnglishUser.id }
    ]
  });

  const gradingScheme = await prisma.gradingScheme.create({
    data: {
      schoolId: school.id,
      name: "Nigerian Termly A-F Default",
      description: "Default Nigerian termly grade bands: A 70-100, B 60-69, C 50-59, D 45-49, E 40-44, F 0-39.",
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
          order: index + 1
        }))
      }
    }
  });

  const ca = await prisma.assessmentComponent.create({
    data: {
      schoolId: school.id,
      termId: secondTerm.id,
      name: "Continuous Assessment",
      code: "CA",
      weight: 40,
      maxScore: 40,
      order: 1
    }
  });

  const exam = await prisma.assessmentComponent.create({
    data: {
      schoolId: school.id,
      termId: secondTerm.id,
      name: "Exam",
      code: "EXAM",
      weight: 60,
      maxScore: 60,
      order: 2
    }
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
        order: component.order
      }))
    )
  });

  const danielSheet = await prisma.resultSheet.create({
    data: {
      schoolId: school.id,
      studentId: studentDaniel.id,
      termId: secondTerm.id,
      classId: jss2Gold.id,
      createdById: teacherUser.id,
      totalScore: 76,
      averageScore: 76,
      grade: "A",
      position: 4,
      teacherComment: "Steady progress.",
      principalComment: "Can push higher with more revision.",
      status: "PUBLISHED",
      gradingSchemeId: gradingScheme.id,
      approvedAt: new Date("2026-04-07"),
      lockedAt: new Date("2026-04-08"),
      publishedAt: new Date("2026-04-08")
    }
  });

  const amarachiSheet = await prisma.resultSheet.create({
    data: {
      schoolId: school.id,
      studentId: studentAmarachi.id,
      termId: secondTerm.id,
      classId: ss1Emerald.id,
      createdById: teacherUser.id,
      totalScore: 84.5,
      averageScore: 84.5,
      grade: "A",
      position: 2,
      teacherComment: "Excellent science performance.",
      principalComment: "Maintain consistency across all subjects.",
      status: "PUBLISHED",
      gradingSchemeId: gradingScheme.id,
      approvedAt: new Date("2026-04-07"),
      lockedAt: new Date("2026-04-08"),
      publishedAt: new Date("2026-04-08")
    }
  });

  const ibrahimSheet = await prisma.resultSheet.create({
    data: {
      schoolId: school.id,
      studentId: studentIbrahim.id,
      termId: secondTerm.id,
      classId: primary6Coral.id,
      createdById: teacherPrimaryUser.id,
      totalScore: 69.1,
      averageScore: 69.1,
      grade: "B",
      position: 9,
      teacherComment: "Needs attendance stability.",
      principalComment: "Support plan recommended.",
      status: "PUBLISHED",
      gradingSchemeId: gradingScheme.id,
      approvedAt: new Date("2026-04-07"),
      lockedAt: new Date("2026-04-08"),
      publishedAt: new Date("2026-04-08")
    }
  });

  const maryamSheet = await prisma.resultSheet.create({
    data: {
      schoolId: school.id,
      studentId: studentMaryam.id,
      termId: secondTerm.id,
      classId: primary4Blue.id,
      createdById: teacherPrimaryUser.id,
      totalScore: 82.3,
      averageScore: 82.3,
      grade: "A",
      position: 3,
      teacherComment: "Strong reading and writing growth.",
      principalComment: "Keep nurturing the momentum.",
      status: "PUBLISHED",
      gradingSchemeId: gradingScheme.id,
      approvedAt: new Date("2026-04-07"),
      lockedAt: new Date("2026-04-08"),
      publishedAt: new Date("2026-04-08")
    }
  });

  const estherSheet = await prisma.resultSheet.create({
    data: {
      schoolId: school.id,
      studentId: studentEsther.id,
      termId: secondTerm.id,
      classId: jss1Silver.id,
      createdById: teacherEnglishUser.id,
      totalScore: 75.4,
      averageScore: 75.4,
      grade: "A",
      position: 7,
      teacherComment: "Good foundational performance.",
      principalComment: "Can improve with homework consistency.",
      status: "PUBLISHED",
      gradingSchemeId: gradingScheme.id,
      approvedAt: new Date("2026-04-07"),
      lockedAt: new Date("2026-04-08"),
      publishedAt: new Date("2026-04-08")
    }
  });

  const chisomSheet = await prisma.resultSheet.create({
    data: {
      schoolId: school.id,
      studentId: studentChisom.id,
      termId: secondTerm.id,
      classId: ss2Topaz.id,
      createdById: teacherEnglishUser.id,
      totalScore: 88.2,
      averageScore: 88.2,
      grade: "A",
      position: 1,
      teacherComment: "Leadership and academics remain strong.",
      principalComment: "Outstanding performance.",
      status: "PUBLISHED",
      gradingSchemeId: gradingScheme.id,
      approvedAt: new Date("2026-04-07"),
      lockedAt: new Date("2026-04-08"),
      publishedAt: new Date("2026-04-08")
    }
  });

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
      publishedAt: new Date("2025-12-18")
    }
  });

  await prisma.scoreEntry.createMany({
    data: [
      {
        schoolId: school.id,
        studentId: studentDaniel.id,
        resultSheetId: danielSheet.id,
        subjectId: math.id,
        assessmentComponentId: ca.id,
        enteredById: teacherUser.id,
        score: 28,
        maxScore: 40
      },
      {
        schoolId: school.id,
        studentId: studentDaniel.id,
        resultSheetId: danielSheet.id,
        subjectId: math.id,
        assessmentComponentId: exam.id,
        enteredById: teacherUser.id,
        score: 46,
        maxScore: 60
      },
      {
        schoolId: school.id,
        studentId: studentAmarachi.id,
        resultSheetId: amarachiSheet.id,
        subjectId: biology.id,
        assessmentComponentId: ca.id,
        enteredById: teacherUser.id,
        score: 29,
        maxScore: 40
      },
      {
        schoolId: school.id,
        studentId: studentAmarachi.id,
        resultSheetId: amarachiSheet.id,
        subjectId: biology.id,
        assessmentComponentId: exam.id,
        enteredById: teacherUser.id,
        score: 52,
        maxScore: 60
      },
      {
        schoolId: school.id,
        studentId: studentIbrahim.id,
        resultSheetId: ibrahimSheet.id,
        subjectId: basicScience.id,
        assessmentComponentId: ca.id,
        enteredById: teacherPrimaryUser.id,
        score: 23,
        maxScore: 40
      },
      {
        schoolId: school.id,
        studentId: studentIbrahim.id,
        resultSheetId: ibrahimSheet.id,
        subjectId: basicScience.id,
        assessmentComponentId: exam.id,
        enteredById: teacherPrimaryUser.id,
        score: 38,
        maxScore: 60
      },
      {
        schoolId: school.id,
        studentId: studentMaryam.id,
        resultSheetId: maryamSheet.id,
        subjectId: english.id,
        assessmentComponentId: ca.id,
        enteredById: teacherPrimaryUser.id,
        score: 34,
        maxScore: 40
      },
      {
        schoolId: school.id,
        studentId: studentMaryam.id,
        resultSheetId: maryamSheet.id,
        subjectId: english.id,
        assessmentComponentId: exam.id,
        enteredById: teacherPrimaryUser.id,
        score: 48.3,
        maxScore: 60
      },
      {
        schoolId: school.id,
        studentId: studentEsther.id,
        resultSheetId: estherSheet.id,
        subjectId: english.id,
        assessmentComponentId: ca.id,
        enteredById: teacherEnglishUser.id,
        score: 31,
        maxScore: 40
      },
      {
        schoolId: school.id,
        studentId: studentEsther.id,
        resultSheetId: estherSheet.id,
        subjectId: english.id,
        assessmentComponentId: exam.id,
        enteredById: teacherEnglishUser.id,
        score: 44.4,
        maxScore: 60
      },
      {
        schoolId: school.id,
        studentId: studentChisom.id,
        resultSheetId: chisomSheet.id,
        subjectId: economics.id,
        assessmentComponentId: ca.id,
        enteredById: teacherEnglishUser.id,
        score: 35,
        maxScore: 40
      },
      {
        schoolId: school.id,
        studentId: studentChisom.id,
        resultSheetId: chisomSheet.id,
        subjectId: economics.id,
        assessmentComponentId: exam.id,
        enteredById: teacherEnglishUser.id,
        score: 53.2,
        maxScore: 60
      }
    ]
  });

  const jss2StudentsForResults = await prisma.student.findMany({
    where: { schoolId: school.id, currentClassId: jss2Gold.id, status: "ACTIVE" },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }]
  });
  const jss2RawRows = [];

  for (const [index, student] of jss2StudentsForResults.entries()) {
    const isDaniel = student.id === studentDaniel.id;
    const mathCa = isDaniel ? 28 : 24 + (index % 9);
    const mathExam = isDaniel ? 46 : 38 + (index % 15);
    const englishCa = isDaniel ? 30 : 23 + (index % 10);
    const englishExam = isDaniel ? 48 : 37 + (index % 16);
    const mathTotal = mathCa + mathExam;
    const englishTotal = englishCa + englishExam;
    const average = Number(((mathTotal + englishTotal) / 2).toFixed(2));
    const band = resolveGradeLabel(average, nigerianTermGradeBands);

    const sheet = isDaniel
      ? await prisma.resultSheet.update({
          where: { id: danielSheet.id },
          data: {
            totalScore: Number((mathTotal + englishTotal).toFixed(2)),
            averageScore: average,
            grade: band.label,
            teacherComment: "Steady progress across Mathematics and English.",
            principalComment: "Can push higher with more revision."
          }
        })
      : await prisma.resultSheet.create({
          data: {
            schoolId: school.id,
            studentId: student.id,
            termId: secondTerm.id,
            classId: jss2Gold.id,
            createdById: teacherUser.id,
            totalScore: Number((mathTotal + englishTotal).toFixed(2)),
            averageScore: average,
            grade: band.label,
            teacherComment: average >= 70 ? "Strong class participation and homework consistency." : "Good effort; continue targeted revision.",
            principalComment: average >= 70 ? "Excellent progress this term." : "Keep improving with class teacher support.",
            status: "PUBLISHED",
            gradingSchemeId: gradingScheme.id,
            approvedAt: new Date("2026-04-07"),
            lockedAt: new Date("2026-04-08"),
            publishedAt: new Date("2026-04-08")
          }
        });

    const entries = isDaniel
      ? [
          {
            schoolId: school.id,
            studentId: student.id,
            resultSheetId: sheet.id,
            subjectId: jssEnglish.id,
            assessmentComponentId: ca.id,
            enteredById: teacherEnglishUser.id,
            score: englishCa,
            maxScore: 40
          },
          {
            schoolId: school.id,
            studentId: student.id,
            resultSheetId: sheet.id,
            subjectId: jssEnglish.id,
            assessmentComponentId: exam.id,
            enteredById: teacherEnglishUser.id,
            score: englishExam,
            maxScore: 60
          }
        ]
      : [
          {
            schoolId: school.id,
            studentId: student.id,
            resultSheetId: sheet.id,
            subjectId: math.id,
            assessmentComponentId: ca.id,
            enteredById: teacherUser.id,
            score: mathCa,
            maxScore: 40
          },
          {
            schoolId: school.id,
            studentId: student.id,
            resultSheetId: sheet.id,
            subjectId: math.id,
            assessmentComponentId: exam.id,
            enteredById: teacherUser.id,
            score: mathExam,
            maxScore: 60
          },
          {
            schoolId: school.id,
            studentId: student.id,
            resultSheetId: sheet.id,
            subjectId: jssEnglish.id,
            assessmentComponentId: ca.id,
            enteredById: teacherEnglishUser.id,
            score: englishCa,
            maxScore: 40
          },
          {
            schoolId: school.id,
            studentId: student.id,
            resultSheetId: sheet.id,
            subjectId: jssEnglish.id,
            assessmentComponentId: exam.id,
            enteredById: teacherEnglishUser.id,
            score: englishExam,
            maxScore: 60
          }
        ];

    await prisma.scoreEntry.createMany({ data: entries });

    jss2RawRows.push({
      studentId: student.id,
      studentName: [student.firstName, student.middleName, student.lastName].filter(Boolean).join(" "),
      admissionNumber: student.admissionNumber,
      subjects: [
        { subject: math.name, caTotal: mathCa, examTotal: mathExam, total: mathTotal, grade: resolveGradeLabel(mathTotal, nigerianTermGradeBands).label, remark: resolveGradeLabel(mathTotal, nigerianTermGradeBands).remark },
        { subject: jssEnglish.name, caTotal: englishCa, examTotal: englishExam, total: englishTotal, grade: resolveGradeLabel(englishTotal, nigerianTermGradeBands).label, remark: resolveGradeLabel(englishTotal, nigerianTermGradeBands).remark }
      ],
      total: Number((mathTotal + englishTotal).toFixed(2)),
      average,
      attendance: "95%",
      classTeacherRemark: average >= 70 ? "Consistent classwork and positive participation." : "Improving; needs steady revision.",
      principalRemark: average >= 70 ? "Excellent work. Keep it up." : "Good effort; keep improving.",
      promotionStatus: average >= 40 ? "Promoted / Good standing" : "Review required"
    });
  }

  const jss2BroadsheetRows = [...jss2RawRows]
    .sort((left, right) => right.average - left.average)
    .map((row, index) => ({ ...row, position: index + 1 }));

  await prisma.scoreEntry.updateMany({
    where: { schoolId: school.id },
    data: { isDraft: false, submittedAt: new Date("2026-04-07") }
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
      status: "MARKED"
    }
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
        status: "APPROVED"
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
        status: "ACTIVE"
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
        status: "ACTIVE"
      }
    ]
  });

  const jss2MathCaEntries = await prisma.scoreEntry.findMany({
    where: { schoolId: school.id, studentId: { in: jss2StudentsForResults.map((student) => student.id) }, subjectId: math.id, assessmentComponentId: ca.id }
  });
  const jss2MathCaByStudent = new Map(jss2MathCaEntries.map((entry) => [entry.studentId, entry]));

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
        enteredAt: new Date("2026-04-18T11:30:00.000Z")
      }))
  });

  await prisma.assessmentScoreAudit.create({
    data: {
      schoolId: school.id,
      assessmentId: mathTest.id,
      scoreEntryId: jss2MathCaByStudent.get(studentDaniel.id)?.id,
      actorId: teacherUser.id,
      newScore: 18,
      action: "SCORE_ENTERED",
      note: "Seeded test score for demo moderation workflow."
    }
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
        rows: jss2BroadsheetRows
      },
      approvedAt: new Date("2026-04-07"),
      publishedAt: new Date("2026-04-08"),
      lockedAt: new Date("2026-04-08")
    }
  });

  await prisma.broadsheetApprovalHistory.createMany({
    data: [
      { schoolId: school.id, broadsheetId: jss2Broadsheet.id, actorId: hodUser.id, stage: "HEAD_OF_DEPARTMENT", action: "APPROVE", note: "Subject entries moderated." },
      { schoolId: school.id, broadsheetId: jss2Broadsheet.id, actorId: examOfficerUser.id, stage: "EXAM_OFFICER", action: "COMPILE", note: "Broadsheet compiled." },
      { schoolId: school.id, broadsheetId: jss2Broadsheet.id, actorId: vpAcademicsUser.id, stage: "VICE_PRINCIPAL_ACADEMICS", action: "APPROVE", note: "Class result verified." },
      { schoolId: school.id, broadsheetId: jss2Broadsheet.id, actorId: principalUser.id, stage: "PRINCIPAL", action: "PUBLISH", note: "Approved for parent and student portals." }
    ]
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
        grade: resolveGradeLabel(row.average, nigerianTermGradeBands).label
      },
      publishedAt: new Date("2026-04-08"),
      lockedAt: new Date("2026-04-08")
    }))
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
        data: { track: "SCIENCE", caTotal: 29, examTotal: 52, readiness: "High" }
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
        remark: "External exam readiness profile: business track distinction candidate.",
        data: { track: "BUSINESS", caTotal: 35, examTotal: 53.2, readiness: "High" }
      }
    ]
  });

  await prisma.studentAttendance.createMany({
    data: [
      {
        schoolId: school.id,
        studentId: studentDaniel.id,
        classId: jss2Gold.id,
        termId: secondTerm.id,
        markedById: teacherUser.id,
        date: new Date("2026-04-08"),
        status: "PRESENT"
      },
      {
        schoolId: school.id,
        studentId: studentAmarachi.id,
        classId: ss1Emerald.id,
        termId: secondTerm.id,
        markedById: teacherUser.id,
        date: new Date("2026-04-08"),
        status: "LATE",
        reason: "Bus delay"
      },
      {
        schoolId: school.id,
        studentId: studentIbrahim.id,
        classId: primary6Coral.id,
        termId: secondTerm.id,
        markedById: teacherPrimaryUser.id,
        date: new Date("2026-04-08"),
        status: "ABSENT",
        reason: "Reported ill by parent"
      },
      {
        schoolId: school.id,
        studentId: studentMaryam.id,
        classId: primary4Blue.id,
        termId: secondTerm.id,
        markedById: teacherPrimaryUser.id,
        date: new Date("2026-04-08"),
        status: "PRESENT"
      },
      {
        schoolId: school.id,
        studentId: studentEsther.id,
        classId: jss1Silver.id,
        termId: secondTerm.id,
        markedById: teacherEnglishUser.id,
        date: new Date("2026-04-08"),
        status: "PRESENT"
      },
      {
        schoolId: school.id,
        studentId: studentChisom.id,
        classId: ss2Topaz.id,
        termId: secondTerm.id,
        markedById: teacherEnglishUser.id,
        date: new Date("2026-04-08"),
        status: "PRESENT"
      }
    ]
  });

  const scienceAssignment = await prisma.assignment.create({
    data: {
      schoolId: school.id,
      classId: jss2Gold.id,
      subjectId: math.id,
      teacherId: teacherUser.id,
      title: "Algebra revision worksheet",
      description: "Complete questions 1 to 20 on simultaneous equations before the next Mathematics period.",
      dueAt: new Date("2026-04-17T15:00:00.000Z"),
      status: "PUBLISHED"
    }
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
      gradedAt: new Date("2026-04-11T09:00:00.000Z")
    }
  });

  await prisma.admissionConfig.create({
    data: {
      schoolId: school.id,
      academicSessionId: session.id,
      termId: secondTerm.id,
      name: "2026 O-Level Admissions Cycle",
      minAge: 9,
      maxAge: 17,
      requiredDocuments: ["Birth certificate", "Previous school result", "Passport photograph", "Medical form"],
      formFields: ["biodata", "guardian", "address", "emergencyContact", "medical", "previousSchool"],
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
        offer: "Your admission offer is ready."
      },
      openClasses: {
        connect: [{ id: jss1Silver.id }, { id: jss2Gold.id }, { id: ss1Emerald.id }, { id: primary4Blue.id }]
      }
    }
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
          notes: "Documents complete. Entrance assessment is suitable for JSS 1 Gold.",
          reviewedAt: new Date("2026-04-05T09:00:00.000Z")
        }
      },
      screenings: {
        create: {
          schoolId: school.id,
          interviewerId: teacherUser.id,
          scheduledAt: new Date("2026-04-15T09:00:00.000Z"),
          venue: "ICT Lab"
        }
      },
      documents: {
        create: [
          {
            label: "Birth certificate",
            fileUrl: "s3://demo/admissions/samuel-birth-certificate.pdf",
            mimeType: "application/pdf",
            sizeBytes: 240000,
            isVerified: true,
            verifiedAt: new Date("2026-04-05T09:30:00.000Z")
          },
          {
            label: "Previous school result",
            fileUrl: "s3://demo/admissions/samuel-previous-result.pdf",
            mimeType: "application/pdf",
            sizeBytes: 310000,
            isVerified: true,
            verifiedAt: new Date("2026-04-05T09:30:00.000Z")
          }
        ]
      },
      paymentLinks: {
        create: {
          schoolId: school.id,
          verifiedById: bursarUser.id,
          reference: "ADM-FEE-0012",
          amount: 10000,
          status: "VERIFIED",
          verifiedAt: new Date("2026-04-05T10:00:00.000Z"),
          metadata: { source: "Manual bursary verification" }
        }
      },
      history: {
        create: [
          {
            schoolId: school.id,
            toStatus: "SUBMITTED",
            changedById: admissionsOfficerUser.id,
            note: "Walk-in application captured."
          },
          {
            schoolId: school.id,
            fromStatus: "SUBMITTED",
            toStatus: "REVIEWING",
            changedById: admissionsOfficerUser.id,
            note: "Documents and class fit checked."
          },
          {
            schoolId: school.id,
            fromStatus: "PAYMENT_PENDING",
            toStatus: "SCREENING_SCHEDULED",
            changedById: admissionsOfficerUser.id,
            note: "Screening scheduled after fee verification."
          }
        ]
      }
    }
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
            reviewedAt: new Date("2026-04-03T09:00:00.000Z")
          },
          {
            reviewerId: principalUser.id,
            decision: "APPROVED",
            notes: "Approved for Primary 4 Blue after screening.",
            reviewedAt: new Date("2026-04-04T12:00:00.000Z")
          }
        ]
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
          completedAt: new Date("2026-04-04T10:00:00.000Z")
        }
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
          expiresAt: new Date("2026-04-19T09:00:00.000Z")
        }
      },
      history: {
        create: [
          {
            schoolId: school.id,
            toStatus: "SUBMITTED",
            changedById: admissionsOfficerUser.id,
            note: "Online application received."
          },
          {
            schoolId: school.id,
            fromStatus: "RECOMMENDED",
            toStatus: "APPROVED",
            changedById: principalUser.id,
            note: "Principal approved admission."
          },
          {
            schoolId: school.id,
            fromStatus: "APPROVED",
            toStatus: "OFFER_SENT",
            changedById: admissionsOfficerUser.id,
            note: "Offer letter issued."
          }
        ]
      }
    }
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
          note: "Application submitted by guardian."
        }
      }
    }
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
          { label: "Development Levy", amount: 25000 }
        ]
      }
    }
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
          { description: "Development Levy", amount: 25000, quantity: 1 }
        ]
      }
    }
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
      verifiedAt: new Date("2026-04-03")
    }
  });

  await prisma.paymentAllocation.create({
    data: {
      schoolId: school.id,
      paymentId: danielPayment.id,
      invoiceId: danielInvoice.id,
      amount: 160000,
      metadata: { seed: true }
    }
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
      metadata: { paymentReference: "PAY-2026-001" }
    }
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
      notes: "Parent agreed to clear the remaining balance in two installments.",
      items: {
        create: [
          { dueOn: new Date("2026-04-18"), amount: 62500 },
          { dueOn: new Date("2026-05-02"), amount: 62500 }
        ]
      }
    }
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
        status: "PAID"
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
        status: "PARTIALLY_PAID"
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
        status: "PAID"
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
        status: "PARTIALLY_PAID"
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
        status: "PAID"
      }
    ]
  });

  await prisma.behaviorLog.createMany({
    data: [
      {
        studentId: studentDaniel.id,
        category: "Merit",
        description: "Volunteered to support the library reading club setup.",
        severity: "LOW"
      },
      {
        studentId: studentAmarachi.id,
        category: "Health / pastoral",
        description: "Reported shortness of breath during athletics; nurse and guardian were notified.",
        severity: "MEDIUM"
      },
      {
        studentId: studentIbrahim.id,
        category: "Attendance follow-up",
        description: "Class teacher logged repeated lateness due to transport route delay.",
        severity: "MEDIUM"
      },
      {
        studentId: studentMaryam.id,
        category: "Merit",
        description: "Outstanding reading fluency improvement during literacy week.",
        severity: "LOW"
      },
      {
        studentId: studentEsther.id,
        category: "Pastoral",
        description: "Follow-up note after repeated late homework submission.",
        severity: "MEDIUM"
      },
      {
        studentId: studentChisom.id,
        category: "Merit",
        description: "Led the SS2 debate prep team and supported junior learners.",
        severity: "LOW"
      }
    ]
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
        decision: "Promoted after first term review"
      },
      {
        schoolId: school.id,
        studentId: studentAmarachi.id,
        fromClassId: jss2Gold.id,
        toClassId: ss1Emerald.id,
        fromSessionId: session.id,
        toSessionId: session.id,
        decision: "Admitted into science stream"
      },
      {
        schoolId: school.id,
        studentId: studentIbrahim.id,
        fromClassId: primary4Blue.id,
        toClassId: primary6Coral.id,
        fromSessionId: session.id,
        toSessionId: session.id,
        decision: "Promoted with literacy intervention note"
      },
      {
        schoolId: school.id,
        studentId: studentMaryam.id,
        fromClassId: primary4Blue.id,
        toClassId: primary4Blue.id,
        fromSessionId: session.id,
        toSessionId: session.id,
        decision: "Promoted after first year placement review"
      },
      {
        schoolId: school.id,
        studentId: studentEsther.id,
        toClassId: jss1Silver.id,
        toSessionId: session.id,
        decision: "New admission onboarded into junior secondary"
      },
      {
        schoolId: school.id,
        studentId: studentChisom.id,
        fromClassId: ss1Emerald.id,
        toClassId: ss2Topaz.id,
        fromSessionId: session.id,
        toSessionId: session.id,
        decision: "Promoted on distinction list"
      }
    ]
  });

  await prisma.announcement.createMany({
    data: [
      {
        schoolId: school.id,
        createdById: principalUser.id,
        title: "Second term inter-house sports holds on April 18",
        body: "Parents should ensure students come in house jerseys and water bottles.",
        audience: "School-wide",
        channel: "IN_APP"
      },
      {
        schoolId: school.id,
        createdById: bursarUser.id,
        title: "Fee deadline reminder for transport families",
        body: "Transport balances should be cleared before Friday to avoid route suspension.",
        audience: "Parents",
        channel: "SMS"
      }
    ]
  });

  const route = await prisma.transportRoute.create({
    data: {
      schoolId: school.id,
      name: "Bodija Route",
      code: "TR-001",
      driverName: "Adewale Musa",
      driverPhone: "08045551234",
      vehicleRegNo: "FST-204AA",
      capacity: 28
    }
  });

  await prisma.transportAssignment.create({
    data: {
      schoolId: school.id,
      routeId: route.id,
      studentId: studentDaniel.id,
      stopName: "Bodija Gate",
      amount: 60000
    }
  });

  const hostel = await prisma.hostelBuilding.create({
    data: {
      schoolId: school.id,
      name: "Emerald House",
      gender: "MALE"
    }
  });

  const hostelRoom = await prisma.hostelRoom.create({
    data: {
      schoolId: school.id,
      hostelBuildingId: hostel.id,
      name: "Room A1",
      capacity: 6
    }
  });

  await prisma.hostelAllocation.create({
    data: {
      schoolId: school.id,
      roomId: hostelRoom.id,
      studentId: studentDaniel.id,
      academicSessionId: session.id,
      startDate: new Date("2025-09-10")
    }
  });

  const book = await prisma.libraryBook.create({
    data: {
      schoolId: school.id,
      isbn: "9789780000012",
      title: "New General Mathematics",
      author: "M. F. Macrae",
      copiesTotal: 20,
      copiesAvailable: 19,
      shelfCode: "MAT-1"
    }
  });

  const teacherProfile = await prisma.staffProfile.findUniqueOrThrow({
    where: {
      userId: teacherUser.id
    }
  });

  const teacherEnglishProfile = await prisma.staffProfile.findUniqueOrThrow({
    where: {
      userId: teacherEnglishUser.id
    }
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
        status: "PENDING"
      },
      {
        schoolId: school.id,
        staffId: teacherEnglishProfile.id,
        type: "Training leave",
        startDate: new Date("2026-04-07"),
        endDate: new Date("2026-04-09"),
        reason: "State curriculum workshop",
        status: "APPROVED"
      }
    ]
  });

  await prisma.staffAttendance.createMany({
    data: [
      {
        schoolId: school.id,
        userId: teacherUser.id,
        date: new Date("2026-04-08"),
        status: "PRESENT",
        checkInAt: new Date("2026-04-08T07:41:00.000Z"),
        notes: "Morning briefing attended."
      },
      {
        schoolId: school.id,
        userId: teacherUser.id,
        date: new Date("2026-04-07"),
        status: "PRESENT",
        checkInAt: new Date("2026-04-07T07:38:00.000Z"),
        checkOutAt: new Date("2026-04-07T15:41:00.000Z")
      },
      {
        schoolId: school.id,
        userId: teacherPrimaryUser.id,
        date: new Date("2026-04-08"),
        status: "PRESENT",
        checkInAt: new Date("2026-04-08T07:28:00.000Z")
      },
      {
        schoolId: school.id,
        userId: teacherPrimaryUser.id,
        date: new Date("2026-04-07"),
        status: "PRESENT",
        checkInAt: new Date("2026-04-07T07:31:00.000Z"),
        checkOutAt: new Date("2026-04-07T15:22:00.000Z")
      },
      {
        schoolId: school.id,
        userId: teacherEnglishUser.id,
        date: new Date("2026-04-08"),
        status: "PRESENT",
        checkInAt: new Date("2026-04-08T07:35:00.000Z")
      },
      {
        schoolId: school.id,
        userId: teacherEnglishUser.id,
        date: new Date("2026-04-07"),
        status: "ON_LEAVE",
        notes: "Approved curriculum workshop leave."
      }
    ]
  });

  await prisma.staffAttendancePolicy.create({
    data: {
      schoolId: school.id,
      resumptionTime: "07:45",
      closingTime: "15:30",
      graceMinutes: 10,
      timezone: "Africa/Lagos"
    }
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
        learningObjectives: "Learners solve two-variable linear equations using elimination and substitution.",
        recommendedResources: "NERDC Basic Mathematics JSS2, pages 84-91.",
        assignmentNote: "Exercise 4A, questions 1-10.",
        status: "ACTIVE",
        progressStatus: "IN_PROGRESS"
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
        learningObjectives: "Learners translate word problems into algebraic equations.",
        recommendedResources: "WAEC/NECO-style class practice questions.",
        assignmentNote: "Prepare five word problems from market-day examples.",
        status: "ACTIVE",
        progressStatus: "NOT_STARTED"
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
        learningObjectives: "Students explain photosynthesis and identify limiting factors.",
        recommendedResources: "Senior Secondary Biology, local leaf-starch experiment.",
        assignmentNote: "Draw and label the photosynthesis experiment setup.",
        status: "ACTIVE",
        progressStatus: "TAUGHT",
        actualDateTaught: new Date("2026-04-08")
      }
    ]
  });

  const teacherPrimaryProfile = await prisma.staffProfile.findUniqueOrThrow({
    where: {
      userId: teacherPrimaryUser.id
    }
  });

  const curriculumTraining = await prisma.trainingProgram.create({
    data: {
      schoolId: school.id,
      createdById: principalUser.id,
      title: "Second Term Scheme of Work Orientation",
      description: "Internal CPD session for Nigerian curriculum coverage, weekly lesson topics, and assessment alignment.",
      category: "CURRICULUM_ORIENTATION",
      trainingType: "INTERNAL",
      startsAt: new Date("2026-04-18T09:00:00.000Z"),
      endsAt: new Date("2026-04-18T12:00:00.000Z"),
      durationHours: 3,
      facilitator: "Principal / Head Teacher",
      provider: "Greenfield College",
      location: "ICT Lab",
      mandatory: true
    }
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
        notes: "Completed curriculum mapping practical."
      },
      {
        schoolId: school.id,
        trainingProgramId: curriculumTraining.id,
        userId: teacherPrimaryUser.id,
        staffId: teacherPrimaryProfile.id,
        status: "INVITED",
        cpdPoints: 0,
        notes: "Pending mandatory curriculum orientation."
      },
      {
        schoolId: school.id,
        trainingProgramId: curriculumTraining.id,
        userId: teacherEnglishUser.id,
        staffId: teacherEnglishProfile.id,
        status: "ATTENDED",
        attendedAt: new Date("2026-04-18T09:10:00.000Z"),
        cpdPoints: 1.5,
        notes: "Certificate pending upload."
      }
    ]
  });

  await prisma.libraryLoan.create({
    data: {
      schoolId: school.id,
      bookId: book.id,
      staffId: teacherProfile.id,
      borrowedAt: new Date("2026-04-02"),
      dueAt: new Date("2026-04-16"),
      fineAmount: 0
    }
  });

  await prisma.integrationConfig.createMany({
    data: [
      {
        schoolId: school.id,
        provider: "PAYSTACK",
        settings: { mode: "sandbox", publicKey: "pk_test_xxx" },
        enabled: false
      },
      {
        schoolId: school.id,
        provider: "FLUTTERWAVE",
        settings: { mode: "sandbox", publicKey: "FLWPUBK_TEST-xxx" },
        enabled: false
      }
    ]
  });

  await prisma.auditLog.create({
    data: {
      schoolId: school.id,
      actorId: admin.id,
      action: "CREATE",
      entityType: "seed",
      entityId: school.id,
      metadata: { note: "Initial demo seed completed" }
    }
  });

  console.log("Seed complete.");
  console.log("Demo super admin: admin@futurerealm.sms / FutureRealm123!");
  console.log("Demo principal: principal@greenfieldcollege.ng / FutureRealm123!");
  console.log("Demo leadership: proprietor@greenfieldcollege.ng, administrator@greenfieldcollege.ng, head.teacher@greenfieldcollege.ng, vp.academics@greenfieldcollege.ng, vp.admin@greenfieldcollege.ng, vp.special@greenfieldcollege.ng / FutureRealm123!");
  console.log("Demo admin officer: admin.officer@greenfieldcollege.ng / FutureRealm123!");
  console.log("Demo admissions officer: admissions@greenfieldcollege.ng / FutureRealm123!");
  console.log("Demo teachers: teacher@greenfieldcollege.ng, teacher.primary@greenfieldcollege.ng, teacher.english@greenfieldcollege.ng, class.teacher@greenfieldcollege.ng, subject.teacher@greenfieldcollege.ng / FutureRealm123!");
  console.log("Demo bursar: bursar@greenfieldcollege.ng / FutureRealm123!");
  console.log("Demo parents: parent@greenfieldcollege.ng, chinelo.obi@greenfieldcollege.ng, salisu.mohammed@greenfieldcollege.ng / FutureRealm123!");
  console.log("Demo students: student@greenfieldcollege.ng, maryam.yusuf@greenfieldcollege.ng, amarachi.obi@greenfieldcollege.ng, ibrahim.salisu@greenfieldcollege.ng, esther.adewale@greenfieldcollege.ng / FutureRealm123!");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
