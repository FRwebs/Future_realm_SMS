import type { ModuleContent, TabContent } from "@/lib/modules/panels";
import { approvalsWorkflowContent } from "@/lib/modules/content/m13-approvals-workflow";
import { attendanceContent } from "@/lib/modules/content/m4-attendance";
import { scoreEntryResultsContent } from "@/lib/modules/content/m5-score-entry-results";
import { parentsGuardiansContent } from "@/lib/modules/content/m9-parents-guardians";
import { studentRecordsContent } from "@/lib/modules/content/m8-student-records";
import { feeManagementContent } from "@/lib/modules/content/m10-fee-management";
import { reportCardsContent } from "@/lib/modules/content/m6-report-cards";
import { commandCenterContent } from "@/lib/modules/content/m1-command-center";
import { schoolConfigurationContent } from "@/lib/modules/content/m2-school-configuration";
import { classTimetableContent } from "@/lib/modules/content/m3-class-timetable";
import { staffAccessContent } from "@/lib/modules/content/m7-staff-access";
import { subscriptionBillingContent } from "@/lib/modules/content/m11-subscription-billing";
import { communicationCenterContent } from "@/lib/modules/content/m12-communication-center";
import { analyticsReportsContent } from "@/lib/modules/content/m14-analytics-reports";
import { auditSecurityContent } from "@/lib/modules/content/m15-audit-security";
import { syncSupportContent } from "@/lib/modules/content/m16-sync-support";

/** Content for every module, keyed by module code. */
export const moduleContent: Record<string, ModuleContent> = {
  m1: commandCenterContent,
  m2: schoolConfigurationContent,
  m3: classTimetableContent,
  m4: attendanceContent,
  m5: scoreEntryResultsContent,
  m6: reportCardsContent,
  m7: staffAccessContent,
  m8: studentRecordsContent,
  m9: parentsGuardiansContent,
  m10: feeManagementContent,
  m11: subscriptionBillingContent,
  m12: communicationCenterContent,
  m13: approvalsWorkflowContent,
  m14: analyticsReportsContent,
  m15: auditSecurityContent,
  m16: syncSupportContent,
};

export function getTabContent(code: string, tabSlug: string): TabContent | undefined {
  return moduleContent[code]?.[tabSlug];
}
