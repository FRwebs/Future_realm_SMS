import { apiGet } from "@/lib/api/server";
import { plural } from "@/lib/modules/live/m7-format";
import { FEES, applyUnappliedDrawer, closeDayDrawer, countDrawer, flagDrawer, naira, waiverDrawer } from "@/lib/modules/live/m10-forms";
import type { Review } from "@/lib/modules/live/m10-types";
import { name as nameCell, pill, text, type KpiCard, type PanelTone, type TabContent, type TableRow } from "@/lib/modules/panels";

/**
 * Review: supervise the finance function without running it. A day stays on the unreconciled list
 * until it has been counted by one person and closed by another.
 */

export const loadReview = () => apiGet<Review>(`${FEES}/review`);

const STATE_TONE: Record<string, PanelTone> = { Closed: "positive", "In progress": "progress", Unreconciled: "negative" };
const dayText = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "long" });
const token = (kind: string, value: string) => `${kind}:${value}|`;

export function reviewTab(data: Review): TabContent {
  const unapplied = data.flags.find((flag) => flag.key === "unapplied");
  const oldest = data.cashup.filter((day) => day.state === "Unreconciled").slice(-1)[0];
  const cards: KpiCard[] = [
    { label: "Unreconciled days", value: String(data.unreconciled), tone: data.unreconciled ? "negative" : "positive", sub: data.oldestUnreconciled ? `Oldest is ${dayText(data.oldestUnreconciled)}` : "Every day is closed" },
    { label: "Open variance", value: `${data.openVariance < 0 ? "−" : ""}${naira(Math.abs(data.openVariance))}`, tone: data.openVariance ? "attention" : "positive", sub: data.openVariance ? "Counted against recorded, on days not yet closed" : "Nothing unexplained" },
    { label: "Integrity flags", value: String(data.flagCount), tone: data.flagCount ? "attention" : "positive", sub: data.flagCount ? "Reviewable, and each says what it found" : "The books show nothing to review" },
    { label: "Pending waivers", value: String(data.waivers.length), tone: data.waivers.length ? "negative" : "positive", sub: data.waivers.length ? `${naira(data.waiverValue)} · oldest ${data.oldestWaiver} days` : "Nothing waiting", ...(data.waivers.length ? { link: "Decide", drawer: waiverDrawer(data.waivers[0]) } : {}) },
  ];
  const dayRows: TableRow[] = data.cashup.map((day) => {
    const open = day.state !== "Closed";
    const drawer = day.state === "Closed" ? undefined : day.counted === null ? countDrawer(day) : closeDayDrawer(day);
    return {
      id: day.day,
      cells: [
        text(dayText(day.day), { strong: true }),
        text(naira(day.recorded), { mono: true }),
        day.counted === null ? text("Not counted", { tone: day.state === "Unreconciled" ? "negative" : undefined, strong: day.state === "Unreconciled" }) : text(naira(day.counted), { mono: true }),
        day.variance === null ? text("—") : text(day.variance === 0 ? "₦0" : `${day.variance < 0 ? "−" : "+"}${naira(Math.abs(day.variance))}`, { mono: true, strong: day.variance !== 0, tone: day.variance ? "negative" : undefined }),
        nameCell(day.by, day.byRole || undefined),
        pill(day.state, STATE_TONE[day.state]),
        open && drawer ? { kind: "action", label: day.counted === null ? "Count" : "Close", drawer } : { kind: "action", label: "View", drawer: { mode: "view", kicker: "Review · cash-up", title: dayText(day.day), facts: [["Recorded", naira(day.recorded)], ["Counted", day.counted === null ? "—" : naira(day.counted)], ["Variance", day.variance === null ? "—" : naira(day.variance)], ["Note", day.note ?? "None"]], readOnly: true, readOnlyNote: "A closed day is a record, not a draft." } },
      ],
      keywords: `${token("state", day.state)}${token("variance", day.variance ? "Any variance" : "Balanced")}${token("by", day.by)}`,
    };
  });
  const people = Array.from(new Set(data.cashup.map((day) => day.by).filter((name) => name !== "—")));
  const waiverRows: TableRow[] = data.waivers.map((row) => ({
    id: row.id,
    cells: [nameCell(row.family, row.child), text(row.type), text(naira(row.value), { mono: true, strong: true }), text(row.reason), text(`${row.days} days`, { tone: row.days > 14 ? "negative" : row.days > 7 ? "attention" : undefined, strong: row.days > 7 }), { kind: "action", label: "Decide", drawer: waiverDrawer(row) }],
    drawer: waiverDrawer(row),
  }));
  return {
    title: "Review",
    desc: "Supervise the finance function without running it.",
    primary: oldest ? { label: oldest.counted === null ? `Count ${dayText(oldest.day)}` : `Close ${dayText(oldest.day)}`, icon: "M5 12.5l4.5 4.5 9-10", drawer: oldest.counted === null ? countDrawer(oldest) : closeDayDrawer(oldest) } : undefined,
    rows: [
      { cols: "1fr", panels: [{ type: "kpi", title: "Finance exceptions", sub: data.term, per: 4, cards }] },
      ...(data.unreconciled
        ? [{ cols: "1fr", panels: [{ type: "note" as const, tone: "attention" as PanelTone, title: `${plural(data.unreconciled, "day remains", "days remain")} unreconciled${data.oldestUnreconciled ? ` — the oldest is ${dayText(data.oldestUnreconciled)}` : ""}`, body: "A cash-up stays on this list until it has been counted and closed — by two different people. It appears in Command Center · Oversight while it does.", acts: oldest ? [{ label: oldest.counted === null ? `Count ${dayText(oldest.day)}` : `Close ${dayText(oldest.day)}`, drawer: oldest.counted === null ? countDrawer(oldest) : closeDayDrawer(oldest) }] : [] }] }]
        : []),
      {
        cols: "1fr",
        panels: [
          {
            type: "table",
            title: "Daily cash-up",
            sub: "Cash and cheques recorded, counted by hand, and the difference.",
            meta: `${data.term} · ${plural(data.cashup.length, "day")}`,
            noun: "day",
            nounPlural: "days",
            filters: [
              { label: "State", value: "All", options: ["All", "Closed", "Unreconciled", "In progress"], match: Object.fromEntries(["Closed", "Unreconciled", "In progress"].map((name) => [name, token("state", name)])) },
              { label: "Variance", value: "All", options: ["All", "Any variance", "Balanced"], match: { "Any variance": token("variance", "Any variance"), Balanced: token("variance", "Balanced") } },
              { label: "Recorded by", value: "All", options: ["All", ...people], match: Object.fromEntries(people.map((name) => [name, token("by", name)])) },
            ],
            head: ["Date", "Recorded", "Counted", "Variance", "Recorded by", "State", "Action"],
            rows: dayRows,
            noRowOpen: true,
            per: 8,
            emptyTitle: "No cash has been taken",
            emptyBody: "A day appears here once a cash or cheque payment is recorded on it.",
            foot: "Card and transfer payments are reconciled against the bank, not counted. Whoever counts a day cannot close it.",
          },
        ],
      },
      {
        cols: "1.05fr 1fr",
        panels: [
          {
            type: "table",
            title: "By recorder",
            sub: "Who took the money, and how much of it needed correcting.",
            noun: "recorder",
            nounPlural: "recorders",
            head: ["Person", "Payments", "Value", "Reversals", "Duplicates"],
            rows: data.recorders.map((row): TableRow => ({ cells: [nameCell(row.name, row.role.replace(/_/g, " ").toLowerCase() || undefined), text(row.n.toLocaleString("en-NG")), text(naira(row.value), { mono: true }), text(String(row.reversals), { tone: row.reversals ? "attention" : undefined }), text(String(row.duplicates), { tone: row.duplicates ? "attention" : undefined })] })),
            emptyTitle: "No payment recorded",
            emptyBody: "Recorders appear once money has been taken.",
          },
          {
            type: "table",
            title: "Integrity flags",
            sub: "Each reviewable — and each says what it found.",
            meta: `${data.flagCount} open`,
            noun: "flag",
            nounPlural: "flags",
            head: ["Flag", "Count", "What was found", "Action"],
            rows: data.flags.map((flag): TableRow => {
              const drawer = flag.key === "unapplied" && flag.count ? applyUnappliedDrawer(flag.count) : flagDrawer(flag);
              return { cells: [text(flag.label, { strong: true }), text(String(flag.count), { tone: flag.count && flag.key !== "reversed" ? "attention" : undefined }), text(flag.found), { kind: "action", label: flag.count ? flag.action : "View", drawer: flag.count && flag.key === "unapplied" ? drawer : flagDrawer(flag) }], drawer };
            }),
            noRowOpen: true,
          },
        ],
      },
      {
        cols: "1fr",
        panels: [
          {
            type: "table",
            title: "Pending discounts and waivers",
            tag: plural(data.waivers.length, "request"),
            tagTone: data.waivers.length ? "attention" : "positive",
            meta: `${data.waivers.length} pending · ${naira(data.waiverValue)} in value`,
            sub: "Decided by the Proprietor or the Principal — never by whoever asked.",
            noun: "request",
            nounPlural: "requests",
            head: ["Family", "Type", "Value", "Reason", "Age", "Decide"],
            rows: waiverRows,
            emptyTitle: "Nothing waiting",
            emptyBody: "An adjustment above the bursary’s limit waits here for a decision.",
          },
        ],
      },
      ...(unapplied && unapplied.count ? [] : []),
    ],
  };
}
