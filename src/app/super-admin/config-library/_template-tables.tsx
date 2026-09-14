"use client";

import { useMemo, useState, type ReactNode } from "react";

import { DetailFacts, DetailSheet, type DetailSheetChip } from "@/components/data-display/detail-sheet";
import { StatusBadge } from "@/components/data-display/status-badge";
import { TableCard } from "@/components/data-display/table-card";
import { TableFilterBar } from "@/components/data-display/table-filter-bar";
import { ResourceField, ResourceForm } from "@/components/forms/resource-form";
import { useToast } from "@/components/ui/toast-provider";
import { Modal } from "@/components/ui/modal";
import type { SuperAdminConfigLibrary } from "@/lib/domain/types";

const calendarOptions = [{ label: "Three-term", value: "THREE_TERM" }, { label: "Two-semester", value: "TWO_SEMESTER" }];

const notTracked = <span className="text-[var(--color-text-muted)]">Not tracked</span>;
const disconnectedFootnote = (
  <>
    Master templates are Super Admin content, not Nooria-owned copies a school customises — no school has ever read one. There is no real
    &quot;schools using this template&quot; count to show; the column above reflects that honestly rather than a fabricated number.
  </>
);

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

/** A secondary action rendered in a review sheet's footer that isn't real functionality —
 * clicking it tells the viewer plainly why, instead of doing nothing or being hidden. */
function InertFooterAction({ label, note }: { label: string; note: string }) {
  const { showToast } = useToast();
  return (
    <button
      type="button"
      onClick={() => showToast({ variant: "info", title: "Not built", description: note })}
      className="btn-secondary px-4 text-[12.5px]"
    >
      {label}
    </button>
  );
}

/** Row-click "review" sheet (mockup's openXSheet) + a separate real edit Modal, wired together —
 * matches the mockup's two-step flow: review first, "Edit this …" opens the actual form. */
function RowReviewAction({
  triggerLabel,
  avatarLabel,
  eyebrow,
  title,
  subtitle,
  chips,
  factsTitle,
  factsRows,
  extraNote,
  inertActions,
  editTitle,
  editDescription,
  endpoint,
  submitLabel,
  editFields
}: {
  triggerLabel: string;
  avatarLabel: string;
  eyebrow: string;
  title: string;
  subtitle?: string;
  chips?: DetailSheetChip[];
  factsTitle: string;
  factsRows: Array<{ label: string; value: string; bold?: boolean }>;
  extraNote?: { tone: "good" | "warn" | "bad" | "mute"; title?: string; text: string };
  inertActions: Array<{ label: string; note: string }>;
  editTitle: string;
  editDescription: string;
  endpoint: string;
  submitLabel: string;
  editFields: ResourceField[];
}) {
  const [reviewOpen, setReviewOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  return (
    <>
      <button type="button" onClick={() => setReviewOpen(true)} className="btn-secondary px-4 text-[12.5px]">
        {triggerLabel}
      </button>

      <DetailSheet
        open={reviewOpen}
        onClose={() => setReviewOpen(false)}
        avatarLabel={avatarLabel}
        eyebrow={eyebrow}
        title={title}
        subtitle={subtitle}
        chips={chips}
        footer={
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                setReviewOpen(false);
                setEditOpen(true);
              }}
              className="btn-primary px-4 text-[12.5px]"
            >
              {editTitle}
            </button>
            {inertActions.map((action) => (
              <InertFooterAction key={action.label} label={action.label} note={action.note} />
            ))}
          </div>
        }
      >
        <div className="grid gap-4">
          <DetailFacts title={factsTitle} rows={factsRows} />
          {extraNote ? (
            <div className="rounded-[12px] border p-4" style={{
              background: extraNote.tone === "warn" ? "var(--color-warning-dim)" : extraNote.tone === "bad" ? "var(--color-danger-dim)" : extraNote.tone === "good" ? "var(--color-success-dim)" : "var(--color-bg-subtle)",
              borderColor: extraNote.tone === "warn" ? "#F2E4C6" : extraNote.tone === "bad" ? "#F3E0E0" : extraNote.tone === "good" ? "#CFE4DB" : "var(--color-border-default)"
            }}>
              {extraNote.title ? <p className="mb-1.5 text-[12.5px] font-bold" style={{ color: extraNote.tone === "warn" ? "var(--color-warning)" : extraNote.tone === "bad" ? "var(--color-danger)" : extraNote.tone === "good" ? "var(--color-success)" : "var(--color-text-secondary)" }}>{extraNote.title}</p> : null}
              <p className="text-[12px] leading-relaxed" style={{ color: extraNote.tone === "warn" ? "var(--color-warning)" : extraNote.tone === "bad" ? "var(--color-danger)" : extraNote.tone === "good" ? "var(--color-success)" : "var(--color-text-secondary)" }}>{extraNote.text}</p>
            </div>
          ) : null}
        </div>
      </DetailSheet>

      <Modal open={editOpen} onClose={() => setEditOpen(false)} title={editTitle} subtitle={editDescription} size="report">
        <ResourceForm
          title={editTitle}
          description={editDescription}
          endpoint={endpoint}
          submitLabel={submitLabel}
          fields={editFields}
          chrome="plain"
          showHeader={false}
          onSuccess={() => setEditOpen(false)}
          onCancel={() => setEditOpen(false)}
        />
      </Modal>
    </>
  );
}

export function CurriculumTemplatesTable({ items }: { items: SuperAdminConfigLibrary["curricula"] }) {
  const [search, setSearch] = useState("");
  const [market, setMarket] = useState("All markets");
  const [status, setStatus] = useState("All statuses");

  const markets = useMemo(() => ["All markets", ...Array.from(new Set(items.map((item) => item.country))).sort()], [items]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((item) => {
      const matchesSearch = !q || item.name.toLowerCase().includes(q) || item.country.toLowerCase().includes(q);
      const matchesMarket = market === "All markets" || item.country === market;
      const matchesStatus = status === "All statuses" || (status === "Active" ? item.isActive : !item.isActive);
      return matchesSearch && matchesMarket && matchesStatus;
    });
  }, [items, search, market, status]);

  return (
    <TableCard
      title="Curriculum template library"
      description="A country/curriculum reference record — name, subject list, and calendar convention. Open Structure on any row to read it. Not linked to any school (see the footnote below)."
      items={filtered}
      getRowKey={(item) => item.id}
      filterBar={
        <TableFilterBar
          search={{ value: search, onChange: setSearch, placeholder: "Search a template or market" }}
          filters={[
            { label: "Market", value: market, options: markets.map((value) => ({ label: value, value })), onChange: setMarket },
            { label: "Status", value: status, options: ["All statuses", "Active", "Inactive"].map((value) => ({ label: value, value })), onChange: setStatus }
          ]}
          note={`${filtered.length} of ${items.length} shown`}
        />
      }
      columns={[
        { key: "name", header: "Template", render: (item) => <span className="font-semibold text-[var(--color-text-primary)]">{item.name}</span> },
        { key: "country", header: "Market", render: (item) => item.country },
        {
          key: "characteristics",
          header: "Key characteristics",
          render: (item) => (
            <span className="text-[var(--color-text-secondary)]">
              {item.subjectCount > 0 ? `${item.subjectCount} subjects` : "No subjects recorded"} · {item.calendarType.replaceAll("_", " ")} · v{item.version}
            </span>
          )
        },
        { key: "schools", header: "Schools", render: () => notTracked },
        { key: "status", header: "Status", render: (item) => <StatusBadge status={item.isActive ? "ACTIVE" : "INACTIVE"} tone={item.isActive ? "success" : "neutral"} /> },
        {
          key: "actions",
          header: "",
          sortable: false,
          render: (item) => (
            <RowReviewAction
              triggerLabel="Structure"
              avatarLabel={initialsOf(item.name)}
              eyebrow="Master template"
              title={item.name}
              subtitle={`${item.country} · v${item.version}`}
              chips={[
                { label: item.isActive ? "Active" : "Inactive", tone: item.isActive ? "good" : "mute" },
                { label: "No schools yet", tone: "mute" }
              ]}
              factsTitle="The six layers"
              factsRows={[
                { label: "Schools using it", value: "Not tracked" },
                { label: "Layers authored", value: "Not yet authored", bold: true },
                { label: "Portability tests", value: "Not gated" }
              ]}
              extraNote={{
                tone: "warn",
                title: "Not yet authored",
                text: "This template is one flat record (name, country, subjects, calendar, version) — not six independently authorable layers. See the six-layer curriculum configuration model table below for what's real per layer, platform-wide, and the Portability tests table for what's actually verified."
              }}
              inertActions={[
                { label: "Open the layer workspace", note: "Not built — there is no per-layer authoring workspace." },
                { label: "View version history", note: "Not built — saving overwrites this record in place; no prior version is kept." }
              ]}
              editTitle="Edit this template"
              editDescription="Re-saves this exact template. Changing the name creates a new template instead of updating this one — the name is the record's identity."
              endpoint="/api/super-admin/config-library/curricula"
              submitLabel="Save curriculum"
              editFields={[
                { name: "name", label: "Template name", required: true, defaultValue: item.name, section: "Identity" },
                { name: "country", label: "Country", required: true, defaultValue: item.country, section: "Identity" },
                { name: "calendarType", label: "Layer 1 · calendar", type: "select", options: calendarOptions, defaultValue: item.calendarType, section: "Configuration" },
                { name: "version", label: "Version", defaultValue: item.version, section: "Configuration" },
                { name: "subjects", label: "Subjects (comma-separated) — the real Layer 3 data", type: "textarea", parse: "csv", defaultValue: item.subjects.join(", "), section: "Configuration" }
              ]}
            />
          )
        }
      ]}
      emptyState="No curriculum templates match this filter."
      footnote={disconnectedFootnote}
    />
  );
}

function formatBands(gradeBands: unknown): string {
  if (!Array.isArray(gradeBands) || gradeBands.length === 0) return "No bands defined";
  return (gradeBands as Array<{ grade?: string; min?: number; max?: number }>)
    .map((b) => `${b.grade ?? "?"} ${b.min ?? "?"}–${b.max ?? "?"}`)
    .join(" · ");
}

export function GradingScalesTable({ items, actions }: { items: SuperAdminConfigLibrary["gradingScales"]; actions: ReactNode }) {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((item) => !q || item.name.toLowerCase().includes(q));
  }, [items, search]);

  return (
    <TableCard
      title="Grading scale template library"
      description="What a school could in principle start from — bands, boundaries, and a pass mark. Open a scale to review and edit its bands. Edit: Platform Owner, Developer or Super Admin only."
      items={filtered}
      actions={actions}
      getRowKey={(item) => item.id}
      filterBar={<TableFilterBar search={{ value: search, onChange: setSearch, placeholder: "Search a scale" }} note={`${filtered.length} of ${items.length} shown`} />}
      columns={[
        { key: "name", header: "Scale", render: (item) => <span className="font-semibold text-[var(--color-text-primary)]">{item.name}</span> },
        { key: "bands", header: "Bands", render: (item) => <span className="text-[var(--color-text-secondary)]">{formatBands(item.gradeBands)}</span> },
        { key: "pass", header: "Pass", render: (item) => item.passMark },
        { key: "credit", header: "Credit threshold", render: () => notTracked },
        { key: "schools", header: "Schools", render: () => notTracked },
        { key: "status", header: "Status", render: (item) => <StatusBadge status={item.isActive ? "ACTIVE" : "INACTIVE"} tone={item.isActive ? "success" : "neutral"} /> },
        {
          key: "actions",
          header: "",
          sortable: false,
          render: (item) => (
            <RowReviewAction
              triggerLabel="Edit"
              avatarLabel={initialsOf(item.name)}
              eyebrow="Grading scale"
              title={item.name}
              subtitle="Not tracked — no school is linked to this scale"
              chips={[
                { label: "No default concept", tone: "mute" },
                { label: `Pass at ${item.passMark}`, tone: "mute" }
              ]}
              factsTitle="The scale"
              factsRows={[
                { label: "Bands", value: formatBands(item.gradeBands) },
                { label: "Pass mark", value: String(item.passMark), bold: true },
                { label: "Credit threshold", value: "Not tracked" },
                { label: "Schools using it", value: "Not tracked" },
                { label: "Shown by default", value: "No — no default-scale concept exists" }
              ]}
              extraNote={{
                tone: "warn",
                title: "Why editing this is consequential",
                text: "Band boundaries must stay contiguous — a gap between two bands leaves a score with no band. This system does not validate that today: a scale can be saved with a gap or an overlap and nothing will catch it before it reaches a report card."
              }}
              inertActions={[
                { label: "Make this the default", note: "Not built — there is no default-scale concept to change." },
                { label: "Duplicate as a custom scale", note: "Not built as a duplicate step — but New scale above creates one from scratch." }
              ]}
              editTitle="Edit this scale"
              editDescription="Boundaries must stay contiguous — a gap between two bands leaves a score with no band. Changing the name creates a new scale instead of updating this one."
              endpoint="/api/super-admin/config-library/grading-scales"
              submitLabel="Save scale"
              editFields={[
                { name: "name", label: "Scale name", required: true, defaultValue: item.name, section: "Identity" },
                { name: "passMark", label: "Pass mark", type: "number", defaultValue: item.passMark, min: 0, max: 100, section: "Identity" },
                { name: "applicableCurricula", label: "Applicable curricula (comma-separated)", parse: "csv", defaultValue: item.applicableCurricula.join(", "), section: "Configuration" },
                { name: "gradeBands", label: "Grade bands (JSON array)", type: "textarea", parse: "json", required: true, defaultValue: JSON.stringify(item.gradeBands, null, 2), section: "Configuration" }
              ]}
            />
          )
        }
      ]}
      emptyState="No grading scale templates match this filter."
      footnote="A school may create a custom scale where no template fits — but nothing here is offered during setup today, since setup doesn't read this table at all."
    />
  );
}

const reportCardSections = [
  "1 · School header",
  "2 · Pupil identity",
  "3 · Subject table",
  "4 · Cumulative column",
  "5 · Behavioural domains",
  "6 · Comments",
  "7 · Closing block"
];

export function ReportCardsTable({ items, actions }: { items: SuperAdminConfigLibrary["reportCards"]; actions: ReactNode }) {
  const [search, setSearch] = useState("");
  const [availability, setAvailability] = useState("All tiers");
  const [status, setStatus] = useState("All statuses");

  const tiers = useMemo(() => ["All tiers", ...Array.from(new Set(items.flatMap((item) => item.availableToTiers))).sort()], [items]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((item) => {
      const matchesSearch = !q || item.name.toLowerCase().includes(q);
      const matchesAvailability = availability === "All tiers" || item.availableToTiers.includes(availability) || item.availableToTiers.length === 0;
      const matchesStatus = status === "All statuses" || (status === "Active" ? item.isActive : !item.isActive);
      return matchesSearch && matchesAvailability && matchesStatus;
    });
  }, [items, search, availability, status]);

  return (
    <TableCard
      title="Report card layout library — Layer 6"
      description="Every layout a school can be given. Open one to review it section by section before it reaches a parent, or add a new one. Add or edit: Platform Owner, Developer or Super Admin only."
      items={filtered}
      actions={actions}
      getRowKey={(item) => item.id}
      filterBar={
        <TableFilterBar
          search={{ value: search, onChange: setSearch, placeholder: "Search a layout" }}
          filters={[
            { label: "Availability", value: availability, options: tiers.map((value) => ({ label: value, value })), onChange: setAvailability },
            { label: "Status", value: status, options: ["All statuses", "Active", "Inactive"].map((value) => ({ label: value, value })), onChange: setStatus }
          ]}
          note={`${filtered.length} of ${items.length} shown`}
        />
      }
      columns={[
        { key: "name", header: "Layout", render: (item) => <span className="font-semibold text-[var(--color-text-primary)]">{item.name}</span> },
        { key: "bestFor", header: "Best for", render: () => notTracked },
        { key: "tiers", header: "Available to", render: (item) => item.availableToTiers.join(", ") || "All tiers" },
        { key: "schools", header: "Schools", render: () => notTracked },
        { key: "status", header: "Status", render: (item) => <StatusBadge status={item.isActive ? "ACTIVE" : "INACTIVE"} tone={item.isActive ? "success" : "neutral"} /> },
        {
          key: "actions",
          header: "",
          sortable: false,
          render: (item) => (
            <RowReviewAction
              triggerLabel="Review"
              avatarLabel={initialsOf(item.name)}
              eyebrow="Report card layout · Layer 6"
              title={item.name}
              subtitle="Not tracked — no school is linked to this layout"
              chips={[
                { label: item.isActive ? "Active" : "Inactive", tone: item.isActive ? "good" : "mute" },
                { label: item.availableToTiers.join(", ") || "All tiers", tone: "mute" }
              ]}
              factsTitle="How this layout behaves"
              factsRows={[
                { label: "Available to", value: item.availableToTiers.join(", ") || "All tiers" },
                { label: "Schools using it", value: "Not tracked" },
                { label: "Distinguishing rules", value: item.layout || "Not set", bold: true },
                ...reportCardSections.map((section) => ({ label: section, value: "Not tracked" }))
              ]}
              extraNote={{
                tone: "mute",
                title: "Sections, in print order",
                text: "No structured layout data exists for any section above — this record stores only a single free-text layout name, not position display, cumulative column, or behavioural-domain rules."
              }}
              inertActions={[
                { label: "Preview with sample data", note: "Not built — no layout is ever rendered against sample data before release." },
                { label: "See the schools using it", note: "Not built — no school is linked to a report card template." }
              ]}
              editTitle="Edit this layout"
              editDescription="layoutConfig stores a single free-text layout name — not structured section data. Changing the name creates a new template instead of updating this one."
              endpoint="/api/super-admin/config-library/report-cards"
              submitLabel="Save layout"
              editFields={[
                { name: "name", label: "Template name", required: true, defaultValue: item.name, section: "Identity" },
                { name: "layout", label: "Layout", required: true, defaultValue: item.layout, section: "Identity" },
                { name: "applicableCurricula", label: "Applicable curricula (comma-separated)", parse: "csv", defaultValue: item.applicableCurricula.join(", "), section: "Availability" },
                { name: "availableToTiers", label: "Available to tiers (comma-separated)", parse: "csv", defaultValue: item.availableToTiers.join(", "), placeholder: "STANDARD, ELITE", section: "Availability" }
              ]}
            />
          )
        }
      ]}
      emptyState="No report card templates match this filter."
      footnote="layoutConfig stores a single free-text layout name today — not the structured section data (position display, cumulative column, behavioural domains) a layout would need to actually render a report card."
    />
  );
}
