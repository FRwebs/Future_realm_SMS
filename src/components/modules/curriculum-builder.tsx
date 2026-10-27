"use client";

import Link from "next/link";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { Field, initialValue } from "@/components/modules/field";
import { ModuleDrawer } from "@/components/modules/module-drawer";
import {
  BAND_PRESETS,
  BUILDER_SECTIONS,
  COMPONENT_PRESETS,
  DEFAULT_BANDS,
  DEFAULT_COMPONENTS,
  checkBands,
  type BandRow,
  type BuilderSection,
  type ComponentRow,
} from "@/lib/modules/curriculum-build";
import type { DrawerSpec, PanelTone } from "@/lib/modules/panels";
import { sendJson } from "@/lib/modules/submit";
import { toneSwatches } from "@/lib/modules/tones";
import { cn } from "@/lib/utils/cn";

const CARD = "min-w-0 rounded-[14px] border border-[#DEE8E2] bg-(--color-bg-surface)";

/** A number out of whatever was typed, never negative and never NaN. */
function num(value: unknown): number {
  const parsed = parseFloat(String(value ?? "").replace(/[^\d.]/g, ""));
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
}

function Tag({ label, tone }: { label: string; tone: PanelTone }) {
  const swatch = toneSwatches[tone];
  return (
    <span
      className="inline-flex flex-none items-center gap-[5px] whitespace-nowrap rounded-full border px-[8px] py-[3px] text-[9.5px] font-bold uppercase tracking-[0.07em]"
      style={{ background: swatch.bg, color: swatch.fg, borderColor: swatch.bd }}
    >
      <span className="h-[4px] w-[4px] rounded-full" style={{ background: swatch.dot }} />
      {label}
    </span>
  );
}

function Button({
  label,
  onClick,
  primary,
  disabled,
}: {
  label: string;
  onClick: () => void;
  primary?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "inline-flex flex-none items-center whitespace-nowrap rounded-full px-[13px] py-[8px] text-[11px] font-semibold transition disabled:cursor-not-allowed disabled:opacity-50",
        primary
          ? "bg-[#0D2315] text-white hover:bg-[#173824]"
          : "border border-[#DEE8E2] bg-white text-[#435048] hover:border-[#BFDCD1] hover:bg-[#F1F8F4]",
      )}
    >
      {label}
    </button>
  );
}

/** The left rail: the seven sections, which is done, and how far along you are. */
function Rail({
  sections,
  step,
  go,
  pct,
  doneCount,
}: {
  sections: Array<{ label: string; sub: string; done: boolean }>;
  step: number;
  go: (next: number) => void;
  pct: number;
  doneCount: number;
}) {
  return (
    <aside className={cn(CARD, "h-fit px-[14px] py-[14px]")}>
      <div className="mb-[11px]">
        <div className="mb-[6px] flex items-baseline justify-between gap-2">
          <span className="text-[10px] font-bold uppercase tracking-widest text-[#67766D]">Progress</span>
          <span className="text-[10.5px] font-semibold text-[#0D2315]">{doneCount} of 7 done</span>
        </div>
        <div className="h-[5px] w-full overflow-hidden rounded-full bg-[#EDF3EF]">
          <div
            className="h-full rounded-full bg-[#12796A] transition-[width] duration-300"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      <ol className="grid gap-[3px]">
        {sections.map((section, index) => {
          const on = index === step;
          return (
            <li key={section.label}>
              <button
                type="button"
                onClick={() => go(index)}
                className={cn(
                  "flex w-full items-start gap-[9px] rounded-[10px] px-[9px] py-[8px] text-left transition",
                  on ? "bg-[#F1F8F4]" : "hover:bg-[#F7FAF8]",
                )}
              >
                <span
                  className={cn(
                    "mt-px flex h-[17px] w-[17px] flex-none items-center justify-center rounded-full border text-[9.5px] font-bold",
                    section.done
                      ? "border-[#22A06B] bg-[#22A06B] text-white"
                      : on
                        ? "border-[#12796A] text-[#12796A]"
                        : "border-[#DEE8E2] text-[#9FB8A7]",
                  )}
                >
                  {section.done ? "✓" : index + 1}
                </span>
                <span className="min-w-0">
                  <span
                    className={cn(
                      "block text-[11.5px] font-semibold leading-[1.3]",
                      on ? "text-[#0D2315]" : "text-[#435048]",
                    )}
                  >
                    {section.label}
                  </span>
                  <span className="mt-[2px] block text-pretty text-[10px] leading-[1.4] text-[#67766D]">
                    {section.sub}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </aside>
  );
}

/** The bar under a grid that says whether what you have typed adds up. */
function Meter({ pct, tone, label, note }: { pct: number; tone: PanelTone; label: string; note: string }) {
  const swatch = toneSwatches[tone];
  return (
    <div className="mt-[13px] rounded-[11px] border px-[13px] py-[11px]" style={{ background: swatch.bg, borderColor: swatch.bd }}>
      <div className="mb-[7px] flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <span className="text-[11.5px] font-bold" style={{ color: swatch.fg }}>
          {label}
        </span>
        <span className="text-[10.5px] leading-[1.45] text-[#435048]">{note}</span>
      </div>
      <div className="h-[5px] w-full overflow-hidden rounded-full bg-white/70">
        <div
          className="h-full rounded-full transition-[width] duration-300"
          style={{ width: `${Math.min(100, pct)}%`, background: swatch.dot }}
        />
      </div>
    </div>
  );
}

const CELL =
  "w-full min-w-0 rounded-[8px] border-[1.5px] bg-white px-[9px] py-[7px] text-[11.5px] font-medium text-[#0D2315] outline-hidden focus:border-[#12796A]";

function GridCell({
  value,
  onChange,
  placeholder,
  bold,
  bad,
  right,
}: {
  value: string | number;
  onChange: (next: string) => void;
  placeholder?: string;
  bold?: boolean;
  bad?: boolean;
  right?: boolean;
}) {
  return (
    <input
      value={String(value)}
      placeholder={placeholder}
      onChange={(event) => onChange(event.target.value)}
      className={cn(CELL, bold && "font-semibold", right && "text-right")}
      style={{ borderColor: bad ? "#E4B9B9" : "#E4EDE8" }}
    />
  );
}

function PresetRow({
  label,
  presets,
}: {
  label: string;
  presets: Array<{ label: string; on: boolean; onClick: () => void }>;
}) {
  return (
    <div className="mb-[13px]">
      <div className="mb-[7px] text-[10px] font-semibold text-[#67766D]">{label}</div>
      <div className="flex flex-wrap gap-[6px]">
        {presets.map((preset) => (
          <button
            key={preset.label}
            type="button"
            onClick={preset.onClick}
            className={cn(
              "rounded-full border px-[11px] py-[6px] text-[10.5px] font-semibold transition",
              preset.on
                ? "border-[#12796A] bg-[#EAF6F0] text-[#12796A]"
                : "border-[#DEE8E2] bg-white text-[#435048] hover:border-[#BFDCD1] hover:bg-[#F1F8F4]",
            )}
          >
            {preset.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function RemoveButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Remove this row"
      className="flex h-[26px] w-[26px] flex-none items-center justify-center rounded-[8px] border border-[#DEE8E2] bg-white text-[#8B9A91] transition hover:border-[#E4B9B9] hover:bg-[#FBF2F2] hover:text-[#B23B3B]"
    >
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
        <path d="M6 6l12 12M18 6 6 18" />
      </svg>
    </button>
  );
}

const ARROW = "M5 12h13M13 6.5l5.5 5.5L13 17.5";
const TICK = "M5 12.5l4.5 4.5 9-10";

/**
 * The builder's own ink header.
 *
 * Every other tab gets this from ModuleWorkspace, but that takes its actions as
 * data — an href or a drawer — and the builder's primary changes with the step
 * it is on ("Next · Grading", then "Create curriculum"). A stateful action
 * cannot travel as data, so the header is rendered here instead.
 */
function BuilderHead({
  tag,
  primaryLabel,
  primaryIcon,
  onPrimary,
  backLabel,
  onBack,
  backHref,
}: {
  tag: string;
  primaryLabel: string;
  primaryIcon: string;
  onPrimary: () => void;
  backLabel?: string;
  onBack?: () => void;
  backHref: string;
}) {
  const pill =
    "inline-flex flex-none items-center gap-[6px] whitespace-nowrap rounded-full border border-white/18 bg-white/10 px-[12px] py-[7px] text-[11px] font-semibold text-white transition hover:bg-white/20";

  return (
    <section className="relative overflow-hidden rounded-[15px] bg-[#0D2315] px-[19px] py-[15px] shadow-[0_14px_30px_-24px_rgba(13,35,21,0.8)]">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute right-[-80px] top-[-132px] h-[336px] w-[336px] rounded-full border border-[rgba(95,214,180,0.12)]" />
        <div className="absolute right-[-18px] top-[-70px] h-[212px] w-[212px] rounded-full border border-[rgba(95,214,180,0.08)]" />
      </div>
      <div className="relative flex flex-wrap items-center justify-between gap-x-5 gap-y-2.5">
        <div className="min-w-0 max-w-[620px]">
          <div className="mb-[5px] flex flex-wrap items-center gap-[7px]">
            <span className="h-[4.5px] w-[4.5px] flex-none rounded-full bg-[#5FD6B4]" />
            <span className="whitespace-nowrap text-[9px] font-bold uppercase tracking-[0.14em] text-white/50">
              School Configuration
            </span>
            <span className="rounded-full border border-white/18 bg-white/10 px-[8px] py-[2px] text-[9px] font-bold uppercase tracking-[0.08em] text-white/70">
              {tag}
            </span>
          </div>
          <h1 className="text-pretty font-(family-name:--font-heading) text-[19px] font-extrabold leading-[1.15] tracking-[-0.024em] text-white">
            Build a curriculum
          </h1>
          <p className="mt-1 max-w-[560px] text-pretty text-[11px] leading-[1.45] text-white/60">
            Seven sections, one at a time. Nothing is in force until you say so.
          </p>
        </div>
        <div className="flex min-w-0 flex-[0_1_auto] flex-wrap items-center justify-end gap-2">
          <Link href={backHref as Route<string>} className={pill}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M19 12H6M11 5.5 5.5 12l5.5 6.5" />
            </svg>
            <span>Back to all curricula</span>
          </Link>
          {backLabel && onBack ? (
            <button type="button" onClick={onBack} className={pill}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M19 12H6M11 5.5 5.5 12l5.5 6.5" />
              </svg>
              <span>{backLabel}</span>
            </button>
          ) : null}
          <button
            type="button"
            onClick={onPrimary}
            className="inline-flex flex-none items-center gap-[7px] whitespace-nowrap rounded-full bg-white px-[15px] py-[8px] text-[11.5px] font-semibold text-[#0D2315] shadow-[0_9px_20px_-11px_rgba(0,0,0,0.65)] transition hover:-translate-y-px hover:bg-[#EAF3EE]"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d={primaryIcon} />
            </svg>
            <span>{primaryLabel}</span>
          </button>
        </div>
      </div>
    </section>
  );
}

export function CurriculumBuilder({ backHref }: { backHref: string }) {
  const router = useRouter();

  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, unknown>>(() => {
    const seed: Record<string, unknown> = {};
    for (const section of BUILDER_SECTIONS) {
      if (section.kind !== "form") continue;
      for (const field of section.fields) seed[`${section.key}:${field.label}`] = initialValue(field);
    }
    return seed;
  });
  const [components, setComponents] = useState<ComponentRow[]>(DEFAULT_COMPONENTS);
  const [bands, setBands] = useState<BandRow[]>(DEFAULT_BANDS);
  const [draftComponent, setDraftComponent] = useState({ name: "", max: "", weight: "" });
  const [draftBand, setDraftBand] = useState({ grade: "", lo: "", hi: "", label: "", points: "" });
  const [drawer, setDrawer] = useState<DrawerSpec | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [touchedName, setTouchedName] = useState(false);

  const answer = (sectionKey: string, label: string) => String(answers[`${sectionKey}:${label}`] ?? "").trim();
  const setAnswer = (key: string, value: unknown) => setAnswers((current) => ({ ...current, [key]: value }));

  const name = answer("identity", "Curriculum name");
  const basis = answer("identity", "Region or awarding basis");
  const stages = answer("levels", "Stages operated");
  const classesIn = answer("levels", "Classes in each stage");
  const catalogue = answer("subjects", "Subject catalogue");
  const rollout = answer("rollout", "Put it in force") || "Not yet — save as a draft";

  const weightTotal = components.reduce((sum, row) => sum + row.weight, 0);
  const bandCheck = useMemo(() => checkBands(bands), [bands]);
  const subjectCount = catalogue.split(/\n/).filter((line) => line.trim()).length;

  const sections = BUILDER_SECTIONS.map((section): { label: string; sub: string; done: boolean } => {
    if (section.key === "identity") return { label: section.label, sub: name || "What this curriculum is called", done: Boolean(name) };
    if (section.key === "levels")
      return { label: section.label, sub: stages && classesIn ? "Set" : "The ladder students climb", done: Boolean(stages && classesIn) };
    if (section.key === "subjects")
      return {
        label: section.label,
        sub: subjectCount ? `${subjectCount} in the catalogue` : "What may and must be taken",
        done: subjectCount > 0,
      };
    if (section.key === "assessment")
      return {
        label: section.label,
        sub: weightTotal === 100 ? `${components.length} components · 100%` : `Weights total ${weightTotal}`,
        done: weightTotal === 100 && components.length > 0,
      };
    if (section.key === "grading")
      return {
        label: section.label,
        sub: bandCheck.ok ? `${bands.length} bands · contiguous` : "Bands need fixing",
        done: bandCheck.ok,
      };
    if (section.key === "report") return { label: section.label, sub: "What a parent receives", done: true };
    return { label: section.label, sub: "When it starts", done: true };
  });

  const doneCount = sections.filter((section) => section.done).length;
  const current = BUILDER_SECTIONS[step];

  const go = (next: number) => {
    setStep(Math.max(0, Math.min(BUILDER_SECTIONS.length - 1, next)));
    setError(null);
  };

  /** Everything the seven sections collected, as one record. */
  const payload = () => {
    const bySection: Record<string, Record<string, unknown>> = {};
    for (const section of BUILDER_SECTIONS) {
      if (section.kind !== "form") continue;
      const values: Record<string, unknown> = {};
      for (const field of section.fields) values[field.label] = answers[`${section.key}:${field.label}`];
      bySection[section.key] = values;
    }
    return {
      name,
      code: name.replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "").toUpperCase().slice(0, 24) || undefined,
      description: answer("identity", "Short description") || undefined,
      status: rollout.startsWith("Not yet") ? "INACTIVE" : "ACTIVE",
      data: {
        ...bySection,
        assessment: { components, weightTotal },
        grading: { bands, contiguous: bandCheck.ok },
        sectionsComplete: doneCount,
        builtAt: new Date().toISOString(),
      },
    };
  };

  const save = async (asDraft: boolean) => {
    setPending(true);
    setError(null);
    try {
      const body = payload();
      await sendJson("/api/v1/configuration/curricula", "POST", {
        ...body,
        status: asDraft ? "INACTIVE" : body.status,
      });
      setDrawer(null);
      router.push(backHref as Route<string>);
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "That did not save.");
    } finally {
      setPending(false);
    }
  };

  /**
   * The create modal. It restates what is about to be written — including the
   * sections still outstanding — because a curriculum is the one record every
   * score and report card in the school is later read against.
   */
  const openCreate = () => {
    if (!name) {
      setTouchedName(true);
      go(0);
      return;
    }
    setDrawer({
      mode: "commit",
      kicker: "New curriculum",
      title: `Create “${name}”`,
      sub: "All seven sections are written together as one draft curriculum.",
      facts: [
        ["Name", name, "How it appears on every card"],
        [
          "Basis",
          basis || "Not set",
          `Taught in ${answer("identity", "Language of instruction") || "—"}`,
        ],
        [
          "Assessment",
          `${components.length} components · weights total ${weightTotal}`,
          weightTotal === 100 ? "Valid" : "Must total 100",
        ],
        ["Grading", `${bands.length} bands`, bandCheck.ok ? "Contiguous" : bandCheck.why],
        [
          "Sections complete",
          `${doneCount} of 7`,
          doneCount === 7 ? "Nothing outstanding" : "A draft can be finished later",
        ],
        ["Goes in force", rollout, "Nothing changes today unless you put it in force"],
      ],
      commitLabel: "Create curriculum",
      commitDone: `${name} created`,
      commitDoneBody:
        "It is in the curriculum list. Open it to keep editing, or put it in force from the next term.",
      submit: { endpoint: "/api/v1/configuration/curricula", method: "POST", body: payload() },
    });
  };

  const nav = (
    <div className="mt-[15px] flex flex-wrap items-center justify-between gap-2 border-t border-[#EDF3EF] pt-[13px]">
      <div className="flex flex-wrap items-center gap-2">
        {step > 0 ? <Button label={`Back · ${sections[step - 1].label}`} onClick={() => go(step - 1)} /> : <span />}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {step === BUILDER_SECTIONS.length - 1 ? (
          <>
            <Button label="Save as a draft" onClick={() => void save(true)} disabled={pending || !name} />
            <Button label={name ? `Create “${name}”` : "Create curriculum"} onClick={openCreate} primary disabled={pending} />
          </>
        ) : (
          <Button label={`Next · ${sections[step + 1].label}`} onClick={() => go(step + 1)} primary />
        )}
      </div>
    </div>
  );

  return (
    <div className="grid min-w-0 gap-[14px]">
      <ModuleDrawer spec={drawer} onClose={() => setDrawer(null)} />

      <BuilderHead
        tag={sections[step].label}
        primaryLabel={step < BUILDER_SECTIONS.length - 1 ? `Next · ${sections[step + 1].label}` : "Create curriculum"}
        primaryIcon={step < BUILDER_SECTIONS.length - 1 ? ARROW : TICK}
        onPrimary={step < BUILDER_SECTIONS.length - 1 ? () => go(step + 1) : openCreate}
        backLabel={step > 0 ? `Back · ${sections[step - 1].label}` : undefined}
        onBack={step > 0 ? () => go(step - 1) : undefined}
        backHref={backHref}
      />

      {/* The mockup's builder is a 248px rail beside the section; it stacks
          on a narrow screen rather than squeezing both. */}
      <div className="grid min-w-0 gap-4 lg:grid-cols-[248px_minmax(0,1fr)]">
        <Rail
          sections={sections}
          step={step}
          go={go}
          pct={Math.round((doneCount / 7) * 100)}
          doneCount={doneCount}
        />

        <section className={cn(CARD, "px-[18px] py-[15px]")}>
          <div className="mb-[13px] flex flex-wrap items-start justify-between gap-x-4 gap-y-2 border-b border-[#EDF3EF] pb-[11px]">
            <div className="min-w-0">
              <h2 className="font-(family-name:--font-heading) text-[14px] font-extrabold leading-[1.2] tracking-[-0.018em] text-[#0D2315]">
                {current.title}
              </h2>
              <p className="mt-[3px] text-pretty text-[11px] leading-[1.45] text-[#67766D]">{current.sub}</p>
            </div>
            {current.kind === "components" ? (
              <Tag
                label={weightTotal === 100 ? "Weights total 100" : `Weights total ${weightTotal}`}
                tone={weightTotal === 100 ? "positive" : "negative"}
              />
            ) : null}
            {current.kind === "bands" ? (
              <Tag label={bandCheck.ok ? "Contiguous" : "Needs fixing"} tone={bandCheck.ok ? "positive" : "negative"} />
            ) : null}
          </div>

          {current.kind === "form" ? (
            <FormSection
              section={current}
              answers={answers}
              setAnswer={setAnswer}
              nameMissing={current.key === "identity" && touchedName && !name}
              footNote={
                current.key === "rollout"
                  ? doneCount === 7
                    ? "Every section is complete."
                    : `${7 - doneCount} section${7 - doneCount === 1 ? "" : "s"} still incomplete — a draft can be finished later.`
                  : undefined
              }
              footTone={current.key === "rollout" && doneCount < 7 ? "negative" : "positive"}
            />
          ) : null}

          {current.kind === "components" ? (
            <>
              <PresetRow
                label="Start from a preset — then change any row"
                presets={Object.keys(COMPONENT_PRESETS).map((key) => ({
                  label: key,
                  on: JSON.stringify(COMPONENT_PRESETS[key].map((row) => row.name)) === JSON.stringify(components.map((row) => row.name)),
                  onClick: () => setComponents(COMPONENT_PRESETS[key].map((row) => ({ ...row }))),
                }))}
              />

              <div className="grid gap-[6px]">
                <div className="grid items-center gap-[7px] px-[2px] grid-cols-[minmax(0,1.6fr)_84px_84px_118px_26px]">
                  {["Component", "Max mark", "Weight %", "Aggregation", ""].map((head, index) => (
                    <span
                      key={head || index}
                      className={cn(
                        "text-[9.5px] font-bold uppercase tracking-[0.08em] text-[#8B9A91]",
                        (index === 1 || index === 2) && "text-right",
                      )}
                    >
                      {head}
                    </span>
                  ))}
                </div>

                {components.map((row, index) => (
                  <div key={index} className="grid items-center gap-[7px] grid-cols-[minmax(0,1.6fr)_84px_84px_118px_26px]">
                    <GridCell
                      value={row.name}
                      bold
                      onChange={(next) =>
                        setComponents(components.map((item, other) => (other === index ? { ...item, name: next } : item)))
                      }
                    />
                    <GridCell
                      value={row.max}
                      right
                      onChange={(next) =>
                        setComponents(components.map((item, other) => (other === index ? { ...item, max: num(next) } : item)))
                      }
                    />
                    <GridCell
                      value={row.weight}
                      right
                      bad={weightTotal !== 100}
                      onChange={(next) =>
                        setComponents(components.map((item, other) => (other === index ? { ...item, weight: num(next) } : item)))
                      }
                    />
                    <span className="text-[11px] text-[#67766D]">Sum across term</span>
                    <RemoveButton onClick={() => setComponents(components.filter((_, other) => other !== index))} />
                  </div>
                ))}

                <div className="mt-[3px] grid items-center gap-[7px] grid-cols-[minmax(0,1.6fr)_84px_84px_118px_26px]">
                  <GridCell
                    value={draftComponent.name}
                    placeholder="Another component — e.g. Practical"
                    onChange={(next) => setDraftComponent({ ...draftComponent, name: next })}
                  />
                  <GridCell
                    value={draftComponent.max}
                    placeholder="Max"
                    right
                    onChange={(next) => setDraftComponent({ ...draftComponent, max: next })}
                  />
                  <GridCell
                    value={draftComponent.weight}
                    placeholder="%"
                    right
                    onChange={(next) => setDraftComponent({ ...draftComponent, weight: next })}
                  />
                  <Button
                    label="Add"
                    onClick={() => {
                      if (!draftComponent.name.trim()) return;
                      setComponents(
                        components.concat([
                          {
                            name: draftComponent.name.trim(),
                            max: num(draftComponent.max || 10),
                            weight: num(draftComponent.weight || 10),
                          },
                        ]),
                      );
                      setDraftComponent({ name: "", max: "", weight: "" });
                    }}
                  />
                  <span />
                </div>
              </div>

              <Meter
                pct={weightTotal}
                tone={weightTotal === 100 ? "positive" : weightTotal > 100 ? "negative" : "attention"}
                label={weightTotal === 100 ? "Weights total 100 · valid" : `Weights total ${weightTotal}`}
                note={
                  weightTotal === 100
                    ? "A term average can be computed from these components."
                    : weightTotal > 100
                      ? `Take ${weightTotal - 100} off one of the rows.`
                      : `${100 - weightTotal} still to allocate.`
                }
              />
              {nav}
            </>
          ) : null}

          {current.kind === "bands" ? (
            <>
              <PresetRow
                label="Start from a scale — then move any line"
                presets={Object.keys(BAND_PRESETS).map((key) => ({
                  label: key,
                  on: JSON.stringify(BAND_PRESETS[key].map((row) => row.grade)) === JSON.stringify(bands.map((row) => row.grade)),
                  onClick: () => setBands(BAND_PRESETS[key].map((row) => ({ ...row }))),
                }))}
              />

              <div className="grid gap-[6px]">
                <div className="grid items-center gap-[7px] px-[2px] grid-cols-[96px_72px_72px_minmax(0,1.2fr)_66px_26px]">
                  {["Grade", "From", "To", "What it is called", "Points", ""].map((head, index) => (
                    <span
                      key={head || index}
                      className={cn(
                        "text-[9.5px] font-bold uppercase tracking-[0.08em] text-[#8B9A91]",
                        (index === 1 || index === 2 || index === 4) && "text-right",
                      )}
                    >
                      {head}
                    </span>
                  ))}
                </div>

                {bands
                  .map((band, index) => ({ band, index }))
                  .sort((a, b) => b.band.hi - a.band.hi)
                  .map(({ band, index }) => (
                    <div key={index} className="grid items-center gap-[7px] grid-cols-[96px_72px_72px_minmax(0,1.2fr)_66px_26px]">
                      <GridCell
                        value={band.grade}
                        bold
                        onChange={(next) => setBands(bands.map((item, other) => (other === index ? { ...item, grade: next } : item)))}
                      />
                      <GridCell
                        value={band.lo}
                        right
                        bad={!bandCheck.ok}
                        onChange={(next) => setBands(bands.map((item, other) => (other === index ? { ...item, lo: num(next) } : item)))}
                      />
                      <GridCell
                        value={band.hi}
                        right
                        bad={!bandCheck.ok}
                        onChange={(next) => setBands(bands.map((item, other) => (other === index ? { ...item, hi: num(next) } : item)))}
                      />
                      <GridCell
                        value={band.label}
                        onChange={(next) => setBands(bands.map((item, other) => (other === index ? { ...item, label: next } : item)))}
                      />
                      <GridCell
                        value={band.points}
                        right
                        onChange={(next) => setBands(bands.map((item, other) => (other === index ? { ...item, points: num(next) } : item)))}
                      />
                      <RemoveButton onClick={() => setBands(bands.filter((_, other) => other !== index))} />
                    </div>
                  ))}

                <div className="mt-[3px] grid items-center gap-[7px] grid-cols-[96px_72px_72px_minmax(0,1.2fr)_66px_26px]">
                  <GridCell value={draftBand.grade} placeholder="Grade" onChange={(next) => setDraftBand({ ...draftBand, grade: next })} />
                  <GridCell value={draftBand.lo} placeholder="From" right onChange={(next) => setDraftBand({ ...draftBand, lo: next })} />
                  <GridCell value={draftBand.hi} placeholder="To" right onChange={(next) => setDraftBand({ ...draftBand, hi: next })} />
                  <GridCell
                    value={draftBand.label}
                    placeholder="What it is called"
                    onChange={(next) => setDraftBand({ ...draftBand, label: next })}
                  />
                  <GridCell value={draftBand.points} placeholder="Pts" right onChange={(next) => setDraftBand({ ...draftBand, points: next })} />
                  <Button
                    label="Add"
                    onClick={() => {
                      if (!draftBand.grade.trim()) return;
                      setBands(
                        bands.concat([
                          {
                            grade: draftBand.grade.trim(),
                            lo: num(draftBand.lo),
                            hi: num(draftBand.hi),
                            label: draftBand.label.trim() || draftBand.grade.trim(),
                            points: num(draftBand.points),
                          },
                        ]),
                      );
                      setDraftBand({ grade: "", lo: "", hi: "", label: "", points: "" });
                    }}
                  />
                </div>
              </div>

              <Meter
                pct={bandCheck.ok ? 100 : 55}
                tone={bandCheck.ok ? "positive" : "negative"}
                label={bandCheck.ok ? "Every mark from 0 to 100 has a grade" : "These bands do not cover 0 to 100"}
                note={bandCheck.why}
              />
              {nav}
            </>
          ) : null}

          {current.kind === "form" ? nav : null}

          {error ? (
            <p className="mt-[11px] rounded-[10px] border border-[#E4B9B9] bg-[#FBF2F2] px-[12px] py-[9px] text-[11px] font-medium text-[#B23B3B]">
              {error}
            </p>
          ) : null}
        </section>
      </div>
    </div>
  );
}

function FormSection({
  section,
  answers,
  setAnswer,
  nameMissing,
  footNote,
  footTone,
}: {
  section: BuilderSection & { kind: "form" };
  answers: Record<string, unknown>;
  setAnswer: (key: string, value: unknown) => void;
  nameMissing: boolean;
  footNote?: string;
  footTone: PanelTone;
}) {
  const swatch = toneSwatches[footTone];
  return (
    <>
      <div className="grid gap-x-[14px] gap-y-[13px] grid-cols-[repeat(auto-fit,minmax(240px,1fr))]">
        {section.fields.map((field) => {
          const key = `${section.key}:${field.label}`;
          return (
            <Field
              key={key}
              field={field}
              value={answers[key]}
              setValue={(next) => setAnswer(key, next)}
            />
          );
        })}
      </div>

      {nameMissing ? (
        <p className="mt-[11px] rounded-[10px] border border-[#E4B9B9] bg-[#FBF2F2] px-[12px] py-[9px] text-[11px] font-medium text-[#B23B3B]">
          A curriculum needs a name before it can be created.
        </p>
      ) : null}

      {footNote ? (
        <p
          className="mt-[13px] rounded-[10px] border px-[12px] py-[9px] text-[11px] font-medium"
          style={{ background: swatch.bg, borderColor: swatch.bd, color: swatch.fg }}
        >
          {footNote}
        </p>
      ) : null}
    </>
  );
}
