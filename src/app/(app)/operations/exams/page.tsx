import { CanDo } from "@/components/auth/permission-provider";
import { TableCard } from "@/components/data-display/table-card";
import { ResourceActionDialog } from "@/components/forms/resource-action-dialog";
import { apiGet } from "@/lib/api/server";

type ClassRef = { name: string; arm?: string | null };
type SessionRef = { name: string };

type ExternalExam = {
  id: string;
  name: string;
  body: string;
  status: string;
  registrationCloses?: string | null;
  examDate?: string | null;
  classRoom?: ClassRef | null;
  academicSession?: SessionRef | null;
};

function classLabel(classRoom?: ClassRef | null) {
  return classRoom ? `${classRoom.name}${classRoom.arm ? ` ${classRoom.arm}` : ""}` : "School-wide";
}

export default async function ExamOperationsPage() {
  const exams = await apiGet<ExternalExam[]>("/api/v1/operations/external-exams");

  return (
    <div className="portal-page">
      <section className="surface-hero p-6 md:p-7">
        <p className="section-eyebrow">
          Exam operations
        </p>
        <div className="mt-3 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="font-[var(--font-heading)] text-[26px] font-black text-[var(--color-text-primary)]">
              External Exams & Logistics
            </h1>
            <p className="mt-3 max-w-3xl text-[13px] leading-6 text-[var(--color-text-secondary)]">
              Track WAEC, NECO, BECE, Common Entrance and internal readiness records alongside seating and invigilation preparation.
            </p>
          </div>
          <CanDo permission="external_exams.create">
            <ResourceActionDialog
              triggerLabel="Add External Exam"
              title="Add external exam"
              description="Create an external exam tracking record for senior secondary or junior secondary readiness."
              endpoint="/api/v1/operations/external-exams"
              fields={[
                { name: "name", label: "Exam name", required: true, defaultValue: "WAEC Internal Readiness Mock" },
                { name: "body", label: "Exam body", required: true, defaultValue: "WAEC" },
                { name: "academicSessionId", label: "Academic session ID" },
                { name: "classId", label: "Class ID" },
                { name: "status", label: "Status", type: "select", defaultValue: "DRAFT", options: ["DRAFT", "REGISTRATION_OPEN", "REGISTERED", "COMPLETED"].map((value) => ({ label: value, value })) },
                { name: "examDate", label: "Exam date", type: "date" }
              ]}
              submitLabel="Save Exam"
            />
          </CanDo>
        </div>
      </section>

      <TableCard
        title="External Exam Register"
        description="Exam Officer-managed records for external exam registration, mock readiness, and senior school archive preparation."
        items={exams}
        emptyState="No external exam records have been created."
        columns={[
          { key: "name", header: "Exam", render: (item) => <span className="font-semibold text-[var(--color-text-primary)]">{item.name}</span> },
          { key: "body", header: "Body", render: (item) => item.body },
          { key: "class", header: "Class", render: (item) => classLabel(item.classRoom) },
          { key: "session", header: "Session", render: (item) => item.academicSession?.name ?? "Not set" },
          { key: "status", header: "Status", render: (item) => <span className="rounded-full bg-[var(--color-accent-primary-dim)] px-3 py-1 text-xs font-semibold text-[var(--color-text-accent)]">{item.status}</span> },
          { key: "date", header: "Exam Date", render: (item) => item.examDate ? new Date(item.examDate).toLocaleDateString("en-NG") : "Pending" }
        ]}
      />
    </div>
  );
}
