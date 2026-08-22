import { CalendarDays, LayoutGrid } from "lucide-react";

import { DetailTabs } from "@/components/data-display/detail-tabs";
import { StatCard } from "@/components/data-display/stat-card";
import { TableCard } from "@/components/data-display/table-card";
import { AccessDenied } from "@/components/feedback/access-denied";
import { apiGet } from "@/lib/api/server";
import { getDefaultPathForRole } from "@/lib/auth/roles";
import { canAccessServerPath } from "@/lib/auth/server-access";
import { getServerSession } from "@/lib/auth/session";
import { formatNigeriaClassName } from "@/lib/school-options";
import { formatDate } from "@/lib/utils/formatters";

/**
 * Local, page-scoped types (deliberately not added to `src/lib/domain/types.ts`
 * to avoid collisions with parallel work on other modules). Shapes mirror the
 * real backend payloads consumed by the existing `/classes` and `/timetable`
 * workspaces so this module reuses live data rather than re-fetching or
 * re-modelling it.
 */
type StructureModuleClassRecord = {
  id: string;
  name: string;
  shortName: string;
  level: string;
  category: string;
  arm?: string | null;
  studentCount: number;
  classTeacher: { id: string; name: string } | null;
};

type StructureModuleClassesResponse = {
  data: StructureModuleClassRecord[];
  total: number;
};

type StructureModuleSubjectRecord = {
  id: string;
  name: string;
  code?: string | null;
};

type StructureModuleSubjectsResponse = {
  mode: string;
  records: StructureModuleSubjectRecord[];
};

type StructureModuleTimetableClass = {
  id: string;
  name: string;
  shortName: string;
  category: string;
  arm?: string | null;
  totalSlots: number;
  filledSlots: number;
  publishedSlots: number;
  setupStatus: "published" | "draft" | "empty" | "structure_only";
};

type StructureModuleTimetableOverview = {
  data: Record<string, StructureModuleTimetableClass[]>;
  meta: {
    totalClasses: number;
    publishedClasses: number;
    emptyClasses: number;
  };
};

type StructureModuleCalendarEvent = {
  id: string;
  title: string;
  description?: string | null;
  audience: string;
  startsAt: string;
  endsAt: string;
};

type StructureModuleCalendarResponse = {
  mode: string;
  records: StructureModuleCalendarEvent[];
};

const setupStatusTone: Record<StructureModuleTimetableClass["setupStatus"], { background: string; color: string; label: string }> = {
  published: { background: "var(--color-success-dim)", color: "var(--color-success)", label: "Published" },
  draft: { background: "var(--color-warning-dim)", color: "var(--color-warning)", label: "Draft" },
  structure_only: { background: "var(--color-info-dim)", color: "var(--color-info)", label: "Structure only" },
  empty: { background: "var(--color-danger-dim)", color: "var(--color-danger)", label: "Not started" }
};

function tabHref(tab: string) {
  return tab === "classes" ? "/school/structure" : `/school/structure?tab=${tab}`;
}

export default async function StructurePage({ searchParams }: { searchParams?: Promise<{ tab?: string }> }) {
  const session = await getServerSession();
  if (!session) return null;
  if (!(await canAccessServerPath(session, "/school/structure"))) {
    return <AccessDenied backHref={getDefaultPathForRole(session.role)} />;
  }

  const { tab = "classes" } = searchParams ? await searchParams : {};

  const tabs = [
    { label: "Classes & Subjects", href: tabHref("classes"), active: tab === "classes" },
    { label: "Timetable", href: tabHref("timetable"), active: tab === "timetable" },
    { label: "Houses & School Calendar", href: tabHref("houses"), active: tab === "houses" }
  ];

  return (
    <div className="grid gap-5">
      <section className="surface-hero p-6 md:p-7">
        <p className="section-eyebrow">Academic operations</p>
        <h1 className="mt-2 font-[var(--font-heading)] text-[28px] font-bold text-[var(--color-text-primary)]">
          Class, Arm, Subject &amp; Timetable Management
        </h1>
        <p className="mt-2 max-w-3xl text-[13px] leading-6 text-[var(--color-text-secondary)]">
          A single overview of your school&apos;s classes, arms, subjects, timetable coverage, and calendar — with the
          full editing workspaces one click away.
        </p>
      </section>

      <DetailTabs tabs={tabs} />

      {tab === "classes" ? <ClassesTab /> : null}
      {tab === "timetable" ? <TimetableTab /> : null}
      {tab === "houses" ? <HousesTab /> : null}
    </div>
  );
}

async function ClassesTab() {
  const [classesResult, subjectsResult] = await Promise.all([
    apiGet<StructureModuleClassesResponse>("/api/v1/classes?page=1&pageSize=200"),
    apiGet<StructureModuleSubjectsResponse>("/api/v1/configuration/subjects")
  ]);

  const classes = classesResult?.data ?? [];
  const subjects = subjectsResult?.records ?? [];
  const totalClasses = classesResult?.total ?? classes.length;
  const totalArms = new Set(classes.map((item) => item.arm).filter((arm): arm is string => Boolean(arm))).size;
  const totalStudents = classes.reduce((sum, item) => sum + (item.studentCount ?? 0), 0);

  return (
    <div className="grid gap-5">
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total classes" value={totalClasses} icon={LayoutGrid} />
        <StatCard label="Distinct arms" value={totalArms} tone="info" />
        <StatCard label="Total subjects" value={subjects.length} tone="accent" />
        <StatCard label="Students enrolled" value={totalStudents} tone="success" />
      </section>

      <TableCard
        title="Classes"
        description="Every active class in the school, with enrolment and class-teacher assignment at a glance."
        items={classes}
        emptyState="No classes have been created for this school yet."
        primaryColumnKey="name"
        getRowKey={(item) => item.id}
        columns={[
          {
            key: "name",
            header: "Class",
            render: (item) => (
              <div>
                <p className="font-semibold text-[var(--color-text-primary)]">{formatNigeriaClassName(item.name)}</p>
                <p className="text-xs text-[var(--color-text-muted)]">{item.category}{item.arm ? ` · ${item.arm}` : ""}</p>
              </div>
            )
          },
          { key: "studentCount", header: "Students", render: (item) => item.studentCount },
          { key: "classTeacher", header: "Class teacher", render: (item) => item.classTeacher?.name ?? "Not assigned" },
          {
            key: "actions",
            header: "",
            sortable: false,
            render: (item) => (
              <a href={`/classes/${item.id}`} className="text-[12px] font-semibold text-[var(--color-text-accent)] hover:underline">
                View class →
              </a>
            )
          }
        ]}
      />

      <a
        href="/classes"
        className="inline-flex w-fit items-center gap-2 text-[13px] font-semibold text-[var(--color-text-accent)] hover:underline"
      >
        Open full Classes &amp; Arms workspace →
      </a>
    </div>
  );
}

async function TimetableTab() {
  const overview = await apiGet<StructureModuleTimetableOverview>("/api/v1/timetable/classes");
  const groups = overview?.data ?? {};
  const meta = overview?.meta ?? { totalClasses: 0, publishedClasses: 0, emptyClasses: 0 };
  const rows = Object.values(groups).flat();
  const notStarted = meta.emptyClasses;
  const inProgress = Math.max(meta.totalClasses - meta.publishedClasses - notStarted, 0);

  return (
    <div className="grid gap-5">
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Classes with a timetable" value={meta.totalClasses} icon={CalendarDays} />
        <StatCard label="Published" value={meta.publishedClasses} tone="success" />
        <StatCard label="In progress" value={inProgress} tone="warning" />
        <StatCard label="Not started" value={notStarted} tone="danger" />
      </section>

      <TableCard
        title="Timetable coverage by class"
        description="Slot completion and publish status for each class, pulled from the live timetable builder."
        items={rows}
        emptyState="No classes are set up for timetabling yet."
        primaryColumnKey="name"
        getRowKey={(item, index) => `${item.id}-${index}`}
        columns={[
          {
            key: "name",
            header: "Class",
            render: (item) => (
              <div>
                <p className="font-semibold text-[var(--color-text-primary)]">{formatNigeriaClassName(item.name)}</p>
                <p className="text-xs text-[var(--color-text-muted)]">{item.category}{item.arm ? ` · ${item.arm}` : ""}</p>
              </div>
            )
          },
          { key: "filledSlots", header: "Slots filled", render: (item) => `${item.filledSlots} / ${item.totalSlots}` },
          {
            key: "setupStatus",
            header: "Status",
            render: (item) => {
              const tone = setupStatusTone[item.setupStatus] ?? setupStatusTone.empty;
              return (
                <span className="rounded-full px-3 py-1 text-xs font-semibold" style={{ background: tone.background, color: tone.color }}>
                  {tone.label}
                </span>
              );
            }
          },
          {
            key: "actions",
            header: "",
            sortable: false,
            render: (item) => (
              <a href={`/timetable/${item.id}`} className="text-[12px] font-semibold text-[var(--color-text-accent)] hover:underline">
                Open timetable →
              </a>
            )
          }
        ]}
      />

      <a
        href="/timetable"
        className="inline-flex w-fit items-center gap-2 text-[13px] font-semibold text-[var(--color-text-accent)] hover:underline"
      >
        Open full Timetable workspace →
      </a>
    </div>
  );
}

async function HousesTab() {
  const calendar = await apiGet<StructureModuleCalendarResponse>("/api/v1/configuration/school-calendar");
  const now = new Date();
  const events = (calendar?.records ?? [])
    .filter((event) => new Date(event.endsAt) >= now)
    .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());

  return (
    <div className="grid gap-5">
      <TableCard
        title="Upcoming school calendar"
        description="Holidays, resumption dates, PTA meetings, and other whole-school events from the live school calendar."
        items={events}
        emptyState="No upcoming calendar events have been added yet."
        getRowKey={(item) => item.id}
        columns={[
          { key: "title", header: "Event", render: (item) => <span className="font-semibold text-[var(--color-text-primary)]">{item.title}</span> },
          { key: "audience", header: "Audience", render: (item) => item.audience },
          { key: "startsAt", header: "Starts", render: (item) => formatDate(item.startsAt) },
          { key: "endsAt", header: "Ends", render: (item) => formatDate(item.endsAt) }
        ]}
      />

      <a
        href="/school/configuration?tab=calendar"
        className="inline-flex w-fit items-center gap-2 text-[13px] font-semibold text-[var(--color-text-accent)] hover:underline"
      >
        Manage the school calendar →
      </a>

      <section className="surface-card flex flex-col items-center gap-3 p-8 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--color-bg-subtle)] text-[var(--color-text-muted)]">
          <LayoutGrid className="h-5 w-5" />
        </div>
        <div>
          <p className="font-[var(--font-heading)] text-[16px] font-bold text-[var(--color-text-primary)]">
            Houses aren&apos;t set up for this school yet
          </p>
          <p className="mt-2 max-w-md text-[13px] leading-6 text-[var(--color-text-secondary)]">
            This school has no house/sports-team structure recorded in the system. Inter-house names, house masters,
            and house rosters aren&apos;t tracked yet, so nothing is shown here rather than sample data.
          </p>
        </div>
      </section>
    </div>
  );
}
