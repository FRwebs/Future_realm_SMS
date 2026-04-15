import { addDays, subDays } from "date-fns";

import type {
  AdmissionApplicationView,
  AnnouncementView,
  AttendanceRecordView,
  DashboardSummary,
  DemoUserCredential,
  GradeRecordView,
  InvoiceView,
  ParentPortalView,
  PortalFinanceItem,
  PortalResultHistory,
  PortalTimetableEntry,
  StudentBehaviorLogView,
  StudentDocumentView,
  StudentMedicalView,
  StudentPortalView,
  StudentProfileView,
  StudentPromotionView,
  TeacherAttendanceHistoryView,
  TeacherActivityView,
  TeacherPortalView,
  TeacherProfileView,
  TeacherRecordView,
  TeacherLeaveRequestView,
  StudentRecordView
} from "@/lib/domain/types";

const now = new Date("2026-04-08T08:00:00.000Z");

export const demoCredentials: DemoUserCredential[] = [
  {
    email: "admin@futurerealm.sms",
    password: "FutureRealm123!",
    role: "SUPER_ADMIN",
    name: "Amina Okonkwo"
  },
  {
    email: "principal@greenfieldcollege.ng",
    password: "FutureRealm123!",
    role: "PRINCIPAL",
    name: "Tunde Adeyemi"
  },
  {
    email: "vp.academics@greenfieldcollege.ng",
    password: "FutureRealm123!",
    role: "VICE_PRINCIPAL_ACADEMICS",
    name: "Olamide Fashola"
  },
  {
    email: "exam.officer@greenfieldcollege.ng",
    password: "FutureRealm123!",
    role: "EXAM_OFFICER",
    name: "Chinedu Nwankwo"
  },
  {
    email: "hod.science@greenfieldcollege.ng",
    password: "FutureRealm123!",
    role: "HEAD_OF_DEPARTMENT",
    name: "Rukayat Adeleke"
  },
  {
    email: "proprietor@greenfieldcollege.ng",
    password: "FutureRealm123!",
    role: "PROPRIETOR",
    name: "Olubunmi Akinyele"
  },
  {
    email: "administrator@greenfieldcollege.ng",
    password: "FutureRealm123!",
    role: "ADMINISTRATOR",
    name: "Segun Olatunji"
  },
  {
    email: "head.teacher@greenfieldcollege.ng",
    password: "FutureRealm123!",
    role: "HEAD_TEACHER",
    name: "Blessing Udo"
  },
  {
    email: "vp.admin@greenfieldcollege.ng",
    password: "FutureRealm123!",
    role: "VICE_PRINCIPAL_ADMINISTRATION",
    name: "Morenike Sanni"
  },
  {
    email: "vp.special@greenfieldcollege.ng",
    password: "FutureRealm123!",
    role: "VICE_PRINCIPAL_SPECIAL_DUTIES",
    name: "Uche Ezeani"
  },
  {
    email: "admin.officer@greenfieldcollege.ng",
    password: "FutureRealm123!",
    role: "ADMIN_OFFICER",
    name: "Musa Bello"
  },
  {
    email: "admissions@greenfieldcollege.ng",
    password: "FutureRealm123!",
    role: "ADMISSIONS_OFFICER",
    name: "Adaeze Okoro"
  },
  {
    email: "teacher@greenfieldcollege.ng",
    password: "FutureRealm123!",
    role: "TEACHER",
    name: "Boma Hart"
  },
  {
    email: "teacher.primary@greenfieldcollege.ng",
    password: "FutureRealm123!",
    role: "TEACHER",
    name: "Sade Bello"
  },
  {
    email: "teacher.english@greenfieldcollege.ng",
    password: "FutureRealm123!",
    role: "TEACHER",
    name: "Kemi Afolayan"
  },
  {
    email: "class.teacher@greenfieldcollege.ng",
    password: "FutureRealm123!",
    role: "CLASS_TEACHER",
    name: "Aisha Bamidele"
  },
  {
    email: "subject.teacher@greenfieldcollege.ng",
    password: "FutureRealm123!",
    role: "SUBJECT_TEACHER",
    name: "Paul Onyeka"
  },
  {
    email: "bursar@greenfieldcollege.ng",
    password: "FutureRealm123!",
    role: "ACCOUNTANT",
    name: "Ngozi Eze"
  },
  {
    email: "parent@greenfieldcollege.ng",
    password: "FutureRealm123!",
    role: "PARENT",
    name: "Funke Yusuf"
  },
  {
    email: "chinelo.obi@greenfieldcollege.ng",
    password: "FutureRealm123!",
    role: "PARENT",
    name: "Chinelo Obi"
  },
  {
    email: "salisu.mohammed@greenfieldcollege.ng",
    password: "FutureRealm123!",
    role: "PARENT",
    name: "Salisu Mohammed"
  },
  {
    email: "student@greenfieldcollege.ng",
    password: "FutureRealm123!",
    role: "STUDENT",
    name: "Daniel Yusuf"
  },
  {
    email: "maryam.yusuf@greenfieldcollege.ng",
    password: "FutureRealm123!",
    role: "STUDENT",
    name: "Maryam Yusuf"
  },
  {
    email: "amarachi.obi@greenfieldcollege.ng",
    password: "FutureRealm123!",
    role: "STUDENT",
    name: "Amarachi Obi"
  },
  {
    email: "ibrahim.salisu@greenfieldcollege.ng",
    password: "FutureRealm123!",
    role: "STUDENT",
    name: "Ibrahim Salisu"
  },
  {
    email: "esther.adewale@greenfieldcollege.ng",
    password: "FutureRealm123!",
    role: "STUDENT",
    name: "Esther Adewale"
  }
];

export const demoDashboardSummary: DashboardSummary = {
  schoolName: "Greenfield College, Ibadan",
  schoolId: "school_greenfield",
  currentSession: "2025/2026",
  currentTerm: "Second Term",
  metrics: [
    { label: "Enrollment", value: "1,284", change: "+8.4% vs last term" },
    { label: "Attendance Today", value: "93.8%", change: "+1.9% this week" },
    { label: "Fees Collected", value: "NGN 38.2m", change: "+12.1% this term" },
    { label: "Admissions Pipeline", value: "146", change: "24 pending review" }
  ],
  attendanceTrend: [
    { day: "Mon", rate: 92 },
    { day: "Tue", rate: 94 },
    { day: "Wed", rate: 95 },
    { day: "Thu", rate: 93 },
    { day: "Fri", rate: 94 }
  ],
  feeTrend: [
    { month: "Jan", collected: 8.4, outstanding: 2.8 },
    { month: "Feb", collected: 9.2, outstanding: 2.1 },
    { month: "Mar", collected: 11.1, outstanding: 1.8 },
    { month: "Apr", collected: 9.5, outstanding: 1.4 }
  ],
  enrollmentTrend: [
    { label: "Nursery", count: 142 },
    { label: "Primary", count: 516 },
    { label: "JSS", count: 402 },
    { label: "SSS", count: 224 }
  ],
  admissionsByStage: [
    { stage: "Submitted", count: 61 },
    { stage: "Reviewing", count: 24 },
    { stage: "Approved", count: 49 },
    { stage: "Waitlisted", count: 8 },
    { stage: "Rejected", count: 4 }
  ],
  roleWidgets: [
    { label: "Classes", value: "13", change: "Configured Nigerian classes and arms" },
    { label: "Subjects", value: "56", change: "Active Nigerian curriculum subjects" },
    { label: "Pending approvals", value: "3", change: "Broadsheets awaiting moderation" },
    { label: "Published results", value: "42", change: "Visible to student and parent portals" },
    { label: "Staff", value: "86", change: "Academic and non-academic staff" },
    { label: "Recent payments", value: "NGN 1.6m", change: "Recorded this week" },
    { label: "Operational reviews", value: "18", change: "Admissions, leave, and finance review" }
  ],
  quickActions: [
    { label: "Review admissions", href: "/admissions", description: "Open submitted and recommended applications." },
    { label: "Mark attendance", href: "/attendance", description: "Record daily class attendance." },
    { label: "Create invoice", href: "/finance", description: "Issue a student fee invoice." },
    { label: "Publish announcement", href: "/communications", description: "Send a school or class notice." }
  ],
  pendingActions: [
    { id: "pending-adm", title: "24 applications under review", detail: "Admissions Officer should complete document checks.", href: "/admissions", tone: "warning" },
    { id: "pending-fee", title: "56 overdue invoices", detail: "Bursar follow-up required for second term balances.", href: "/finance/reports", tone: "danger" },
    { id: "pending-results", title: "4 classes await principal comments", detail: "Results can be published after review.", href: "/academics/results", tone: "neutral" }
  ],
  upcomingExams: [
    { id: "exam-1", title: "Mathematics mock exam", detail: "JSS 2 - Gold · Hall A", startsAt: "2026-04-22T09:00:00.000Z", href: "/academics/results" }
  ],
  recentPayments: [
    { id: "pay-1", reference: "PAY-2026-001", studentName: "Daniel Yusuf", amount: 160000, status: "SUCCESS", paidAt: "2026-04-03T09:00:00.000Z" }
  ],
  recentAnnouncements: [
    { id: "ann-dashboard-1", title: "Inter-house sports reminder", detail: "Parents should send house jerseys.", publishedAt: "2026-04-10T09:00:00.000Z", href: "/communications" }
  ],
  recentActivity: [
    { id: "act-1", title: "Admission offer issued", detail: "Samuel Balogun moved to offer stage.", time: "2 hours ago", category: "admissions" },
    { id: "act-2", title: "Payment recorded", detail: "PAY-2026-001 was verified by bursary.", time: "1 day ago", category: "finance" }
  ],
  alerts: [
    {
      id: "alert-fees",
      title: "56 parents still owe transport balances",
      detail: "Fee reminders are scheduled for 4:00 PM.",
      tone: "warning"
    },
    {
      id: "alert-attendance",
      title: "JS2 Gold has 6 absences today",
      detail: "Attendance alerts were sent by SMS and in-app notification.",
      tone: "danger"
    },
    {
      id: "alert-results",
      title: "Second term report cards are 82% complete",
      detail: "4 classes still need principal comments before publishing.",
      tone: "neutral"
    }
  ]
};

export const demoAdmissions: AdmissionApplicationView[] = [
  {
    id: "adm_1",
    applicationNo: "ADM-2026-0012",
    studentName: "Samuel Balogun",
    firstName: "Samuel",
    lastName: "Balogun",
    gender: "MALE",
    dateOfBirth: "2014-03-02T00:00:00.000Z",
    guardianName: "Kemi Balogun",
    guardianPhone: "08034567890",
    guardianEmail: "kemi.balogun@example.com",
    address: "12 Aleshinloye Street, Ibadan",
    previousSchool: "Bright Stars Primary School",
    desiredClass: "JSS 1 - Gold",
    status: "SCREENING_SCHEDULED",
    submittedAt: subDays(now, 4).toISOString(),
    applicationFeeStatus: "VERIFIED",
    reviewNotes: "Documents complete. Entrance assessment is suitable for JSS 1 Gold.",
    reviewedBy: "Admissions Officer",
    reviewedAt: subDays(now, 3).toISOString(),
    latestScreening: {
      id: "screen_1",
      interviewerName: "Tunde Adeyemi",
      scheduledAt: addDays(now, 2).toISOString(),
      venue: "ICT Lab",
      maxScore: 100
    },
    timeline: [
      {
        id: "adm_hist_1",
        fromStatus: "PAYMENT_PENDING",
        toStatus: "SCREENING_SCHEDULED",
        changedBy: "Adaeze Okoro",
        note: "Screening scheduled after application fee verification.",
        createdAt: subDays(now, 2).toISOString()
      },
      {
        id: "adm_hist_2",
        fromStatus: "SUBMITTED",
        toStatus: "REVIEWING",
        changedBy: "Adaeze Okoro",
        note: "Guardian details, documents, and class fit checked.",
        createdAt: subDays(now, 3).toISOString()
      }
    ]
  },
  {
    id: "adm_2",
    applicationNo: "ADM-2026-0013",
    studentName: "Miriam Yusuf",
    firstName: "Miriam",
    lastName: "Yusuf",
    gender: "FEMALE",
    dateOfBirth: "2015-05-10T00:00:00.000Z",
    guardianName: "Aisha Yusuf",
    guardianPhone: "08021239876",
    guardianEmail: "aisha.yusuf@example.com",
    address: "Agodi GRA, Ibadan",
    previousSchool: "Al-Falah Primary School",
    desiredClass: "Primary 5 - Blue",
    status: "OFFER_SENT",
    submittedAt: subDays(now, 8).toISOString(),
    applicationFeeStatus: "WAIVED",
    feeWaived: true,
    reviewNotes: "Transfer record and guardian details verified.",
    reviewedBy: "Admissions Officer",
    reviewedAt: subDays(now, 7).toISOString(),
    decisionNotes: "Approved for Primary 5 Blue after screening.",
    decidedAt: subDays(now, 6).toISOString(),
    offerStatus: "SENT",
    offerExpiresAt: addDays(now, 8).toISOString(),
    latestScreening: {
      id: "screen_2",
      interviewerName: "Folake Eze",
      scheduledAt: subDays(now, 6).toISOString(),
      venue: "Primary Block",
      score: 76,
      maxScore: 100,
      result: "PASS",
      recommendation: "Recommend for admission",
      remarks: "Good transfer record and class readiness.",
      completedAt: subDays(now, 6).toISOString()
    },
    timeline: [
      {
        id: "adm_hist_3",
        fromStatus: "APPROVED",
        toStatus: "OFFER_SENT",
        changedBy: "Adaeze Okoro",
        note: "Admission offer sent to guardian.",
        createdAt: subDays(now, 5).toISOString()
      },
      {
        id: "adm_hist_4",
        fromStatus: "RECOMMENDED",
        toStatus: "APPROVED",
        changedBy: "Dr. Chinedu Okafor",
        note: "Approved after academic screening.",
        createdAt: subDays(now, 6).toISOString()
      }
    ]
  },
  {
    id: "adm_3",
    applicationNo: "ADM-2026-0014",
    studentName: "Chidera Nwosu",
    firstName: "Chidera",
    lastName: "Nwosu",
    gender: "MALE",
    dateOfBirth: "2010-09-19T00:00:00.000Z",
    guardianName: "Ikechukwu Nwosu",
    guardianPhone: "07062223311",
    guardianEmail: "ikechukwu.nwosu@example.com",
    desiredClass: "SS 1 - Emerald",
    status: "SUBMITTED",
    submittedAt: subDays(now, 1).toISOString(),
    applicationFeeStatus: "PENDING",
    timeline: [
      {
        id: "adm_hist_5",
        toStatus: "SUBMITTED",
        note: "Application submitted by guardian.",
        createdAt: subDays(now, 1).toISOString()
      }
    ]
  },
  {
    id: "adm_4",
    applicationNo: "ADM-2026-0015",
    studentName: "Zainab Lawal",
    firstName: "Zainab",
    lastName: "Lawal",
    gender: "FEMALE",
    dateOfBirth: "2012-11-04T00:00:00.000Z",
    guardianName: "Bashir Lawal",
    guardianPhone: "08104556677",
    guardianEmail: "bashir.lawal@example.com",
    desiredClass: "JSS 2 - Gold",
    status: "RECOMMENDED",
    submittedAt: subDays(now, 10).toISOString(),
    applicationFeeStatus: "VERIFIED",
    reviewNotes: "Entrance screening completed and class transfer record verified.",
    reviewedBy: "Admissions Officer",
    reviewedAt: subDays(now, 8).toISOString(),
    latestScreening: {
      id: "screen_4",
      interviewerName: "Tunde Adeyemi",
      scheduledAt: subDays(now, 7).toISOString(),
      venue: "Science Lab",
      score: 88,
      maxScore: 100,
      result: "PASS",
      recommendation: "Strong recommend",
      remarks: "Excellent mathematics readiness.",
      completedAt: subDays(now, 7).toISOString()
    },
    timeline: [
      {
        id: "adm_hist_6",
        fromStatus: "SCREENING_COMPLETED",
        toStatus: "RECOMMENDED",
        changedBy: "Adaeze Okoro",
        note: "Recommended for principal approval.",
        createdAt: subDays(now, 6).toISOString()
      }
    ]
  },
  {
    id: "adm_5",
    applicationNo: "ADM-2026-0016",
    studentName: "David Eze",
    firstName: "David",
    lastName: "Eze",
    gender: "MALE",
    dateOfBirth: "2013-07-16T00:00:00.000Z",
    guardianName: "Ngozi Eze",
    guardianPhone: "08098765432",
    guardianEmail: "ngozi.eze@example.com",
    desiredClass: "JSS 1 - Silver",
    status: "FINANCIALLY_CLEARED",
    submittedAt: subDays(now, 14).toISOString(),
    applicationFeeStatus: "VERIFIED",
    reviewedBy: "Admissions Officer",
    reviewedAt: subDays(now, 12).toISOString(),
    decisionNotes: "Approved and accepted. Deposit verified by bursary.",
    decidedAt: subDays(now, 9).toISOString(),
    offerStatus: "ACCEPTED",
    offerExpiresAt: addDays(now, 2).toISOString(),
    acceptedAt: subDays(now, 5).toISOString(),
    timeline: [
      {
        id: "adm_hist_7",
        fromStatus: "ACCEPTED",
        toStatus: "FINANCIALLY_CLEARED",
        changedBy: "Bola Martins",
        note: "Acceptance deposit confirmed.",
        createdAt: subDays(now, 3).toISOString()
      }
    ]
  }
];

export const demoStudents: StudentRecordView[] = [
  {
    id: "stu_1",
    admissionNumber: "GFC/25/0001",
    fullName: "Daniel Yusuf",
    className: "JSS 2 - Gold",
    guardianName: "Funke Yusuf",
    status: "ACTIVE",
    attendanceRate: 94.2,
    averageScore: 78.6,
    outstandingBalance: 125000
  },
  {
    id: "stu_2",
    admissionNumber: "GFC/25/0002",
    fullName: "Amarachi Obi",
    className: "SS 1 - Emerald",
    guardianName: "Chinelo Obi",
    status: "ACTIVE",
    attendanceRate: 96.1,
    averageScore: 84.5,
    outstandingBalance: 0
  },
  {
    id: "stu_3",
    admissionNumber: "GFC/25/0003",
    fullName: "Ibrahim Salisu",
    className: "Primary 6 - Coral",
    guardianName: "Salisu Mohammed",
    status: "ACTIVE",
    attendanceRate: 88.4,
    averageScore: 69.1,
    outstandingBalance: 45000
  },
  {
    id: "stu_4",
    admissionNumber: "GFC/25/0004",
    fullName: "Maryam Yusuf",
    className: "Primary 4 - Blue",
    guardianName: "Funke Yusuf",
    status: "ACTIVE",
    attendanceRate: 97.4,
    averageScore: 82.3,
    outstandingBalance: 0
  },
  {
    id: "stu_5",
    admissionNumber: "GFC/25/0005",
    fullName: "Esther Adewale",
    className: "JSS 1 - Silver",
    guardianName: "Adesola Adewale",
    status: "ACTIVE",
    attendanceRate: 91.8,
    averageScore: 75.4,
    outstandingBalance: 30000
  },
  {
    id: "stu_6",
    admissionNumber: "GFC/25/0006",
    fullName: "Chisom Okeke",
    className: "SS 2 - Topaz",
    guardianName: "Ifeoma Okeke",
    status: "ACTIVE",
    attendanceRate: 95.6,
    averageScore: 88.2,
    outstandingBalance: 0
  }
];

const demoStudentMedical: Record<string, StudentMedicalView> = {
  stu_1: {
    bloodGroup: "O+",
    genotype: "AA",
    allergies: "Dust",
    conditions: "Nil",
    notes: "Guardian prefers phone call for health incidents."
  },
  stu_2: {
    bloodGroup: "A+",
    genotype: "AS",
    allergies: "Peanuts",
    conditions: "Carries inhaler during sports."
  },
  stu_3: {
    bloodGroup: "B+",
    genotype: "AA",
    allergies: "None reported",
    conditions: "Recently treated for malaria"
  },
  stu_4: {
    bloodGroup: "O+",
    genotype: "AA",
    allergies: "None reported",
    conditions: "Nil"
  },
  stu_5: {
    bloodGroup: "AB+",
    genotype: "AS",
    allergies: "Penicillin",
    conditions: "Keep emergency contact on standby for medications."
  },
  stu_6: {
    bloodGroup: "A-",
    genotype: "AA",
    allergies: "None reported",
    conditions: "Nil"
  }
};

const demoStudentDocuments: Record<string, StudentDocumentView[]> = {
  stu_1: [
    {
      id: "doc_1",
      label: "Birth certificate",
      fileName: "daniel-yusuf-birth-certificate.pdf",
      createdAt: subDays(now, 180).toISOString()
    },
    {
      id: "doc_2",
      label: "Passport photograph",
      fileName: "daniel-yusuf-photo.jpg",
      createdAt: subDays(now, 170).toISOString()
    }
  ],
  stu_2: [
    {
      id: "doc_3",
      label: "Transfer letter",
      fileName: "amarachi-obi-transfer-letter.pdf",
      createdAt: subDays(now, 210).toISOString()
    }
  ],
  stu_3: [
    {
      id: "doc_4",
      label: "Immunization card",
      fileName: "ibrahim-salisu-immunization-card.pdf",
      createdAt: subDays(now, 120).toISOString()
    }
  ],
  stu_4: [
    {
      id: "doc_5",
      label: "Birth certificate",
      fileName: "maryam-yusuf-birth-certificate.pdf",
      createdAt: subDays(now, 160).toISOString()
    }
  ],
  stu_5: [
    {
      id: "doc_6",
      label: "Medical waiver",
      fileName: "esther-adewale-medical-waiver.pdf",
      createdAt: subDays(now, 90).toISOString()
    }
  ],
  stu_6: [
    {
      id: "doc_7",
      label: "Passport photograph",
      fileName: "chisom-okeke-photo.jpg",
      createdAt: subDays(now, 60).toISOString()
    }
  ]
};

const demoStudentBehaviorLogs: Record<string, StudentBehaviorLogView[]> = {
  stu_1: [
    {
      id: "beh_1",
      category: "Merit",
      description: "Volunteered to support the library reading club setup.",
      severity: "LOW",
      loggedAt: subDays(now, 6).toISOString()
    }
  ],
  stu_2: [
    {
      id: "beh_2",
      category: "Health / pastoral",
      description: "Reported shortness of breath during athletics; nurse and guardian were notified.",
      severity: "MEDIUM",
      loggedAt: subDays(now, 3).toISOString()
    }
  ],
  stu_3: [
    {
      id: "beh_3",
      category: "Attendance follow-up",
      description: "Class teacher logged repeated lateness due to transport route delay.",
      severity: "MEDIUM",
      loggedAt: subDays(now, 2).toISOString()
    }
  ],
  stu_4: [
    {
      id: "beh_4",
      category: "Merit",
      description: "Outstanding reading fluency improvement during literacy week.",
      severity: "LOW",
      loggedAt: subDays(now, 5).toISOString()
    }
  ],
  stu_5: [
    {
      id: "beh_5",
      category: "Pastoral",
      description: "Follow-up note after repeated late homework submission.",
      severity: "MEDIUM",
      loggedAt: subDays(now, 4).toISOString()
    }
  ],
  stu_6: [
    {
      id: "beh_6",
      category: "Merit",
      description: "Led the SS2 debate prep team and supported junior learners.",
      severity: "LOW",
      loggedAt: subDays(now, 7).toISOString()
    }
  ]
};

const demoStudentPromotions: Record<string, StudentPromotionView[]> = {
  stu_1: [
    {
      id: "prom_1",
      decision: "Promoted after first term review",
      fromClassName: "JSS 1 - Gold",
      toClassName: "JSS 2 - Gold",
      fromSessionName: "2024/2025",
      toSessionName: "2025/2026",
      promotedAt: subDays(now, 90).toISOString()
    }
  ],
  stu_2: [
    {
      id: "prom_2",
      decision: "Admitted into science stream",
      fromClassName: "JSS 3 - Emerald",
      toClassName: "SS 1 - Emerald",
      fromSessionName: "2024/2025",
      toSessionName: "2025/2026",
      promotedAt: subDays(now, 110).toISOString()
    }
  ],
  stu_3: [
    {
      id: "prom_3",
      decision: "Promoted with literacy intervention note",
      fromClassName: "Primary 5 - Coral",
      toClassName: "Primary 6 - Coral",
      fromSessionName: "2024/2025",
      toSessionName: "2025/2026",
      promotedAt: subDays(now, 96).toISOString()
    }
  ],
  stu_4: [
    {
      id: "prom_4",
      decision: "Promoted after first year placement review",
      fromClassName: "Primary 3 - Blue",
      toClassName: "Primary 4 - Blue",
      fromSessionName: "2024/2025",
      toSessionName: "2025/2026",
      promotedAt: subDays(now, 98).toISOString()
    }
  ],
  stu_5: [
    {
      id: "prom_5",
      decision: "New admission onboarded into junior secondary",
      toClassName: "JSS 1 - Silver",
      toSessionName: "2025/2026",
      promotedAt: subDays(now, 70).toISOString()
    }
  ],
  stu_6: [
    {
      id: "prom_6",
      decision: "Promoted on distinction list",
      fromClassName: "SS 1 - Topaz",
      toClassName: "SS 2 - Topaz",
      fromSessionName: "2024/2025",
      toSessionName: "2025/2026",
      promotedAt: subDays(now, 95).toISOString()
    }
  ]
};

export const demoStudentProfiles: StudentProfileView[] = [
  {
    id: "stu_1",
    admissionNumber: "GFC/25/0001",
    fullName: "Daniel Yusuf",
    className: "JSS 2 - Gold",
    guardianName: "Funke Yusuf",
    guardianPhone: "08030000000",
    guardianEmail: "funke.yusuf@example.com",
    status: "ACTIVE",
    gender: "MALE",
    dateOfBirth: "2012-06-18T00:00:00.000Z",
    admissionDate: "2025-09-08T00:00:00.000Z",
    nationality: "Nigerian",
    stateOfOrigin: "Oyo",
    religion: "Christianity",
    attendanceRate: 94.2,
    averageScore: 78.6,
    outstandingBalance: 125000,
    riskFlags: ["Outstanding fee balance"],
    medical: demoStudentMedical.stu_1,
    documents: demoStudentDocuments.stu_1,
    behaviorLogs: demoStudentBehaviorLogs.stu_1,
    promotions: demoStudentPromotions.stu_1
  },
  {
    id: "stu_2",
    admissionNumber: "GFC/25/0002",
    fullName: "Amarachi Obi",
    className: "SS 1 - Emerald",
    guardianName: "Chinelo Obi",
    guardianPhone: "08031112223",
    guardianEmail: "chinelo.obi@example.com",
    status: "ACTIVE",
    gender: "FEMALE",
    dateOfBirth: "2010-11-03T00:00:00.000Z",
    admissionDate: "2025-09-08T00:00:00.000Z",
    nationality: "Nigerian",
    stateOfOrigin: "Anambra",
    religion: "Christianity",
    attendanceRate: 96.1,
    averageScore: 84.5,
    outstandingBalance: 0,
    riskFlags: [],
    medical: demoStudentMedical.stu_2,
    documents: demoStudentDocuments.stu_2,
    behaviorLogs: demoStudentBehaviorLogs.stu_2,
    promotions: demoStudentPromotions.stu_2
  },
  {
    id: "stu_3",
    admissionNumber: "GFC/25/0003",
    fullName: "Ibrahim Salisu",
    className: "Primary 6 - Coral",
    guardianName: "Salisu Mohammed",
    guardianPhone: "08032223334",
    guardianEmail: "salisu.mohammed@example.com",
    status: "ACTIVE",
    gender: "MALE",
    dateOfBirth: "2013-01-22T00:00:00.000Z",
    admissionDate: "2025-09-08T00:00:00.000Z",
    nationality: "Nigerian",
    stateOfOrigin: "Kano",
    religion: "Islam",
    attendanceRate: 88.4,
    averageScore: 69.1,
    outstandingBalance: 45000,
    riskFlags: ["Low attendance", "Outstanding fee balance"],
    medical: demoStudentMedical.stu_3,
    documents: demoStudentDocuments.stu_3,
    behaviorLogs: demoStudentBehaviorLogs.stu_3,
    promotions: demoStudentPromotions.stu_3
  },
  {
    id: "stu_4",
    admissionNumber: "GFC/25/0004",
    fullName: "Maryam Yusuf",
    className: "Primary 4 - Blue",
    guardianName: "Funke Yusuf",
    guardianPhone: "08030000000",
    guardianEmail: "parent@greenfieldcollege.ng",
    status: "ACTIVE",
    gender: "FEMALE",
    dateOfBirth: "2015-02-11T00:00:00.000Z",
    admissionDate: "2025-09-08T00:00:00.000Z",
    nationality: "Nigerian",
    stateOfOrigin: "Oyo",
    religion: "Christianity",
    attendanceRate: 97.4,
    averageScore: 82.3,
    outstandingBalance: 0,
    riskFlags: [],
    medical: demoStudentMedical.stu_4,
    documents: demoStudentDocuments.stu_4,
    behaviorLogs: demoStudentBehaviorLogs.stu_4,
    promotions: demoStudentPromotions.stu_4
  },
  {
    id: "stu_5",
    admissionNumber: "GFC/25/0005",
    fullName: "Esther Adewale",
    className: "JSS 1 - Silver",
    guardianName: "Adesola Adewale",
    guardianPhone: "08034445566",
    guardianEmail: "adesola.adewale@example.com",
    status: "ACTIVE",
    gender: "FEMALE",
    dateOfBirth: "2013-07-19T00:00:00.000Z",
    admissionDate: "2025-09-08T00:00:00.000Z",
    nationality: "Nigerian",
    stateOfOrigin: "Lagos",
    religion: "Christianity",
    attendanceRate: 91.8,
    averageScore: 75.4,
    outstandingBalance: 30000,
    riskFlags: ["Outstanding fee balance"],
    medical: demoStudentMedical.stu_5,
    documents: demoStudentDocuments.stu_5,
    behaviorLogs: demoStudentBehaviorLogs.stu_5,
    promotions: demoStudentPromotions.stu_5
  },
  {
    id: "stu_6",
    admissionNumber: "GFC/25/0006",
    fullName: "Chisom Okeke",
    className: "SS 2 - Topaz",
    guardianName: "Ifeoma Okeke",
    guardianPhone: "08037778899",
    guardianEmail: "ifeoma.okeke@example.com",
    status: "ACTIVE",
    gender: "FEMALE",
    dateOfBirth: "2010-03-05T00:00:00.000Z",
    admissionDate: "2025-09-08T00:00:00.000Z",
    nationality: "Nigerian",
    stateOfOrigin: "Imo",
    religion: "Christianity",
    attendanceRate: 95.6,
    averageScore: 88.2,
    outstandingBalance: 0,
    riskFlags: [],
    medical: demoStudentMedical.stu_6,
    documents: demoStudentDocuments.stu_6,
    behaviorLogs: demoStudentBehaviorLogs.stu_6,
    promotions: demoStudentPromotions.stu_6
  }
];

export const demoAttendance: AttendanceRecordView[] = [
  {
    id: "att_1",
    studentId: "stu_1",
    studentName: "Daniel Yusuf",
    className: "JSS 2 - Gold",
    subject: "Mathematics",
    status: "PRESENT",
    date: now.toISOString()
  },
  {
    id: "att_2",
    studentId: "stu_2",
    studentName: "Amarachi Obi",
    className: "SS 1 - Emerald",
    subject: "English Language",
    status: "LATE",
    reason: "Bus delay",
    date: now.toISOString()
  },
  {
    id: "att_3",
    studentId: "stu_3",
    studentName: "Ibrahim Salisu",
    className: "Primary 6 - Coral",
    subject: "Basic Science",
    status: "ABSENT",
    reason: "Reported ill by parent",
    date: now.toISOString()
  }
];

export const demoGrades: GradeRecordView[] = [
  {
    id: "grade_1",
    studentId: "stu_1",
    studentName: "Daniel Yusuf",
    className: "JSS 2 - Gold",
    subject: "Mathematics",
    continuousAssessment: 28,
    exam: 46,
    total: 74,
    grade: "B2",
    position: 4
  },
  {
    id: "grade_2",
    studentId: "stu_2",
    studentName: "Amarachi Obi",
    className: "SS 1 - Emerald",
    subject: "Biology",
    continuousAssessment: 29,
    exam: 52,
    total: 81,
    grade: "A1",
    position: 2
  },
  {
    id: "grade_3",
    studentId: "stu_3",
    studentName: "Ibrahim Salisu",
    className: "Primary 6 - Coral",
    subject: "Basic Science",
    continuousAssessment: 23,
    exam: 38,
    total: 61,
    grade: "C4"
  }
];

export const demoInvoices: InvoiceView[] = [
  {
    id: "inv_1",
    invoiceNumber: "INV-2026-001",
    studentName: "Daniel Yusuf",
    className: "JSS 2 - Gold",
    total: 285000,
    balance: 125000,
    status: "PARTIALLY_PAID",
    dueOn: addDays(now, 6).toISOString()
  },
  {
    id: "inv_2",
    invoiceNumber: "INV-2026-002",
    studentName: "Amarachi Obi",
    className: "SS 1 - Emerald",
    total: 335000,
    balance: 0,
    status: "PAID",
    dueOn: subDays(now, 10).toISOString()
  },
  {
    id: "inv_3",
    invoiceNumber: "INV-2026-003",
    studentName: "Ibrahim Salisu",
    className: "Primary 6 - Coral",
    total: 210000,
    balance: 45000,
    status: "PARTIALLY_PAID",
    dueOn: addDays(now, 2).toISOString()
  }
];

export const demoAnnouncements: AnnouncementView[] = [
  {
    id: "ann_1",
    title: "Second term inter-house sports holds on April 18",
    body: "Parents should ensure students come in house jerseys and water bottles.",
    audience: "School-wide",
    channel: "IN_APP",
    publishedAt: subDays(now, 2).toISOString()
  },
  {
    id: "ann_2",
    title: "Fee deadline reminder for transport families",
    body: "Transport balances should be cleared before Friday to avoid route suspension.",
    audience: "Parents",
    channel: "SMS",
    publishedAt: subDays(now, 1).toISOString()
  }
];

const timetableByStudent: Record<string, PortalTimetableEntry[]> = {
  stu_1: [
    { id: "tt_1", day: "Monday", time: "8:00 - 8:40", subject: "Mathematics", venue: "Room 7", teacherName: "Boma Hart", className: "JSS 2 - Gold" },
    { id: "tt_2", day: "Tuesday", time: "10:20 - 11:00", subject: "English Language", venue: "Room 7", teacherName: "Kemi Afolayan", className: "JSS 2 - Gold" },
    { id: "tt_3", day: "Wednesday", time: "9:20 - 10:00", subject: "Basic Science", venue: "Lab 1", teacherName: "Boma Hart", className: "JSS 2 - Gold" },
    { id: "tt_4", day: "Thursday", time: "11:40 - 12:20", subject: "Social Studies", venue: "Room 7", teacherName: "Sade Bello", className: "JSS 2 - Gold" },
    { id: "tt_5", day: "Friday", time: "8:40 - 9:20", subject: "Civic Education", venue: "Room 7", teacherName: "Kemi Afolayan", className: "JSS 2 - Gold" }
  ],
  stu_2: [
    { id: "tt_6", day: "Monday", time: "8:40 - 9:20", subject: "Biology", venue: "Science Lab", teacherName: "Boma Hart", className: "SS 1 - Emerald" },
    { id: "tt_7", day: "Tuesday", time: "11:00 - 11:40", subject: "Chemistry", venue: "Science Lab", teacherName: "Boma Hart", className: "SS 1 - Emerald" },
    { id: "tt_8", day: "Wednesday", time: "9:20 - 10:00", subject: "English Language", venue: "Room 12", teacherName: "Kemi Afolayan", className: "SS 1 - Emerald" },
    { id: "tt_9", day: "Thursday", time: "12:20 - 1:00", subject: "Mathematics", venue: "Room 12", teacherName: "Boma Hart", className: "SS 1 - Emerald" },
    { id: "tt_10", day: "Friday", time: "10:20 - 11:00", subject: "Agricultural Science", venue: "Field Block", teacherName: "Sade Bello", className: "SS 1 - Emerald" }
  ],
  stu_3: [
    { id: "tt_11", day: "Monday", time: "8:00 - 8:40", subject: "Basic Science", venue: "Primary Block", teacherName: "Sade Bello", className: "Primary 6 - Coral" },
    { id: "tt_12", day: "Tuesday", time: "10:20 - 11:00", subject: "Mathematics", venue: "Primary Block", teacherName: "Sade Bello", className: "Primary 6 - Coral" },
    { id: "tt_13", day: "Wednesday", time: "9:20 - 10:00", subject: "English Studies", venue: "Primary Block", teacherName: "Kemi Afolayan", className: "Primary 6 - Coral" },
    { id: "tt_14", day: "Thursday", time: "11:40 - 12:20", subject: "Civic Education", venue: "Primary Block", teacherName: "Sade Bello", className: "Primary 6 - Coral" },
    { id: "tt_15", day: "Friday", time: "8:40 - 9:20", subject: "Home Economics", venue: "Primary Lab", teacherName: "Sade Bello", className: "Primary 6 - Coral" }
  ],
  stu_4: [
    { id: "tt_16", day: "Monday", time: "8:00 - 8:40", subject: "English Studies", venue: "Primary 4 Block", teacherName: "Sade Bello", className: "Primary 4 - Blue" },
    { id: "tt_17", day: "Tuesday", time: "9:20 - 10:00", subject: "Mathematics", venue: "Primary 4 Block", teacherName: "Sade Bello", className: "Primary 4 - Blue" },
    { id: "tt_18", day: "Wednesday", time: "10:20 - 11:00", subject: "Basic Science", venue: "Primary Lab", teacherName: "Sade Bello", className: "Primary 4 - Blue" },
    { id: "tt_19", day: "Thursday", time: "11:40 - 12:20", subject: "Verbal Reasoning", venue: "Primary 4 Block", teacherName: "Kemi Afolayan", className: "Primary 4 - Blue" },
    { id: "tt_20", day: "Friday", time: "8:40 - 9:20", subject: "Creative Arts", venue: "Arts Corner", teacherName: "Sade Bello", className: "Primary 4 - Blue" }
  ],
  stu_5: [
    { id: "tt_21", day: "Monday", time: "8:00 - 8:40", subject: "Mathematics", venue: "Room 5", teacherName: "Boma Hart", className: "JSS 1 - Silver" },
    { id: "tt_22", day: "Tuesday", time: "11:00 - 11:40", subject: "English Language", venue: "Room 5", teacherName: "Kemi Afolayan", className: "JSS 1 - Silver" },
    { id: "tt_23", day: "Wednesday", time: "9:20 - 10:00", subject: "Basic Technology", venue: "Tech Lab", teacherName: "Sade Bello", className: "JSS 1 - Silver" },
    { id: "tt_24", day: "Thursday", time: "10:20 - 11:00", subject: "Business Studies", venue: "Room 5", teacherName: "Kemi Afolayan", className: "JSS 1 - Silver" },
    { id: "tt_25", day: "Friday", time: "12:20 - 1:00", subject: "Basic Science", venue: "Lab 1", teacherName: "Boma Hart", className: "JSS 1 - Silver" }
  ],
  stu_6: [
    { id: "tt_26", day: "Monday", time: "8:40 - 9:20", subject: "Economics", venue: "Room 16", teacherName: "Kemi Afolayan", className: "SS 2 - Topaz" },
    { id: "tt_27", day: "Tuesday", time: "10:20 - 11:00", subject: "Government", venue: "Room 16", teacherName: "Kemi Afolayan", className: "SS 2 - Topaz" },
    { id: "tt_28", day: "Wednesday", time: "11:40 - 12:20", subject: "English Language", venue: "Room 16", teacherName: "Kemi Afolayan", className: "SS 2 - Topaz" },
    { id: "tt_29", day: "Thursday", time: "9:20 - 10:00", subject: "Literature", venue: "Room 16", teacherName: "Kemi Afolayan", className: "SS 2 - Topaz" },
    { id: "tt_30", day: "Friday", time: "10:20 - 11:00", subject: "Civic Education", venue: "Room 16", teacherName: "Kemi Afolayan", className: "SS 2 - Topaz" }
  ]
};

const resultHistoryByStudent: Record<string, PortalResultHistory[]> = {
  stu_1: [
    {
      id: "rh_1",
      session: "2025/2026",
      term: "Second Term",
      average: 78.6,
      grade: "B2",
      position: 4,
      publishedAt: subDays(now, 1).toISOString(),
      subjects: [
        { subject: "Mathematics", score: 74, grade: "B2" },
        { subject: "English Language", score: 79, grade: "B3" },
        { subject: "Basic Science", score: 83, grade: "A1" }
      ]
    },
    {
      id: "rh_2",
      session: "2025/2026",
      term: "First Term",
      average: 75.1,
      grade: "B3",
      position: 6,
      publishedAt: subDays(now, 80).toISOString(),
      subjects: [
        { subject: "Mathematics", score: 71, grade: "B3" },
        { subject: "English Language", score: 74, grade: "B2" },
        { subject: "Basic Science", score: 80, grade: "A1" }
      ]
    }
  ],
  stu_2: [
    {
      id: "rh_3",
      session: "2025/2026",
      term: "Second Term",
      average: 84.5,
      grade: "A1",
      position: 2,
      publishedAt: subDays(now, 1).toISOString(),
      subjects: [
        { subject: "Biology", score: 81, grade: "A1" },
        { subject: "Chemistry", score: 87, grade: "A1" },
        { subject: "English Language", score: 85, grade: "A1" }
      ]
    }
  ],
  stu_3: [
    {
      id: "rh_4",
      session: "2025/2026",
      term: "Second Term",
      average: 69.1,
      grade: "C4",
      position: 9,
      publishedAt: subDays(now, 1).toISOString(),
      subjects: [
        { subject: "Basic Science", score: 61, grade: "C4" },
        { subject: "Mathematics", score: 67, grade: "C5" },
        { subject: "English Studies", score: 79, grade: "B3" }
      ]
    }
  ],
  stu_4: [
    {
      id: "rh_5",
      session: "2025/2026",
      term: "Second Term",
      average: 82.3,
      grade: "A1",
      position: 3,
      publishedAt: subDays(now, 1).toISOString(),
      subjects: [
        { subject: "English Studies", score: 84, grade: "A1" },
        { subject: "Mathematics", score: 79, grade: "B2" },
        { subject: "Basic Science", score: 84, grade: "A1" }
      ]
    }
  ],
  stu_5: [
    {
      id: "rh_6",
      session: "2025/2026",
      term: "Second Term",
      average: 75.4,
      grade: "B3",
      position: 7,
      publishedAt: subDays(now, 1).toISOString(),
      subjects: [
        { subject: "Mathematics", score: 73, grade: "B3" },
        { subject: "English Language", score: 78, grade: "B2" },
        { subject: "Basic Science", score: 75, grade: "B3" }
      ]
    }
  ],
  stu_6: [
    {
      id: "rh_7",
      session: "2025/2026",
      term: "Second Term",
      average: 88.2,
      grade: "A1",
      position: 1,
      publishedAt: subDays(now, 1).toISOString(),
      subjects: [
        { subject: "Economics", score: 89, grade: "A1" },
        { subject: "Government", score: 86, grade: "A1" },
        { subject: "English Language", score: 90, grade: "A1" }
      ]
    }
  ]
};

const financeByStudent: Record<string, PortalFinanceItem[]> = {
  stu_1: [
    { id: "fin_1", title: "Second Term Fees", amount: 285000, balance: 125000, dueOn: addDays(now, 6).toISOString(), status: "PARTIALLY_PAID" }
  ],
  stu_2: [
    { id: "fin_2", title: "Second Term Fees", amount: 335000, balance: 0, dueOn: subDays(now, 10).toISOString(), status: "PAID" }
  ],
  stu_3: [
    { id: "fin_3", title: "Second Term Fees", amount: 210000, balance: 45000, dueOn: addDays(now, 2).toISOString(), status: "PARTIALLY_PAID" }
  ],
  stu_4: [
    { id: "fin_4", title: "Second Term Fees", amount: 180000, balance: 0, dueOn: subDays(now, 5).toISOString(), status: "PAID" }
  ],
  stu_5: [
    { id: "fin_5", title: "Second Term Fees", amount: 225000, balance: 30000, dueOn: addDays(now, 4).toISOString(), status: "PARTIALLY_PAID" }
  ],
  stu_6: [
    { id: "fin_6", title: "Second Term Fees", amount: 340000, balance: 0, dueOn: subDays(now, 12).toISOString(), status: "PAID" }
  ]
};

function getStudentProfileById(studentId: string) {
  const profile = demoStudentProfiles.find((item) => item.id === studentId);
  if (!profile) {
    throw new Error(`Unknown demo student: ${studentId}`);
  }

  return profile;
}

function buildParentChildView(studentId: string) {
  const profile = getStudentProfileById(studentId);
  return {
    studentId: profile.id,
    studentName: profile.fullName,
    className: profile.className,
    attendanceRate: profile.attendanceRate,
    averageScore: profile.averageScore,
    outstandingBalance: profile.outstandingBalance,
    nextClass: timetableByStudent[studentId]?.[0]
      ? `${timetableByStudent[studentId][0].subject} ${timetableByStudent[studentId][0].time}`
      : "No next class",
    weeklyTimetable: timetableByStudent[studentId] ?? [],
    resultHistory: resultHistoryByStudent[studentId] ?? [],
    finance: financeByStudent[studentId] ?? [],
    notes: profile.riskFlags.length > 0 ? profile.riskFlags : ["Stable student profile"]
  };
}

const parentPortalByEmail: Record<string, ParentPortalView> = {
  "parent@greenfieldcollege.ng": {
    parentName: "Funke Yusuf",
    headline: "Two children, two classes, one family view",
    familyStats: [
      { label: "Children", value: "2" },
      { label: "Outstanding", value: "NGN 125,000" },
      { label: "Next Event", value: "Sports Day Friday" }
    ],
    children: [buildParentChildView("stu_1"), buildParentChildView("stu_4")],
    announcements: [
      { id: "pa_1", title: "Daniel's report is available", detail: "Second term result sheet has been published for Daniel Yusuf.", time: "Yesterday" },
      { id: "pa_2", title: "Maryam's reading club merit", detail: "Primary 4 class teacher logged a merit note for Maryam Yusuf.", time: "2 days ago" },
      { id: "pa_3", title: "Family fee reminder", detail: "One outstanding balance remains for the Yusuf family this term.", time: "Today, 9:30 AM" }
    ]
  },
  "chinelo.obi@greenfieldcollege.ng": {
    parentName: "Chinelo Obi",
    headline: "Monitor Amarachi's progress and schedule",
    familyStats: [
      { label: "Children", value: "1" },
      { label: "Outstanding", value: "NGN 0" },
      { label: "Performance", value: "A1 trend" }
    ],
    children: [buildParentChildView("stu_2")],
    announcements: [
      { id: "pa_4", title: "Science practical reminder", detail: "SS 1 Emerald students should come with lab coats on Thursday.", time: "Today, 7:00 AM" }
    ]
  },
  "salisu.mohammed@greenfieldcollege.ng": {
    parentName: "Salisu Mohammed",
    headline: "Follow attendance, health notes, and fees",
    familyStats: [
      { label: "Children", value: "1" },
      { label: "Outstanding", value: "NGN 45,000" },
      { label: "Priority", value: "Attendance support" }
    ],
    children: [buildParentChildView("stu_3")],
    announcements: [
      { id: "pa_5", title: "Attendance follow-up", detail: "Primary 6 class teacher requested a guardian check-in about repeated lateness.", time: "Today, 8:20 AM" }
    ]
  }
};

const studentPortalByEmail: Record<string, StudentPortalView> = {
  "student@greenfieldcollege.ng": {
    studentId: "stu_1",
    admissionNumber: "GFC/25/0001",
    session: "2025/2026",
    term: "Second Term",
    studentName: "Daniel Yusuf",
    className: "JSS 2 - Gold",
    headline: "Track this week's classes, results, and balance",
    stats: [
      { label: "Average", value: "78.6%" },
      { label: "Attendance", value: "94.2%" },
      { label: "Outstanding", value: "NGN 125,000" }
    ],
    weeklyTimetable: timetableByStudent.stu_1,
    resultHistory: resultHistoryByStudent.stu_1,
    finance: financeByStudent.stu_1,
    announcements: [
      { id: "st_1", title: "Math revision class", detail: "Extra class holds Wednesday by 2:30 PM in Room 7.", time: "Today" },
      { id: "st_2", title: "Result update", detail: "Your second term report is now visible.", time: "Yesterday" }
    ]
  },
  "maryam.yusuf@greenfieldcollege.ng": {
    studentId: "stu_4",
    admissionNumber: "GFC/25/0004",
    session: "2025/2026",
    term: "Second Term",
    studentName: "Maryam Yusuf",
    className: "Primary 4 - Blue",
    headline: "See your weekly timetable and recent results",
    stats: [
      { label: "Average", value: "82.3%" },
      { label: "Attendance", value: "97.4%" },
      { label: "Outstanding", value: "NGN 0" }
    ],
    weeklyTimetable: timetableByStudent.stu_4,
    resultHistory: resultHistoryByStudent.stu_4,
    finance: financeByStudent.stu_4,
    announcements: [
      { id: "st_3", title: "Reading club merit", detail: "Your teacher added a merit note for literacy improvement.", time: "2 days ago" }
    ]
  },
  "amarachi.obi@greenfieldcollege.ng": {
    studentId: "stu_2",
    admissionNumber: "GFC/25/0002",
    session: "2025/2026",
    term: "Second Term",
    studentName: "Amarachi Obi",
    className: "SS 1 - Emerald",
    headline: "Stay on top of science subjects and report history",
    stats: [
      { label: "Average", value: "84.5%" },
      { label: "Attendance", value: "96.1%" },
      { label: "Outstanding", value: "NGN 0" }
    ],
    weeklyTimetable: timetableByStudent.stu_2,
    resultHistory: resultHistoryByStudent.stu_2,
    finance: financeByStudent.stu_2,
    announcements: [
      { id: "st_4", title: "Biology practical", detail: "Bring your lab coat for Thursday's practical session.", time: "Today" }
    ]
  },
  "ibrahim.salisu@greenfieldcollege.ng": {
    studentId: "stu_3",
    admissionNumber: "GFC/25/0003",
    session: "2025/2026",
    term: "Second Term",
    studentName: "Ibrahim Salisu",
    className: "Primary 6 - Coral",
    headline: "Keep an eye on attendance, class plan, and score history",
    stats: [
      { label: "Average", value: "69.1%" },
      { label: "Attendance", value: "88.4%" },
      { label: "Outstanding", value: "NGN 45,000" }
    ],
    weeklyTimetable: timetableByStudent.stu_3,
    resultHistory: resultHistoryByStudent.stu_3,
    finance: financeByStudent.stu_3,
    announcements: [
      { id: "st_5", title: "Attendance note", detail: "Please report to class teacher after morning devotion tomorrow.", time: "Today" }
    ]
  },
  "esther.adewale@greenfieldcollege.ng": {
    studentId: "stu_5",
    admissionNumber: "GFC/25/0005",
    session: "2025/2026",
    term: "Second Term",
    studentName: "Esther Adewale",
    className: "JSS 1 - Silver",
    headline: "Follow this week's classes and term progress",
    stats: [
      { label: "Average", value: "75.4%" },
      { label: "Attendance", value: "91.8%" },
      { label: "Outstanding", value: "NGN 30,000" }
    ],
    weeklyTimetable: timetableByStudent.stu_5,
    resultHistory: resultHistoryByStudent.stu_5,
    finance: financeByStudent.stu_5,
    announcements: [
      { id: "st_6", title: "Business Studies project", detail: "Project presentation moves to next Monday.", time: "Yesterday" }
    ]
  }
};

const teacherPortalByEmail: Record<string, TeacherPortalView> = {
  "teacher@greenfieldcollege.ng": {
    teacherName: "Boma Hart",
    headline: "Manage science and mathematics teaching load for the week",
    stats: [
      { label: "Classes This Week", value: "9" },
      { label: "Pending Scores", value: "18" },
      { label: "Attendance Sheets", value: "3 open" }
    ],
    weeklyTimetable: [
      { id: "tt_t1", day: "Monday", time: "8:00 - 8:40", subject: "Mathematics", venue: "Room 7", className: "JSS 2 - Gold" },
      { id: "tt_t2", day: "Monday", time: "8:40 - 9:20", subject: "Biology", venue: "Science Lab", className: "SS 1 - Emerald" },
      { id: "tt_t3", day: "Tuesday", time: "10:20 - 11:00", subject: "Basic Science", venue: "Primary Block", className: "Primary 6 - Coral" },
      { id: "tt_t4", day: "Wednesday", time: "11:40 - 12:20", subject: "Mathematics", venue: "Room 5", className: "JSS 1 - Silver" }
    ],
    assignedClasses: [
      { classId: "cls_jss2_gold", subjectId: "sub_math", className: "JSS 2 - Gold", subject: "Mathematics", learners: 31, pendingScores: 6, nextAction: "Publish CA entries" },
      { classId: "cls_ss1_emerald", subjectId: "sub_biology", className: "SS 1 - Emerald", subject: "Biology", learners: 28, pendingScores: 4, nextAction: "Finalize practical marks" },
      { classId: "cls_primary6_coral", subjectId: "sub_basic_science", className: "Primary 6 - Coral", subject: "Basic Science", learners: 26, pendingScores: 8, nextAction: "Attendance follow-up for Ibrahim" }
    ],
    recentActivity: [
      { id: "ta_1", title: "Attendance synced", detail: "Morning register for JSS 2 Gold uploaded successfully.", time: "Today, 8:14 AM" },
      { id: "ta_2", title: "Result reminder", detail: "Principal requested score completion before Friday.", time: "Yesterday" }
    ]
  },
  "teacher.primary@greenfieldcollege.ng": {
    teacherName: "Sade Bello",
    headline: "Primary class operations and learner follow-up",
    stats: [
      { label: "Classes This Week", value: "8" },
      { label: "Pending Scores", value: "11" },
      { label: "Pastoral Follow-ups", value: "2" }
    ],
    weeklyTimetable: [
      { id: "tt_t5", day: "Monday", time: "8:00 - 8:40", subject: "English Studies", venue: "Primary 4 Block", className: "Primary 4 - Blue" },
      { id: "tt_t6", day: "Tuesday", time: "9:20 - 10:00", subject: "Mathematics", venue: "Primary 4 Block", className: "Primary 4 - Blue" },
      { id: "tt_t7", day: "Thursday", time: "11:40 - 12:20", subject: "Civic Education", venue: "Primary Block", className: "Primary 6 - Coral" }
    ],
    assignedClasses: [
      { classId: "cls_primary4_blue", subjectId: "sub_core", className: "Primary 4 - Blue", subject: "Core Subjects", learners: 24, pendingScores: 5, nextAction: "Upload literacy assessment" },
      { classId: "cls_primary6_coral", subjectId: "sub_basic_science", className: "Primary 6 - Coral", subject: "Basic Science", learners: 26, pendingScores: 6, nextAction: "Guardian note for attendance case" }
    ],
    recentActivity: [
      { id: "ta_3", title: "Merit note logged", detail: "Maryam Yusuf received a reading improvement commendation.", time: "2 days ago" }
    ]
  },
  "teacher.english@greenfieldcollege.ng": {
    teacherName: "Kemi Afolayan",
    headline: "English and humanities teaching dashboard",
    stats: [
      { label: "Classes This Week", value: "7" },
      { label: "Pending Scores", value: "9" },
      { label: "Report Comments", value: "4 due" }
    ],
    weeklyTimetable: [
      { id: "tt_t8", day: "Tuesday", time: "10:20 - 11:00", subject: "English Language", venue: "Room 7", className: "JSS 2 - Gold" },
      { id: "tt_t9", day: "Wednesday", time: "9:20 - 10:00", subject: "English Language", venue: "Room 12", className: "SS 1 - Emerald" },
      { id: "tt_t10", day: "Friday", time: "10:20 - 11:00", subject: "English Language", venue: "Room 16", className: "SS 2 - Topaz" }
    ],
    assignedClasses: [
      { classId: "cls_jss2_gold", subjectId: "sub_english", className: "JSS 2 - Gold", subject: "English Language", learners: 31, pendingScores: 3, nextAction: "Enter composition scores" },
      { classId: "cls_ss2_topaz", subjectId: "sub_english", className: "SS 2 - Topaz", subject: "English Language", learners: 23, pendingScores: 2, nextAction: "Approve essay drafts" }
    ],
    recentActivity: [
      { id: "ta_4", title: "Class memo published", detail: "Business Studies project update shared with JSS 1 Silver learners.", time: "Yesterday" }
    ]
  }
};

export function getDemoParentPortalByEmail(email: string) {
  return parentPortalByEmail[email.toLowerCase()] ?? parentPortalByEmail["parent@greenfieldcollege.ng"];
}

export function getDemoStudentPortalByEmail(email: string) {
  return studentPortalByEmail[email.toLowerCase()] ?? studentPortalByEmail["student@greenfieldcollege.ng"];
}

export function getDemoTeacherPortalByEmail(email: string) {
  return teacherPortalByEmail[email.toLowerCase()] ?? teacherPortalByEmail["teacher@greenfieldcollege.ng"];
}

const demoTeacherAttendanceHistory: Record<string, TeacherAttendanceHistoryView[]> = {
  tch_1: [
    { id: "sta_1", date: now.toISOString(), status: "PRESENT", checkInAt: "2026-04-08T07:41:00.000Z", notes: "Morning briefing attended." },
    { id: "sta_2", date: subDays(now, 1).toISOString(), status: "PRESENT", checkInAt: "2026-04-07T07:38:00.000Z", checkOutAt: "2026-04-07T15:41:00.000Z" },
    { id: "sta_3", date: subDays(now, 2).toISOString(), status: "LATE", checkInAt: "2026-04-06T08:04:00.000Z", notes: "Traffic delay from Bodija route." }
  ],
  tch_2: [
    { id: "sta_4", date: now.toISOString(), status: "PRESENT", checkInAt: "2026-04-08T07:28:00.000Z" },
    { id: "sta_5", date: subDays(now, 1).toISOString(), status: "PRESENT", checkInAt: "2026-04-07T07:31:00.000Z", checkOutAt: "2026-04-07T15:22:00.000Z" }
  ],
  tch_3: [
    { id: "sta_6", date: now.toISOString(), status: "PRESENT", checkInAt: "2026-04-08T07:35:00.000Z" },
    { id: "sta_7", date: subDays(now, 1).toISOString(), status: "ON_LEAVE", notes: "Approved curriculum workshop leave." }
  ]
};

const demoTeacherLeaveRequests: Record<string, TeacherLeaveRequestView[]> = {
  tch_1: [
    {
      id: "lr_1",
      type: "Personal leave",
      startDate: addDays(now, 14).toISOString(),
      endDate: addDays(now, 15).toISOString(),
      reason: "Family travel outside Ibadan.",
      status: "PENDING"
    }
  ],
  tch_2: [],
  tch_3: [
    {
      id: "lr_2",
      type: "Training leave",
      startDate: subDays(now, 1).toISOString(),
      endDate: addDays(now, 1).toISOString(),
      reason: "State curriculum workshop.",
      status: "APPROVED"
    }
  ]
};

const demoTeacherActivities: TeacherActivityView[] = [
  {
    id: "act_t1",
    teacherId: "tch_1",
    teacherName: "Boma Hart",
    type: "ATTENDANCE",
    title: "Checked in for morning duty",
    detail: "Marked present at 7:41 AM and attended principal briefing.",
    occurredAt: now.toISOString(),
    tone: "success"
  },
  {
    id: "act_t2",
    teacherId: "tch_1",
    teacherName: "Boma Hart",
    type: "RESULTS",
    title: "Pending result publication",
    detail: "18 score workflow items still need completion across science and mathematics classes.",
    occurredAt: subDays(now, 1).toISOString(),
    tone: "warning"
  },
  {
    id: "act_t3",
    teacherId: "tch_1",
    teacherName: "Boma Hart",
    type: "LEAVE",
    title: "Leave request awaiting decision",
    detail: "Personal leave request may require substitution planning for JSS 2 Gold and SS 1 Emerald.",
    occurredAt: subDays(now, 2).toISOString(),
    tone: "warning"
  },
  {
    id: "act_t4",
    teacherId: "tch_2",
    teacherName: "Sade Bello",
    type: "NOTE",
    title: "Literacy intervention logged",
    detail: "Added reading-improvement follow-up for Maryam Yusuf in Primary 4 Blue.",
    occurredAt: subDays(now, 2).toISOString(),
    tone: "success"
  },
  {
    id: "act_t5",
    teacherId: "tch_2",
    teacherName: "Sade Bello",
    type: "CLASS_ASSIGNMENT",
    title: "Primary classes covered",
    detail: "Covers Primary 4 Blue and Primary 6 Coral with 11 result items still pending.",
    occurredAt: now.toISOString(),
    tone: "neutral"
  },
  {
    id: "act_t6",
    teacherId: "tch_3",
    teacherName: "Kemi Afolayan",
    type: "LEAVE",
    title: "Training leave recorded",
    detail: "Approved curriculum workshop leave recorded and reflected in staffing watchlist.",
    occurredAt: subDays(now, 1).toISOString(),
    tone: "neutral"
  },
  {
    id: "act_t7",
    teacherId: "tch_3",
    teacherName: "Kemi Afolayan",
    type: "RESULTS",
    title: "Report comments still due",
    detail: "9 humanities result/comment items need completion before principal publishing.",
    occurredAt: now.toISOString(),
    tone: "warning"
  }
];

export const demoTeachers: TeacherRecordView[] = [
  {
    id: "tch_1",
    fullName: "Boma Hart",
    email: "teacher@greenfieldcollege.ng",
    employeeNo: "EMP-002",
    designation: "Subject Teacher",
    departmentName: "Science",
    campusName: "Ibadan Main Campus",
    subjects: ["Mathematics", "Biology", "Basic Science"],
    classAssignments: ["JSS 2 - Gold", "SS 1 - Emerald", "Primary 6 - Coral", "JSS 1 - Silver"],
    attendanceStatusToday: "PRESENT",
    checkInAt: "2026-04-08T07:41:00.000Z",
    leaveStatus: "1 pending leave request",
    pendingResults: 18,
    employmentDate: "2022-01-15T00:00:00.000Z"
  },
  {
    id: "tch_2",
    fullName: "Sade Bello",
    email: "teacher.primary@greenfieldcollege.ng",
    employeeNo: "EMP-004",
    designation: "Primary Class Teacher",
    departmentName: "Primary Section",
    campusName: "Ibadan Main Campus",
    subjects: ["English Studies", "Mathematics", "Basic Science", "Civic Education"],
    classAssignments: ["Primary 4 - Blue", "Primary 6 - Coral"],
    attendanceStatusToday: "PRESENT",
    checkInAt: "2026-04-08T07:28:00.000Z",
    leaveStatus: "No active leave",
    pendingResults: 11,
    employmentDate: "2022-09-01T00:00:00.000Z"
  },
  {
    id: "tch_3",
    fullName: "Kemi Afolayan",
    email: "teacher.english@greenfieldcollege.ng",
    employeeNo: "EMP-005",
    designation: "English / Humanities Teacher",
    departmentName: "Languages / Humanities",
    campusName: "Ibadan Main Campus",
    subjects: ["English Language", "Economics", "Business Studies"],
    classAssignments: ["JSS 2 - Gold", "SS 1 - Emerald", "JSS 1 - Silver", "SS 2 - Topaz"],
    attendanceStatusToday: "PRESENT",
    checkInAt: "2026-04-08T07:35:00.000Z",
    leaveStatus: "Training leave completed",
    pendingResults: 9,
    employmentDate: "2023-01-09T00:00:00.000Z"
  }
];

export const demoTeacherProfiles: TeacherProfileView[] = [
  {
    id: "tch_1",
    fullName: "Boma Hart",
    email: "teacher@greenfieldcollege.ng",
    phone: "08036660001",
    employeeNo: "EMP-002",
    designation: "Subject Teacher",
    departmentName: "Science",
    campusName: "Ibadan Main Campus",
    employmentDate: "2022-01-15T00:00:00.000Z",
    emergencyContactName: "Tari Hart",
    emergencyContactPhone: "08050001111",
    subjects: ["Mathematics", "Biology", "Basic Science"],
    classAssignments: ["JSS 2 - Gold", "SS 1 - Emerald", "Primary 6 - Coral", "JSS 1 - Silver"],
    attendanceStatusToday: "PRESENT",
    pendingResults: 18,
    leaveStatus: "1 pending leave request",
    attendanceHistory: demoTeacherAttendanceHistory.tch_1,
    leaveRequests: demoTeacherLeaveRequests.tch_1,
    recentActivities: demoTeacherActivities.filter((item) => item.teacherId === "tch_1"),
    operationalNotes: [
      "Needs principal review on pending score publication for JSS 2 Gold.",
      "Handles science practical coordination across junior and senior classes.",
      "Likely substitute impact if pending leave is approved."
    ]
  },
  {
    id: "tch_2",
    fullName: "Sade Bello",
    email: "teacher.primary@greenfieldcollege.ng",
    phone: "08036660002",
    employeeNo: "EMP-004",
    designation: "Primary Class Teacher",
    departmentName: "Primary Section",
    campusName: "Ibadan Main Campus",
    employmentDate: "2022-09-01T00:00:00.000Z",
    emergencyContactName: "Kunle Bello",
    emergencyContactPhone: "08050002222",
    subjects: ["English Studies", "Mathematics", "Basic Science", "Civic Education"],
    classAssignments: ["Primary 4 - Blue", "Primary 6 - Coral"],
    attendanceStatusToday: "PRESENT",
    pendingResults: 11,
    leaveStatus: "No active leave",
    attendanceHistory: demoTeacherAttendanceHistory.tch_2,
    leaveRequests: demoTeacherLeaveRequests.tch_2,
    recentActivities: demoTeacherActivities.filter((item) => item.teacherId === "tch_2"),
    operationalNotes: [
      "Primary literacy intervention lead for Maryam Yusuf and two other learners.",
      "Owns most parent-facing pastoral follow-ups in lower primary.",
      "Available for substitution cover this week."
    ]
  },
  {
    id: "tch_3",
    fullName: "Kemi Afolayan",
    email: "teacher.english@greenfieldcollege.ng",
    phone: "08036660003",
    employeeNo: "EMP-005",
    designation: "English / Humanities Teacher",
    departmentName: "Languages / Humanities",
    campusName: "Ibadan Main Campus",
    employmentDate: "2023-01-09T00:00:00.000Z",
    emergencyContactName: "Bisi Afolayan",
    emergencyContactPhone: "08050003333",
    subjects: ["English Language", "Economics", "Business Studies"],
    classAssignments: ["JSS 2 - Gold", "SS 1 - Emerald", "JSS 1 - Silver", "SS 2 - Topaz"],
    attendanceStatusToday: "PRESENT",
    pendingResults: 9,
    leaveStatus: "Approved training leave this week",
    attendanceHistory: demoTeacherAttendanceHistory.tch_3,
    leaveRequests: demoTeacherLeaveRequests.tch_3,
    recentActivities: demoTeacherActivities.filter((item) => item.teacherId === "tch_3"),
    operationalNotes: [
      "Returned from curriculum workshop with pending report-comment updates.",
      "Critical for SS2 English and Economics continuity this term.",
      "Should be included in timetable clash checks before adding extra periods."
    ]
  }
];

export function getDemoTeachers() {
  return demoTeachers;
}

export function getDemoTeacherActivities() {
  return demoTeacherActivities;
}

export function getDemoTeacherProfileById(teacherId: string) {
  const profile = demoTeacherProfiles.find((item) => item.id === teacherId);
  if (!profile) {
    throw new Error("Teacher not found");
  }

  return profile;
}

const clone = <T,>(value: T): T => structuredClone(value);

const store = {
  admissions: clone(demoAdmissions),
  students: clone(demoStudents),
  studentProfiles: clone(demoStudentProfiles),
  attendance: clone(demoAttendance),
  grades: clone(demoGrades),
  invoices: clone(demoInvoices),
  announcements: clone(demoAnnouncements)
};

export function getDemoStore() {
  return store;
}
