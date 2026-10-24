"use client";

import { useMemo, useState } from "react";

import { toneOf } from "@/lib/modules/tones";
import type { DrawerSpec, PanelTone } from "@/lib/modules/panels";

type Rec = { date: string; status: string; term: string; reason: string | null; code: string | null; by: string; at: string | null };
type Term = { id: string; name: string; session: string; start: string; end: string; arm: string };
export type StudentAttendanceProps = { terms: Term[]; records: Rec[]; today: string; current: string | null; first: string; guardian: string | null; openDrawer?: (spec: DrawerSpec) => void };

type View = "Week" | "Month" | "Term" | "Year" | "All";
const VIEWS: Array<[View, string]> = [["Week", "Week"], ["Month", "Month"], ["Term", "Term"], ["Year", "Session"], ["All", "All time"]];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const WEEKDAY = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const TONE: Record<string, PanelTone> = { PRESENT: "positive", LATE: "attention", ABSENT: "negative", EXCUSED: "submitted" };
const NAME: Record<string, string> = { PRESENT: "Present", LATE: "Late", ABSENT: "Absent", EXCUSED: "Excused" };

const dayOf = (iso: string) => new Date(`${iso}T00:00:00Z`);
const addDays = (iso: string, days: number) => new Date(dayOf(iso).getTime() + days * 86_400_000).toISOString().slice(0, 10);
const monday = (iso: string) => addDays(iso, -((dayOf(iso).getUTCDay() + 6) % 7));
const short = (iso: string) => `${dayOf(iso).getUTCDate()} ${MONTHS[dayOf(iso).getUTCMonth()]!.slice(0, 3)}`;
const long = (iso: string) => `${WEEKDAY[dayOf(iso).getUTCDay()]} ${short(iso)} ${dayOf(iso).getUTCFullYear()}`;
const pct = (value: number | null) => (value === null ? "—" : `${Math.round(value * 10) / 10}%`);
const toneFor = (value: number | null): PanelTone => (value === null ? "neutral" : value >= 92 ? "positive" : value >= 85 ? "attention" : "negative");
const uniq = <T,>(list: T[]) => list.filter((value, index) => list.indexOf(value) === index);

function summary(days: Rec[]) {
  const n = days.length;
  const present = days.filter((day) => day.status === "PRESENT" || day.status === "LATE").length;
  const away = days.filter((day) => day.status === "ABSENT" || day.status === "EXCUSED");
  const late = days.filter((day) => day.status === "LATE").length;
  let best = 0; let run = 0; let bestEnd = "";
  for (const day of days) { if (day.status === "PRESENT" || day.status === "LATE") { run += 1; if (run > best) { best = run; bestEnd = day.date; } } else run = 0; }
  return { n, present, away, late, pct: n ? (present / n) * 100 : null, best, bestEnd };
}

/** Mon to Fri above a day calendar, so a column is read without counting. */
function Dow() {
  return (
    <div className="mb-[5px] grid grid-cols-5 gap-[6px]">
      {["Mon", "Tue", "Wed", "Thu", "Fri"].map((day) => (
        <span key={day} className="text-[9.5px] font-bold uppercase tracking-[0.07em]" style={{ color: "#67766D" }}>{day}</span>
      ))}
    </div>
  );
}

/** The key under the week chart and the day calendar: what each colour means. */
function Legend({ keys }: { keys: string[] }) {
  return (
    <div className="mt-[10px] flex flex-wrap items-center gap-x-[14px] gap-y-[5px]">
      {keys.map((key) => (
        <span key={key} className="flex items-center gap-[5px] text-[9.5px] font-semibold" style={{ color: "#5F6E65" }}>
          <span className="h-[8px] w-[8px] rounded-full" style={{ background: toneOf(TONE[key] ?? "neutral").dot }} />
          {key === "ABSENT" ? "Absent, not explained" : key === "EXCUSED" ? "Away, explained" : NAME[key] ?? key}
        </span>
      ))}
    </div>
  );
}

export function StudentAttendance({ terms, records, today, current, first, guardian, openDrawer }: StudentAttendanceProps) {
  const past = useMemo(() => records.filter((record) => record.date <= today), [records, today]);
  const termOf = (id: string) => terms.find((term) => term.id === id);
  const sessionOf = (record: Rec) => termOf(record.term)?.session ?? "";
  const options: Record<View, string[]> = useMemo(() => ({
    Week: uniq(past.map((record) => monday(record.date))), Month: uniq(past.map((record) => record.date.slice(0, 7))),
    Term: terms.map((term) => term.id), Year: uniq(terms.map((term) => term.session)), All: ["all"],
  }), [past, terms]);
  const now: Record<View, string> = { Week: monday(today), Month: today.slice(0, 7), Term: current ?? terms[terms.length - 1]?.id ?? "", Year: termOf(current ?? "")?.session ?? terms[terms.length - 1]?.session ?? "", All: "all" };
  const [view, setView] = useState<View>("Term");
  const [selected, setSelected] = useState<Partial<Record<View, string>>>({});
  const list = options[view];
  const cur = list.includes(selected[view] ?? "") ? selected[view]! : list.includes(now[view]) ? now[view] : list[list.length - 1] ?? "";
  const index = list.indexOf(cur);
  const go = (next: View, key?: string) => { setView(next); if (key) setSelected((state) => ({ ...state, [next]: key })); };
  const inScope = (next: View, key: string) => (record: Rec) => next === "Week" ? monday(record.date) === key : next === "Month" ? record.date.slice(0, 7) === key : next === "Term" ? record.term === key : next === "Year" ? sessionOf(record) === key : true;
  const scope = past.filter(inScope(view, cur));
  const S = summary(scope);
  const prevKey = index > 0 ? list[index - 1]! : null;
  const PS = prevKey ? summary(past.filter(inScope(view, prevKey))) : null;
  const rate = (days: Rec[]) => summary(days).pct;

  // Which week of its term a Monday is, counting the term's first Monday as 1.
  const weekNo = (mondayIso: string, term: Term | undefined) =>
    term ? Math.floor((dayOf(mondayIso).getTime() - dayOf(monday(term.start)).getTime()) / (7 * 86_400_000)) + 1 : 0;
  const span = (() => {
    const from = terms[0]?.arm ?? "";
    const to = terms[terms.length - 1]?.arm ?? "";
    return from && to && from !== to ? `${from} to ${to}` : from;
  })();
  const plural = (count: number, word: string) => `${count} ${count === 1 ? word : `${word}s`}`;
  const weekTerm = view === "Week" ? termOf(scope[0]?.term ?? "") : undefined;
  const monthTerms = view === "Month" ? uniq(scope.map((record) => record.term)).map(termOf).filter((term): term is Term => Boolean(term)) : [];

  const label = view === "Week" ? `Week of ${short(cur)} ${cur.slice(0, 4)}` : view === "Month" ? `${MONTHS[Number(cur.slice(5)) - 1]} ${cur.slice(0, 4)}` : view === "Term" ? `${termOf(cur)?.name ?? ""} ${termOf(cur)?.session ?? ""}` : view === "Year" ? `Session ${cur}` : `Since ${first}`;
  const range =
    view === "Week"
      ? `${short(cur)} – ${short(addDays(cur, 4))}${weekTerm ? ` · ${weekTerm.name} ${weekTerm.session}, week ${weekNo(cur, weekTerm)}` : ""}`
      : view === "Month"
        ? `${uniq(monthTerms.map((term) => `${term.name} ${term.session}`)).join(" and ")}${monthTerms.length ? ` · ${monthTerms[monthTerms.length - 1]!.arm}` : ""}`
        : view === "Term" && termOf(cur)
          ? `${termOf(cur)!.arm} · ${short(termOf(cur)!.start)} – ${short(termOf(cur)!.end)}${cur === current ? " · in progress" : ""}`
          : view === "Year"
            ? `${plural(terms.filter((term) => term.session === cur).length, "term")} · ${uniq(terms.filter((term) => term.session === cur).map((term) => term.arm)).join(", ")}`
            : view === "All"
              ? `${plural(terms.length, "term")}${span ? ` · ${span}` : ""}`
              : "";

  const open = (record: Rec | undefined, date: string) => {
    if (!openDrawer) return;
    openDrawer({
      kicker: "Attendance", title: long(date), mode: "view", readOnly: true,
      sub: record ? NAME[record.status] ?? record.status : "No register was taken",
      facts: record ? [
        ["Status", NAME[record.status] ?? record.status, record.status === "LATE" ? "Counted as present" : ""], ["Marked by", record.by || "—", record.at ? `${long(record.at.slice(0, 10))} · ${record.at.slice(11, 16)}` : "The time was not recorded"],
        ["Reason", record.reason ?? (record.status === "ABSENT" ? "None recorded yet" : "—"), record.code ?? ""],
      ] : [["Register", "None for this day", "Either it was not a school day, or no register was taken."]],
    });
  };

  const prevName = ({ Week: "last week", Month: "last month", Term: "last term", Year: "last session", All: "" } as const)[view];
  const delta = view === "All" ? (() => { const a = summary(past.filter(inScope("Term", terms[0]?.id ?? ""))); const b = summary(past.filter(inScope("Term", terms[terms.length - 1]?.id ?? ""))); return a.pct !== null && b.pct !== null ? b.pct - a.pct : null; })() : PS && PS.pct !== null && S.pct !== null ? S.pct - PS.pct : null;
  const pts = (value: number | null) => (value === null ? "—" : `${value >= 0 ? "+" : "−"}${Math.abs(Math.round(value * 10) / 10)} pts`);

  /* the chart: one bar for each day, week, month or term the view is made of */
  const series: Array<{ label: string; v: number | null; tone: PanelTone; tip: string; go?: () => void; on?: boolean }> = [];
  if (view === "Week") {
    for (let i = 0; i < 5; i += 1) {
      const date = addDays(cur, i); const rec = past.find((record) => record.date === date); const lab = `${WEEKDAY[dayOf(date).getUTCDay()]!.slice(0, 3)} ${dayOf(date).getUTCDate()}`;
      series.push(rec ? { label: lab, v: rec.status === "PRESENT" || rec.status === "LATE" ? 100 : 0, tone: TONE[rec.status] ?? "neutral", tip: `${long(date)} · ${NAME[rec.status]}`, go: () => open(rec, date), on: date === today } : { label: lab, v: null, tone: "neutral", tip: `${long(date)} · ${date > today ? "Coming up" : "No register"}` });
    }
  } else if (view === "Month") {
    for (const m of uniq(scope.map((record) => monday(record.date)))) { const r = rate(scope.filter((record) => monday(record.date) === m)); series.push({ label: `w/c ${short(m)}`, v: r, tone: toneFor(r), tip: `Week of ${short(m)} · ${pct(r)}`, go: () => go("Week", m), on: m === now.Week }); }
  } else if (view === "Term") {
    // Every week the term holds, not only the weeks already marked — a term in
    // progress should show the weeks still to come as open bars.
    const term = termOf(cur);
    const firstMonday = term ? monday(term.start) : cur;
    const weeks = term ? Math.floor((dayOf(monday(term.end)).getTime() - dayOf(firstMonday).getTime()) / (7 * 86_400_000)) + 1 : 0;
    for (let i = 0; i < Math.max(weeks, 1); i += 1) {
      const m = addDays(firstMonday, i * 7);
      const r = rate(scope.filter((record) => monday(record.date) === m));
      // An empty week is either still to come or was never marked. Saying
      // "Coming up" about a week that has already passed would be untrue.
      const state = r === null ? (m > today ? "Coming up" : "No register") : pct(r);
      series.push({ label: `W${i + 1}`, v: r, tone: toneFor(r), tip: `Week ${i + 1} · ${short(m)} – ${short(addDays(m, 4))} · ${state}`, go: r === null ? undefined : () => go("Week", m), on: m === now.Week });
    }
  } else if (view === "Year") {
    for (const ym of uniq(scope.map((record) => record.date.slice(0, 7)))) { const r = rate(scope.filter((record) => record.date.slice(0, 7) === ym)); series.push({ label: MONTHS[Number(ym.slice(5)) - 1]!.slice(0, 3), v: r, tone: toneFor(r), tip: `${MONTHS[Number(ym.slice(5)) - 1]} ${ym.slice(0, 4)} · ${pct(r)}`, go: () => go("Month", ym), on: ym === now.Month }); }
  } else {
    for (const term of terms) { const r = rate(past.filter(inScope("Term", term.id))); series.push({ label: term.name.replace(/ Term$/, ""), v: r, tone: toneFor(r), tip: `${term.name} ${term.session} · ${pct(r)}`, go: () => go("Term", term.id), on: term.id === current }); }
  }

  // The "since the first term" card reads the first term's figure against the
  // latest one. With a single term on record there is nothing to compare.
  const allSub = (() => {
    if (terms.length < 2) return "Only one term on record so far";
    const firstTerm = terms[0]!;
    const lastTerm = terms[terms.length - 1]!;
    const a = summary(past.filter(inScope("Term", firstTerm.id)));
    const b = summary(past.filter(inScope("Term", lastTerm.id)));
    return `${firstTerm.name.replace(/ Term$/, "")} ${pct(a.pct)} → now ${pct(b.pct)}`;
  })();

  // "2 not explained · 1 excused" — the kinds actually in this period, not a
  // fixed pair of counts that reads "0 excused" most of the time.
  const awaySub = (() => {
    if (!S.away.length) return "None";
    const kinds: Record<string, number> = {};
    for (const day of S.away) { const word = day.status === "ABSENT" ? "not explained" : (NAME[day.status] ?? day.status).toLowerCase(); kinds[word] = (kinds[word] ?? 0) + 1; }
    return Object.entries(kinds).map(([word, count]) => `${count} ${word}`).join(" · ");
  })();

  // The chart says which period it is drawing, the way the mockup does — "Week
  // by week · Second Term", not a bare "Week by week".
  const chartTitle =
    view === "Week" ? "Day by day"
      : view === "Month" ? `Week by week in ${MONTHS[Number(cur.slice(5)) - 1]}`
        : view === "Term" ? `Week by week · ${termOf(cur)?.name ?? ""} ${termOf(cur)?.session ?? ""}`.trimEnd()
          : view === "Year" ? `Month by month · session ${cur}`
            : "Term by term";
  const chartSub =
    view === "Week" ? "Each school day this week — in school or away. Tap a day to see who marked it."
      : view === "Month" ? "Share of school days present each week. Tap a week to open it."
        : view === "Term" ? `Share of school days present each week of the term${cur === current ? "; weeks still to come are left open" : ""}. Tap a week to open it.`
          : view === "Year" ? "Share of school days present each month. Tap a month to open it."
            : `Every term on record${span ? `, ${terms.length > 1 ? `from ${span}` : `in ${span}`}` : ""}. Tap a term to open it.`;

  const termRows = (subset: Term[]) => subset.map((term) => { const s = summary(past.filter(inScope("Term", term.id))); return { term, s }; });
  const away = scope.filter((record) => record.status !== "PRESENT").slice().reverse();

  return (
    <div className="grid min-w-0 gap-[14px]">
      <section className="flex min-w-0 flex-wrap items-center justify-between gap-[10px] rounded-[14px] border bg-[var(--color-bg-surface)] px-[14px] py-[12px]" style={{ borderColor: "#DEE8E2" }}>
        <div className="min-w-0">
          <p className="text-[14px] font-extrabold tracking-[-0.01em]" style={{ color: "#0D2315" }}>{label}</p>
          <p className="mt-[2px] text-[10.5px]" style={{ color: "#67766D" }}>{range}</p>
        </div>
        <div className="flex flex-wrap items-center gap-[8px]">
          <span className="rounded-full border px-[10px] py-[3px] text-[10.5px] font-semibold" style={{ background: toneOf(toneFor(S.pct)).bg, color: toneOf(toneFor(S.pct)).fg, borderColor: toneOf(toneFor(S.pct)).bd }}>{S.n ? `${pct(S.pct)} present` : "No school days yet"}</span>
          <div className="flex rounded-[10px] p-[3px]" style={{ background: "#F1F4F2" }}>
            {VIEWS.map(([key, text]) => <button key={key} type="button" onClick={() => go(key)} className="rounded-[8px] px-[11px] py-[5px] text-[11px] whitespace-nowrap" style={key === view ? { background: "#fff", color: "#0D2315", fontWeight: 700, boxShadow: "0 1px 2px rgba(13,35,21,0.14)" } : { color: "#5F6E65", fontWeight: 600 }}>{text}</button>)}
          </div>
          {view !== "All" ? (
            <div className="flex items-center gap-[4px]">
              <button type="button" disabled={index <= 0} onClick={() => go(view, list[index - 1]!)} aria-label="Earlier" className="h-[28px] w-[28px] rounded-[8px] border bg-white disabled:opacity-40" style={{ borderColor: "#DEE8E2" }}>‹</button>
              <button type="button" disabled={index >= list.length - 1} onClick={() => go(view, list[index + 1]!)} aria-label="Later" className="h-[28px] w-[28px] rounded-[8px] border bg-white disabled:opacity-40" style={{ borderColor: "#DEE8E2" }}>›</button>
              {cur !== now[view] && list.includes(now[view]) ? <button type="button" onClick={() => go(view, now[view])} className="rounded-[8px] border bg-white px-[10px] py-[5px] text-[11px] font-semibold" style={{ borderColor: "#DEE8E2", color: "#435048" }}>{({ Week: "This week", Month: "This month", Term: "This term", Year: "This session", All: "" } as const)[view]}</button> : null}
            </div>
          ) : null}
        </div>
      </section>

      <section className="grid gap-[10px]" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))" }}>
        {[
          { label: "Attendance", value: pct(S.pct), sub: `${S.present} of ${S.n} school days`, tone: toneFor(S.pct) },
          { label: "Days away", value: String(S.away.length), sub: awaySub, tone: S.away.some((day) => day.status === "ABSENT") ? ("attention" as PanelTone) : S.away.length ? ("neutral" as PanelTone) : ("positive" as PanelTone) },
          { label: "Late arrivals", value: String(S.late), sub: S.late ? "Still counted as present" : "None", tone: S.late ? ("attention" as PanelTone) : ("positive" as PanelTone) },
          { label: view === "All" ? "Since the first term" : `Compared with ${prevName}`, value: view === "All" && terms.length < 2 ? "—" : pts(delta), sub: view === "All" ? allSub : PS && PS.pct !== null ? `${prevName.charAt(0).toUpperCase()}${prevName.slice(1)} was ${pct(PS.pct)}` : "Nothing earlier on record", tone: delta === null ? ("neutral" as PanelTone) : delta >= 0 ? ("positive" as PanelTone) : ("attention" as PanelTone) },
          { label: "Longest run present", value: `${S.best} ${S.best === 1 ? "day" : "days"}`, sub: S.best ? `In a row, up to ${short(S.bestEnd)}` : "No school days yet", tone: "neutral" as PanelTone },
        ].map((card) => (
          <article key={card.label} className="rounded-[14px] border bg-[var(--color-bg-surface)] px-[14px] pb-[14px] pt-[13px]" style={{ borderColor: "#DEE8E2" }}>
            <p className="text-[9.5px] font-semibold uppercase tracking-[0.05em]" style={{ color: "#67766D" }}>{card.label}</p>
            <p className="mt-[8px] text-[20.5px] font-extrabold leading-none tracking-[-0.03em] tabular-nums" style={{ color: toneOf(card.tone).fg }}>{card.value}</p>
            <p className="mt-[6px] text-[10.5px] leading-[1.4]" style={{ color: "#67766D" }}>{card.sub}</p>
          </article>
        ))}
      </section>

      <section className="min-w-0 rounded-[14px] border bg-[var(--color-bg-surface)] px-[16px] pb-[14px] pt-[14px]" style={{ borderColor: "#DEE8E2" }}>
        <h3 className="text-[12.5px] font-semibold" style={{ color: "#0D2315" }}>{chartTitle}</h3>
        <p className="mt-[3px] text-[10.5px]" style={{ color: "#67766D" }}>{chartSub}</p>
        {series.length ? (
          <div className="mt-[12px] flex h-[140px] items-end gap-[8px] overflow-x-auto">
            {series.map((point) => {
              const swatch = toneOf(point.tone);
              return (
                <button key={point.label + point.tip} type="button" title={point.tip} onClick={point.go} disabled={!point.go} className="flex h-full min-w-[34px] flex-1 flex-col items-center justify-end gap-[5px]">
                  <span className="text-[9.5px] font-semibold tabular-nums" style={{ color: "#67766D" }}>{point.v === null ? "" : view === "Week" ? NAME[point.tip.split(" · ")[1] ?? ""] ?? "" : `${Math.round(point.v)}%`}</span>
                  <span className="w-full rounded-t-[6px]" style={{ height: point.v === null ? 4 : `${Math.max(point.v, 3) * 0.78}px`, background: point.v === null ? "#EEF2EF" : swatch.dot, outline: point.on ? "2px solid #0D2315" : "none", outlineOffset: 1 }} />
                  <span className="max-w-full truncate text-[9.5px]" style={{ color: point.on ? "#0D2315" : "#67766D", fontWeight: point.on ? 700 : 500 }}>{point.label}</span>
                </button>
              );
            })}
          </div>
        ) : <p className="mt-[12px] text-[11.5px]" style={{ color: "#8C9A92" }}>No school days to show yet.</p>}
        {view === "Week" && series.length ? <Legend keys={["PRESENT", "LATE", "EXCUSED", "ABSENT"]} /> : null}
      </section>

      <div className="grid min-w-0 gap-[14px] lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <Detail view={view} cur={cur} scope={scope} today={today} terms={terms} current={current} past={past} go={go} open={open} termRows={termRows} />
        <section className="min-w-0 rounded-[14px] border bg-[var(--color-bg-surface)] px-[16px] pb-[8px] pt-[14px]" style={{ borderColor: "#DEE8E2" }}>
          <h3 className="text-[12.5px] font-semibold" style={{ color: "#0D2315" }}>Days away and late arrivals</h3>
          <p className="mt-[3px] text-[10.5px]" style={{ color: "#67766D" }}>What happened, and who recorded it.</p>
          {away.length ? (
            <ul className="mt-[8px]">
              {away.map((record) => { const swatch = toneOf(TONE[record.status] ?? "neutral"); return (
                <li key={record.date} className="border-b last:border-b-0" style={{ borderColor: "#F2F7F4" }}>
                  <button type="button" onClick={() => open(record, record.date)} className="flex w-full items-start gap-[10px] py-[10px] text-left">
                    <span className="flex h-[38px] w-[38px] flex-none flex-col items-center justify-center rounded-[10px] border leading-none" style={{ background: swatch.bg, borderColor: swatch.bd, color: swatch.fg }}><span className="text-[8.5px] font-bold uppercase">{MONTHS[dayOf(record.date).getUTCMonth()]!.slice(0, 3)}</span><span className="mt-[2px] text-[14px] font-extrabold">{dayOf(record.date).getUTCDate()}</span></span>
                    <span className="min-w-0 flex-1"><span className="block text-[11.5px] font-semibold" style={{ color: "#0D2315" }}>{long(record.date)}</span><span className="mt-[2px] block text-[10.5px]" style={{ color: "#67766D" }}>{record.reason ?? (record.status === "LATE" ? "Arrived after the morning register. Counted as present." : record.status === "EXCUSED" ? "Excused." : "No reason recorded yet.")}</span></span>
                    <span className="flex-none rounded-full border px-[8px] py-[2.5px] text-[10px] font-semibold" style={{ background: swatch.bg, color: swatch.fg, borderColor: swatch.bd }}>{record.status === "ABSENT" ? "Not explained" : NAME[record.status]}</span>
                  </button>
                </li>
              ); })}
            </ul>
          ) : <p className="pb-[10px] pt-[10px] text-[11.5px]" style={{ color: "#8C9A92" }}>Present every school day in this period.</p>}
        </section>
      </div>

      <section className="flex min-w-0 items-start gap-[12px] rounded-[14px] border px-[17px] py-[15px]" style={{ background: toneOf("progress").bg, borderColor: toneOf("progress").bd }}>
        <div className="min-w-0">
          <p className="text-[11.5px] font-bold" style={{ color: toneOf("progress").fg }}>Absences are explained by your parent or guardian</p>
          <p className="mt-[3px] text-pretty text-[11px] leading-[1.55]" style={{ color: toneOf("progress").fg }}>{guardian ? `${guardian} can explain an absence in the Parent Portal. ` : ""}If you know you will be away, ask them to tell the school before the day.</p>
        </div>
      </section>
    </div>
  );
}

function Detail({ view, cur, scope, today, terms, current, past, go, open, termRows }: {
  view: View; cur: string; scope: Rec[]; today: string; terms: Term[]; current: string | null; past: Rec[]; go: (view: View, key?: string) => void; open: (record: Rec | undefined, date: string) => void;
  termRows: (subset: Term[]) => Array<{ term: Term; s: ReturnType<typeof summary> }>;
}) {
  const shell = "min-w-0 rounded-[14px] border bg-[var(--color-bg-surface)] px-[16px] pb-[14px] pt-[14px]";
  const cell = (date: string, label?: string) => {
    const rec = past.find((record) => record.date === date); const swatch = rec ? toneOf(TONE[rec.status] ?? "neutral") : null;
    return (
      <button key={date} type="button" disabled={!rec} onClick={() => open(rec, date)} className="flex min-h-[62px] min-w-0 flex-col justify-between rounded-[10px] p-[7px] text-left" style={swatch ? { background: swatch.bg, border: `1px solid ${date === today ? "#0D2315" : swatch.bd}` } : { background: "#FBFDFC", border: "1px dashed #E4EDE8" }}>
        <span className="text-[11.5px] font-bold" style={{ color: rec ? "#0D2315" : "#AAB8B0" }}>{label ?? `${WEEKDAY[dayOf(date).getUTCDay()]!.slice(0, 3)} ${dayOf(date).getUTCDate()}`}</span>
        <span className="truncate text-[9.5px] font-bold" style={{ color: swatch?.fg ?? "#AAB8B0" }}>{rec ? `${NAME[rec.status]}${date === today ? " · today" : ""}` : date > today ? "Coming up" : "No register"}</span>
      </button>
    );
  };
  if (view === "Week") return (
    <section className={shell} style={{ borderColor: "#DEE8E2" }}>
      <h3 className="text-[12.5px] font-semibold" style={{ color: "#0D2315" }}>The week, day by day</h3>
      <p className="mb-[10px] mt-[3px] text-[10.5px]" style={{ color: "#67766D" }}>Tap a day to see who marked it, and when.</p>
      <Dow />
      <div className="grid grid-cols-5 gap-[6px]">{[0, 1, 2, 3, 4].map((i) => cell(addDays(cur, i)))}</div>
      <Legend keys={["PRESENT", "LATE", "ABSENT", "EXCUSED"]} />
    </section>
  );
  if (view === "Month") {
    const y = Number(cur.slice(0, 4)); const mo = Number(cur.slice(5)) - 1; const lastDay = new Date(Date.UTC(y, mo + 1, 0)).getUTCDate();
    const lead = Math.min((new Date(Date.UTC(y, mo, 1)).getUTCDay() + 6) % 7, 5);
    const days: string[] = []; for (let d = 1; d <= lastDay; d += 1) { const date = `${cur}-${String(d).padStart(2, "0")}`; const w = dayOf(date).getUTCDay(); if (w > 0 && w < 6) days.push(date); }
    return (
      <section className={shell} style={{ borderColor: "#DEE8E2" }}>
        <h3 className="text-[12.5px] font-semibold" style={{ color: "#0D2315" }}>{MONTHS[mo]} {y}</h3>
        <p className="mb-[10px] mt-[3px] text-[10.5px]" style={{ color: "#67766D" }}>Tap a day to see who marked it, and when.</p>
        <Dow />
        <div className="grid grid-cols-5 gap-[6px]">{Array.from({ length: lead }, (_, i) => <span key={`g${i}`} />)}{days.map((date) => cell(date, String(dayOf(date).getUTCDate())))}</div>
        <Legend keys={["PRESENT", "LATE", "ABSENT", "EXCUSED"]} />
      </section>
    );
  }
  const head = "text-[9.5px] font-semibold uppercase tracking-[0.05em]";
  if (view === "Term") {
    const weeks = uniq(scope.map((record) => monday(record.date))).reverse();
    // Counted from the term's first Monday. Numbering by row position drifts
    // the moment a week in the middle has no register — a holiday week does.
    const termStart = terms.find((term) => term.id === cur)?.start;
    const weekNo = (m: string) => (termStart ? Math.floor((dayOf(m).getTime() - dayOf(monday(termStart)).getTime()) / (7 * 86_400_000)) + 1 : 0);
    return (
      <section className={shell} style={{ borderColor: "#DEE8E2" }}>
        <h3 className="text-[12.5px] font-semibold" style={{ color: "#0D2315" }}>Week by week</h3><p className="mb-[8px] mt-[3px] text-[10.5px]" style={{ color: "#67766D" }}>Open a week to see each day.</p>
        <div className="overflow-x-auto"><table className="w-full min-w-[420px] text-left"><thead><tr style={{ color: "#67766D" }}>{["Week", "Dates", "Present", "Away", "Late", "Rate"].map((h) => <th key={h} className={`${head} py-[6px] pr-[8px]`}>{h}</th>)}</tr></thead><tbody>
          {weeks.map((m, i) => { const s = summary(scope.filter((record) => monday(record.date) === m)); const swatch = toneOf(toneFor(s.pct)); return (
            <tr key={m} className="cursor-pointer border-t hover:bg-[#F1F8F4]" style={{ borderColor: "#F2F7F4" }} onClick={() => go("Week", m)}>
              <td className="py-[9px] pr-[8px] text-[11.5px] font-bold">W{weekNo(m) || weeks.length - i}</td><td className="pr-[8px] text-[11.5px]" style={{ color: "#435048" }}>{short(m)} – {short(addDays(m, 4))}</td><td className="pr-[8px] text-[11.5px] tabular-nums">{s.present} of {s.n}</td><td className="pr-[8px] text-[11.5px] tabular-nums">{s.away.length}</td><td className="pr-[8px] text-[11.5px] tabular-nums">{s.late}</td>
              <td><span className="rounded-full border px-[8px] py-[2px] text-[10.5px] font-semibold" style={{ background: swatch.bg, color: swatch.fg, borderColor: swatch.bd }}>{pct(s.pct)}</span></td>
            </tr>
          ); })}
        </tbody></table></div>
      </section>
    );
  }
  const subset = view === "Year" ? terms.filter((term) => term.session === cur) : terms.slice().reverse();
  const rows = termRows(subset);
  return (
    <section className={shell} style={{ borderColor: "#DEE8E2" }}>
      <h3 className="text-[12.5px] font-semibold" style={{ color: "#0D2315" }}>{view === "Year" ? `Terms in ${cur}` : "Every term on record"}</h3><p className="mb-[8px] mt-[3px] text-[10.5px]" style={{ color: "#67766D" }}>{view === "Year" ? "Open a term to see it week by week." : "Each figure matches the attendance line on that term’s report card."}</p>
      <div className="overflow-x-auto"><table className="w-full min-w-[560px] text-left"><thead><tr style={{ color: "#67766D" }}>{["Term", "Class", "Dates", "Present", "Away", "Late", "Rate"].map((h) => <th key={h} className={`${head} py-[6px] pr-[8px]`}>{h}</th>)}</tr></thead><tbody>
        {rows.map(({ term, s }) => { const swatch = toneOf(toneFor(s.pct)); return (
          <tr key={term.id} className="cursor-pointer border-t hover:bg-[#F1F8F4]" style={{ borderColor: "#F2F7F4", background: term.id === current ? "#F7FAF8" : undefined }} onClick={() => go("Term", term.id)}>
            <td className="py-[9px] pr-[8px]"><span className="block text-[11.5px] font-semibold">{term.name}</span><span className="block text-[10px]" style={{ color: "#67766D" }}>{term.session}{term.id === current ? " · now" : ""}</span></td>
            <td className="pr-[8px] text-[11.5px]">{term.arm}</td>
            <td className="whitespace-nowrap pr-[8px] text-[11.5px]" style={{ color: "#435048" }}>{short(term.start)} – {short(term.end)}</td>
            <td className="pr-[8px] text-[11.5px] tabular-nums">{s.present} of {s.n}</td><td className="pr-[8px] text-[11.5px] tabular-nums">{s.away.length}</td><td className="pr-[8px] text-[11.5px] tabular-nums">{s.late}</td>
            <td><span className="rounded-full border px-[8px] py-[2px] text-[10.5px] font-semibold" style={{ background: swatch.bg, color: swatch.fg, borderColor: swatch.bd }}>{pct(s.pct)}</span></td>
          </tr>
        ); })}
      </tbody></table></div>
    </section>
  );
}
