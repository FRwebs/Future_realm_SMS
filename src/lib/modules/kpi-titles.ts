import type { PanelRow } from "@/lib/modules/panels";

/**
 * Every card row is named after what it actually counts, keyed by
 * `<module code>:<tab label>` exactly as the mockup keys them. A generic word
 * repeated on forty screens is filler; this says what you are looking at.
 */
const KPI_TITLES: Record<string, string> = {
  "m1:Today": "Where the school stands today",
  "m1:Oversight": "What is drifting",
  "m2:Profile": "Configuration completeness",
  "m2:Calendar": "This term at a glance",
  "m2:Curriculum": "What this school teaches",
  "m2:Allocations": "What each class needs this term",
  "m2:Policies": "Policies in force",
  "m3:Subjects": "Subject registration",
  "m3:Teaching": "Teaching cover",
  "m3:Timetable": "Timetables in this school",
  "m3:Coverage": "Is this school ready to teach",
  "m4:Register": "The whole school today",
  "m4:Mark": "Marking a register",
  "m4:Compliance": "Attendance compliance",
  "m4:Log": "Attendance trends",
  "m5:Review": "Where every arm stands",
  "m5:Enter": "Entering scores",
  "m5:Results": "Computed results",
  "m6:Remarks": "Remark completion",
  "m6:Completion": "Report cards this term",
  "m6:Archive": "Everything ever issued",
  "m7:Directory": "Staff and activation",
  "m7:Permissions": "Access in force",
  "m7:Activity": "What staff have done",
  "m7:Payroll": "This month’s payroll",
  "m7:Leave": "Who is away, and who has asked",
  "m7:Appraisal": "Where the cycle stands",
  "m8:Registry": "The student body",
  "m8:Admissions": "The admissions pipeline",
  "m8:Changes": "Record changes",
  "m9:Guardians": "Families and their reach",
  "m9:Submissions": "What families have sent in",
  "m9:Consent": "Consent on record",
  "m10:Collections": "Where the money is",
  "m10:Structures": "Fee structures",
  "m10:Payments": "Payments taken",
  "m10:Review": "Finance exceptions",
  "m11:Plan": "Your plan",
  "m11:Credits": "Message credits",
  "m11:Account": "Account standing",
  "m12:Compose": "Reach and cost",
  "m12:Sent": "Everything sent in the school’s name",
  "m12:Automation": "Automated messages",
  "m13:Queue": "Decisions waiting",
  "m13:Performance": "Are decisions being made",
  "m13:Workflow": "How work is routed",
  "m14:Insights": "The school in numbers",
  "m14:Reports": "Reports and exports",
  "m14:Compliance": "Returns and evidence",
  "m15:Audit Log": "What happened",
  "m15:Monitoring": "What is being watched",
  "m15:Data Protection": "Data protection standing",
  "m16:Sync": "Is my work saved",
  "m16:Help & Support": "Getting help",
};

export function kpiTitle(moduleCode: string, tabLabel: string): string {
  return KPI_TITLES[`${moduleCode}:${tabLabel}`] ?? "Summary";
}

/** Gives every untitled card row in a tab its heading. */
export function withKpiTitles(rows: PanelRow[], moduleCode: string, tabLabel: string): PanelRow[] {
  return rows.map((panelRow) => ({
    ...panelRow,
    panels: panelRow.panels.map((panel) =>
      panel.type === "kpi" && !panel.title
        ? { ...panel, title: kpiTitle(moduleCode, tabLabel) }
        : panel,
    ),
  }));
}
