"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";

import { DetailFacts, DetailNote, DetailSheet, SheetCard, type DetailSheetChip } from "@/components/data-display/detail-sheet";
import { TableCard } from "@/components/data-display/table-card";
import { TableFilterBar } from "@/components/data-display/table-filter-bar";
import { ResourceActionDialog } from "@/components/forms/resource-action-dialog";
import { ResourceField, ResourceForm } from "@/components/forms/resource-form";
import { CardPreview, RunPortability, SchoolsUsing, VersionHistory } from "./_library-sheets";
import { cardFields } from "./_card-form";
import { ActionMenu } from "@/components/ui/action-menu";
import { UnbuiltAction } from "@/components/ui/unbuilt-action";
import { Modal } from "@/components/ui/modal";
import type { SuperAdminConfigLibrary } from "@/lib/domain/types";

const calendarOptions = [{ label: "Three-term", value: "THREE_TERM" }, { label: "Two-semester", value: "TWO_SEMESTER" }];


function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

/** A secondary action rendered in a review sheet's footer that isn't real functionality —
 * clicking it tells the viewer plainly why, instead of doing nothing or being hidden. */
function InertFooterAction({ label, note }: { label: string; note: string }) {
  return <UnbuiltAction label={label} note={note} className={SHEET_NORMAL} />;
}


type SheetTable = { title: string; sub?: string; head: string[]; rows: string[][]; foot?: string; cols?: string };

/** Button looks inside the sheet's closing block: one dark primary, the rest outlined — the mockup's `actions` block. */
const SHEET_NORMAL = "flex-1 cursor-pointer whitespace-nowrap rounded-[10px] border border-[#DEE8E2] bg-white px-[11.5px] py-[9px] text-center text-[11.5px] font-semibold text-[#435048] transition hover:border-[#BFDCD1] hover:bg-[#EFF6F2]";
const SHEET_PRIMARY = "flex-1 cursor-pointer whitespace-nowrap rounded-[10px] bg-[#0D2315] px-[12.5px] py-[10px] text-center text-[11.5px] font-semibold text-white transition hover:bg-[#17402A]";

/** The mockup's table block inside a sheet: a title and a line of context, a hairline header, then the rows on a grid. */
function SheetTableBlock({ table }: { table: SheetTable }) {
  const cols = table.cols ?? (table.head[0] === "" ? "0.5fr 1.5fr 1.4fr" : "0.9fr 1.4fr 1.5fr");
  const grid = { display: "grid", gridTemplateColumns: cols, gap: "9px", alignItems: "start" } as const;
  return (
    <SheetCard title={table.title} sub={table.sub}>
      <div className="px-[14.5px]">
        <div style={grid} className="border-b border-[#E6EEE9] py-2">
          {table.head.map((cell, index) => <div key={index} className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-[9px] font-bold uppercase tracking-[0.05em] text-[#5f6e65]">{cell}</div>)}
        </div>
        {table.rows.map((row, index) => (
          <div key={index} style={grid} className="border-b border-[#F4F8F6] py-[9px] last:border-b-0">
            {row.map((cell, column) => {
              const lead = table.head[0] === "" ? column === 1 : column === 0;
              const dim = table.head[0] === "" ? column === 0 : column === row.length - 1 && row.length === 3 && table.head[2] === "Detail";
              return <div key={column} className={`min-w-0 text-pretty ${lead ? "text-[11.5px] font-semibold text-[#0D2315]" : dim ? "text-[11px] text-[#5f6e65]" : "text-[11.5px] text-[#435048]"}`}>{cell}</div>;
            })}
          </div>
        ))}
      </div>
      {table.foot ? <p className="text-pretty border-t border-[#EDF3EF] bg-[#F7FAF8] px-[14.5px] py-[10px] text-[10.5px] leading-[1.5] text-[#5f6e65]">{table.foot}</p> : null}
    </SheetCard>
  );
}

type PillTone = "good" | "warn" | "info" | "mute" | "bad";
const PILL: Record<PillTone, { bg: string; fg: string }> = {
  good: { bg: "#EAF6F0", fg: "#17714F" },
  warn: { bg: "#FDF6E7", fg: "#8A6410" },
  info: { bg: "#E7F1FB", fg: "#2B5F8F" },
  bad: { bg: "#FDF3F3", fg: "#B23B3B" },
  mute: { bg: "#F1F4F2", fg: "#5C6A62" }
};
function Pill({ tone, children }: { tone: PillTone; children: ReactNode }) {
  return <span className="inline-block whitespace-nowrap rounded-full px-2 py-[2.5px] text-[10px] font-bold" style={{ background: PILL[tone].bg, color: PILL[tone].fg }}>{children}</span>;
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
  table,
  inertActions,
  extraActions,
  noEdit,
  openKey,
  primaryLabel,
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
  table?: SheetTable;
  /** Real actions the sheet offers beside the edit button — each is its own dialog or sheet. */
  extraActions?: ReactNode;
  /** The record cannot be edited from here (it is no longer a draft), so there is no primary button. */
  noEdit?: boolean;
  /** Lets another cell in the same row open this sheet. */
  openKey?: string;
  primaryLabel?: string;
  inertActions: Array<{ label: string; note: string }>;
  editTitle: string;
  editDescription: string;
  endpoint: string;
  submitLabel: string;
  editFields: ResourceField[];
}) {
  const [reviewOpen, setReviewOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  // A row opens its sheet from anywhere in it — the name as well as the link at its end.
  useEffect(() => {
    const open = (event: Event) => { if ((event as CustomEvent<string>).detail === openKey) setReviewOpen(true); };
    window.addEventListener("library-open", open);
    return () => window.removeEventListener("library-open", open);
  }, [openKey]);

  return (
    <>
      <button type="button" onClick={() => setReviewOpen(true)} className="cursor-pointer text-right text-[11px] font-semibold text-[#12796A] transition hover:text-[#0A5C4E] hover:underline">
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
          <>
            {noEdit ? null : (
              <button
              type="button"
              onClick={() => {
                setReviewOpen(false);
                setEditOpen(true);
              }}
              className={SHEET_PRIMARY}
            >
              {primaryLabel ?? editTitle}
            </button>
            )}
            {extraActions}
            {inertActions.map((action) => (
              <InertFooterAction key={action.label} label={action.label} note={action.note} />
            ))}
          </>
        }
      >
        <>
          {factsRows.length ? <DetailFacts title={factsTitle} rows={factsRows} /> : null}
          {table ? <SheetTableBlock table={table} /> : null}
          {extraNote ? <DetailNote tone={extraNote.tone} title={extraNote.title} text={extraNote.text} /> : null}
        </>
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

const openRow = (id: string) => window.dispatchEvent(new CustomEvent("library-open", { detail: id }));

/** The first cell of a library row: bold, and a way into the same sheet the link at the row's end opens. */
function RowName({ id, children }: { id: string; children: ReactNode }) {
  return <button type="button" onClick={() => openRow(id)} className="cursor-pointer text-left text-[11.5px] font-semibold text-[#0D2315] transition hover:text-[#0A5C4E] hover:underline">{children}</button>;
}

const Muted = ({ children }: { children: ReactNode }) => <span className="text-pretty text-[11px] leading-[1.45] text-[#5f6e65]">{children}</span>;

type Curriculum = SuperAdminConfigLibrary["curricula"][number];

/** What the library table calls a template's standing — launch, superseded, or the phase it is planned for. */
function standing(item: Curriculum): { label: string; tone: PillTone } {
  if (item.lifecycle === "ACTIVE") return item.layers?.default ? { label: "Launch — default", tone: "good" } : { label: "Launch", tone: "good" };
  if (item.lifecycle === "SUPERSEDED") return { label: "Superseded — usable", tone: "info" };
  if (item.lifecycle === "ARCHIVED") return { label: "Archived", tone: "mute" };
  const phase = item.layers?.phase;
  if (phase) return { label: phase, tone: /3/.test(phase) ? "mute" : "warn" };
  return { label: item.lifecycle === "VALIDATED" ? "Validated" : "Draft", tone: "warn" };
}
const marketOf = (item: Curriculum) => item.layers?.market ?? item.country;

export function CurriculumTemplatesTable({ items, runs }: { items: SuperAdminConfigLibrary["curricula"]; runs: SuperAdminConfigLibrary["portabilityRuns"] }) {
  const [search, setSearch] = useState("");
  const [market, setMarket] = useState("All markets");
  const [status, setStatus] = useState("All statuses");

  const markets = useMemo(() => ["All markets", ...Array.from(new Set(items.map(marketOf)))], [items]);
  const statuses = useMemo(() => ["All statuses", ...Array.from(new Set(items.map((item) => standing(item).label)))], [items]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return [...items].sort((a, b) => (a.layers?.order ?? 99) - (b.layers?.order ?? 99) || a.name.localeCompare(b.name)).filter((item) => {
      const matchesSearch = !q || item.name.toLowerCase().includes(q) || marketOf(item).toLowerCase().includes(q);
      const matchesMarket = market === "All markets" || marketOf(item) === market;
      const matchesStatus = status === "All statuses" || standing(item).label === status;
      return matchesSearch && matchesMarket && matchesStatus;
    });
  }, [items, search, market, status]);

  return (
    <TableCard
      title="Curriculum template library"
      description="Schools select a Layer 1 template at signup — layers 2 to 6 are pre-populated from it and can each be replaced independently. Open any template to read its six-layer structure."
      items={filtered}
      getRowKey={(item) => item.id}
      pageSize={false}
      filterBar={
        <TableFilterBar
          search={{ value: search, onChange: setSearch, placeholder: "Search a template or market" }}
          filters={[
            { label: "Market", value: market, options: markets.map((value) => ({ label: value, value })), onChange: setMarket },
            { label: "Status", value: status, options: statuses.map((value) => ({ label: value, value })), onChange: setStatus }
          ]}
        />
      }
      columns={[
        { key: "name", header: "Template", render: (item) => <RowName id={item.id}>{item.name}</RowName> },
        { key: "market", header: "Market", render: marketOf },
        { key: "characteristics", header: "Key characteristics", render: (item) => <Muted>{item.layers?.characteristics ?? `${item.subjectCount > 0 ? `${item.subjectCount} subjects` : "No subjects recorded"} · ${item.calendarType.replaceAll("_", " ").toLowerCase()}`}</Muted> },
        { key: "schools", header: "Schools", render: (item) => (item.schools > 0 ? item.schools : "—") },
        { key: "status", header: "Status", render: (item) => { const state = standing(item); return <Pill tone={state.tone}>{state.label}</Pill>; } },
        {
          key: "actions",
          header: "",
          sortable: false,
          render: (item) => {
            const state = standing(item);
            const run = runs.find((entry) => entry.kind === "CURRICULUM" && entry.targetId === item.id) ?? null;
            return (
            <div className="flex items-center justify-end gap-3">
              <RowReviewAction
                triggerLabel="Structure"
                openKey={item.id}
                avatarLabel={initialsOf(item.name)}
                eyebrow="Master template"
                title={item.name}
                subtitle={`${marketOf(item)} · ${item.layers?.structure ? `v${item.version}${item.effectiveFrom ? ` · effective ${item.effectiveFrom.slice(0, 10)}` : ""}${item.effectiveTo ? ` to ${item.effectiveTo.slice(0, 10)}` : ""}` : "not yet authored"}`}
                chips={[{ label: state.label, tone: state.tone === "info" ? "mute" : state.tone }, { label: item.schools > 0 ? `${item.schools} school${item.schools === 1 ? "" : "s"}` : "No schools yet", tone: "mute" }]}
                factsTitle=""
                factsRows={[]}
                table={item.layers?.structure ? {
                  title: "The six layers",
                  sub: "A school selects Layer 1 at signup; layers 2 to 6 arrive pre-populated and can each be replaced independently.",
                  head: ["Layer", "What it holds", "Detail"],
                  rows: item.layers.structure.map((row) => [row.layer, row.holds, row.detail]),
                  foot: "FutureRealm owns this master. The copy a school customises belongs to that school, and we never edit that copy."
                } : undefined}
                extraNote={run ? {
                  tone: run.passed ? "good" : "bad",
                  title: "Portability",
                  text: run.passed
                    ? `All eight portability tests passed when last run on ${run.ranAt.slice(0, 10)}${run.results.some((result) => result.state === "PARTIAL") ? `; ${run.results.filter((result) => result.state === "PARTIAL").map((result) => `${result.test} is partial — ${result.note}`).join(" ")}` : "."} A template that fails any one of them cannot be published — the gate is technical, not procedural.`
                    : `Failed on ${run.ranAt.slice(0, 10)}: ${run.results.filter((result) => result.state === "FAIL").map((result) => `${result.test} — ${result.note}`).join(" ")} It cannot be published until these are fixed.`
                } : item.layers?.structure
                  ? { tone: "mute", title: "Portability", text: "The eight portability tests have not been run against this template yet. They run when it is validated, and can be run from here at any time." }
                  : { tone: "warn", title: "Not yet authored", text: "This template is a configuration record rather than a build. Its six layers are specified but not yet populated, so no school can select it. It becomes selectable the moment the layers are authored and the eight portability tests pass." }}
                noEdit={item.lifecycle !== "DRAFT"}
                primaryLabel={item.layers?.structure ? "Open the layer workspace" : "Start authoring the layers"}
                extraActions={<><RunPortability id={item.id} label="Run the portability tests" /><VersionHistory id={item.id} name={item.name} /></>}
                inertActions={[]}
                editTitle="Layer workspace"
                editDescription="Describe each of the six layers as a school will read it, and the line the library shows. Only a draft can be edited — a published version is never edited in place."
                endpoint={`/api/super-admin/config-library/curricula/${item.id}/layers`}
                submitLabel="Save the layers"
                editFields={[
                  { name: "characteristics", label: "Key characteristics (the library line)", type: "textarea", defaultValue: item.layers?.characteristics ?? "", section: "The library line" },
                  ...[1, 2, 3, 4, 5, 6].flatMap((n) => {
                    const row = item.layers?.structure?.[n - 1];
                    const name = ["Calendar", "Levels and classes", "Subjects", "Assessment", "Grading", "Report card"][n - 1];
                    return [
                      { name: `holds${n}`, label: `${n} · ${name} — what it holds`, required: true, defaultValue: row?.holds ?? "", section: `Layer ${n} · ${name}` },
                      { name: `detail${n}`, label: `${n} · ${name} — detail`, defaultValue: row?.detail ?? "", section: `Layer ${n} · ${name}` }
                    ];
                  })
                ]}
              />
              <ActionMenu compact triggerLabel={`Actions for ${item.name}`}>
                {item.lifecycle === "DRAFT" ? <ResourceActionDialog triggerLabel="Edit details" title={`Edit ${item.name} v${item.version}`} description="Saves this exact name and version. Only a draft can be edited." endpoint="/api/super-admin/config-library/curricula" variant="menu" submitLabel="Save draft" fields={[
                  { name: "name", label: "Template name", required: true, defaultValue: item.name, section: "Identity" },
                  { name: "country", label: "Country", required: true, defaultValue: item.country, section: "Identity" },
                  { name: "version", label: "Version", required: true, defaultValue: item.version, section: "Identity" },
                  { name: "calendarType", label: "Layer 1 · calendar", type: "select", options: calendarOptions, defaultValue: item.calendarType, section: "Configuration" },
                  { name: "language", label: "Language of instruction", defaultValue: item.language ?? "", section: "Configuration" },
                  { name: "effectiveFrom", label: "Effective from", type: "date", defaultValue: item.effectiveFrom?.slice(0, 10), section: "Configuration" },
                  { name: "subjects", label: "Subjects (comma-separated)", type: "textarea", parse: "csv", defaultValue: item.subjects.join(", "), section: "Configuration" }
                ]} /> : null}

                {item.lifecycle === "DRAFT" ? <ResourceActionDialog triggerLabel="Validate" title={`Validate ${item.name} v${item.version}`} description="Checks it has real subjects and that its country has a profile. A validated version can no longer be edited." endpoint={`/api/super-admin/config-library/curricula/${item.id}/validate`} method="POST" variant="menu" submitLabel="Validate" fields={[]} /> : null}
                {item.lifecycle === "VALIDATED" ? <ResourceActionDialog triggerLabel="Publish" title={`Publish ${item.name} v${item.version}`} description="Makes this the version new schools are given for its country, and supersedes the Active version of the same template." endpoint={`/api/super-admin/config-library/curricula/${item.id}/publish`} method="POST" variant="menu" submitLabel="Publish" confirmLabel="Publish" confirmMessage="Schools already set up keep the copy they took — only new setups use this version." fields={[]} /> : null}
                <ResourceActionDialog triggerLabel="New version" title={`New version of ${item.name}`} description="Copies this template as a draft you can change. Add the subject mappings from the old version to the new one once it is ready." endpoint={`/api/super-admin/config-library/curricula/${item.id}/version`} method="POST" variant="menu" submitLabel="Create draft" fields={[{ name: "version", label: "New version number", required: true, placeholder: "e.g. 2.0" }]} />
                {item.lifecycle !== "ARCHIVED" ? <ResourceActionDialog triggerLabel="Archive" title={`Archive ${item.name} v${item.version}`} description="Takes it out of use. Schools that copied it keep their copy." endpoint={`/api/super-admin/config-library/curricula/${item.id}/archive`} method="POST" variant="menuDanger" submitLabel="Archive" confirmLabel="Confirm" fields={[]} /> : null}
              </ActionMenu>
            </div>
            );
          }
        }
      ]}
      emptyState="No curriculum templates match this filter."
      footnote="Master templates are owned by FutureRealm; the copy a school customises is owned by that school."
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


export function GradingScalesTable({ items, actions }: { items: SuperAdminConfigLibrary["gradingScales"]; actions: ReactNode }) {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((item) => !q || item.name.toLowerCase().includes(q));
  }, [items, search]);

  const isDefault = (item: (typeof items)[number]) => item.lifecycle === "ACTIVE" && item.isDefault;
  const thresholdOf = (item: (typeof items)[number], grade: string | null) => {
    const band = bandRows(item.gradeBands).find((entry) => entry.grade === grade);
    return band && typeof band.min === "number" ? `${band.grade} — ${band.min}` : "—";
  };
  const standingOf = (item: (typeof items)[number]): { label: string; tone: PillTone } =>
    isDefault(item) ? { label: "Default · live", tone: "good" } : item.lifecycle === "ACTIVE" ? { label: "Live", tone: "good" } : item.lifecycle === "DRAFT" ? { label: "Draft", tone: "warn" } : { label: item.lifecycle.charAt(0) + item.lifecycle.slice(1).toLowerCase(), tone: "mute" };

  return (
    <TableCard
      title="Grading scale template library"
      description="What a school sees at setup, and what it can change afterwards. Open a scale to edit its bands or to make it the default — boundaries must stay contiguous, because a gap between 74 and 75 leaves a score with no band."
      meta="Edit a scale or change the default: Product Lead and Super Admin only"
      items={filtered}
      actions={actions}
      pageSize={false}
      getRowKey={(item) => item.id}
      filterBar={<TableFilterBar search={{ value: search, onChange: setSearch, placeholder: "Search a scale" }} />}
      columns={[
        { key: "name", header: "Scale", render: (item) => <RowName id={item.id}>{item.name}</RowName> },
        { key: "bands", header: "Bands", render: (item) => <Muted>{formatBands(item.gradeBands)}</Muted> },
        { key: "pass", header: "Pass", render: (item) => item.passMark },
        { key: "credit", header: "Credit threshold", render: (item) => { const credit = thresholdOf(item, item.creditGrade); return credit === "—" ? "—" : <Pill tone="good">{credit}</Pill>; } },
        { key: "schools", header: "Schools", render: (item) => (item.schools > 0 ? item.schools : "—") },
        { key: "status", header: "Status", render: (item) => { const state = standingOf(item); return <Pill tone={state.tone}>{state.label}</Pill>; } },
        {
          key: "actions",
          header: "",
          sortable: false,
          render: (item) => {
            const credit = thresholdOf(item, item.creditGrade);
            return (
              <div className="flex items-center justify-end gap-3">
                <RowReviewAction
                  triggerLabel="Edit"
                  openKey={item.id}
                  avatarLabel={initialsOf(item.name)}
                  eyebrow="Grading scale"
                  title={item.name}
                  subtitle={item.schools > 0 ? `${item.schools} school${item.schools === 1 ? "" : "s"} use this scale` : "Not yet in use"}
                  chips={[{ label: isDefault(item) ? "Default for new schools" : "Available, not default", tone: isDefault(item) ? "teal" : "mute" }, { label: `Pass at ${item.passMark}`, tone: "mute" }]}
                  factsTitle="The scale"
                  factsRows={[
                    { label: "Bands", value: formatBands(item.gradeBands) },
                    { label: "Pass mark", value: String(item.passMark), bold: true },
                    { label: "Scale type", value: ({ PERCENTAGE: "Percentage bands", LETTER: "Letter grade", POINTS: "Grade point", DESCRIPTIVE: "Descriptive band only" } as Record<string, string>)[item.scaleType] ?? item.scaleType },
                    { label: "Credit threshold", value: credit },
                    { label: "Distinction threshold", value: thresholdOf(item, item.distinctionGrade) },
                    { label: "Failing band", value: item.failingGrade ?? "—" },
                    { label: "Schools using it", value: item.schools > 0 ? String(item.schools) : "—" },
                    { label: "Shown by default", value: isDefault(item) ? "Yes — pre-selected at setup" : "No — offered as an alternative" },
                    ...(item.problems.length ? [{ label: "Check", value: item.problems.join(" "), bold: true }] : [])
                  ]}
                  extraNote={{ tone: "warn", title: "Why editing this is consequential", text: "Band boundaries must stay contiguous. A gap between 74 and 75 leaves a score with no band, and results become uncomputable for every school on this scale. The system refuses to save a scale with a gap or an overlap — but it cannot refuse a boundary that is legal and wrong." }}
                  primaryLabel="Edit this scale"
                  inertActions={[]}
                  extraActions={
                    <>
                      {isDefault(item) || item.lifecycle !== "ACTIVE" ? null : (
                        <ResourceActionDialog triggerLabel="Make this the default" title="Change the default grading scale" description={`Every school created from now on is pre-selected onto ${item.name}. Existing schools are untouched — their scale is their own.`} endpoint={`/api/super-admin/config-library/grading-scales/${item.id}/default`} variant="secondary" submitLabel="Make it the default" fields={[]} impact={{ label: "On saving", rows: [["New schools only", "Schools already set up keep the scale they are on"], ["Results already published", "Never recomputed. A grade a parent has seen does not change underneath them."]] }} />
                      )}
                      <ResourceActionDialog triggerLabel="Duplicate as a custom scale" title={`Duplicate ${item.name}`} description="Copies the bands as a separate draft you can change. The original is left exactly as it is." endpoint={`/api/super-admin/config-library/grading-scales/${item.id}/duplicate`} variant="secondary" submitLabel="Duplicate" fields={[]} />
                      <SchoolsUsing path={`/grading-scales/${item.id}/schools`} title={item.name} label="See the schools using it" />
                    </>
                  }
                  editTitle={item.lifecycle === "DRAFT" ? "Edit this draft" : "Save as a new version"}
                  editDescription={item.lifecycle === "DRAFT" ? "Saves this exact name and version." : "Saving under a new version number creates a new draft; this version is left as it is."}
                  endpoint="/api/super-admin/config-library/grading-scales"
                  submitLabel="Save scale"
                  editFields={[
                    { name: "name", label: "Scale name", required: true, defaultValue: item.name, section: "Identity" },
                    { name: "version", label: "Version", defaultValue: item.lifecycle === "DRAFT" ? item.version : "", placeholder: `Blank takes the next version — v${item.version} becomes v${Math.floor(Number.parseFloat(item.version) || 0) + 1}`, section: "Identity" },
                    { name: "scaleType", label: "Scale type", type: "select", defaultValue: item.scaleType, options: [{ label: "Percentage bands", value: "PERCENTAGE" }, { label: "Letter grade", value: "LETTER" }, { label: "Grade point", value: "POINTS" }, { label: "Descriptive band only", value: "DESCRIPTIVE" }], note: "Percentage bands, letter grade, grade point, or descriptive band only", section: "Identity" },
                    { name: "creditGrade", label: "Credit threshold (band)", defaultValue: item.creditGrade ?? "", note: "What a school reports as a credit pass on a leaving certificate", section: "Thresholds" },
                    { name: "distinctionGrade", label: "Distinction threshold (band)", defaultValue: item.distinctionGrade ?? "", section: "Thresholds" },
                    { name: "failingGrade", label: "Failing band", defaultValue: item.failingGrade ?? "", section: "Thresholds" },
                    { name: "passMark", label: "Pass mark", type: "number", defaultValue: item.passMark, min: 0, max: 100, section: "Identity" },
                    { name: "applicableCurricula", label: "Applicable curricula (comma-separated names)", parse: "csv", defaultValue: item.applicableCurricula.join(", "), section: "Configuration" },
                    { name: "gradeBands", label: "Grade bands — one per line", type: "textarea", parse: "bands", required: true, defaultValue: (Array.isArray(item.gradeBands) ? (item.gradeBands as Array<{ grade: string; min: number; max: number; remark?: string }>) : []).map((band) => `${band.grade} | ${band.min}-${band.max} | ${band.remark ?? ""}`).join("\n"), note: "Write each band as: grade | from-to | remark. The bands must cover 0 to 100 with no gap or overlap before the scale can be validated.", section: "Configuration" }
                  ]}
                />
                <ActionMenu compact triggerLabel={`Actions for ${item.name}`}>
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
      footnote="A school may create a custom scale where no template fits, but templates are offered first during setup so that most schools never have to."
    />
  );
}

/** Who a layout is open to, as the library says it. */
function availableTo(tiers: string[]): string {
  if (tiers.length === 0 || tiers.length >= 3) return "All tiers";
  return `${tiers.map((tier) => tier.charAt(0) + tier.slice(1).toLowerCase()).join(", ")} only`;
}

/** The sections a card prints, in order, and what each shows — read off the layout's own rules. */
function printOrder(rules: string): string[][] {
  const noRanking = /no position|no class average/i.test(rules);
  return [
    ["1", "School header", `Name, address, term and session${/logo/.test(rules) ? ", school logo and brand colours" : ""}`],
    ["2", "Pupil identity", "Name, class and arm, admission number, days present of days open"],
    ["3", "Subject table", `Each component score, term total, grade, teacher remark${noRanking ? " — no class average or position" : ", class or arm average and subject position"}`],
    ["4", "Cumulative column", /Term 2/.test(rules) ? "Appears from Term 2, carrying earlier terms forward" : "Not shown on this layout"],
    ["5", "Behavioural domains", /behavioural/.test(rules) ? "Five-point scale across the school’s chosen domains" : /Effort/.test(rules) ? "Effort and attainment shown separately per subject" : "Not shown on this layout"],
    ["6", "Comments", "Class teacher and principal, drawn from the school’s editable comment bank"],
    ["7", "Closing block", `Next term begins on${/fee balance/.test(rules) ? ", fee balance where the school chooses it" : ""}, signature blocks`]
  ];
}

const CARD_STATE: Record<string, { label: string; tone: PillTone }> = { LIVE: { label: "Live", tone: "good" }, IN_REVIEW: { label: "In review", tone: "info" }, DRAFT: { label: "Draft", tone: "warn" } };

export function ReportCardsTable({ items, actions }: { items: SuperAdminConfigLibrary["reportCards"]; actions: ReactNode }) {
  const [search, setSearch] = useState("");
  const [availability, setAvailability] = useState("All tiers");
  const [status, setStatus] = useState("All statuses");

  const tiers = useMemo(() => ["All tiers", ...Array.from(new Set(items.map((item) => availableTo(item.availableToTiers)))).filter((value) => value !== "All tiers")], [items]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((item) => {
      const matchesSearch = !q || item.name.toLowerCase().includes(q) || item.bestFor.toLowerCase().includes(q);
      const matchesAvailability = availability === "All tiers" || availableTo(item.availableToTiers) === availability;
      const matchesStatus = status === "All statuses" || (CARD_STATE[item.status]?.label ?? item.status) === status;
      return matchesSearch && matchesAvailability && matchesStatus;
    });
  }, [items, search, availability, status]);

  return (
    <TableCard
      title="Report card layout library — Layer 6"
      description="Every layout a school can be given. Open one to review it section by section before it reaches a parent, or add a new one."
      meta="Add or publish a layout: Product Lead and Super Admin only"
      items={filtered}
      actions={actions}
      pageSize={false}
      getRowKey={(item) => item.id}
      filterBar={
        <TableFilterBar
          search={{ value: search, onChange: setSearch, placeholder: "Search a layout" }}
          filters={[
            { label: "Availability", value: availability, options: tiers.map((value) => ({ label: value, value })), onChange: setAvailability },
            { label: "Status", value: status, options: ["All statuses", "Live", "In review", "Draft"].map((value) => ({ label: value, value })), onChange: setStatus }
          ]}
        />
      }
      columns={[
        { key: "name", header: "Layout", render: (item) => <RowName id={item.id}>{item.name}</RowName> },
        { key: "bestFor", header: "Best for", render: (item) => <Muted>{item.bestFor || "—"}</Muted> },
        { key: "tiers", header: "Available to", render: (item) => availableTo(item.availableToTiers) },
        { key: "schools", header: "Schools", render: (item) => (item.schools > 0 ? item.schools : "—") },
        { key: "status", header: "Status", render: (item) => { const state = CARD_STATE[item.status] ?? { label: item.status, tone: "mute" as PillTone }; return <Pill tone={state.tone}>{state.label}</Pill>; } },
        {
          key: "actions",
          header: "",
          sortable: false,
          render: (item) => {
            const state = CARD_STATE[item.status] ?? { label: item.status, tone: "mute" as PillTone };
            const findings = item.portability?.results ?? [];
            return (
              <RowReviewAction
                triggerLabel="Review"
                openKey={item.id}
                avatarLabel={initialsOf(item.name)}
                eyebrow="Report card layout · Layer 6"
                title={item.name}
                subtitle={item.bestFor ? `Best for ${item.bestFor.charAt(0).toLowerCase()}${item.bestFor.slice(1)}` : undefined}
                chips={[
                  { label: state.label, tone: state.tone === "info" ? "mute" : state.tone },
                  { label: availableTo(item.availableToTiers), tone: "mute" },
                  { label: item.schools > 0 ? `${item.schools} school${item.schools === 1 ? "" : "s"}` : "No schools yet", tone: "mute" }
                ]}
                factsTitle="How this layout behaves"
                factsRows={[
                  { label: "Available to", value: availableTo(item.availableToTiers) },
                  { label: "Schools using it", value: item.schools > 0 ? String(item.schools) : "—" },
                  { label: "Distinguishing rules", value: item.layout || "Not set", bold: true },
                  ...(item.author ? [{ label: "Author", value: item.author }] : []),
                  ...(item.reviewer ? [{ label: "Published by", value: `${item.reviewer}${item.reviewedAt ? ` · ${item.reviewedAt.slice(0, 10)}` : ""}` }] : []),
                  ...(item.targetRelease ? [{ label: "Target release", value: item.targetRelease }] : []),
                  ...(item.reviewNotes ? [{ label: "Reviewer’s notes", value: item.reviewNotes }] : []),
                  ...(findings.length ? [{ label: "Layer 6 tests", value: findings.map((result) => `${result.test} ${result.state.toLowerCase()}`).join(" · "), bold: true }] : [])
                ]}
                table={{
                  title: "Sections, in print order",
                  sub: "What a parent actually holds. Reviewing a layout means reading this list against a real card.",
                  head: ["", "Section", "What it shows"],
                  rows: printOrder(item.layout),
                  foot: "A layout is reviewed with sample data before release, and again with one real class before it is offered to any school."
                }}
                extraNote={item.status === "LIVE" ? undefined : item.status === "IN_REVIEW"
                  ? { tone: "warn", text: "This layout is waiting for a second person. The author cannot publish it; whoever approves it has read the sample card and the Layer 6 test results above." }
                  : { tone: "warn", text: "This layout is a draft. It cannot be assigned to a school until it has been previewed with real data, reviewed by a second person, and passed the portability tests that apply to Layer 6." }}
                noEdit={item.status !== "DRAFT"}
                primaryLabel="Edit this layout"
                extraActions={
                  <>
                    <CardPreview id={item.id} name={item.name} />
                    {item.status === "DRAFT" ? (
                      <ResourceActionDialog triggerLabel="Send for review" title={`Send ${item.name} for review`} description="The Layer 6 portability tests run first; a failure stops it here. Then a second person reads the sample card and publishes it, or sends it back." endpoint={`/api/super-admin/config-library/report-card-layouts/${item.id}/submit`} variant="secondary" submitLabel="Send for review" fields={[{ name: "notes", label: "Notes for the reviewer", type: "textarea", placeholder: "What to look at first, and what you are unsure about" }]} />
                    ) : null}
                    {item.status === "IN_REVIEW" ? (
                      <>
                        <ResourceActionDialog triggerLabel="Approve and publish" title={`Publish ${item.name}`} description="It becomes available to schools in the availability band chosen. Nobody publishes their own layout." endpoint={`/api/super-admin/config-library/report-card-layouts/${item.id}/approve`} variant="secondary" submitLabel="Publish" fields={[]} impact={{ label: "On publishing", rows: [["Offered at setup", "To every new school in the availability band chosen"], ["Schools already set up", "Keep the layout they have"]] }} />
                        <ResourceActionDialog triggerLabel="Send back" title={`Send ${item.name} back`} description="It returns to its author as a draft with your note." endpoint={`/api/super-admin/config-library/report-card-layouts/${item.id}/return`} variant="secondary" submitLabel="Send back" fields={[{ name: "notes", label: "What needs to change", type: "textarea", required: true }]} />
                      </>
                    ) : null}
                    <ResourceActionDialog triggerLabel={item.status === "LIVE" ? "Duplicate as a new draft" : "Duplicate"} title={`Duplicate ${item.name}`} description="Copies the sections and rules as a new draft you can change. The original is left as it is." endpoint={`/api/super-admin/config-library/report-card-layouts/${item.id}/duplicate`} variant="secondary" submitLabel="Duplicate" fields={[]} />
                    <SchoolsUsing path={`/report-card-layouts/${item.id}/schools`} title={item.name} />
                  </>
                }
                inertActions={[]}
                editTitle="Edit this layout"
                editDescription="Saves this draft. A live layout cannot be edited — duplicate it and change the copy."
                endpoint="/api/super-admin/config-library/report-card-layouts"
                submitLabel="Save as draft"
                editFields={cardFields(items, item)}
              />
            );
          }
        }
      ]}
      emptyState="No report card templates match this filter."
      footnote="Nigerian template sections: subject table with each component score, term total, grade, class or arm average, subject position and teacher remark; cumulative column on second and third term; attendance summary; behavioural domains on a five-point scale; class teacher and principal comments drawn from an editable bank; next term begins on; fee balance where the school chooses; signature blocks."
    />
  );
}
