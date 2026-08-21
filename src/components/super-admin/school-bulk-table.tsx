"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Download, Send, Shuffle, User, X } from "lucide-react";

import { ActionMenu, ActionMenuLink } from "@/components/ui/action-menu";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast-provider";
import { ResourceActionDialog } from "@/components/forms/resource-action-dialog";
import type { SuperAdminSchoolRow } from "@/lib/domain/types";
import { formatDate } from "@/lib/utils/formatters";

const planOptions = [
  { label: "Starter", value: "BASIC" },
  { label: "Standard", value: "STANDARD" },
  { label: "Trial", value: "PROFESSIONAL" },
  { label: "Elite", value: "ENTERPRISE" },
  { label: "NGO / Mission", value: "CUSTOM" }
];

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
  if (value >= 70) return "var(--color-danger)";
  if (value >= 40) return "var(--color-warning)";
  return "var(--color-success)";
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

export function SchoolBulkTable({ schools, total }: { schools: SuperAdminSchoolRow[]; total: number }) {
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
    <section className="surface-card overflow-hidden">
      <div className="border-b border-[var(--color-border-default)] px-5 py-5 md:px-6">
        <p className="section-eyebrow">Data overview</p>
        <h3 className="mt-2 font-[var(--font-display)] text-[20px] font-bold text-[var(--color-text-primary)]">All schools</h3>
        <p className="mt-2 max-w-2xl text-[13px] leading-6 text-[var(--color-text-secondary)]">{total} tenant(s) found.</p>
      </div>

      <div className="p-5 md:p-6">
        {selectedIds.length > 0 ? (
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-[12px] bg-[#0d2315] px-4 py-3">
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
            <p className="mt-4 text-[15px] font-semibold text-[var(--color-text-primary)]">Nothing to display yet</p>
            <p className="mt-1 max-w-md text-[13px] text-[var(--color-text-secondary)]">No schools match the current filters.</p>
          </div>
        ) : (
          <>
            <div className="grid gap-3 md:hidden">
              {schools.map((school) => {
                const tone = statusTone[school.status] ?? statusTone.ARCHIVED;
                const risk = school.healthScore ?? 0;
                return (
                  <article
                    key={school.id}
                    className="rounded-2xl border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] p-4 shadow-[var(--shadow-sm)]"
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
                        <p className="truncate text-[15px] font-semibold text-[var(--color-text-primary)]">{school.name}</p>
                        <p className="truncate text-[11px] text-[var(--color-text-muted)]">{school.slug}</p>
                      </Link>
                      <span className="shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold" style={{ background: tone.bg, color: tone.fg }}>
                        {tone.label}
                      </span>
                    </div>
                    <dl className="mt-4 grid grid-cols-2 gap-3">
                      <div className="rounded-xl bg-[var(--color-bg-subtle)] px-3 py-2">
                        <dt className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--color-text-muted)]">Tier</dt>
                        <dd className="mt-1 text-[13px] text-[var(--color-text-secondary)]">{planLabel(school.plan)}</dd>
                      </div>
                      <div className="rounded-xl bg-[var(--color-bg-subtle)] px-3 py-2">
                        <dt className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--color-text-muted)]">Students</dt>
                        <dd className="mt-1 text-[13px] text-[var(--color-text-secondary)]">{school.totalStudents.toLocaleString()}</dd>
                      </div>
                      <div className="rounded-xl bg-[var(--color-bg-subtle)] px-3 py-2">
                        <dt className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--color-text-muted)]">Created</dt>
                        <dd className="mt-1 text-[13px] text-[var(--color-text-secondary)]">{formatDate(school.createdAt)}</dd>
                      </div>
                      <div className="rounded-xl bg-[var(--color-bg-subtle)] px-3 py-2">
                        <dt className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--color-text-muted)]">Risk</dt>
                        <dd className="mt-1 text-[13px] font-bold" style={{ color: riskColor(risk) }}>{risk === 0 ? "—" : `${risk}%`}</dd>
                      </div>
                    </dl>
                  </article>
                );
              })}
            </div>

            <div className="hidden md:block">
              <div className="overflow-hidden rounded-2xl border border-[var(--color-border-default)]">
                <div className="overflow-x-auto">
                  <table className="min-w-full border-separate border-spacing-0">
                    <thead className="bg-[var(--color-bg-subtle)]">
                      <tr>
                        <th className="w-10 border-b border-[var(--color-border-default)] px-4 py-3">
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
                        {["School", "Location", "Tier", "Students", "Created", "Next Billing", "Status", "Risk", ""].map((header) => (
                          <th
                            key={header}
                            className="border-b border-[var(--color-border-default)] px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--color-text-muted)]"
                          >
                            {header}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {schools.map((school) => {
                        const tone = statusTone[school.status] ?? statusTone.ARCHIVED;
                        const risk = school.healthScore ?? 0;
                        return (
                          <tr
                            key={school.id}
                            className="border-b border-[var(--color-border-muted)] text-[13px] text-[var(--color-text-secondary)] transition"
                            style={{ background: selected[school.id] ? "var(--color-accent-primary-dim)" : "var(--color-bg-surface)" }}
                          >
                            <td className="px-4 py-3 align-top">
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
                            <td className="px-4 py-3 align-top">
                              <Link href={`/super-admin/schools/${school.id}`} className="group flex items-center gap-3">
                                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-[var(--color-bg-subtle)] font-[var(--font-mono)] text-[12px] font-bold text-[var(--color-text-primary)]">
                                  {initials(school.name)}
                                </span>
                                <span className="min-w-0">
                                  <span className="block truncate font-semibold text-[var(--color-text-primary)] group-hover:text-[var(--color-text-accent)]">
                                    {school.name}
                                  </span>
                                  <span className="block truncate text-[11px] text-[var(--color-text-muted)]">{school.slug}</span>
                                </span>
                              </Link>
                            </td>
                            <td className="px-4 py-3 align-top">{[school.state, school.country].filter(Boolean).join(", ") || "—"}</td>
                            <td className="px-4 py-3 align-top">{planLabel(school.plan)}</td>
                            <td className="px-4 py-3 align-top">{school.totalStudents.toLocaleString()}</td>
                            <td className="px-4 py-3 align-top">{formatDate(school.createdAt)}</td>
                            <td className="px-4 py-3 align-top">{school.nextBillingAt ? formatDate(school.nextBillingAt) : "—"}</td>
                            <td className="px-4 py-3 align-top">
                              <span className="inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold" style={{ background: tone.bg, color: tone.fg }}>
                                {tone.label}
                              </span>
                            </td>
                            <td className="px-4 py-3 align-top">
                              <div className="w-16">
                                <span className="text-[12.5px] font-bold font-[var(--font-mono)]" style={{ color: riskColor(risk) }}>
                                  {risk === 0 ? "—" : `${risk}%`}
                                </span>
                                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[var(--color-bg-subtle)]">
                                  <div className="h-full rounded-full" style={{ width: `${risk}%`, background: riskColor(risk) }} />
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-3 align-top">
                              <ActionMenu triggerLabel={`Actions for ${school.name}`}>
                                <ActionMenuLink href={`/super-admin/schools/${school.id}`}>View</ActionMenuLink>
                                <ResourceActionDialog
                                  triggerLabel="Edit"
                                  title={`Edit ${school.name}`}
                                  description="Update school name or plan. Status changes require a logged reason — use the Change status action below."
                                  endpoint={`/api/super-admin/schools/${school.id}`}
                                  method="PATCH"
                                  variant="menu"
                                  submitLabel="Save changes"
                                  fields={[
                                    { name: "name", label: "School Name", defaultValue: school.name },
                                    { name: "plan", label: "Plan", type: "select", options: planOptions, defaultValue: school.plan }
                                  ]}
                                />
                                <ResourceActionDialog
                                  triggerLabel="Change status"
                                  title={`Change status — ${school.name}`}
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
                                <ResourceActionDialog
                                  triggerLabel="Delete"
                                  title={`Soft-delete ${school.name}`}
                                  description="Soft-deletes the school tenant and disables associated users without hard-deleting records."
                                  endpoint={`/api/super-admin/schools/${school.id}`}
                                  method="DELETE"
                                  variant="menuDanger"
                                  submitLabel="Delete school"
                                  confirmLabel="Confirm Delete"
                                  confirmMessage="This will hide the tenant and disable its users. Records remain in the database for audit recovery."
                                  fields={[]}
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
          <button type="button" onClick={submitBatchStatus} disabled={submitting} className="btn-primary h-10 disabled:cursor-not-allowed disabled:opacity-60">
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
          <button type="button" onClick={submitAccountManager} disabled={submitting} className="btn-primary h-10 disabled:cursor-not-allowed disabled:opacity-60">
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
          <button type="button" onClick={submitNotification} disabled={submitting} className="btn-primary h-10 disabled:cursor-not-allowed disabled:opacity-60">
            {submitting ? "Sending…" : `Send to ${selectedIds.length} school(s)`}
          </button>
        </div>
      </Modal>
    </section>
  );
}
