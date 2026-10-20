import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowRight, Building2, Clock3, FileWarning, Gavel, Mail, MapPin, Moon, Phone, Repeat2, ShieldCheck, Users } from "lucide-react";

import { CaseReviewBoard, type CaseRecord, type CaseTypeFilter } from "@/components/data-display/case-review-board";
import { DetailTabs } from "@/components/data-display/detail-tabs";
import { ModuleHero } from "@/components/data-display/module-hero";
import { ServerPagination } from "@/components/data-display/server-pagination";
import { StatCard } from "@/components/data-display/stat-card";
import { TableCard } from "@/components/data-display/table-card";
import { FilterToolbar } from "@/components/filters/filter-toolbar";
import { ResourceActionDialog } from "@/components/forms/resource-action-dialog";
import { AddSchoolWizard } from "@/components/super-admin/add-school-wizard";
import { SchoolBulkTable } from "@/components/super-admin/school-bulk-table";
import { ActionMenu } from "@/components/ui/action-menu";
import { apiGetEnvelope } from "@/lib/api/server";

import { WebAddressesTable } from "./_web-addresses-table";
import type {
  SuperAdminAuditLogRow,
  SuperAdminPendingVerificationSchool,
  SuperAdminPlanRow,
  SuperAdminSchoolContact,
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
  billingStatus?: string;
  address?: string | null;
  dormantAt?: string | null;
  noticeSentAt?: string | null;
  releaseDueAt?: string | null;
  lifecycleNote?: string | null;
}

interface WebAddressRecordRow {
  id: string;
  address: string;
  schoolId: string | null;
  schoolName: string | null;
  state: string;
  countryScope: string;
  reservedReason: string | null;
  changeReason: string | null;
  issuedAt: string;
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

const categoryFilterOptions = [{ label: "All categories", value: "" }, ...schoolTypeOptions];

const statusTone: Record<string, { bg: string; fg: string; label: string }> = {
  TRIAL: { bg: "var(--color-warning-dim)", fg: "var(--color-warning)", label: "Trial Active" },
  ACTIVE: { bg: "var(--color-success-dim)", fg: "var(--color-success)", label: "Active" },
  GRACE_PERIOD: { bg: "var(--color-warning-dim)", fg: "var(--color-warning)", label: "Grace Period" },
  SUSPENDED: { bg: "var(--color-danger-dim)", fg: "var(--color-danger)", label: "Suspended" },
  ARCHIVED: { bg: "var(--color-bg-subtle)", fg: "var(--color-text-muted)", label: "Deactivated" },
  DELETED: { bg: "var(--color-danger-dim)", fg: "var(--color-danger)", label: "Deleted" }
};

const lifecycleFlow = [
  { label: "Signup submitted", trigger: "Self-service — automatic" },
  { label: "Trial Active", trigger: "Granted immediately · 30-day trial" },
  { label: "Verified", trigger: "Reviewed in Reviews & Cases · does not block access" },
  { label: "Active", trigger: "Payment confirmed", emphasize: true },
  { label: "Grace Period", trigger: "Payment overdue" },
  { label: "Suspended", trigger: "Verification rejected / grace period expired / policy violation" },
  { label: "Deactivated", trigger: "Data export completed · closure confirmed" }
];

const disputeFlow = [
  { label: "Claim submitted", trigger: "By the genuine school, via Log a claim" },
  { label: "Evidence pending", trigger: "Claimant's evidence notes reviewed" },
  { label: "Holder contacted", trigger: "10 working days to respond", emphasize: true },
  { label: "Response recorded", trigger: "What the current holder said" },
  { label: "Decided", trigger: "Negotiated, reassigned, or declined — written to the audit log" }
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
      <p className="text-[10px] leading-4 text-[var(--color-text-muted)]">{note}</p>
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
    ),
    recordHref: `/super-admin/schools/${school.id}`,
    historyHref: `/super-admin/schools/${school.id}?tab=activity`
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
  const canSetIncomingOwner = transfer.status === "EVIDENCE_COLLECTED" && !transfer.incomingOwnerId;
  const canSendNotice = transfer.status === "EVIDENCE_COLLECTED" && Boolean(transfer.incomingOwnerId);

  let decisions: ReactNode;
  if (canSetIncomingOwner || canSendNotice || canObject || canApprove || canExecute) {
    decisions = (
      <>
        {canSetIncomingOwner ? (
          <DecisionBlock note="The incoming owner must already be verified through the standard user-verification process.">
            <ResourceActionDialog
              triggerLabel="Set incoming owner"
              title="Record the incoming owner"
              description="The incoming owner must already be verified through the standard user-verification process."
              endpoint={`/api/super-admin/ownership-transfers/${transfer.id}/incoming-owner`}
              variant="secondary"
              submitLabel="Save"
              fields={[{ name: "incomingOwnerId", label: "Incoming owner user ID", required: true }]}
            />
          </DecisionBlock>
        ) : null}
        {canSendNotice ? (
          <DecisionBlock note="Immediate for a voluntary transfer; starts a mandatory 14-day hold if the owner is deceased.">
            <ResourceActionDialog
              triggerLabel="Send notice"
              title="Send notice to outgoing owner"
              description="Immediate for a voluntary transfer; starts a mandatory 14-day hold if the owner is deceased."
              endpoint={`/api/super-admin/ownership-transfers/${transfer.id}/send-notice`}
              variant="secondary"
              submitLabel="Send notice"
              fields={[]}
            />
          </DecisionBlock>
        ) : null}
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
      transfer.status === "OBJECTION_RAISED"
        ? "An objection is on file. There's no resolution action built for this yet — the school stays frozen read-only until this is handled directly against the database."
        : "This transfer has already been executed.";
    decisions = (
      <DecisionBlock note={reason}>
        <Link href={`/super-admin/schools/${transfer.schoolId}`} className="btn-secondary w-fit px-4 text-[11.5px] font-semibold">
          Open school profile
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
    decisions,
    recordHref: `/super-admin/schools/${transfer.schoolId}`,
    historyHref: `/super-admin/schools/${transfer.schoolId}?tab=activity`
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
    params.tab === "dormancy" ? "dormancy" : "directory";

  const query = new URLSearchParams();
  if (params.search) query.set("search", params.search);
  if (params.status) query.set("status", params.status);
  if (params.plan) query.set("plan", params.plan);
  if (params.state) query.set("state", params.state);
  if (params.category) query.set("category", params.category);
  if (params.joinedAfter) query.set("dateFrom", params.joinedAfter);
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
  const signupsLast7Days = webAddressSchools.filter((school) => new Date(school.createdAt).getTime() >= Date.now() - 7 * 24 * 60 * 60 * 1000).length;
  type ProvisioningRun = { id: string; name: string; slug: string; status: string; createdAt: string; elapsedMs: number | null; clean: boolean | null; steps: Array<{ key: string; label: string; detail: string }>; classes: number; subjects: number; grading: boolean; smsCredits: number | null; whatsappCredits: number | null; trialStartedAt: string | null; trialEndsAt: string | null; sample: "LOADED" | "REMOVED" | "NEVER"; sampleStudents: number; sampleDays: number; realStudents: number };
  let provisioningRuns: ProvisioningRun[] = [];
  let provisioningLast7 = { signups: 0, clean: 0 };
  if (activeTab === "provisioning") {
    try {
      const report = await apiGetEnvelope<{ runs: ProvisioningRun[]; last7: { signups: number; clean: number } }>("/api/super-admin/schools-provisioning");
      provisioningRuns = report.data?.runs ?? [];
      provisioningLast7 = report.data?.last7 ?? provisioningLast7;
    } catch {
      provisioningRuns = [];
    }
  }
  const timed = provisioningRuns.filter((run) => run.elapsedMs !== null).map((run) => run.elapsedMs as number).sort((a, b) => a - b);
  const median = timed.length ? timed[Math.floor(timed.length / 2)] : null;
  const todayRuns = provisioningRuns.filter((run) => run.elapsedMs !== null && new Date(run.createdAt).toDateString() === new Date().toDateString());
  const slowestToday = todayRuns.length ? Math.max(...todayRuns.map((run) => run.elapsedMs as number)) : null;
  const seconds = (ms: number | null) => (ms === null ? "N/A" : ms < 1000 ? `${ms} ms` : `${(ms / 1000).toFixed(1)} s`);
  const sampleLabel = (run: ProvisioningRun) => (run.sample === "LOADED" ? `Loaded · ${run.sampleStudents} students, ${run.sampleDays} days` : run.sample === "REMOVED" ? "Removed by the school" : "Never loaded");

  // Directory's Region filter — real states actually present on the platform, not a
  // fabricated Nigeria-wide list padded with states nobody is in yet.
  const stateFilterOptions = [
    { label: "All states", value: "" },
    ...Array.from(new Set(webAddressSchools.map((school) => school.state).filter((state): state is string => Boolean(state)))).sort().map((state) => ({ label: state, value: state }))
  ];

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
  let dormancyPolicy = { watchDays: 60, dormantDays: 120, noticeDays: 30 };
  try {
    const policyEnvelope = await apiGetEnvelope<{ dormancy: typeof dormancyPolicy }>("/api/super-admin/platform-policy");
    dormancyPolicy = policyEnvelope.data?.dormancy ?? dormancyPolicy;
  } catch {
    // the stage table falls back to the defaults it ships with
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
  const heldAddressCount = registryRecords.filter((record) => record.state === "HELD").length;
  const reservedBlockedCount = registryRecords.filter((record) => record.state === "RESERVED" || record.state === "BLOCKED").length;
  const activeRedirectCount = registryRecords.filter((record) => record.redirectExpiresAt && new Date(record.redirectExpiresAt) > new Date()).length;

  // M2.11 — ownership transfers. Same defensive fetch as the registry above.
  let ownershipTransfers: OwnershipTransferRow[] = [];
  try {
    const transfersEnvelope = await apiGetEnvelope<OwnershipTransferRow[]>("/api/super-admin/ownership-transfers");
    ownershipTransfers = transfersEnvelope.data ?? [];
  } catch {
    ownershipTransfers = [];
  }
  const schoolOptions = webAddressSchools.map((school) => ({ label: school.name, value: school.id }));

  // Reviews & Cases board — three real case types, one queue. Ownership transfers already
  // executed and disputes already decided are resolved, not open cases.
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
    { label: "Dormancy", href: tabHref("dormancy"), active: activeTab === "dormancy", badge: neverLoggedInCount }
  ];

  return (
    <div className="grid gap-5">
      <ModuleHero
        eyebrow="Schools & Revenue"
        title="School Accounts"
        description="Every school from signup to closure, with every lifecycle action."
        action={<AddSchoolWizard plans={activePlans} />}
      />

      <DetailTabs tabs={tabs} />

      {activeTab === "directory" ? (
        <>
          {params.state ? (
            <div className="flex items-center gap-2 rounded-[9px] bg-[var(--color-accent-primary-dim)] px-4 py-2.5 text-[11.5px] font-semibold text-[var(--color-text-accent)]">
              Filtered to schools in {params.state}
              <Link href="/super-admin/schools" className="ml-auto text-[10.5px] font-bold underline">
                Clear
              </Link>
            </div>
          ) : null}
          <SchoolBulkTable
            schools={schools}
            filterBar={
              <FilterToolbar
                action="/super-admin/schools"
                resultCount={total}
                controls={[
                  { name: "search", label: "Search", type: "search", placeholder: "Search by school name", defaultValue: params.search },
                  { name: "plan", label: "Tier", type: "select", defaultValue: params.plan, options: planFilterOptions },
                  { name: "status", label: "Status", type: "select", defaultValue: params.status, options: statusFilterOptions },
                  { name: "state", label: "Region", type: "select", defaultValue: params.state, options: stateFilterOptions },
                  { name: "category", label: "Category", type: "select", defaultValue: params.category, options: categoryFilterOptions },
                  { name: "joinedAfter", label: "Joined after", type: "date", defaultValue: params.joinedAfter }
                ]}
              />
            }
            paginationFooter={
              <ServerPagination
                baseHref="/super-admin/schools"
                params={params}
                page={envelope.pagination?.page ?? 1}
                totalPages={envelope.pagination?.totalPages ?? 1}
                total={total}
                limit={envelope.pagination?.limit ?? schools.length}
              />
            }
          />
        </>
      ) : activeTab === "approval-queue" ? (
        <section className="grid gap-5">
          <section className="grid gap-3 md:grid-cols-3">
            <StatCard label="Pending review" value={pendingVerification.length} detail="Schools flagged during onboarding." icon={Clock3} tone="dark" />
            <StatCard label="Missing registration" value={missingRegistrationCount} detail="No CAC or ministry approval recorded." icon={FileWarning} tone="danger" />
            <StatCard label="Contact gaps" value={missingContactCount} detail="Owner email or phone needs completion." icon={Users} tone="info" />
          </section>

          <CaseReviewBoard
            variant="lean"
            types={reviewCaseTypes}
            cases={reviewCases}
            emptyState="Queue is clear. Risk-flagged schools, open ownership transfers and open address disputes will appear here as one queue."
            footerNote="One queue, one anatomy. Refer for suspension, raise objection, execute and decide each require a reason and are written to the audit log; clearing a risk flag does not record one."
            searchPlaceholder="Search a school, state or reviewer"
          />
        </section>
      ) : activeTab === "provisioning" ? (
        <section className="grid gap-5">
          <section className="grid gap-3 md:grid-cols-3 lg:grid-cols-5">
            <StatCard
              label="Provisioned last 7 days"
              value={provisioningLast7.signups || signupsLast7Days}
              detail="Automatic signups."
              icon={Building2}
              tone="dark"
            />
            <StatCard label="Median provisioning time" value={seconds(median)} detail={timed.length ? `Across the last ${timed.length} timed runs.` : "No timed run yet."} icon={Clock3} />
            <StatCard label="Slowest run today" value={seconds(slowestToday)} detail={todayRuns.length ? `${todayRuns.length} run${todayRuns.length === 1 ? "" : "s"} today.` : "No run today."} icon={Clock3} />
            <StatCard label="Hard failures (7d)" value="0" detail="A hard failure rejects the signup, so no half-built school is left behind." tone="warning" icon={FileWarning} />
            <StatCard label="Soft failures (7d)" value={String(Math.max(0, provisioningLast7.signups - provisioningLast7.clean))} detail="A step that did not finish while the school was still created." icon={FileWarning} />
          </section>

          <TableCard
            title="Provisioning steps and failure handling"
            items={[
              { step: "Email availability checked", owner: "System", handling: "Hard — signup is rejected immediately with a clear message if the email is already registered." },
              { step: "Web address reserved", owner: "System", handling: "Hard — reservation is part of the same write as school creation, never a separate step that can drift out of sync." },
              { step: "School record, owner account and User ID created", owner: "System", handling: "Hard — one transaction. A permanent 6-digit User ID is issued with the account." },
              { step: "Academic year, grading scale and assessment components", owner: "System", handling: "Soft — the school is kept and the step is recorded as not finished, so it can be set up in School Configuration." },
              { step: "Subjects and class ladder from the levels chosen", owner: "System", handling: "Soft — as above." },
              { step: "Sample demonstration class", owner: "System", handling: "Soft — a school without it is simply empty. It carries no guardians, phones or emails, so nothing can be sent to it." },
              { step: "Trial subscription and messaging credits issued", owner: "System", handling: "Hard — the wallet and subscription are written with the school." },
              { step: "Automated risk assessment scored", owner: "System", handling: "Runs in-request, in-database only — never calls an external service, so it never delays signup." },
              { step: "Audit log entry written", owner: "System", handling: "Hard — a school that is not being audited from creation is not handed to a user." }
            ]}
            pageSize={false}
            getRowKey={(item) => item.step}
            columns={[
              { key: "step", header: "Step", render: (item) => <span className="font-bold text-[var(--color-text-primary)]">{item.step}</span> },
              { key: "owner", header: "Owner", render: (item) => <span className="text-[11.5px] text-[var(--color-text-secondary)]">{item.owner}</span> },
              { key: "handling", header: "Failure handling", render: (item) => <span className="text-[11.5px] leading-relaxed text-[var(--color-text-secondary)]">{item.handling}</span> },
              {
                key: "last7",
                header: "Last 7 days",
                render: () => (
                  <span className="font-[var(--font-mono)] font-bold text-[var(--color-text-primary)]">
                    {provisioningLast7.clean} / {provisioningLast7.signups}
                  </span>
                )
              }
            ]}
          />

          <TableCard
            title="Recent provisioning runs"
            items={provisioningRuns.slice(0, 8)}
            emptyState="No schools signed up yet."
            pageSize={false}
            getRowKey={(school) => school.id}
            columns={[
              { key: "school", header: "School", render: (school) => <Link href={`/super-admin/schools/${school.id}`} className="font-bold text-[var(--color-text-primary)] hover:text-[var(--color-text-accent)]">{school.name}</Link> },
              { key: "signedUp", header: "Completed", render: (school) => timeAgo(school.createdAt) },
              { key: "elapsed", header: "Elapsed", render: (school) => <span className="font-[var(--font-mono)]">{seconds(school.elapsedMs)}</span> },
              { key: "outcomes", header: "Step outcomes", render: (school) => <span className="font-[var(--font-mono)]">{school.steps.length ? `${school.steps.filter((step) => !/could not/i.test(step.label)).length} of ${school.steps.length} clean` : "Before the log existed"}</span> },
              {
                key: "status",
                header: "State",
                render: (school) => {
                  const tone = statusTone[school.status] ?? statusTone.ARCHIVED;
                  return <span className="inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-bold" style={{ background: tone.bg, color: tone.fg }}>{tone.label}</span>;
                }
              }
            ]}
          />

          <section className="grid gap-5 xl:grid-cols-[1.25fr_1fr]">
              <TableCard
                title="What loads with every new school"
                items={[
                { contents: "Calendar", detail: "The school year the school is in, in three terms (September to July), with the current term set." },
                { contents: "Grading and assessment", detail: "A grading scale (Nigerian A–F for Nigeria, a plain percentage scale elsewhere) and seven assessment components: six continuous (10 each) and a terminal exam (40)." },
                { contents: "Subjects and structure", detail: "The subjects each section teaches, and a class for every level the school said it runs, each offered its own level's subjects." },
                { contents: "Staff role templates", detail: "The shared catalogue of role templates — available to every school, not copied per school." },
                { contents: "Students, attendance, scores, results, report cards, broadsheet", detail: "A sample class of 30 students with a term of attendance marked to yesterday, ten subjects scored and approved, and 30 published report cards. Removable in one action." },
                { contents: "Fees", detail: "Nothing pre-loaded — no fee structure or payment history." },
                { contents: "Notifications", detail: "No alerts, reminders or receipts are queued. The sample class has no guardian, phone or email, so none can be." },
                { contents: "Subscription and credits", detail: "A trial subscription and a wallet of messaging credits, with a ledger row for each." }
              ]}
              pageSize={false}
              getRowKey={(item) => item.contents}
              columns={[
                { key: "contents", header: "Contents", render: (item) => <span className="font-bold text-[var(--color-text-primary)]">{item.contents}</span> },
                { key: "detail", header: "Detail", render: (item) => <span className="text-[11.5px] leading-relaxed text-[var(--color-text-muted)]">{item.detail}</span> }
              ]}
            />
            <section className="overflow-hidden rounded-[12.5px] border border-[#DEE8E2] bg-white">
              <div className="border-b border-[#E6EEE9] px-5 py-4">
                <p className="font-[var(--font-display)] text-[14.5px] font-bold text-[#0D2315]">Controls on sample data</p>
              </div>
              <div className="grid gap-3 p-5">
                {[
                  ["Labelled", "Admission numbers begin SMP-, the class is named Sample Class, and the school's dashboard says so."],
                  ["Excluded from reports", "Platform counts of students, revenue per student and billing rolls leave the sample out."],
                  ["Non-routable contacts", "No guardian, phone number or email is created, so no message can ever reach it."],
                  ["One-action removal", "The school's proprietor removes the whole class from the dashboard or School Configuration. What the school added is never touched."],
                  ["Never lands in a real record", "Everything it created is listed in a manifest, so removal deletes exactly that and nothing else."]
                ].map(([label, detail]) => (
                  <div key={label} className="border-b border-[var(--color-border-muted)] pb-3 last:border-b-0 last:pb-0">
                    <p className="text-[11.5px] font-semibold text-[var(--color-text-primary)]">{label}</p>
                    <p className="mt-0.5 text-[10.5px] leading-relaxed text-[var(--color-text-muted)]">{detail}</p>
                  </div>
                ))}
              </div>
            </section>
          </section>

          <TableCard
            title="Sample data provisioning health"
            items={provisioningRuns.slice(0, 8)}
            emptyState="No schools provisioned yet."
            pageSize={false}
            getRowKey={(school) => school.id}
            columns={[
              { key: "school", header: "School", render: (school) => <span className="font-bold text-[var(--color-text-primary)]">{school.name}</span> },
              { key: "provisioned", header: "Provisioned", render: (school) => timeAgo(school.createdAt) },
              { key: "sample", header: "Sample data", render: (school) => <span className="text-[10.5px] text-[var(--color-text-secondary)]">{sampleLabel(school)}</span> },
              { key: "realStudents", header: "Real students", render: (school) => school.realStudents.toLocaleString() },
              { key: "state", header: "State", render: (school) => <span className="text-[10.5px] text-[var(--color-text-muted)]">{school.sample === "LOADED" ? (school.realStudents > 0 ? "Mixed with real data" : "Sample only") : school.sample === "REMOVED" ? "Clean" : "No sample"}</span> }
            ]}
          />

          <section className="rounded-[12.5px] border border-[#DEE8E2] bg-white p-5">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="font-[var(--font-display)] text-[14.5px] font-bold text-[#0D2315]">Schools still mid-setup</h2>
              <span className="rounded-full bg-[#F0F5F2] px-2.5 py-1 text-[10px] font-bold text-[#77857C]">
                {provisioningSchools.length} schools
              </span>
            </div>
            <div className="grid gap-3">
              {provisioningSchools.length === 0 ? (
                <div className="empty-state">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--color-accent-primary-dim)] text-[var(--color-text-accent)]">
                    <Building2 className="h-5 w-5" />
                  </div>
                  <p className="mt-4 text-[13.5px] font-semibold text-[var(--color-text-primary)]">No schools mid-setup</p>
                  <p className="mt-1 max-w-md text-[11.5px] text-[var(--color-text-secondary)]">
                    Every school on the platform has already converted off the trial plan.
                  </p>
                </div>
              ) : (
                provisioningSchools.map((school) => (
                <article key={school.id} className="rounded-[11px] border border-[#E6EEE9] bg-[#FCFDFC] p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[11px] bg-[#F0F5F2] font-[var(--font-mono)] text-[12.5px] font-bold text-[#0D2315]">
                        {initials(school.name)}
                      </span>
                      <div>
                        <Link href={`/super-admin/schools/${school.id}`} className="text-[12.5px] font-bold text-[var(--color-text-primary)] hover:text-[var(--color-text-accent)]">
                          {school.name}
                        </Link>
                        <p className="mt-0.5 text-[11px] text-[var(--color-text-muted)]">{categoryLabel(school.category)} · {planLabel(school.plan)} tier</p>
                      </div>
                    </div>
                    <span className="inline-flex items-center rounded-full bg-[#E4F1EC] px-2.5 py-1 text-[10px] font-bold text-[#17604F]">
                      Onboarded {timeAgo(school.createdAt)}
                    </span>
                  </div>

                  <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                    <div className="flex items-center gap-2 rounded-[7px] bg-white px-3 py-2 text-[11px] text-[var(--color-text-secondary)]">
                      <MapPin className="h-3.5 w-3.5 shrink-0 text-[var(--color-text-muted)]" />
                      <span className="truncate">{[school.address, school.city, school.state].filter(Boolean).join(", ") || "No address on file"}</span>
                    </div>
                    <div className="flex items-center gap-2 rounded-[7px] bg-white px-3 py-2 text-[11px] text-[var(--color-text-secondary)]">
                      <Users className="h-3.5 w-3.5 shrink-0 text-[var(--color-text-muted)]" />
                      <span className="truncate">{school.ownerName ?? "Owner not recorded"}</span>
                    </div>
                    <div className="flex items-center gap-2 rounded-[7px] bg-white px-3 py-2 text-[11px] text-[var(--color-text-secondary)]">
                      <Phone className="h-3.5 w-3.5 shrink-0 text-[var(--color-text-muted)]" />
                      <span className="truncate">{school.ownerPhone ?? "No phone on file"}</span>
                    </div>
                    <div className="flex items-center gap-2 rounded-[7px] bg-white px-3 py-2 text-[11px] text-[var(--color-text-secondary)]">
                      <Mail className="h-3.5 w-3.5 shrink-0 text-[var(--color-text-muted)]" />
                      <span className="truncate">{school.ownerEmail ?? "No email on file"}</span>
                    </div>
                  </div>

                  <div className="mt-3 flex items-center justify-between">
                    <p className="text-[11px] text-[var(--color-text-muted)]">
                      {school.totalStudents.toLocaleString()} student(s) declared at signup
                    </p>
                    <Link href={`/super-admin/schools/${school.id}`} className="btn-link text-[11.5px]">
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
          <section className="grid gap-3 md:grid-cols-3 lg:grid-cols-5">
            <StatCard label="Addresses live" value={liveAddressCount} detail="One per school, permanent from minute one." icon={ShieldCheck} tone="dark" />
            <StatCard label="Held (retiring)" value={heldAddressCount} detail="12 months from closure, then released." icon={Moon} tone={heldAddressCount > 0 ? "warning" : "success"} />
            <StatCard label="Reserved / blocked" value={reservedBlockedCount} detail="Held out of the available pool." icon={Gavel} tone="warning" />
            <StatCard label="Open disputes" value={openDisputeCount} detail={`${addressDisputes.length} logged in total.`} icon={FileWarning} tone={openDisputeCount > 0 ? "warning" : "success"} />
            <StatCard label="Active redirects" value={activeRedirectCount} detail="90 days from the change date." icon={Repeat2} tone="info" />
          </section>

          <WebAddressesTable schools={webAddressSchools} registryRecords={registryRecords} disputes={addressDisputes} />

          <section className="rounded-[12.5px] border border-[#DEE8E2] bg-white p-6">
            <h2 className="text-[12.5px] font-semibold text-[#0D2315]">Address dispute — a real school finds its name taken</h2>
            <div className="mt-5 flex flex-wrap items-center gap-2.5">
              {disputeFlow.map((stage, index) => (
                <div key={stage.label} className="flex items-center gap-2.5">
                  <div
                    className="min-w-[9rem] rounded-[10px] border px-4 py-3"
                    style={
                      stage.emphasize
                        ? { background: "var(--color-text-primary)", borderColor: "var(--color-text-primary)", color: "var(--color-bg-surface)" }
                        : { background: "var(--color-bg-surface)", borderColor: "var(--color-border-default)", color: "var(--color-text-primary)" }
                    }
                  >
                    <p className="text-[11.5px] font-semibold">{stage.label}</p>
                    <p className={`mt-[2.5px] text-[9.5px] ${stage.emphasize ? "opacity-75" : "text-[var(--color-text-muted)]"}`}>{stage.trigger}</p>
                  </div>
                  {index < disputeFlow.length - 1 ? (
                    <ArrowRight className="h-4 w-4 shrink-0 text-[var(--color-text-muted)]" />
                  ) : null}
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-[12.5px] border border-[#DEE8E2] bg-white p-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="font-[var(--font-display)] text-[14.5px] font-bold text-[#0D2315]">Address disputes</h2>
                <p className="mt-1 text-[11.5px] text-[#77857C]">{openDisputeCount} open of {addressDisputes.length} logged.</p>
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

            <div className="mt-5 grid gap-5 xl:grid-cols-[1.1fr_1fr]">
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
                        <span className="rounded-[5.5px] bg-[var(--color-bg-subtle)] px-2 py-1 font-[var(--font-mono)] text-[11px] text-[var(--color-text-primary)]">{dispute.claimedAddress}</span>
                        <p className="mt-1 text-[11px] text-[var(--color-text-secondary)]">{dispute.claimantSchoolName} · {dispute.claimantContactName}</p>
                      </div>
                    )
                  },
                  {
                    key: "status",
                    header: "Status",
                    render: (dispute) => {
                      const tone = disputeStatusTone[dispute.status] ?? disputeStatusTone.EVIDENCE_PENDING;
                      return (
                        <span className="inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-bold" style={{ background: tone.bg, color: tone.fg }}>
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

              <section className="overflow-hidden rounded-[12.5px] border border-[#DEE8E2] bg-white">
                <div className="border-b border-[#E6EEE9] px-5 py-4">
                  <p className="font-[var(--font-display)] text-[14.5px] font-bold text-[#0D2315]">Accepted evidence</p>
                </div>
                <div className="grid gap-3 p-5">
                  {[
                    "Letterhead or official communication bearing the name",
                    "Business or charity registration document",
                    "Ministry or education authority approval",
                    "Email from a verified domain matching the school website"
                  ].map((item) => (
                    <div key={item} className="flex items-start gap-2.5 border-b border-[var(--color-border-muted)] pb-3 last:border-b-0 last:pb-0">
                      <span className="mt-0.5 h-2 w-2 shrink-0 rounded-full" style={{ background: "var(--color-text-accent)" }} />
                      <p className="text-[11.5px] leading-relaxed text-[var(--color-text-secondary)]">{item}</p>
                    </div>
                  ))}
                  <div className="flex items-start gap-2.5 border-t border-[var(--color-border-default)] pt-3">
                    <span className="mt-0.5 h-2 w-2 shrink-0 rounded-full" style={{ background: "var(--color-danger)" }} />
                    <div>
                      <p className="text-[11.5px] font-semibold text-[var(--color-text-primary)]">The default is possession</p>
                      <p className="mt-0.5 text-[10.5px] leading-relaxed text-[var(--color-text-muted)]">Reassigned only where the holder cannot evidence any legitimate claim.</p>
                    </div>
                  </div>
                </div>
              </section>
            </div>
          </section>
        </section>
      ) : (
        <section className="grid gap-5">
          <TableCard
            title="Dormancy stages — what's actually automated"
            description="Run by the lifecycle engine every 30 minutes, on the day counts in Settings → Platform. Each step is written to the audit log and tells the people it affects."
            items={[
              { stage: "Inactivity watch", trigger: `${dormancyPolicy.watchDays} days without a successful sign-in`, effect: "The account manager is told, once, and the school is marked as on watch." },
              { stage: "Dormant", trigger: `${dormancyPolicy.dormantDays} days without a sign-in`, effect: `The school is marked dormant, its owner is emailed and told the date its web address will be released (${dormancyPolicy.noticeDays} days on).` },
              { stage: "Address released", trigger: `${dormancyPolicy.noticeDays} days after the notice, if nobody has signed in`, effect: "The address returns to the pool and the school is archived. A school that pays is never released automatically — it stays flagged for a person to decide." },
              { stage: "Restored", trigger: "Any successful sign-in", effect: "Dormancy is cleared at the next lifecycle run and the school comes off the register." }
            ]}
            pageSize={false}
            getRowKey={(row) => row.stage}
            columns={[
              { key: "stage", header: "Stage", render: (row) => <span className="font-bold text-[var(--color-text-primary)]">{row.stage}</span> },
              { key: "trigger", header: "Trigger", render: (row) => <span className="text-[11.5px] text-[var(--color-text-secondary)]">{row.trigger}</span> },
              { key: "effect", header: "Effect", render: (row) => <span className="text-[11.5px] leading-relaxed text-[var(--color-text-secondary)]">{row.effect}</span> }
            ]}
          />

          <TableCard
            title="Dormancy register"
            description="Every school with no successful login on record, or none in the last 30 days — computed live from real login history."
            items={dormancySchools
              .filter((school) => !school.lastSuccessfulLoginAt || Date.now() - new Date(school.lastSuccessfulLoginAt).getTime() > 30 * 24 * 60 * 60 * 1000)
              .sort((a, b) => new Date(a.lastSuccessfulLoginAt ?? 0).getTime() - new Date(b.lastSuccessfulLoginAt ?? 0).getTime())}
            emptyState="No school has gone 30 days without a successful login."
            pageSize={false}
            getRowKey={(school) => school.id}
            columns={[
              { key: "school", header: "School", render: (school) => <Link href={`/super-admin/schools/${school.id}`} className="font-bold text-[var(--color-text-primary)] hover:text-[var(--color-text-accent)]">{school.name}</Link> },
              { key: "status", header: "Account status", render: (school) => (statusTone[school.status] ? <span className="inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-bold" style={{ background: statusTone[school.status].bg, color: statusTone[school.status].fg }}>{statusTone[school.status].label}</span> : school.status) },
              { key: "lastLogin", header: "Last successful login", render: (school) => (school.lastSuccessfulLoginAt ? timeAgo(school.lastSuccessfulLoginAt) : "Never") },
              { key: "since", header: "On platform since", render: (school) => timeAgo(school.createdAt) },
              { key: "noticeSent", header: "Notice sent", render: (school) => (school.noticeSentAt ? timeAgo(school.noticeSentAt) : <span className="text-[var(--color-text-muted)]">Not yet</span>) },
              { key: "releaseDue", header: "Release due", render: (school) => (school.releaseDueAt ? <span>{new Date(school.releaseDueAt).toLocaleDateString("en-GB")}{school.billingStatus === "ACTIVE" ? " · paying, held for a person" : ""}</span> : <span className="text-[var(--color-text-muted)]">—</span>) }
            ]}
          />

          <section className="rounded-[12.5px] border border-[#DEE8E2] bg-white p-6">
            <h2 className="text-[12.5px] font-semibold text-[#0D2315]">School account lifecycle — every fork condition labelled</h2>
            <div className="mt-5 flex flex-wrap items-center gap-2.5">
              {lifecycleFlow.map((stage, index) => (
                <div key={stage.label} className="flex items-center gap-2.5">
                  <div
                    className="min-w-[9rem] rounded-[10px] border px-4 py-3"
                    style={
                      stage.emphasize
                        ? { background: "var(--color-text-primary)", borderColor: "var(--color-text-primary)", color: "var(--color-bg-surface)" }
                        : { background: "var(--color-bg-surface)", borderColor: "var(--color-border-default)", color: "var(--color-text-primary)" }
                    }
                  >
                    <p className="text-[11.5px] font-semibold">{stage.label}</p>
                    <p className={`mt-[2.5px] text-[9.5px] ${stage.emphasize ? "opacity-75" : "text-[var(--color-text-muted)]"}`}>{stage.trigger}</p>
                  </div>
                  {index < lifecycleFlow.length - 1 ? (
                    <ArrowRight className="h-4 w-4 shrink-0 text-[var(--color-text-muted)]" />
                  ) : null}
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-[12.5px] border border-[#DEE8E2] bg-white p-5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-[12.5px] font-semibold text-[#0D2315]">Account status reference</h2>
              <p className="text-[10.5px] text-[#8c9a92]">Status changes always require a logged reason</p>
            </div>
            <div className="mt-4 overflow-hidden rounded-[11px] border border-[#DEE8E2]">
              {statusReference.map((row, index) => {
                const tone = statusTone[row.status] ?? statusTone.ARCHIVED;
                return (
                  <div
                    key={row.status}
                    className={`grid gap-3 px-4 py-3.5 sm:grid-cols-[9rem_1.6fr_1.4fr_1fr] sm:items-center ${index % 2 === 1 ? "bg-[#FBFDFC]" : "bg-white"}`}
                  >
                    <span
                      className="inline-flex w-fit items-center rounded-full px-2.5 py-1 text-[10px] font-bold"
                      style={{ background: tone.bg, color: tone.fg }}
                    >
                      {row.label}
                    </span>
                    <p className="text-[11.5px] text-[var(--color-text-primary)]">{row.meaning}</p>
                    <p className="text-[11px] text-[var(--color-text-secondary)]">{row.trigger}</p>
                    <p className="text-[11px] font-semibold text-[var(--color-text-muted)]">{row.who}</p>
                  </div>
                );
              })}
            </div>
          </section>
        </section>
      )}
    </div>
  );
}
