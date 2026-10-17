"use client";

import Link from "next/link";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { Field, initialValue } from "@/components/modules/field";
import { ModuleDrawer } from "@/components/modules/module-drawer";
import {
  ALLOCATION_CATEGORIES,
  CATEGORY_TONES,
  DEFAULT_CATEGORIES,
  componentFor,
  lineTotal,
  sumLines,
  type AllocationItem,
} from "@/lib/modules/allocation-build";
import type { DrawerSpec, FormField, PanelTone } from "@/lib/modules/panels";
import { toneSwatches } from "@/lib/modules/tones";
import { cn } from "@/lib/utils/cn";

const CARD = "min-w-0 rounded-[14px] border border-[#DEE8E2] bg-[var(--color-bg-surface)]";
const CELL =
  "w-full min-w-0 rounded-[8px] border-[1.5px] border-[#E4EDE8] bg-white px-[9px] py-[7px] text-[11.5px] font-medium text-[#0D2315] outline-none focus:border-[#12796A]";

function naira(value: number): string {
  return `₦${Math.round(value).toLocaleString("en-NG")}`;
}

function num(value: unknown): number {
  const parsed = parseFloat(String(value ?? "").replace(/[^\d.]/g, ""));
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
}

export type ClassOption = { id: string; name: string };
export type TermOption = { id: string; name: string; sessionName: string };

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

function RemoveButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="flex h-[26px] w-[26px] flex-none items-center justify-center rounded-[8px] border border-[#DEE8E2] bg-white text-[#8B9A91] transition hover:border-[#E4B9B9] hover:bg-[#FBF2F2] hover:text-[#B23B3B]"
    >
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
        <path d="M6 6l12 12M18 6 6 18" />
      </svg>
    </button>
  );
}

const ITEM_COLS = "[grid-template-columns:minmax(0,1.9fr)_62px_104px_104px_96px_26px]";
/** The draft row has nothing to mark required yet, so its last two cells merge. */
const DRAFT_COLS = "[grid-template-columns:minmax(0,1.9fr)_62px_104px_104px_128px]";

export function AllocationBuilder({
  backHref,
  classes,
  terms,
  catalogue,
}: {
  backHref: string;
  classes: ClassOption[];
  terms: TermOption[];
  /** Items the school already prices, offered as a starting point. */
  catalogue: AllocationItem[];
}) {
  const router = useRouter();

  const fields: FormField[] = useMemo(
    () => [
      {
        kind: "text",
        label: "Name this allocation",
        required: true,
        span: 2,
        placeholder: "e.g. JSS 2 · Second Term list",
        hint: "The name families read at the top of the printed sheet",
      },
      {
        kind: "select",
        label: "Class",
        required: true,
        options: ["Every class", ...classes.map((item) => item.name)],
        hint: "One list per class — arms share it",
      },
      {
        kind: "select",
        label: "Term",
        required: true,
        options: terms.map((item) => `${item.name} · ${item.sessionName}`),
      },
      {
        kind: "select",
        label: "Currency",
        value: "₦ Naira · NGN",
        options: ["₦ Naira · NGN"],
        hint: "Taken from the school's own currency",
      },
      {
        kind: "select",
        label: "Recurrence",
        value: "Every term",
        options: ["Every term", "Once a session", "One off"],
        hint: "How often a family is asked for this list",
      },
    ],
    [classes, terms],
  );

  const [answers, setAnswers] = useState<Record<string, unknown>>(() => {
    const seed: Record<string, unknown> = {};
    for (const field of fields) seed[field.label] = initialValue(field);
    return seed;
  });
  const [cats, setCats] = useState<string[]>(DEFAULT_CATEGORIES);
  const [items, setItems] = useState<AllocationItem[]>([]);
  const [newCat, setNewCat] = useState("");
  const [drafts, setDrafts] = useState<Record<string, { name: string; qty: string; price: string }>>({});
  const [drawer, setDrawer] = useState<DrawerSpec | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [touchedName, setTouchedName] = useState(false);

  const answer = (label: string) => String(answers[label] ?? "").trim();
  const name = answer("Name this allocation");
  const className = answer("Class");
  const termLabel = answer("Term");
  const term = terms.find((item) => `${item.name} · ${item.sessionName}` === termLabel) ?? terms[0];
  const classRoom = classes.find((item) => item.name === className);

  const required = items.filter((item) => item.req);
  const optional = items.filter((item) => !item.req);

  const patch = (index: number, next: Partial<AllocationItem>) =>
    setItems(items.map((item, other) => (other === index ? { ...item, ...next } : item)));

  const toggleCat = (cat: string) => {
    if (cats.includes(cat)) {
      setCats(cats.filter((item) => item !== cat));
      setItems(items.filter((item) => item.cat !== cat));
    } else {
      setCats(cats.concat([cat]));
    }
  };

  /** Everything the school already prices, narrowed to the ticked categories. */
  const fillFromCatalogue = () => {
    const source = catalogue.filter((item) => cats.includes(item.cat));
    setItems(source.map((item) => ({ ...item })));
  };

  const draftFor = (cat: string) => drafts[cat] ?? { name: "", qty: "", price: "" };
  const setDraft = (cat: string, next: Partial<{ name: string; qty: string; price: string }>) =>
    setDrafts((current) => ({ ...current, [cat]: { ...draftFor(cat), ...next } }));

  const addItem = (cat: string) => {
    const draft = draftFor(cat);
    if (!draft.name.trim()) return;
    setItems(
      items.concat([
        {
          cat,
          item: draft.name.trim(),
          note: "",
          qty: Math.max(1, Math.round(num(draft.qty || 1))),
          unit: num(draft.price),
          req: true,
        },
      ]),
    );
    setDrafts((current) => ({ ...current, [cat]: { name: "", qty: "", price: "" } }));
  };

  const payload = () => ({
    name,
    termId: term?.id,
    classId: classRoom?.id,
    // The drawer below promises a draft, so it is created as one: not active, not
    // billed from, and not visible to any family until it is published.
    listState: "DRAFT",
    recurrence:
      answer("Recurrence") === "Once a session"
        ? "SESSION"
        : answer("Recurrence") === "One off"
          ? "ONE_TIME"
          : "TERM",
    isOneTime: answer("Recurrence") === "One off",
    items: items.map((item) => ({
      // The line keeps its own name now that quantity has a column of its own.
      label: item.item.trim(),
      componentType: componentFor(item.cat),
      amount: lineTotal(item),
      quantity: item.qty,
      unitAmount: item.unit,
      note: item.note || undefined,
      category: item.cat,
      isOptional: !item.req,
    })),
  });

  const openCreate = () => {
    if (!name) {
      setTouchedName(true);
      return;
    }
    if (!items.length) {
      setError("A list with no items cannot be created. Add at least one.");
      return;
    }
    setDrawer({
      mode: "commit",
      kicker: `${className || "Every class"} · ${termLabel}`,
      title: `Create “${name}”`,
      sub: "It is created as a draft. Publishing is a separate, deliberate step.",
      commitLabel: "Create the allocation",
      commitDone: `${name} created`,
      commitDoneBody:
        "It is in the allocations list. Open it to price it further, or print it for the families.",
      facts: [
        ["Name", name, "What families see at the top of the printed sheet"],
        ["Class", className || "Every class", "One list per class — arms share it"],
        ["Term", termLabel, ""],
        ["Categories", cats.join(", ") || "None", ""],
        [
          "Items",
          String(items.length),
          `${required.length} required · ${optional.length} optional`,
        ],
        ["Required total", naira(sumLines(required)), "The figure a family plans around"],
        [
          "Reaches a family",
          "Not until you publish it",
          "A draft is yours alone",
        ],
      ],
      submit: {
        endpoint: "/api/v1/finance/fee-structures",
        method: "POST",
        body: payload(),
      },
    });
  };

  const totals: Array<[string, string, string]> = [
    ["Required", naira(sumLines(required)), `${required.length} items every child must have`],
    ["Optional", naira(sumLines(optional)), `${optional.length} a family may skip`],
    ["Full list", naira(sumLines(items)), "If a family took everything"],
    [
      "Items",
      String(items.length),
      `Across ${cats.length} ${cats.length === 1 ? "category" : "categories"}`,
    ],
  ];

  return (
    <div className="grid min-w-0 gap-[14px]">
      <ModuleDrawer
        spec={drawer}
        onClose={() => {
          setDrawer(null);
          router.refresh();
        }}
      />

      <section className="relative overflow-hidden rounded-[15px] bg-[#0D2315] px-[19px] py-[15px] shadow-[0_14px_30px_-24px_rgba(13,35,21,0.8)]">
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -right-[80px] -top-[132px] h-[336px] w-[336px] rounded-full border border-[rgba(95,214,180,0.12)]" />
          <div className="absolute -right-[18px] -top-[70px] h-[212px] w-[212px] rounded-full border border-[rgba(95,214,180,0.08)]" />
        </div>
        <div className="relative flex flex-wrap items-center justify-between gap-x-5 gap-y-2.5">
          <div className="min-w-0 max-w-[620px]">
            <div className="mb-[5px] flex flex-wrap items-center gap-[7px]">
              <span className="h-[4.5px] w-[4.5px] flex-none rounded-full bg-[#5FD6B4]" />
              <span className="whitespace-nowrap text-[9px] font-bold uppercase tracking-[0.14em] text-white/50">
                School Configuration
              </span>
              <span className="rounded-full border border-white/[0.18] bg-white/10 px-[8px] py-[2px] text-[9px] font-bold uppercase tracking-[0.08em] text-white/70">
                {items.length ? `${items.length} items` : "Empty"}
              </span>
            </div>
            <h1 className="text-pretty font-[family-name:var(--font-heading)] text-[19px] font-extrabold leading-[1.15] tracking-[-0.024em] text-white">
              Create an allocation
            </h1>
            <p className="mt-1 max-w-[560px] text-pretty text-[11px] leading-[1.45] text-white/60">
              Name it, pick categories, fill each one, then publish.
            </p>
          </div>
          <div className="flex min-w-0 flex-[0_1_auto] flex-wrap items-center justify-end gap-2">
            <Link
              href={backHref as Route<string>}
              className="inline-flex flex-none items-center gap-[6px] whitespace-nowrap rounded-full border border-white/[0.18] bg-white/10 px-[12px] py-[7px] text-[11px] font-semibold text-white transition hover:bg-white/20"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M19 12H6M11 5.5 5.5 12l5.5 6.5" />
              </svg>
              <span>Back to all allocations</span>
            </Link>
            <button
              type="button"
              onClick={openCreate}
              className="inline-flex flex-none items-center gap-[7px] whitespace-nowrap rounded-full bg-white px-[15px] py-[8px] text-[11.5px] font-semibold text-[#0D2315] shadow-[0_9px_20px_-11px_rgba(0,0,0,0.65)] transition hover:-translate-y-px hover:bg-[#EAF3EE]"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M5 12.5l4.5 4.5 9-10" />
              </svg>
              <span>Create the allocation</span>
            </button>
          </div>
        </div>
      </section>

      <section className={cn(CARD, "px-[18px] py-[15px]")}>
        <div className="mb-[13px] border-b border-[#EDF3EF] pb-[11px]">
          <h2 className="font-[family-name:var(--font-heading)] text-[14px] font-extrabold leading-[1.2] tracking-[-0.018em] text-[#0D2315]">
            What this list is
          </h2>
          <p className="mt-[3px] text-pretty text-[11px] leading-[1.45] text-[#67766D]">
            Five answers. Everything else is the items themselves.
          </p>
        </div>
        <div className="grid gap-x-[14px] gap-y-[13px] [grid-template-columns:repeat(auto-fit,minmax(240px,1fr))]">
          {fields.map((field) => (
            <Field
              key={field.label}
              field={field}
              value={answers[field.label]}
              setValue={(next) => setAnswers((current) => ({ ...current, [field.label]: next }))}
            />
          ))}
        </div>
        {touchedName && !name ? (
          <p className="mt-[11px] rounded-[10px] border border-[#E4B9B9] bg-[#FBF2F2] px-[12px] py-[9px] text-[11px] font-medium text-[#B23B3B]">
            An allocation needs a name before it can be created.
          </p>
        ) : null}
      </section>

      <section className={cn(CARD, "px-[18px] py-[15px]")}>
        <div className="mb-[13px] flex flex-wrap items-start justify-between gap-x-4 gap-y-2 border-b border-[#EDF3EF] pb-[11px]">
          <div className="min-w-0">
            <h2 className="font-[family-name:var(--font-heading)] text-[14px] font-extrabold leading-[1.2] tracking-[-0.018em] text-[#0D2315]">
              The list itself
            </h2>
            <p className="mt-[3px] text-pretty text-[11px] leading-[1.45] text-[#67766D]">
              Tick the categories this list covers, then fill each one.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Tag label={`${cats.length} ${cats.length === 1 ? "category" : "categories"}`} tone="neutral" />
            {catalogue.length ? (
              <Button label="Fill from what the school already prices" onClick={fillFromCatalogue} />
            ) : null}
            {items.length ? <Button label="Clear every item" onClick={() => setItems([])} /> : null}
          </div>
        </div>

        <div className="mb-[15px] flex flex-wrap items-center gap-[7px]">
          {ALLOCATION_CATEGORIES.concat(
            cats
              .filter((cat) => !ALLOCATION_CATEGORIES.some((known) => known.label === cat))
              .map((cat) => ({ label: cat, sub: "Your own category" })),
          ).map((cat) => {
            const on = cats.includes(cat.label);
            return (
              <button
                key={cat.label}
                type="button"
                onClick={() => toggleCat(cat.label)}
                title={cat.sub}
                className={cn(
                  "rounded-full border px-[11px] py-[6px] text-[10.5px] font-semibold transition",
                  on
                    ? "border-[#12796A] bg-[#EAF6F0] text-[#12796A]"
                    : "border-[#DEE8E2] bg-white text-[#435048] hover:border-[#BFDCD1] hover:bg-[#F1F8F4]",
                )}
              >
                {cat.label}
              </button>
            );
          })}
          <span className="flex items-center gap-[6px]">
            <input
              value={newCat}
              onChange={(event) => setNewCat(event.target.value)}
              placeholder="Your own category…"
              className="w-[170px] rounded-full border border-[#DEE8E2] bg-white px-[11px] py-[6px] text-[10.5px] outline-none focus:border-[#12796A]"
            />
            <Button
              label="Add"
              onClick={() => {
                const value = newCat.trim();
                if (!value || cats.includes(value)) return;
                setCats(cats.concat([value]));
                setNewCat("");
              }}
            />
          </span>
        </div>

        <div className="grid gap-[13px]">
          {cats.map((cat) => {
            const own = items.map((item, index) => ({ item, index })).filter((pair) => pair.item.cat === cat);
            const swatch = toneSwatches[CATEGORY_TONES[cat] ?? "neutral"];
            const draft = draftFor(cat);
            return (
              <div key={cat} className="rounded-[12px] border border-[#E4EDE8]">
                <div
                  className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 rounded-t-[12px] px-[13px] py-[9px]"
                  style={{ background: swatch.bg, borderBottom: `1px solid ${swatch.bd}` }}
                >
                  <div className="flex items-center gap-[8px]">
                    <span className="h-[5px] w-[5px] rounded-full" style={{ background: swatch.dot }} />
                    <span className="text-[12px] font-bold" style={{ color: swatch.fg }}>
                      {cat}
                    </span>
                    <span className="text-[10.5px] text-[#67766D]">
                      {own.length} {own.length === 1 ? "item" : "items"}
                    </span>
                  </div>
                  <div className="flex items-center gap-[10px]">
                    <span className="text-[11.5px] font-semibold text-[#0D2315]">
                      {naira(sumLines(own.map((pair) => pair.item)))}
                    </span>
                    <RemoveButton onClick={() => toggleCat(cat)} label={`Remove the ${cat} category`} />
                  </div>
                </div>

                <div className="grid gap-[6px] px-[13px] py-[11px]">
                  <div className={cn("grid items-center gap-[7px] px-[2px]", ITEM_COLS)}>
                    {["Item", "Qty", "Unit price", "Line total", "Needed", ""].map((head, index) => (
                      <span
                        key={head || index}
                        className={cn(
                          "text-[9.5px] font-bold uppercase tracking-[0.08em] text-[#8B9A91]",
                          (index === 1 || index === 2 || index === 3) && "text-right",
                        )}
                      >
                        {head}
                      </span>
                    ))}
                  </div>

                  {own.map(({ item, index }) => (
                    <div key={index} className={cn("grid items-center gap-[7px]", ITEM_COLS)}>
                      <input
                        value={item.item}
                        onChange={(event) => patch(index, { item: event.target.value })}
                        className={cn(CELL, "font-semibold")}
                      />
                      <input
                        value={item.qty}
                        onChange={(event) => patch(index, { qty: Math.max(1, Math.round(num(event.target.value))) })}
                        className={cn(CELL, "text-right")}
                      />
                      <input
                        value={item.unit}
                        onChange={(event) => patch(index, { unit: num(event.target.value) })}
                        className={cn(CELL, "text-right")}
                      />
                      <span className="text-right text-[11.5px] font-semibold text-[#0D2315]">
                        {naira(lineTotal(item))}
                      </span>
                      <button
                        type="button"
                        onClick={() => patch(index, { req: !item.req })}
                        className={cn(
                          "rounded-full border px-[9px] py-[5px] text-[10px] font-semibold transition",
                          item.req
                            ? "border-[#CFE4DB] bg-[#EAF6F0] text-[#17714F]"
                            : "border-[#E4EDE8] bg-[#F2F7F4] text-[#5F6E65]",
                        )}
                      >
                        {item.req ? "Required" : "Optional"}
                      </button>
                      <RemoveButton
                        onClick={() => setItems(items.filter((_, other) => other !== index))}
                        label={`Remove ${item.item}`}
                      />
                    </div>
                  ))}

                  <div className={cn("mt-[3px] grid items-center gap-[7px]", DRAFT_COLS)}>
                    <input
                      value={draft.name}
                      onChange={(event) => setDraft(cat, { name: event.target.value })}
                      placeholder={
                        cat === "Books"
                          ? "Add a book — e.g. New General Mathematics"
                          : cat === "Uniform"
                            ? "Add a uniform item — e.g. Daily uniform"
                            : `Add an item to ${cat}`
                      }
                      className={CELL}
                    />
                    <input
                      value={draft.qty}
                      onChange={(event) => setDraft(cat, { qty: event.target.value })}
                      placeholder="Qty"
                      className={cn(CELL, "text-right")}
                    />
                    <input
                      value={draft.price}
                      onChange={(event) => setDraft(cat, { price: event.target.value })}
                      placeholder="Price"
                      className={cn(CELL, "text-right")}
                    />
                    <span />
                    <Button label="Add" onClick={() => addItem(cat)} />
                  </div>
                </div>
              </div>
            );
          })}

          {!cats.length ? (
            <p className="rounded-[11px] border border-[#F2E4C6] bg-[#FDF6E7] px-[13px] py-[11px] text-[11px] font-medium text-[#8A6410]">
              No categories are ticked, so there is nothing to fill in. Pick at least one above.
            </p>
          ) : null}
        </div>

        <div className="mt-[15px] grid gap-[10px] border-t border-[#EDF3EF] pt-[13px] [grid-template-columns:repeat(auto-fit,minmax(170px,1fr))]">
          {totals.map(([label, value, hint]) => (
            <div key={label}>
              <div className="text-[9.5px] font-bold uppercase tracking-[0.08em] text-[#8B9A91]">{label}</div>
              <div className="mt-[3px] font-[family-name:var(--font-heading)] text-[17px] font-extrabold tracking-[-0.02em] text-[#0D2315]">
                {value}
              </div>
              <div className="mt-[2px] text-pretty text-[10px] leading-[1.45] text-[#67766D]">{hint}</div>
            </div>
          ))}
        </div>

        {error ? (
          <p className="mt-[13px] rounded-[10px] border border-[#E4B9B9] bg-[#FBF2F2] px-[12px] py-[9px] text-[11px] font-medium text-[#B23B3B]">
            {error}
          </p>
        ) : null}

        <div className="mt-[15px] flex flex-wrap items-center justify-end gap-2 border-t border-[#EDF3EF] pt-[13px]">
          <Button label="Clear every item" onClick={() => setItems([])} disabled={!items.length} />
          <Button label="Create the allocation" onClick={openCreate} primary />
        </div>
      </section>
    </div>
  );
}
