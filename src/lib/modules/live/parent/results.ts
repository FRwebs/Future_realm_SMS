import { apiGet, observe } from "@/lib/api/server";
import { localContracts } from "@/lib/api/local-contracts.zod";
import { name as nameCell, pill, row, text } from "@/lib/modules/panels";
import type { DrawerSpec, LinePoint, ListItem, PanelFact, PanelTone, TableRow } from "@/lib/modules/panels";
import { termShort } from "@/lib/modules/panels";
import { PW, dLong, dShort, loadMe } from "@/lib/modules/live/parent/shared";
import type { ParentContent } from "@/lib/modules/live/parent/shared";

type Component = { name: string; short: string; max: number; score: number | "ABS" | null };
type Subject = { name: string; teacher: string | null; components: Component[]; total: number | null; grade: string | null; remark: string; pos: number | null; outOf: number; classAvg: number | null };
type Card = {
  id: string; term: string; session: string; published: string; reference: string | null; held: { since: string; reason: string } | null;
  card: null | {
    arm: string; formMaster: string | null; average: number | null; grade: string | null; gradeRemark: string | null; position: number | null; outOf: number;
    attendance: { days: number; present: number; absent: number; pct: number | null }; scheme: string; frameworkNote: string;
    teacherRemark: string; teacherBy: string | null; principalRemark: string; principalBy: string | null; resumption: string | null;
    traits: Array<{ title: string; items: Array<{ label: string; value: string }> }>; subjects: Subject[];
  };
};
type Kid = {
  id: string; first: string; arm: string; cards: Card[];
  released: Array<{ name: string; parts: Array<{ code: string; name: string; max: number; score: number | null; on: string | null }> }>;
};
type Results = {
  showCards: boolean; term: { name: string; session: string } | null;
  components: Array<{ id: string; code: string; name: string; weight: number; max: number }>;
  ahead: Array<{ what: string; on: string; appliesTo: string }>;
  children: Kid[];
};

const TABS = ["Report card", "Progress over time"];
const num = (value: number | null | undefined, places = 1) => (value === null || value === undefined ? "—" : String(Math.round(value * 10 ** places) / 10 ** places));
const ord = (n: number) => `${n}${["th", "st", "nd", "rd"][(n % 100 >= 11 && n % 100 <= 13) ? 0 : Math.min(n % 10, 4) % 4] ?? "th"}`;
const gradeTone = (total: number | null): PanelTone => (total === null ? "neutral" : total >= 70 ? "positive" : total >= 50 ? "progress" : "attention");
const latestOf = (kid: Kid) => kid.cards.find((card) => card.card) ?? null;
const bestAndLowest = (card: NonNullable<Card["card"]>) => {
  const scored = card.subjects.filter((subject) => subject.total !== null);
  const sorted = [...scored].sort((a, b) => (b.total ?? 0) - (a.total ?? 0));
  return { best: sorted[0] ?? null, low: sorted[sorted.length - 1] ?? null };
};

export async function resultsPage(child: string, query: Record<string, string | undefined>): Promise<ParentContent> {
  const [me, data] = await Promise.all([loadMe(), apiGet(`${PW}/results?child=${encodeURIComponent(child)}`, observe<Results>(localContracts["src/lib/modules/live/parent/results.ts#dc63be9f"]))]);
  const one = child === "all" ? null : data.children.find((entry) => entry.id === child) ?? null;
  return one ? childResults(one, data, me.school, query) : familyResults(data);
}

/** What the school has released since the last report card, subject by subject. */
function releasedDrawer(kid: Kid, term: string): DrawerSpec {
  return {
    kicker: kid.first, title: `${term} scores so far`, mode: "view", readOnly: true,
    sub: "Only scores the school has approved and released.",
    facts: kid.released.map((subject): PanelFact => [
      subject.name,
      subject.parts.map((part) => `${part.code} ${part.score === null ? "—" : `${part.score} / ${part.max}`}`).join("  ·  "),
      subject.parts.filter((part) => part.score === null && part.on).map((part) => `${part.name} released ${dShort(part.on!)}`).join(" · "),
    ]),
  };
}

function explainDrawer(kid: Kid, card: Card, subject: Subject, scheme: string): DrawerSpec {
  const parts = subject.components.map((part): PanelFact => [part.name, part.score === null ? "Not entered" : part.score === "ABS" ? "Absent" : `${part.score} of ${part.max}`]);
  return {
    kicker: `Explain this result · ${kid.first}`, title: `${subject.name} · ${subject.total ?? "—"}${subject.grade ? ` · ${subject.grade}` : ""}`,
    mode: "view", readOnly: true, sub: `${card.term} ${card.session}${subject.teacher ? ` · taught by ${subject.teacher}` : ""}`,
    facts: [
      ...parts,
      ["Total", subject.total === null ? "—" : String(subject.total), subject.grade ? `Grade ${subject.grade}` : "", gradeTone(subject.total)],
      ["Position in class", subject.pos ? `${ord(subject.pos)} of ${subject.outOf}` : "Not ranked", subject.classAvg !== null ? `Class average ${num(subject.classAvg)}` : ""],
      ...(subject.remark ? [["Teacher’s remark", subject.remark] as PanelFact] : []),
      ["How the score is built", scheme || "As the school’s framework sets out", "Published exactly as the school issued it"],
    ],
  };
}

function cardDrawer(kid: Kid, card: Card): DrawerSpec {
  const data = card.card;
  return {
    kicker: kid.first, title: `${card.term} ${card.session} report card`, mode: "view", readOnly: true,
    sub: `Published ${dLong(card.published)}${card.reference ? ` · ${card.reference}` : ""}`,
    facts: card.held
      ? [["Held by the school", card.held.reason || "The school has not given a reason", `Since ${dLong(card.held.since)}`, "withheld"] as PanelFact]
      : data
        ? [
            ["Class", data.arm], ["Average", num(data.average), data.grade ? `Grade ${data.grade}` : ""],
            ["Position", data.position ? `${ord(data.position)} of ${data.outOf}` : "Not ranked"],
            ["Attendance", `${data.attendance.present} of ${data.attendance.days} days`, data.attendance.pct !== null ? `${num(data.attendance.pct)}%` : ""],
          ]
        : [["Report card", "Not available to read here", "Ask the school for the printed copy"]],
  };
}

function familyResults(data: Results): ParentContent {
  const kids = data.children;
  const ahead = data.ahead.slice(0, 6).map((entry): ListItem => ({
    lead: { top: dShort(entry.on).split(" ")[1]?.toUpperCase() ?? "", value: dShort(entry.on).split(" ")[0] ?? "", tone: "attention" },
    label: `${entry.what} released`, sub: entry.appliesTo, pill: "Results", tone: "attention",
  }));
  const released: ListItem[] = kids.map((kid) => ({
    label: `${kid.first} · ${data.term ? data.term.name : "This term"} so far`,
    sub: kid.released.length ? `${kid.released.length} ${kid.released.length === 1 ? "subject has" : "subjects have"} scores released` : "Nothing has been released for this term yet.",
    pill: kid.released.length ? "Released" : "Not yet", tone: kid.released.length ? "positive" : "neutral",
    ...(kid.released.length ? { viewLabel: "See scores", drawer: releasedDrawer(kid, data.term?.name ?? "This term") } : { href: `/portals/parent/results?child=${kid.id}` }),
  }));
  return {
    eyebrow: "Whole family", title: "Results and reports",
    desc: "Each child’s own report card, side by side — never blended into one number.",
    rows: [
      row("1fr", [{
        type: "table", title: "Latest report cards", sub: "Tap a child for the full card.", noun: "child", nounPlural: "children", dense: true,
        head: ["Child", "Report", "Average", "Position", "Strongest", "Lowest", ""],
        rows: kids.map((kid): TableRow => {
          const latest = latestOf(kid);
          const held = kid.cards[0]?.held ?? null;
          const card = latest?.card ?? null;
          const { best, low } = card ? bestAndLowest(card) : { best: null, low: null };
          return {
            href: `/portals/parent/results?child=${kid.id}`, keywords: kid.first,
            cells: [
              nameCell(kid.first, kid.arm, { avatar: false }),
              held ? nameCell(`${kid.cards[0]!.term} ${kid.cards[0]!.session}`, "Held by the school", { avatar: false }) : latest ? nameCell(`${latest.term} ${latest.session}`, `Published ${dLong(latest.published)}`, { avatar: false }) : text("No report card yet"),
              text(card ? num(card.average) : "—", { strong: true, mono: true }),
              text(card?.position ? `${ord(card.position)} of ${card.outOf}` : "Not ranked"),
              best ? nameCell(best.name, `${best.total}${best.grade ? ` · ${best.grade}` : ""}`, { avatar: false }) : text("—"),
              low && low !== best ? nameCell(low.name, `${low.total}${low.grade ? ` · ${low.grade}` : ""}`, { avatar: false }) : text("—"),
              { kind: "action", label: "Open", href: `/portals/parent/results?child=${kid.id}` },
            ],
          };
        }),
        empty: "No child on your account has a report card yet.",
        foot: data.showCards ? "Report cards are shown exactly as the school published them." : "Your school has not made report cards visible to parents.",
      }]),
      row("minmax(0,1fr) minmax(0,1fr)", [
        { type: "list", title: "Released this term", sub: "Only scores the school has approved and released.", items: released, empty: "No child is linked to your account yet." },
        { type: "list", title: "Results days ahead", sub: "When the school will release the next set of scores.", items: ahead, empty: "No results day has been set yet." },
      ]),
    ],
  };
}

function childResults(kid: Kid, data: Results, school: string, query: Record<string, string | undefined>): ParentContent {
  const tab = TABS.includes(query.tab ?? "") ? query.tab! : TABS[0]!;
  const withData = kid.cards.filter((card) => card.card);
  const head = {
    eyebrow: `${kid.first} · ${kid.arm}`, title: "Results and reports",
    tabs: [{ label: TABS[0]! }, { label: TABS[1]!, count: withData.length || undefined }], tab,
    desc: tab === TABS[1]
      ? `Every report card ${kid.first} has received at ${school}, kept exactly as it was published.`
      : "Latest report card and this term’s released scores. Tap any subject to see how its score was reached.",
    ...(withData.length && !kid.cards[0]?.held ? { primary: { label: "Printable report card", href: `/api/v1/reports/report-card/${kid.id}` } } : {}),
  };

  if (tab === TABS[1]) {
    const cards = [...withData].reverse();
    const points: LinePoint[] = cards.filter((card) => card.card!.average !== null).map((card, index, all) => ({
      label: termShort(card.term, card.session), v: card.card!.average, tip: `${card.term} ${card.session} · average ${num(card.card!.average)}`,
      tone: index === all.length - 1 ? "positive" : "progress", on: index === all.length - 1,
    }));
    return {
      ...head,
      rows: [
        row("1fr", [{ type: "line", title: "Average term by term", sub: `Every report card on record for ${kid.first}.`, points, empty: `No report card has been published for ${kid.first} yet.` }]),
        row("1fr", [{
          type: "table", title: "Every report card", sub: "Kept exactly as published.", noun: "report card", nounPlural: "report cards", dense: true, per: 12,
          head: ["Report card", "Class", "Average", "Position", "Grade", "Attendance", "Published"],
          rows: kid.cards.map((card): TableRow => ({
            keywords: `${card.term} ${card.session}`,
            drawer: cardDrawer(kid, card),
            cells: [
              nameCell(`${card.term} ${card.session}`, card.held ? "Held by the school" : card.reference ?? "", { avatar: false }),
              text(card.card?.arm ?? "—"), text(card.card ? num(card.card.average) : "—", { strong: true, mono: true }),
              text(card.card?.position ? `${ord(card.card.position)} of ${card.card.outOf}` : "Not ranked"),
              card.card?.grade ? pill(card.card.grade, gradeTone(card.card.average)) : text("—"),
              text(card.card ? `${card.card.attendance.present} of ${card.card.attendance.days}` : "—", { mono: true }),
              text(dShort(card.published)),
            ],
          })),
          empty: `No report card has been published for ${kid.first} yet.`,
        }]),
      ],
    };
  }

  const newest = kid.cards[0] ?? null;
  const latest = newest?.held ? newest : withData[0] ?? null;
  const soFar: PanelFact[] = data.components.map((component) => {
    const scores = kid.released.flatMap((subject) => subject.parts.filter((part) => part.code === component.code && part.score !== null).map((part) => part.score as number));
    const when = kid.released.flatMap((subject) => subject.parts.filter((part) => part.code === component.code && part.on).map((part) => part.on as string)).sort()[0];
    return scores.length
      ? [component.name, `${num(scores.reduce((sum, value) => sum + value, 0) / scores.length)} / ${component.max}`, `Average across ${scores.length} ${scores.length === 1 ? "subject" : "subjects"}`, "positive"] as PanelFact
      : [component.name, "Not yet", when ? `Released ${dShort(when)}` : "No date set yet"] as PanelFact;
  });
  const rows: Array<ReturnType<typeof row>> = [];
  rows.push(row("1fr", [{
    type: "facts", title: `${data.term?.name ?? "This term"} so far`, per: 4,
    sub: kid.released.length ? "Released since the last report card." : "Nothing has been released for this term yet.",
    facts: soFar.length ? soFar : [["Scores", "Not set up", "The school has not set its assessment components yet."]],
    ...(kid.released.length ? { acts: [{ label: "By subject", drawer: releasedDrawer(kid, data.term?.name ?? "This term") }] } : {}),
  }]));

  if (!data.showCards) {
    rows.push(row("1fr", [{ type: "note", tone: "neutral", title: "Report cards are not shown here", body: `${school} has chosen not to show report cards to parents in the portal. Ask the school office for a copy.` }]));
    return { ...head, rows };
  }
  if (!latest) {
    rows.push(row("1fr", [newest
      ? { type: "note", tone: "neutral", title: `${kid.first}’s ${newest.term} report card was published ${dLong(newest.published)}`, body: "The portal cannot lay this one out — it was issued before report cards were kept in the portal’s format. The printable copy is complete.", acts: [{ label: "Printable report card", href: `/api/v1/reports/report-card/${kid.id}` }] }
      : { type: "note", tone: "neutral", title: "No report card has been published yet", body: `${kid.first}’s first report card appears here the day the school publishes it.` }]));
    return { ...head, rows };
  }
  if (latest.held) {
    rows.push(
      row("1fr", [{
        type: "note", tone: "withheld", title: `${kid.first}’s ${latest.term} report card is held by the school`,
        body: `${latest.held.reason ? `${latest.held.reason.replace(/[.\s]+$/, "")}.` : "The school has not said why."} The card itself is complete and unchanged — it opens the moment the school releases it.`,
        acts: [{ label: "See fees and payments", href: `/portals/parent/fees?child=${kid.id}` }],
      }]),
      row("1fr", [{ type: "facts", title: "Why it is held", per: 3, facts: [["Held since", dLong(latest.held.since), "By the school"], ["Reason", latest.held.reason || "Not given"], ["Released by", "The school", "You are told when it is"]] }]),
    );
    return { ...head, rows };
  }

  const card = latest.card!;
  const { best } = bestAndLowest(card);
  const names = card.subjects[0]?.components ?? [];
  rows.push(
    row("1fr", [{
      type: "kpi", bare: true, per: 4,
      cards: [
        { label: "Average", value: num(card.average), sub: `${latest.term} ${latest.session}`, tone: "progress" as PanelTone, icon: "listCheck" },
        { label: "Position", value: card.position ? `${ord(card.position)} of ${card.outOf}` : "Not ranked", sub: card.position ? `In ${card.arm}` : "The school does not rank this class", tone: "neutral" as PanelTone, icon: "person" },
        { label: "Strongest", value: best?.name ?? "—", sub: best ? `${best.total}${best.grade ? ` · ${best.grade}` : ""}` : "", tone: "positive" as PanelTone, icon: "trendUp" },
        { label: "Attendance that term", value: `${card.attendance.present} of ${card.attendance.days}`, sub: card.attendance.pct !== null ? `${num(card.attendance.pct)}% of school days present` : "School days present", tone: "neutral" as PanelTone, icon: "calendar", href: `/portals/parent/attendance?child=${kid.id}` },
      ],
    }]),
    row("1fr", [{
      type: "table", title: `${latest.term} ${latest.session} report card`, sub: `Published ${dLong(latest.published)}. Tap any subject to see how its score was reached.`,
      noun: "subject", nounPlural: "subjects", dense: true, per: 0,
      head: ["Subject", ...names.map((part) => `${part.short} · ${part.max}`), "Total", "Grade", "Position"],
      rows: card.subjects.map((subject): TableRow => ({
        keywords: subject.name, drawer: explainDrawer(kid, latest, subject, card.frameworkNote),
        cells: [
          nameCell(subject.name, subject.teacher ?? "", { avatar: false }),
          ...names.map((part) => { const own = subject.components.find((item) => item.short === part.short); return text(own?.score === null || own?.score === undefined ? "—" : String(own.score), { mono: true }); }),
          text(subject.total === null ? "—" : String(subject.total), { strong: true, mono: true }),
          subject.grade ? pill(subject.grade, gradeTone(subject.total)) : text("—"),
          text(subject.pos ? ord(subject.pos) : "—"),
        ],
      })),
      foot: card.frameworkNote || undefined,
    }]),
    row("minmax(0,1.2fr) minmax(0,1fr)", [
      {
        type: "list", title: "What the teachers wrote",
        items: [
          ...(card.teacherRemark ? [{ label: card.teacherRemark, sub: card.teacherBy ?? "Form master" } as ListItem] : []),
          ...(card.principalRemark ? [{ label: card.principalRemark, sub: card.principalBy ?? "Principal" } as ListItem] : []),
        ],
        empty: "No remark was written on this card.",
      },
      card.traits.length
        ? { type: "facts", title: "Conduct and skills", sub: `Rated by the ${card.formMaster ? "form master" : "school"}.`, per: 3, facts: card.traits.flatMap((group) => group.items.map((item): PanelFact => [item.label, item.value, group.title])) }
        : {
            type: "list", title: "Earlier report cards", acts: [{ label: "All of them", href: `/portals/parent/results?child=${kid.id}&tab=Progress+over+time` }],
            empty: "This is the first report card.",
            items: withData.slice(1, 4).map((entry): ListItem => ({
              label: `${entry.term} ${entry.session}`, sub: `${entry.card!.arm} · average ${num(entry.card!.average)} · published ${dShort(entry.published)}`, pill: "Open", tone: "progress", drawer: cardDrawer(kid, entry),
            })),
          },
    ]),
  );
  return { ...head, rows };
}
