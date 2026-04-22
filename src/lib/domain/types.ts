export type Role =
  | "PLATFORM_OWNER"
  | "PLATFORM_ADMIN"
  | "SUPPORT_AGENT"
  | "SALES_MANAGER"
  | "FINANCE_MANAGER"
  | "DEVELOPER"
  | "SUPER_ADMIN"
  | "SCHOOL_OWNER"
  | "PROPRIETOR"
  | "ADMINISTRATOR"
  | "PRINCIPAL"
  | "HEAD_TEACHER"
  | "VICE_PRINCIPAL_ACADEMICS"
  | "VICE_PRINCIPAL_ADMINISTRATION"
  | "VICE_PRINCIPAL_SPECIAL_DUTIES"
  | "ADMIN_OFFICER"
  | "TEACHER"
  | "EXAM_OFFICER"
  | "EXAMINATION_OFFICER"
  | "HEAD_OF_DEPARTMENT"
  | "CLASS_TEACHER"
  | "SUBJECT_TEACHER"
  | "BURSAR"
  | "ACCOUNTANT"
  | "ACCOUNT_OFFICER"
  | "HR_OFFICER"
  | "SECURITY_OFFICER"
  | "MAINTENANCE_OFFICER"
  | "PARENT"
  | "STUDENT"
  | "ADMISSIONS_OFFICER"
  | "GUIDANCE_COUNSELOR"
  | "GUIDANCE_COUNSELLOR"
  | "LIBRARIAN"
  | "LABORATORY_STAFF"
  | "LABORATORY_ASSISTANT"
  | "ICT_CBT_ADMIN"
  | "IT_ADMINISTRATOR"
  | "ATTENDANCE_OFFICER"
  | "SCHOOL_NURSE"
  | "NURSE"
  | "RECEPTIONIST"
  | "TRANSPORT_COORDINATOR"
  | "TRANSPORT_MANAGER"
  | "HOSTEL_MANAGER"
  | "HOSTEL_MASTER"
  | "HOSTEL_MATRON"
  | "HOSTEL_MISTRESS"
  | "STORE_OFFICER";

export interface SessionUser {
  userId: string;
  schoolId: string;
  role: Role;
  email: string;
  name: string;
  csrfToken: string;
}

export interface DashboardMetric {
  label: string;
  value: string;
  change: string;
}

export interface DashboardActionItem {
  id: string;
  title: string;
  detail: string;
  href: string;
  tone: "neutral" | "warning" | "danger";
  roleScope?: Role[];
}

export interface DashboardQuickAction {
  label: string;
  href: string;
  description: string;
  roleScope?: Role[];
}

export interface DashboardActivityItem {
  id: string;
  title: string;
  detail: string;
  time: string;
  category: "admissions" | "finance" | "academics" | "attendance" | "communication" | "system";
}

export interface DashboardSummary {
  schoolName: string;
  schoolId: string;
  currentSession: string;
  currentTerm: string;
  metrics: DashboardMetric[];
  attendanceTrend: { day: string; rate: number }[];
  feeTrend: { month: string; collected: number; outstanding: number }[];
  admissionsByStage: { stage: string; count: number }[];
  enrollmentTrend?: { label: string; count: number }[];
  roleWidgets?: DashboardMetric[];
  quickActions?: DashboardQuickAction[];
  pendingActions?: DashboardActionItem[];
  upcomingExams?: { id: string; title: string; detail: string; startsAt: string; href: string }[];
  recentPayments?: { id: string; reference: string; studentName: string; amount: number; status: string; paidAt?: string }[];
  recentAnnouncements?: { id: string; title: string; detail: string; publishedAt: string; href: string }[];
  recentActivity?: DashboardActivityItem[];
  alerts: { id: string; title: string; detail: string; tone: "neutral" | "warning" | "danger" }[];
}

export type CurriculumStatus = "DRAFT" | "ACTIVE" | "ARCHIVED";
export type CurriculumProgressStatus = "NOT_STARTED" | "IN_PROGRESS" | "TAUGHT" | "COMPLETED";
export type SchemeOfWorkStatus = "DRAFT" | "SUBMITTED" | "APPROVED" | "RETURNED";
export type SchemeOfWorkWeekType = "TEACHING" | "REVISION" | "EXAM" | "HOLIDAY" | "ACTIVITY";
export type TopicUnderstanding =
  | "EXCELLENT"
  | "GOOD"
  | "AVERAGE"
  | "BELOW_AVERAGE"
  | "POOR";
export type StaffClockStatus = "PRESENT" | "ABSENT" | "LATE" | "EXCUSED" | "ON_LEAVE" | "OFFICIAL_DUTY";
export type TrainingCategory =
  | "PEDAGOGY"
  | "CLASSROOM_MANAGEMENT"
  | "SUBJECT_MASTERY"
  | "CHILD_PROTECTION"
  | "ASSESSMENT_GRADING"
  | "ICT_DIGITAL_LITERACY"
  | "CURRICULUM_ORIENTATION"
  | "COMPLIANCE_PROFESSIONAL_DEVELOPMENT";
export type TrainingType = "INTERNAL" | "EXTERNAL" | "ONLINE" | "PHYSICAL" | "BLENDED";
export type TrainingParticipantStatus = "INVITED" | "ATTENDED" | "ABSENT" | "COMPLETED" | "OVERDUE";

export interface NigeriaAcademicDefaultsView {
  sessionLabel: string;
  terms: string[];
  levels: string[];
  classAliases: string[];
}

export interface CurriculumTopicView {
  id: string;
  academicSession: string;
  term: string;
  className: string;
  classId: string;
  subject: string;
  subjectId: string;
  weekNumber: number;
  topic: string;
  subTopic?: string;
  learningObjectives?: string;
  teacherNotes?: string;
  recommendedResources?: string;
  assignmentNote?: string;
  status: CurriculumStatus;
  progressStatus: CurriculumProgressStatus;
  actualDateTaught?: string;
  teacherName?: string;
}

export interface CurriculumSummaryView {
  totalTopics: number;
  completionRate: number;
  overdueTopics: number;
  bySubject: { subject: string; className: string; totalTopics: number; completionRate: number }[];
}

export interface SchemeOfWorkTopicResourceView {
  id: string;
  resourceType: string;
  title: string;
  url?: string;
  filePath?: string;
  createdAt?: string;
}

export interface SchemeOfWorkTopicView {
  id: string;
  weekNumber: number;
  topic: string;
  subtopics?: string[];
  behaviouralObjectives?: string;
  content?: string;
  teachingMethods?: string[];
  teachingAids?: string[];
  referenceMaterials?: string[];
  evaluation?: string;
  assignment?: string;
  isCovered: boolean;
  coveredDate?: string;
  coveredByName?: string;
  actualTopicTaught?: string;
  coverageNotes?: string;
  weekType: SchemeOfWorkWeekType;
  sortOrder?: number;
  resources?: SchemeOfWorkTopicResourceView[];
}

export interface SchemeOfWorkSummaryView {
  id: string;
  status: SchemeOfWorkStatus;
  subjectId: string;
  subjectName: string;
  subjectCode?: string;
  classId: string;
  className: string;
  level?: string;
  section?: string;
  category?: string;
  arm?: string;
  departmentId?: string;
  departmentName?: string;
  teacherId?: string;
  teacherName?: string;
  totalWeeks: number;
  teachingWeeks: number;
  coveredWeeks: number;
  coveragePercent: number;
  lastCoveredWeek?: number;
  nextWeek?: number;
  submittedAt?: string;
  approvedAt?: string;
}

export interface SchemeOfWorkDetailView {
  id: string;
  schoolId: string;
  subjectId: string;
  classId: string;
  academicSessionId: string;
  termId: string;
  teacherId?: string;
  status: SchemeOfWorkStatus;
  returnReason?: string;
  submittedAt?: string;
  approvedAt?: string;
  subjectName: string;
  subjectCode?: string;
  periodsPerWeek?: number;
  requiresLab?: boolean;
  className: string;
  level?: string;
  section?: string;
  category?: string;
  arm?: string;
  termName: string;
  termNumber?: number;
  academicSessionName: string;
  teacherName?: string;
  teacherEmail?: string;
  teacherAvatar?: string;
  approvedByName?: string;
  topics: SchemeOfWorkTopicView[];
  stats: {
    totalWeeks: number;
    teachingWeeks: number;
    coveredWeeks: number;
    coveragePercent: number;
    currentWeek?: number;
    isOnTrack: boolean;
  };
}

export interface StaffClockView {
  id: string;
  teacherName: string;
  userId: string;
  date: string;
  status: StaffClockStatus;
  checkInAt?: string;
  checkOutAt?: string;
  totalMinutes?: number;
  notes?: string;
}

export interface StaffAttendancePolicyView {
  resumptionTime: string;
  closingTime: string;
  graceMinutes: number;
  timezone: string;
}

export interface TrainingProgramView {
  id: string;
  title: string;
  description?: string;
  category: TrainingCategory;
  trainingType: TrainingType;
  startsAt: string;
  endsAt?: string;
  durationHours?: number;
  facilitator?: string;
  provider?: string;
  location?: string;
  meetingLink?: string;
  mandatory: boolean;
  invitedCount: number;
  completedCount: number;
}

export interface TrainingParticipantView {
  id: string;
  trainingProgramId: string;
  title: string;
  teacherName: string;
  status: TrainingParticipantStatus;
  startsAt: string;
  completedAt?: string;
  certificateUrl?: string;
  cpdPoints: number;
  notes?: string;
}

export interface NigeriaOperationsDashboardView {
  academicDefaults: NigeriaAcademicDefaultsView;
  curriculum: CurriculumSummaryView;
  staffAttendance: {
    policy: StaffAttendancePolicyView;
    totalMarkedToday: number;
    lateToday: number;
    absentToday: number;
    records: StaffClockView[];
  };
  training: {
    upcoming: TrainingProgramView[];
    complianceRate: number;
    pendingMandatory: number;
  };
}

export type SubscriptionPlan = "BASIC" | "STANDARD" | "ENTERPRISE";
export type TenantStatus = "ACTIVE" | "SUSPENDED" | "TRIAL" | "DELETED";
export type PlatformBillingStatus = "TRIAL" | "ACTIVE" | "OVERDUE" | "SUSPENDED";

export interface SuperAdminSchoolRow {
  id: string;
  name: string;
  slug: string;
  plan: SubscriptionPlan;
  status: TenantStatus;
  billingStatus: PlatformBillingStatus;
  totalUsers: number;
  totalStudents: number;
  totalTeachers: number;
  createdAt: string;
  trialEndsAt?: string;
  lastPaymentAt?: string;
  nextBillingAt?: string;
}

export interface SuperAdminSchoolDetail {
  id: string;
  name: string;
  slug: string;
  category: string;
  plan: SubscriptionPlan;
  status: TenantStatus;
  billingStatus: PlatformBillingStatus;
  featureFlags: Record<string, boolean>;
  trialEndsAt?: string;
  lastPaymentAt?: string;
  nextBillingAt?: string;
  createdAt: string;
  counts: Record<string, number>;
  admins: Array<{ id: string; name: string; email: string; role: Role; status: string; createdAt: string }>;
}

export interface SuperAdminUserRow {
  id: string;
  name: string;
  email: string;
  role: Role;
  schoolId: string;
  schoolName: string;
  schoolStatus: TenantStatus;
  status: "ACTIVE" | "SUSPENDED";
  lastLoginAt?: string;
  createdAt: string;
}

export interface SuperAdminBillingRow {
  schoolId: string;
  schoolName: string;
  plan: SubscriptionPlan;
  status: PlatformBillingStatus;
  tenantStatus: TenantStatus;
  lastPaymentAt?: string;
  nextDueAt?: string;
  trialEndsAt?: string;
  monthlyAmount: number;
}

export interface SuperAdminAuditLogRow {
  id: string;
  timestamp: string;
  action: string;
  superAdmin: string;
  target: string;
  schoolId?: string;
  schoolName?: string;
  details?: unknown;
}

export interface SuperAdminAnalyticsOverview {
  schools: { total: number; active: number; suspended: number; trial: number };
  users: { total: number; parents: number; teachers: number; students: number; schoolAdmins: number };
  signups: { last7Days: number; last30Days: number };
  mau: number;
  revenue: { mrr: number; arr: number; totalPaidSchools: number };
  recentActivity: SuperAdminAuditLogRow[];
}

export interface SuperAdminUsageRow {
  schoolId: string;
  schoolName: string;
  logins: number;
  activeUsers: number;
  modulesUsed: string[];
}

export interface SuperAdminRevenueView {
  mrr: number;
  arr: number;
  totalPaidSchools: number;
  schoolsByPlan: Array<{ plan: SubscriptionPlan; count: number }>;
  monthlyRevenue: Array<{ month: string; amount: number }>;
}

export interface SuperAdminSettingsView {
  id: string;
  maintenanceMode: boolean;
  platformAnnouncement?: string;
  defaultGradingScale: unknown;
  globalModuleAvailability: Record<string, boolean>;
}

export interface AdmissionApplicationView {
  id: string;
  applicationNo: string;
  studentName: string;
  firstName?: string;
  lastName?: string;
  gender?: "MALE" | "FEMALE" | "OTHER";
  dateOfBirth?: string;
  guardianName: string;
  guardianPhone: string;
  guardianEmail?: string;
  address?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  previousSchool?: string;
  medicalNotes?: string;
  desiredClass: string;
  status: AdmissionStatus;
  submittedAt: string;
  applicationFeeStatus?: AdmissionPaymentStatus;
  feeWaived?: boolean;
  duplicateFlag?: boolean;
  duplicateReason?: string;
  reviewNotes?: string;
  reviewedBy?: string;
  reviewedAt?: string;
  decisionNotes?: string;
  decidedAt?: string;
  offerStatus?: AdmissionOfferStatus;
  offerExpiresAt?: string;
  acceptedAt?: string;
  enrolledAt?: string;
  registeredStudentId?: string;
  registeredAdmissionNumber?: string;
  latestScreening?: AdmissionScreeningView;
  missingRequirements?: string[];
  timeline?: AdmissionTimelineItem[];
  comments?: AdmissionCommentView[];
  documents?: AdmissionDocumentRequirementView[];
}

export type AdmissionStatus =
  | "DRAFT"
  | "SUBMITTED"
  | "REVIEWING"
  | "INCOMPLETE"
  | "AWAITING_DOCUMENTS"
  | "PAYMENT_PENDING"
  | "SCREENING_SCHEDULED"
  | "SCREENING_COMPLETED"
  | "RECOMMENDED"
  | "APPROVED"
  | "CONDITIONALLY_APPROVED"
  | "REJECTED"
  | "WAITLISTED"
  | "OFFER_SENT"
  | "ACCEPTED"
  | "DECLINED"
  | "FINANCIALLY_CLEARED"
  | "ENROLLED"
  | "ACTIVE";

export type AdmissionPaymentStatus = "NOT_REQUIRED" | "PENDING" | "WAIVED" | "VERIFIED";

export type AdmissionOfferStatus = "DRAFT" | "SENT" | "VIEWED" | "ACCEPTED" | "DECLINED" | "EXPIRED";

export interface AdmissionScreeningView {
  id: string;
  interviewerName?: string;
  scheduledAt: string;
  venue?: string;
  score?: number;
  maxScore: number;
  result?: string;
  recommendation?: string;
  remarks?: string;
  completedAt?: string;
}

export interface AdmissionTimelineItem {
  id: string;
  fromStatus?: AdmissionStatus;
  toStatus: AdmissionStatus;
  changedBy?: string;
  note?: string;
  createdAt: string;
}

export interface AdmissionCommentView {
  id: string;
  authorName?: string;
  body: string;
  isInternal: boolean;
  createdAt: string;
}

export interface AdmissionDocumentRequirementView {
  id: string;
  label: string;
  fileUrl?: string;
  mimeType?: string;
  isVerified: boolean;
  uploadedAt?: string;
}

export interface AdmissionConfigView {
  id: string;
  name: string;
  academicSession?: string;
  term?: string;
  isActive: boolean;
  openClasses: string[];
  minAge?: number;
  maxAge?: number;
  requiredDocuments: string[];
  applicationFeeAmount: number;
  applicationFeeRequired: boolean;
  screeningRequired: boolean;
  principalApprovalRequired: boolean;
  bursarClearanceRequired: boolean;
  offerExpiryDays: number;
}

export interface AdmissionMetricsView {
  totalApplications: number;
  byStatus: { status: AdmissionStatus; count: number }[];
  byClass: { className: string; count: number }[];
  incompleteApplications: number;
  pendingApprovals: number;
  admitted: number;
  rejected: number;
  conversionRate: number;
  paymentVerified: number;
  screeningAverage: number;
  averageProcessingDays: number;
}

export interface StudentRecordView {
  id: string;
  admissionNumber: string;
  fullName: string;
  classId?: string;
  className: string;
  guardianName: string;
  status: string;
  attendanceRate: number;
  averageScore: number;
  outstandingBalance: number;
}

export interface StudentMedicalView {
  bloodGroup?: string;
  genotype?: string;
  allergies?: string;
  conditions?: string;
  notes?: string;
}

export interface StudentDocumentView {
  id: string;
  label: string;
  fileName: string;
  createdAt: string;
}

export interface StudentBehaviorLogView {
  id: string;
  category: string;
  description: string;
  severity: "LOW" | "MEDIUM" | "HIGH";
  loggedAt: string;
}

export interface StudentPromotionView {
  id: string;
  decision: string;
  fromClassName?: string;
  toClassName?: string;
  fromSessionName?: string;
  toSessionName?: string;
  promotedAt: string;
}

export interface StudentProfileView {
  id: string;
  admissionNumber: string;
  fullName: string;
  className: string;
  guardianName: string;
  guardianPhone: string;
  guardianEmail?: string;
  status: string;
  gender: "MALE" | "FEMALE" | "OTHER";
  dateOfBirth: string;
  admissionDate: string;
  nationality: string;
  stateOfOrigin?: string;
  religion?: string;
  attendanceRate: number;
  averageScore: number;
  outstandingBalance: number;
  riskFlags: string[];
  medical: StudentMedicalView;
  documents: StudentDocumentView[];
  behaviorLogs: StudentBehaviorLogView[];
  promotions: StudentPromotionView[];
}

export interface TeacherRecordView {
  id: string;
  fullName: string;
  email: string;
  employeeNo: string;
  designation: string;
  departmentName?: string;
  campusName?: string;
  subjects: string[];
  classAssignments: string[];
  attendanceStatusToday: string;
  checkInAt?: string;
  leaveStatus: string;
  pendingResults: number;
  employmentDate: string;
}

export interface TeacherAttendanceHistoryView {
  id: string;
  date: string;
  status: StaffClockStatus;
  checkInAt?: string;
  checkOutAt?: string;
  notes?: string;
}

export interface TeacherLeaveRequestView {
  id: string;
  type: string;
  startDate: string;
  endDate: string;
  reason: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
}

export interface TeacherActivityView {
  id: string;
  teacherId: string;
  teacherName: string;
  type: "ATTENDANCE" | "LEAVE" | "RESULTS" | "CLASS_ASSIGNMENT" | "NOTE";
  title: string;
  detail: string;
  occurredAt: string;
  tone: "neutral" | "warning" | "danger" | "success";
}

export interface TeacherProfileView {
  id: string;
  fullName: string;
  email: string;
  phone?: string;
  employeeNo: string;
  designation: string;
  departmentName?: string;
  campusName?: string;
  employmentDate: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  subjects: string[];
  classAssignments: string[];
  attendanceStatusToday: string;
  pendingResults: number;
  leaveStatus: string;
  attendanceHistory: TeacherAttendanceHistoryView[];
  leaveRequests: TeacherLeaveRequestView[];
  recentActivities: TeacherActivityView[];
  operationalNotes: string[];
}

export interface AttendanceRecordView {
  id: string;
  studentId: string;
  studentName: string;
  classId?: string;
  className: string;
  subjectId?: string;
  subject: string;
  status: "PRESENT" | "ABSENT" | "LATE" | "EXCUSED";
  date: string;
  reason?: string;
  markedByName?: string;
  termName?: string;
}

export interface GradeRecordView {
  id: string;
  studentId: string;
  studentName: string;
  classId?: string;
  subjectId?: string;
  className: string;
  subject: string;
  continuousAssessment: number;
  exam: number;
  total: number;
  grade: string;
  remark?: string;
  position?: number;
  status?: "DRAFT" | "SUBMITTED" | "UNDER_REVIEW" | "APPROVED" | "REJECTED" | "PUBLISHED" | "RETURNED";
  published?: boolean;
  teacherComment?: string;
  principalComment?: string;
}

export interface GradingSchemeView {
  id: string;
  name: string;
  description?: string;
  isActive: boolean;
  rankingEnabled: boolean;
  passMark: number;
  bands: Array<{ id?: string; label: string; minScore: number; maxScore: number; remark: string; gpa?: number; order: number }>;
}

export interface AssessmentComponentView {
  id: string;
  name: string;
  code: string;
  weight: number;
  maxScore: number;
  order: number;
  isActive: boolean;
}

export type SchoolSectionView = "CRECHE" | "NURSERY" | "PRIMARY" | "JUNIOR_SECONDARY" | "SENIOR_SECONDARY";

export interface SubjectView {
  id: string;
  name: string;
  code: string;
  departmentId?: string;
  departmentName?: string;
  description?: string;
  waecCode?: string;
  necoCode?: string;
  isWaecSubject?: boolean;
  section?: SchoolSectionView;
  applicableClassLevels: string[];
  subjectCombination?: string;
  periodsPerWeek?: number;
  requiresLab?: boolean;
  sortOrder?: number;
  isActive?: boolean;
  isCore: boolean;
  isOptional: boolean;
  religionSpecific: boolean;
  trackSpecific?: string;
  tradeSubject: boolean;
  status: string;
  classCount?: number;
  teacherCount?: number;
}

export type AcademicAssessmentType =
  | "ASSIGNMENT"
  | "CLASSWORK"
  | "QUIZ"
  | "TEST"
  | "MID_TERM_TEST"
  | "PRACTICAL"
  | "PROJECT"
  | "EXAMINATION";
export type AssessmentSubmissionMode = "PAPER" | "CBT" | "PRACTICAL" | "ORAL";
export type AcademicAssessmentStatus = "DRAFT" | "ACTIVE" | "CLOSED" | "MARKED" | "APPROVED" | "PUBLISHED";
export type AssessmentAttendanceState = "PRESENT" | "ABSENT" | "EXCUSED" | "MALPRACTICE_PENDING_REVIEW";
export type AssessmentScoreFlag = "NONE" | "ABSENT" | "INCOMPLETE" | "WITHHELD" | "MALPRACTICE";
export type AcademicApprovalStage =
  | "SUBJECT_TEACHER"
  | "HEAD_OF_DEPARTMENT"
  | "CLASS_TEACHER"
  | "EXAM_OFFICER"
  | "VICE_PRINCIPAL_ACADEMICS"
  | "PRINCIPAL"
  | "PUBLISHED";
export type AcademicApprovalAction =
  | "SUBMIT"
  | "APPROVE"
  | "REJECT"
  | "REQUEST_CORRECTION"
  | "COMPILE"
  | "PUBLISH"
  | "UNLOCK";
export type BroadsheetStatus = "DRAFT" | "IN_REVIEW" | "CORRECTION_REQUESTED" | "APPROVED" | "PUBLISHED" | "LOCKED";

export interface SectionAssessmentComponentView {
  id: string;
  section: SchoolSectionView;
  name: string;
  code: string;
  type: AcademicAssessmentType;
  weight: number;
  maxScore: number;
  order: number;
  isActive: boolean;
}

export interface AssessmentCandidateView {
  id: string;
  studentId: string;
  studentName: string;
  admissionNumber?: string;
  attendanceState: AssessmentAttendanceState;
  score?: number;
  scoreFlag: AssessmentScoreFlag;
  comment?: string;
  enteredBy?: string;
  enteredAt?: string;
  lastEditedBy?: string;
}

export interface AcademicAssessmentView {
  id: string;
  title: string;
  term: string;
  session?: string;
  classId?: string;
  className: string;
  arm?: string;
  subjectId?: string;
  subject: string;
  teacherId?: string;
  teacherName?: string;
  assessmentType: AcademicAssessmentType;
  maxScore: number;
  weight: number;
  assessmentDate: string;
  submissionMode: AssessmentSubmissionMode;
  status: AcademicAssessmentStatus;
  candidateCount: number;
  enteredCount: number;
  candidates?: AssessmentCandidateView[];
}

export interface BroadsheetSubjectCellView {
  subjectId?: string;
  subjectCode?: string;
  subject: string;
  teacherId?: string;
  teacherName?: string;
  components?: Array<{
    code: string;
    name: string;
    score?: number;
    weightedScore: number;
    maxScore: number;
    weight: number;
    isExam: boolean;
    isMissing: boolean;
  }>;
  caTotal: number;
  examTotal: number;
  total: number;
  grade: string;
  remark?: string;
  position?: number;
  isComplete?: boolean;
  missingComponents?: string[];
}

export interface BroadsheetRowView {
  studentId: string;
  studentName: string;
  admissionNumber?: string;
  subjects: BroadsheetSubjectCellView[];
  totalSubjectsOffered?: number;
  completedSubjects?: number;
  missingSubjects?: number;
  isComplete?: boolean;
  total: number;
  average: number;
  overallGrade?: string;
  position?: number;
  attendance?: string;
  classTeacherRemark?: string;
  principalRemark?: string;
  promotionStatus?: string;
}

export interface BroadsheetView {
  id: string;
  academicSessionId?: string;
  termId?: string;
  classId?: string;
  className: string;
  classLevel?: string;
  classArm?: string;
  classCategory?: string;
  classTeacherId?: string;
  classTeacherName?: string;
  term: string;
  session?: string;
  status: BroadsheetStatus;
  approvalStage: AcademicApprovalStage;
  rankingEnabled: boolean;
  missingScoreWarnings: string[];
  metrics?: {
    studentCount: number;
    subjectCount: number;
    completeStudents: number;
    incompleteStudents: number;
    missingEntries: number;
    classAverage: number;
    published: boolean;
  };
  rows: BroadsheetRowView[];
  approvals: Array<{ id: string; actorName: string; stage: AcademicApprovalStage; action: AcademicApprovalAction; note?: string; createdAt: string }>;
  publishedAt?: string;
  lockedAt?: string;
}

export interface ReportCardView {
  id: string;
  studentId: string;
  studentName: string;
  className: string;
  term: string;
  session?: string;
  status: "DRAFT" | "GENERATED" | "PUBLISHED" | "LOCKED";
  total: number;
  average: number;
  grade?: string;
  reportCardUrl?: string;
  publishedAt?: string;
}

export interface ResultApprovalView {
  id: string;
  resultSheetId: string;
  studentName: string;
  className: string;
  status: string;
  action: string;
  actorName: string;
  note?: string;
  createdAt: string;
}

export interface ResultAnalyticsView {
  metrics: Array<{ label: string; value: string; tone: string }>;
  classSummaries: Array<{ className: string; average: number; published: number; pending: number; missingScores: number }>;
  subjectSummaries: Array<{ subject: string; average: number; passRate: number; entries: number }>;
  statusBreakdown: Array<{ status: string; count: number }>;
  missingScores: Array<{ studentName: string; className: string; subject: string }>;
}

export interface InvoiceView {
  id: string;
  invoiceNumber: string;
  studentId?: string;
  studentName: string;
  className: string;
  subtotal?: number;
  discount?: number;
  fine?: number;
  total: number;
  paid?: number;
  balance: number;
  status: string;
  issuedOn?: string;
  dueOn: string;
  receiptNumber?: string;
}

export interface FeeStructureView {
  id: string;
  name: string;
  session?: string;
  term?: string;
  className?: string;
  studentCategory?: string;
  recurrence: string;
  isOneTime: boolean;
  isActive: boolean;
  dueDate?: string;
  total: number;
  items: Array<{ id: string; label: string; componentType: string; amount: number; isOptional: boolean; isActive: boolean }>;
}

export interface PaymentView {
  id: string;
  reference: string;
  studentName: string;
  invoiceNumber?: string;
  receiptNumber?: string;
  amount: number;
  status: string;
  method: string;
  provider?: string;
  paidAt?: string;
}

export interface ReceiptView {
  id: string;
  receiptNumber: string;
  invoiceId: string;
  invoiceNumber: string;
  paymentId?: string;
  amount: number;
  currency: string;
  status: string;
  issuedAt: string;
}

export interface InstallmentPlanView {
  id: string;
  planNumber: string;
  studentName: string;
  invoiceNumber?: string;
  totalAmount: number;
  balance: number;
  status: string;
  items: Array<{ id: string; dueOn: string; amount: number; paidAmount: number; status: string }>;
}

export interface FinanceDashboardView {
  metrics: Array<{ label: string; value: string; tone: string }>;
  feeStructures: FeeStructureView[];
  invoices: InvoiceView[];
  payments: PaymentView[];
  installmentPlans: InstallmentPlanView[];
  auditTrail: Array<{ id: string; action: string; entityType: string; entityId: string; createdAt: string; detail: string }>;
}

export interface AnnouncementView {
  id: string;
  title: string;
  body: string;
  audience: string;
  channel: string;
  publishedAt: string;
}

export interface PortalSnapshot {
  headline: string;
  stats: { label: string; value: string }[];
  timeline: { id: string; title: string; detail: string; time: string }[];
  cards: { title: string; detail: string; accent: string }[];
}

export interface PortalTimetableEntry {
  id: string;
  day: string;
  time: string;
  subject: string;
  venue: string;
  teacherName?: string;
  className?: string;
}

export interface PortalSubjectResult {
  subject: string;
  score: number;
  grade: string;
  continuousAssessment?: number;
  exam?: number;
}

export interface PortalResultHistory {
  id: string;
  session: string;
  term: string;
  average: number;
  grade: string;
  position?: number;
  publishedAt: string;
  teacherComment?: string;
  principalComment?: string;
  reportCardUrl?: string;
  subjects: PortalSubjectResult[];
}

export interface PortalFinanceItem {
  id: string;
  title: string;
  amount: number;
  balance: number;
  dueOn: string;
  status: string;
  issuedOn?: string;
  canPay?: boolean;
  paymentUrl?: string;
  payments?: { id: string; reference: string; amount: number; paidAt?: string; status: string; method: string; receiptNumber?: string }[];
}

export interface PortalSubjectOffering {
  id: string;
  name: string;
  code?: string;
  departmentName?: string;
  track?: string;
  teacherName?: string;
  periodsPerWeek?: number;
  isCore?: boolean;
  isOptional?: boolean;
  schemeOfWorkId?: string;
  schemeStatus?: SchemeOfWorkStatus;
  coveragePercent?: number;
  coveredWeeks?: number;
  teachingWeeks?: number;
}

export interface StudentPortalProfileView {
  studentId: string;
  studentName: string;
  admissionNumber: string;
  studentNumber?: string;
  className: string;
  session?: string;
  term?: string;
  gender?: "MALE" | "FEMALE" | "OTHER";
  dateOfBirth?: string;
  admissionDate?: string;
  status: string;
  nationality?: string;
  stateOfOrigin?: string;
  religion?: string;
  profilePhotoUrl?: string;
  house?: string;
  guardianSummary: {
    name: string;
    relationship?: string;
    phone?: string;
    email?: string;
  };
  contactInfo?: {
    phone?: string;
    email?: string;
  };
  medical?: StudentMedicalView;
  subjects: string[];
  subjectDetails?: PortalSubjectOffering[];
  departmentTrack?: string;
}

export interface StudentPortalAttendanceRecord {
  id: string;
  date: string;
  status: "PRESENT" | "ABSENT" | "LATE" | "EXCUSED";
  subject?: string;
  reason?: string;
}

export interface StudentPortalAttendanceView {
  summary: {
    totalDays: number;
    present: number;
    absent: number;
    late: number;
    excused: number;
    attendanceRate: number;
    lowAttendanceWarning?: string;
  };
  records: StudentPortalAttendanceRecord[];
  chart: { label: string; value: number }[];
}

export interface StudentPortalExamEntry {
  id: string;
  subject: string;
  examDate: string;
  time: string;
  venue?: string;
}

export interface StudentPortalCalendarEvent {
  id: string;
  title: string;
  description?: string;
  startsAt: string;
  endsAt: string;
  audience: string;
}

export interface StudentPortalAssignmentView {
  id: string;
  title: string;
  subject?: string;
  className?: string;
  dueAt?: string;
  status: "NOT_STARTED" | "SUBMITTED" | "GRADED" | "OVERDUE" | "INFO";
  teacherName?: string;
  description?: string;
  feedback?: string;
  attachmentUrl?: string;
}

export interface StudentPortalNotificationView {
  id: string;
  title: string;
  body: string;
  channel: string;
  status: string;
  sentAt?: string;
}

export interface StudentPortalLibraryLoanView {
  id: string;
  title: string;
  author: string;
  borrowedAt: string;
  dueAt: string;
  returnedAt?: string;
  fineAmount: number;
}

export interface StudentPortalHostelView {
  building: string;
  room: string;
  startDate: string;
  endDate?: string;
}

export interface StudentPortalTransportView {
  routeName: string;
  driverName: string;
  driverPhone: string;
  vehicleRegNo: string;
  stopName: string;
  amount: number;
}

export interface ParentChildPortalView {
  studentId: string;
  studentName: string;
  admissionNumber?: string;
  className: string;
  profilePhotoUrl?: string;
  attendanceRate: number;
  averageScore: number;
  outstandingBalance: number;
  nextClass: string;
  latestResult?: PortalResultHistory;
  attendance?: StudentPortalAttendanceView;
  examTimetable?: StudentPortalExamEntry[];
  calendar?: StudentPortalCalendarEvent[];
  weeklyTimetable: PortalTimetableEntry[];
  subjects?: PortalSubjectOffering[];
  curriculumTopics?: CurriculumTopicView[];
  departmentTrack?: string;
  resultHistory: PortalResultHistory[];
  finance: PortalFinanceItem[];
  transport?: StudentPortalTransportView[];
  hostel?: StudentPortalHostelView[];
  library?: StudentPortalLibraryLoanView[];
  notes: string[];
}

export interface ParentPortalView {
  parentId?: string;
  parentName: string;
  contactEmail?: string;
  contactPhone?: string;
  headline: string;
  familyStats: { label: string; value: string }[];
  children: ParentChildPortalView[];
  announcements: { id: string; title: string; detail: string; time: string }[];
  notifications?: StudentPortalNotificationView[];
}

export interface ParentProfileView {
  parentId: string;
  parentName: string;
  relationship?: string;
  phone?: string;
  email?: string;
  address?: string;
  canReceiveSms: boolean;
  canReceiveEmail: boolean;
  linkedChildren: Array<{ studentId: string; studentName: string; className: string; admissionNumber: string }>;
}

export interface ParentDirectoryRecordView {
  id: string;
  parentName: string;
  relationship: string;
  phone: string;
  email?: string;
  occupation?: string;
  address?: string;
  canReceiveSms: boolean;
  canReceiveEmail: boolean;
  linkedChildren: Array<{ studentId: string; studentName: string; className: string; admissionNumber: string }>;
}

export interface StudentPortalView {
  studentId?: string;
  studentName: string;
  className: string;
  admissionNumber?: string;
  session?: string;
  term?: string;
  house?: string;
  headline: string;
  stats: { label: string; value: string }[];
  profile?: StudentPortalProfileView;
  subjects?: PortalSubjectOffering[];
  curriculumTopics?: CurriculumTopicView[];
  departmentTrack?: string;
  attendance?: StudentPortalAttendanceView;
  latestResult?: PortalResultHistory;
  timetablePreview?: PortalTimetableEntry[];
  weeklyTimetable: PortalTimetableEntry[];
  examTimetable?: StudentPortalExamEntry[];
  calendar?: StudentPortalCalendarEvent[];
  assignments?: StudentPortalAssignmentView[];
  resultHistory: PortalResultHistory[];
  finance: PortalFinanceItem[];
  announcements: { id: string; title: string; detail: string; time: string }[];
  notifications?: StudentPortalNotificationView[];
  library?: StudentPortalLibraryLoanView[];
  hostel?: StudentPortalHostelView[];
  transport?: StudentPortalTransportView[];
}

export interface TeacherClassPortalView {
  classId?: string;
  subjectId?: string;
  className: string;
  subject: string;
  learners: number;
  pendingScores: number;
  nextAction: string;
}

export interface TeacherClassStudentView {
  studentId: string;
  admissionNumber: string;
  studentName: string;
  classId: string;
  className: string;
}

export interface TeacherAttendanceEntryView {
  id: string;
  studentId: string;
  studentName: string;
  classId: string;
  className: string;
  subjectId?: string;
  subject?: string;
  status: "PRESENT" | "ABSENT" | "LATE" | "EXCUSED";
  date: string;
  reason?: string;
}

export interface TeacherScoreEntryView {
  id: string;
  studentId: string;
  studentName: string;
  classId: string;
  className: string;
  subjectId: string;
  subject: string;
  continuousAssessment: number;
  exam: number;
  total: number;
  grade: string;
  published: boolean;
  recordedAt?: string;
  teacherComment?: string;
}

export interface TeacherAssignmentTaskView {
  id: string;
  classId: string;
  className: string;
  subjectId: string;
  subject: string;
  title: string;
  description?: string;
  dueAt: string;
  status: "DRAFT" | "PUBLISHED" | "CLOSED";
  attachmentUrl?: string;
  submissionsCount: number;
}

export interface TeacherPortalView {
  teacherId?: string;
  teacherName: string;
  headline: string;
  stats: { label: string; value: string }[];
  weeklyTimetable: PortalTimetableEntry[];
  assignedClasses: TeacherClassPortalView[];
  students?: TeacherClassStudentView[];
  attendanceHistory?: TeacherAttendanceEntryView[];
  scoreSheets?: TeacherScoreEntryView[];
  assignments?: TeacherAssignmentTaskView[];
  announcements?: { id: string; title: string; detail: string; time: string }[];
  notifications?: StudentPortalNotificationView[];
  recentActivity: { id: string; title: string; detail: string; time: string }[];
}

export interface PermissionItemView {
  id?: string;
  key: string;
  label: string;
  description?: string;
  module: string;
}

export interface PermissionGroupView {
  module: string;
  permissions: PermissionItemView[];
}

export interface SchoolRoleView {
  id: string;
  name: string;
  slug?: string;
  description?: string | null;
  isSystem: boolean;
  systemRole?: Role | null;
  permissionsCount?: number;
  staffCount?: number;
  permissions?: string[];
  createdAt?: string;
}

export interface StaffRoleRowView {
  id: string;
  name: string;
  email: string;
  department: string;
  roles: Array<{ id: string; name: string; isSystem: boolean; systemRole?: Role | null }>;
}

export interface PermissionOverrideView {
  id: string;
  type: "GRANT" | "REVOKE";
  createdAt: string;
  permission: PermissionItemView;
  setBy: string;
}

export interface StaffRoleDetailView extends StaffRoleRowView {
  permissions: string[];
  groupedPermissions: Array<{ module: string; permissions: PermissionItemView[] }>;
  overrides: PermissionOverrideView[];
}

export interface MyPermissionsView {
  permissions: string[];
  grouped: Array<{ module: string; permissions: PermissionItemView[] }>;
}

export interface DemoUserCredential {
  email: string;
  password: string;
  role: Role;
  name: string;
}
