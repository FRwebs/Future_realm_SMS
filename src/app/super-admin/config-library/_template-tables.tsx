"use client";

import { useMemo, useState, type ReactNode } from "react";

import { DetailFacts, DetailSheet, type DetailSheetChip } from "@/components/data-display/detail-sheet";
import { StatusBadge } from "@/components/data-display/status-badge";
import { TableCard } from "@/components/data-display/table-card";
import { TableFilterBar } from "@/components/data-display/table-filter-bar";
import { ResourceActionDialog } from "@/components/forms/resource-action-dialog";
import { ResourceField, ResourceForm } from "@/components/forms/resource-form";
import { ActionMenu } from "@/components/ui/action-menu";
import { useToast } from "@/components/ui/toast-provider";
import { Modal } from "@/components/ui/modal";
import type { SuperAdminConfigLibrary } from "@/lib/domain/types";

const calendarOptions = [{ label: "Three-term", value: "THREE_TERM" }, { label: "Two-semester", value: "TWO_SEMESTER" }];

const notTracked = <span className="text-[var(--color-text-muted)]">Not tracked</span>;
const LIFECYCLE_TONE: Record<string, "success" | "warning" | "neutral"> = { ACTIVE: "success", VALIDATED: "warning", DRAFT: "warning", SUPERSEDED: "neutral", ARCHIVED: "neutral" };
const adoptionFootnote = (
  <>
    Only a published (Active) template is offered. A new school&apos;s setup copies the Active grading scale for its country and records which version it took —
    the school then owns its copy, so a later version never changes a school that already has one. “Schools” counts those copies.
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
      className="btn-secondary px-4 text-[11.5px]"
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
      <button type="button" onClick={() => setReviewOpen(true)} className="btn-secondary px-4 text-[11.5px]">
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
              className="btn-primary px-4 text-[11.5px]"
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
            <div className="rounded-[11px] border p-4" style={{
              background: extraNote.tone === "warn" ? "var(--color-warning-dim)" : extraNote.tone === "bad" ? "var(--color-danger-dim)" : extraNote.tone === "good" ? "var(--color-success-dim)" : "var(--color-bg-subtle)",
              borderColor: extraNote.tone === "warn" ? "#F2E4C6" : extraNote.tone === "bad" ? "#F3E0E0" : extraNote.tone === "good" ? "#CFE4DB" : "var(--color-border-default)"
            }}>
              {extraNote.title ? <p className="mb-1.5 text-[11.5px] font-bold" style={{ color: extraNote.tone === "warn" ? "var(--color-warning)" : extraNote.tone === "bad" ? "var(--color-danger)" : extraNote.tone === "good" ? "var(--color-success)" : "var(--color-text-secondary)" }}>{extraNote.title}</p> : null}
              <p className="text-[11px] leading-relaxed" style={{ color: extraNote.tone === "warn" ? "var(--color-warning)" : extraNote.tone === "bad" ? "var(--color-danger)" : extraNote.tone === "good" ? "var(--color-success)" : "var(--color-text-secondary)" }}>{extraNote.text}</p>
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
      const matchesStatus = status === "All statuses" || item.lifecycle === status.toUpperCase();
      return matchesSearch && matchesMarket && matchesStatus;
    });
  }, [items, search, market, status]);

  return (
    <TableCard
      title="Curriculum template library"
      description="A country/curriculum record — name, subject list, calendar convention. A template moves Draft → Validated → Active; publishing a new version retires the one before it, and a version that has been published is never edited again."
      items={filtered}
      getRowKey={(item) => item.id}
      filterBar={
        <TableFilterBar
          search={{ value: search, onChange: setSearch, placeholder: "Search a template or market" }}
          filters={[
            { label: "Market", value: market, options: markets.map((value) => ({ label: value, value })), onChange: setMarket },
            { label: "Lifecycle", value: status, options: ["All statuses", "Draft", "Validated", "Active", "Superseded", "Archived"].map((value) => ({ label: value, value })), onChange: setStatus }
          ]}
          note={`${filtered.length} of ${items.length} shown`}
        />
      }
      columns={[
        { key: "name", header: "Template", render: (item) => <div><p className="font-semibold text-[var(--color-text-primary)]">{item.name} <span className="font-normal text-[var(--color-text-muted)]">v{item.version}</span></p>{item.basedOn ? <p className="text-[11px] text-[var(--color-text-muted)]">Based on {item.basedOn}</p> : null}</div> },
        { key: "country", header: "Market", render: (item) => item.country },
        {
          key: "characteristics",
          header: "Key characteristics",
          render: (item) => (
            <span className="text-[var(--color-text-secondary)]">
              {item.subjectCount > 0 ? `${item.subjectCount} subjects` : "No subjects recorded"} · {item.calendarType.replaceAll("_", " ")}{item.language ? ` · ${item.language}` : ""}
            </span>
          )
        },
        { key: "owner", header: "Owner", render: (item) => item.owner ?? <span className="text-[var(--color-text-muted)]">—</span> },
        { key: "schools", header: "Schools", render: (item) => item.schools },
        { key: "status", header: "Lifecycle", render: (item) => <StatusBadge status={item.lifecycle} tone={LIFECYCLE_TONE[item.lifecycle] ?? "neutral"} /> },
        {
          key: "actions",
          header: "",
          sortable: false,
          render: (item) => (
            <div className="flex items-center gap-2">
              <RowReviewAction
                triggerLabel="Structure"
                avatarLabel={initialsOf(item.name)}
                eyebrow="Master template"
                title={item.name}
                subtitle={`${item.country} · v${item.version}`}
                chips={[{ label: item.lifecycle.charAt(0) + item.lifecycle.slice(1).toLowerCase(), tone: item.lifecycle === "ACTIVE" ? "good" : "mute" }, { label: `${item.schools} school${item.schools === 1 ? "" : "s"}`, tone: "mute" }]}
                factsTitle="The template"
                factsRows={[
                  { label: "Owner", value: item.owner ?? "—" },
                  { label: "Effective from", value: item.effectiveFrom ? item.effectiveFrom.slice(0, 10) : "On publishing" },
                  { label: "Validated", value: item.validatedAt ? item.validatedAt.slice(0, 10) : "Not yet" },
                  { label: "Language of instruction", value: item.language ?? "Not set" },
                  { label: "Calendar", value: item.calendarType.replaceAll("_", " ") },
                  { label: "Schools that copied it", value: String(item.schools), bold: true },
                  { label: "Subjects", value: item.subjects.join(", ") || "None" }
                ]}
                extraNote={{ tone: item.lifecycle === "DRAFT" ? "warn" : "mute", title: item.lifecycle === "DRAFT" ? "A draft" : "Read only", text: item.lifecycle === "DRAFT" ? "Edit it until it is right, then validate and publish. Validation checks it has real subjects and that its country has a profile." : "A template that has been validated or published is not edited — start a new version from its row menu." }}
                inertActions={[]}
                editTitle={item.lifecycle === "DRAFT" ? "Edit this draft" : "View only"}
                editDescription="Saves this exact name and version. Only a draft can be edited."
                endpoint="/api/super-admin/config-library/curricula"
                submitLabel="Save draft"
                editFields={[
                  { name: "name", label: "Template name", required: true, defaultValue: item.name, section: "Identity" },
                  { name: "country", label: "Country", required: true, defaultValue: item.country, section: "Identity" },
                  { name: "version", label: "Version", required: true, defaultValue: item.version, section: "Identity" },
                  { name: "calendarType", label: "Layer 1 · calendar", type: "select", options: calendarOptions, defaultValue: item.calendarType, section: "Configuration" },
                  { name: "language", label: "Language of instruction", defaultValue: item.language ?? "", section: "Configuration" },
                  { name: "effectiveFrom", label: "Effective from", type: "date", defaultValue: item.effectiveFrom?.slice(0, 10), section: "Configuration" },
                  { name: "subjects", label: "Subjects (comma-separated)", type: "textarea", parse: "csv", defaultValue: item.subjects.join(", "), section: "Configuration" }
                ]}
              />
              <ActionMenu triggerLabel={`Actions for ${item.name}`}>
                {item.lifecycle === "DRAFT" ? <ResourceActionDialog triggerLabel="Validate" title={`Validate ${item.name} v${item.version}`} description="Checks it has real subjects and that its country has a profile. A validated version can no longer be edited." endpoint={`/api/super-admin/config-library/curricula/${item.id}/validate`} method="POST" variant="menu" submitLabel="Validate" fields={[]} /> : null}
                {item.lifecycle === "VALIDATED" ? <ResourceActionDialog triggerLabel="Publish" title={`Publish ${item.name} v${item.version}`} description="Makes this the version new schools are given for its country, and supersedes the Active version of the same template." endpoint={`/api/super-admin/config-library/curricula/${item.id}/publish`} method="POST" variant="menu" submitLabel="Publish" confirmLabel="Publish" confirmMessage="Schools already set up keep the copy they took — only new setups use this version." fields={[]} /> : null}
                <ResourceActionDialog triggerLabel="New version" title={`New version of ${item.name}`} description="Copies this template as a draft you can change. Add the subject mappings from the old version to the new one once it is ready." endpoint={`/api/super-admin/config-library/curricula/${item.id}/version`} method="POST" variant="menu" submitLabel="Create draft" fields={[{ name: "version", label: "New version number", required: true, placeholder: "e.g. 2.0" }]} />
                {item.lifecycle !== "ARCHIVED" ? <ResourceActionDialog triggerLabel="Archive" title={`Archive ${item.name} v${item.version}`} description="Takes it out of use. Schools that copied it keep their copy." endpoint={`/api/super-admin/config-library/curricula/${item.id}/archive`} method="POST" variant="menuDanger" submitLabel="Archive" confirmLabel="Confirm" fields={[]} /> : null}
              </ActionMenu>
            </div>
          )
        }
      ]}
      emptyState="No curriculum templates match this filter."
      footnote={adoptionFootnote}
    />
  );
}

function formatBands(gradeBands: unknown): string {
  if (!Array.isArray(gradeBands) || gradeBands.length === 0) return "No bands defined";
  return (gradeBands as Array<{ grade?: string; min?: number; max?: number }>)
    .map((b) => `${b.grade ?? "?"} ${b.min ?? "?"}–${b.max ?? "?"}`)
    .join(" · ");
}

function bandRows(gradeBands: unknown) {
  return Array.isArray(gradeBands) ? (gradeBands as Array<{ grade?: string; min?: number; max?: number; remark?: string }>) : [];
}

/** A handful of sample scores run through the scale, so a person sees what a child would be given before it is published. */
function previewScore(bands: ReturnType<typeof bandRows>, score: number) {
  return bands.find((band) => typeof band.min === "number" && typeof band.max === "number" && score >= band.min && score <= band.max)?.grade ?? "no band";
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
      description="Bands, boundaries and a pass mark. A scale must cover 0–100 with no gap or overlap before it can be validated; a published version is never edited again. Edit: Platform Owner, Developer or Super Admin only."
      items={filtered}
      actions={actions}
      getRowKey={(item) => item.id}
      filterBar={<TableFilterBar search={{ value: search, onChange: setSearch, placeholder: "Search a scale" }} note={`${filtered.length} of ${items.length} shown`} />}
      columns={[
        { key: "name", header: "Scale", render: (item) => <span className="font-semibold text-[var(--color-text-primary)]">{item.name} <span className="font-normal text-[var(--color-text-muted)]">v{item.version}</span></span> },
        { key: "bands", header: "Bands", render: (item) => <span className="text-[var(--color-text-secondary)]">{formatBands(item.gradeBands)}</span> },
        { key: "pass", header: "Pass", render: (item) => item.passMark },
        { key: "check", header: "Check", render: (item) => (item.problems.length ? <span className="text-[11.5px] text-[var(--color-danger)]" title={item.problems.join(" ")}>{item.problems.length} problem{item.problems.length === 1 ? "" : "s"}: {item.problems[0]}</span> : <span className="text-[11.5px] font-semibold text-[var(--color-success)]">Covers 0–100</span>) },
        { key: "schools", header: "Schools", render: (item) => item.schools },
        { key: "status", header: "Lifecycle", render: (item) => <StatusBadge status={item.lifecycle} tone={LIFECYCLE_TONE[item.lifecycle] ?? "neutral"} /> },
        {
          key: "actions",
          header: "",
          sortable: false,
          render: (item) => {
            const bands = bandRows(item.gradeBands);
            const sample = [95, 78, 64, 52, 41, 35, 12];
            return (
              <div className="flex items-center gap-2">
                <RowReviewAction
                  triggerLabel="Preview"
                  avatarLabel={initialsOf(item.name)}
                  eyebrow="Grading scale"
                  title={item.name}
                  subtitle={`Version ${item.version} · pass at ${item.passMark}`}
                  chips={[{ label: item.lifecycle.charAt(0) + item.lifecycle.slice(1).toLowerCase(), tone: item.lifecycle === "ACTIVE" ? "good" : "mute" }, { label: `${item.schools} school${item.schools === 1 ? "" : "s"}`, tone: "mute" }]}
                  factsTitle="Sample scores through this scale"
                  factsRows={[
                    ...sample.map((score) => ({ label: `A child scoring ${score}`, value: `${previewScore(bands, score)}${score >= item.passMark ? " · pass" : " · below the pass mark"}`, bold: true })),
                    { label: "Applies to", value: item.applicableCurricula.join(", ") || "No curriculum named — it will not be offered to any country" }
                  ]}
                  extraNote={{ tone: item.problems.length ? "bad" : "good", title: item.problems.length ? "This scale does not check out" : "This scale checks out", text: item.problems.length ? item.problems.join(" ") : "Every score from 0 to 100 lands in exactly one band." }}
                  inertActions={[]}
                  editTitle={item.lifecycle === "DRAFT" ? "Edit this draft" : "Save as a new version"}
                  editDescription={item.lifecycle === "DRAFT" ? "Saves this exact name and version." : "Saving under a new version number creates a new draft; this version is left as it is."}
                  endpoint="/api/super-admin/config-library/grading-scales"
                  submitLabel="Save scale"
                  editFields={[
                    { name: "name", label: "Scale name", required: true, defaultValue: item.name, section: "Identity" },
                    { name: "version", label: "Version", required: true, defaultValue: item.lifecycle === "DRAFT" ? item.version : "", placeholder: "e.g. 2.0", section: "Identity" },
                    { name: "passMark", label: "Pass mark", type: "number", defaultValue: item.passMark, min: 0, max: 100, section: "Identity" },
                    { name: "applicableCurricula", label: "Applicable curricula (comma-separated names)", parse: "csv", defaultValue: item.applicableCurricula.join(", "), section: "Configuration" },
                    { name: "gradeBands", label: "Grade bands — one per line", type: "textarea", parse: "bands", required: true, defaultValue: (Array.isArray(item.gradeBands) ? (item.gradeBands as Array<{ grade: string; min: number; max: number; remark?: string }>) : []).map((band) => `${band.grade} | ${band.min}-${band.max} | ${band.remark ?? ""}`).join("\n"), note: "Write each band as: grade | from-to | remark. The bands must cover 0 to 100 with no gap or overlap before the scale can be validated.", section: "Configuration" }
                  ]}
                />
                <ActionMenu triggerLabel={`Actions for ${item.name}`}>
                  {item.lifecycle === "DRAFT" ? <ResourceActionDialog triggerLabel="Validate" title={`Validate ${item.name} v${item.version}`} description="Checks the bands cover 0–100 with no gap or overlap and the pass mark sits inside a band." endpoint={`/api/super-admin/config-library/grading-scales/${item.id}/validate`} method="POST" variant="menu" submitLabel="Validate" fields={[]} /> : null}
                  {item.lifecycle === "VALIDATED" ? <ResourceActionDialog triggerLabel="Publish" title={`Publish ${item.name} v${item.version}`} description="New schools in a country whose curriculum names this scale are given a copy. Schools already set up keep theirs." endpoint={`/api/super-admin/config-library/grading-scales/${item.id}/publish`} method="POST" variant="menu" submitLabel="Publish" confirmLabel="Publish" fields={[]} /> : null}
                  {item.lifecycle !== "ARCHIVED" ? <ResourceActionDialog triggerLabel="Archive" title={`Archive ${item.name} v${item.version}`} description="Takes it out of use. Schools that copied it keep their copy." endpoint={`/api/super-admin/config-library/grading-scales/${item.id}/archive`} method="POST" variant="menuDanger" submitLabel="Archive" confirmLabel="Confirm" fields={[]} /> : null}
                </ActionMenu>
              </div>
            );
          }
        }
      ]}
      emptyState="No grading scale templates match this filter."
      footnote={adoptionFootnote}
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
