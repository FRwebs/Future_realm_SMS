import { CanDo } from "@/components/auth/permission-provider";
import { TableCard } from "@/components/data-display/table-card";
import { ResourceActionDialog } from "@/components/forms/resource-action-dialog";
import { apiGet } from "@/lib/api/server";

type StudentRef = { firstName: string; lastName: string };
type GuardianRef = { firstName: string; lastName: string; phone?: string | null };
type UserRef = { firstName: string; lastName: string; email: string };
type StaffRef = { user: UserRef };

type Visitor = {
  id: string;
  visitorName: string;
  phone?: string | null;
  purpose: string;
  hostName?: string | null;
  status: string;
  timeIn: string;
  timeOut?: string | null;
  createdBy?: UserRef | null;
};

type ParentMeeting = {
  id: string;
  title: string;
  scheduledAt: string;
  status: string;
  notes?: string | null;
  student?: StudentRef | null;
  guardian?: GuardianRef | null;
  staff?: StaffRef | null;
};

function personName(person?: StudentRef | GuardianRef | null) {
  return person ? `${person.firstName} ${person.lastName}` : "Not linked";
}

async function safeList<T>(path: string) {
  try {
    return await apiGet<T[]>(path);
  } catch {
    return [];
  }
}

export default async function FrontDeskOperationsPage() {
  const [visitors, meetings] = await Promise.all([
    safeList<Visitor>("/api/v1/operations/visitors"),
    safeList<ParentMeeting>("/api/v1/operations/parent-meetings")
  ]);

  return (
    <div className="portal-page">
      <section className="surface-hero p-6 md:p-7">
        <p className="section-eyebrow">
          Front desk
        </p>
        <div className="mt-3 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="font-[var(--font-heading)] text-[26px] font-black text-[var(--color-text-primary)]">
              Visitor Log & Parent Meetings
            </h1>
            <p className="mt-3 max-w-3xl text-[13px] leading-6 text-[var(--color-text-secondary)]">
              Reception can record visitors, issue passes, route parent enquiries, and schedule parent-teacher meetings.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <CanDo permission="visitors.create">
              <ResourceActionDialog
                triggerLabel="Sign In Visitor"
                title="Sign in visitor"
                description="Capture front desk visitor details and who they are seeing."
                endpoint="/api/v1/operations/visitors"
                fields={[
                  { name: "visitorName", label: "Visitor name", required: true },
                  { name: "phone", label: "Phone" },
                  { name: "purpose", label: "Purpose", required: true },
                  { name: "hostName", label: "Host name" },
                  { name: "hostUserId", label: "Host user ID" },
                  { name: "passNumber", label: "Pass number" }
                ]}
                submitLabel="Sign In"
              />
            </CanDo>
            <CanDo permission="parent_meetings.create">
              <ResourceActionDialog
                triggerLabel="Schedule Meeting"
                title="Schedule parent meeting"
                description="Create a meeting record tied to a student, guardian, and staff member where available."
                endpoint="/api/v1/operations/parent-meetings"
                fields={[
                  { name: "title", label: "Meeting title", required: true },
                  { name: "scheduledAt", label: "Scheduled at (ISO date-time)", required: true, placeholder: "2026-04-19T09:00:00.000Z" },
                  { name: "studentId", label: "Student ID" },
                  { name: "guardianId", label: "Guardian ID" },
                  { name: "staffId", label: "Staff profile ID" },
                  { name: "notes", label: "Notes", type: "textarea" }
                ]}
                submitLabel="Schedule Meeting"
              />
            </CanDo>
          </div>
        </div>
      </section>

      <TableCard
        title="Visitor Log"
        description="Current and historical visitor pass records."
        items={visitors}
        emptyState="No visitors have been recorded."
        columns={[
          { key: "visitor", header: "Visitor", render: (item) => <span className="font-semibold text-[var(--color-text-primary)]">{item.visitorName}</span> },
          { key: "purpose", header: "Purpose", render: (item) => item.purpose },
          { key: "host", header: "Host", render: (item) => item.hostName ?? "Not set" },
          { key: "status", header: "Status", render: (item) => <span className="rounded-full bg-[var(--color-accent-primary-dim)] px-3 py-1 text-xs font-semibold text-[var(--color-text-accent)]">{item.status}</span> },
          { key: "time", header: "Signed In", render: (item) => new Date(item.timeIn).toLocaleString("en-NG") }
        ]}
      />

      <TableCard
        title="Parent Meetings"
        description="Scheduled class teacher, welfare, and leadership meetings with families."
        items={meetings}
        emptyState="No parent meetings scheduled."
        columns={[
          { key: "title", header: "Meeting", render: (item) => <span className="font-semibold text-[var(--color-text-primary)]">{item.title}</span> },
          { key: "student", header: "Student", render: (item) => personName(item.student) },
          { key: "guardian", header: "Guardian", render: (item) => personName(item.guardian) },
          { key: "staff", header: "Staff", render: (item) => item.staff ? `${item.staff.user.firstName} ${item.staff.user.lastName}` : "Not set" },
          { key: "when", header: "When", render: (item) => new Date(item.scheduledAt).toLocaleString("en-NG") },
          { key: "status", header: "Status", render: (item) => item.status }
        ]}
      />
    </div>
  );
}
