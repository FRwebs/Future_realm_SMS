"use client";

import { useMemo, useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import {
  BadgeDollarSign,
  BriefcaseBusiness,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  Download,
  Eye,
  Filter,
  Landmark,
  Loader2,
  Search,
  Send,
  ShieldCheck,
  Users,
} from "lucide-react";

import { ActionMenu, ActionMenuButton } from "@/components/ui/action-menu";
import { SidePanel } from "@/components/ui/side-panel";
import { useToast } from "@/components/ui/toast-provider";
import type { PayrollRunView, PayrollStaffMemberView, PayrollWorkspaceView } from "@/lib/domain/types";
import { cn } from "@/lib/utils/cn";
import { formatCurrency, formatDate } from "@/lib/utils/formatters";

type PayrollWorkspaceProps = {
  workspace: PayrollWorkspaceView;
};

type PayrollTab = "roster" | "runs";
type PayrollDraftRow = {
  staffId: string;
  selected: boolean;
  basicSalary: number;
  housing: number;
  transport: number;
  meal: number;
  otherAllowance: number;
  paye: number;
  pension: number;
  otherDeduction: number;
};

const monthNames = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const monthOptions = monthNames.map((label, index) => ({
  label,
  value: index + 1,
}));

function getCookie(name: string) {
  return document.cookie
    .split("; ")
    .find((item) => item.startsWith(`${name}=`))
    ?.split("=")[1];
}

function paginate<T>(items: T[], page: number, pageSize: number) {
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const safePage = Math.min(Math.max(page, 1), totalPages);
  const start = (safePage - 1) * pageSize;
  return {
    page: safePage,
    totalPages,
    items: items.slice(start, start + pageSize),
  };
}

function Pagination({
  page,
  totalPages,
  onPageChange,
}: {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}) {
  if (totalPages <= 1) return null;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--color-border-default)] px-5 py-4 text-sm">
      <p className="text-[var(--color-text-secondary)]">
        Page {page} of {totalPages}
      </p>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          className="btn-secondary h-9 px-3 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <ChevronLeft className="h-4 w-4" />
          Prev
        </button>
        <button
          type="button"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          className="btn-secondary h-9 px-3 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Next
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function numeric(value: string) {
  const next = Number(value);
  return Number.isFinite(next) && next >= 0 ? next : 0;
}

function buildDraftRows(staff: PayrollStaffMemberView[]): Record<string, PayrollDraftRow> {
  return Object.fromEntries(
    staff.map((member) => [
      member.id,
      {
        staffId: member.id,
        selected: member.isActive,
        basicSalary: member.lastBasicSalary ?? 0,
        housing: 0,
        transport: 0,
        meal: 0,
        otherAllowance: 0,
        paye: 0,
        pension: 0,
        otherDeduction: 0,
      },
    ]),
  );
}

function amountBadgeStyle(amount: number): CSSProperties {
  if (amount >= 250000) return { background: "var(--color-success-dim)", color: "var(--color-success)" };
  if (amount >= 100000) return { background: "var(--color-warning-dim)", color: "var(--color-warning)" };
  return { background: "var(--color-bg-subtle)", color: "var(--color-text-secondary)" };
}

export function PayrollWorkspace({ workspace }: PayrollWorkspaceProps) {
  const router = useRouter();
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState<PayrollTab>("roster");
  const [search, setSearch] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "ACTIVE" | "INACTIVE">("ALL");
  const [runsStatusFilter, setRunsStatusFilter] = useState<"ALL" | "PROCESSED" | "PUBLISHED">("ALL");
  const [rosterPage, setRosterPage] = useState(1);
  const [runsPage, setRunsPage] = useState(1);
  const [runDrawerOpen, setRunDrawerOpen] = useState(false);
  const [reviewDrawerOpen, setReviewDrawerOpen] = useState(false);
  const [selectedRun, setSelectedRun] = useState<PayrollRunView | null>(null);
  const [publishPassword, setPublishPassword] = useState("");
  const [draftMonth, setDraftMonth] = useState(new Date().getMonth() + 1);
  const [draftYear, setDraftYear] = useState(new Date().getFullYear());
  const [draftSessionId, setDraftSessionId] = useState(workspace.currentSessionId ?? "");
  const [draftRows, setDraftRows] = useState<Record<string, PayrollDraftRow>>(() => buildDraftRows(workspace.staff));
  const [processing, setProcessing] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [drawerSearch, setDrawerSearch] = useState("");

  const departments = useMemo(
    () =>
      Array.from(new Set(workspace.staff.map((member) => member.departmentName).filter(Boolean) as string[])).sort((a, b) =>
        a.localeCompare(b),
      ),
    [workspace.staff],
  );

  const filteredRoster = useMemo(() => {
    const query = search.trim().toLowerCase();
    return workspace.staff.filter((member) => {
      const matchesQuery =
        !query ||
        [
          member.staffName,
          member.employeeNo,
          member.departmentName ?? "",
          member.designation,
        ]
          .join(" ")
          .toLowerCase()
          .includes(query);
      const matchesDepartment = !departmentFilter || member.departmentName === departmentFilter;
      const matchesStatus =
        statusFilter === "ALL" ||
        (statusFilter === "ACTIVE" ? member.isActive : !member.isActive);
      return matchesQuery && matchesDepartment && matchesStatus;
    });
  }, [departmentFilter, search, statusFilter, workspace.staff]);

  const filteredRuns = useMemo(() => {
    const query = search.trim().toLowerCase();
    return workspace.payrollRuns.filter((run) => {
      const matchesQuery =
        !query ||
        [run.session ?? "", run.status, monthNames[run.month - 1], String(run.year)].join(" ").toLowerCase().includes(query);
      const matchesStatus = runsStatusFilter === "ALL" || run.status === runsStatusFilter;
      return matchesQuery && matchesStatus;
    });
  }, [runsStatusFilter, search, workspace.payrollRuns]);

  const paginatedRoster = useMemo(() => paginate(filteredRoster, rosterPage, 10), [filteredRoster, rosterPage]);
  const paginatedRuns = useMemo(() => paginate(filteredRuns, runsPage, 8), [filteredRuns, runsPage]);

  const totalLastNet = workspace.staff.reduce((sum, member) => sum + (member.lastNetSalary ?? 0), 0);
  const activeStaffCount = workspace.staff.filter((member) => member.isActive).length;
  const publishedRunsCount = workspace.payrollRuns.filter((run) => run.status === "PUBLISHED").length;
  const latestRun = workspace.payrollRuns[0];

  const drawerRows = useMemo(() => {
    const query = drawerSearch.trim().toLowerCase();
    return workspace.staff.filter((member) =>
      !query
        ? true
        : [member.staffName, member.employeeNo, member.departmentName ?? "", member.designation]
            .join(" ")
            .toLowerCase()
            .includes(query),
    );
  }, [drawerSearch, workspace.staff]);

  const selectedCount = Object.values(draftRows).filter((row) => row.selected).length;
  const selectedGross = Object.values(draftRows).reduce((sum, row) => {
    if (!row.selected) return sum;
    return sum + row.basicSalary + row.housing + row.transport + row.meal + row.otherAllowance;
  }, 0);
  const selectedDeductions = Object.values(draftRows).reduce((sum, row) => {
    if (!row.selected) return sum;
    return sum + row.paye + row.pension + row.otherDeduction;
  }, 0);
  const selectedNet = selectedGross - selectedDeductions;

  function openRunDrawer() {
    setDraftRows(buildDraftRows(workspace.staff));
    setDraftMonth(new Date().getMonth() + 1);
    setDraftYear(new Date().getFullYear());
    setDraftSessionId(workspace.currentSessionId ?? "");
    setDrawerSearch("");
    setRunDrawerOpen(true);
  }

  function updateDraftRow(staffId: string, key: keyof PayrollDraftRow, value: boolean | number) {
    setDraftRows((current) => ({
      ...current,
      [staffId]: {
        ...current[staffId],
        [key]: value,
      },
    }));
  }

  function selectAllActive() {
    setDraftRows((current) =>
      Object.fromEntries(
        Object.entries(current).map(([staffId, row]) => {
          const member = workspace.staff.find((item) => item.id === staffId);
          return [staffId, { ...row, selected: Boolean(member?.isActive) }];
        }),
      ),
    );
  }

  function clearSelection() {
    setDraftRows((current) =>
      Object.fromEntries(Object.entries(current).map(([staffId, row]) => [staffId, { ...row, selected: false }])),
    );
  }

  async function processPayroll() {
    const selectedRows = Object.values(draftRows).filter((row) => row.selected);
    if (selectedRows.length === 0) {
      showToast({
        variant: "warning",
        title: "Select staff first",
        description: "Choose at least one staff member before processing payroll.",
      });
      return;
    }

    const hasPositiveEntry = selectedRows.some((row) => row.basicSalary > 0);
    if (!hasPositiveEntry) {
      showToast({
        variant: "warning",
        title: "No payroll amounts entered",
        description: "Enter at least one basic salary before processing this payroll batch.",
      });
      return;
    }

    setProcessing(true);
    try {
      const response = await fetch("/api/v1/bursary/payroll/run", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          "x-csrf-token": getCookie("fr_csrf") ?? "",
        },
        body: JSON.stringify({
          academicSessionId: draftSessionId || undefined,
          month: draftMonth,
          year: draftYear,
          staffItems: selectedRows.map((row) => ({
            staffId: row.staffId,
            basicSalary: row.basicSalary,
            allowances: {
              housing: row.housing,
              transport: row.transport,
              meal: row.meal,
              other: row.otherAllowance,
            },
            deductions: {
              paye: row.paye,
              pension: row.pension,
              other: row.otherDeduction,
            },
          })),
        }),
      });
      const body = (await response.json()) as { ok?: boolean; error?: string };
      if (!response.ok || body.ok === false) {
        throw new Error(body.error ?? "Unable to process payroll.");
      }

      showToast({
        variant: "success",
        title: "Payroll processed",
        description: `${selectedRows.length} staff entries prepared for ${monthNames[draftMonth - 1]} ${draftYear}.`,
      });
      setRunDrawerOpen(false);
      router.refresh();
    } catch (error) {
      showToast({
        variant: "error",
        title: "Could not process payroll",
        description: error instanceof Error ? error.message : "Please review the payroll lines and try again.",
      });
    } finally {
      setProcessing(false);
    }
  }

  async function publishRun() {
    if (!selectedRun) return;
    if (!publishPassword.trim()) {
      showToast({
        variant: "warning",
        title: "Confirm your password",
        description: "Publishing payroll requires password reconfirmation.",
      });
      return;
    }

    setPublishing(true);
    try {
      const response = await fetch(`/api/v1/bursary/payroll/runs/${selectedRun.id}/publish`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          "x-csrf-token": getCookie("fr_csrf") ?? "",
        },
        body: JSON.stringify({ password: publishPassword }),
      });
      const body = (await response.json()) as { ok?: boolean; error?: string };
      if (!response.ok || body.ok === false) {
        throw new Error(body.error ?? "Unable to publish payroll.");
      }

      showToast({
        variant: "success",
        title: "Payroll published",
        description: `Payslips for ${monthNames[selectedRun.month - 1]} ${selectedRun.year} are now marked as paid.`,
      });
      setReviewDrawerOpen(false);
      setSelectedRun(null);
      setPublishPassword("");
      router.refresh();
    } catch (error) {
      showToast({
        variant: "error",
        title: "Could not publish payroll",
        description: error instanceof Error ? error.message : "Please try again.",
      });
    } finally {
      setPublishing(false);
    }
  }

  function openRunReview(run: PayrollRunView) {
    setSelectedRun(run);
    setPublishPassword("");
    setReviewDrawerOpen(true);
  }

  const selectedRunItems = useMemo(() => {
    if (!selectedRun) return [];
    return selectedRun.items;
  }, [selectedRun]);

  return (
    <div className="portal-page">
      <section className="surface-hero p-6 md:p-7">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div className="max-w-3xl">
            <p className="text-sm font-semibold uppercase tracking-[0.28em] text-[var(--color-text-accent)]">Staff payroll</p>
            <h1 className="mt-3 font-[var(--font-heading)] text-[26px] font-black text-[var(--color-text-primary)]">Run payroll without leaving the bursary desk</h1>
            <p className="mt-3 text-[13px] leading-6 text-[var(--color-text-secondary)]">
              Review staff pay history, prepare the current month&apos;s run from live staff records, and publish confirmed payouts with audit-safe confirmation.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button type="button" onClick={openRunDrawer} className="btn-primary">
              <BadgeDollarSign className="h-4 w-4" />
              Run payroll
            </button>
            <a href="/api/v1/bursary/reports/payroll?format=pdf" target="_blank" rel="noreferrer" className="btn-secondary">
              <Download className="h-4 w-4" />
              Export report
            </a>
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-[10px] border border-[var(--color-success)] bg-[var(--color-success-dim)] p-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--color-success)]">Active staff</p>
            <p className="mt-3 text-[22px] font-bold text-[var(--color-text-primary)]">{activeStaffCount}</p>
            <p className="mt-2 text-sm text-[var(--color-text-secondary)]">Payroll-ready staff profiles pulled from the database.</p>
          </div>
          <div className="rounded-[10px] border border-[var(--color-border-default)] bg-[var(--color-bg-subtle)] p-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--color-text-muted)]">Last payroll baseline</p>
            <p className="mt-3 text-[22px] font-bold text-[var(--color-text-primary)]">{formatCurrency(totalLastNet)}</p>
            <p className="mt-2 text-sm text-[var(--color-text-secondary)]">Combined last known net pay across staff records.</p>
          </div>
          <div className="rounded-[10px] border border-[var(--color-info)] bg-[var(--color-info-dim)] p-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--color-info)]">Published runs</p>
            <p className="mt-3 text-[22px] font-bold text-[var(--color-text-primary)]">{publishedRunsCount}</p>
            <p className="mt-2 text-sm text-[var(--color-text-secondary)]">Payroll batches fully published to staff.</p>
          </div>
          <div className="rounded-[10px] border border-[var(--color-warning)] bg-[var(--color-warning-dim)] p-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--color-warning)]">Current session</p>
            <p className="mt-3 text-lg font-black text-[var(--color-text-primary)]">{workspace.currentSessionName ?? "Not set"}</p>
            <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
              {latestRun ? `Latest run: ${monthNames[latestRun.month - 1]} ${latestRun.year}` : "No payroll run has been processed yet."}
            </p>
          </div>
        </div>
      </section>

      <section className="surface-card overflow-hidden">
        <div className="border-b border-[var(--color-border-default)] px-5 py-5">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="inline-flex rounded-2xl bg-[var(--color-bg-subtle)] p-1">
              <button
                type="button"
                onClick={() => {
                  setActiveTab("roster");
                  setSearch("");
                }}
                className={cn(
                  "rounded-xl px-4 py-2 text-sm font-semibold transition",
                  activeTab === "roster"
                    ? "bg-[var(--color-bg-surface)] text-[var(--color-text-accent)] shadow-sm"
                    : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]",
                )}
              >
                Staff roster
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveTab("runs");
                  setSearch("");
                }}
                className={cn(
                  "rounded-xl px-4 py-2 text-sm font-semibold transition",
                  activeTab === "runs"
                    ? "bg-[var(--color-bg-surface)] text-[var(--color-text-accent)] shadow-sm"
                    : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]",
                )}
              >
                Payroll history
              </button>
            </div>

            <div className="grid gap-3 md:grid-cols-[minmax(0,1.2fr)_repeat(2,minmax(180px,1fr))]">
              <label className="relative min-w-0">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-text-muted)]" />
                <input
                  value={search}
                  onChange={(event) => {
                    setSearch(event.target.value);
                    setRosterPage(1);
                    setRunsPage(1);
                  }}
                  placeholder={activeTab === "roster" ? "Search staff, employee no, department..." : "Search month, year, session..."}
                  className="field-control pl-10"
                />
              </label>

              {activeTab === "roster" ? (
                <>
                  <select
                    value={departmentFilter}
                    onChange={(event) => {
                      setDepartmentFilter(event.target.value);
                      setRosterPage(1);
                    }}
                    className="field-select"
                  >
                    <option value="">All departments</option>
                    {departments.map((department) => (
                      <option key={department} value={department}>
                        {department}
                      </option>
                    ))}
                  </select>
                  <select
                    value={statusFilter}
                    onChange={(event) => {
                      setStatusFilter(event.target.value as typeof statusFilter);
                      setRosterPage(1);
                    }}
                    className="field-select"
                  >
                    <option value="ALL">All statuses</option>
                    <option value="ACTIVE">Active</option>
                    <option value="INACTIVE">Inactive</option>
                  </select>
                </>
              ) : (
                <>
                  <select
                    value={runsStatusFilter}
                    onChange={(event) => {
                      setRunsStatusFilter(event.target.value as typeof runsStatusFilter);
                      setRunsPage(1);
                    }}
                    className="field-select"
                  >
                    <option value="ALL">All run statuses</option>
                    <option value="PROCESSED">Processed</option>
                    <option value="PUBLISHED">Published</option>
                  </select>
                  <div className="inline-flex items-center gap-2 rounded-2xl border border-[var(--color-border-default)] bg-[var(--color-bg-subtle)] px-3 text-sm text-[var(--color-text-secondary)]">
                    <Filter className="h-4 w-4" />
                    {`${filteredRuns.length} payroll runs`}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {activeTab === "roster" ? (
          <>
            <div className="overflow-x-auto px-5 py-5">
              <table className="min-w-full border-separate border-spacing-y-2">
                <thead>
                  <tr className="text-left text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--color-text-muted)]">
                    <th className="px-3 py-2">Staff</th>
                    <th className="px-3 py-2">Department</th>
                    <th className="px-3 py-2">Role</th>
                    <th className="px-3 py-2">Last basic</th>
                    <th className="px-3 py-2">Last net</th>
                    <th className="px-3 py-2">Last paid</th>
                    <th className="px-3 py-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedRoster.items.map((member) => (
                    <tr key={member.id} className="rounded-2xl bg-[var(--color-bg-subtle)] text-sm text-[var(--color-text-secondary)]">
                      <td className="rounded-l-2xl px-3 py-4">
                        <div className="flex items-start gap-3">
                          <div className="grid h-11 w-11 place-items-center rounded-2xl bg-[var(--color-bg-surface)] text-[var(--color-text-accent)] shadow-sm">
                            <Users className="h-5 w-5" />
                          </div>
                          <div>
                            <p className="font-semibold text-[var(--color-text-primary)]">{member.staffName}</p>
                            <p className="text-xs text-[var(--color-text-secondary)]">
                              {member.employeeNo} · {member.accountStatus ?? (member.isActive ? "ACTIVE" : "INACTIVE")}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-4">{member.departmentName ?? "Unassigned"}</td>
                      <td className="px-3 py-4">
                        <div>
                          <p className="font-medium text-[var(--color-text-primary)]">{member.designation}</p>
                          <p className="text-xs text-[var(--color-text-secondary)]">{member.salaryBand ?? member.employmentType ?? "Staff profile"}</p>
                        </div>
                      </td>
                      <td className="px-3 py-4">{member.lastBasicSalary ? formatCurrency(member.lastBasicSalary) : "-"}</td>
                      <td className="px-3 py-4">
                        <span className="rounded-full px-3 py-1 text-xs font-semibold" style={amountBadgeStyle(member.lastNetSalary ?? 0)}>
                          {member.lastNetSalary ? formatCurrency(member.lastNetSalary) : "No run yet"}
                        </span>
                      </td>
                      <td className="px-3 py-4">
                        {member.lastPayrollMonth && member.lastPayrollYear
                          ? `${monthNames[member.lastPayrollMonth - 1]} ${member.lastPayrollYear}`
                          : "-"}
                      </td>
                      <td className="rounded-r-2xl px-3 py-4">
                        <div className="flex justify-end">
                          <ActionMenu triggerLabel={`Payroll actions for ${member.staffName}`}>
                            <ActionMenuButton
                              onClick={() => {
                                openRunDrawer();
                                setDraftRows((current) =>
                                  Object.fromEntries(
                                    Object.entries(current).map(([staffId, row]) => [
                                      staffId,
                                      { ...row, selected: staffId === member.id },
                                    ]),
                                  ),
                                );
                              }}
                            >
                              <CircleDollarSign className="mr-2 h-4 w-4" />
                              Start payroll with this staff
                            </ActionMenuButton>
                          </ActionMenu>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {paginatedRoster.items.length === 0 ? (
                <div className="grid place-items-center rounded-[1.5rem] border border-dashed border-[var(--color-border-default)] bg-[var(--color-bg-subtle)] px-5 py-16 text-center">
                  <BriefcaseBusiness className="h-10 w-10 text-[var(--color-text-muted)]" />
                  <h3 className="mt-4 text-base font-semibold text-[var(--color-text-primary)]">No staff match those filters</h3>
                  <p className="mt-2 max-w-md text-sm leading-6 text-[var(--color-text-secondary)]">
                    Try a different search term or reset the department/status filters.
                  </p>
                </div>
              ) : null}
            </div>
            <Pagination page={paginatedRoster.page} totalPages={paginatedRoster.totalPages} onPageChange={setRosterPage} />
          </>
        ) : (
          <>
            <div className="overflow-x-auto px-5 py-5">
              <table className="min-w-full border-separate border-spacing-y-2">
                <thead>
                  <tr className="text-left text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--color-text-muted)]">
                    <th className="px-3 py-2">Period</th>
                    <th className="px-3 py-2">Session</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2">Staff count</th>
                    <th className="px-3 py-2">Net pay</th>
                    <th className="px-3 py-2">Processed</th>
                    <th className="px-3 py-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedRuns.items.map((run) => (
                    <tr key={run.id} className="rounded-2xl bg-[var(--color-bg-subtle)] text-sm text-[var(--color-text-secondary)]">
                      <td className="rounded-l-2xl px-3 py-4">
                        <p className="font-semibold text-[var(--color-text-primary)]">
                          {monthNames[run.month - 1]} {run.year}
                        </p>
                        <p className="text-xs text-[var(--color-text-secondary)]">{run.session ?? workspace.currentSessionName ?? "No linked session"}</p>
                      </td>
                      <td className="px-3 py-4">{run.session ?? "-"}</td>
                      <td className="px-3 py-4">
                        <span
                          className="rounded-full px-3 py-1 text-xs font-semibold"
                          style={
                            run.status === "PUBLISHED"
                              ? { background: "var(--color-success-dim)", color: "var(--color-success)" }
                              : { background: "var(--color-warning-dim)", color: "var(--color-warning)" }
                          }
                        >
                          {run.status}
                        </span>
                      </td>
                      <td className="px-3 py-4">{run.staffCount}</td>
                      <td className="px-3 py-4 font-semibold text-[var(--color-text-primary)]">{formatCurrency(run.totalNetSalary)}</td>
                      <td className="px-3 py-4">{run.processedAt ? formatDate(run.processedAt) : "-"}</td>
                      <td className="rounded-r-2xl px-3 py-4">
                        <div className="flex justify-end">
                          <ActionMenu triggerLabel={`Actions for ${monthNames[run.month - 1]} ${run.year}`}>
                            <ActionMenuButton onClick={() => openRunReview(run)}>
                              <Eye className="mr-2 h-4 w-4" />
                              Review run
                            </ActionMenuButton>
                            {run.status !== "PUBLISHED" ? (
                              <ActionMenuButton onClick={() => openRunReview(run)}>
                                <Send className="mr-2 h-4 w-4" />
                                Publish payslips
                              </ActionMenuButton>
                            ) : null}
                          </ActionMenu>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {paginatedRuns.items.length === 0 ? (
                <div className="grid place-items-center rounded-[1.5rem] border border-dashed border-[var(--color-border-default)] bg-[var(--color-bg-subtle)] px-5 py-16 text-center">
                  <Landmark className="h-10 w-10 text-[var(--color-text-muted)]" />
                  <h3 className="mt-4 text-base font-semibold text-[var(--color-text-primary)]">No payroll runs yet</h3>
                  <p className="mt-2 max-w-md text-sm leading-6 text-[var(--color-text-secondary)]">
                    Process the first payroll batch to create payout history for the bursary desk.
                  </p>
                </div>
              ) : null}
            </div>
            <Pagination page={paginatedRuns.page} totalPages={paginatedRuns.totalPages} onPageChange={setRunsPage} />
          </>
        )}
      </section>

      <SidePanel
        open={runDrawerOpen}
        onClose={() => setRunDrawerOpen(false)}
        title="Run staff payroll"
        subtitle="Prepare a monthly payroll batch using live staff records and the last known pay baseline where available."
        size="lg"
        footer={
          <div className="flex flex-col gap-3">
            <div className="grid gap-3 rounded-2xl bg-[var(--color-bg-subtle)] p-4 md:grid-cols-4">
              <div>
                <p className="text-xs uppercase tracking-[0.16em] text-[var(--color-text-muted)]">Selected staff</p>
                <p className="mt-1 text-lg font-bold text-[var(--color-text-primary)]">{selectedCount}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.16em] text-[var(--color-text-muted)]">Gross pay</p>
                <p className="mt-1 text-lg font-bold text-[var(--color-text-primary)]">{formatCurrency(selectedGross)}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.16em] text-[var(--color-text-muted)]">Deductions</p>
                <p className="mt-1 text-lg font-bold text-[var(--color-text-primary)]">{formatCurrency(selectedDeductions)}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.16em] text-[var(--color-text-muted)]">Net payroll</p>
                <p className="mt-1 text-lg font-bold text-[var(--color-success)]">{formatCurrency(selectedNet)}</p>
              </div>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-[var(--color-text-secondary)]">
                Payroll is saved as a processed run first. Publish it only after final review.
              </p>
              <div className="flex justify-end gap-3">
                <button type="button" onClick={() => setRunDrawerOpen(false)} className="btn-secondary">
                  Cancel
                </button>
                <button type="button" onClick={processPayroll} disabled={processing} className="btn-primary disabled:opacity-60">
                  {processing ? <Loader2 className="h-4 w-4 animate-spin" /> : <BadgeDollarSign className="h-4 w-4" />}
                  {processing ? "Processing..." : "Process payroll"}
                </button>
              </div>
            </div>
          </div>
        }
      >
        <div className="grid gap-5">
          <div className="grid gap-4 rounded-[1.5rem] border border-[var(--color-border-default)] bg-[var(--color-bg-subtle)] p-4 lg:grid-cols-4">
            <label className="grid gap-2">
              <span className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--color-text-secondary)]">Month</span>
              <select value={draftMonth} onChange={(event) => setDraftMonth(Number(event.target.value))} className="field-select">
                {monthOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-2">
              <span className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--color-text-secondary)]">Year</span>
              <input
                type="number"
                value={draftYear}
                onChange={(event) => setDraftYear(Number(event.target.value))}
                min={2024}
                className="field-control"
              />
            </label>
            <label className="grid gap-2">
              <span className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--color-text-secondary)]">Academic session</span>
              <select value={draftSessionId} onChange={(event) => setDraftSessionId(event.target.value)} className="field-select">
                <option value="">No linked session</option>
                {workspace.sessions.map((session) => (
                  <option key={session.id} value={session.id}>
                    {session.name}
                  </option>
                ))}
              </select>
            </label>
            <div className="grid gap-2">
              <span className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--color-text-secondary)]">Selection tools</span>
              <div className="flex gap-2">
                <button type="button" onClick={selectAllActive} className="btn-secondary h-11 flex-1 px-3">
                  Select active
                </button>
                <button type="button" onClick={clearSelection} className="btn-secondary h-11 flex-1 px-3">
                  Clear
                </button>
              </div>
            </div>
          </div>

          <label className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-text-muted)]" />
            <input
              value={drawerSearch}
              onChange={(event) => setDrawerSearch(event.target.value)}
              placeholder="Search staff in this payroll run..."
              className="field-control pl-10"
            />
          </label>

          <div className="overflow-x-auto rounded-[1.5rem] border border-[var(--color-border-default)]">
            <table className="min-w-[1200px] w-full">
              <thead className="bg-[var(--color-bg-subtle)]">
                <tr className="text-left text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--color-text-muted)]">
                  <th className="px-3 py-3">Include</th>
                  <th className="px-3 py-3">Staff</th>
                  <th className="px-3 py-3">Basic</th>
                  <th className="px-3 py-3">Housing</th>
                  <th className="px-3 py-3">Transport</th>
                  <th className="px-3 py-3">Meal</th>
                  <th className="px-3 py-3">Other allowance</th>
                  <th className="px-3 py-3">PAYE</th>
                  <th className="px-3 py-3">Pension</th>
                  <th className="px-3 py-3">Other deduction</th>
                </tr>
              </thead>
              <tbody>
                {drawerRows.map((member) => {
                  const row = draftRows[member.id];
                  return (
                    <tr key={member.id} className="border-t border-[var(--color-border-default)] text-sm text-[var(--color-text-secondary)]">
                      <td className="px-3 py-3">
                        <input
                          type="checkbox"
                          checked={row?.selected ?? false}
                          onChange={(event) => updateDraftRow(member.id, "selected", event.target.checked)}
                          className="h-4 w-4 rounded border-[var(--color-border-default)] text-[var(--color-accent-primary)]"
                        />
                      </td>
                      <td className="px-3 py-3">
                        <p className="font-semibold text-[var(--color-text-primary)]">{member.staffName}</p>
                        <p className="text-xs text-[var(--color-text-secondary)]">
                          {member.employeeNo} · {member.departmentName ?? "No department"} · {member.designation}
                        </p>
                      </td>
                      {(
                        [
                          ["basicSalary", row.basicSalary],
                          ["housing", row.housing],
                          ["transport", row.transport],
                          ["meal", row.meal],
                          ["otherAllowance", row.otherAllowance],
                          ["paye", row.paye],
                          ["pension", row.pension],
                          ["otherDeduction", row.otherDeduction],
                        ] as Array<[keyof PayrollDraftRow, number]>
                      ).map(([field, value]) => (
                        <td key={String(field)} className="px-3 py-3">
                          <input
                            type="number"
                            min={0}
                            value={value}
                            onChange={(event) => updateDraftRow(member.id, field, numeric(event.target.value))}
                            className="field-control min-w-[120px]"
                          />
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </SidePanel>

      <SidePanel
        open={reviewDrawerOpen}
        onClose={() => {
          setReviewDrawerOpen(false);
          setSelectedRun(null);
          setPublishPassword("");
        }}
        title={selectedRun ? `${monthNames[selectedRun.month - 1]} ${selectedRun.year} payroll` : "Payroll review"}
        subtitle="Review each staff payout line, then publish when the bursary desk is satisfied with the batch."
        size="lg"
        footer={
          selectedRun ? (
            <div className="grid gap-3">
              {selectedRun.status !== "PUBLISHED" ? (
                <div className="rounded-2xl border border-[var(--color-warning)] bg-[var(--color-warning-dim)] px-4 py-3">
                  <div className="flex items-start gap-3">
                    <ShieldCheck className="mt-0.5 h-4 w-4 text-[var(--color-warning)]" />
                    <div>
                      <p className="text-sm font-semibold text-[var(--color-warning)]">Password confirmation required</p>
                      <p className="mt-1 text-xs leading-5 text-[var(--color-warning)]">
                        Publishing payroll marks payslips as sent and prevents the same month from being re-published.
                      </p>
                    </div>
                  </div>
                  <input
                    type="password"
                    value={publishPassword}
                    onChange={(event) => setPublishPassword(event.target.value)}
                    placeholder="Enter your password to publish"
                    className="field-control mt-3 bg-[var(--color-bg-surface)]"
                  />
                </div>
              ) : null}
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setReviewDrawerOpen(false);
                    setSelectedRun(null);
                    setPublishPassword("");
                  }}
                  className="btn-secondary"
                >
                  Close
                </button>
                {selectedRun.status !== "PUBLISHED" ? (
                  <button type="button" onClick={publishRun} disabled={publishing} className="btn-primary disabled:opacity-60">
                    {publishing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    {publishing ? "Publishing..." : "Publish payroll"}
                  </button>
                ) : null}
              </div>
            </div>
          ) : null
        }
      >
        {selectedRun ? (
          <div className="grid gap-5">
            <div className="grid gap-4 rounded-[1.5rem] border border-[var(--color-border-default)] bg-[var(--color-bg-subtle)] p-4 md:grid-cols-4">
              <div>
                <p className="text-xs uppercase tracking-[0.16em] text-[var(--color-text-muted)]">Session</p>
                <p className="mt-1 text-sm font-semibold text-[var(--color-text-primary)]">{selectedRun.session ?? workspace.currentSessionName ?? "-"}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.16em] text-[var(--color-text-muted)]">Status</p>
                <p className="mt-1 text-sm font-semibold text-[var(--color-text-primary)]">{selectedRun.status}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.16em] text-[var(--color-text-muted)]">Staff count</p>
                <p className="mt-1 text-sm font-semibold text-[var(--color-text-primary)]">{selectedRun.staffCount}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.16em] text-[var(--color-text-muted)]">Net payroll</p>
                <p className="mt-1 text-sm font-semibold text-[var(--color-success)]">{formatCurrency(selectedRun.totalNetSalary)}</p>
              </div>
            </div>

            <div className="overflow-x-auto rounded-[1.5rem] border border-[var(--color-border-default)]">
              <table className="min-w-full">
                <thead className="bg-[var(--color-bg-subtle)]">
                  <tr className="text-left text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--color-text-muted)]">
                    <th className="px-3 py-3">Staff</th>
                    <th className="px-3 py-3">Department</th>
                    <th className="px-3 py-3">Basic</th>
                    <th className="px-3 py-3">Allowances</th>
                    <th className="px-3 py-3">Deductions</th>
                    <th className="px-3 py-3">Net</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedRunItems.map((item) => (
                    <tr key={item.id} className="border-t border-[var(--color-border-default)] text-sm text-[var(--color-text-secondary)]">
                      <td className="px-3 py-3">
                        <p className="font-semibold text-[var(--color-text-primary)]">{item.staffName}</p>
                        <p className="text-xs text-[var(--color-text-secondary)]">
                          {item.employeeNo} · {item.designation ?? "Staff"}
                        </p>
                      </td>
                      <td className="px-3 py-3">{item.departmentName ?? "Unassigned"}</td>
                      <td className="px-3 py-3">{formatCurrency(item.basicSalary)}</td>
                      <td className="px-3 py-3">
                        {Object.entries(item.allowances).length > 0
                          ? Object.entries(item.allowances)
                              .map(([key, value]) => `${key}: ${formatCurrency(Number(value))}`)
                              .join(", ")
                          : "-"}
                      </td>
                      <td className="px-3 py-3">
                        {Object.entries(item.deductions).length > 0
                          ? Object.entries(item.deductions)
                              .map(([key, value]) => `${key}: ${formatCurrency(Number(value))}`)
                              .join(", ")
                          : "-"}
                      </td>
                      <td className="px-3 py-3 font-semibold text-[var(--color-text-primary)]">{formatCurrency(item.netSalary)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}
      </SidePanel>
    </div>
  );
}
