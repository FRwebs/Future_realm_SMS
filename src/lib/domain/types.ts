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
  impersonation?: {
    impersonatorUserId: string;
    impersonatorName: string;
    impersonatorEmail: string;
    startedAt: string;
    expiresAt: string;
    reason?: string | null;
  };
}

export interface SchoolContextView {
  schoolName: string;
  schoolSlug?: string;
  currentSession: string;
  currentTerm: string;
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
export type TenantStatus = "ACTIVE" | "SUSPENDED" | "TRIAL" | "GRACE_PERIOD" | "ARCHIVED" | "DELETED";
export type PlatformBillingStatus = "TRIAL" | "ACTIVE" | "OVERDUE" | "SUSPENDED" | "CANCELLED";

export interface SuperAdminSchoolRow {
  id: string;
  name: string;
  slug: string;
  plan: SubscriptionPlan;
  status: TenantStatus;
  billingStatus: PlatformBillingStatus;
  category?: string;
  country?: string;
  state?: string;
  city?: string;
  address?: string;
  ownerName?: string;
  ownerEmail?: string;
  ownerPhone?: string;
  healthScore?: number;
  totalUsers: number;
  totalStudents: number;
  totalTeachers: number;
  createdAt: string;
  trialEndsAt?: string;
  lastPaymentAt?: string;
  nextBillingAt?: string;
}

export interface SuperAdminPendingVerificationSchool {
  id: string;
  name: string;
  slug: string;
  category?: string;
  curriculum?: string;
  city?: string;
  state?: string;
  country?: string;
  ownerName?: string;
  ownerEmail?: string;
  ownerPhone?: string;
  cacNumber?: string | null;
  ministryApprovalNumber?: string | null;
  flaggedForReviewReason?: string | null;
  riskScore?: number | null;
  riskSignals?: Array<{ label: string; weight: number; triggered: boolean }> | null;
  studentCount: number;
  slaDaysRemaining?: number | null;
  slaEscalated?: boolean;
  createdAt: string;
}

export interface SuperAdminSchoolContact {
  id: string;
  name: string;
  role: string;
  phone?: string | null;
  email?: string | null;
  isPrimary: boolean;
  createdAt: string;
}

export interface SuperAdminSchoolGroup {
  id: string;
  name: string;
  ownerName?: string | null;
  ownerEmail?: string | null;
  billingMode: string;
  createdAt: string;
  branchCount: number;
  totalStudents: number;
  branches: Array<{ id: string; name: string; totalStudents: number; plan: SubscriptionPlan; status: TenantStatus }>;
}

export type MigrationJobStatus =
  | "INVITED"
  | "FILES_AWAITED"
  | "IN_PROGRESS"
  | "PREVIEW_READY"
  | "SIGNED_OFF"
  | "COMPLETED"
  | "ROLLED_BACK";

export interface MigrationJobRow {
  id: string;
  schoolId: string;
  schoolName: string;
  sourceSystem: string;
  status: MigrationJobStatus;
  studentsExpected?: number | null;
  resultsExpected?: number | null;
  includeStudentsGuardians: boolean;
  includeStaffAccounts: boolean;
  includeHistoricalResults: boolean;
  includeFeesBalances: boolean;
  includeAttendanceHistory: boolean;
  includeBehaviouralRecords: boolean;
  filesReceivedAt?: string | null;
  retentionClockStartsAt?: string | null;
  previewSharedAt?: string | null;
  signedOffAt?: string | null;
  signedOffById?: string | null;
  signedOffByName?: string | null;
  rolledBackAt?: string | null;
  rollbackReason?: string | null;
  notes?: string | null;
  specialistId?: string | null;
  specialistName?: string | null;
  createdById?: string | null;
  createdByName?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MigrationSourceAdapterRow {
  id: string;
  name: string;
  status: string;
  notes?: string | null;
  createdAt: string;
}

export interface SuperAdminSchoolDetail {
  id: string;
  name: string;
  slug: string;
  category: string;
  ownerName?: string;
  ownerEmail?: string;
  ownerPhone?: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  plan: SubscriptionPlan;
  status: TenantStatus;
  billingStatus: PlatformBillingStatus;
  healthScore: number;
  featureFlags: Record<string, boolean>;
  trialEndsAt?: string;
  lastPaymentAt?: string;
  nextBillingAt?: string;
  createdAt: string;
  counts: Record<string, number>;
  admins: Array<{ id: string; name: string; email: string; role: Role; status: string; createdAt: string }>;
  prioritySupport: boolean;
  schoolGroup: { id: string; name: string } | null;
  dataExportedAt: string | null;
  statusReason?: string | null;
  statusChangedAt: string | null;
  accountManager: { id: string; name: string; email: string } | null;
  contacts: SuperAdminSchoolContact[];
  configuration: {
    academicSessionCount: number;
    termCount: number;
    activeGradingScheme: string | null;
    passMark: number | null;
    classLevelCount: number;
    classRoomCount: number;
    subjectCount: number;
  };
  usage: {
    moduleAdoptionCount: number;
    moduleTotal: number;
    lastActivityAt: string | null;
    notificationVolumeLast30Days: number;
    supportTicketCount: number;
    loginCountLast30Days: number;
  };
  activityLog: SuperAdminAuditLogRow[];
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

export interface SuperAdminUserProfile {
  id: string;
  name: string;
  email: string;
  phone?: string;
  role: string;
  status: string;
  lastLoginAt?: string;
  createdAt: string;
  school: { id: string; name: string; status: string; plan: string };
  profileType: string;
  recentSessions: Array<{ id: string; startedAt: string; lastActivityAt: string; device?: string | null; ipAddress?: string | null; active: boolean }>;
  activitySummary:
    | { type: "STAFF"; scoreEntriesSubmitted: number; attendanceMarked: number }
    | { type: "PARENT"; notificationsReceived: number }
    | { type: "ADMIN"; adminActionsTaken: number };
  linkedAccounts: Array<{ studentId: string; studentName: string; isPrimary: boolean }>;
}

export interface SuperAdminSuspiciousActivityRow {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  flagType: string;
  detail?: string | null;
  detectedAt: string;
}

export interface SuperAdminDuplicateFlagRow {
  id: string;
  matchCriteria: string;
  status: string;
  userA: { id: string; name: string; email: string; phone?: string | null };
  userB: { id: string; name: string; email: string; phone?: string | null };
  createdAt: string;
}

export interface SuperAdminAccountRecoveryRow {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  verificationMethod: string;
  newEmail?: string | null;
  verifiedBy: string;
  completedAt?: string;
  createdAt: string;
}

export interface SuperAdminUserCaseReviewContext {
  suspicious: Array<{
    flagId: string;
    schoolId: string;
    schoolName: string;
    accountStatus: string;
    isActive: boolean;
    suspendedAt?: string | null;
    passwordResetRequired: boolean;
    lastLoginAt?: string | null;
    loginAttempts: Array<{ success: boolean; reason?: string | null; ipAddress?: string | null; device?: string | null; createdAt: string }>;
  }>;
  duplicates: Array<{
    flagId: string;
    userA: { schoolId: string; schoolName: string; accountStatus: string; isActive: boolean };
    userB: { schoolId: string; schoolName: string; accountStatus: string; isActive: boolean };
  }>;
  recovery: Array<{
    recordId: string;
    schoolId: string;
    schoolName: string;
    accountStatus: string;
    isActive: boolean;
  }>;
}

export interface SuperAdminImpersonationLogRow {
  id: string;
  impersonatedBy: string;
  targetEmail: string;
  schoolName: string;
  reason?: string | null;
  startedAt: string;
  maxAgeSeconds?: number | null;
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
  commandCenter?: {
    pulse: {
      totalActiveSchools: number;
      totalStudents: number;
      schoolsOnline: number;
      uptime30Day: number;
      offlineSyncQueueSize: number;
      lastSuccessfulBackupAt?: string | null;
    };
    revenueSnapshot: {
      currentMonthRevenue: number;
      currentTermCollected: number;
      currentTermInvoiced: number;
      overdueBalances: number;
      overdueAging: Array<{ band: string; amount: number; count: number }>;
      monthOverMonthGrowth: number;
      newMrrThisMonth: number;
      notificationCreditRevenue: number;
    };
    subscriptionHealth: {
      trialsExpiringNext7Days: number;
      churnRiskSchools: number;
      gracePeriodSchools: number;
    };
    onboardingPipeline: {
      pendingVerification: number;
      schoolsInTrial: number;
      stuckMidOnboarding: number;
      convertedThisWeek: number;
    };
    supportQueue: {
      totalOpenTickets: number;
      criticalOpenTickets: number;
      ticketsBreachingSla: number;
      averageResolutionHoursThisWeek: number;
      averageResolutionHoursLastWeek: number;
    };
    systemHealth: {
      apiUptime: number;
      averageResponseMs: number;
      syncFailureRate24h: number;
      notificationDeliveryRate: number;
      activeInfrastructureAlerts: number;
    };
    geography: Array<{
      state: string;
      schoolCount: number;
      activeSchools: number;
      trialSchools: number;
      suspendedSchools: number;
      planMix: Record<string, number>;
    }>;
    alerts: Array<{
      id: string;
      severity: string;
      title: string;
      detail: string;
      actionHref: string;
    }>;
  };
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

export interface SuperAdminInvoiceRow {
  id: string;
  invoiceNo: string;
  schoolId: string;
  schoolName: string;
  amount: number;
  taxAmount: number;
  totalAmount: number;
  amountPaid: number;
  status: string;
  issuedAt: string;
  dueAt: string;
  paidAt?: string;
}

export interface SuperAdminChurnRiskRow {
  schoolId: string;
  schoolName: string;
  score: number;
  status: TenantStatus;
  plan: SubscriptionPlan;
  signals: string[];
  lastCalculatedAt: string | null;
}

export interface SuperAdminNotificationWallet {
  schoolId: string;
  smsBalance: number;
  whatsappBalance: number;
  lowBalanceThreshold: number;
  isLow: boolean;
  lastToppedUpAt: string | null;
}

export interface SuperAdminPromoCodeRow {
  id: string;
  code: string;
  type: string;
  value: number;
  campaignName?: string | null;
  maxUses?: number | null;
  uses: number;
  expiresAt?: string;
  isActive: boolean;
  totalDiscountIssued: number;
  schoolsConverted: number;
}

export interface SuperAdminRevenueReport {
  mrr: number;
  arpu: number;
  paidSchoolCount: number;
  revenueByTier: Array<{ plan: string; revenue: number }>;
  revenueByState: Array<{
    state: string;
    revenue: number;
    schoolCount: number;
    arpu: number;
    topCity: string | null;
    newSchools90d: number;
  }>;
  notificationCreditRevenue: number;
  creditRevenueSharePct: number;
  outstandingReceivables: number;
  unpaidSchoolCount: number;
  renewalRate: number;
  renewedRecently: number;
  activeSchoolCount: number;
  ltvByTier: Array<{ plan: string; revenue: number; avgTenureMonths: number; termlyValue: number; ltv: number }>;
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
  classId?: string;
  broadsheetId?: string;
  term: string;
  session?: string;
  status: "DRAFT" | "GENERATED" | "PUBLISHED" | "LOCKED";
  total: number;
  average: number;
  grade?: string;
  reportCardUrl?: string;
  publishedAt?: string;
  lockedAt?: string;
  /** Present when the underlying result sheet recorded a class-teacher comment for this student's term. */
  classTeacherRemark?: string;
  /** Present when the underlying result sheet recorded a principal comment for this student's term. */
  principalRemark?: string;
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
  topPerformers?: Array<{ studentName: string; className: string; average: number; grade?: string; position?: number }>;
}

export interface ExamOfficerExamView {
  id: string;
  title: string;
  subject: string;
  className: string;
  session?: string;
  term: string;
  assessmentDate: string;
  status: string;
  submissionMode: string;
  candidateCount: number;
  enteredCount: number;
  completionRate: number;
  teacherName?: string;
}

export interface ExamOfficerScoreStatusView {
  assessmentId: string;
  examTitle: string;
  subject: string;
  className: string;
  session?: string;
  term: string;
  entered: number;
  total: number;
  completionRate: number;
  status: "COMPLETE" | "IN_PROGRESS" | "NOT_STARTED";
  assessmentDate: string;
}

export interface ExamOfficerTimetableEntryView {
  id: string;
  classId: string;
  className: string;
  subjectId: string;
  subject: string;
  session?: string;
  term?: string;
  examDate: string;
  startsAt: string;
  endsAt: string;
  venue?: string;
  candidateCount: number;
  invigilators: Array<{
    id: string;
    staffId: string;
    staffName: string;
    hall?: string;
    status: string;
  }>;
}

export interface ExamOfficerPublicationView {
  broadsheetId: string;
  classId?: string;
  className: string;
  session?: string;
  term: string;
  status: string;
  approvalStage: string;
  publishedAt?: string;
  lockedAt?: string;
  missingWarnings: number;
  studentCount: number;
  completeStudents: number;
  commentsReady: number;
  metrics?: {
    classAverage?: number;
  };
}

export interface ExamOfficerQuestionBankView {
  id: string;
  subject: string;
  className?: string;
  assessmentType: string;
  difficulty: string;
  status: string;
  questionPreview: string;
  createdAt: string;
  teacherName?: string;
}

export interface ExamOfficerDashboardView {
  currentSession?: string;
  currentTerm?: string;
  metrics: {
    activeExams: number;
    totalScoresEntered: number;
    totalScoresExpected: number;
    publishedClasses: number;
    totalPublicationTargets: number;
    upcomingExams: number;
  };
  scoreEntryStatus: ExamOfficerScoreStatusView[];
  upcomingTimetable: ExamOfficerTimetableEntryView[];
  recentActivity: Array<{
    id: string;
    action: string;
    entityType: string;
    detail: string;
    createdAt: string;
  }>;
  quickLinks: Array<{
    label: string;
    href: string;
  }>;
}

export interface InvoiceView {
  id: string;
  invoiceNumber: string;
  studentId?: string;
  studentName: string;
  admissionNumber?: string;
  classId?: string;
  className: string;
  classLevel?: string;
  sessionId?: string;
  session?: string;
  termId?: string;
  term?: string;
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
  paymentCount?: number;
  lastPaymentAt?: string;
}

export interface FeeStructureView {
  id: string;
  name: string;
  currency?: string;
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

export interface FeeAssignmentView {
  id: string;
  studentId: string;
  studentName: string;
  admissionNumber?: string;
  className?: string;
  classLevel?: string;
  feeStructureId: string;
  feeStructureName: string;
  sessionId?: string;
  session?: string;
  termId?: string;
  term?: string;
  amountDue: number;
  discount: number;
  finalAmount: number;
  dueDate?: string;
  status: string;
  discountReason?: string;
  approvalStatus?: string;
  invoiceId?: string;
  invoiceNumber?: string;
  createdAt: string;
}

export interface PaymentView {
  id: string;
  reference: string;
  studentId?: string;
  studentName: string;
  admissionNumber?: string;
  classId?: string;
  className?: string;
  classLevel?: string;
  sessionId?: string;
  session?: string;
  termId?: string;
  term?: string;
  invoiceId?: string;
  invoiceNumber?: string;
  receiptNumber?: string;
  amount: number;
  status: string;
  method: string;
  paymentMethod?: string;
  provider?: string;
  paymentNumber?: string;
  paymentChannel?: string;
  schoolBankReference?: string;
  gatewayStatus?: string;
  recordedByName?: string;
  isReversed?: boolean;
  reversalReason?: string;
  reversedAt?: string;
  paidAt?: string;
  paymentDate?: string;
  createdAt?: string;
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
  studentId?: string;
  studentName: string;
  className?: string;
  classLevel?: string;
  sessionId?: string;
  session?: string;
  termId?: string;
  term?: string;
  invoiceNumber?: string;
  totalAmount: number;
  balance: number;
  status: string;
  notes?: string;
  items: Array<{ id: string; dueOn: string; amount: number; paidAmount: number; status: string }>;
}

export interface FinanceDashboardView {
  metrics: Array<{ label: string; value: string; tone: string }>;
  feeStructures: FeeStructureView[];
  feeAssignments?: FeeAssignmentView[];
  invoices: InvoiceView[];
  payments: PaymentView[];
  installmentPlans: InstallmentPlanView[];
  expenditures?: ExpenditureView[];
  payrollRuns?: PayrollRunView[];
  auditTrail: Array<{ id: string; action: string; entityType: string; entityId: string; createdAt: string; detail: string }>;
}

export interface ExpenditureView {
  id: string;
  category: string;
  description: string;
  amount: number;
  paymentMethod?: string;
  paidTo?: string;
  receiptUrl?: string;
  recordedById?: string;
  recordedByName?: string;
  expenditureDate: string;
  notes?: string;
}

/**
 * A real, applied invoice adjustment (discount, waiver, or scholarship credit)
 * — sourced from `InvoiceAdjustment`, the table the finance module actually
 * writes to when a discount/waiver is applied to an invoice. Prefixed
 * `FeesModule` to avoid name collisions with parallel work on other modules.
 */
export interface FeesModuleDiscountView {
  id: string;
  type: string;
  valueType: string;
  value: number;
  amount: number;
  reason: string;
  studentId?: string;
  studentName: string;
  admissionNumber?: string;
  className?: string;
  invoiceId: string;
  invoiceNumber: string;
  appliedByName?: string;
  approvedByName?: string;
  createdAt: string;
}

export interface PayrollItemView {
  id: string;
  staffId: string;
  staffName: string;
  employeeNo?: string;
  designation?: string;
  departmentName?: string;
  basicSalary: number;
  allowances: Record<string, number>;
  deductions: Record<string, number>;
  netSalary: number;
  payslipSent: boolean;
  paidAt?: string;
}

export interface PayrollRunView {
  id: string;
  sessionId?: string;
  session?: string;
  month: number;
  year: number;
  status: string;
  processedById?: string;
  processedByName?: string;
  processedAt?: string;
  publishedAt?: string;
  totalNetSalary: number;
  staffCount: number;
  items: PayrollItemView[];
}

export interface PayrollStaffMemberView {
  id: string;
  userId?: string;
  staffName: string;
  employeeNo: string;
  departmentName?: string;
  designation: string;
  employmentType?: string;
  salaryBand?: string;
  accountStatus?: string;
  isActive: boolean;
  lastBasicSalary?: number;
  lastNetSalary?: number;
  lastPayrollMonth?: number;
  lastPayrollYear?: number;
}

export interface PayrollWorkspaceView {
  currentSessionId?: string;
  currentSessionName?: string;
  sessions: Array<{ id: string; name: string }>;
  staff: PayrollStaffMemberView[];
  payrollRuns: PayrollRunView[];
}

export interface BudgetAllocationView {
  id: string;
  department: string;
  sessionId?: string;
  session?: string;
  allocatedAmount: number;
  spentAmount: number;
}

export interface AuditLogView {
  id: string;
  userId?: string;
  userName?: string;
  action: string;
  entityType: string;
  entityId: string;
  oldValue?: Record<string, unknown> | null;
  newValue?: Record<string, unknown> | null;
  ipAddress?: string;
  detail?: string;
  timestamp: string;
}

export interface FinanceSettingsView {
  currency: string;
  paymentMethods: string[];
  sessionConfig?: {
    currentSession?: string;
    currentTerm?: string;
  };
  allowOverpayment: boolean;
  reminderScheduleDays: number[];
  receiptPrefix: string;
}

export interface StudentFinanceAdjustmentView {
  id: string;
  type: string;
  valueType: string;
  value: number;
  amount: number;
  reason: string;
  createdAt: string;
  approvedByName?: string;
  invoiceNumber?: string;
  session?: string;
  term?: string;
}

export interface StudentFinanceLedgerView {
  studentId: string;
  studentName: string;
  admissionNumber: string;
  status: string;
  className: string;
  classLevel?: string;
  currentSession?: string;
  guardianName?: string;
  guardianPhone?: string;
  guardianEmail?: string;
  metrics: {
    totalBilled: number;
    totalPaid: number;
    outstanding: number;
    overdueInvoices: number;
    activeInstallmentPlans: number;
    lastPaymentAt?: string;
  };
  invoices: InvoiceView[];
  payments: PaymentView[];
  installmentPlans: InstallmentPlanView[];
  adjustments: StudentFinanceAdjustmentView[];
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
  classId?: string;
  subjectId?: string;
  startsAt?: string;
  endsAt?: string;
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
  admissionNumber?: string;
  classId: string;
  className: string;
  classLevel?: string;
  subjectId?: string;
  subject?: string;
  status: "PRESENT" | "ABSENT" | "LATE" | "EXCUSED";
  date: string;
  reason?: string;
}

export interface TeacherAttendanceWorkspaceView extends SchoolContextView {
  records: TeacherAttendanceEntryView[];
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

export type MyWorkTone = "neutral" | "accent" | "success" | "warning" | "danger" | "info" | "brand";
export type MyWorkNowIcon = "tickets" | "approvals" | "schools" | "deals";

export interface MyWorkNowCard {
  id: string;
  icon: MyWorkNowIcon;
  pill: string;
  tone: MyWorkTone;
  value: number;
  unit: string;
  label: string;
  note: string;
  action: string;
  link: string;
}

export interface MyWorkSchoolRow {
  id: string;
  name: string;
  meta: string;
  status: string;
  signal: string;
  action: string;
  link: string;
}

export interface MyWorkCaseRow {
  id: string;
  subject: string;
  module: string;
  type: string;
  sla: string;
  slaTone: MyWorkTone;
  age: string;
  link: string;
}

export interface MyWorkApprovalItem {
  id: string;
  title: string;
  meta: string;
  pill: string;
  tone: MyWorkTone;
  approveEndpoint: string;
  approveMethod: "PATCH" | "POST";
  approveBody?: Record<string, unknown>;
  approveLabel: string;
  declineEndpoint: string;
  declineMethod: "PATCH" | "POST";
  declineBody?: Record<string, unknown>;
  declineNeedsReason: boolean;
}

export interface MyWorkTicketBreakdownRow {
  priority: string;
  tone: MyWorkTone;
  count: number;
  percent: number;
}

export interface MyWorkSummary {
  refreshedAt: string;
  now: MyWorkNowCard[];
  schools: {
    source: "account_manager" | "open_case";
    portfolioTotal: number;
    signalTotal: number;
    rows: MyWorkSchoolRow[];
  };
  cases: MyWorkCaseRow[];
  approvals: MyWorkApprovalItem[];
  tickets: MyWorkTicketBreakdownRow[];
}

export interface SuperAdminTicketRow {
  id: string;
  ticketNo: string;
  schoolId: string;
  schoolName: string;
  subject: string;
  category: string;
  priority: string;
  status: string;
  assignedTo: string;
  messageCount: number;
  slaDueAt?: string;
  slaBreached: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SuperAdminDataCorrectionRow {
  id: string;
  ticketId: string;
  ticketNo: string;
  schoolName: string;
  fieldCorrected: string;
  oldValue: string;
  newValue: string;
  status: string;
  requestedBy: string | null;
  approvedBy: string | null;
  createdAt: string;
  completedAt: string | null;
}

export interface SuperAdminTicketDetail {
  id: string;
  ticketNo: string;
  schoolId: string;
  schoolName: string;
  subject: string;
  description: string;
  category: string;
  priority: string;
  status: string;
  assignedTo: { id: string; name: string } | null;
  createdBy: string;
  slaDueAt?: string;
  slaBreached: boolean;
  resolvedAt?: string;
  closedAt?: string;
  createdAt: string;
  messages: Array<{ id: string; body: string; internalOnly: boolean; author: string; createdAt: string }>;
  csat: { score: number; comment?: string | null; submittedAt: string } | null;
  dataCorrectionRecords: Array<{ id: string; fieldCorrected: string; oldValue: string; newValue: string; status: string; completedAt?: string; createdAt: string }>;
}

export interface SuperAdminCannedResponse {
  id: string;
  category: string;
  title: string;
  body: string;
  updatedAt: string;
}

export interface SuperAdminKnowledgeBaseArticle {
  id: string;
  title: string;
  slug: string;
  category: string;
  roleTarget?: string | null;
  status: string;
  views: number;
  helpfulYes: number;
  helpfulNo: number;
  author: string;
  updatedAt: string;
  publishedAt: string | null;
}

export interface SuperAdminTicketAnalytics {
  totalOpened: number;
  totalResolved: number;
  resolvedWithinSla: number;
  avgResolutionByPriority: Record<string, number>;
  categoryBreakdown: Array<{ category: string; count: number }>;
  perAgent: Array<{ agentId: string | null; agentName: string; ticketsHandled: number; avgCsat: number | null }>;
}

export interface SuperAdminFeatureFlagRow {
  id: string;
  key: string;
  name: string;
  description?: string | null;
  enabledGlobally: boolean;
  rolloutStatus: string;
  rolloutPercent: number;
  pilotSchoolCount: number;
  overrides: number;
  createdAt: string;
}

export interface SuperAdminTierFeatureRow {
  id: string;
  name: string;
  module: string;
  starterAccess: boolean;
  standardAccess: boolean;
  eliteAccess: boolean;
}

export interface SuperAdminFeatureOverrideRow {
  id: string;
  flagName: string;
  flagKey: string;
  schoolId: string;
  schoolName: string;
  overrideStatus: string;
  status: string;
  reason?: string | null;
  expiryDate?: string;
  requestedBy: string;
  approvedBy?: string | null;
  createdAt: string;
}

export interface SuperAdminBrandingAssetRow {
  id: string;
  schoolId: string;
  schoolName: string;
  logoUrl?: string | null;
  primaryColour: string;
  secondaryColour: string;
  status: string;
  appliedTo: string;
  appliedAt?: string;
  approvedBy?: string | null;
  createdAt: string;
}

export interface SuperAdminPlanRow {
  id: string;
  name: string;
  slug: string;
  plan: string;
  monthlyPrice: number;
  annualPrice: number;
  studentLimit?: number | null;
  staffLimit?: number | null;
  storageLimitGb?: number | null;
  smsUnitsPerMonth: number;
  emailSendsPerMonth: number;
  supportTier: string;
  apiAccess: boolean;
  customBranding: boolean;
  includedModules: unknown;
  isActive: boolean;
  subscriberCount: number;
  createdAt: string;
}

export interface SuperAdminFeatureFlagCaseHistoryEvent {
  what: string;
  when: string;
}

export interface SuperAdminFeatureFlagCaseHistory {
  overrides: Record<string, SuperAdminFeatureFlagCaseHistoryEvent[]>;
  branding: Record<string, SuperAdminFeatureFlagCaseHistoryEvent[]>;
}

export interface SuperAdminPlanLifecycleRow {
  id: string;
  schoolId: string | null;
  schoolName: string;
  toPlan: string;
  changedBy: string;
  changedAt: string;
}

export interface SuperAdminCampaignRow {
  id: string;
  name: string;
  type: string;
  channel: string;
  status: string;
  recipientCount: number;
  deliveredCount: number;
  failedCount: number;
  openedCount: number;
  scheduledAt?: string;
  sentAt?: string;
  createdBy: string;
  approvedBy?: string | null;
  createdAt: string;
}

export interface SuperAdminMessageTemplateRow {
  id: string;
  name: string;
  channel: string;
  category: string;
  body: string;
  placeholders: string[];
  approvalStatus: string;
  metaTemplateId?: string | null;
  updatedAt: string;
}

export interface SuperAdminConsentRow {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  channel: string;
  optedIn: boolean;
  optedOutAt?: string;
  updatedAt: string;
}

export interface SuperAdminBiOverview {
  heatmap: Array<{ module: string; schoolsUsing: number; adoptionPct: number; level: string }>;
  funnel: Array<{ stage: string; count: number }>;
  cohorts: Array<{ cohort: string; joined: number; stillActive: number; retentionPct: number }>;
  featureRequests: Array<{ keyword: string; requestCount: number; schoolsRequesting: number; priorityScore: number }>;
  schoolsActiveThisWeek: number;
}

export interface SuperAdminChurnAnalysis {
  total: number;
  byReason: Array<{ reason: string; count: number; pct: number }>;
  byTier: Array<{ plan: string; churned: number; ratePct: number }>;
  recent: Array<{ id: string; schoolName: string; reason: string; notes?: string | null; churnedAt: string }>;
}

export interface SuperAdminNpsAnalytics {
  npsScore: number;
  total: number;
  promoters: number;
  passives: number;
  detractors: number;
  byTier: Array<{ plan: string; responses: number; npsScore: number }>;
  lowScoreFlags: Array<{ id: string; schoolName: string; score: number; comment?: string | null; createdAt: string }>;
  comments: Array<{ schoolName: string; score: number; comment?: string | null }>;
}

export interface SuperAdminCustomReportRow {
  id: string;
  name: string;
  dimension: string;
  metric: string;
  generatedAt?: string;
  createdBy: string;
  createdAt: string;
}

export interface SuperAdminInfraMonitoring {
  uptime: { apiUptime: number; avgResponseMs: number; apiUptimeStatus: string; responseStatus: string; requestsLast24h: number };
  syncQueue: { pending: number; failedOver24h: number; oldestAgeHours: number; oldestSchool: string | null; failureRate: number; status: string };
  deliveryHealth: Array<{ channel: string; total: number; failureRate: number; status: string }>;
  integrations: Array<{ name: string; checkFrequency: string; status: string; onFailure: string }>;
  backups: { lastSuccessfulAt: string | null; recent: Array<{ id: string; scope: string; status: string; sizeMb?: number | null; school: string; startedAt: string; endedAt?: string }> };
  generatedAt: string;
}

export interface SuperAdminComputationMonitoring {
  assessments: { pendingApproval: number; oldestAgeHours: number | null; oldestLabel: string | null; status: string };
  broadsheets: { pending: number; oldestAgeHours: number | null; oldestLabel: string | null; status: string; avgCompileHours: number | null };
  reportCards: { pending: number; oldestAgeHours: number | null; oldestLabel: string | null; status: string };
  generatedAt: string;
}

export interface SuperAdminConfigLibrary {
  curricula: Array<{ id: string; name: string; country: string; subjectCount: number; calendarType: string; version: string; isActive: boolean }>;
  gradingScales: Array<{ id: string; name: string; bandCount: number; passMark: number; applicableCurricula: string[]; isActive: boolean }>;
  reportCards: Array<{ id: string; name: string; applicableCurricula: string[]; availableToTiers: string[]; isActive: boolean }>;
}

export interface SuperAdminInternalMember {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  lastLoginAt?: string;
  createdAt: string;
  revokedAt?: string;
}

export interface SuperAdminDepartmentRow {
  id: string;
  name: string;
  lead: string;
  createdAt: string;
}

export interface SuperAdminPermissionTemplateRow {
  id: string;
  roleName: string;
  modules: number;
  defaultGrid: unknown;
  updatedAt: string;
}

export interface SuperAdminTeamActivity {
  schoolsOnboardedThisMonth: number;
  members: Array<{ id: string; name: string; role: string; lastLoginAt?: string; ticketsResolved: number; actionsTaken: number }>;
}

export interface SuperAdminPermissionGridMatrix {
  modules: string[];
  members: Array<{ id: string; name: string; role: string; access: Record<string, string> }>;
}

export interface SuperAdminInternalSession {
  id: string;
  userId: string;
  name: string;
  email: string;
  role: string;
  ipAddress: string | null;
  device: string | null;
  lastActivityAt: string;
  expiresAt: string;
  createdAt: string;
}

export interface SuperAdminIpAccessRule {
  id: string;
  ipAddress: string;
  type: string;
  reason: string | null;
  createdAt: string;
}

export type PartnerDealStatus = "REGISTERED" | "CONVERTED" | "EXPIRED" | "COMMISSION_PAID";

export interface SuperAdminPartnerRow {
  id: string;
  name: string;
  territory: string | null;
  agreementReference: string | null;
  agreementValidTo: string | null;
  commissionRatePercent: number;
  isActive: boolean;
  createdAt: string;
  dealCount: number;
}

export interface SuperAdminPartnerDealRow {
  id: string;
  partnerId: string;
  partnerName: string;
  schoolId: string | null;
  schoolName: string | null;
  prospectSchoolName: string;
  prospectLocation: string | null;
  expectedTier: string | null;
  stream: string | null;
  introductionEvidence: string | null;
  registeredAt: string;
  validUntil: string;
  status: PartnerDealStatus;
  commissionRatePercent: number;
  convertedAt: string | null;
  createdAt: string;
  grossRevenue: number;
  commissionOwed: number;
}

export interface SuperAdminPartnerCommissionStatement {
  dealId: string;
  schoolId: string;
  schoolName: string;
  commissionRatePercent: number;
  grossRevenue: number;
  commissionOwed: number;
  status: PartnerDealStatus;
}

export interface SuperAdminPartnerCommissionSummaryRow {
  partnerId: string;
  partnerName: string;
  territory: string | null;
  convertedDealCount: number;
  totalCommissionOwed: number;
  totalCommissionPaid: number;
  totalCommissionPending: number;
  statements: SuperAdminPartnerCommissionStatement[];
}
