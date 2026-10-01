import { apiGet } from "@/lib/api/server";
import type { ReportCardView } from "@/lib/domain/types";
import {
  name as nameCell,
  pill,
  text,
  type DrawerSpec,
  type KpiCard,
  type PanelTone,
  type TabContent,
  type TableRow,
} from "@/lib/modules/panels";

/**
 * M06 Report Cards, read from `GET /v1/academics/report-cards`.
 *
 * One call serves all three tabs, because they are three questions about the
 * same set of cards: who still owes a remark, how far generation has got, and
 * what has already gone out. Fetching per tab would run the same query three
 * times for three views of it.
 */

const STATUS_TONE: Record<ReportCardView["status"], PanelTone> = {
  DRAFT: "attention",
  GENERATED: "progress",
  PUBLISHED: "positive",
  LOCKED: "neutral",
};

function dateLabel(iso: string | undefined): string {
  if (!iso) return "—";
  const date = new Date(iso);
  return Number.isNaN(date.getTime())
    ? "—"
    : date.toLocaleDateString("en-NG", { day: "numeric", month: "short" });
}

function score(value: number | undefined): string {
  return typeof value === "number" && Number.isFinite(value)
    ? `${Math.round(value * 10) / 10}`
    : "—";
}

/**
 * A card is read, never edited from here: the remark belongs to the teacher who
 * wrote it and the mark to the sheet it came from. The drawer says what is
 * missing and who owes it, which is the thing this module is asked.
 */
function cardDrawer(card: ReportCardView): DrawerSpec {
  const owes: string[] = [];
  if (!card.classTeacherRemark?.trim()) owes.push("class teacher's remark");
  if (!card.principalRemark?.trim()) owes.push("principal's remark");

  return {
    kicker: card.className,
    title: card.studentName,
    sub: `${card.term} · ${card.status.toLowerCase()}`,
    tone: owes.length ? "attention" : STATUS_TONE[card.status],
    readOnly: true,
    readOnlyNote: owes.length
      ? `Still waiting on the ${owes.join(" and ")}. A remark is written where it is owed, not here.`
      : "Both remarks are in. This is the card as it stands.",
    facts: [
      ["Student", card.studentName],
      ["Class", card.className],
      ["Term", card.term],
      ["Session", card.session ?? "—"],
      ["State", card.status],
      ["Total", score(card.total)],
      ["Average", score(card.average)],
      ["Grade", card.grade ?? "—"],
      [
        "Class teacher's remark",
        card.classTeacherRemark?.trim() || "Not written",
        card.classTeacherRemark?.trim() ? undefined : "The card cannot go out without it",
      ],
      ["Principal's remark", card.principalRemark?.trim() || "Not written"],
      ["Published", dateLabel(card.publishedAt)],
      ["Locked", dateLabel(card.lockedAt)],
    ],
  };
}

function countBy<T extends string>(items: T[]): Record<string, number> {
  return items.reduce<Record<string, number>>((acc, key) => {
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});
}

export function remarksTab(cards: ReportCardView[]): TabContent {
  const missingTeacher = cards.filter((card) => !card.classTeacherRemark?.trim());
  const missingPrincipal = cards.filter((card) => !card.principalRemark?.trim());
  const complete = cards.filter(
    (card) => card.classTeacherRemark?.trim() && card.principalRemark?.trim(),
  );

  // Who owes what, by arm — a remark is chased through a class teacher, not a
  // student at a time.
  const byClass = Object.entries(
    missingTeacher.reduce<Record<string, number>>((acc, card) => {
      acc[card.className] = (acc[card.className] ?? 0) + 1;
      return acc;
    }, {}),
  ).sort((a, b) => b[1] - a[1]);

  const cardsKpi: KpiCard[] = [
    { label: "Cards in the term", value: String(cards.length), sub: "Every student with a card" },
    {
      label: "Both remarks in",
      value: `${complete.length} of ${cards.length}`,
      tone: complete.length === cards.length ? "positive" : "attention",
      sub: cards.length ? `${Math.round((complete.length / cards.length) * 100)}% ready to go out` : "No card yet",
    },
    {
      label: "No class teacher remark",
      value: String(missingTeacher.length),
      tone: missingTeacher.length > 0 ? "negative" : "positive",
      sub: byClass.length ? `Worst: ${byClass[0][0]} (${byClass[0][1]})` : "Nothing outstanding",
    },
    {
      label: "No principal remark",
      value: String(missingPrincipal.length),
      tone: missingPrincipal.length > 0 ? "attention" : "positive",
      sub: missingPrincipal.length ? "Written after the class teacher's" : "Nothing outstanding",
    },
  ];

  const rows: TableRow[] = cards
    .filter((card) => !card.classTeacherRemark?.trim() || !card.principalRemark?.trim())
    .map((card) => ({
      cells: [
        nameCell(card.studentName, card.className),
        pill(
          card.classTeacherRemark?.trim() ? "In" : "Missing",
          card.classTeacherRemark?.trim() ? "positive" : "negative",
        ),
        pill(
          card.principalRemark?.trim() ? "In" : "Missing",
          card.principalRemark?.trim() ? "positive" : "attention",
        ),
        text(score(card.average)),
        pill(card.status, STATUS_TONE[card.status]),
        { kind: "action" as const, label: "Open", drawer: cardDrawer(card) },
      ],
      drawer: cardDrawer(card),
      keywords: `${card.className} ${card.term}`,
    }));

  return {
    title: "Remarks",
    desc: "Which cards are still waiting on something somebody has to write.",
    launchers: [{ label: "Completion", href: "/report-cards/completion" }],
    rows: [
      {
        cols: "1fr",
        panels: [{ type: "kpi", title: "What is still owed", per: 4, cards: cardsKpi }],
      },
      {
        cols: "1fr",
        panels: [
          {
            type: "table",
            title: "Cards waiting on a remark",
            sub: rows.length
              ? `${rows.length} card${rows.length === 1 ? "" : "s"} missing at least one remark.`
              : "Every card has both remarks.",
            head: ["Student", "Class teacher", "Principal", "Average", "State", ""],
            rows,
            per: 10,
            empty: "Nothing is waiting on a remark.",
          },
        ],
      },
    ],
  };
}

export function completionTab(cards: ReportCardView[]): TabContent {
  const byStatus = countBy(cards.map((card) => card.status));
  const published = byStatus.PUBLISHED ?? 0;
  const locked = byStatus.LOCKED ?? 0;
  const draft = byStatus.DRAFT ?? 0;
  const generated = byStatus.GENERATED ?? 0;

  const blocked = cards.filter((card) => !card.classTeacherRemark?.trim());

  const cardsKpi: KpiCard[] = [
    { label: "Cards in the term", value: String(cards.length), sub: "Across every arm" },
    {
      label: "Would generate now",
      value: String(cards.length - blocked.length),
      tone: blocked.length === 0 ? "positive" : "attention",
      sub: blocked.length ? `${blocked.length} held by a missing remark` : "Nothing is blocked",
    },
    {
      label: "Published",
      value: `${published} of ${cards.length}`,
      tone: published === cards.length && cards.length > 0 ? "positive" : "attention",
      sub: locked ? `${locked} locked after publication` : "None locked yet",
    },
    {
      label: "Still draft",
      value: String(draft),
      tone: draft > 0 ? "attention" : "positive",
      sub: `${generated} generated but not published`,
    },
  ];

  // One row per arm: how far that class has got, which is the unit this is
  // chased in.
  const arms = Object.entries(
    cards.reduce<Record<string, ReportCardView[]>>((acc, card) => {
      (acc[card.className] ??= []).push(card);
      return acc;
    }, {}),
  ).sort((a, b) => a[0].localeCompare(b[0]));

  const rows: TableRow[] = arms.map(([className, armCards]) => {
    const armPublished = armCards.filter((card) => card.status === "PUBLISHED").length;
    const armBlocked = armCards.filter((card) => !card.classTeacherRemark?.trim()).length;
    const pct = Math.round((armPublished / armCards.length) * 100);

    return {
      cells: [
        nameCell(className, `${armCards.length} card${armCards.length === 1 ? "" : "s"}`),
        text(`${armPublished} / ${armCards.length}`, {
          tone: armPublished === armCards.length ? "positive" : "attention",
        }),
        text(`${pct}%`),
        text(String(armBlocked), { tone: armBlocked > 0 ? "negative" : "neutral" }),
        pill(
          armPublished === armCards.length ? "Published" : armBlocked ? "Blocked" : "In progress",
          armPublished === armCards.length ? "positive" : armBlocked ? "negative" : "progress",
        ),
      ],
      keywords: className,
    };
  });

  return {
    title: "Completion",
    desc: "How far each arm has got, and what is holding the rest of them up.",
    launchers: [{ label: "Remarks", href: "/report-cards/remarks" }],
    rows: [
      {
        cols: "1fr",
        panels: [{ type: "kpi", title: "Where generation stands", per: 4, cards: cardsKpi }],
      },
      {
        cols: "1fr",
        panels: [
          {
            type: "table",
            title: "By class arm",
            sub: arms.length
              ? `${arms.length} arm${arms.length === 1 ? "" : "s"} with cards this term.`
              : "No card has been raised this term.",
            head: ["Class", "Published", "Complete", "Blocked", "State"],
            rows,
            per: 10,
            empty: "No arm has a card yet.",
          },
        ],
      },
    ],
  };
}

export function archiveTab(cards: ReportCardView[]): TabContent {
  const out = cards
    .filter((card) => card.status === "PUBLISHED" || card.status === "LOCKED")
    .sort((a, b) => (b.publishedAt ?? "").localeCompare(a.publishedAt ?? ""));

  const cardsKpi: KpiCard[] = [
    { label: "Cards issued", value: String(out.length), sub: "Published or locked" },
    {
      label: "Locked",
      value: String(out.filter((card) => card.status === "LOCKED").length),
      sub: "Cannot be changed again",
    },
    {
      label: "Still unissued",
      value: String(cards.length - out.length),
      tone: cards.length - out.length > 0 ? "attention" : "positive",
      sub: "Draft or generated",
    },
  ];

  const rows: TableRow[] = out.map((card) => ({
    cells: [
      nameCell(card.studentName, card.className),
      text(card.term),
      text(score(card.average)),
      text(card.grade ?? "—"),
      text(dateLabel(card.publishedAt)),
      pill(card.status, STATUS_TONE[card.status]),
      { kind: "action" as const, label: "Open", drawer: cardDrawer(card) },
    ],
    drawer: cardDrawer(card),
    keywords: `${card.className} ${card.term}`,
  }));

  return {
    title: "Archive",
    desc: "Every card that has gone out, newest first.",
    launchers: [{ label: "Completion", href: "/report-cards/completion" }],
    rows: [
      {
        cols: "1fr",
        panels: [{ type: "kpi", title: "What has been issued", per: 3, cards: cardsKpi }],
      },
      {
        cols: "1fr",
        panels: [
          {
            type: "table",
            title: "Issued cards",
            sub: out.length
              ? `${out.length} card${out.length === 1 ? "" : "s"} published or locked.`
              : "No card has been published yet.",
            head: ["Student", "Term", "Average", "Grade", "Published", "State", ""],
            rows,
            per: 10,
            empty: "Nothing has been published yet.",
          },
        ],
      },
    ],
  };
}

export async function reportCardsLiveTab(tabSlug: string): Promise<TabContent | undefined> {
  if (!["remarks", "completion", "archive"].includes(tabSlug)) return undefined;

  const cards = await apiGet<ReportCardView[]>("/api/v1/academics/report-cards");
  const list = cards ?? [];

  if (tabSlug === "remarks") return remarksTab(list);
  if (tabSlug === "completion") return completionTab(list);
  return archiveTab(list);
}
