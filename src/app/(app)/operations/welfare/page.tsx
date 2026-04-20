import { CanDo } from "@/components/auth/permission-provider";
import { TableCard } from "@/components/data-display/table-card";
import { ResourceActionDialog } from "@/components/forms/resource-action-dialog";
import { apiGet } from "@/lib/api/server";

type StudentRef = { firstName: string; lastName: string; admissionNumber?: string | null };
type UserRef = { firstName: string; lastName: string; email: string };

type DisciplineRecord = {
  id: string;
  category: string;
  severity: string;
  status: string;
  description: string;
  occurredAt: string;
  student: StudentRef;
  reporter?: UserRef | null;
};

type CounselingRecord = {
  id: string;
  category: string;
  summary: string;
  followUpDate?: string | null;
  student: StudentRef;
  counselor: UserRef;
};

type HealthVisit = {
  id: string;
  complaint: string;
  treatment?: string | null;
  visitedAt: string;
  student: StudentRef;
  nurse?: UserRef | null;
};

function studentLabel(student: StudentRef) {
  return `${student.firstName} ${student.lastName}`;
}

async function safeList<T>(path: string) {
  try {
    return await apiGet<T[]>(path);
  } catch {
    return [];
  }
}

export default async function WelfareOperationsPage() {
  const [discipline, counseling, health] = await Promise.all([
    safeList<DisciplineRecord>("/api/v1/operations/discipline"),
    safeList<CounselingRecord>("/api/v1/operations/counseling"),
    safeList<HealthVisit>("/api/v1/operations/health")
  ]);

  return (
    <div className="space-y-8">
      <section className="rounded-[2rem] border border-white/60 bg-white/90 p-6 shadow-panel">
        <p className="text-[0.72rem] font-semibold uppercase tracking-[0.28em] text-brand-700">
          Welfare desk
        </p>
        <div className="mt-3 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="font-[var(--font-heading)] text-3xl font-bold tracking-tight text-ink md:text-4xl">
              Welfare, Discipline & Sick Bay
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-ink/65">
              Log incidents, coordinate counselling, record sick-bay visits, and keep parent escalation history visible to the right staff only.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <CanDo permission="discipline.create">
              <ResourceActionDialog
                triggerLabel="Log Incident"
                title="Log discipline incident"
                description="Record a conduct issue and escalate it to VP Admin or the Principal where needed."
                endpoint="/api/v1/operations/discipline"
                fields={[
                  { name: "studentId", label: "Student ID", required: true },
                  { name: "classId", label: "Class ID" },
                  { name: "category", label: "Category", required: true, defaultValue: "Lateness" },
                  { name: "severity", label: "Severity", type: "select", defaultValue: "LOW", options: ["LOW", "MEDIUM", "HIGH"].map((value) => ({ label: value, value })) },
                  { name: "description", label: "Description", type: "textarea", required: true }
                ]}
                submitLabel="Save Incident"
                confirmLabel="Confirm Incident"
              />
            </CanDo>
            <CanDo permission="health_records.create">
              <ResourceActionDialog
                triggerLabel="Record Sick Bay Visit"
                title="Record health visit"
                description="Capture student health visits, treatment notes, medication, and referrals."
                endpoint="/api/v1/operations/health"
                fields={[
                  { name: "studentId", label: "Student ID", required: true },
                  { name: "complaint", label: "Complaint", required: true },
                  { name: "treatment", label: "Treatment", type: "textarea" },
                  { name: "medication", label: "Medication" },
                  { name: "referral", label: "Referral note" }
                ]}
                submitLabel="Save Visit"
              />
            </CanDo>
          </div>
        </div>
      </section>

      <TableCard
        title="Discipline Records"
        description="Incidents are visible to authorised welfare, class teacher, VP Admin, and Principal roles."
        items={discipline}
        emptyState="No discipline records have been logged."
        columns={[
          { key: "student", header: "Student", render: (item) => <span className="font-semibold text-ink">{studentLabel(item.student)}</span> },
          { key: "category", header: "Category", render: (item) => item.category },
          { key: "severity", header: "Severity", render: (item) => <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800">{item.severity}</span> },
          { key: "status", header: "Status", render: (item) => item.status },
          { key: "date", header: "Date", render: (item) => new Date(item.occurredAt).toLocaleDateString("en-NG") }
        ]}
      />

      <div className="grid gap-6 xl:grid-cols-2">
        <TableCard
          title="Counselling Follow-ups"
          description="Confidential records are scoped to the counsellor and authorised leadership."
          items={counseling}
          emptyState="No counselling records are visible to this account."
          columns={[
            { key: "student", header: "Student", render: (item) => studentLabel(item.student) },
            { key: "category", header: "Category", render: (item) => item.category },
            { key: "summary", header: "Summary", render: (item) => item.summary },
            { key: "followUp", header: "Follow-up", render: (item) => item.followUpDate ? new Date(item.followUpDate).toLocaleDateString("en-NG") : "Not set" }
          ]}
        />
        <TableCard
          title="Sick Bay Visits"
          description="Nurse-entered health visits with treatment and referral notes."
          items={health}
          emptyState="No sick bay visits recorded."
          columns={[
            { key: "student", header: "Student", render: (item) => studentLabel(item.student) },
            { key: "complaint", header: "Complaint", render: (item) => item.complaint },
            { key: "treatment", header: "Treatment", render: (item) => item.treatment ?? "Pending" },
            { key: "date", header: "Date", render: (item) => new Date(item.visitedAt).toLocaleDateString("en-NG") }
          ]}
        />
      </div>
    </div>
  );
}
