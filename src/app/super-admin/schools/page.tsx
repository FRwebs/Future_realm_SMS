import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowRight, Building2, Clock3, FileWarning, Gavel, Globe2, Layers, Mail, MapPin, Moon, Phone, ShieldCheck, Users } from "lucide-react";

import { CaseReviewBoard, type CaseRecord, type CaseTypeFilter } from "@/components/data-display/case-review-board";
import { DetailTabs } from "@/components/data-display/detail-tabs";
import { ModuleHero } from "@/components/data-display/module-hero";
import { StatCard } from "@/components/data-display/stat-card";
import { TableCard } from "@/components/data-display/table-card";
import { FilterToolbar } from "@/components/filters/filter-toolbar";
import { ResourceActionDialog } from "@/components/forms/resource-action-dialog";
import { AddSchoolWizard } from "@/components/super-admin/add-school-wizard";
import { SchoolBulkTable } from "@/components/super-admin/school-bulk-table";
import { ActionMenu } from "@/components/ui/action-menu";
import { apiGetEnvelope } from "@/lib/api/server";
import type {
  SuperAdminAuditLogRow,
  SuperAdminPendingVerificationSchool,
  SuperAdminPlanRow,
  SuperAdminSchoolContact,
  SuperAdminSchoolGroup,
  SuperAdminSchoolRow
} from "@/lib/domain/types";

// The backend already returns `subdomain` / `schoolCode` on every school row (see
// backend/src/modules/super-admin/super-admin.service.ts `listSchools`) but the shared
// `SuperAdminSchoolRow` type doesn't declare them yet. Extending locally here avoids
// touching the shared types file while still reflecting real API data.
type SchoolWithWebFields = SuperAdminSchoolRow & { subdomain?: string | null; schoolCode?: string | null };

interface SchoolDormancyRow {
  id: string;
  name: string;
  status: string;
  createdAt: string;
  lastSuccessfulLoginAt: string | null;
}

interface WebAddressRecordRow {
  id: string;
  address: string;
  schoolId: string | null;
  schoolName: string | null;
  state: string;
  redirectFromAddress: string | null;
  redirectExpiresAt: string | null;
  retiredAt: string | null;
  releaseEligibleAt: string | null;
}

interface AddressDisputeRow {
  id: string;
  claimedAddress: string;
  claimantSchoolName: string;
  claimantContactName: string;
  claimantContactEmail: string;
  evidenceNotes: string;
  status: string;
  holderNotifiedAt: string | null;
  holderResponseDueAt: string | null;
  holderRespondedAt: string | null;
  holderResponse: string | null;
  outcome: string | null;
  decidedAt: string | null;
  decidedByName: string | null;
  createdAt: string;
}

interface OwnershipTransferRow {
  id: string;
  schoolId: string;
  schoolName: string | null;
  outgoingOwnerName: string | null;
  outgoingOwnerEmail: string | null;
  incomingOwnerId: string | null;
  incomingOwnerName: string | null;
  triggerType: string;
  evidenceNotes: string;
  status: string;
  noticeSentAt: string | null;
  holdExpiresAt: string | null;
  objectionNote: string | null;
  approver1Id: string | null;
  approver1At: string | null;
  approver2Id: string | null;
  approver2At: string | null;
  requiresDualApproval: boolean;
  executedAt: string | null;
  createdAt: string;
}

const disputeStatusTone: Record<string, { bg: string; fg: string; label: string }> = {
  EVIDENCE_PENDING: { bg: "var(--color-warning-dim)", fg: "var(--color-warning)", label: "Evidence pending" },
  HOLDER_CONTACTED: { bg: "var(--color-info-dim)", fg: "var(--color-info)", label: "Holder contacted" },
  DECIDED: { bg: "var(--color-bg-subtle)", fg: "var(--color-text-muted)", label: "Decided" }
};

const transferTriggerLabel: Record<string, string> = {
  VOLUNTARY_SALE: "Voluntary sale",
  OWNER_INCAPACITATED: "Owner incapacitated",
  OWNER_DECEASED: "Owner deceased",
  DISPUTE: "Dispute between claimants"
};

const transferStatusTone: Record<string, { bg: string; fg: string; label: string }> = {
  EVIDENCE_COLLECTED: { bg: "var(--color-warning-dim)", fg: "var(--color-warning)", label: "Evidence collected" },
  NOTICE_SENT: { bg: "var(--color-info-dim)", fg: "var(--color-info)", label: "Notice sent" },
  OBJECTION_RAISED: { bg: "var(--color-danger-dim)", fg: "var(--color-danger)", label: "Objection — frozen" },
  APPROVED: { bg: "var(--color-info-dim)", fg: "var(--color-info)", label: "Approved" },
  EXECUTED: { bg: "var(--color-success-dim)", fg: "var(--color-success)", label: "Executed" },
  FROZEN: { bg: "var(--color-danger-dim)", fg: "var(--color-danger)", label: "Frozen" }
};

const planOptions = [
  { label: "Starter", value: "BASIC" },
  { label: "Standard", value: "STANDARD" },
  { label: "Trial", value: "PROFESSIONAL" },
  { label: "Elite", value: "ENTERPRISE" },
  { label: "NGO / Mission", value: "CUSTOM" }
];

const schoolTypeOptions = [
  { label: "Mixed / Combined", value: "MIXED" },
  { label: "Nursery", value: "NURSERY" },
  { label: "Primary", value: "PRIMARY" },
  { label: "Secondary", value: "SECONDARY" },
  { label: "College", value: "COLLEGE" }
];

const statusFilterOptions = [
  { label: "All statuses", value: "" },
  { label: "Active", value: "ACTIVE" },
  { label: "Trial", value: "TRIAL" },
  { label: "Grace period", value: "GRACE_PERIOD" },
  { label: "Suspended", value: "SUSPENDED" },
  { label: "Archived", value: "ARCHIVED" }
];

const planFilterOptions = [{ label: "All tiers", value: "" }, ...planOptions];

const statusTone: Record<string, { bg: string; fg: string; label: string }> = {
  TRIAL: { bg: "var(--color-warning-dim)", fg: "var(--color-warning)", label: "Trial Active" },
  ACTIVE: { bg: "var(--color-success-dim)", fg: "var(--color-success)", label: "Active" },
  GRACE_PERIOD: { bg: "var(--color-warning-dim)", fg: "var(--color-warning)", label: "Grace Period" },
  SUSPENDED: { bg: "var(--color-danger-dim)", fg: "var(--color-danger)", label: "Suspended" },
  ARCHIVED: { bg: "var(--color-bg-subtle)", fg: "var(--color-text-muted)", label: "Deactivated" },
  DELETED: { bg: "var(--color-danger-dim)", fg: "var(--color-danger)", label: "Deleted" }
};

const RECENT_SIGNUP_WINDOW_HOURS = 48;

const lifecycleFlow = [
  { label: "Signup submitted", trigger: "Self-service — automatic" },
  { label: "Trial Active", trigger: "Granted immediately · 30-day trial" },
  { label: "Verified", trigger: "Reviewed in Reviews & Cases · does not block access" },
  { label: "Active", trigger: "Payment confirmed", emphasize: true },
  { label: "Grace Period", trigger: "Payment overdue" },
  { label: "Suspended", trigger: "Verification rejected / grace period expired / policy violation" },
  { label: "Deactivated", trigger: "Data export completed · closure confirmed" }
];

const statusReference = [
  {
    status: "TRIAL",
    label: "Trial Active",
    meaning: "30-day free trial, granted automatically at signup.",
    trigger: "System — automatic on signup",
    who: "System (self-service)"
  },
  {
    status: "ACTIVE",
    label: "Active",
    meaning: "Paying subscription in good standing.",
    trigger: "Payment confirmed, or reactivated after suspension.",
    who: "System / Super Admin"
  },
  {
    status: "GRACE_PERIOD",
    label: "Grace Period",
    meaning: "Subscription lapsed — access continues on a short countdown.",
    trigger: "System — on payment overdue.",
    who: "System"
  },
  {
    status: "SUSPENDED",
    label: "Suspended",
    meaning: "Full access blocked.",
    trigger: "Grace period expired, or a logged policy violation.",
    who: "Super Admin — reason required"
  },
  {
    status: "ARCHIVED",
    label: "Deactivated",
    meaning: "School has formally left the platform.",
    trigger: "Closure requested — after a full data export.",
    who: "Super Admin only"
  },
  {
    status: "DELETED",
    label: "Deleted",
    meaning: "Soft-deleted — hidden from active views, retained for audit recovery.",
    trigger: "Explicit deletion action.",
    who: "Super Admin only"
  }
] as const;

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

function planLabel(plan: string) {
  return plan.charAt(0) + plan.slice(1).toLowerCase();
}

function categoryLabel(category?: string) {
  if (!category) return "—";
  return schoolTypeOptions.find((option) => option.value === category)?.label ?? category;
}

function timeAgo(iso: string) {
  const ms = Date.now() - new Date(iso).getTime();
  const hours = Math.floor(ms / (1000 * 60 * 60));
  if (hours < 1) return "Less than an hour ago";
  if (hours === 1) return "1 hour ago";
  if (hours < 24) return `${hours} hours ago`;
  const days = Math.floor(hours / 24);
  return days === 1 ? "1 day ago" : `${days} days ago`;
}

// For future deadlines (dispute response windows, transfer holds) — timeAgo() only
// reads correctly for past timestamps.
function dueIn(iso: string) {
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return "Overdue";
  const hours = Math.ceil(ms / (1000 * 60 * 60));
  if (hours < 24) return hours === 1 ? "Due in 1 hour" : `Due in ${hours} hours`;
  const days = Math.ceil(hours / 24);
  return days === 1 ? "Due in 1 day" : `Due in ${days} days`;
}

function tabHref(tab: string) {
  return tab === "directory" ? "/super-admin/schools" : `/super-admin/schools?tab=${tab}`;
}

// A due-date's urgency tone — shared by the ownership-transfer hold clock and the
// address-dispute holder-response clock, both real countdown fields on real records.
function dueTone(iso: string | null): "good" | "warn" | "bad" | "neutral" {
  if (!iso) return "neutral";
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return "bad";
  if (ms <= 3 * 24 * 60 * 60 * 1000) return "warn";
  return "good";
}

function DecisionBlock({ children, note }: { children: ReactNode; note: string }) {
  return (
    <div className="grid gap-1.5">
      {children}
      <p className="text-[11px] leading-4 text-[var(--color-text-muted)]">{note}</p>
    </div>
  );
}

// Reviews & Cases — one board, three real case types (M2.9 risk review, M2.11 ownership
// transfer, M2.10.3 address dispute). Every fact/signal/check/history entry below is read
// from a real field or a real, already-fetched record — an empty category renders the
// board's own honest empty copy rather than a fabricated example.

function buildRiskCase(
  school: SuperAdminPendingVerificationSchool,
  contacts: SuperAdminSchoolContact[],
  auditLogs: SuperAdminAuditLogRow[]
): CaseRecord {
  const riskSignals = school.riskSignals ?? [];
  return {
    id: `risk-${school.id}`,
    subject: school.name,
    meta: `${categoryLabel(school.curriculum)} · ${[school.city, school.state].filter(Boolean).join(", ") || "Location not recorded"}`,
    type: "Risk review",
    initials: initials(school.name),
    assignee: "Unassigned",
    age: timeAgo(school.createdAt),
    sla: school.slaDaysRemaining === null || school.slaDaysRemaining === undefined ? "—" : `${school.slaDaysRemaining}d to trial end`,
    slaTone: school.slaDaysRemaining === null || school.slaDaysRemaining === undefined ? "neutral" : school.slaEscalated ? "bad" : school.slaDaysRemaining <= 7 ? "warn" : "good",
    facts: [
      { label: "School", value: `${school.name} (${school.slug})` },
      { label: "Category", value: categoryLabel(school.curriculum) },
      { label: "Owner", value: school.ownerName ?? "Not recorded" },
      { label: "Owner contact", value: `${school.ownerEmail ?? "No email"} · ${school.ownerPhone ?? "No phone"}` },
      { label: "Flag reason", value: school.flaggedForReviewReason ?? "Not recorded" },
      { label: "Risk score", value: school.riskScore === null || school.riskScore === undefined ? "Not scored" : `${school.riskScore}/100` },
      { label: "Students enrolled", value: school.studentCount.toLocaleString() }
    ],
    signals: riskSignals.map((signal) => ({ text: signal.label, tone: signal.triggered ? "bad" : "good" })),
    evidence: contacts.map((contact) => ({
      name: `${contact.name} — ${contact.role}${contact.isPrimary ? " (primary)" : ""}`,
      who: contact.email ?? contact.phone ?? "No contact info on file"
    })),
    checks: [
      { label: "CAC registration number on file", done: Boolean(school.cacNumber) },
      { label: "Ministry of Education approval number on file", done: Boolean(school.ministryApprovalNumber) },
      { label: "Owner email on file", done: Boolean(school.ownerEmail) },
      { label: "Owner phone on file", done: Boolean(school.ownerPhone) }
    ],
    history: auditLogs.map((log) => ({ what: `${log.action} · ${log.target}`, when: timeAgo(log.timestamp) })),
    decisions: (
      <>
        <DecisionBlock note="Removes this school from the review queue. This action does not record a reason — verification simply confirms a human has checked the flagged details.">
          <ResourceActionDialog
            triggerLabel="Clear the flag"
            title={`Clear risk flag — ${school.name}`}
            description="Marks this school as verified. It already has full trial access — this only records that the flagged details have been reviewed."
            endpoint={`/api/super-admin/schools/${school.id}/verify`}
            variant="secondary"
            submitLabel="Clear flag & verify"
            fields={[]}
          />
        </DecisionBlock>
        <DecisionBlock note="Requires a reason — written to the audit log. Suspends the school and every staff login immediately.">
          <ResourceActionDialog
            triggerLabel="Refer for suspension"
            title={`Refer for suspension — ${school.name}`}
            description="This suspends the school immediately and logs the reason. The tenant can be reactivated later from Lifecycle & Status if the issue is resolved."
            endpoint={`/api/super-admin/schools/${school.id}/reject-verification`}
            variant="danger"
            submitLabel="Suspend school"
            confirmLabel="Confirm"
            confirmMessage="This suspends the school and all its staff logins immediately."
            fields={[{ name: "reason", label: "Reason", type: "textarea", required: true }]}
          />
        </DecisionBlock>
        <DecisionBlock note="Super Admin only, for accounts confirmed not to be a genuine school. Requires evidence — schedules immediate deletion with no standard retention clock.">
          <ResourceActionDialog
            triggerLabel="Close account (not a school)"
            title={`Close account — ${school.name}`}
            description="Super Admin only. For accounts confirmed not to be a genuine school. Schedules immediate deletion — no standard retention clock, because there is no legitimate school whose records would be preserved."
            endpoint={`/api/super-admin/schools/${school.id}/close-risk-flagged-account`}
            variant="danger"
            submitLabel="Close and schedule deletion"
            confirmLabel="Confirm closure"
            confirmMessage="This immediately suspends the account and schedules its data for deletion. This cannot be undone."
            fields={[{ name: "evidenceNotes", label: "Evidence this is not a genuine school", type: "textarea", required: true }]}
          />
        </DecisionBlock>
      </>
    )
  };
}

function buildTransferCase(transfer: OwnershipTransferRow): CaseRecord {
  const approvalsRecorded = (transfer.approver1Id ? 1 : 0) + (transfer.approver2Id ? 1 : 0);
  const approvalsRequired = transfer.requiresDualApproval ? 2 : 1;
  const holdActive = Boolean(transfer.holdExpiresAt && new Date(transfer.holdExpiresAt).getTime() > Date.now());

  const signals: CaseRecord["signals"] = [];
  if (transfer.status === "OBJECTION_RAISED") {
    signals.push({ text: `Objection on file: ${transfer.objectionNote ?? "no note recorded"}`, tone: "bad" });
  }
  if (transfer.triggerType === "DISPUTE") {
    signals.push({ text: "Trigger is a dispute between claimants — school frozen read-only", tone: "bad" });
  }
  if (!transfer.incomingOwnerId) {
    signals.push({ text: "Incoming owner not yet identified", tone: "warn" });
  }
  if (transfer.holdExpiresAt) {
    signals.push({
      text: holdActive ? `Mandatory hold in effect — ${dueIn(transfer.holdExpiresAt)}` : "Mandatory hold period has elapsed",
      tone: holdActive ? "warn" : "good"
    });
  }
  if (transfer.status === "NOTICE_SENT" || transfer.status === "APPROVED") {
    signals.push({
      text: `${approvalsRecorded} of ${approvalsRequired} required approvals recorded`,
      tone: approvalsRecorded >= approvalsRequired ? "good" : approvalsRecorded === 0 ? "bad" : "warn"
    });
  }
  if (transfer.status === "EXECUTED") {
    signals.push({ text: "Transfer executed — outgoing owner access revoked", tone: "good" });
  }

  const evidence: CaseRecord["evidence"] = [
    { name: transfer.evidenceNotes || "No evidence notes recorded", who: `Logged ${timeAgo(transfer.createdAt)}` }
  ];
  if (transfer.objectionNote) {
    evidence.push({ name: transfer.objectionNote, who: "Objection note" });
  }

  const history: CaseRecord["history"] = [];
  if (transfer.executedAt) history.push({ what: "Transfer executed — outgoing owner access revoked", when: timeAgo(transfer.executedAt) });
  if (transfer.approver2At) history.push({ what: "Second approval recorded", when: timeAgo(transfer.approver2At) });
  if (transfer.approver1At) history.push({ what: "First approval recorded", when: timeAgo(transfer.approver1At) });
  if (transfer.status === "OBJECTION_RAISED" && transfer.objectionNote) history.push({ what: "Objection raised — school frozen read-only", when: timeAgo(transfer.createdAt) });
  if (transfer.noticeSentAt) history.push({ what: "Notice sent to outgoing owner", when: timeAgo(transfer.noticeSentAt) });
  history.push({ what: `Transfer opened — ${transferTriggerLabel[transfer.triggerType] ?? transfer.triggerType}`, when: timeAgo(transfer.createdAt) });

  const canApprove = transfer.status === "NOTICE_SENT" && !(!transfer.requiresDualApproval && transfer.approver1Id);
  const canExecute = transfer.status === "APPROVED" || (transfer.status === "NOTICE_SENT" && !transfer.requiresDualApproval && Boolean(transfer.approver1Id));
  const canObject = transfer.status === "NOTICE_SENT";

  let decisions: ReactNode;
  if (canObject || canApprove || canExecute) {
    decisions = (
      <>
        {canObject ? (
          <DecisionBlock note="Requires a reason — freezes the school read-only until the objection is resolved.">
            <ResourceActionDialog
              triggerLabel="Raise objection"
              title="Raise an objection"
              description="Freezes the account read-only until the objection is resolved."
              endpoint={`/api/super-admin/ownership-transfers/${transfer.id}/objection`}
              variant="danger"
              submitLabel="Raise objection"
              fields={[{ name: "objectionNote", label: "Objection note", type: "textarea", required: true }]}
            />
          </DecisionBlock>
        ) : null}
        {canApprove ? (
          <DecisionBlock note="Super Admin only. Incapacitated and deceased triggers require two distinct approvers before execution.">
            <ResourceActionDialog
              triggerLabel="Approve"
              title="Approve transfer"
              description="Super Admin only. Incapacitated and deceased triggers require two distinct approvers before execution."
              endpoint={`/api/super-admin/ownership-transfers/${transfer.id}/approve`}
              variant="secondary"
              submitLabel="Approve"
              fields={[]}
            />
          </DecisionBlock>
        ) : null}
        {canExecute ? (
          <DecisionBlock note="Creates the new owner's access and revokes the outgoing owner's login. This cannot be undone.">
            <ResourceActionDialog
              triggerLabel="Execute"
              title="Execute ownership transfer"
              description="Creates the new owner's access, revokes the outgoing owner's login and terminates their sessions. This cannot be undone."
              endpoint={`/api/super-admin/ownership-transfers/${transfer.id}/execute`}
              variant="danger"
              submitLabel="Execute"
              confirmLabel="Confirm execution"
              confirmMessage="This immediately revokes the outgoing owner's access. This cannot be undone."
              fields={[]}
            />
          </DecisionBlock>
        ) : null}
      </>
    );
  } else {
    const reason =
      transfer.status === "EVIDENCE_COLLECTED"
        ? "Still collecting evidence — set the incoming owner and send notice from the Ownership Transfers tab before a decision can be made here."
        : transfer.status === "OBJECTION_RAISED"
          ? "An objection is on file. Resolve it from the Ownership Transfers tab before this case can move forward."
          : "This transfer has already been executed.";
    decisions = (
      <DecisionBlock note={reason}>
        <Link href="/super-admin/schools?tab=ownership-transfers" className="btn-secondary w-fit px-4 text-[13px] font-semibold">
          Open Ownership Transfers
        </Link>
      </DecisionBlock>
    );
  }

  return {
    id: `transfer-${transfer.id}`,
    subject: transfer.schoolName ?? "Unknown school",
    meta: `${transferTriggerLabel[transfer.triggerType] ?? transfer.triggerType} · ${transfer.outgoingOwnerName ?? "Unknown owner"} → ${transfer.incomingOwnerName ?? "Not yet identified"}`,
    type: "Ownership transfer",
    initials: initials(transfer.schoolName ?? "Unknown school"),
    assignee: "Unassigned",
    age: timeAgo(transfer.createdAt),
    sla: transfer.holdExpiresAt ? dueIn(transfer.holdExpiresAt) : "—",
    slaTone: dueTone(transfer.holdExpiresAt),
    facts: [
      { label: "School", value: transfer.schoolName ?? "Unknown" },
      { label: "Trigger", value: transferTriggerLabel[transfer.triggerType] ?? transfer.triggerType },
      { label: "Outgoing owner", value: `${transfer.outgoingOwnerName ?? "Unknown"} (${transfer.outgoingOwnerEmail ?? "no email"})` },
      { label: "Incoming owner", value: transfer.incomingOwnerName ?? "Not yet identified" },
      { label: "Status", value: transferStatusTone[transfer.status]?.label ?? transfer.status },
      { label: "Approvals", value: `${approvalsRecorded} of ${approvalsRequired}` },
      { label: "Notice sent", value: transfer.noticeSentAt ? timeAgo(transfer.noticeSentAt) : "Not sent yet" },
      { label: "Hold expires", value: transfer.holdExpiresAt ? dueIn(transfer.holdExpiresAt) : "No hold in effect" }
    ],
    signals,
    evidence,
    checks: [
      { label: "Incoming owner identified", done: Boolean(transfer.incomingOwnerId) },
      { label: "Notice sent to outgoing owner", done: Boolean(transfer.noticeSentAt) },
      { label: "No unresolved objection", done: transfer.status !== "OBJECTION_RAISED" },
      { label: transfer.requiresDualApproval ? "Dual approval complete (2 of 2)" : "Approved (1 of 1)", done: approvalsRecorded >= approvalsRequired },
      { label: "Executed", done: transfer.status === "EXECUTED" }
    ],
    history,
    decisions
  };
}

function buildDisputeCase(dispute: AddressDisputeRow, schoolOptions: Array<{ label: string; value: string }>): CaseRecord {
  const signals: CaseRecord["signals"] = [];
  if (dispute.status === "EVIDENCE_PENDING") {
    signals.push({ text: "Holder not yet notified", tone: "warn" });
  }
  if (dispute.status === "HOLDER_CONTACTED" && dispute.holderResponseDueAt) {
    const overdue = new Date(dispute.holderResponseDueAt).getTime() <= Date.now();
    signals.push({
      text: overdue ? "Holder response window has passed" : `Holder response due ${dueIn(dispute.holderResponseDueAt)}`,
      tone: overdue ? "bad" : "warn"
    });
  }
  if (dispute.holderResponse) {
    signals.push({ text: `Holder responded: ${dispute.holderResponse}`, tone: "good" });
  }
  if (dispute.outcome) {
    signals.push({ text: `Decided: ${dispute.outcome}`, tone: "good" });
  }

  const evidence: CaseRecord["evidence"] = [
    { name: dispute.evidenceNotes || "No evidence notes recorded", who: dispute.claimantContactName }
  ];
  if (dispute.holderResponse) {
    evidence.push({ name: dispute.holderResponse, who: "Holder response" });
  }

  const history: CaseRecord["history"] = [];
  if (dispute.decidedAt) history.push({ what: `Decided — ${dispute.outcome ?? "outcome recorded"}${dispute.decidedByName ? ` by ${dispute.decidedByName}` : ""}`, when: timeAgo(dispute.decidedAt) });
  if (dispute.holderRespondedAt) history.push({ what: "Holder response recorded", when: timeAgo(dispute.holderRespondedAt) });
  if (dispute.holderNotifiedAt) history.push({ what: "Holder notified", when: timeAgo(dispute.holderNotifiedAt) });
  history.push({ what: `Dispute logged by ${dispute.claimantContactName}`, when: timeAgo(dispute.createdAt) });

  return {
    id: `dispute-${dispute.id}`,
    subject: dispute.claimedAddress,
    meta: `${dispute.claimantSchoolName} · ${dispute.claimantContactName}`,
    type: "Address dispute",
    initials: initials(dispute.claimantSchoolName),
    assignee: "Unassigned",
    age: timeAgo(dispute.createdAt),
    sla: dispute.holderResponseDueAt ? dueIn(dispute.holderResponseDueAt) : "—",
    slaTone: dueTone(dispute.holderResponseDueAt),
    facts: [
      { label: "Claimed address", value: dispute.claimedAddress },
      { label: "Claimant school", value: dispute.claimantSchoolName },
      { label: "Claimant contact", value: `${dispute.claimantContactName} · ${dispute.claimantContactEmail}` },
      { label: "Status", value: disputeStatusTone[dispute.status]?.label ?? dispute.status },
      { label: "Holder response due", value: dispute.holderResponseDueAt ? dueIn(dispute.holderResponseDueAt) : "Not yet notified" },
      { label: "Outcome", value: dispute.outcome ?? "Not decided yet" },
      { label: "Logged", value: timeAgo(dispute.createdAt) }
    ],
    signals,
    evidence,
    checks: [
      { label: "Holder notified", done: Boolean(dispute.holderNotifiedAt) },
      { label: "Holder response recorded", done: Boolean(dispute.holderRespondedAt) },
      { label: "Decision recorded", done: dispute.status === "DECIDED" }
    ],
    history,
    decisions: (
      <>
        {dispute.status === "EVIDENCE_PENDING" ? (
          <DecisionBlock note="Starts a 10 working day response window for the current holder.">
            <ResourceActionDialog
              triggerLabel="Notify holder"
              title="Notify current holder"
              description="10 working days to respond, starting now."
              endpoint={`/api/super-admin/web-address-registry/disputes/${dispute.id}/notify-holder`}
              variant="secondary"
              submitLabel="Notify holder"
              fields={[]}
            />
          </DecisionBlock>
        ) : null}
        {dispute.status === "HOLDER_CONTACTED" && !dispute.holderRespondedAt ? (
          <DecisionBlock note="What did the current holder say? Recorded before a decision is made.">
            <ResourceActionDialog
              triggerLabel="Record holder response"
              title="Record holder response"
              description="What did the current holder say?"
              endpoint={`/api/super-admin/web-address-registry/disputes/${dispute.id}/holder-response`}
              variant="secondary"
              submitLabel="Save response"
              fields={[{ name: "holderResponse", label: "Holder response", type: "textarea", required: true }]}
            />
          </DecisionBlock>
        ) : null}
        <DecisionBlock note="Final — cannot be reopened. Written to the audit log; both parties are notified of the outcome.">
          <ResourceActionDialog
            triggerLabel="Decide"
            title={`Decide dispute — ${dispute.claimedAddress}`}
            description="The default is possession — reassignment only happens where the holder cannot evidence a legitimate claim."
            endpoint={`/api/super-admin/web-address-registry/disputes/${dispute.id}/decide`}
            variant="danger"
            submitLabel="Confirm decision"
            confirmLabel="Confirm"
            confirmMessage="This decision is final and cannot be reopened."
            fields={[
              { name: "outcome", label: "Outcome", type: "select", defaultValue: "NEGOTIATED", options: [
                { label: "Negotiated — holder keeps it, claimant offered alternative", value: "NEGOTIATED" },
                { label: "Reassigned to claimant", value: "REASSIGNED" },
                { label: "Declined — claim not upheld", value: "DECLINED" }
              ] },
              { name: "qualifiedAddressOffered", label: "Qualified alternative offered (if any)" },
              { name: "reassignToSchoolId", label: "Reassign to school (required if reassigning)", type: "select", options: [{ label: "— Select a school —", value: "" }, ...schoolOptions] }
            ]}
          />
        </DecisionBlock>
      </>
    )
  };
}

export default async function SuperAdminSchoolsPage({ searchParams }: { searchParams?: Promise<Record<string, string | undefined>> }) {
  const params = searchParams ? await searchParams : {};
  const activeTab =
    params.tab === "approval-queue" ? "approval-queue" :
    params.tab === "provisioning" ? "provisioning" :
    params.tab === "web-addresses" ? "web-addresses" :
    params.tab === "ownership-transfers" ? "ownership-transfers" :
    params.tab === "dormancy" ? "dormancy" :
    params.tab === "lifecycle" ? "lifecycle" :
    params.tab === "groups" ? "groups" : "directory";

  const query = new URLSearchParams();
  if (params.search) query.set("search", params.search);
  if (params.status) query.set("status", params.status);
  if (params.plan) query.set("plan", params.plan);
  if (params.page) query.set("page", params.page);
  const envelope = await apiGetEnvelope<SuperAdminSchoolRow[]>(`/api/super-admin/schools?${query.toString()}`);
  const schools = envelope.data ?? [];
  const total = envelope.pagination?.total ?? schools.length;

  // Provisioning: every school still on a trial plan is, by definition, mid-setup — not yet
  // converted to a paid, fully-configured tenant. We surface the whole trial cohort (not just a
  // recency window) and separately flag which of those are brand new for visibility.
  const trialEnvelope = await apiGetEnvelope<SuperAdminSchoolRow[]>("/api/super-admin/schools?status=TRIAL&limit=100");
  const provisioningSchools = (trialEnvelope.data ?? [])
    .slice()
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  const provisioningTotal = trialEnvelope.pagination?.total ?? provisioningSchools.length;
  const windowStart = Date.now() - RECENT_SIGNUP_WINDOW_HOURS * 60 * 60 * 1000;
  const newlyOnboardedCount = provisioningSchools.filter((school) => new Date(school.createdAt).getTime() >= windowStart).length;
  const provisioningContactGaps = provisioningSchools.filter((school) => !school.ownerEmail || !school.ownerPhone).length;

  const groupsEnvelope = await apiGetEnvelope<SuperAdminSchoolGroup[]>("/api/super-admin/schools/groups");
  const groups = groupsEnvelope.data ?? [];

  const pendingVerificationEnvelope = await apiGetEnvelope<SuperAdminPendingVerificationSchool[]>("/api/super-admin/schools-pending-verification");
  const pendingVerification = pendingVerificationEnvelope.data ?? [];
  const missingRegistrationCount = pendingVerification.filter((school) => !school.cacNumber && !school.ministryApprovalNumber).length;
  const missingContactCount = pendingVerification.filter((school) => !school.ownerEmail || !school.ownerPhone).length;

  // Reviews & Cases (risk review): each flagged school's own evidence (SchoolContact
  // records) and history (its AuditLog trail) — fetched per case via the same real,
  // existing endpoints the School Profile page uses. Settled independently so one
  // school's fetch failing doesn't blank out the rest of the queue.
  const riskCaseExtras = await Promise.all(
    pendingVerification.map(async (school) => {
      const [contactsResult, auditResult] = await Promise.allSettled([
        apiGetEnvelope<SuperAdminSchoolContact[]>(`/api/super-admin/schools/${school.id}/contacts`),
        apiGetEnvelope<SuperAdminAuditLogRow[]>(`/api/super-admin/audit-logs?schoolId=${school.id}&limit=5`)
      ]);
      return {
        schoolId: school.id,
        contacts: contactsResult.status === "fulfilled" ? contactsResult.value.data ?? [] : [],
        auditLogs: auditResult.status === "fulfilled" ? auditResult.value.data ?? [] : []
      };
    })
  );
  const riskCaseExtrasById = new Map(riskCaseExtras.map((entry) => [entry.schoolId, entry]));

  const plansEnvelope = await apiGetEnvelope<SuperAdminPlanRow[]>("/api/super-admin/plans");
  const activePlans = (plansEnvelope.data ?? []).filter((plan) => plan.isActive).sort((a, b) => a.monthlyPrice - b.monthlyPrice);

  // Web Addresses: the school directory endpoint already returns `subdomain` per row — reuse it
  // rather than adding a new backend call. Pulled with the API's max page size (100).
  const webAddressEnvelope = await apiGetEnvelope<SchoolWithWebFields[]>("/api/super-admin/schools?limit=100");
  const webAddressSchools = webAddressEnvelope.data ?? [];
  const webAddressTotal = webAddressEnvelope.pagination?.total ?? webAddressSchools.length;
  const missingSubdomainCount = webAddressSchools.filter((school) => !school.subdomain).length;

  // Dormancy: a real, isolated backend endpoint (school-directory-extras) computes the most
  // recent *successful* LoginAttempt per school. No fabricated "days inactive" figure — we only
  // ever render a real timestamp (via timeAgo) or an honest "no recorded logins" label. This
  // endpoint lives in its own newly-added module, so we fetch it defensively: if it's ever
  // unreachable (e.g. not yet deployed), the rest of the Schools page still renders.
  let dormancySchools: SchoolDormancyRow[] = [];
  try {
    const dormancyEnvelope = await apiGetEnvelope<SchoolDormancyRow[]>("/api/school-directory-extras/dormancy");
    dormancySchools = dormancyEnvelope.data ?? [];
  } catch {
    dormancySchools = [];
  }
  const neverLoggedInCount = dormancySchools.filter((school) => school.lastSuccessfulLoginAt === null).length;

  // M2.10 — the address registry and its dispute queue. Fetched defensively: these are
  // newly-added modules, so an unreachable endpoint shouldn't take down the rest of the page.
  let registryRecords: WebAddressRecordRow[] = [];
  let addressDisputes: AddressDisputeRow[] = [];
  try {
    const registryEnvelope = await apiGetEnvelope<WebAddressRecordRow[]>("/api/super-admin/web-address-registry/records");
    registryRecords = registryEnvelope.data ?? [];
    const disputesEnvelope = await apiGetEnvelope<AddressDisputeRow[]>("/api/super-admin/web-address-registry/disputes");
    addressDisputes = disputesEnvelope.data ?? [];
  } catch {
    registryRecords = [];
    addressDisputes = [];
  }
  const openDisputeCount = addressDisputes.filter((dispute) => dispute.status !== "DECIDED").length;
  const liveAddressCount = registryRecords.filter((record) => record.state === "LIVE").length;
  const reservedBlockedCount = registryRecords.filter((record) => record.state === "RESERVED" || record.state === "BLOCKED").length;

  // M2.11 — ownership transfers. Same defensive fetch as the registry above.
  let ownershipTransfers: OwnershipTransferRow[] = [];
  try {
    const transfersEnvelope = await apiGetEnvelope<OwnershipTransferRow[]>("/api/super-admin/ownership-transfers");
    ownershipTransfers = transfersEnvelope.data ?? [];
  } catch {
    ownershipTransfers = [];
  }
  const openTransferCount = ownershipTransfers.filter((transfer) => transfer.status !== "EXECUTED").length;
  const executedTransferCount = ownershipTransfers.filter((transfer) => transfer.status === "EXECUTED").length;

  const schoolOptions = webAddressSchools.map((school) => ({ label: school.name, value: school.id }));

  // Reviews & Cases board — three real case types, one queue. Ownership transfers already
  // executed and disputes already decided are resolved, not open cases, so they're excluded
  // here the same way the tab badges above exclude them (openTransferCount / openDisputeCount).
  const openOwnershipTransfers = ownershipTransfers.filter((transfer) => transfer.status !== "EXECUTED");
  const openAddressDisputes = addressDisputes.filter((dispute) => dispute.status !== "DECIDED");
  const reviewCases: CaseRecord[] = [
    ...pendingVerification.map((school) => {
      const extras = riskCaseExtrasById.get(school.id);
      return buildRiskCase(school, extras?.contacts ?? [], extras?.auditLogs ?? []);
    }),
    ...openOwnershipTransfers.map((transfer) => buildTransferCase(transfer)),
    ...openAddressDisputes.map((dispute) => buildDisputeCase(dispute, schoolOptions))
  ];
  const reviewCaseTypes: CaseTypeFilter[] = [
    { label: "All open", value: "all", count: reviewCases.length },
    { label: "Risk review", value: "Risk review", count: pendingVerification.length },
    { label: "Ownership transfer", value: "Ownership transfer", count: openOwnershipTransfers.length },
    { label: "Address dispute", value: "Address dispute", count: openAddressDisputes.length }
  ];

  const tabs = [
    { label: "Directory", href: tabHref("directory"), active: activeTab === "directory", badge: total },
    { label: "Provisioning", href: tabHref("provisioning"), active: activeTab === "provisioning", badge: provisioningTotal },
    { label: "Reviews & Cases", href: tabHref("approval-queue"), active: activeTab === "approval-queue", badge: pendingVerification.length },
    { label: "Web Addresses", href: tabHref("web-addresses"), active: activeTab === "web-addresses", badge: webAddressTotal },
    { label: "Ownership Transfers", href: tabHref("ownership-transfers"), active: activeTab === "ownership-transfers", badge: openTransferCount },
    { label: "Dormancy", href: tabHref("dormancy"), active: activeTab === "dormancy", badge: neverLoggedInCount }
  ];

  return (
    <div className="grid gap-5">
      <ModuleHero
        eyebrow="Tenant management"
        title="Schools"
        description="Create, update, suspend, activate, and soft-delete school tenants across the platform."
        action={<AddSchoolWizard plans={activePlans} />}
      />

      <DetailTabs tabs={tabs} />

      {activeTab === "directory" ? (
        <>
          <FilterToolbar
            action="/super-admin/schools"
            resultCount={total}
            controls={[
              { name: "search", label: "Search", type: "search", placeholder: "Search by school name", defaultValue: params.search },
              { name: "status", label: "Status", type: "select", defaultValue: params.status, options: statusFilterOptions },
              { name: "plan", label: "Tier", type: "select", defaultValue: params.plan, options: planFilterOptions }
            ]}
          />

          <SchoolBulkTable schools={schools} />
        </>
      ) : activeTab === "approval-queue" ? (
        <section className="grid gap-5">
          <section className="grid gap-3 md:grid-cols-3">
            <StatCard label="Pending review" value={pendingVerification.length} detail="Schools flagged during onboarding." icon={Clock3} tone="warning" />
            <StatCard label="Missing registration" value={missingRegistrationCount} detail="No CAC or ministry approval recorded." icon={FileWarning} tone="danger" />
            <StatCard label="Contact gaps" value={missingContactCount} detail="Owner email or phone needs completion." icon={Users} tone="info" />
          </section>

          <CaseReviewBoard
            types={reviewCaseTypes}
            cases={reviewCases}
            emptyState="Queue is clear. Risk-flagged schools, open ownership transfers and open address disputes will appear here as one queue."
            footerNote="One queue, one anatomy. Refer for suspension, raise objection, execute and decide each require a reason and are written to the audit log; clearing a risk flag does not record one."
          />
        </section>
      ) : activeTab === "provisioning" ? (
        <section className="grid gap-5">
          <section className="grid gap-3 md:grid-cols-3">
            <StatCard label="Mid-setup schools" value={provisioningTotal} detail="Live on a trial plan, not yet converted to paid." icon={Building2} tone="info" />
            <StatCard label="Onboarded in last 48h" value={newlyOnboardedCount} detail="Newest arrivals in the provisioning cohort." icon={Clock3} tone="warning" />
            <StatCard label="Contact gaps" value={provisioningContactGaps} detail="Owner email or phone still missing." icon={Users} tone="danger" />
          </section>

          <section className="surface-card p-6">
            <p className="section-eyebrow">Provisioning</p>
            <h2 className="mt-2 font-[var(--font-heading)] text-[20px] font-bold text-[var(--color-text-primary)]">
              Schools still mid-setup
            </h2>
            <p className="mt-2 max-w-2xl text-[13px] leading-6 text-[var(--color-text-secondary)]">
              Onboarding is automatic — every school below is already live on a trial plan. None of this is waiting on
              approval; it's a visibility view of tenants that haven't yet converted to a paid, fully-configured
              account, sorted with the most recently onboarded first.
            </p>

            <div className="mt-6 grid gap-3">
              {provisioningSchools.length === 0 ? (
                <div className="empty-state">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--color-accent-primary-dim)] text-[var(--color-text-accent)]">
                    <Building2 className="h-5 w-5" />
                  </div>
                  <p className="mt-4 text-[15px] font-semibold text-[var(--color-text-primary)]">No schools mid-setup</p>
                  <p className="mt-1 max-w-md text-[13px] text-[var(--color-text-secondary)]">
                    Every school on the platform has already converted off the trial plan.
                  </p>
                </div>
              ) : (
                provisioningSchools.map((school) => (
                <article key={school.id} className="rounded-[10px] border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[12px] bg-[var(--color-bg-subtle)] font-[var(--font-mono)] text-[14px] font-bold text-[var(--color-text-primary)]">
                        {initials(school.name)}
                      </span>
                      <div>
                        <Link href={`/super-admin/schools/${school.id}`} className="text-[14px] font-bold text-[var(--color-text-primary)] hover:text-[var(--color-text-accent)]">
                          {school.name}
                        </Link>
                        <p className="mt-0.5 text-[12px] text-[var(--color-text-muted)]">{categoryLabel(school.category)} · {planLabel(school.plan)} tier</p>
                      </div>
                    </div>
                    <span
                      className="inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold"
                      style={{ background: "var(--color-accent-primary-dim)", color: "var(--color-text-accent)" }}
                    >
                      Onboarded {timeAgo(school.createdAt)}
                    </span>
                  </div>

                  <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                    <div className="flex items-center gap-2 rounded-[8px] bg-[var(--color-bg-subtle)] px-3 py-2 text-[12px] text-[var(--color-text-secondary)]">
                      <MapPin className="h-3.5 w-3.5 shrink-0 text-[var(--color-text-muted)]" />
                      <span className="truncate">{[school.address, school.city, school.state].filter(Boolean).join(", ") || "No address on file"}</span>
                    </div>
                    <div className="flex items-center gap-2 rounded-[8px] bg-[var(--color-bg-subtle)] px-3 py-2 text-[12px] text-[var(--color-text-secondary)]">
                      <Users className="h-3.5 w-3.5 shrink-0 text-[var(--color-text-muted)]" />
                      <span className="truncate">{school.ownerName ?? "Owner not recorded"}</span>
                    </div>
                    <div className="flex items-center gap-2 rounded-[8px] bg-[var(--color-bg-subtle)] px-3 py-2 text-[12px] text-[var(--color-text-secondary)]">
                      <Phone className="h-3.5 w-3.5 shrink-0 text-[var(--color-text-muted)]" />
                      <span className="truncate">{school.ownerPhone ?? "No phone on file"}</span>
                    </div>
                    <div className="flex items-center gap-2 rounded-[8px] bg-[var(--color-bg-subtle)] px-3 py-2 text-[12px] text-[var(--color-text-secondary)]">
                      <Mail className="h-3.5 w-3.5 shrink-0 text-[var(--color-text-muted)]" />
                      <span className="truncate">{school.ownerEmail ?? "No email on file"}</span>
                    </div>
                  </div>

                  <div className="mt-3 flex items-center justify-between">
                    <p className="text-[12px] text-[var(--color-text-muted)]">
                      {school.totalStudents.toLocaleString()} student(s) declared at signup
                    </p>
                    <Link href={`/super-admin/schools/${school.id}`} className="btn-link text-[12.5px]">
                      View school
                    </Link>
                  </div>
                </article>
              ))
              )}
            </div>
          </section>
        </section>
      ) : activeTab === "web-addresses" ? (
        <section className="grid gap-5">
          <section className="grid gap-3 md:grid-cols-4">
            <StatCard label="Schools with a web address" value={webAddressTotal} detail="Every non-deleted tenant on the platform." icon={Globe2} tone="info" />
            <StatCard
              label="Missing subdomain"
              value={missingSubdomainCount}
              detail={missingSubdomainCount === 0 ? "Every school has a subdomain on record." : "No subdomain recorded — assigned automatically during onboarding."}
              icon={FileWarning}
              tone={missingSubdomainCount === 0 ? "success" : "warning"}
            />
            <StatCard label="Live in registry" value={liveAddressCount} detail="Addresses backed by a registry record." icon={ShieldCheck} tone="success" />
            <StatCard label="Reserved / blocked" value={reservedBlockedCount} detail="Held out of the available pool." icon={Gavel} tone="warning" />
          </section>

          <TableCard
            title="Web Addresses"
            description={
              webAddressTotal > webAddressSchools.length
                ? `Showing ${webAddressSchools.length} of ${webAddressTotal} schools.`
                : `${webAddressSchools.length} school(s) found.`
            }
            items={webAddressSchools}
            emptyState="No schools found."
            columns={[
              {
                key: "school",
                header: "School",
                render: (school) => (
                  <div className="flex items-center gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] bg-[var(--color-bg-subtle)] font-[var(--font-mono)] text-[13px] font-black text-[var(--color-text-primary)]">
                      {initials(school.name)}
                    </span>
                    <Link href={`/super-admin/schools/${school.id}`} className="font-bold text-[var(--color-text-primary)] hover:text-[var(--color-text-accent)]">
                      {school.name}
                    </Link>
                  </div>
                )
              },
              {
                key: "subdomain",
                header: "Subdomain",
                render: (school) =>
                  school.subdomain ? (
                    <span className="rounded-[6px] bg-[var(--color-bg-subtle)] px-2 py-1 font-[var(--font-mono)] text-[12px] text-[var(--color-text-primary)]">
                      {school.subdomain}
                    </span>
                  ) : (
                    <span className="text-[12px] font-semibold text-[var(--color-warning)]">Not assigned</span>
                  )
              },
              { key: "schoolCode", header: "School code", render: (school) => school.schoolCode ?? "—" },
              {
                key: "status",
                header: "Status",
                render: (school) => {
                  const tone = statusTone[school.status] ?? statusTone.ARCHIVED;
                  return (
                    <span className="inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold" style={{ background: tone.bg, color: tone.fg }}>
                      {tone.label}
                    </span>
                  );
                }
              },
              {
                key: "actions",
                header: "Actions",
                render: (school) => (
                  <ResourceActionDialog
                    triggerLabel="Change address"
                    title={`Change web address — ${school.name}`}
                    description="Super Admin only. Creates a 90-day redirect from the old address and notifies every user of the school. The bar is deliberately high — every invitation already sent carries the old address."
                    endpoint="/api/super-admin/web-address-registry/records/change"
                    variant="menu"
                    submitLabel="Change address"
                    confirmLabel="Confirm change"
                    confirmMessage="This immediately updates the school's live web address and starts a 90-day redirect."
                    fields={[
                      { name: "schoolId", label: "School", type: "select", defaultValue: school.id, options: [{ label: school.name, value: school.id }] },
                      { name: "newAddress", label: "New address", placeholder: "lowercase-letters-numbers", required: true },
                      { name: "reason", label: "Reason", type: "textarea", required: true }
                    ]}
                  />
                )
              }
            ]}
          />

          <section className="surface-card p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="section-eyebrow">M2.10.3</p>
                <h2 className="mt-2 font-[var(--font-heading)] text-[20px] font-bold text-[var(--color-text-primary)]">Address disputes</h2>
                <p className="mt-2 max-w-2xl text-[13px] leading-6 text-[var(--color-text-secondary)]">
                  The default is possession — a claim is only reassigned where the current holder cannot evidence a
                  legitimate claim. {openDisputeCount} open of {addressDisputes.length} logged.
                </p>
              </div>
              <ResourceActionDialog
                triggerLabel="Log a claim"
                title="Log an address dispute"
                description="Records a claim submitted by a genuine school through the published dispute form."
                endpoint="/api/super-admin/web-address-registry/disputes"
                submitLabel="Log claim"
                fields={[
                  { name: "claimedAddress", label: "Claimed address", required: true },
                  { name: "claimantSchoolName", label: "Claimant school name", required: true },
                  { name: "claimantContactName", label: "Claimant contact name", required: true },
                  { name: "claimantContactEmail", label: "Claimant contact email", type: "email", required: true },
                  { name: "claimantContactPhone", label: "Claimant contact phone" },
                  { name: "evidenceNotes", label: "Evidence notes", type: "textarea", required: true }
                ]}
              />
            </div>

            <div className="mt-5">
              <TableCard
                title="Disputes"
                items={addressDisputes}
                emptyState="No disputes logged."
                columns={[
                  {
                    key: "claim",
                    header: "Claim",
                    render: (dispute) => (
                      <div>
                        <span className="rounded-[6px] bg-[var(--color-bg-subtle)] px-2 py-1 font-[var(--font-mono)] text-[12px] text-[var(--color-text-primary)]">{dispute.claimedAddress}</span>
                        <p className="mt-1 text-[12px] text-[var(--color-text-secondary)]">{dispute.claimantSchoolName} · {dispute.claimantContactName}</p>
                      </div>
                    )
                  },
                  {
                    key: "status",
                    header: "Status",
                    render: (dispute) => {
                      const tone = disputeStatusTone[dispute.status] ?? disputeStatusTone.EVIDENCE_PENDING;
                      return (
                        <span className="inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold" style={{ background: tone.bg, color: tone.fg }}>
                          {dispute.outcome ? `${tone.label} · ${dispute.outcome}` : tone.label}
                        </span>
                      );
                    }
                  },
                  {
                    key: "due",
                    header: "Holder response due",
                    render: (dispute) => (dispute.holderResponseDueAt ? dueIn(dispute.holderResponseDueAt) : "—")
                  },
                  {
                    key: "actions",
                    header: "Actions",
                    render: (dispute) => (
                      <ActionMenu triggerLabel={`Actions for ${dispute.claimedAddress}`}>
                        {dispute.status === "EVIDENCE_PENDING" ? (
                          <ResourceActionDialog
                            triggerLabel="Notify holder"
                            title="Notify current holder"
                            description="10 working days to respond, starting now."
                            endpoint={`/api/super-admin/web-address-registry/disputes/${dispute.id}/notify-holder`}
                            variant="menu"
                            submitLabel="Notify holder"
                            fields={[]}
                          />
                        ) : null}
                        {dispute.status === "HOLDER_CONTACTED" ? (
                          <ResourceActionDialog
                            triggerLabel="Record holder response"
                            title="Record holder response"
                            description="What did the current holder say?"
                            endpoint={`/api/super-admin/web-address-registry/disputes/${dispute.id}/holder-response`}
                            variant="menu"
                            submitLabel="Save response"
                            fields={[{ name: "holderResponse", label: "Holder response", type: "textarea", required: true }]}
                          />
                        ) : null}
                        {dispute.status !== "DECIDED" ? (
                          <ResourceActionDialog
                            triggerLabel="Decide"
                            title={`Decide dispute — ${dispute.claimedAddress}`}
                            description="Written to the audit log. Both parties are notified of the outcome."
                            endpoint={`/api/super-admin/web-address-registry/disputes/${dispute.id}/decide`}
                            variant="menuDanger"
                            submitLabel="Confirm decision"
                            confirmLabel="Confirm"
                            confirmMessage="This decision is final and cannot be reopened."
                            fields={[
                              { name: "outcome", label: "Outcome", type: "select", defaultValue: "NEGOTIATED", options: [
                                { label: "Negotiated — holder keeps it, claimant offered alternative", value: "NEGOTIATED" },
                                { label: "Reassigned to claimant", value: "REASSIGNED" },
                                { label: "Declined — claim not upheld", value: "DECLINED" }
                              ] },
                              { name: "qualifiedAddressOffered", label: "Qualified alternative offered (if any)" },
                              { name: "reassignToSchoolId", label: "Reassign to school (required if reassigning)", type: "select", options: [{ label: "— Select a school —", value: "" }, ...schoolOptions] }
                            ]}
                          />
                        ) : null}
                      </ActionMenu>
                    )
                  }
                ]}
              />
            </div>
          </section>
        </section>
      ) : activeTab === "ownership-transfers" ? (
        <section className="grid gap-5">
          <section className="grid gap-3 md:grid-cols-3">
            <StatCard label="Open transfers" value={openTransferCount} detail="Not yet executed." icon={Gavel} tone={openTransferCount === 0 ? "success" : "warning"} />
            <StatCard label="Executed" value={executedTransferCount} detail="Ownership successfully moved." icon={ShieldCheck} tone="success" />
            <StatCard label="Total logged" value={ownershipTransfers.length} detail="Every transfer ever opened." icon={Building2} tone="info" />
          </section>

          <section className="surface-card p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="section-eyebrow">M2.11</p>
                <h2 className="mt-2 font-[var(--font-heading)] text-[20px] font-bold text-[var(--color-text-primary)]">School ownership transfer</h2>
                <p className="mt-2 max-w-2xl text-[13px] leading-6 text-[var(--color-text-secondary)]">
                  Never a field edit — evidence, notice, and dual approval for incapacitation or death. The incoming
                  owner always gets a new account; the old login is revoked, never handed over.
                </p>
              </div>
              <ResourceActionDialog
                triggerLabel="Start a transfer"
                title="Open an ownership transfer"
                description="Records the trigger and evidence. Identity of the incoming owner and notice to the outgoing owner follow as separate steps."
                endpoint="/api/super-admin/ownership-transfers"
                submitLabel="Open transfer"
                fields={[
                  { name: "schoolId", label: "School", type: "select", options: [{ label: "— Select a school —", value: "" }, ...schoolOptions], required: true },
                  { name: "triggerType", label: "Trigger", type: "select", defaultValue: "VOLUNTARY_SALE", options: [
                    { label: "Voluntary sale or handover", value: "VOLUNTARY_SALE" },
                    { label: "Owner incapacitated", value: "OWNER_INCAPACITATED" },
                    { label: "Owner deceased", value: "OWNER_DECEASED" },
                    { label: "Dispute between claimants", value: "DISPUTE" }
                  ] },
                  { name: "evidenceNotes", label: "Evidence notes", type: "textarea", required: true },
                  { name: "incomingOwnerId", label: "Incoming owner user ID (if already identified)" }
                ]}
              />
            </div>

            <div className="mt-5">
              <TableCard
                title="Transfers"
                items={ownershipTransfers}
                emptyState="No ownership transfers on record."
                columns={[
                  {
                    key: "school",
                    header: "School",
                    render: (transfer) => (
                      <div>
                        <Link href={`/super-admin/schools/${transfer.schoolId}`} className="font-bold text-[var(--color-text-primary)] hover:text-[var(--color-text-accent)]">
                          {transfer.schoolName ?? "Unknown school"}
                        </Link>
                        <p className="mt-0.5 text-[12px] text-[var(--color-text-muted)]">{transferTriggerLabel[transfer.triggerType] ?? transfer.triggerType}</p>
                      </div>
                    )
                  },
                  {
                    key: "owners",
                    header: "Outgoing → Incoming",
                    render: (transfer) => (
                      <div className="text-[12px] text-[var(--color-text-secondary)]">
                        <p>{transfer.outgoingOwnerName ?? "Unknown"}</p>
                        <p className="mt-0.5 font-semibold text-[var(--color-text-primary)]">{transfer.incomingOwnerName ?? "Not yet identified"}</p>
                      </div>
                    )
                  },
                  {
                    key: "status",
                    header: "Status",
                    render: (transfer) => {
                      const tone = transferStatusTone[transfer.status] ?? transferStatusTone.EVIDENCE_COLLECTED;
                      return (
                        <span className="inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold" style={{ background: tone.bg, color: tone.fg }}>
                          {tone.label}
                        </span>
                      );
                    }
                  },
                  {
                    key: "approvals",
                    header: "Approvals",
                    render: (transfer) =>
                      transfer.requiresDualApproval ? (
                        <span className="text-[12px] text-[var(--color-text-secondary)]">
                          {(transfer.approver1Id ? 1 : 0) + (transfer.approver2Id ? 1 : 0)} of 2
                        </span>
                      ) : (
                        <span className="text-[12px] text-[var(--color-text-secondary)]">{transfer.approver1Id ? "1 of 1" : "0 of 1"}</span>
                      )
                  },
                  {
                    key: "hold",
                    header: "Hold expires",
                    render: (transfer) => (transfer.holdExpiresAt ? dueIn(transfer.holdExpiresAt) : "—")
                  },
                  {
                    key: "actions",
                    header: "Actions",
                    render: (transfer) => (
                      <ActionMenu triggerLabel={`Actions for ${transfer.schoolName ?? "transfer"}`}>
                        {transfer.status === "EVIDENCE_COLLECTED" && !transfer.incomingOwnerId ? (
                          <ResourceActionDialog
                            triggerLabel="Set incoming owner"
                            title="Record the incoming owner"
                            description="The incoming owner must already be verified through the standard user-verification process."
                            endpoint={`/api/super-admin/ownership-transfers/${transfer.id}/incoming-owner`}
                            variant="menu"
                            submitLabel="Save"
                            fields={[{ name: "incomingOwnerId", label: "Incoming owner user ID", required: true }]}
                          />
                        ) : null}
                        {transfer.status === "EVIDENCE_COLLECTED" && transfer.incomingOwnerId ? (
                          <ResourceActionDialog
                            triggerLabel="Send notice"
                            title="Send notice to outgoing owner"
                            description="Immediate for a voluntary transfer; starts a mandatory 14-day hold if the owner is deceased."
                            endpoint={`/api/super-admin/ownership-transfers/${transfer.id}/send-notice`}
                            variant="menu"
                            submitLabel="Send notice"
                            fields={[]}
                          />
                        ) : null}
                        {transfer.status === "NOTICE_SENT" ? (
                          <ResourceActionDialog
                            triggerLabel="Raise objection"
                            title="Raise an objection"
                            description="Freezes the account read-only until the objection is resolved."
                            endpoint={`/api/super-admin/ownership-transfers/${transfer.id}/objection`}
                            variant="menuDanger"
                            submitLabel="Raise objection"
                            fields={[{ name: "objectionNote", label: "Objection note", type: "textarea", required: true }]}
                          />
                        ) : null}
                        {transfer.status === "NOTICE_SENT" && !(!transfer.requiresDualApproval && transfer.approver1Id) ? (
                          <ResourceActionDialog
                            triggerLabel="Approve"
                            title="Approve transfer"
                            description="Super Admin only. Incapacitated and deceased triggers require two distinct approvers before execution."
                            endpoint={`/api/super-admin/ownership-transfers/${transfer.id}/approve`}
                            variant="menu"
                            submitLabel="Approve"
                            fields={[]}
                          />
                        ) : null}
                        {(transfer.status === "APPROVED" || (transfer.status === "NOTICE_SENT" && !transfer.requiresDualApproval && transfer.approver1Id)) ? (
                          <ResourceActionDialog
                            triggerLabel="Execute"
                            title="Execute ownership transfer"
                            description="Creates the new owner's access, revokes the outgoing owner's login and terminates their sessions. This cannot be undone."
                            endpoint={`/api/super-admin/ownership-transfers/${transfer.id}/execute`}
                            variant="menuDanger"
                            submitLabel="Execute"
                            confirmLabel="Confirm execution"
                            confirmMessage="This immediately revokes the outgoing owner's access. This cannot be undone."
                            fields={[]}
                          />
                        ) : null}
                      </ActionMenu>
                    )
                  }
                ]}
              />
            </div>
          </section>
        </section>
      ) : activeTab === "dormancy" ? (
        <section className="grid gap-5">
          <section className="grid gap-3 md:grid-cols-2">
            <StatCard label="Never logged in" value={neverLoggedInCount} detail="No successful login recorded for any user at the school." icon={Moon} tone={neverLoggedInCount === 0 ? "success" : "danger"} />
            <StatCard label="Tracked schools" value={dormancySchools.length} detail="Non-deleted schools checked for login activity." icon={Building2} tone="info" />
          </section>

          <TableCard
            title="Dormancy"
            description="Most recent successful login by any staff or owner account at the school, oldest first."
            items={dormancySchools}
            emptyState="No schools to show."
            columns={[
              {
                key: "school",
                header: "School",
                render: (school) => (
                  <div className="flex items-center gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] bg-[var(--color-bg-subtle)] font-[var(--font-mono)] text-[13px] font-black text-[var(--color-text-primary)]">
                      {initials(school.name)}
                    </span>
                    <Link href={`/super-admin/schools/${school.id}`} className="font-bold text-[var(--color-text-primary)] hover:text-[var(--color-text-accent)]">
                      {school.name}
                    </Link>
                  </div>
                )
              },
              {
                key: "status",
                header: "Status",
                render: (school) => {
                  const tone = statusTone[school.status] ?? statusTone.ARCHIVED;
                  return (
                    <span className="inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold" style={{ background: tone.bg, color: tone.fg }}>
                      {tone.label}
                    </span>
                  );
                }
              },
              {
                key: "lastLogin",
                header: "Last successful login",
                render: (school) =>
                  school.lastSuccessfulLoginAt ? (
                    <span className="text-[12.5px] text-[var(--color-text-primary)]">{timeAgo(school.lastSuccessfulLoginAt)}</span>
                  ) : (
                    <span className="text-[12.5px] font-semibold text-[var(--color-danger)]">No recorded logins</span>
                  )
              },
              { key: "createdAt", header: "School created", render: (school) => timeAgo(school.createdAt) }
            ]}
          />
        </section>
      ) : activeTab === "lifecycle" ? (
        <>
          <section className="surface-card p-6">
            <p className="section-eyebrow">Lifecycle flow</p>
            <h2 className="mt-2 font-[var(--font-heading)] text-[20px] font-bold text-[var(--color-text-primary)]">
              How a school moves through the platform
            </h2>
            <p className="mt-2 max-w-2xl text-[13px] leading-6 text-[var(--color-text-secondary)]">
              Onboarding is fully automatic — trial access is never gated on approval. Verification in the Approval
              Queue is a compliance check that happens afterward; every other transition below is either
              system-driven or a logged Super Admin action.
            </p>

            <div className="mt-6 flex flex-wrap items-center gap-2">
              {lifecycleFlow.map((stage, index) => (
                <div key={stage.label} className="flex items-center gap-2">
                  <div
                    className="min-w-[9rem] rounded-[11px] border px-4 py-3"
                    style={
                      stage.emphasize
                        ? { background: "var(--color-text-primary)", borderColor: "var(--color-text-primary)", color: "var(--color-bg-surface)" }
                        : { background: "var(--color-bg-surface)", borderColor: "var(--color-border-default)", color: "var(--color-text-primary)" }
                    }
                  >
                    <p className="text-[13px] font-bold">{stage.label}</p>
                    <p className={`mt-1 text-[11px] ${stage.emphasize ? "opacity-75" : "text-[var(--color-text-muted)]"}`}>{stage.trigger}</p>
                  </div>
                  {index < lifecycleFlow.length - 1 ? (
                    <ArrowRight className="h-4 w-4 shrink-0 text-[var(--color-text-muted)]" />
                  ) : null}
                </div>
              ))}
            </div>
          </section>

          <section className="surface-card p-6">
            <p className="section-eyebrow">Status reference</p>
            <h2 className="mt-2 font-[var(--font-heading)] text-[20px] font-bold text-[var(--color-text-primary)]">
              What each status means
            </h2>
            <div className="mt-5 overflow-hidden rounded-[10px] border border-[var(--color-border-default)]">
              {statusReference.map((row, index) => {
                const tone = statusTone[row.status] ?? statusTone.ARCHIVED;
                return (
                  <div
                    key={row.status}
                    className={`grid gap-3 px-4 py-3.5 sm:grid-cols-[9rem_1.6fr_1.4fr_1fr] sm:items-center ${index % 2 === 1 ? "bg-[var(--color-bg-subtle)]" : "bg-[var(--color-bg-surface)]"}`}
                  >
                    <span
                      className="inline-flex w-fit items-center rounded-full px-2.5 py-1 text-[11px] font-bold"
                      style={{ background: tone.bg, color: tone.fg }}
                    >
                      {row.label}
                    </span>
                    <p className="text-[12.5px] text-[var(--color-text-primary)]">{row.meaning}</p>
                    <p className="text-[12px] text-[var(--color-text-secondary)]">{row.trigger}</p>
                    <p className="text-[12px] font-semibold text-[var(--color-text-muted)]">{row.who}</p>
                  </div>
                );
              })}
            </div>
          </section>
        </>
      ) : (
        <>
          <section className="surface-card p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="section-eyebrow">Multi-branch</p>
                <h2 className="mt-2 font-[var(--font-heading)] text-[20px] font-bold text-[var(--color-text-primary)]">
                  School groups
                </h2>
                <p className="mt-2 max-w-2xl text-[13px] leading-6 text-[var(--color-text-secondary)]">
                  Multiple campuses under one billing account. A branch keeps its own configuration, staff, and
                  student records — only billing and account management roll up to the group. Schools are linked to a
                  group from their profile page.
                </p>
              </div>
              <ResourceActionDialog
                triggerLabel="Create group"
                title="Create school group"
                description="Set up a group before linking branch schools to it from each school's profile."
                endpoint="/api/super-admin/schools/groups"
                submitLabel="Create group"
                fields={[
                  { name: "name", label: "Group name", required: true },
                  { name: "ownerName", label: "Owner / trustee name" },
                  { name: "ownerEmail", label: "Owner email", type: "email" },
                  { name: "billingMode", label: "Billing mode", type: "select", defaultValue: "GROUP", options: [
                    { label: "Consolidated at group", value: "GROUP" },
                    { label: "Per branch", value: "BRANCH" }
                  ] }
                ]}
              />
            </div>
          </section>

          {groups.length === 0 ? (
            <section className="surface-card p-6">
              <div className="empty-state">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--color-accent-primary-dim)] text-[var(--color-text-accent)]">
                  <Layers className="h-5 w-5" />
                </div>
                <p className="mt-4 text-[15px] font-semibold text-[var(--color-text-primary)]">No school groups yet</p>
                <p className="mt-1 max-w-md text-[13px] text-[var(--color-text-secondary)]">
                  Create a group above, then link branch schools to it from each school&apos;s profile page.
                </p>
              </div>
            </section>
          ) : (
            <TableCard
              title="All groups"
              description={`${groups.length} group(s) found.`}
              items={groups}
              columns={[
                {
                  key: "name",
                  header: "Group",
                  render: (group) => (
                    <div>
                      <p className="font-semibold text-[var(--color-text-primary)]">{group.name}</p>
                      <p className="text-[11px] text-[var(--color-text-muted)]">{group.ownerName ?? "No owner on file"}</p>
                    </div>
                  )
                },
                {
                  key: "branches",
                  header: "Branches",
                  render: (group) =>
                    group.branchCount === 0 ? (
                      <span className="text-[var(--color-text-muted)]">No branches linked</span>
                    ) : (
                      <span className="truncate">{group.branches.map((branch) => branch.name).join(", ")}</span>
                    )
                },
                { key: "count", header: "#", render: (group) => group.branchCount },
                { key: "students", header: "Students", render: (group) => group.totalStudents.toLocaleString() },
                {
                  key: "billing",
                  header: "Billing",
                  render: (group) => (
                    <span
                      className="inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold"
                      style={
                        group.billingMode === "GROUP"
                          ? { background: "var(--color-success-dim)", color: "var(--color-success)" }
                          : { background: "var(--color-info-dim)", color: "var(--color-info)" }
                      }
                    >
                      {group.billingMode === "GROUP" ? "Consolidated at group" : "Per branch"}
                    </span>
                  )
                },
                {
                  key: "actions",
                  header: "Actions",
                  render: (group) => (
                    <ActionMenu triggerLabel={`Actions for ${group.name}`}>
                      <ResourceActionDialog
                        triggerLabel="Edit"
                        title={`Edit ${group.name}`}
                        description="Update the group's owner details or billing mode."
                        endpoint={`/api/super-admin/schools/groups/${group.id}`}
                        method="PATCH"
                        variant="menu"
                        submitLabel="Save changes"
                        fields={[
                          { name: "name", label: "Group name", defaultValue: group.name },
                          { name: "ownerName", label: "Owner / trustee name", defaultValue: group.ownerName ?? "" },
                          { name: "ownerEmail", label: "Owner email", type: "email", defaultValue: group.ownerEmail ?? "" },
                          { name: "billingMode", label: "Billing mode", type: "select", defaultValue: group.billingMode, options: [
                            { label: "Consolidated at group", value: "GROUP" },
                            { label: "Per branch", value: "BRANCH" }
                          ] }
                        ]}
                      />
                      <ResourceActionDialog
                        triggerLabel="Delete"
                        title={`Delete ${group.name}`}
                        description={
                          group.branchCount > 0
                            ? "Unlink every branch from this group before deleting it."
                            : "This permanently removes the group. It has no branches linked, so this is safe."
                        }
                        endpoint={`/api/super-admin/schools/groups/${group.id}`}
                        method="DELETE"
                        variant="menuDanger"
                        submitLabel="Delete group"
                        confirmLabel="Confirm delete"
                        confirmMessage="This permanently removes the school group."
                        fields={[]}
                      />
                    </ActionMenu>
                  )
                }
              ]}
              emptyState="No school groups match the current filters."
            />
          )}
        </>
      )}
    </div>
  );
}
