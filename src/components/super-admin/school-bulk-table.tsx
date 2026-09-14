"use client";

import { useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { Download, Send, Shuffle, User, X } from "lucide-react";

import { ActionMenu, ActionMenuLink } from "@/components/ui/action-menu";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast-provider";
import { ResourceActionDialog } from "@/components/forms/resource-action-dialog";
import type { SuperAdminSchoolRow } from "@/lib/domain/types";
import { formatDate } from "@/lib/utils/formatters";

const statusTone: Record<string, { bg: string; fg: string; label: string }> = {
  TRIAL: { bg: "var(--color-warning-dim)", fg: "var(--color-warning)", label: "Trial Active" },
  ACTIVE: { bg: "var(--color-success-dim)", fg: "var(--color-success)", label: "Active" },
  GRACE_PERIOD: { bg: "var(--color-warning-dim)", fg: "var(--color-warning)", label: "Grace Period" },
  SUSPENDED: { bg: "var(--color-danger-dim)", fg: "var(--color-danger)", label: "Suspended" },
  ARCHIVED: { bg: "var(--color-bg-subtle)", fg: "var(--color-text-muted)", label: "Deactivated" },
  DELETED: { bg: "var(--color-danger-dim)", fg: "var(--color-danger)", label: "Deleted" }
};

const statusChangeOptions = [
  { label: "Trial Active", value: "TRIAL" },
  { label: "Active", value: "ACTIVE" },
  { label: "Grace Period", value: "GRACE_PERIOD" },
  { label: "Suspended", value: "SUSPENDED" },
  { label: "Deactivated / Closed", value: "ARCHIVED" }
];

function initials(name: string) {
  const letters = name
    .replace(/[^A-Za-z ]/g, "")
    .split(" ")
    .filter(Boolean)
    .map((word) => word[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return letters || "—";
}

function riskColor(value: number) {
  if (value >= 60) return "var(--color-danger)";
  if (value >= 30) return "var(--color-warning)";
  return "var(--color-success)";
}

// healthScore is a 0-100 HEALTH metric (higher = healthier — see listChurnRisk,
// which orders by healthScore ascending and flags scores under 50 as high risk).
// Churn risk is its inverse: a healthy school (high healthScore) is low risk.
function churnRiskPct(healthScore: number | undefined) {
  return 100 - (healthScore ?? 70);
}

function verificationInfo(school: SuperAdminSchoolRow): { label: string; note: string; tone: "success" | "warning" | "danger" | "neutral" } {
  if (school.verifiedAt) return { label: "Clear", note: `Verified ${formatDate(school.verifiedAt)}`, tone: "success" };
  if (school.verificationRejectedAt) return { label: "Rejected", note: school.verificationRejectionReason ?? "No reason recorded", tone: "danger" };
  if (school.flaggedForReviewReason) return { label: "Under review", note: school.flaggedForReviewReason, tone: "warning" };
  return { label: "Not reviewed", note: "No open signal", tone: "neutral" };
}

const verificationToneColors: Record<"success" | "warning" | "danger" | "neutral", { bg: string; fg: string }> = {
  success: { bg: "var(--color-success-dim)", fg: "var(--color-success)" },
  warning: { bg: "var(--color-warning-dim)", fg: "var(--color-warning)" },
  danger: { bg: "var(--color-danger-dim)", fg: "var(--color-danger)" },
  neutral: { bg: "var(--color-bg-subtle)", fg: "var(--color-text-muted)" }
};

function renewalText(school: SuperAdminSchoolRow) {
  if (school.status === "TRIAL" && school.trialEndsAt) {
    const days = Math.ceil((new Date(school.trialEndsAt).getTime() - Date.now()) / (24 * 60 * 60 * 1000));
    return days <= 0 ? "Trial ended" : `Trial · ${days}d left`;
  }
  if (school.billingStatus === "OVERDUE" && school.nextBillingAt) {
    const days = Math.ceil((Date.now() - new Date(school.nextBillingAt).getTime()) / (24 * 60 * 60 * 1000));
    return days > 0 ? `Overdue ${days}d` : "Overdue";
  }
  return school.nextBillingAt ? formatDate(school.nextBillingAt) : "—";
}

function planLabel(plan: string) {
  return plan.charAt(0) + plan.slice(1).toLowerCase();
}

function getCookie(name: string) {
  return document.cookie
    .split("; ")
    .find((item) => item.startsWith(`${name}=`))
    ?.split("=")[1];
}

async function authedFetch(url: string, method: string, body: unknown) {
  const response = await fetch(url, {
    method,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      "x-csrf-token": getCookie("fr_csrf") ?? ""
    },
    body: JSON.stringify(body)
  });
  const parsed = (await response.json().catch(() => ({}))) as { ok?: boolean; error?: string };
  if (!response.ok || parsed.ok === false) {
    throw new Error(parsed.error ?? "Request failed");
  }
}

function downloadCsv(schools: SuperAdminSchoolRow[]) {
  const headers = ["Name", "Slug", "Tier", "Status", "Students", "State", "Country", "Created"];
  const rows = schools.map((school) => [
    school.name,
    school.slug,
    school.plan,
    school.status,
    String(school.totalStudents),
    school.state ?? "",
    school.country ?? "",
    school.createdAt
  ]);
  const csv = [headers, ...rows]
    .map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(","))
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `schools-export-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function SchoolBulkTable({ schools, filterBar, paginationFooter }: { schools: SuperAdminSchoolRow[]; filterBar?: ReactNode; paginationFooter?: ReactNode }) {
  const { showToast } = useToast();
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [statusDialogOpen, setStatusDialogOpen] = useState(false);
  const [managerDialogOpen, setManagerDialogOpen] = useState(false);
  const [notifyDialogOpen, setNotifyDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [statusValue, setStatusValue] = useState("ACTIVE");
  const [statusReason, setStatusReason] = useState("");
  const [managerEmail, setManagerEmail] = useState("");
  const [notifyTitle, setNotifyTitle] = useState("");
  const [notifyBody, setNotifyBody] = useState("");

  const selectedIds = useMemo(() => Object.keys(selected).filter((id) => selected[id]), [selected]);
  const selectedSchools = useMemo(() => schools.filter((school) => selected[school.id]), [schools, selected]);
  const allChecked = schools.length > 0 && selectedIds.length === schools.length;
  const someChecked = selectedIds.length > 0 && !allChecked;

  function toggleSchool(id: string) {
    setSelected((current) => ({ ...current, [id]: !current[id] }));
  }

  function toggleAll() {
    if (allChecked || someChecked) {
      setSelected({});
    } else {
      setSelected(Object.fromEntries(schools.map((school) => [school.id, true])));
    }
  }

  function clearSelection() {
    setSelected({});
  }

  function selectOnly(id: string) {
    setSelected({ [id]: true });
  }

  async function submitBatchStatus() {
    if (statusReason.trim().length < 3) {
      showToast({ variant: "error", title: "Reason required", description: "Enter at least 3 characters explaining this status change." });
      return;
    }
    setSubmitting(true);
    try {
      await Promise.all(
        selectedIds.map((schoolId) =>
          authedFetch(`/api/super-admin/schools/${schoolId}/status`, "PATCH", { status: statusValue, reason: statusReason.trim() })
        )
      );
      showToast({ variant: "success", title: "Status updated", description: `${selectedIds.length} school(s) moved to ${statusValue}.` });
      setStatusDialogOpen(false);
      setStatusReason("");
      clearSelection();
      window.location.reload();
    } catch (error) {
      showToast({ variant: "error", title: "Batch status change failed", description: error instanceof Error ? error.message : "Please try again." });
    } finally {
      setSubmitting(false);
    }
  }

  async function submitAccountManager() {
    if (!managerEmail.trim()) {
      showToast({ variant: "error", title: "Email required", description: "Enter the account manager's email." });
      return;
    }
    setSubmitting(true);
    try {
      await Promise.all(
        selectedIds.map((schoolId) => authedFetch(`/api/super-admin/schools/${schoolId}/account-manager`, "POST", { accountManagerEmail: managerEmail.trim() }))
      );
      showToast({ variant: "success", title: "Account manager assigned", description: `Assigned to ${selectedIds.length} school(s).` });
      setManagerDialogOpen(false);
      setManagerEmail("");
      clearSelection();
    } catch (error) {
      showToast({ variant: "error", title: "Assignment failed", description: error instanceof Error ? error.message : "Please try again." });
    } finally {
      setSubmitting(false);
    }
  }

  async function submitNotification() {
    if (notifyTitle.trim().length < 2 || notifyBody.trim().length < 3) {
      showToast({ variant: "error", title: "Title and message required", description: "Enter a title and a message for the announcement." });
      return;
    }
    setSubmitting(true);
    try {
      await authedFetch("/api/super-admin/communications/announcements", "POST", {
        title: notifyTitle.trim(),
        body: notifyBody.trim(),
        type: "INFO",
        target: { audience: "SPECIFIC_SCHOOLS", schoolIds: selectedIds }
      });
      showToast({ variant: "success", title: "Announcement created", description: `Targeted at ${selectedIds.length} school(s). Review it in Communications.` });
      setNotifyDialogOpen(false);
      setNotifyTitle("");
      setNotifyBody("");
      clearSelection();
    } catch (error) {
      showToast({ variant: "error", title: "Could not create announcement", description: error instanceof Error ? error.message : "Please try again." });
    } finally {
      setSubmitting(false);
    }
  }

  function handleExport() {
    downloadCsv(selectedSchools);
    showToast({ variant: "success", title: "Export ready", description: `${selectedSchools.length} school(s) exported to CSV.` });
  }

  return (
    <section className="overflow-hidden rounded-[14px] border border-[#DEE8E2] bg-white">
      {filterBar}
      <div className="p-0">
        {selectedIds.length > 0 ? (
          <div className="m-3 flex flex-wrap items-center justify-between gap-3 rounded-[12px] bg-[#0d2315] px-4 py-[11px]">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={clearSelection}
                className="flex h-[17px] w-[17px] shrink-0 items-center justify-center rounded-[5px] bg-white"
                aria-label="Clear selection"
              >
                <X className="h-3 w-3 text-[#0d2315]" strokeWidth={3.4} />
              </button>
              <p className="text-[12.5px] font-semibold text-white">
                {selectedIds.length === 1 ? "1 school selected" : `${selectedIds.length} schools selected`}
              </p>
              <button type="button" onClick={clearSelection} className="text-[11.5px] font-semibold text-[rgba(255,255,255,0.6)] hover:text-white">
                Clear
              </button>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setNotifyDialogOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-[8px] bg-white px-3 py-1.5 text-[12px] font-semibold text-[#0d2315]"
              >
                <Send className="h-3.5 w-3.5" />
                Send notification
              </button>
              <button
                type="button"
                onClick={handleExport}
                className="inline-flex items-center gap-1.5 rounded-[8px] border border-[rgba(255,255,255,0.28)] px-3 py-1.5 text-[12px] font-semibold text-white"
              >
                <Download className="h-3.5 w-3.5" />
                Export data
              </button>
              <button
                type="button"
                onClick={() => setStatusDialogOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-[8px] border border-[rgba(255,255,255,0.28)] px-3 py-1.5 text-[12px] font-semibold text-white"
              >
                <Shuffle className="h-3.5 w-3.5" />
                Batch status change
              </button>
              <button
                type="button"
                onClick={() => setManagerDialogOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-[8px] border border-[rgba(255,255,255,0.28)] px-3 py-1.5 text-[12px] font-semibold text-white"
              >
                <User className="h-3.5 w-3.5" />
                Assign account manager
              </button>
            </div>
          </div>
        ) : null}

        {schools.length === 0 ? (
          <div className="empty-state">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--color-accent-primary-dim)] text-[var(--color-text-accent)]">
              <span className="text-lg font-bold">+</span>
            </div>
            <p className="mt-4 text-[15px] font-semibold text-[#0D2315]">Nothing to display yet</p>
            <p className="mt-1 max-w-md text-[13px] text-[#435048]">No schools match the current filters.</p>
          </div>
        ) : (
          <>
            <div className="grid gap-3 md:hidden">
              {schools.map((school) => {
                const tone = statusTone[school.status] ?? statusTone.ARCHIVED;
                const risk = churnRiskPct(school.healthScore);
                const verification = verificationInfo(school);
                const verificationColors = verificationToneColors[verification.tone];
                return (
                  <article
                    key={school.id}
                    className="rounded-[14px] border border-[#DEE8E2] bg-white p-4"
                  >
                    <div className="flex items-start gap-3">
                      <button
                        type="button"
                        onClick={() => toggleSchool(school.id)}
                        className="mt-1 flex h-[17px] w-[17px] shrink-0 items-center justify-center rounded-[5px] border-[1.5px]"
                        style={{
                          background: selected[school.id] ? "#0d2315" : "#fff",
                          borderColor: selected[school.id] ? "#0d2315" : "var(--color-border-default)"
                        }}
                        aria-label={`Select ${school.name}`}
                      >
                        {selected[school.id] ? <span className="block h-2 w-2 rounded-[2px] bg-white" /> : null}
                      </button>
                      <Link href={`/super-admin/schools/${school.id}`} className="min-w-0 flex-1">
                        <p className="truncate text-[15px] font-semibold text-[#0D2315]">{school.name}</p>
                        <p className="truncate text-[11px] text-[#77857C]">{[school.city, school.state].filter(Boolean).join(", ") || "—"}</p>
                      </Link>
                      <span className="shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold" style={{ background: tone.bg, color: tone.fg }}>
                        {tone.label}
                      </span>
                    </div>
                    <div className="mt-3 flex items-center gap-2">
                      <span className="rounded-full px-2.5 py-1 text-[11px] font-bold" style={{ background: verificationColors.bg, color: verificationColors.fg }}>
                        {verification.label}
                      </span>
                      <span className="truncate text-[11px] text-[#9fb8a7]">{verification.note}</span>
                    </div>
                    <dl className="mt-3 grid grid-cols-2 gap-3">
                      <div className="rounded-[10px] bg-[#F7FAF8] px-3 py-2">
                        <dt className="text-[10px] font-semibold uppercase tracking-[0.05em] text-[#9FB8A7]">Tier</dt>
                        <dd className="mt-1 text-[13px] text-[#435048]">{planLabel(school.plan)}</dd>
                      </div>
                      <div className="rounded-[10px] bg-[#F7FAF8] px-3 py-2">
                        <dt className="text-[10px] font-semibold uppercase tracking-[0.05em] text-[#9FB8A7]">Students</dt>
                        <dd className="mt-1 text-[13px] text-[#435048]">{school.totalStudents.toLocaleString()}</dd>
                      </div>
                      <div className="rounded-[10px] bg-[#F7FAF8] px-3 py-2">
                        <dt className="text-[10px] font-semibold uppercase tracking-[0.05em] text-[#9FB8A7]">Last login</dt>
                        <dd className="mt-1 text-[13px] text-[#435048]">{school.lastSuccessfulLoginAt ? formatDate(school.lastSuccessfulLoginAt) : "Never"}</dd>
                      </div>
                      <div className="rounded-[10px] bg-[#F7FAF8] px-3 py-2">
                        <dt className="text-[10px] font-semibold uppercase tracking-[0.05em] text-[#9FB8A7]">Churn risk</dt>
                        <dd className="mt-1 text-[13px] font-bold" style={{ color: riskColor(risk) }}>{risk}%</dd>
                      </div>
                    </dl>
                  </article>
                );
              })}
            </div>

            <div className="hidden md:block">
              <div className="overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="min-w-full border-separate border-spacing-0">
                    <thead className="bg-[#F7FAF8]">
                      <tr>
                        <th className="w-[34px] border-b border-[#E6EEE9] px-[18px] py-3">
                          <button
                            type="button"
                            onClick={toggleAll}
                            className="flex h-[17px] w-[17px] items-center justify-center rounded-[5px] border-[1.5px]"
                            style={{
                              background: allChecked || someChecked ? "#0d2315" : "#fff",
                              borderColor: allChecked || someChecked ? "#0d2315" : "var(--color-border-default)"
                            }}
                            aria-label="Select all schools"
                          >
                            {allChecked ? (
                              <span className="block h-2 w-2 rounded-[1px] bg-white" />
                            ) : someChecked ? (
                              <span className="block h-[2px] w-2 bg-white" />
                            ) : null}
                          </button>
                        </th>
                        {["School", "Tier", "Status", "Risk assessment", "Students", "Last login", "Trial / renewal", "Churn risk", ""].map((header) => (
                          <th
                            key={header}
                            className="border-b border-[#E6EEE9] px-[18px] py-3 text-left text-[10.5px] font-semibold uppercase tracking-[0.05em] text-[#8C9A92]"
                          >
                            {header}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {schools.map((school) => {
                        const tone = statusTone[school.status] ?? statusTone.ARCHIVED;
                        const risk = churnRiskPct(school.healthScore);
                        const verification = verificationInfo(school);
                        const verificationColors = verificationToneColors[verification.tone];
                        return (
                          <tr
                            key={school.id}
                            className="text-[12.5px] text-[#435048] transition hover:bg-[#F7FBF9]"
                            style={{ background: selected[school.id] ? "#F7FBF9" : "#fff" }}
                          >
                            <td className="border-b border-[#F2F7F4] px-[18px] py-3 align-top">
                              <button
                                type="button"
                                onClick={() => toggleSchool(school.id)}
                                className="flex h-[17px] w-[17px] items-center justify-center rounded-[5px] border-[1.5px]"
                                style={{
                                  background: selected[school.id] ? "#0d2315" : "#fff",
                                  borderColor: selected[school.id] ? "#0d2315" : "var(--color-border-default)"
                                }}
                                aria-label={`Select ${school.name}`}
                              >
                                {selected[school.id] ? <span className="block h-2 w-2 rounded-[2px] bg-white" /> : null}
                              </button>
                            </td>
                            <td className="border-b border-[#F2F7F4] px-[18px] py-3 align-top">
                              <Link href={`/super-admin/schools/${school.id}`} className="group flex items-center gap-3">
                                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-[#F0F5F2] font-[var(--font-heading)] text-[12px] font-bold text-[#0D2315]">
                                  {initials(school.name)}
                                </span>
                                <span className="min-w-0">
                                  <span className="block truncate font-semibold text-[#0D2315] group-hover:text-[#12796A]">
                                    {school.name}
                                  </span>
                                  <span className="block truncate text-[11px] text-[#77857C]">{[school.city, school.state].filter(Boolean).join(", ") || "—"}</span>
                                </span>
                              </Link>
                            </td>
                            <td className="border-b border-[#F2F7F4] px-[18px] py-3 align-top">{planLabel(school.plan)}</td>
                            <td className="border-b border-[#F2F7F4] px-[18px] py-3 align-top">
                              <span className="inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold" style={{ background: tone.bg, color: tone.fg }}>
                                {tone.label}
                              </span>
                            </td>
                            <td className="border-b border-[#F2F7F4] px-[18px] py-3 align-top">
                              <span className="inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold" style={{ background: verificationColors.bg, color: verificationColors.fg }}>
                                {verification.label}
                              </span>
                              <div className="mt-[3px] max-w-[160px] truncate text-[10.5px] text-[#9fb8a7]">{verification.note}</div>
                            </td>
                            <td className="border-b border-[#F2F7F4] px-[18px] py-3 align-top font-[var(--font-mono)]">{school.totalStudents.toLocaleString()}</td>
                            <td className="border-b border-[#F2F7F4] px-[18px] py-3 align-top">
                              {school.lastSuccessfulLoginAt ? (
                                formatDate(school.lastSuccessfulLoginAt)
                              ) : (
                                <span className="font-semibold text-[#B23B3B]">Never</span>
                              )}
                            </td>
                            <td className="border-b border-[#F2F7F4] px-[18px] py-3 align-top">{renewalText(school)}</td>
                            <td className="border-b border-[#F2F7F4] px-[18px] py-3 align-top">
                              <div className="w-16">
                                <span className="text-[12.5px] font-bold font-[var(--font-mono)]" style={{ color: riskColor(risk) }}>
                                  {risk}%
                                </span>
                                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[#EDF3EF]">
                                  <div className="h-full rounded-full" style={{ width: `${risk}%`, background: riskColor(risk) }} />
                                </div>
                              </div>
                            </td>
                            <td className="border-b border-[#F2F7F4] px-[18px] py-3 align-top">
                              <ActionMenu triggerLabel={`Actions for ${school.name}`}>
                                <ActionMenuLink href="/super-admin/schools?tab=approval-queue">Review verification</ActionMenuLink>
                                <ActionMenuLink href={`/super-admin/schools/${school.id}`}>Open school profile</ActionMenuLink>
                                <button
                                  type="button"
                                  onClick={() => {
                                    selectOnly(school.id);
                                    setNotifyDialogOpen(true);
                                  }}
                                  className="flex w-full items-center justify-start gap-2 rounded-[10px] px-3 py-2.5 text-left text-[13px] font-semibold text-[var(--color-text-secondary)] transition-colors duration-150 hover:bg-[var(--color-accent-primary-dim)] hover:text-[var(--color-text-accent)]"
                                >
                                  Send notification
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    selectOnly(school.id);
                                    setManagerDialogOpen(true);
                                  }}
                                  className="flex w-full items-center justify-start gap-2 rounded-[10px] px-3 py-2.5 text-left text-[13px] font-semibold text-[var(--color-text-secondary)] transition-colors duration-150 hover:bg-[var(--color-accent-primary-dim)] hover:text-[var(--color-text-accent)]"
                                >
                                  Assign account manager
                                </button>
                                <ResourceActionDialog
                                  triggerLabel={school.status === "SUSPENDED" ? "Reactivate account" : "Suspend account"}
                                  title={`${school.status === "SUSPENDED" ? "Reactivate" : "Suspend"} — ${school.name}`}
                                  description="Every status change requires a logged reason and is written to the audit trail."
                                  endpoint={`/api/super-admin/schools/${school.id}/status`}
                                  method="PATCH"
                                  variant={school.status === "SUSPENDED" ? "menu" : "menuDanger"}
                                  submitLabel="Update status"
                                  confirmLabel="Confirm"
                                  confirmMessage="This changes tenant access for all school users and is fully audited."
                                  fields={[
                                    { name: "status", label: "New status", type: "select", defaultValue: school.status === "SUSPENDED" ? "ACTIVE" : "SUSPENDED", options: statusChangeOptions },
                                    { name: "reason", label: "Reason", type: "textarea", required: true }
                                  ]}
                                />
                              </ActionMenu>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {paginationFooter}

      <Modal open={statusDialogOpen} onClose={() => setStatusDialogOpen(false)} title="Batch status change" subtitle={`Update ${selectedIds.length} school(s) at once. This is fully audited.`}>
        <div className="grid gap-4">
          <label className="block">
            <span className="mb-1.5 block text-[12px] font-semibold text-[var(--color-text-secondary)]">New status</span>
            <select
              value={statusValue}
              onChange={(event) => setStatusValue(event.target.value)}
              className="field-control h-10 w-full rounded-[10px] text-[13px]"
            >
              {statusChangeOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1.5 block text-[12px] font-semibold text-[var(--color-text-secondary)]">Reason</span>
            <textarea
              value={statusReason}
              onChange={(event) => setStatusReason(event.target.value)}
              rows={3}
              className="field-control w-full rounded-[10px] text-[13px]"
              placeholder="Why are these schools changing status?"
            />
          </label>
        </div>
        <div className="sticky -bottom-[22px] -mx-[26px] -mb-[22px] mt-5 flex items-center justify-end gap-2 border-t border-[#EDF3EF] bg-[#FBFDFC] px-[26px] py-[15px]">
          <button type="button" onClick={() => setStatusDialogOpen(false)} disabled={submitting} className="btn-secondary h-10 px-5 disabled:cursor-not-allowed disabled:opacity-50">Cancel</button>
          <button type="button" onClick={submitBatchStatus} disabled={submitting} className="btn-primary h-10 px-6 disabled:cursor-not-allowed disabled:opacity-60">
            {submitting ? "Updating…" : `Update ${selectedIds.length} school(s)`}
          </button>
        </div>
      </Modal>

      <Modal open={managerDialogOpen} onClose={() => setManagerDialogOpen(false)} title="Assign account manager" subtitle={`Applies to ${selectedIds.length} school(s).`}>
        <div className="grid gap-4">
          <label className="block">
            <span className="mb-1.5 block text-[12px] font-semibold text-[var(--color-text-secondary)]">Account manager email</span>
            <input
              type="email"
              value={managerEmail}
              onChange={(event) => setManagerEmail(event.target.value)}
              className="field-control h-10 w-full rounded-[10px] text-[13px]"
              placeholder="manager@futurerealm.sms"
            />
            <span className="mt-1.5 block text-[11px] text-[var(--color-text-muted)]">Must be an active internal team member.</span>
          </label>
        </div>
        <div className="sticky -bottom-[22px] -mx-[26px] -mb-[22px] mt-5 flex items-center justify-end gap-2 border-t border-[#EDF3EF] bg-[#FBFDFC] px-[26px] py-[15px]">
          <button type="button" onClick={() => setManagerDialogOpen(false)} disabled={submitting} className="btn-secondary h-10 px-5 disabled:cursor-not-allowed disabled:opacity-50">Cancel</button>
          <button type="button" onClick={submitAccountManager} disabled={submitting} className="btn-primary h-10 px-6 disabled:cursor-not-allowed disabled:opacity-60">
            {submitting ? "Assigning…" : `Assign to ${selectedIds.length} school(s)`}
          </button>
        </div>
      </Modal>

      <Modal open={notifyDialogOpen} onClose={() => setNotifyDialogOpen(false)} title="Send notification" subtitle={`Creates a targeted announcement for ${selectedIds.length} school(s).`}>
        <div className="grid gap-4">
          <label className="block">
            <span className="mb-1.5 block text-[12px] font-semibold text-[var(--color-text-secondary)]">Title</span>
            <input
              value={notifyTitle}
              onChange={(event) => setNotifyTitle(event.target.value)}
              className="field-control h-10 w-full rounded-[10px] text-[13px]"
              placeholder="e.g. Scheduled maintenance this weekend"
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-[12px] font-semibold text-[var(--color-text-secondary)]">Message</span>
            <textarea
              value={notifyBody}
              onChange={(event) => setNotifyBody(event.target.value)}
              rows={4}
              className="field-control w-full rounded-[10px] text-[13px]"
              placeholder="What do these schools need to know?"
            />
          </label>
        </div>
        <div className="sticky -bottom-[22px] -mx-[26px] -mb-[22px] mt-5 flex items-center justify-end gap-2 border-t border-[#EDF3EF] bg-[#FBFDFC] px-[26px] py-[15px]">
          <button type="button" onClick={() => setNotifyDialogOpen(false)} disabled={submitting} className="btn-secondary h-10 px-5 disabled:cursor-not-allowed disabled:opacity-50">Cancel</button>
          <button type="button" onClick={submitNotification} disabled={submitting} className="btn-primary h-10 px-6 disabled:cursor-not-allowed disabled:opacity-60">
            {submitting ? "Sending…" : `Send to ${selectedIds.length} school(s)`}
          </button>
        </div>
      </Modal>
    </section>
  );
}
