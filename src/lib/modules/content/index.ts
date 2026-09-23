import type { ModuleContent, TabContent } from "@/lib/modules/panels";
import { approvalsWorkflowContent } from "@/lib/modules/content/m13-approvals-workflow";
import { attendanceContent } from "@/lib/modules/content/m4-attendance";
import { scoreEntryResultsContent } from "@/lib/modules/content/m5-score-entry-results";
import { parentsGuardiansContent } from "@/lib/modules/content/m9-parents-guardians";
import { studentRecordsContent } from "@/lib/modules/content/m8-student-records";
import { feeManagementContent } from "@/lib/modules/content/m10-fee-management";
import { reportCardsContent } from "@/lib/modules/content/m6-report-cards";
import { commandCenterContent } from "@/lib/modules/content/m1-command-center";
import { schoolModulesByCode } from "@/lib/modules/school-modules";

/**
 * Panels the mockup defines for each module, as extracted from its source.
 *
 * Modules that are not yet ported render these as an explicit "not built yet"
 * panel naming what belongs there, rather than an empty page that reads as
 * finished. Replace a module's entry here with real content as it is built.
 */
const plannedPanels: Record<string, string[]> = {
  m2: [
    "Identity",
    "Address and authority",
    "Branding",
    "Data processing agreement",
    "Terms in 2026/2027",
    "Assessment windows",
    "Events",
    "All curricula",
    "Curricula",
    "All allocations",
    "A list is a standard the school sets, not a shop",
    "Academic and attendance policy",
    "Family, finance and communication policy",
    "This term",
  ],
  m3: [
    "Classes",
    "Class arms",
    "Recent allocations",
    "Structure",
    "Invalid subject combinations",
    "Subject catalogue",
    "Teachers and what they teach",
    "Registration rules in force",
    "Bulk registration",
    "All timetables",
    "What is running, by arm",
    "Running timetable · JSS 2A, Thursday",
    "What changed, and who was told",
    "Timetable details",
  ],
  m4: [
    "Choose an arm to mark",
    "Today, across the school",
    "Every arm, today",
    "By teacher",
    "Guardian explanations",
    "Thursday, 4 September",
    "Trend by arm",
    "Students needing attention",
    "Corrections and backdating",
    "What the rules are",
    "Breaches by teacher",
    "Unmarked registers",
    "Missing days per arm, this term",
    "Backdated entries",
  ],
  m5: [
    "Every child in ",
    "Grade spread",
    "Checks run on this sheet",
    "Broadsheet · ",
    "Where each subject stands",
    "Subjects offered to ",
    "Sheets outstanding across the school",
    "What you are about to submit",
    "This arm, this component",
    "This component",
    "Choose the class and arm",
    "By arm",
    "Submission tracker",
    "Verification",
  ],
  m6: [
    "Students",
    "Who is behind",
    "Report cards by arm",
    "What is holding the school up",
    "How publishing works here",
    "Issued cards",
    "Revisions",
    "Print batch history",
    "The school this term",
  ],
  m7: [
    "Staff",
    "Active delegations",
    "Account states in use",
    "Who can reach what",
    "Role templates",
    "Sensitive groups",
    "Access that needs a decision this term",
    "Access across the school",
    "This term, by staff member",
    "Every module this template grants",
    "Who is on this template",
    "How a template behaves",
    "Bands",
    "Staff on the payroll",
  ],
  m8: [
    "Every student",
    "Applicants in this cycle",
    "Screening and entrance assessment diary",
    "What is holding this cycle up",
    "Conversion by class applied for",
    "Every cycle since the school opened",
    "Pending changes",
    "Approved this term",
    "Record completeness",
    "Suspected duplicates",
    "Migration state",
    "Children mapped to this guardian",
    "Contact",
    "Consent on file",
  ],
  m9: [
    "Every family",
    "Possible duplicates",
    "Can the school actually reach these families",
    "Families",
    "Inbound submissions",
    "Service level by type",
    "The consents this school needs",
    "What each family has given",
    "Withdrawals",
    "How consent is evidenced here",
    "What this family was billed, child by child",
    "Every payment this family has made",
    "How this balance aged",
    "Every conversation about this balance",
  ],
  m10: [
    "Fee status · your form class",
    "Payments received",
    "Debtor list",
    "Collection rate by level",
    "By payment method",
    "Fee item breakdown",
    "Second Term 2026/2027",
    "Every fee structure",
    "Adjustment rules",
    "Fee structures",
    "Term by term",
    "By section, this session",
    "Receipt archive",
    "Daily cash-up",
  ],
  m11: [
    "What is running on this account",
    "Value this session",
    "Invoices from Future Realm",
    "Plan comparison",
    "Second Term 2026/2027",
    "Every channel",
    "Top-up history",
    "What each channel costs",
    "Data processing agreement",
    "Contacts and web address",
    "The wallet",
  ],
  m12: [
    "Who is this going to",
    "Channels",
    "Audience",
    "Message",
    "Campaigns",
    "Failed deliveries",
    "Oversight",
    "Notification rules",
    "Templates",
  ],
  m13: [
    "Chemistry SSS 2A · score correction",
    "Waiting on me",
    "Raised by me",
    "All · in flight",
    "By approver",
    "By type · which categories move and which stall",
    "By requester",
    "Approval routes",
    "Standing rules",
    "Permanently excluded from bulk approval",
    "The route as it stands",
    "What happens at each step",
    "Recent decisions on this route",
    "How work is routed",
  ],
  m14: [
    "Compliance returns",
    "What is missing before a return can be filed",
    "How a return is produced here",
    "Filed and archived",
    "Returns this school owes",
    "Academic · grade distribution",
    "Academic · subject comparison",
    "Attendance & enrolment",
    "Financial",
    "Engagement",
    "Standard reports",
    "Custom reports",
    "Data export",
  ],
  m15: [
    "Future Realm access",
    "Audit entries",
    "Integrity flags",
    "Security",
    "Subject requests",
    "Retention schedule",
    "Accountability",
  ],
  m16: [
    "Pending queue",
    "Conflicts",
    "What works offline",
    "Quick-start guides",
    "Your tickets",
    "Articles and walkthroughs",
  ],
};

function pendingContent(code: string): ModuleContent {
  const module = schoolModulesByCode[code];
  const panels = plannedPanels[code] ?? [];

  return Object.fromEntries(
    module.tabs.map((tab): [string, TabContent] => [
      tab.slug,
      {
        title: tab.label,
        desc: module.description,
        rows: [
          {
            cols: "1fr",
            panels: [
              {
                type: "pending",
                title: `${module.name} · ${tab.label}`,
                body: `The mockup defines this module as "${module.description}" The panels below are what it puts across ${module.name}'s ${module.tabs.length} tabs. This tab's own surface is not built yet.`,
                contains: panels,
              },
            ],
          },
        ],
      },
    ]),
  );
}

/** Content for every module, keyed by module code. */
export const moduleContent: Record<string, ModuleContent> = {
  m1: commandCenterContent,
  m2: pendingContent("m2"),
  m3: pendingContent("m3"),
  m4: attendanceContent,
  m5: scoreEntryResultsContent,
  m6: reportCardsContent,
  m7: pendingContent("m7"),
  m8: studentRecordsContent,
  m9: parentsGuardiansContent,
  m10: feeManagementContent,
  m11: pendingContent("m11"),
  m12: pendingContent("m12"),
  m13: approvalsWorkflowContent,
  m14: pendingContent("m14"),
  m15: pendingContent("m15"),
  m16: pendingContent("m16"),
};

export function getTabContent(code: string, tabSlug: string): TabContent | undefined {
  return moduleContent[code]?.[tabSlug];
}
