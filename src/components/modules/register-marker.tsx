"use client";

import Link from "next/link";
import type { Route } from "next";
import { useEffect, useMemo, useRef, useState } from "react";

import type { DrawerSpec, MarkerPanel, PanelFact } from "@/lib/modules/panels";
import { sendJson } from "@/lib/modules/submit";
import { INK, MUTED, toneOf } from "@/lib/modules/tones";
import { cn } from "@/lib/utils/cn";
import { readDevicePreferences } from "@/lib/preferences";

/**
 * Taking a register, the way the mockup takes it: nobody is present until someone says so, one tap per
 * status, the exceptions first and "mark the rest present" last, and a preview of exactly what will be
 * written before it is. The marks live here until submitted; a draft can be kept on the server.
 */

type Status = "PRESENT" | "ABSENT" | "LATE" | "EXCUSED";
type Entry = { status: Status | null; reason: string; reasonCode: string };

const CHOICES: Array<{ value: Status; short: string; label: string; tone: "positive" | "negative" | "attention" | "submitted" }> = [
  { value: "PRESENT", short: "P", label: "Present", tone: "positive" },
  { value: "ABSENT", short: "A", label: "Absent", tone: "negative" },
  { value: "LATE", short: "L", label: "Late", tone: "attention" },
  { value: "EXCUSED", short: "E", label: "Excused", tone: "submitted" },
];
const LABEL: Record<Status, string> = { PRESENT: "Present", ABSENT: "Absent", LATE: "Late", EXCUSED: "Excused" };
const PER = 15;
const SHELL = "min-w-0 overflow-hidden rounded-[14px] border bg-(--color-bg-surface) px-[18px] pb-[12px]";
const NEEDS_REASON = new Set<Status>(["ABSENT", "EXCUSED"]);

function Kpi({ label, value, unit, sub, tone }: { label: string; value: string; unit?: string; sub: string; tone?: "positive" | "negative" | "attention" | "submitted" | "neutral" }) {
  const swatch = toneOf(tone ?? "neutral");
  return (
    <div className="min-w-0 rounded-[12px] border bg-white px-[14px] py-[12px]" style={{ borderColor: "#E4EDE8" }}>
      <p className="text-[9.5px] font-bold uppercase tracking-[0.06em]" style={{ color: MUTED }}>{label}</p>
      <p className="mt-[5px] text-[22px] font-bold leading-none tabular-nums" style={{ color: tone && tone !== "neutral" ? swatch.fg : INK }}>
        {value}
        {unit ? <span className="ml-[5px] text-[11px] font-semibold" style={{ color: MUTED }}>{unit}</span> : null}
      </p>
      <p className="mt-[5px] text-[10.5px] leading-[1.4]" style={{ color: MUTED }}>{sub}</p>
    </div>
  );
}

export function RegisterMarker({ panel, openDrawer }: { panel: MarkerPanel; openDrawer: (spec: DrawerSpec) => void }) {
  const openedAt = useRef(new Date().toISOString());
  const [marks, setMarks] = useState<Record<string, Entry>>(() =>
    Object.fromEntries(panel.students.map((student) => [student.id, { status: student.status, reason: student.reason, reasonCode: student.reasonCode }])),
  );
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("All");
  const [page, setPage] = useState(0);
  const [note, setNote] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const locked = Boolean(panel.whyNot);
  const submitted = panel.mode === "submitted";

  const counts = useMemo(() => {
    const tally = { PRESENT: 0, ABSENT: 0, LATE: 0, EXCUSED: 0, unmarked: 0, noReason: 0 };
    for (const student of panel.students) {
      const entry = marks[student.id];
      if (!entry?.status) tally.unmarked += 1;
      else {
        tally[entry.status] += 1;
        if (entry.status === "ABSENT" && !entry.reasonCode && !entry.reason) tally.noReason += 1;
      }
    }
    return tally;
  }, [marks, panel.students]);
  const total = panel.students.length;
  const done = counts.unmarked === 0;

  // A page that still has unsaved marks says so before it is left.
  const touched = useMemo(() => panel.students.some((student) => (marks[student.id]?.status ?? null) !== student.status), [marks, panel.students]);
  useEffect(() => {
    if (!touched || locked) return;
    const warn = (event: BeforeUnloadEvent) => {
      if (readDevicePreferences().confirmLeave) event.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [touched, locked]);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return panel.students.filter((student) => {
      const entry = marks[student.id];
      if (filter === "Unmarked" && entry?.status) return false;
      if (filter !== "All" && filter !== "Unmarked" && entry?.status !== filter.toUpperCase()) return false;
      return !needle || student.name.toLowerCase().includes(needle) || student.adm.toLowerCase().includes(needle);
    });
  }, [filter, marks, panel.students, query]);
  const pages = Math.max(1, Math.ceil(visible.length / PER));
  const current = Math.min(page, pages - 1);
  const shown = visible.slice(current * PER, current * PER + PER);

  function set(id: string, status: Status) {
    setNote(null);
    setMarks((existing) => ({ ...existing, [id]: { status, reason: NEEDS_REASON.has(status) || status === "LATE" ? existing[id]?.reason ?? "" : "", reasonCode: NEEDS_REASON.has(status) || status === "LATE" ? existing[id]?.reasonCode ?? "" : "" } }));
  }
  function setReason(id: string, patch: Partial<Entry>) {
    setMarks((existing) => ({ ...existing, [id]: { ...existing[id], ...patch } }));
  }
  function restPresent() {
    setNote(null);
    setMarks((existing) => Object.fromEntries(Object.entries(existing).map(([id, entry]) => [id, entry.status ? entry : { status: "PRESENT" as Status, reason: "", reasonCode: "" }])));
  }
  function clearAll() {
    setNote(null);
    setMarks(Object.fromEntries(panel.students.map((student) => [student.id, { status: null, reason: "", reasonCode: "" }])));
  }

  const entries = () =>
    panel.students
      .filter((student) => marks[student.id]?.status)
      .map((student) => ({ studentId: student.id, status: marks[student.id].status as Status, reason: marks[student.id].reason, reasonCode: marks[student.id].reasonCode }));

  async function saveDraft() {
    setSaving(true);
    setNote(null);
    try {
      await sendJson(panel.draftEndpoint, "POST", { date: panel.date, entries: entries() });
      setNote({ tone: "ok", text: `Draft saved · ${entries().length} of ${total} marked. Nothing is on the register until you submit it.` });
    } catch (cause) {
      setNote({ tone: "error", text: cause instanceof Error ? cause.message : "The draft could not be saved." });
    } finally {
      setSaving(false);
    }
  }

  function review() {
    if (!done) {
      openDrawer({
        mode: "view",
        kicker: `Attendance · ${panel.arm}`,
        title: "The register is not complete",
        sub: `${counts.unmarked} of ${total} children have no status yet.`,
        readOnly: true,
        readOnlyNote: "A register with unmarked children cannot be submitted.",
        facts: [
          ["Unmarked", String(counts.unmarked), "These children have no status at all"],
          ["Marked so far", String(total - counts.unmarked), `Of ${total}`],
          ["Why this matters", "An unmarked child is not a present one", "Submitting a partial register would record attendance the school never took"],
          ["What to do", "Set every row, or use Mark the rest present", "Set the exceptions first, then mark the remainder present in one tap"],
        ],
      });
      return;
    }
    const exceptions = panel.students.filter((student) => marks[student.id]?.status && marks[student.id].status !== "PRESENT");
    const facts: PanelFact[] = [
      ["Arm", panel.arm, panel.label],
      ["Children", String(total), "Every one of them is marked"],
      ["Present", String(counts.PRESENT), ""],
      ["Absent", String(counts.ABSENT), counts.noReason ? `${counts.noReason} with no reason — allowed, but recorded as unexplained` : counts.ABSENT ? "All with a reason" : "Nobody absent"],
      ["Late", String(counts.LATE), "Counted as in the room"],
      ["Excused", String(counts.EXCUSED), "Not counted against them"],
      ...exceptions.map((student): PanelFact => [student.name, LABEL[marks[student.id].status as Status], marks[student.id].reasonCode || marks[student.id].reason || "No reason given"]),
    ];
    if (panel.backdated) facts.unshift(["Backdated", "This register is for a day that has passed", "It is listed on Compliance with the reason you give"]);
    openDrawer({
      mode: "commit",
      kicker: "Attendance · Mark",
      title: `${submitted ? "Save the corrections to" : "Submit the register for"} ${panel.arm}`,
      sub: "This is what will be written to the day's register. Check it before it goes in.",
      facts,
      commitLabel: submitted ? "Save the corrections" : "Submit to the register",
      commitNote: submitted ? "A same-day change keeps both values and is logged under your name." : panel.backdated ? "A backdated register is listed on Compliance, with the reason you give." : "Correctable until midnight without approval. After that it needs one.",
      commitDone: submitted ? `Register corrected · ${panel.arm}` : `Register submitted · ${panel.arm}`,
      commitDoneBody: submitted
        ? "The old and new marks are both kept. The figures on the whole-school view have moved with it."
        : "It is on the day's register and this arm now reads Marked. Guardians of absent children are told, as your policy sets.",
      next: { label: "See the whole school", href: "/attendance/register" },
      submit: {
        endpoint: panel.submitEndpoint,
        method: "POST",
        body: { date: panel.date, entries: entries(), openedAt: openedAt.current },
        reasonKey: panel.backdated ? "backdateReason" : submitted ? "note" : undefined,
        reasonLabel: panel.backdated ? "Why this register is being taken late" : submitted ? "What changed (optional)" : undefined,
        reasonRequired: panel.backdated,
      },
    });
  }

  const unmarkedTone = done ? "positive" : "attention";

  return (
    <div className="grid min-w-0 gap-4">
      <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))" }}>
        <Kpi label="Marked" value={String(total - counts.unmarked)} unit={`of ${total}`} sub={done ? "Every child accounted for" : `${counts.unmarked} still unmarked`} tone={unmarkedTone} />
        <Kpi label="Present" value={String(counts.PRESENT)} sub="On time" tone={counts.PRESENT ? "positive" : "neutral"} />
        <Kpi label="Absent" value={String(counts.ABSENT)} sub={counts.noReason ? `${counts.noReason} with no reason yet` : counts.ABSENT ? "All have a reason" : "None absent"} tone={counts.noReason ? "negative" : counts.ABSENT ? "attention" : "neutral"} />
        <Kpi label="Late" value={String(counts.LATE)} sub="Counted as in the room" tone={counts.LATE ? "attention" : "neutral"} />
        <Kpi label="Excused" value={String(counts.EXCUSED)} sub="Explanation accepted" tone={counts.EXCUSED ? "submitted" : "neutral"} />
      </div>

      {panel.whyNot ? (
        <div className="rounded-[12px] border px-[14px] py-[11px]" style={{ background: "#FDF6E7", borderColor: "#F2E4C6" }}>
          <p className="text-[12px] font-bold" style={{ color: "#8A6410" }}>This register cannot be edited here</p>
          <p className="mt-[4px] text-[11px] leading-[1.55]" style={{ color: "#8A6410" }}>{panel.whyNot}</p>
          <Link href={panel.overviewHref as Route} className="mt-[7px] inline-block text-[11px] font-semibold underline" style={{ color: "#8A6410" }}>Back to the whole school</Link>
        </div>
      ) : null}

      {note ? (
        <div className="rounded-[12px] border px-[14px] py-[10px]" style={note.tone === "ok" ? { background: "#EAF6F0", borderColor: "#CFE4DB" } : { background: "#FDF2F2", borderColor: "#F3D2D2" }}>
          <p className="text-[11.5px] font-semibold" style={{ color: note.tone === "ok" ? "#17714F" : "#A32B2B" }}>{note.text}</p>
        </div>
      ) : null}

      <section className={cn(SHELL)} style={{ borderColor: "#DEE8E2" }} aria-label={`Roster · ${panel.arm}`}>
        <div className="mx-[-18px] flex flex-wrap items-start justify-between gap-[14px] border-b px-[18px] pb-[12px] pt-[14px]" style={{ borderColor: "#EDF3EF" }}>
          <div className="min-w-0 flex-[1_1_260px]">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-[12.5px] font-semibold" style={{ color: INK }}>Roster · {panel.arm}</h3>
              <span className="rounded-full border px-[8px] py-[2px] text-[10px] font-semibold" style={{ background: toneOf(submitted ? "positive" : done ? "submitted" : "attention").bg, color: toneOf(submitted ? "positive" : done ? "submitted" : "attention").fg, borderColor: toneOf(submitted ? "positive" : done ? "submitted" : "attention").bd }}>
                {submitted ? "Submitted" : done ? "Ready" : `${counts.unmarked} unmarked`}
              </span>
            </div>
            <p className="mt-[3.5px] text-[10.5px] leading-normal" style={{ color: MUTED }}>Tap P, A, L or E on a row. A reason on an absence travels to that child&rsquo;s register.</p>
          </div>
          <p className="text-right text-[10.5px] leading-[1.45]" style={{ color: MUTED }}>
            {total} children · {total - counts.unmarked} marked · cutoff {panel.cutoff}
            {panel.startedAt ? ` · started ${panel.startedAt}` : ""}
          </p>
        </div>

        <div className="mx-[-18px] flex flex-wrap items-center gap-[8px] border-b px-[18px] py-[10px]" style={{ borderColor: "#EDF3EF", background: "#FAFCFB" }}>
          <input
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setPage(0);
            }}
            placeholder="Find a child by name or admission number"
            aria-label="Find a child"
            className="min-w-[200px] flex-1 rounded-[9px] border bg-white px-[11px] py-[7px] text-[11.5px]"
            style={{ borderColor: "#DEE8E2" }}
          />
          <select
            value={filter}
            onChange={(event) => {
              setFilter(event.target.value);
              setPage(0);
            }}
            aria-label="Status"
            className="rounded-[9px] border bg-white px-[10px] py-[7px] text-[11.5px]"
            style={{ borderColor: "#DEE8E2" }}
          >
            {["All", "Unmarked", "Present", "Absent", "Late", "Excused"].map((option) => (
              <option key={option} value={option}>{option === "All" ? "Status · All" : option}</option>
            ))}
          </select>
          <button type="button" disabled={locked} onClick={clearAll} className="rounded-[8px] border bg-white px-[10px] py-[6px] text-[10.5px] font-semibold disabled:opacity-50" style={{ borderColor: "#DEE8E2", color: "#435048" }}>Clear the register</button>
          <button type="button" disabled={locked} onClick={restPresent} className="rounded-[8px] border bg-white px-[10px] py-[6px] text-[10.5px] font-semibold disabled:opacity-50" style={{ borderColor: "#DEE8E2", color: "#435048" }}>Mark the rest present</button>
          {!submitted ? (
            <button type="button" disabled={locked || saving || !entries().length} onClick={saveDraft} className="rounded-[8px] border bg-white px-[10px] py-[6px] text-[10.5px] font-semibold disabled:opacity-50" style={{ borderColor: "#DEE8E2", color: "#435048" }}>{saving ? "Saving…" : "Save as a draft"}</button>
          ) : null}
          <button type="button" disabled={locked} onClick={review} className="rounded-[8px] px-[11px] py-[6.5px] text-[10.5px] font-semibold text-white disabled:opacity-50" style={{ background: INK }}>
            {done ? (submitted ? "Review and save the corrections" : "Review and submit") : `${counts.unmarked} still unmarked`}
          </button>
        </div>

        <div className="mx-[-18px] overflow-x-auto">
          <table className="w-full min-w-[760px] border-collapse text-left">
            <thead>
              <tr style={{ background: "#F7FAF8" }}>
                {["Roll", "Child", "Admission no", "Mark", "Status", "Reason", "Term %"].map((head) => (
                  <th key={head} className="px-[18px] py-[8px] text-[9.5px] font-bold uppercase tracking-[0.06em] first:pl-[18px]" style={{ color: MUTED }}>{head}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {shown.map((student) => {
                const entry = marks[student.id];
                const status = entry?.status ?? null;
                const needs = status === "ABSENT" && !entry.reasonCode && !entry.reason;
                const pill = toneOf(status ? CHOICES.find((choice) => choice.value === status)?.tone : "neutral");
                return (
                  <tr key={student.id} className="border-t" style={{ borderColor: "#F0F5F2" }}>
                    <td className="px-[18px] py-[8px] font-mono text-[11px]" style={{ color: MUTED }}>{String(student.roll).padStart(2, "0")}</td>
                    <td className="px-[18px] py-[8px]">
                      <p className="text-[11.5px] font-semibold" style={{ color: INK }}>{student.name}</p>
                      <p className="text-[10px]" style={{ color: MUTED }}>{panel.arm}</p>
                    </td>
                    <td className="px-[18px] py-[8px] font-mono text-[11px]" style={{ color: "#435048" }}>{student.adm}</td>
                    <td className="px-[18px] py-[8px]">
                      <div className="flex gap-[5px]" role="group" aria-label={`Mark for ${student.name}`}>
                        {CHOICES.map((choice) => {
                          const on = status === choice.value;
                          const swatch = toneOf(choice.tone);
                          return (
                            <button
                              key={choice.value}
                              type="button"
                              disabled={locked}
                              aria-pressed={on}
                              aria-label={`${choice.label} — ${student.name}`}
                              title={choice.label}
                              onClick={() => set(student.id, choice.value)}
                              className="flex min-w-[28px] items-center justify-center rounded-[7px] border px-[8px] py-[5px] text-[10.5px] font-bold disabled:cursor-not-allowed"
                              style={{ borderColor: on ? swatch.dot : "#DEE8E2", background: on ? swatch.dot : "#fff", color: on ? "#fff" : "#67766D" }}
                            >
                              {choice.short}
                            </button>
                          );
                        })}
                      </div>
                    </td>
                    <td className="px-[18px] py-[8px]">
                      <span className="inline-flex items-center gap-[5px] rounded-full border px-[8px] py-[2px] text-[10px] font-semibold" style={{ background: pill.bg, color: pill.fg, borderColor: pill.bd }}>
                        <span className="h-[5px] w-[5px] rounded-full" style={{ background: pill.dot }} />
                        {status ? LABEL[status] : "Unmarked"}
                      </span>
                    </td>
                    <td className="px-[18px] py-[8px]">
                      {status === "ABSENT" || status === "EXCUSED" || status === "LATE" ? (
                        <div className="grid gap-[4px]">
                          <select
                            disabled={locked}
                            value={entry.reasonCode}
                            aria-label={`Reason — ${student.name}`}
                            onChange={(event) => setReason(student.id, { reasonCode: event.target.value })}
                            className="w-full max-w-[210px] rounded-[8px] border bg-white px-[8px] py-[5px] text-[11px]"
                            style={{ borderColor: needs ? "#E8B4B4" : "#DEE8E2", color: entry.reasonCode ? "#435048" : needs ? "#B23B3B" : "#12796A" }}
                          >
                            <option value="">{needs ? "Add a reason" : "No reason yet"}</option>
                            {panel.reasons.map((reason) => (
                              <option key={reason} value={reason}>{reason}</option>
                            ))}
                          </select>
                          {entry.reasonCode ? (
                            <input
                              disabled={locked}
                              value={entry.reason}
                              onChange={(event) => setReason(student.id, { reason: event.target.value })}
                              placeholder="In their own words (optional)"
                              aria-label={`In their own words — ${student.name}`}
                              className="w-full max-w-[210px] rounded-[8px] border bg-white px-[8px] py-[5px] text-[11px]"
                              style={{ borderColor: "#DEE8E2" }}
                            />
                          ) : null}
                        </div>
                      ) : (
                        <span className="text-[11px]" style={{ color: MUTED }}>—</span>
                      )}
                    </td>
                    <td className="px-[18px] py-[8px] font-mono text-[11px]" style={{ color: student.termRate !== null && student.termRate < 75 ? "#B23B3B" : "#435048" }}>
                      {student.termRate === null ? "—" : `${student.termRate}%`}
                    </td>
                  </tr>
                );
              })}
              {!shown.length ? (
                <tr><td colSpan={7} className="px-[18px] py-[24px] text-center text-[11.5px]" style={{ color: MUTED }}>{total ? "Nobody matches that." : "Nobody is on this arm's roll, so there is no register to take."}</td></tr>
              ) : null}
            </tbody>
          </table>
        </div>

        <div className="mx-[-18px] mb-[-12px] flex flex-wrap items-center justify-between gap-[10px] border-t px-[18px] py-[10px]" style={{ borderColor: "#EDF3EF", background: "#F7FAF8" }}>
          <p className="text-[10.5px] leading-normal" style={{ color: MUTED }}>
            P present · A absent · L late · E excused. An unmarked child is not present — the register will not submit until every one is set, on every page.
          </p>
          <div className="flex items-center gap-[6px]">
            {pages > 1 ? (
              <>
                <button type="button" disabled={current === 0} onClick={() => setPage(current - 1)} className="rounded-[7px] border bg-white px-[9px] py-[4px] text-[10.5px] font-semibold disabled:opacity-40" style={{ borderColor: "#DEE8E2" }}>Previous</button>
                <span className="text-[10.5px]" style={{ color: MUTED }}>Page {current + 1} of {pages}</span>
                <button type="button" disabled={current >= pages - 1} onClick={() => setPage(current + 1)} className="rounded-[7px] border bg-white px-[9px] py-[4px] text-[10.5px] font-semibold disabled:opacity-40" style={{ borderColor: "#DEE8E2" }}>Next</button>
              </>
            ) : null}
            <button type="button" disabled={locked} onClick={restPresent} className="rounded-[8px] border bg-white px-[10px] py-[6px] text-[10.5px] font-semibold disabled:opacity-50" style={{ borderColor: "#DEE8E2", color: "#435048" }}>Mark the rest present</button>
            <button type="button" disabled={locked} onClick={review} className="rounded-[8px] px-[11px] py-[6.5px] text-[10.5px] font-semibold text-white disabled:opacity-50" style={{ background: INK }}>
              {done ? (submitted ? "Review and save the corrections" : "Review and submit the register") : `Review and submit · ${counts.unmarked} unmarked`}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
