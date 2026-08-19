import { DetailTabs } from "@/components/data-display/detail-tabs";
import { TableCard } from "@/components/data-display/table-card";
import { AccessDenied } from "@/components/feedback/access-denied";
import { FilterToolbar } from "@/components/filters/filter-toolbar";
import { apiGet } from "@/lib/api/server";
import { getDefaultPathForRole } from "@/lib/auth/roles";
import { getServerSession } from "@/lib/auth/session";
import type { ParentDirectoryRecordView } from "@/lib/domain/types";
import { formatNigeriaClassName } from "@/lib/school-options";

type ParentsPageProps = {
  searchParams?: Promise<{ tab?: string; search?: string }>;
};

function tabHref(tab: string) {
  return tab === "registry" ? "/parents" : `/parents?tab=${tab}`;
}

export default async function ParentsPage({ searchParams }: ParentsPageProps) {
  const session = await getServerSession();
  if (!session) return null;

  let parents: ParentDirectoryRecordView[];
  try {
    parents = await apiGet<ParentDirectoryRecordView[]>("/api/v1/parents");
  } catch {
    return <AccessDenied backHref={getDefaultPathForRole(session.role)} />;
  }

  const params = searchParams ? await searchParams : {};
  const tab = params.tab ?? "registry";
  const search = params.search ?? "";

  const tabs = [
    { label: "Registry", href: tabHref("registry"), active: tab === "registry" },
    { label: "Portal Access", href: tabHref("portal"), active: tab === "portal" },
    { label: "Data Quality & Groups", href: tabHref("quality"), active: tab === "quality" }
  ];

  return (
    <div className="grid gap-5">
      <section className="surface-hero p-6 md:p-7">
        <p className="section-eyebrow">Parents</p>
        <h1 className="mt-2 font-[var(--font-heading)] text-[28px] font-bold text-[var(--color-text-primary)]">Parent & Guardian Management</h1>
        <p className="mt-2 max-w-3xl text-[13px] leading-6 text-[var(--color-text-secondary)]">
          Guardian accounts, linked correctly to their children — permission-aware visibility for school
          communication, fees follow-up, admissions, and welfare.
        </p>
      </section>

      <DetailTabs tabs={tabs} />

      {tab === "registry" ? <RegistryTab parents={parents} search={search} /> : null}
      {tab === "portal" ? <PortalAccessTab parents={parents} /> : null}
      {tab === "quality" ? <DataQualityTab parents={parents} /> : null}
    </div>
  );
}

function RegistryTab({ parents, search }: { parents: ParentDirectoryRecordView[]; search: string }) {
  const filteredParents = parents.filter(
    (parent) =>
      !search ||
      [
        parent.parentName,
        parent.phone,
        parent.email,
        parent.relationship,
        ...parent.linkedChildren.flatMap((child) => [child.studentName, child.admissionNumber, child.className])
      ]
        .join(" ")
        .toLowerCase()
        .includes(search.toLowerCase())
  );

  return (
    <div className="grid gap-5">
      <section className="grid gap-3 md:grid-cols-3">
        <article className="surface-card p-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--color-text-muted)]">Guardians</p>
          <p className="mt-2 font-[var(--font-heading)] text-[22px] font-bold text-[var(--color-text-primary)]">{filteredParents.length}</p>
        </article>
        <article className="surface-card p-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--color-text-muted)]">Linked children</p>
          <p className="mt-2 font-[var(--font-heading)] text-[22px] font-bold text-[var(--color-text-primary)]">{filteredParents.reduce((sum, p) => sum + p.linkedChildren.length, 0)}</p>
        </article>
        <article className="surface-card p-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--color-text-muted)]">No email on file</p>
          <p className="mt-2 font-[var(--font-heading)] text-[22px] font-bold text-[var(--color-text-primary)]">{filteredParents.filter((p) => !p.email).length}</p>
        </article>
      </section>

      <FilterToolbar
        action="/parents"
        controls={[{ name: "search", label: "Search", type: "search", placeholder: "Parent, phone, child, class", defaultValue: search }]}
      />

      <TableCard
        title="Parents and guardians"
        description="Linked children are shown so staff can quickly confirm the correct family contact."
        items={filteredParents}
        emptyState="No parents or guardians match the current search."
        columns={[
          {
            key: "parent",
            header: "Parent / guardian",
            render: (item) => (
              <div>
                <p className="font-semibold text-[var(--color-text-primary)]">{item.parentName}</p>
                <p className="text-xs text-[var(--color-text-muted)]">{item.relationship}</p>
              </div>
            )
          },
          {
            key: "contact",
            header: "Contact",
            render: (item) => (
              <div>
                <p>{item.phone}</p>
                <p className="text-xs text-[var(--color-text-muted)]">{item.email ?? "No email"}</p>
              </div>
            )
          },
          {
            key: "children",
            header: "Linked children",
            render: (item) => (
              <div className="grid gap-1">
                {item.linkedChildren.map((child) => (
                  <p key={child.studentId} className="text-sm">
                    <span className="font-semibold text-[var(--color-text-primary)]">{child.studentName}</span>
                    <span className="text-[var(--color-text-muted)]"> · {child.admissionNumber} · {formatNigeriaClassName(child.className)}</span>
                  </p>
                ))}
              </div>
            )
          },
          { key: "sms", header: "SMS", render: (item) => (item.canReceiveSms ? "Allowed" : "Opted out") },
          { key: "email", header: "Email", render: (item) => (item.canReceiveEmail ? "Allowed" : "Opted out") }
        ]}
      />
    </div>
  );
}

function PortalAccessTab({ parents }: { parents: ParentDirectoryRecordView[] }) {
  const smsAllowed = parents.filter((p) => p.canReceiveSms).length;
  const emailAllowed = parents.filter((p) => p.canReceiveEmail).length;
  const noChannel = parents.filter((p) => !p.canReceiveSms && !p.canReceiveEmail);

  return (
    <div className="grid gap-5">
      <section className="surface-card p-6">
        <p className="section-eyebrow">Communication reach</p>
        <h2 className="mt-2 font-[var(--font-heading)] text-[18px] font-bold text-[var(--color-text-primary)]">Which channels can reach each guardian</h2>
        <p className="mt-2 max-w-2xl text-[13px] leading-6 text-[var(--color-text-secondary)]">
          Every guardian record on file, with the communication channels they&apos;ve opted into — this is what
          determines whether they receive fee reminders, announcements, and result notifications.
        </p>
      </section>

      <section className="grid gap-3 md:grid-cols-3">
        <article className="surface-card p-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--color-text-muted)]">SMS reachable</p>
          <p className="mt-2 font-[var(--font-heading)] text-[22px] font-bold" style={{ color: "var(--color-success)" }}>{smsAllowed}</p>
        </article>
        <article className="surface-card p-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--color-text-muted)]">Email reachable</p>
          <p className="mt-2 font-[var(--font-heading)] text-[22px] font-bold" style={{ color: "var(--color-success)" }}>{emailAllowed}</p>
        </article>
        <article className="surface-card p-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--color-text-muted)]">No channel opted in</p>
          <p className="mt-2 font-[var(--font-heading)] text-[22px] font-bold" style={{ color: noChannel.length > 0 ? "var(--color-danger)" : "var(--color-success)" }}>{noChannel.length}</p>
        </article>
      </section>

      <TableCard
        title="Unreachable guardians"
        description="Opted out of both SMS and email — they will miss fee reminders, announcements, and result notifications."
        items={noChannel}
        emptyState="Every guardian on file can be reached by at least one channel."
        columns={[
          { key: "parent", header: "Parent / guardian", render: (item) => <div><p className="font-semibold text-[var(--color-text-primary)]">{item.parentName}</p><p className="text-xs text-[var(--color-text-muted)]">{item.relationship}</p></div> },
          { key: "phone", header: "Phone", render: (item) => item.phone },
          { key: "children", header: "Linked children", render: (item) => item.linkedChildren.map((c) => c.studentName).join(", ") || "None" }
        ]}
      />
    </div>
  );
}

function DataQualityTab({ parents }: { parents: ParentDirectoryRecordView[] }) {
  const noEmail = parents.filter((p) => !p.email);
  const noChildren = parents.filter((p) => p.linkedChildren.length === 0);
  const groups = new Map<string, ParentDirectoryRecordView[]>();
  for (const parent of parents) {
    groups.set(parent.phone, [...(groups.get(parent.phone) ?? []), parent]);
  }
  const familyGroups = Array.from(groups.entries()).filter(([, members]) => members.length > 1 || members[0].linkedChildren.length > 1);

  return (
    <div className="grid gap-5">
      <section className="grid gap-3 md:grid-cols-3">
        <article className="surface-card p-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--color-text-muted)]">No email on file</p>
          <p className="mt-2 font-[var(--font-heading)] text-[22px] font-bold" style={{ color: noEmail.length > 0 ? "var(--color-warning)" : "var(--color-success)" }}>{noEmail.length}</p>
        </article>
        <article className="surface-card p-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--color-text-muted)]">No child linked</p>
          <p className="mt-2 font-[var(--font-heading)] text-[22px] font-bold" style={{ color: noChildren.length > 0 ? "var(--color-warning)" : "var(--color-success)" }}>{noChildren.length}</p>
        </article>
        <article className="surface-card p-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--color-text-muted)]">Family groups (2+ children)</p>
          <p className="mt-2 font-[var(--font-heading)] text-[22px] font-bold text-[var(--color-text-primary)]">{familyGroups.length}</p>
        </article>
      </section>

      {noChildren.length > 0 ? (
        <TableCard
          title="No child linked"
          description="Guardian records with no linked student — likely orphaned during a data change."
          items={noChildren}
          columns={[
            { key: "parent", header: "Parent / guardian", render: (item) => item.parentName },
            { key: "phone", header: "Phone", render: (item) => item.phone },
            { key: "relationship", header: "Relationship", render: (item) => item.relationship }
          ]}
        />
      ) : null}

      <TableCard
        title="Family groups"
        description="Guardians linked to more than one child, grouped by phone number."
        items={familyGroups.map(([phone, members]) => ({ phone, members }))}
        emptyState="No multi-child family groups detected."
        getRowKey={(item) => item.phone}
        columns={[
          { key: "phone", header: "Phone", render: (item) => item.phone },
          { key: "guardians", header: "Guardian(s)", render: (item) => item.members.map((m) => m.parentName).join(", ") },
          {
            key: "children",
            header: "Children",
            render: (item) =>
              Array.from(new Map(item.members.flatMap((m) => m.linkedChildren).map((c) => [c.studentId, c])).values())
                .map((c) => c.studentName)
                .join(", ")
          }
        ]}
      />
    </div>
  );
}
