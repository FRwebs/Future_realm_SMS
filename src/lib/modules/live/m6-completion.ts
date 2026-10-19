import { apiGet } from "@/lib/api/server";
import { cardDrawer, completionHref, notifyBehind, printDrawer, publishDrawer, RC, releaseDrawer, sendDrawer, withholdDrawer } from "@/lib/modules/live/m6-forms";
import { publishCard } from "@/lib/modules/live/m6-remarks";
import type { CompletionArmPage, CompletionOverview } from "@/lib/modules/live/m6-types";
import { gradeTone, num, stateTone } from "@/lib/modules/live/m5-enter";
import { plural } from "@/lib/modules/live/m7-format";
import { name as nameCell, pill, text, type PanelRow, type PanelTone, type TabContent, type TableRow } from "@/lib/modules/panels";

/** Completion — which arms can go out, and what is holding the rest. */

export const loadCompletion = () => apiGet<CompletionOverview>(`${RC}/completion`);
export const loadCompletionArm = (classId: string) => apiGet<CompletionArmPage>(`${RC}/completion/${encodeURIComponent(classId)}`);

const WARN = "M12 8.2v4.6M12 16h.02M12 3.6 21 19.4H3z";
const DOWNLOAD = "M12 3.5v11M7.5 10l4.5 4.5 4.5-4.5M4.5 19.5h15";
const STATE: Record<string, PanelTone> = { Ready: "positive", Published: "positive", Blocked: "negative", "Remarks owed": "attention", "Remark owed": "attention", "Awaiting review": "submitted", Withheld: "withheld" };
export const cardTone = (state: string): PanelTone => STATE[state] ?? stateTone(state);

export function completionTab(o: CompletionOverview, school: string): TabContent {
  const k = o.kpis;
  const scopeAll = { everything: true };
  const publishAll = publishDrawer({ label: "the whole school", ready: k.ready, total: k.cards - k.published, scope: scopeAll, reversibleMinutes: o.policy.reversibleMinutes, withholdForDebt: o.policy.withholdForDebt, term: `${o.term.name} ${o.term.session}` });
  const owing = Array.from(new Map(o.arms.filter((arm) => arm.masterId && (arm.owed || arm.blocked)).map((arm) => [arm.masterId as string, { id: arm.masterId as string, name: arm.master as string }])).values());
  const printAll = printDrawer({ label: "the whole school", total: k.cards, drafts: k.cards - k.published, scope: scopeAll, wider: "Or one arm, from its page" });
  const send = sendDrawer({ label: "the whole school", ready: k.published, total: k.cards, scope: scopeAll, school, term: o.term.name });
  const rows: PanelRow[] = [];
  if (o.unavailable) rows.push({ cols: "1fr", panels: [{ type: "note", tone: "attention", icon: WARN, title: "No arm has results to publish yet", body: "A report card is published for an arm, from approved score sheets. Approve some sheets and the arm appears here.", acts: [{ label: "Open the review queue", href: "/score-entry-results/review" }] }] });
  const clear = k.clear;
  const publish = publishCard(o.publishDate);
  rows.push({
    cols: "1fr",
    panels: [{
      type: "kpi", title: "The school this term", sub: `${o.term.name} ${o.term.session}`, per: 6,
      cards: [
        { label: "Ready to publish", value: String(k.ready), unit: `of ${k.cards - k.published}`, sub: `${clear} arms complete`, tone: k.ready && k.ready === k.cards - k.published ? "positive" : "attention" },
        { label: "Arms clear", value: String(clear), unit: `of ${k.arms}`, sub: clear ? "Every child ready or already out" : "No arm is fully ready yet", tone: clear === k.arms ? "positive" : "attention" },
        { label: "Blocked on scores", value: String(k.blocked), sub: "No approved result yet", tone: k.blocked ? "negative" : "positive", link: "Open review", href: "/score-entry-results/review" },
        { label: "Remarks owed", value: String(k.owed), sub: `Across ${plural(k.owedArms, "arm")}`, tone: k.owed ? "attention" : "positive", link: k.owed ? "Write them" : undefined, href: k.owed ? "/report-cards/remarks" : undefined },
        { label: "Published", value: String(k.published), sub: k.published ? "Already with families" : "Nothing has reached a family", tone: k.published ? "positive" : "neutral" },
        { ...publish, link: "Open calendar", href: "/school-configuration/calendar" },
      ],
    }],
  });
  const armRows: TableRow[] = o.arms.map((arm) => ({
    id: arm.id,
    keywords: `${arm.name} ${arm.level} ${arm.master ?? ""} state:${arm.state}`,
    cells: [
      text(arm.name, { strong: true }), arm.master ? nameCell(arm.master, "Form master") : text("Nobody named", { tone: "negative", strong: true }), text(String(arm.roll), { mono: true }),
      text(`${arm.ready + arm.published} of ${arm.roll}`, { strong: true, tone: arm.ready + arm.published === arm.roll ? "positive" : "attention" }),
      arm.blocked ? text(String(arm.blocked), { tone: "negative", strong: true }) : text("—"), arm.owed ? text(String(arm.owed), { tone: "attention", strong: true }) : text("—"), arm.inReview ? text(String(arm.inReview), { mono: true }) : text("—"),
      text(num(arm.average), { mono: true }), pill(arm.state, cardTone(arm.state)),
      { kind: "action" as const, label: arm.state === "Ready" ? "Open · publish" : arm.state === "Published" ? "Open" : "Open the arm", href: completionHref(arm.id) },
    ],
  }));
  rows.push({
    cols: "1fr",
    panels: [{
      type: "table", title: "Report cards by arm", tag: `${clear} of ${k.arms} arms clear`, tagTone: clear === k.arms ? "positive" : "attention", sub: "Open an arm to work through its children, preview a card, and publish or print the whole arm.",
      meta: `${k.cards} cards · ${k.ready} ready · ${k.blocked} blocked on scores · ${k.owed} remarks owed`, search: "Find an arm, a class or a form master",
      filters: [
        { label: "Arm", value: "All", options: ["All", ...o.arms.map((arm) => arm.name)], column: 0 },
        { label: "State", value: "All", options: ["All", "Ready", "Blocked", "Remarks owed", "Awaiting review", "Published"], column: 8 },
      ],
      acts: [{ label: "Print by class", drawer: printAll }, ...(k.ready ? [{ label: "Publish everything ready", primary: true, drawer: publishAll }] : [])],
      head: ["Arm", "Form master", "Roll", "Ready", "Blocked", "Owed", "Review", "Avg", "State", ""], noun: "arm", nounPlural: "arms", per: 12, selectable: true,
      bulkActs: [
        { label: "Publish these arms", drawer: { ...publishDrawer({ label: "the selected arms", ready: 0, total: 0, scope: {}, reversibleMinutes: o.policy.reversibleMinutes, withholdForDebt: o.policy.withholdForDebt, term: o.term.name }), title: "Publish the selected arms", facts: [["Scope", "The arms you ticked", "Only cards with scores, a remark and a review"], ["Skipped", "Anything unfinished", "Child by child, and named afterwards"], ["Reversible", `For ${o.policy.reversibleMinutes} minutes`, "After that a correction reissues the card"]], commitLabel: "Publish what is ready", commitDone: "Cards published" }, selection: { key: "arms", noun: "arm" } },
        { label: "Print these arms", drawer: { ...printAll, title: "Print the selected arms", facts: [["Scope", "The arms you ticked"], ["Drafts", "Watermarked DRAFT"]] }, selection: { key: "arms", noun: "arm" } },
        { label: "Notify their form masters", drawer: notifyBehind([], school, "Notify the selected form masters"), selection: { key: "arms", noun: "arm" } },
        { label: "Export selected", primary: true, export: true },
      ],
      rows: armRows, foot: "An arm is Ready when every child has scores, a form master's remark and the Principal's review. A half-finished card never reaches a family.",
    }],
  });
  const items = [
    k.blocked ? { label: `${plural(k.blocked, "card")} blocked on scores`, sub: `In ${k.blockedArms.slice(0, 4).join(", ")}. A sheet is unapproved, or the child has no result yet. Nobody is being given a zero — the card simply cannot compute.`, pill: "Blocked", tone: "negative" as PanelTone, viewLabel: "Open review", href: "/score-entry-results/review" } : null,
    k.owed ? { label: `${k.owed} form master remarks unwritten`, sub: `Across ${plural(k.owedArms, "arm")}. A card cannot generate without its form master's remark.`, pill: "Owed", tone: "attention" as PanelTone, viewLabel: "Write them", href: "/report-cards/remarks" } : null,
    ...o.holding.unassigned.slice(0, 3).map((name) => ({ label: `${name} has no teacher`, sub: "No score can exist for a subject nobody teaches.", pill: "No teacher", tone: "negative" as PanelTone, viewLabel: "Assign", href: "/class-timetable/teaching" })),
    o.holding.unplaced ? { label: `${plural(o.holding.unplaced, "child", "children")} sit in no class arm`, sub: "A card cannot be addressed to an arm that does not exist for them.", pill: "No arm", tone: "attention" as PanelTone, viewLabel: "Allocate", href: "/student-records/registry" } : null,
    o.holding.withoutSubjects ? { label: `${plural(o.holding.withoutSubjects, "arm")} with children offer no subjects`, sub: "They have nothing to be scored on, so they are not in the table above.", pill: "No subjects", tone: "attention" as PanelTone, viewLabel: "Offer subjects", href: "/class-timetable/teaching" } : null,
    k.noPrincipal ? { label: "Principal reviews not finished", sub: `${k.noPrincipal} cards. Yours — they can be applied by band and refined individually.`, pill: "Not started", tone: "attention" as PanelTone, viewLabel: "Open remarks", href: "/report-cards/remarks" } : null,
  ].filter((item): item is NonNullable<typeof item> => item !== null);
  rows.push({
    cols: "1.1fr 1fr",
    panels: [
      { type: "list", title: "What is holding the school up", sub: "Each one names the arms it blocks.", items: items.map((item) => ({ label: item.label, sub: item.sub, pill: item.pill, tone: item.tone, viewLabel: item.viewLabel, href: item.href })), foot: items.length ? undefined : "Nothing is holding any arm up." },
      {
        type: "facts", title: "How publishing works here", tuck: "How publishing works", sub: `The same rules whether you publish one card or all ${k.cards}.`, per: 1,
        facts: [
          ["Publishing", "Student portal and guardian portal, at once", "Free, instant, and the family is notified in-app"],
          ["Off-app delivery", "SMS, email, WhatsApp or print", "A separate send — never automatic"],
          ["Bulk scope", "One child, one arm, one class, or the whole school", "Every scope shows what it will skip"],
          ["Partly-ready arms", "Skipped child by child", "A half-finished card never reaches a family"],
          ["Fee balances", o.policy.withholdForDebt ? "A child with an unpaid balance is left out" : "Do not withhold a card", "The school's own report card policy"],
          ["Reversible", `For ${o.policy.reversibleMinutes} minutes after publishing`, "After that, a correction reissues the card"],
          ["Corrections", "Stored beside the original", "The family is told what changed and why"],
        ],
      },
    ],
  });
  return {
    title: "Completion", desc: "Which arms can go out, and what is holding the rest.",
    primary: k.ready ? { label: `Publish the ${plural(k.ready, "ready card")}`, icon: DOWNLOAD, drawer: publishAll } : { label: "Nothing is ready to publish yet", icon: WARN, href: "/report-cards/remarks" },
    launchers: [{ label: "Print by class or by arm", drawer: printAll }, ...(k.published ? [{ label: "Send to guardians off-app", drawer: send }] : []), { label: "Open the outstanding remarks", href: "/report-cards/remarks" }, ...(owing.length ? [{ label: "Notify the form masters", drawer: notifyBehind(owing, school, "Notify the form masters holding this up") }] : [])],
    rows,
  };
}

/* ───────────────────────── one arm ───────────────────────── */

export function completionArmPage(a: CompletionArmPage, school: string): { content: TabContent & { crumb: { label: string; href: string } } } {
  const sum = a.sum;
  const term = `${a.term.name} ${a.term.session}`;
  const todo = sum.roll - sum.published;
  const publish = publishDrawer({ label: a.arm.name, ready: sum.ready, total: todo, scope: { arms: [a.arm.id] }, reversibleMinutes: a.policy.reversibleMinutes, withholdForDebt: a.policy.withholdForDebt, skipped: [["blocked on scores", sum.blocked], ["remarks owed", sum.owed], ["awaiting review", sum.inReview]], term });
  const print = printDrawer({ label: a.arm.name, total: sum.roll - sum.blocked, drafts: sum.roll - sum.blocked - sum.published, scope: { arms: [a.arm.id] } });
  const send = sendDrawer({ label: a.arm.name, ready: sum.published, total: sum.roll, scope: { arms: [a.arm.id] }, school, term: a.term.name });
  const notify = a.master ? notifyBehind([{ id: a.master.id, name: a.master.name }], school, `Notify ${a.master.name}`) : undefined;
  const rows: PanelRow[] = [];
  rows.push({
    cols: "1fr",
    panels: [{
      type: "kpi", title: `${a.arm.name} · ${term}`, per: 6,
      cards: [
        { label: "Ready to publish", value: String(sum.ready), unit: `of ${todo}`, sub: "Scores, remark and review all in", tone: sum.ready === todo && todo ? "positive" : "attention" },
        { label: "Blocked on scores", value: String(sum.blocked), sub: sum.blocked ? (a.subjects.approved < a.subjects.of ? "A sheet is unapproved" : "No result for them yet") : "Every sheet in", tone: sum.blocked ? "negative" : "positive", link: sum.blocked ? "Open review" : undefined, href: sum.blocked ? `/score-entry-results/review/${a.arm.id}` : undefined },
        { label: "Remark owed", value: String(sum.owed), sub: sum.owed ? `By ${a.master?.name ?? "the form master"}` : "All written", tone: sum.owed ? "attention" : "positive", link: sum.owed ? "Write them" : undefined, href: sum.owed ? "/report-cards/remarks" : undefined },
        { label: "Awaiting review", value: String(sum.inReview), sub: "Result checked before it goes out", tone: sum.inReview ? "submitted" : "positive" },
        { label: "Published", value: String(sum.published), sub: sum.published ? "Already with families" : "Nothing has reached a family", tone: sum.published ? "positive" : "neutral" },
        { ...publishCard(a.publishDate), link: undefined },
      ],
    }],
  });
  const childRows: TableRow[] = a.children.map((child) => ({
    id: child.id,
    keywords: `${child.name} ${child.adm} state:${child.state} portal:${child.portal} fee:${child.fee}`,
    cells: [
      nameCell(child.name, child.revision > 1 ? `Revision ${child.revision}` : a.arm.name), text(child.adm, { mono: true }), text(num(child.average), { mono: true, strong: true }), text(child.pos === null ? "—" : String(child.pos), { mono: true }),
      child.grade ? pill(child.grade, gradeTone(child.grade)) : text("—"), pill(child.scores ? "Approved" : "Blocked", child.scores ? "positive" : "negative"), pill(child.remark === "Submitted" ? "Written" : "Not written", child.remark === "Submitted" ? "positive" : "attention"),
      pill(child.review ? "Reviewed" : child.scores && child.remark === "Submitted" ? "Awaiting" : "Not yet", child.review ? "positive" : "attention"), pill(child.state, cardTone(child.state)), pill(child.portal, child.portal === "Active" ? "positive" : "negative"),
      { kind: "action" as const, label: child.state === "Ready" ? "Preview · publish" : child.published ? "Open the card" : "Preview draft", drawer: cardDrawer(child.id, a.term.id, child.name) },
    ],
  }));
  rows.push({
    cols: "1fr",
    panels: [{
      type: "table", title: `Every child in ${a.arm.name}`, tag: `${sum.ready} ready`, tagTone: sum.ready === todo ? "positive" : "attention", sub: "Preview any card exactly as the family will see it, then print it or publish it.",
      meta: `${sum.roll} children · ${a.subjects.of} subjects · ${sum.ready} ready · ${sum.blocked} blocked · ${sum.owed} remarks owed`, search: "Find a child by name or admission number",
      filters: [
        { label: "State", value: "All", options: ["All", "Ready", "Blocked", "Remark owed", "Awaiting review", "Published", "Withheld"], match: Object.fromEntries(["Ready", "Blocked", "Remark owed", "Awaiting review", "Published", "Withheld"].map((state) => [state, `state:${state}`])) },
        { label: "Fees", value: "All", options: ["All", "Settled", "Outstanding"], match: { Settled: "fee:Settled", Outstanding: "fee:Outstanding" } },
        { label: "Guardian portal", value: "All", options: ["All", "Active", "Not activated"], match: { Active: "portal:Active", "Not activated": "portal:Not activated" } },
      ],
      acts: [{ label: `Print all ${sum.roll - sum.blocked}`, drawer: print }, ...(sum.published ? [{ label: "Send off-app", drawer: send }] : []), ...(sum.ready ? [{ label: sum.ready === todo ? (todo === 1 ? "Publish the card" : `Publish all ${todo} cards`) : `Publish the ${sum.ready} ready`, primary: true, drawer: publish }] : [])],
      head: ["Child", "Admission no", "Avg", "Pos", "Grade", "Scores", "Remark", "Review", "State", "Portal", ""], noun: "card", nounPlural: "children", per: 12, selectable: true,
      bulkActs: [
        { label: "Publish the selection", drawer: { ...publish, title: "Publish the selected cards", facts: [["Scope", "The children you ticked", "Only cards with scores, a remark and a review"], ["Skipped", "Anything unfinished", "Child by child, and named afterwards"], ["Reversible", `For ${a.policy.reversibleMinutes} minutes`, "After that a correction reissues the card"]], commitLabel: "Publish what is ready", submit: { endpoint: `${RC}/publish`, method: "POST", body: { arms: [a.arm.id] } } }, selection: { key: "students", noun: "child" } },
        { label: "Print the selection", drawer: { ...print, title: "Print the selected cards", facts: [["Scope", "The children you ticked"], ["Drafts", "Watermarked DRAFT"]], submit: { endpoint: `${RC}/print`, method: "POST", body: { arms: [a.arm.id] } } }, selection: { key: "students", noun: "child" } },
        { label: "Export selected", primary: true, export: true },
      ],
      rows: childRows,
    }],
  });
  const withhold = a.children.filter((child) => !child.published && !child.withheld && child.scores).slice(0, 1);
  const withheld = a.children.filter((child) => child.withheld);
  rows.push({
    cols: "1.1fr 1fr",
    panels: [
      {
        type: "list", title: "How these cards go out", sub: "Publishing is in-app. Anything else is a separate send.",
        items: [
          { label: "Publish to the student and guardian portal", sub: "Free · instant · both portals at once. The family is notified in-app.", pill: sum.ready ? `${sum.ready} ready` : "Nothing ready", tone: sum.ready ? "positive" : "neutral", viewLabel: "Publish", drawer: sum.ready ? publish : undefined },
          { label: "Send by SMS with a portal link", sub: `1 credit per guardian · ${plural(a.guardians, "guardian")} · the card is not attached, only linked.`, pill: "Costed", tone: "attention", viewLabel: "Send", drawer: send },
          { label: "Email a link to the card", sub: `Free · ${plural(a.emails, "guardian")} with an email on file.`, pill: "Free", tone: "positive", viewLabel: "Send", drawer: send },
          { label: "Print for collection", sub: `One run, ${sum.roll - sum.blocked} pages, in roll order, with the school stamp block.`, pill: "Print", tone: "neutral", viewLabel: "Print", drawer: print },
          ...withheld.map((child) => ({ label: `${child.name} is withheld`, sub: "Skipped by every publish until it is released.", pill: "Withheld", tone: "withheld" as PanelTone, viewLabel: "Release", drawer: releaseDrawer({ id: child.id, name: child.name }) })),
          ...withhold.map((child) => ({ label: "Withhold a child's card", sub: `For a reason the school records — starting with ${child.name}, or any child from their card.`, pill: "School decision", tone: "neutral" as PanelTone, viewLabel: "Withhold", drawer: withholdDrawer({ id: child.id, name: child.name }, a.arm.name) })),
        ],
      },
      {
        type: "facts", title: "Who is accountable for this arm", sub: `The remarks and the guardian conversations for all ${sum.roll} cards.`, tag: a.master ? "Form master" : "Unassigned", tagTone: a.master ? "positive" : "negative", per: 1,
        acts: [...(notify ? [{ label: "Notify them", drawer: notify }] : []), ...(a.master ? [{ label: "Open their record", primary: true, href: `/staff-access/directory/${a.master.id}` }] : [])],
        facts: [
          ["Form master", a.master?.name ?? "Nobody named", a.master ? a.master.role.replace(/_/g, " ").toLowerCase() : "Nobody can write these remarks"],
          ["Remarks written", `${a.remarksWritten} of ${a.sum.roll}`, a.sum.owed ? `${a.sum.owed} still owed` : "Complete"],
          ["Principal reviews", `${a.principalWritten} of ${a.sum.roll}`, "Written by the Principal"],
          ["Score sheets", `${a.subjects.approved} of ${a.subjects.of} approved`, a.sum.blocked ? `${plural(a.sum.blocked, "card")} blocked on scores` : "All in"],
          ["Publish window", a.publishDate ? new Date(`${a.publishDate.iso}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "long", timeZone: "UTC" }) : "No release date is set", a.publishDate ? "From the assessment windows" : "Set one in School Configuration"],
        ],
      },
    ],
  });
  return {
    content: {
      crumb: { label: "Back to every arm", href: "/report-cards/completion" },
      title: `${a.arm.name} · report cards`, desc: `Where each of the ${sum.roll} children in ${a.arm.name} stands, and what you can send.`,
      primary: sum.ready ? { label: sum.ready === todo ? (todo === 1 ? "Publish the card" : `Publish all ${todo} cards`) : `Publish the ${sum.ready} ready`, icon: DOWNLOAD, drawer: publish } : { label: sum.published === sum.roll ? "Every card is published" : "Nothing is ready to publish yet", icon: WARN, href: "/report-cards/remarks" },
      launchers: [{ label: `Print all ${sum.roll - sum.blocked} cards`, drawer: print }, ...(sum.published ? [{ label: "Send to guardians off-app", drawer: send }] : []), { label: "Write the outstanding remarks", href: `/report-cards/remarks?arm=${a.arm.id}` }, { label: `Open ${a.arm.name}`, href: `/class-timetable/classes/${a.arm.id}` }],
      rows,
    },
  };
}

