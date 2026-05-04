import type { ReactNode } from "react";

import { FrontDeskLiveClock } from "@/components/portals/front-desk-live-clock";
import {
  SupportBadge,
  SupportCommandLink,
  SupportEmptyState,
  SupportInfoCard,
  SupportMetricCard,
  SupportPortalPageHeader,
  SupportQuickLink,
} from "@/components/portals/support-portal-ui";
import {
  formatSupportCurrency,
  formatSupportDate,
  relativeDaysFromNow,
  supportLabel,
  type FrontDeskDashboardView,
  type HostelDashboardView,
  type LibraryDashboardView,
  type NurseDashboardView,
  type TransportDashboardView,
} from "@/lib/support-services/portal";

function tableCellClass() {
  return "px-4 py-3 align-top text-[13px] text-[var(--color-text-secondary)]";
}

function tableHeaderClass() {
  return "px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--color-text-muted)]";
}

function SimpleTable({
  headers,
  rows,
}: {
  headers: string[];
  rows: Array<Array<ReactNode>>;
}) {
  return (
    <div className="overflow-x-auto rounded-[1.25rem] border border-[var(--color-border-default)]">
      <table className="min-w-full divide-y divide-[var(--color-border-default)]">
        <thead className="bg-[var(--color-bg-subtle)]">
          <tr>
            {headers.map((header) => (
              <th key={header} className={tableHeaderClass()}>
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--color-border-default)] bg-[var(--color-surface)]">
          {rows.map((row, rowIndex) => (
            <tr key={rowIndex}>
              {row.map((cell, cellIndex) => (
                <td key={cellIndex} className={tableCellClass()}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function toneForStock(quantity: number, reorderLevel: number) {
  if (quantity <= 0) return "danger" as const;
  if (quantity <= reorderLevel) return "warning" as const;
  return "success" as const;
}

function toneForLoan(dueAt: string, returnedAt?: string | null) {
  if (returnedAt) return "success" as const;
  return new Date(dueAt) < new Date() ? "danger" as const : "warning" as const;
}

function toneForStatus(status?: string | null) {
  const normalized = (status ?? "").toUpperCase();
  if (normalized.includes("ACTIVE") || normalized.includes("RETURNED") || normalized.includes("SIGNED_IN") || normalized.includes("AVAILABLE")) {
    return "success" as const;
  }
  if (normalized.includes("OVERDUE") || normalized.includes("EXPIRED") || normalized.includes("OFF_ROAD") || normalized.includes("SUSPENDED")) {
    return "danger" as const;
  }
  if (normalized.includes("PENDING") || normalized.includes("WAIT") || normalized.includes("MAINTENANCE")) {
    return "warning" as const;
  }
  return "neutral" as const;
}

function SectionCommandGrid({
  items,
}: {
  items: Array<{ href: string; title: string; detail: string }>;
}) {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {items.map((item) => (
        <SupportCommandLink key={item.href} href={item.href} title={item.title} detail={item.detail} />
      ))}
    </div>
  );
}

export function NursePortalDashboard({
  dashboard,
  nurseName,
}: {
  dashboard: NurseDashboardView;
  nurseName: string;
}) {
  return (
    <div className="space-y-6">
      <SupportPortalPageHeader
        eyebrow="School Nurse Portal"
        title={`Good day, ${nurseName}`}
        description={`Run the school clinic with clarity: track today's visits, surface allergy-sensitive patients quickly, and stay ahead of low-stock medication risks for ${dashboard.currentTerm}.`}
        actions={
          <>
            <SupportQuickLink href={"/portals/nurse/queue"} label="Open clinic queue" />
            <SupportQuickLink href={"/portals/nurse/inventory"} label="Review inventory" />
          </>
        }
      />

      {dashboard.alerts.length ? (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {dashboard.alerts.map((alert) => (
            <div
              key={alert.id}
              className="surface-card flex items-start gap-3 border-l-4 border-l-[var(--color-warning)] p-4"
            >
              <SupportBadge label={alert.tone} tone={alert.tone === "danger" ? "danger" : "warning"} />
              <p className="text-[13px] leading-6 text-[var(--color-text-secondary)]">{alert.text}</p>
            </div>
          ))}
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <SupportMetricCard label="Today's visits" value={dashboard.metrics.visitsToday} helper="Patients already triaged or treated today." />
        <SupportMetricCard label="In clinic" value={dashboard.metrics.activeQueue} helper="Open consultations that still need closure." tone="amber" />
        <SupportMetricCard label="Active sick leave" value={dashboard.metrics.activeSickLeave} helper="Students currently excused from class." />
        <SupportMetricCard label="Low stock items" value={dashboard.metrics.lowStockCount} helper="Medication or supplies at reorder threshold." tone="rose" />
        <SupportMetricCard label="Emergencies" value={dashboard.metrics.emergenciesThisMonth} helper="Emergency incidents logged this month." tone="slate" />
      </div>

      <SectionCommandGrid
        items={[
          { href: "/portals/nurse/queue", title: "Clinic queue", detail: "Keep the live treatment queue moving and see today's patients first." },
          { href: "/portals/nurse/visit-history", title: "Visit history", detail: "Review recent complaints, treatments, referrals, and follow-up patterns." },
          { href: "/portals/nurse/health-profiles", title: "Health profiles", detail: "Scan recurring patients, guardians, and care-sensitive histories." },
          { href: "/portals/nurse/inventory", title: "Medical inventory", detail: "Monitor supplies, re-order pressure, and stock discipline." },
        ]}
      />

      <div className="grid gap-6 xl:grid-cols-[1.6fr_1fr]">
        <SupportInfoCard
          title="Recent clinic activity"
          description="A compact operational ledger of the most recent student visits, with complaint, treatment, and referral context."
        >
          {dashboard.recentVisits.length ? (
            <SimpleTable
              headers={["Patient", "Class", "Complaint", "Visited", "Outcome"]}
              rows={dashboard.recentVisits.slice(0, 8).map((visit) => [
                <div key={`${visit.id}-patient`}>
                  <p className="font-semibold text-[var(--color-text-primary)]">{visit.patientName}</p>
                  <p className="font-[var(--font-mono)] text-[12px] text-[var(--color-text-muted)]">{visit.nurseName}</p>
                </div>,
                visit.className,
                visit.complaint,
                formatSupportDate(visit.visitedAt, { dateStyle: "medium", timeStyle: "short" }),
                visit.referral ? <SupportBadge label="Referral" tone="warning" /> : <SupportBadge label="Managed in clinic" tone="success" />,
              ])}
            />
          ) : (
            <SupportEmptyState title="No clinic visits yet" detail="As visits are recorded, this panel becomes the nurse's operating picture for today's care load." />
          )}
        </SupportInfoCard>

        <div className="grid gap-6">
          <SupportInfoCard
            title="Low stock watchlist"
            description="Items that deserve procurement attention before the next treatment rush."
          >
            {dashboard.lowStock.length ? (
              <div className="space-y-3">
                {dashboard.lowStock.map((item) => (
                  <div key={item.id} className="rounded-[1.2rem] border border-[var(--color-border-default)] bg-[var(--color-bg-subtle)] p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-[var(--color-text-primary)]">{item.name}</p>
                        <p className="mt-1 text-[12px] text-[var(--color-text-secondary)]">{supportLabel(item.category)} · {item.location ?? "Clinic cabinet"}</p>
                      </div>
                      <SupportBadge label={`${item.quantity}/${item.reorderLevel}`} tone={toneForStock(item.quantity, item.reorderLevel)} />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <SupportEmptyState title="Stock is healthy" detail="Nothing is currently sitting below its reorder level." />
            )}
          </SupportInfoCard>

          <SupportInfoCard
            title="Common conditions"
            description="A quick picture of what is bringing students into the clinic most often."
          >
            {dashboard.commonConditions.length ? (
              <div className="space-y-3">
                {dashboard.commonConditions.map((condition) => (
                  <div key={condition.label} className="rounded-[1.2rem] border border-[var(--color-border-default)] bg-[var(--color-bg-subtle)] px-4 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-medium text-[var(--color-text-primary)]">{condition.label}</p>
                      <span className="font-[var(--font-mono)] text-[13px] font-semibold text-[var(--color-text-secondary)]">{condition.count}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <SupportEmptyState title="No diagnosis trend yet" detail="Once visits accumulate, common complaints and treatment patterns will appear here." />
            )}
          </SupportInfoCard>
        </div>
      </div>
    </div>
  );
}

export function NursePortalSection({
  section,
  dashboard,
  visits,
}: {
  section: string;
  dashboard: NurseDashboardView;
  visits: NurseDashboardView["recentVisits"];
}) {
  const normalized = section.toLowerCase();

  if (["queue", "log-visit", "visit-history"].includes(normalized)) {
    return (
      <div className="space-y-6">
        <SupportPortalPageHeader
          eyebrow="Clinic workflow"
          title={normalized === "queue" ? "Clinic queue and same-day flow" : normalized === "log-visit" ? "Visit ledger" : "Visit history"}
          description="Use a single operational surface to review who has been seen, which complaints are recurring, and which visits may still need follow-up or parent contact."
        />
        <SupportInfoCard title="Patient ledger" description="This list is powered from the recorded clinic visits already in the system.">
          {visits.length ? (
            <SimpleTable
              headers={["Patient", "Class", "Complaint", "Treatment", "Visited"]}
              rows={visits.map((visit) => [
                visit.patientName,
                visit.className,
                visit.complaint,
                visit.treatment || visit.medication || "No treatment note yet",
                formatSupportDate(visit.visitedAt, { dateStyle: "medium", timeStyle: "short" }),
              ])}
            />
          ) : (
            <SupportEmptyState title="No visits recorded yet" detail="Once the clinic starts logging patient visits, the operational queue and history pages will populate here automatically." />
          )}
        </SupportInfoCard>
      </div>
    );
  }

  if (["health-profiles"].includes(normalized)) {
    const grouped = new Map<string, NurseDashboardView["recentVisits"][number][]>();
    for (const visit of visits) {
      grouped.set(visit.patientName, [...(grouped.get(visit.patientName) ?? []), visit]);
    }

    return (
      <div className="space-y-6">
        <SupportPortalPageHeader
          eyebrow="Patient profiles"
          title="Health profile watchlist"
          description="A practical profile index for students who are already appearing in clinic data, so the nurse can quickly spot recurring care patterns and class-level concentration."
        />
        {grouped.size ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {Array.from(grouped.entries()).map(([name, patientVisits]) => (
              <SupportInfoCard key={name} title={name} description={`${patientVisits[0]?.className ?? "Unknown class"} · ${patientVisits.length} recorded visit(s)`}>
                <div className="space-y-3">
                  {patientVisits.slice(0, 4).map((visit) => (
                    <div key={visit.id} className="rounded-[1rem] border border-[var(--color-border-default)] bg-[var(--color-bg-subtle)] p-3">
                      <p className="font-medium text-[var(--color-text-primary)]">{visit.complaint}</p>
                      <p className="mt-1 text-[12px] text-[var(--color-text-secondary)]">
                        {visit.treatment || visit.medication || "Observation only"} · {formatSupportDate(visit.visitedAt)}
                      </p>
                    </div>
                  ))}
                </div>
              </SupportInfoCard>
            ))}
          </div>
        ) : (
          <SupportEmptyState title="No patient profiles to surface yet" detail="As soon as the first few clinic visits are captured, this page becomes a fast-access profile board for repeat care cases." />
        )}
      </div>
    );
  }

  if (["inventory", "low-stock", "transactions"].includes(normalized)) {
    return (
      <div className="space-y-6">
        <SupportPortalPageHeader
          eyebrow="Medical supplies"
          title="Inventory command board"
          description="Track stock position, reorder pressure, and clinic shelf readiness without leaving the nurse workspace."
        />
        <SupportInfoCard title="Inventory" description="All stocked items currently visible to the clinic workflow.">
          {dashboard.inventory.length ? (
            <SimpleTable
              headers={["Item", "Category", "Stock", "Reorder level", "Location", "Status"]}
              rows={dashboard.inventory.map((item) => [
                item.name,
                supportLabel(item.category),
                `${item.quantity}${item.unit ? ` ${item.unit}` : ""}`,
                item.reorderLevel,
                item.location || "Clinic store",
                <SupportBadge key={item.id} label={item.quantity <= item.reorderLevel ? "Reorder now" : "Healthy"} tone={toneForStock(item.quantity, item.reorderLevel)} />,
              ])}
            />
          ) : (
            <SupportEmptyState title="No medical inventory loaded yet" detail="Once stock items are added, the nurse portal will show reorder pressure, shelf locations, and usage discipline here." />
          )}
        </SupportInfoCard>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <SupportPortalPageHeader
        eyebrow="Nurse workflows"
        title={supportLabel(section)}
        description="This operational area is prepared for richer clinical workflows, but the current school schema does not yet store a dedicated record stream for this section."
      />
      <SupportEmptyState
        title="Workflow not yet backed by a dedicated record stream"
        detail="The portal shell is in place. To fully activate this section we need the deeper domain tables for screenings, emergencies, and structured sick-leave issuance."
      />
    </div>
  );
}

export function LibraryPortalDashboard({
  dashboard,
}: {
  dashboard: LibraryDashboardView;
}) {
  return (
    <div className="space-y-6">
      <SupportPortalPageHeader
        eyebrow="Library Portal"
        title="Circulation and catalog command"
        description="Give the library desk one premium operating surface for circulation, overdue chasing, title availability, and daily reading activity."
        actions={
          <>
            <SupportQuickLink href={"/portals/librarian/issue-book"} label="Issue books" />
            <SupportQuickLink href={"/portals/librarian/overdue-loans"} label="Chase overdue" />
          </>
        }
      />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <SupportMetricCard label="Issued today" value={dashboard.metrics.booksIssuedToday} helper="New loans created today." />
        <SupportMetricCard label="Returned today" value={dashboard.metrics.booksReturnedToday} helper="Books checked back into circulation." />
        <SupportMetricCard label="Overdue" value={dashboard.metrics.overdueCount} helper="Loans already past due date." tone="rose" />
        <SupportMetricCard label="Outstanding fines" value={formatSupportCurrency(dashboard.metrics.outstandingFines)} helper="Current overdue fine exposure." tone="amber" />
        <SupportMetricCard label="Active members" value={dashboard.metrics.activeMembers} helper="Borrowers currently holding at least one title." />
      </div>
      <SectionCommandGrid
        items={[
          { href: "/portals/librarian/issue-book", title: "Issue books", detail: "Move quickly from member to title to due date." },
          { href: "/portals/librarian/return-book", title: "Return desk", detail: "Process returns, assess due dates, and catch fines early." },
          { href: "/portals/librarian/all-books", title: "Catalog", detail: "Keep the title inventory, copy counts, and shelf discipline tight." },
          { href: "/portals/librarian/overdue-loans", title: "Overdue control", detail: "See the titles and members creating the most follow-up pressure." },
        ]}
      />
      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <SupportInfoCard title="Recent circulation activity" description="A live-looking feed of loans and returns across students and staff.">
          {dashboard.recentActivity.length ? (
            <SimpleTable
              headers={["Member", "Meta", "Book", "Action", "Time"]}
              rows={dashboard.recentActivity.map((item) => [
                item.memberName,
                item.memberMeta,
                item.bookTitle,
                <SupportBadge key={item.id} label={item.action} tone={item.action === "Returned" ? "success" : "warning"} />,
                formatSupportDate(item.at, { dateStyle: "medium", timeStyle: "short" }),
              ])}
            />
          ) : (
            <SupportEmptyState title="No circulation activity yet" detail="Loans and returns will appear here as soon as the library desk begins using the portal." />
          )}
        </SupportInfoCard>
        <div className="grid gap-6">
          <SupportInfoCard title="Most overdue now" description="The loans that need the librarian's immediate follow-up.">
            {dashboard.overdue.length ? (
              <div className="space-y-3">
                {dashboard.overdue.map((item) => (
                  <div key={item.id} className="rounded-[1rem] border border-[var(--color-border-default)] bg-[var(--color-bg-subtle)] p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-[var(--color-text-primary)]">{item.bookTitle}</p>
                        <p className="mt-1 text-[12px] text-[var(--color-text-secondary)]">{item.memberName} · {item.memberMeta}</p>
                      </div>
                      <SupportBadge label={relativeDaysFromNow(item.dueAt)} tone="danger" />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <SupportEmptyState title="Nothing overdue right now" detail="The queue clears nicely here once all active titles are still within due date." />
            )}
          </SupportInfoCard>
          <SupportInfoCard title="Popular books" description="Titles that are driving the most borrowing this cycle.">
            {dashboard.popularBooks.length ? (
              <div className="space-y-3">
                {dashboard.popularBooks.map((item) => (
                  <div key={item.id} className="rounded-[1rem] border border-[var(--color-border-default)] bg-[var(--color-bg-subtle)] p-3">
                    <p className="font-semibold text-[var(--color-text-primary)]">{item.title}</p>
                    <p className="mt-1 text-[12px] text-[var(--color-text-secondary)]">{item.author}</p>
                    <div className="mt-2 flex items-center justify-between text-[12px] text-[var(--color-text-secondary)]">
                      <span>{item.borrowed} loans</span>
                      <SupportBadge label={`${item.available}/${item.total} available`} tone={item.available > 0 ? "success" : "warning"} />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <SupportEmptyState title="No demand trend yet" detail="Once circulation grows, this panel highlights the titles and copy pressure worth watching." />
            )}
          </SupportInfoCard>
        </div>
      </div>
    </div>
  );
}

export function LibraryPortalSection({
  section,
  dashboard,
  books,
  loans,
  members,
}: {
  section: string;
  dashboard: LibraryDashboardView;
  books: Array<{ id: string; isbn?: string | null; title: string; author: string; copiesTotal: number; copiesAvailable: number; shelfCode?: string | null; loans?: Array<{ id: string }> }>;
  loans: Array<{ id: string; borrowedAt: string; dueAt: string; returnedAt?: string | null; fineAmount: number | string; book: { title: string; author: string }; student?: { user?: { firstName: string; lastName: string } | null; classRoom?: { name: string; arm?: string | null } | null } | null; staff?: { user?: { firstName: string; lastName: string } | null; department?: { name: string } | null } | null }>;
  members: {
    students: Array<{ id: string; name: string; memberType: string; memberNumber?: string | null; className: string; activeLoans: number }>;
    staff: Array<{ id: string; name: string; memberType: string; memberNumber?: string | null; className: string; activeLoans: number }>;
  };
}) {
  const normalized = section.toLowerCase();

  if (["issue-book", "return-book", "active-loans", "overdue-loans"].includes(normalized)) {
    const filteredLoans =
      normalized === "overdue-loans"
        ? loans.filter((loan) => !loan.returnedAt && new Date(loan.dueAt) < new Date())
        : loans;

    return (
      <div className="space-y-6">
        <SupportPortalPageHeader
          eyebrow="Circulation"
          title={normalized === "issue-book" ? "Issue and lending desk" : normalized === "return-book" ? "Returns and fine desk" : normalized === "overdue-loans" ? "Overdue control room" : "Active loans"}
          description="Everything the librarian needs to monitor loan pressure, due dates, and borrower load in one place."
        />
        <div className="grid gap-4 md:grid-cols-3">
          <SupportMetricCard label="Overdue" value={dashboard.metrics.overdueCount} helper="Loans needing chase-up." tone="rose" />
          <SupportMetricCard label="Fines exposed" value={formatSupportCurrency(dashboard.metrics.outstandingFines)} helper="Current fine value tied to overdue loans." tone="amber" />
          <SupportMetricCard label="Active members" value={dashboard.metrics.activeMembers} helper="Borrowers currently holding stock." />
        </div>
        <SupportInfoCard title="Loan register" description="Recent circulation with member and due-date context.">
          {filteredLoans.length ? (
            <SimpleTable
              headers={["Book", "Borrower", "Borrowed", "Due", "Status", "Fine"]}
              rows={filteredLoans.map((loan) => [
                <div key={`${loan.id}-book`}>
                  <p className="font-semibold text-[var(--color-text-primary)]">{loan.book.title}</p>
                  <p className="text-[12px] text-[var(--color-text-secondary)]">{loan.book.author}</p>
                </div>,
                loan.student
                  ? `${loan.student.user?.firstName ?? ""} ${loan.student.user?.lastName ?? ""}`.trim()
                  : `${loan.staff?.user?.firstName ?? ""} ${loan.staff?.user?.lastName ?? ""}`.trim(),
                formatSupportDate(loan.borrowedAt),
                formatSupportDate(loan.dueAt),
                <SupportBadge key={`${loan.id}-status`} label={loan.returnedAt ? "Returned" : new Date(loan.dueAt) < new Date() ? "Overdue" : "Active"} tone={toneForLoan(loan.dueAt, loan.returnedAt)} />,
                formatSupportCurrency(Number(loan.fineAmount ?? 0)),
              ])}
            />
          ) : (
            <SupportEmptyState title="No matching loans" detail="Once items are issued through the library workflow, they will appear here with fine and due-date context." />
          )}
        </SupportInfoCard>
      </div>
    );
  }

  if (["all-books", "add-book", "digital-resources"].includes(normalized)) {
    return (
      <div className="space-y-6">
        <SupportPortalPageHeader
          eyebrow="Catalog"
          title={normalized === "digital-resources" ? "Digital resources" : "Library catalog"}
          description="A curated view of the stock base the library team can place into circulation today."
        />
        {normalized === "digital-resources" ? (
          <SupportEmptyState title="No digital resources indexed yet" detail="The digital resources shelf is ready, but the current school dataset only includes physical book and loan records." />
        ) : (
          <SupportInfoCard title="Books" description="Title coverage, copy counts, shelf codes, and circulation depth.">
            {books.length ? (
              <SimpleTable
                headers={["Title", "Author", "ISBN", "Availability", "Shelf", "Loans"]}
                rows={books.map((book) => [
                  <div key={book.id}>
                    <p className="font-semibold text-[var(--color-text-primary)]">{book.title}</p>
                    <p className="text-[12px] text-[var(--color-text-secondary)]">{book.copiesAvailable} available of {book.copiesTotal}</p>
                  </div>,
                  book.author,
                  book.isbn || "Not set",
                  <SupportBadge key={`${book.id}-availability`} label={book.copiesAvailable > 0 ? "Available" : "Out"} tone={book.copiesAvailable > 0 ? "success" : "warning"} />,
                  book.shelfCode || "Unassigned",
                  book.loans?.length ?? 0,
                ])}
              />
            ) : (
              <SupportEmptyState title="No catalog records yet" detail="Once books are added to the library catalog, this page becomes the daily command board for discovery and availability." />
            )}
          </SupportInfoCard>
        )}
      </div>
    );
  }

  if (["all-members", "reservations", "fines-payments"].includes(normalized)) {
    return (
      <div className="space-y-6">
        <SupportPortalPageHeader
          eyebrow="Members"
          title={normalized === "reservations" ? "Reservations readiness" : normalized === "fines-payments" ? "Fines and exposure" : "Library members"}
          description="The current member base derived from school students and staff already interacting with the library workflow."
        />
        {normalized === "reservations" ? (
          <SupportEmptyState title="Reservation queue not activated yet" detail="The reservation shell is ready, but this school's current library schema does not yet store holds or ready-for-pickup states." />
        ) : normalized === "fines-payments" ? (
          <SupportInfoCard title="Fine exposure" description="Current overdue-linked fine amounts from active loan data.">
            {dashboard.overdue.length ? (
              <SimpleTable
                headers={["Member", "Book", "Due", "Fine", "Status"]}
                rows={dashboard.overdue.map((item) => [
                  item.memberName,
                  item.bookTitle,
                  formatSupportDate(item.dueAt),
                  formatSupportCurrency(item.fineAmount),
                  <SupportBadge key={item.id} label="Outstanding" tone="danger" />,
                ])}
              />
            ) : (
              <SupportEmptyState title="No unpaid fines at the moment" detail="When overdue loans start accruing fines, this page becomes the librarian's collection surface." />
            )}
          </SupportInfoCard>
        ) : (
          <div className="grid gap-6 xl:grid-cols-2">
            <SupportInfoCard title="Student members" description="Students who can already be referenced as library members today.">
              {members.students.length ? (
                <SimpleTable
                  headers={["Name", "Member no.", "Class", "Active loans"]}
                  rows={members.students.map((member) => [member.name, member.memberNumber || "Not set", member.className, member.activeLoans])}
                />
              ) : (
                <SupportEmptyState title="No student members yet" detail="Student member records will appear once the library begins circulating titles against them." />
              )}
            </SupportInfoCard>
            <SupportInfoCard title="Staff members" description="Staff borrowers already visible to the current library data model.">
              {members.staff.length ? (
                <SimpleTable
                  headers={["Name", "Member no.", "Department", "Active loans"]}
                  rows={members.staff.map((member) => [member.name, member.memberNumber || "Not set", member.className, member.activeLoans])}
                />
              ) : (
                <SupportEmptyState title="No staff members yet" detail="Staff borrowers will appear here as soon as they enter the loan history." />
              )}
            </SupportInfoCard>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <SupportPortalPageHeader eyebrow="Library workflows" title={supportLabel(section)} description="This library surface is staged and ready for richer workflow depth once the school schema stores this domain natively." />
      <SupportEmptyState title="Workflow awaiting deeper library schema" detail="Programs, reservations, digital resources, and fine payment records need their own first-class tables before this page can move from shell to full operating system." />
    </div>
  );
}

export function FrontDeskPortalDashboard({
  dashboard,
}: {
  dashboard: FrontDeskDashboardView;
}) {
  return (
    <div className="space-y-6">
      <SupportPortalPageHeader
        eyebrow="Front Desk Portal"
        title="Reception command center"
        description="Give the front desk one clear surface for live visitor presence, walk-in meetings, student movement pressure, and rapid desk actions."
        actions={
          <>
            <SupportQuickLink href={"/portals/front-desk/check-in-visitor"} label="Check in visitor" />
            <SupportQuickLink href={"/portals/front-desk/active-visitors"} label="Active visitors" />
          </>
        }
      />
      <div className="surface-card p-5">
        <FrontDeskLiveClock initialIso={dashboard.now} />
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <SupportMetricCard label="Active visitors" value={dashboard.metrics.activeVisitors} helper="People currently inside the building." />
        <SupportMetricCard label="Today's visitors" value={dashboard.metrics.todaysVisitors} helper="Total check-ins recorded today." />
        <SupportMetricCard label="Today's meetings" value={dashboard.metrics.todayMeetings} helper="Parent or guardian appointments scheduled." />
        <SupportMetricCard label="Pending callbacks" value={dashboard.metrics.pendingCallbacks} helper="Calls waiting for action." tone="amber" />
        <SupportMetricCard label="Parcels pending" value={dashboard.metrics.parcelsPending} helper="Mail and parcel pickups still outstanding." tone="slate" />
      </div>
      <SectionCommandGrid
        items={[
          { href: "/portals/front-desk/check-in-visitor", title: "Check in visitor", detail: "Keep guest registration moving with host and pass context." },
          { href: "/portals/front-desk/student-movements", title: "Student movements", detail: "Track late arrivals, sign-outs, and expected returns when the schema is active." },
          { href: "/portals/front-desk/parcel-tracking", title: "Parcels and mail", detail: "Watch pending pickups and front-of-house handovers." },
          { href: "/portals/front-desk/room-availability", title: "Meeting rooms", detail: "See the live meeting cadence behind parent-facing reception." },
        ]}
      />
      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <SupportInfoCard title="Active visitors" description="A clean reception snapshot of who is in the building now.">
          {dashboard.activeVisitors.length ? (
            <SimpleTable
              headers={["Visitor", "Purpose", "Host", "Badge", "Status"]}
              rows={dashboard.activeVisitors.map((visitor) => [
                visitor.visitorName,
                visitor.purpose,
                visitor.hostName || "Front office",
                visitor.passNumber || "Unassigned",
                <SupportBadge key={visitor.id} label={supportLabel(visitor.status)} tone={toneForStatus(visitor.status)} />,
              ])}
            />
          ) : (
            <SupportEmptyState title="No active visitors right now" detail="As people sign in, the front desk live board becomes the at-a-glance record for everyone inside." />
          )}
        </SupportInfoCard>
        <SupportInfoCard title="Today's meetings" description="Parent-facing appointments and reception-linked meetings scheduled today.">
          {dashboard.meetings.length ? (
            <div className="space-y-3">
              {dashboard.meetings.map((meeting) => (
                <div key={meeting.id} className="rounded-[1rem] border border-[var(--color-border-default)] bg-[var(--color-bg-subtle)] p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-[var(--color-text-primary)]">{meeting.title}</p>
                      <p className="mt-1 text-[12px] text-[var(--color-text-secondary)]">{meeting.guardianName || "Guardian"} · {meeting.staffName || "School staff"}</p>
                    </div>
                    <SupportBadge label={supportLabel(meeting.status)} tone={toneForStatus(meeting.status)} />
                  </div>
                  <p className="mt-2 text-[12px] text-[var(--color-text-secondary)]">{formatSupportDate(meeting.scheduledAt, { dateStyle: "medium", timeStyle: "short" })}</p>
                </div>
              ))}
            </div>
          ) : (
            <SupportEmptyState title="No meetings scheduled today" detail="This panel fills with parent and guardian appointments from the existing meeting data stream." />
          )}
        </SupportInfoCard>
      </div>
    </div>
  );
}

export function FrontDeskPortalSection({
  section,
  dashboard,
  visitors,
  meetings,
}: {
  section: string;
  dashboard: FrontDeskDashboardView;
  visitors: FrontDeskDashboardView["activeVisitors"];
  meetings: FrontDeskDashboardView["meetings"];
}) {
  const normalized = section.toLowerCase();

  if (["check-in-visitor", "active-visitors", "visitor-history"].includes(normalized)) {
    const data = normalized === "active-visitors" ? visitors.filter((item) => !item.timeOut) : visitors;
    return (
      <div className="space-y-6">
        <SupportPortalPageHeader eyebrow="Visitors" title={normalized === "check-in-visitor" ? "Visitor reception desk" : normalized === "active-visitors" ? "Active visitor board" : "Visitor history"} description="The reception workspace for building access, host visibility, and pass accountability." />
        <SupportInfoCard title="Visitor log" description="Guest traffic with host, purpose, and pass references.">
          {data.length ? (
            <SimpleTable
              headers={["Visitor", "Purpose", "Host", "Time in", "Status"]}
              rows={data.map((visitor) => [
                visitor.visitorName,
                visitor.purpose,
                visitor.hostName || "Front office",
                formatSupportDate(visitor.timeIn, { dateStyle: "medium", timeStyle: "short" }),
                <SupportBadge key={visitor.id} label={supportLabel(visitor.status)} tone={toneForStatus(visitor.status)} />,
              ])}
            />
          ) : (
            <SupportEmptyState title="No visitor records yet" detail="As reception check-ins happen, they appear here with host and pass tracking." />
          )}
        </SupportInfoCard>
      </div>
    );
  }

  if (["room-availability", "book-a-room", "bookings-calendar"].includes(normalized)) {
    return (
      <div className="space-y-6">
        <SupportPortalPageHeader eyebrow="Meeting rooms" title="Reception-linked meeting flow" description="A practical front-desk view of current guardian meetings while room-booking data grows into a full schedule layer." />
        {meetings.length ? (
          <SupportInfoCard title="Today's meetings" description="Current meeting cadence visible to the desk team.">
            <SimpleTable
              headers={["Meeting", "Guardian", "Staff", "Student", "Time", "Status"]}
              rows={meetings.map((meeting) => [
                meeting.title,
                meeting.guardianName || "Guardian",
                meeting.staffName || "Staff",
                meeting.studentName || "Not linked",
                formatSupportDate(meeting.scheduledAt, { dateStyle: "medium", timeStyle: "short" }),
                <SupportBadge key={meeting.id} label={supportLabel(meeting.status)} tone={toneForStatus(meeting.status)} />,
              ])}
            />
          </SupportInfoCard>
        ) : (
          <SupportEmptyState title="No room-linked meetings yet" detail="The front desk can already see parent meetings here, and a deeper room-booking domain can slot in without changing the portal structure." />
        )}
      </div>
    );
  }

  if (["daily-activity-report", "visitor-report", "movement-report"].includes(normalized)) {
    return (
      <div className="space-y-6">
        <SupportPortalPageHeader eyebrow="Reception reporting" title="Daily desk summary" description="A quick management picture of traffic and front-of-house activity for the day." />
        <div className="grid gap-4 md:grid-cols-3">
          <SupportMetricCard label="Visitors today" value={dashboard.metrics.todaysVisitors} helper="Check-ins captured on the desk." />
          <SupportMetricCard label="Active visitors" value={dashboard.metrics.activeVisitors} helper="Visitors still in building." tone="amber" />
          <SupportMetricCard label="Meetings today" value={dashboard.metrics.todayMeetings} helper="Parent-facing appointments today." />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <SupportPortalPageHeader eyebrow="Front desk workflows" title={supportLabel(section)} description="This page is staged for the reception workflows that still need a dedicated domain stream in the backend." />
      <SupportEmptyState title="Operational shell ready" detail="Student movements, parcels, lost and found, and call logs are part of the portal design, but the current school schema does not yet store those records as first-class modules." />
    </div>
  );
}

export function HostelPortalDashboard({
  dashboard,
}: {
  dashboard: HostelDashboardView;
}) {
  return (
    <div className="space-y-6">
      <SupportPortalPageHeader
        eyebrow="Hostel Portal"
        title="Boarding operations command"
        description="Give the warden team a room-first view of occupancy, boarder placement, and nightly capacity pressure."
        actions={
          <>
            <SupportQuickLink href={"/portals/hostel/room-bed-map"} label="Open bed map" />
            <SupportQuickLink href={"/portals/hostel/all-boarders"} label="View boarders" />
          </>
        }
      />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <SupportMetricCard label="Boarders" value={dashboard.metrics.totalBoarders} helper="Students currently assigned into hostel rooms." />
        <SupportMetricCard label="Occupied beds" value={dashboard.metrics.occupiedBeds} helper="Beds in active use right now." />
        <SupportMetricCard label="Vacant beds" value={dashboard.metrics.vacantBeds} helper="Remaining room capacity available." tone="amber" />
        <SupportMetricCard label="Pending exeats" value={dashboard.metrics.pendingExeats} helper="Awaiting approval in future schema." tone="slate" />
        <SupportMetricCard label="Overdue returns" value={dashboard.metrics.overdueReturns} helper="Boarders not back from approved leave." tone="rose" />
      </div>
      <SectionCommandGrid
        items={[
          { href: "/portals/hostel/room-bed-map", title: "Room and bed map", detail: "See the boarding house visually, by room, with capacity pressure." },
          { href: "/portals/hostel/all-boarders", title: "All boarders", detail: "Scan the current rooming list and check-in start dates quickly." },
          { href: "/portals/hostel/take-roll-call", title: "Roll call", detail: "Ready for the nightly attendance workflow once sessions are live." },
          { href: "/portals/hostel/pending-exeats", title: "Exeat control", detail: "Structured leave approvals can plug into this surface next." },
        ]}
      />
      <div className="grid gap-6 xl:grid-cols-[1fr_1.1fr]">
        <SupportInfoCard title="Room occupancy" description="Where boarding capacity is tight and where there is still room to place students.">
          {dashboard.rooms.length ? (
            <SimpleTable
              headers={["Building", "Room", "Capacity", "Occupied", "Available"]}
              rows={dashboard.rooms.map((room) => [
                room.buildingName,
                room.roomName,
                room.capacity,
                room.occupied,
                <SupportBadge key={room.id} label={`${room.available} vacant`} tone={room.available > 0 ? "success" : "warning"} />,
              ])}
            />
          ) : (
            <SupportEmptyState title="No hostel rooms configured yet" detail="As rooms are added and students are allocated, this occupancy board becomes the boarding team's day-to-day control panel." />
          )}
        </SupportInfoCard>
        <SupportInfoCard title="Recent boarder placements" description="The newest live assignments across hostel buildings and rooms.">
          {dashboard.boarders.length ? (
            <div className="space-y-3">
              {dashboard.boarders.slice(0, 10).map((boarder) => (
                <div key={boarder.id} className="rounded-[1rem] border border-[var(--color-border-default)] bg-[var(--color-bg-subtle)] p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-[var(--color-text-primary)]">{boarder.studentName}</p>
                      <p className="mt-1 text-[12px] text-[var(--color-text-secondary)]">{boarder.className} · {boarder.buildingName} / {boarder.roomName}</p>
                    </div>
                    <span className="font-[var(--font-mono)] text-[12px] text-[var(--color-text-muted)]">{boarder.admissionNumber || "ADM not set"}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <SupportEmptyState title="No boarders assigned yet" detail="As soon as hostel allocations exist, the latest placements and room moves will show here." />
          )}
        </SupportInfoCard>
      </div>
    </div>
  );
}

export function HostelPortalSection({
  section,
  dashboard,
  rooms,
}: {
  section: string;
  dashboard: HostelDashboardView;
  rooms: Array<{ id: string; name: string; capacity: number; building: { name: string }; allocations: Array<{ id: string; student: { user?: { firstName: string; lastName: string } | null; classRoom?: { name: string; arm?: string | null } | null } }> }>;
}) {
  const normalized = section.toLowerCase();

  if (["all-boarders", "assign-beds"].includes(normalized)) {
    return (
      <div className="space-y-6">
        <SupportPortalPageHeader eyebrow="Boarders" title={normalized === "assign-beds" ? "Assignments and bed placement" : "Boarder roster"} description="Everything currently visible from the active hostel allocation data stream." />
        {dashboard.boarders.length ? (
          <SupportInfoCard title="Boarder roster" description="Student placements by room and building.">
            <SimpleTable
              headers={["Student", "Admission no.", "Class", "Building", "Room", "Start date"]}
              rows={dashboard.boarders.map((boarder) => [
                boarder.studentName,
                boarder.admissionNumber || "Not set",
                boarder.className,
                boarder.buildingName,
                boarder.roomName,
                formatSupportDate(boarder.startDate),
              ])}
            />
          </SupportInfoCard>
        ) : (
          <SupportEmptyState title="No active hostel assignments yet" detail="Once students are assigned into rooms, the hostel roster becomes the warden's operational source of truth." />
        )}
      </div>
    );
  }

  if (["room-bed-map"].includes(normalized)) {
    return (
      <div className="space-y-6">
        <SupportPortalPageHeader eyebrow="Bed map" title="Visual room occupancy map" description="A visual room-by-room boarding map that surfaces where occupancy is light, full, or still ready for placement." />
        {rooms.length ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {rooms.map((room) => {
              const occupied = room.allocations.length;
              const available = Math.max(room.capacity - occupied, 0);
              return (
                <SupportInfoCard key={room.id} title={`${room.building.name} · ${room.name}`} description={`${occupied} occupied of ${room.capacity}`}>
                  <div className="grid grid-cols-2 gap-2">
                    {Array.from({ length: room.capacity }).map((_, index) => {
                      const allocation = room.allocations[index];
                      return (
                        <div
                          key={`${room.id}-${index}`}
                          className={`rounded-[0.95rem] border px-3 py-3 text-[12px] ${allocation ? "border-[var(--color-accent-primary-dim)] bg-[var(--color-accent-primary-dim)]/50 text-[var(--color-text-primary)]" : "border-dashed border-[var(--color-border-strong)] bg-[var(--color-bg-subtle)] text-[var(--color-text-muted)]"}`}
                        >
                          {allocation
                            ? `${allocation.student.user?.firstName ?? ""} ${allocation.student.user?.lastName ?? ""}`.trim()
                            : `Vacant ${index + 1}`}
                        </div>
                      );
                    })}
                  </div>
                  <div className="mt-4">
                    <SupportBadge label={`${available} vacant`} tone={available > 0 ? "success" : "warning"} />
                  </div>
                </SupportInfoCard>
              );
            })}
          </div>
        ) : (
          <SupportEmptyState title="No room map available yet" detail="As hostel rooms and allocations are added, this page turns into the boarding team's visual placement board." />
        )}
      </div>
    );
  }

  if (["occupancy-report", "attendance-report", "exeat-report", "incident-report"].includes(normalized)) {
    return (
      <div className="space-y-6">
        <SupportPortalPageHeader eyebrow="Hostel reports" title="Occupancy and capacity summary" description="Use the current hostel data to understand how room capacity is distributed before the deeper attendance and exeat domains are switched on." />
        <div className="grid gap-4 md:grid-cols-3">
          <SupportMetricCard label="Boarders" value={dashboard.metrics.totalBoarders} helper="Students currently assigned into hostel rooms." />
          <SupportMetricCard label="Occupied" value={dashboard.metrics.occupiedBeds} helper="Beds presently in use." />
          <SupportMetricCard label="Vacant" value={dashboard.metrics.vacantBeds} helper="Unused boarding capacity." tone="amber" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <SupportPortalPageHeader eyebrow="Hostel workflows" title={supportLabel(section)} description="This hostel workflow is staged for richer operations once exeat, roll-call, incident, and maintenance tables are activated." />
      <SupportEmptyState title="Awaiting hostel operations schema" detail="The rooming and occupancy layer is live now. Night roll call, exeat approvals, hostel incidents, and maintenance need their own first-class backend records to become fully operational." />
    </div>
  );
}

export function TransportPortalDashboard({
  dashboard,
  complianceAlerts,
}: {
  dashboard: TransportDashboardView;
  complianceAlerts: TransportDashboardView["complianceAlerts"];
}) {
  return (
    <div className="space-y-6">
      <SupportPortalPageHeader
        eyebrow="Transport Portal"
        title="Fleet and route command"
        description="A sharper operating surface for route coverage, vehicle readiness, student assignment load, and transport risk visibility."
        actions={
          <>
            <SupportQuickLink href={"/portals/transport/vehicles"} label="Open fleet" />
            <SupportQuickLink href={"/portals/transport/all-routes"} label="View routes" />
          </>
        }
      />
      {complianceAlerts.length ? (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {complianceAlerts.map((alert) => (
            <div key={alert.id} className="surface-card border-l-4 border-l-[var(--color-danger)] p-4">
              <p className="font-semibold text-[var(--color-text-primary)]">{alert.entity}</p>
              <p className="mt-1 text-[13px] text-[var(--color-text-secondary)]">{alert.documentType} · {relativeDaysFromNow(alert.expiresAt)}</p>
            </div>
          ))}
        </div>
      ) : null}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <SupportMetricCard label="Active routes" value={dashboard.metrics.activeRoutes} helper="Routes configured in the transport network." />
        <SupportMetricCard label="Vehicles on road" value={dashboard.metrics.vehiclesOnRoad} helper="Fleet units currently marked active." />
        <SupportMetricCard label="Assigned students" value={dashboard.metrics.studentsAssigned} helper="Students already tied to route stops." />
        <SupportMetricCard label="Incidents" value={dashboard.metrics.incidentsThisMonth} helper="Transport incidents recorded this month." tone="rose" />
        <SupportMetricCard label="Fuel spend" value={formatSupportCurrency(dashboard.metrics.fuelSpendThisMonth)} helper="Fuel cost layer once logs are activated." tone="amber" />
      </div>
      <SectionCommandGrid
        items={[
          { href: "/portals/transport/vehicles", title: "Vehicles", detail: "Manage fleet visibility, status, route linkage, and driver pairing." },
          { href: "/portals/transport/all-routes", title: "Routes", detail: "Keep route names, codes, and stop-linked assignments visible." },
          { href: "/portals/transport/transport-students", title: "Assigned students", detail: "See who is on transport, by stop and route." },
          { href: "/portals/transport/compliance-alerts", title: "Compliance alerts", detail: "Prepared for document-expiry enforcement as the schema deepens." },
        ]}
      />
      <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <SupportInfoCard title="Fleet status" description="Vehicle readiness, driver pairing, and route attachment at a glance.">
          {dashboard.vehicles.length ? (
            <SimpleTable
              headers={["Vehicle", "Driver", "Route", "Capacity", "Status"]}
              rows={dashboard.vehicles.map((vehicle) => [
                <div key={vehicle.id}>
                  <p className="font-semibold text-[var(--color-text-primary)]">{vehicle.plateNumber}</p>
                  <p className="text-[12px] text-[var(--color-text-secondary)]">{vehicle.model}</p>
                </div>,
                vehicle.driverName || "Unassigned",
                vehicle.routeCode ? `${vehicle.routeCode} · ${vehicle.routeName}` : "No route",
                vehicle.capacity,
                <SupportBadge key={`${vehicle.id}-status`} label={supportLabel(vehicle.status)} tone={toneForStatus(vehicle.status)} />,
              ])}
            />
          ) : (
            <SupportEmptyState title="No fleet loaded yet" detail="Once vehicles are created, this page becomes the transport desk's live fleet board." />
          )}
        </SupportInfoCard>
        <SupportInfoCard title="Routes in circulation" description="The active transport lines and the student load each one is carrying.">
          {dashboard.routes.length ? (
            <div className="space-y-3">
              {dashboard.routes.map((route) => (
                <div key={route.id} className="rounded-[1rem] border border-[var(--color-border-default)] bg-[var(--color-bg-subtle)] p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-[var(--color-text-primary)]">{route.routeCode} · {route.routeName}</p>
                      <p className="mt-1 text-[12px] text-[var(--color-text-secondary)]">{route.driverName || "Driver unassigned"} · Vehicle {route.vehicleRegNo || "not set"}</p>
                    </div>
                    <SupportBadge label={`${route.assignedStudents} students`} tone="success" />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <SupportEmptyState title="No routes configured yet" detail="Once routes are added, this card becomes the quickest way to see route coverage and assignment density." />
          )}
        </SupportInfoCard>
      </div>
    </div>
  );
}

export function TransportPortalSection({
  section,
  vehicles,
  routes,
  students,
  complianceAlerts,
}: {
  section: string;
  vehicles: TransportDashboardView["vehicles"];
  routes: TransportDashboardView["routes"];
  students: TransportDashboardView["students"];
  complianceAlerts: TransportDashboardView["complianceAlerts"];
}) {
  const normalized = section.toLowerCase();

  if (["vehicles", "fuel-logs", "maintenance"].includes(normalized)) {
    return (
      <div className="space-y-6">
        <SupportPortalPageHeader eyebrow="Fleet" title={normalized === "fuel-logs" ? "Fuel and efficiency" : normalized === "maintenance" ? "Maintenance readiness" : "Fleet register"} description="A fleet-first view of the transport estate already configured in the system." />
        {normalized === "vehicles" ? (
          <SupportInfoCard title="Vehicles" description="Live vehicle records with driver and route context.">
            {vehicles.length ? (
              <SimpleTable
                headers={["Registration", "Model", "Driver", "Route", "Capacity", "Status"]}
                rows={vehicles.map((vehicle) => [
                  vehicle.plateNumber,
                  vehicle.model,
                  vehicle.driverName || "Unassigned",
                  vehicle.routeCode ? `${vehicle.routeCode} · ${vehicle.routeName}` : "No route",
                  vehicle.capacity,
                  <SupportBadge key={vehicle.id} label={supportLabel(vehicle.status)} tone={toneForStatus(vehicle.status)} />,
                ])}
              />
            ) : (
              <SupportEmptyState title="No vehicles yet" detail="Add fleet records and they will appear here with route and driver context." />
            )}
          </SupportInfoCard>
        ) : (
          <SupportEmptyState title="Fuel and maintenance logs not activated yet" detail="The fleet shell is live now. Fuel records, maintenance cycles, and service cost tracking need their dedicated backend tables to go fully operational." />
        )}
      </div>
    );
  }

  if (["all-routes", "route-builder", "stop-management"].includes(normalized)) {
    return (
      <div className="space-y-6">
        <SupportPortalPageHeader eyebrow="Routes" title={normalized === "route-builder" ? "Route planning board" : "Route register"} description="The current network of transport routes, with student load and driver linkage ready for daily operations." />
        <SupportInfoCard title="Routes" description="Configured transport lines and the student assignment load each one carries.">
          {routes.length ? (
            <SimpleTable
              headers={["Code", "Route", "Driver", "Vehicle", "Students", "Capacity"]}
              rows={routes.map((route) => [
                route.routeCode,
                route.routeName,
                route.driverName || "Unassigned",
                route.vehicleRegNo || "Not set",
                route.assignedStudents,
                route.capacity,
              ])}
            />
          ) : (
            <SupportEmptyState title="No routes configured yet" detail="Once routes are created, they become visible here with stop-linked assignment coverage." />
          )}
        </SupportInfoCard>
      </div>
    );
  }

  if (["transport-students", "assign-to-route"].includes(normalized)) {
    return (
      <div className="space-y-6">
        <SupportPortalPageHeader eyebrow="Students" title="Route assignments" description="Students already placed onto transport routes and pickup stops." />
        <SupportInfoCard title="Assigned students" description="A route-by-route view of who is on school transport today.">
          {students.length ? (
            <SimpleTable
              headers={["Student", "Admission no.", "Class", "Route", "Stop", "Fee"]}
              rows={students.map((student) => [
                student.studentName,
                student.admissionNumber || "Not set",
                student.className,
                `${student.routeCode} · ${student.routeName}`,
                student.stopName,
                formatSupportCurrency(student.amount),
              ])}
            />
          ) : (
            <SupportEmptyState title="No route assignments yet" detail="When students are assigned to routes and stops, this page becomes the transport roster for daily dispatch." />
          )}
        </SupportInfoCard>
      </div>
    );
  }

  if (["compliance-alerts", "route-report", "fuel-report", "maintenance-report"].includes(normalized)) {
    return (
      <div className="space-y-6">
        <SupportPortalPageHeader eyebrow="Compliance and reports" title="Risk and reporting surface" description="Keep the transport office aware of what is active now, and ready for compliance enforcement once document tables are activated." />
        {complianceAlerts.length ? (
          <SupportInfoCard title="Compliance alerts" description="Vehicle or driver documents nearing expiry.">
            <SimpleTable
              headers={["Entity", "Document", "Expiry", "Severity"]}
              rows={complianceAlerts.map((alert) => [
                alert.entity,
                alert.documentType,
                formatSupportDate(alert.expiresAt),
                <SupportBadge key={alert.id} label={supportLabel(alert.severity)} tone={toneForStatus(alert.severity)} />,
              ])}
            />
          </SupportInfoCard>
        ) : (
          <SupportEmptyState title="No compliance alerts yet" detail="The current vehicle schema does not yet store document expiries, so this page is ready but waiting for the deeper compliance layer." />
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <SupportPortalPageHeader eyebrow="Transport workflows" title={supportLabel(section)} description="This route of the transport portal is staged for the deeper driver, attendance, incident, fuel, and compliance records still to be introduced." />
      <SupportEmptyState title="Transport shell ready for deeper operations" detail="Fleet, route, and assignment visibility are already live. Daily transport attendance, incident logging, maintenance, and parent alerting need first-class backend records to complete the operating system." />
    </div>
  );
}
