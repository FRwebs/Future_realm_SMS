import { apiGet, observe } from "@/lib/api/server";
import { localContracts } from "@/lib/api/local-contracts.zod";
import type { TeacherWorkspaceView } from "@/lib/api/teacher-workspace";
import { cardDrawer, completionHref, formMasterForm, remarkHref } from "@/lib/modules/live/m6-forms";
import type { ArchiveOverview, CardState, CompletionArmPage, CompletionOverview, RemarkPage, RemarksOverview } from "@/lib/modules/live/m6-types";
import type { DrawerSpec, ListItem, Panel, PanelFact, PanelRow, PanelTone, TabContent, TableCellKind, TableRow } from "@/lib/modules/panels";
import { pill, row, text } from "@/lib/modules/panels";
import { formatDay } from "@/lib/date-format";

/**
 * M06 for a teaching person: the remarks they write, the cards they may read, and the archive of the arms they answer for.
 *
 * "A teacher writes a remark; a Principal publishes a document." A form master writes the sentence a family reads most carefully, as a
 * draft, and submits the class together. Everything else here is read — a card is read exactly as the family will, and published by
 * the Principal, never from this page.
 */

const RC = "/api/v1/report-cards";
const API = "/api/v1/teacher-workspace";
const PEN = "M4 20h4l10.5-10.5a2.1 2.1 0 0 0-3-3L5 17z";
const ARROW = "M5 12h13M13 6.5l5.5 5.5L13 17.5";
const EYE = "M2.5 12s3.5-6.5 9.5-6.5S21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12zM12 14.6a2.6 2.6 0 1 0 0-5.2 2.6 2.6 0 0 0 0-5.2";
const SHIELD = "M12 3.2 19.2 6v6.1c0 4.2-3 7.8-7.2 8.7-4.2-.9-7.2-4.5-7.2-8.7V6z";

const remarkTone = (state: string): PanelTone => (state === "Submitted" ? "positive" : state === "Draft" ? "progress" : "attention");
const cardTone = (state: string): PanelTone => (state === "Ready" || state === "Published" ? "positive" : state === "Blocked" ? "negative" : state === "Remark owed" || state === "Remarks owed" ? "attention" : state === "Awaiting review" ? "submitted" : "neutral");
const gradeTone = (grade: string | null): PanelTone => {
  const first = (grade ?? "")[0];
  return first === "A" || first === "B" ? "positive" : first === "C" ? "submitted" : first === "D" ? "attention" : !grade ? "neutral" : "negative";
};
const shortDate = (iso: string) => formatDay(new Date(`${iso}T00:00:00Z`), { day: "numeric", month: "long", timeZone: "UTC" });

export async function teacherReportCardsTab(tabSlug: string, me: TeacherWorkspaceView, query: Record<string, string | undefined> = {}): Promise<TabContent | null | undefined> {
  if (tabSlug === "remarks") {
    const [o, to] = await Promise.all([apiGet(`${RC}/remarks`, observe<RemarksOverview>(localContracts["src/lib/modules/live/t6-report-cards.ts#c6bfd201"])), apiGet(`${API}/remarks/recipient`, observe<string | null>(localContracts["src/lib/modules/live/t6-report-cards.ts#cdb686ad"])).catch(() => null)]);
    return remarksTab(o, me, to);
  }
  if (tabSlug === "completion") return completionTab(await apiGet(`${RC}/completion`, observe<CompletionOverview>(localContracts["src/lib/modules/live/t6-report-cards.ts#f6bbf96f"])), me);
  if (tabSlug === "archive") return archiveTab(await apiGet(`${RC}/archive`, observe<ArchiveOverview>(localContracts["src/lib/modules/live/t6-report-cards.ts#d068c297"])), me, query.arm);
  return undefined;
}

const phoneOnly = (panel: Panel): PanelRow => ({ ...row("1fr", [panel]), show: "phone" as const });
const desktopOnly = (rows: Array<PanelRow | null>): PanelRow[] => rows.filter((entry): entry is PanelRow => Boolean(entry)).map((entry) => ({ ...entry, show: "desktop" as const }));
const initialsOf = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((word) => word[0]!.toUpperCase()).join("");
const DOC = "M6.5 3.5h8L18.5 8v12.5h-12zM14.5 3.5V8h4M9 12.5h6M9 16h4";
/** The note that closes both screens: this person reads cards; the Principal publishes them. */
const readOnlyNote = (): PanelRow => phoneOnly({ type: "note", tone: "neutral", icon: DOC, title: "You read cards; the Principal publishes them", body: "Only your own remarks are editable. A revised card notifies the family." });

function noArm(title: string, desc: string, body: string): TabContent {
  return { title, desc, rows: [row("1fr", [{ type: "note", tone: "neutral", icon: EYE, title: "You hold no form class this term", body }])] };
}

function remarksTab(o: RemarksOverview, me: TeacherWorkspaceView, to: string | null): TabContent {
  const own = me.formArms[0];
  if (!own) return noArm("Remarks", "A teacher writes a remark; a Principal publishes a document.", "Remarks are written by the form master of an arm. When the school gives you a class, its children appear here.");
  const students = o.students.filter((student) => student.classId === own.id);
  const n = students.length;
  const written = students.filter((student) => student.teacher === "Submitted").length;
  const drafts = students.filter((student) => student.teacher === "Draft").length;
  const done = written;
  const first = students.find((student) => student.teacher === "Not written") ?? students.find((student) => student.teacher === "Draft") ?? students[0];
  const tableRows: TableRow[] = students.map((student, index) => ({
    id: student.id, keywords: `${student.name} ${student.adm}`,
    cells: [
      { kind: "name", name: student.name, sub: `Roll ${String(index + 1).padStart(2, "0")}` }, text(student.adm, { mono: true }),
      text(student.attendance === null ? "—" : `${student.attendance}%`, { mono: true, tone: student.attendance !== null && student.attendance < 75 ? "negative" : undefined }),
      pill(student.teacher, remarkTone(student.teacher)),
      { kind: "action", label: student.teacher === "Not written" ? "Write" : "Edit", href: remarkHref(student.classId, student.id) },
    ] as TableCellKind[],
  }));
  const submit: DrawerSpec = {
    mode: "commit", kicker: "Report cards", title: `Submit the ${own.name} remarks`,
    sub: "After submission a change needs a correction request. They go to the Principal together.",
    facts: [["Class", own.name, `${n} children`], ["Submitted already", `${done} of ${n}`, ""], ["Drafts ready to submit", String(drafts), drafts ? "Each at least a sentence" : "Nothing to submit yet"], ["A blank remark", "Is published as one", "A card with no remark goes out with an empty box"], ["Goes to", to ?? "The Principal", o.publishDate ? `Publication is ${shortDate(o.publishDate.iso)}` : "No publication date is set"], ["Needs a connection", "Yes", "Drafts can be written offline; submission cannot"]],
    commitLabel: `Submit ${drafts} remark${drafts === 1 ? "" : "s"}`, commitDone: "Remarks submitted", commitDoneBody: `${to ?? "The Principal"} has them. You will be told if any come back.`,
    submit: { endpoint: `${API}/remarks/submit`, method: "POST", body: { classId: own.id } },
  };
  const publish = o.publishDate;
  const panels: Array<PanelRow | null> = [
    row("1fr", [{
      type: "kpi", sub: `${publish ? `Cards are published ${shortDate(publish.iso)}` : "No publication date is set"}.`, per: 4,
      cards: [
        { label: "Remarks submitted", value: String(written), unit: `of ${n}`, sub: `${n - written} outstanding`, tone: written === n ? "positive" : "attention" },
        { label: "Drafts waiting", value: String(drafts), sub: drafts ? "Written, not yet submitted" : "No draft waiting", tone: drafts ? "progress" : "neutral" },
        { label: "Reviewed by the Principal", value: String(students.filter((student) => student.reviewed).length), unit: `of ${n}`, sub: "Written at publication", tone: "neutral" },
        { label: "Days to publication", value: publish ? String(Math.max(0, publish.days)) : "—", sub: publish ? `Cards go out ${shortDate(publish.iso)}` : "Set by the school", tone: publish && publish.days < 7 ? "attention" : "positive" },
      ],
    }]),
    // The phone shows where the remarks are as three stages, the way the teacher mobile mockup does, between the figures and the children.
    {
      ...row("1fr", [{
        type: "steps", title: "Where your remarks are",
        steps: [
          { label: "Write each child’s remark", sub: `${written + drafts} of ${n} written · saved as you go`, state: written + drafts === n ? "done" : "current" },
          { label: "Submit to the Principal", sub: "Together, once every remark is written", state: written === n ? "done" : written + drafts === n ? "current" : "todo" },
          { label: "Published to families", sub: publish ? shortDate(publish.iso) : "No publication date is set", state: "todo" },
        ],
      }]),
      show: "phone" as const,
    },
    row("1fr", [{
      type: "table", title: `${own.name} · every child`, tag: `${written} of ${n} written`, tagTone: written === n ? "positive" : "attention", sub: "Open a child to write. The record you need is on the same page.", meta: `${n} children · your class`, noun: "remark", nounPlural: "children",
      search: "Find a child by name or admission number", head: ["Student", "Admission no", "Attend", "Remark", ""], rows: tableRows, per: 10, noRowOpen: true, empty: "Nobody is on this class’s roll.",
      foot: "A draft is saved as you go. Submitting sends the class to the Principal together.",
    }]),
    me.formArms.length > 1 ? row("1fr", [{ type: "note", tone: "neutral", icon: EYE, title: `You hold ${me.formArms.length} classes`, body: `${me.formArms.map((arm) => arm.name).join(" and ")} are both yours. This page shows ${own.name}; the others follow from their own class page.` }]) : null,
  ];
  return {
    title: "Remarks", desc: `${own.name}. A teacher writes a remark; a Principal publishes a document.`,
    phoneTitle: `${own.name} remarks`, phoneDesc: `A teacher writes a remark; a Principal publishes a document.${publish ? ` Cards are published ${shortDate(publish.iso)}.` : ""}`,
    primary: first ? { label: written === n ? "Open the first remark" : written + drafts ? "Continue writing" : "Start with the first child", phoneLabel: "Write remarks", icon: PEN, href: remarkHref(first.classId, first.id) } : undefined,
    launchers: drafts ? [{ label: `Submit ${drafts} remark${drafts === 1 ? "" : "s"}`, drawer: submit }] : [],
    rows: panels.filter((entry): entry is PanelRow => Boolean(entry)),
  };
}

function completionTab(o: CompletionOverview, me: TeacherWorkspaceView): TabContent {
  const arms = o.arms;
  if (!arms.length) return noArm("Completion", "Report cards for the arms you answer for.", "Report cards are read by the form master of an arm. When the school gives you one, it appears here.");
  const own = new Set(me.formArms.map((arm) => arm.id));
  const total = (key: "roll" | "ready" | "blocked" | "owed" | "inReview" | "published") => arms.reduce((sum, arm) => sum + arm[key], 0);
  const mineOwed = arms.filter((arm) => own.has(arm.id)).reduce((sum, arm) => sum + arm.owed, 0);
  const rows: TableRow[] = arms.map((arm) => ({
    cells: [
      text(arm.name, { strong: true }), pill(own.has(arm.id) ? (me.persona === "early-years" ? "Class teacher" : "Form master") : "Assistant form master", own.has(arm.id) ? "positive" : "progress"),
      { kind: "name", name: own.has(arm.id) ? me.person.name : arm.master ?? "Nobody named", sub: own.has(arm.id) ? "You" : "Writes the remarks" }, text(String(arm.roll), { mono: true }),
      text(`${arm.ready + arm.published} of ${arm.roll}`, { strong: true, tone: arm.ready + arm.published === arm.roll ? "positive" : "attention" }),
      arm.owed ? text(`${arm.owed}${own.has(arm.id) ? " · yours" : ""}`, { strong: true, tone: "attention" }) : text("—"), arm.blocked ? text(String(arm.blocked), { strong: true, tone: "negative" }) : text("—"),
      pill(arm.state, cardTone(arm.state)), { kind: "action", label: "Open the arm", href: completionHref(arm.id) },
    ] as TableCellKind[],
  }));
  const publish = o.publishDate;
  const ready = total("ready") + total("published");
  // The phone: two figures, then the classes to choose from, as the teacher mobile mockup draws it.
  const phone: PanelRow[] = [
    phoneOnly({ type: "kpi", bare: true, cards: [
      { label: "Cards ready", value: String(ready), unit: `of ${total("roll")}`, sub: `Across ${arms.length} ${arms.length === 1 ? "class" : "classes"}`, tone: ready === total("roll") ? "positive" : "attention" },
      { label: "Publication", value: publish ? shortDate(publish.iso).replace(/ (\w{3})\w*$/, " $1") : "—", sub: publish ? "The Principal publishes" : "No date is set" },
    ] }),
    phoneOnly({
      type: "list", title: "Choose a class", tag: `${arms.length} ${arms.length === 1 ? "class" : "classes"}`, tagTone: "neutral", sub: "Completion is answered per class: one form master, one broadsheet, one printing run.",
      items: arms.map((arm) => ({
        icon: DOC, label: arm.name, pill: arm.state, tone: cardTone(arm.state), href: completionHref(arm.id),
        sub: `${own.has(arm.id) ? (me.persona === "early-years" ? "Class teacher" : "Form master") : "Assistant form master"} · ${arm.ready + arm.published} of ${arm.roll} ready${arm.owed ? ` · ${arm.owed} remark${arm.owed === 1 ? "" : "s"} owed` : ""}${arm.blocked ? ` · ${arm.blocked} blocked on scores` : ""}`,
      })),
    }),
    readOnlyNote(),
  ];
  const panels: Array<PanelRow | null> = [
    row("1fr", [{
      type: "kpi", title: `${o.term.name} ${o.term.session}`, per: 5,
      cards: [
        { label: arms.length === 1 ? "Your arm" : "Your arms", value: String(arms.length), sub: arms.map((arm) => arm.name).join(" · ") },
        { label: "Ready", value: String(total("ready") + total("published")), unit: `of ${total("roll")}`, sub: "Scores, remark and review all in", tone: total("ready") + total("published") === total("roll") ? "positive" : "attention" },
        { label: "Your remarks owed", value: String(mineOwed), sub: mineOwed ? "Write them from Remarks" : "Every remark is written", tone: mineOwed ? "attention" : "positive", link: mineOwed ? "Write them" : undefined, href: mineOwed ? "/report-cards/remarks" : undefined },
        { label: "Blocked on scores", value: String(total("blocked")), sub: total("blocked") ? "A subject sheet is not approved yet" : "Every sheet is in", tone: total("blocked") ? "negative" : "positive" },
        { label: "Published", value: String(total("published")), sub: publish ? `The Principal publishes ${shortDate(publish.iso)}` : "Nothing has reached a family", tone: "neutral" },
      ],
    }]),
    row("1fr", [{
      type: "table", title: arms.length === 1 ? "Your arm" : "Your arms", tag: `${arms.length} arm${arms.length === 1 ? "" : "s"}`, tagTone: "neutral", sub: "Open an arm to see where every child stands, then read any card.", meta: `${total("roll")} cards · ${total("ready")} ready`, noun: "arm", nounPlural: "arms",
      head: ["Arm", "Your role", "Form master", "Roll", "Ready", "Remarks owed", "Blocked", "State", ""], rows, noRowOpen: true, foot: "View only. Publishing, printing and sending report cards stay with the Principal.",
    }]),
    row("1fr", [{
      type: "facts", title: "What you can do here", per: 2,
      facts: [
        ["Read every card", "Exactly as the family will see it", "A card not yet published is marked as a draft"],
        ["Write your own remarks", "From Remarks, until you submit them", me.formArms.map((arm) => arm.name).join(", ") || "You hold no form class"],
        ["Publish, print or send", "Not from here", publish ? `The Principal publishes ${shortDate(publish.iso)} — nothing reaches a family before` : "The Principal publishes — nothing reaches a family before"],
        arms.some((arm) => !own.has(arm.id)) ? ["Arms you assist with", arms.filter((arm) => !own.has(arm.id)).map((arm) => arm.name).join(", "), "Read only — the remarks there are written by their form master"] : ["Fees", "Never shown", "A card’s contents never depend on what a family owes"],
      ] as PanelFact[],
    }]),
  ];
  return {
    title: "Completion", desc: `Report cards for the ${arms.length === 1 ? "arm" : `${arms.length} arms`} you answer for. Read any card exactly as the family will; the Principal publishes them.`,
    phoneTitle: arms.length === 1 ? "Your class" : "Your classes", phoneDesc: "Choose a class to see where every card stands before the Principal publishes.",
    primary: arms.length === 1 ? { label: `Open ${arms[0]!.name}`, icon: ARROW, href: completionHref(arms[0]!.id) } : mineOwed ? { label: `Write the ${mineOwed} remarks you owe`, icon: PEN, href: "/report-cards/remarks" } : undefined,
    launchers: arms.length === 1 && mineOwed ? [{ label: "Write the remarks you owe", href: "/report-cards/remarks" }] : [],
    rows: [...phone, ...desktopOnly(panels)],
  };
}

function archiveTab(o: ArchiveOverview, me: TeacherWorkspaceView, armId?: string): TabContent {
  const arms = o.arms;
  if (!arms.length) return noArm("Archive", "Published report cards for the arms you answer for.", "Published cards appear here for the arms you are form master of.");
  const revised = o.rows.filter((entry) => entry.state === "Revised").length;
  const latest = o.rows.map((entry) => entry.published).filter((value): value is string => Boolean(value)).sort().pop() ?? null;
  // The average and the grade are the ones the card was published with, read back from its own
  // snapshot — what the family was told, not what the marks would say if they were added up today.
  const gradeTone = (grade: string | null | undefined): PanelTone =>
    !grade ? "neutral" : /^[AB]/.test(grade) ? "positive" : /^C/.test(grade) ? "submitted" : "attention";
  const rows: TableRow[] = o.rows.map((entry) => ({
    id: `${entry.studentId}|${entry.termId}`,
    keywords: `${entry.name} ${entry.adm} ${entry.arm} ${entry.term} ${entry.state} ${entry.grade ?? ""}`,
    cells: [
      { kind: "name", name: entry.name, sub: entry.arm }, text(entry.adm, { mono: true }), text(entry.arm), text(entry.term),
      text(typeof entry.avg === "number" ? entry.avg.toFixed(1) : "—", { mono: true }),
      entry.grade ? pill(entry.grade, gradeTone(entry.grade)) : text("—"),
      text(entry.published ? shortDate(entry.published) : "—"), pill(entry.state, entry.state === "Revised" ? "attention" : "positive"),
      { kind: "action", label: "Open", drawer: cardDrawer(entry.studentId, entry.termId, entry.name) },
    ] as TableCellKind[],
  }));
  const grades = [...new Set(o.rows.map((entry) => entry.grade).filter((grade): grade is string => Boolean(grade)))].sort();
  /* Printing is the Principal's, so what a form master takes from here is a copy for their own
     file. The drawer says so rather than letting the button imply otherwise. */
  const printSelected: DrawerSpec = {
    mode: "output", title: "Print the selected report cards", kicker: "Archive",
    sub: "One page each, exactly as published. An archived copy is not a replacement for the family’s own.",
    facts: [["Marked", "Archived copy", "Not the family’s original"], ["Publishing", "The Principal’s", "Nothing here reaches a family"]],
  };
  const terms = (id: string) => new Set(o.rows.filter((entry) => entry.classId === id).map((entry) => entry.termId)).size;
  const picked = arms.find((arm) => arm.id === armId) ?? (arms.length === 1 ? arms[0] : undefined);
  const phone: PanelRow[] = picked
    ? [
        phoneOnly({ type: "kpi", bare: true, cards: [
          { label: "Cards on file", value: String(o.rows.filter((entry) => entry.classId === picked.id).length), sub: `${picked.name} · ${terms(picked.id)} term${terms(picked.id) === 1 ? "" : "s"}` },
          { label: "Latest publication", value: latest ? shortDate(latest).replace(/ (\w{3})\w*$/, " $1") : "—", sub: latest ? "The most recent card on file" : "Nothing published yet" },
        ] }),
        phoneOnly({
          type: "list", title: `${picked.name} · published cards`, tag: `${o.rows.filter((entry) => entry.classId === picked.id).length}`, tagTone: "neutral", sub: "Open a card to read it as the family did.",
          empty: "No card has been published for this class yet.",
          items: o.rows.filter((entry) => entry.classId === picked.id).map((entry) => ({
            avatar: initialsOf(entry.name), label: entry.name, pill: entry.state, tone: entry.state === "Revised" ? ("attention" as const) : ("positive" as const),
            sub: `${entry.term}${entry.published ? ` · published ${shortDate(entry.published)}` : ""}`, drawer: cardDrawer(entry.studentId, entry.termId, entry.name),
          })),
        }),
        readOnlyNote(),
      ]
    : [
        phoneOnly({ type: "kpi", bare: true, cards: [
          { label: "Cards on file", value: String(o.rows.length), sub: `${arms.length} ${arms.length === 1 ? "class" : "classes"} · ${o.terms.length} term${o.terms.length === 1 ? "" : "s"}` },
          { label: "Latest publication", value: latest ? shortDate(latest).replace(/ (\w{3})\w*$/, " $1") : "—", sub: latest ? "The most recent card on file" : "Nothing published yet" },
        ] }),
        phoneOnly({
          type: "list", title: "Choose a class", tag: `${arms.length} classes`, tagTone: "neutral", sub: "Published cards, class by class.",
          items: arms.map((arm) => {
            const mine = me.formArms.some((entry) => entry.id === arm.id);
            const count = o.rows.filter((entry) => entry.classId === arm.id).length;
            return { icon: DOC, label: arm.name, pill: mine ? "Yours" : "Assisting", tone: mine ? ("positive" as const) : ("neutral" as const), sub: `${mine ? (me.persona === "early-years" ? "Class teacher" : "Form master") : "Assistant form master"} · ${count} published card${count === 1 ? "" : "s"} · ${terms(arm.id)} term${terms(arm.id) === 1 ? "" : "s"}`, href: `/report-cards/archive?arm=${arm.id}` };
          }),
        }),
        readOnlyNote(),
      ];
  const desktop = [
      row("1fr", [{
        type: "kpi", title: "Your archive", per: 4,
        cards: [
          { label: "Cards on file", value: String(o.rows.length), sub: `${arms.length} arm${arms.length === 1 ? "" : "s"} · ${o.terms.length} term${o.terms.length === 1 ? "" : "s"} on the school’s record` },
          { label: "Arms", value: arms.map((arm) => arm.name).join(", "), sub: me.formArms.map(() => (me.persona === "early-years" ? "Class teacher" : "Form master")).join(" · ") || "Assistant" },
          { label: "Revised after publication", value: String(revised), sub: revised ? "The family was told, and the card says so" : "None", tone: revised ? "attention" : "positive" },
          { label: "Latest publication", value: latest ? shortDate(latest) : "—", sub: latest ? "The most recent card on file" : "Nothing published yet" },
        ],
      }]),
      row("1fr", [{
        type: "table", title: "Published report cards", tag: `${o.rows.length} card${o.rows.length === 1 ? "" : "s"}`, tagTone: "neutral", sub: "Open a card to read it as the family did.", meta: `${o.rows.length} card${o.rows.length === 1 ? "" : "s"}`, noun: "card", nounPlural: "cards",
        search: "Find a child by name or admission number",
        filters: [
          ...(arms.length > 1 ? [{ label: "Arm", value: "All", options: ["All", ...arms.map((arm) => arm.name)], column: 2 }] : []),
          ...(o.terms.length > 1 ? [{ label: "Term", value: "All", options: ["All", ...[...new Set(o.rows.map((entry) => entry.term))]], column: 3 }] : []),
          ...(grades.length ? [{ label: "Grade", value: "All", options: ["All", ...grades], column: 5 }] : []),
          { label: "State", value: "All", options: ["All", "Published", "Revised"] },
        ],
        selectable: true,
        bulkActs: [{ label: "Print the selected", primary: true, drawer: printSelected }],
        head: ["Student", "Admission no", "Arm", "Term", "Avg", "Grade", "Published", "State", ""], rows, noRowOpen: true, empty: "No card has been published for your arms yet.", foot: "Read only. Retrievals are logged.",
      }]),
  ];
  return {
    title: "Archive", desc: `Every card published for ${arms.map((arm) => arm.name).join(" and ")}, exactly as the family received it.`,
    phoneTitle: picked ? `${picked.name} archive` : arms.length === 1 ? "Your class" : "Your classes", phoneDesc: picked ? "Published cards, exactly as the family received them." : "Choose a class to retrieve a card exactly as the family received it.",
    rows: [...phone, ...desktopOnly(desktop)],
  };
}

/** One child's remark, written by their form master: the record behind it, the sentence, and what was said before. */
export function teacherRemarkPage(p: RemarkPage): TabContent & { crumb: { label: string; href: string } } {
  const s = p.summary;
  const unlocked = !p.published && p.canWriteFormMaster;
  const peers = p.peers.map((peer) => ({ label: peer.name.split(" ").slice(0, 2).map((part, index) => (index === 0 ? part : `${part[0]}.`)).join(" "), href: remarkHref(p.arm.id, peer.id), state: peer.id === p.student.id ? ("now" as const) : ("plain" as const) }));
  const rows: PanelRow[] = [
    row("1fr", [{ type: "days", title: `${p.position} of ${p.of} · ${p.arm.name}`, sub: "Walk the class without going back to the list.", days: peers }]),
    row("1fr", [{
      type: "kpi", title: "What you are writing about", sub: "Every figure here comes from the record, not from memory.", per: 4,
      cards: [
        { label: "Term average", value: s.average === null ? "—" : String(s.average), unit: s.average === null ? undefined : "/ 100", sub: s.armAverage === null ? "" : `Class average ${s.armAverage}`, tone: s.average !== null && s.armAverage !== null && s.average >= s.armAverage ? "positive" : "attention" },
        { label: "Position", value: s.pos === null ? "—" : String(s.pos), unit: `of ${s.outOf}`, sub: "On the approved results" },
        { label: "Attendance", value: p.attendance.pct === null ? "—" : `${p.attendance.pct}%`, sub: `${p.attendance.days} days marked this term`, tone: p.attendance.pct !== null && p.attendance.pct < 85 ? "attention" : "positive" },
        { label: "Subject sheets in", value: String(s.subjects - (s.blocked ? s.blockedBy.length : 0)), unit: `of ${s.subjects}`, sub: s.blocked ? "Some are still being approved" : "Every sheet is approved", tone: s.blocked ? "attention" : "positive" },
      ],
    }]),
    row("1.25fr 1fr", [
      /*
       * Written on the page while it can be written; read as it stands once it cannot.
       *
       * A published card is a thing a family already has, so it is shown rather than offered for
       * typing — a correction goes through the Principal, not through this box.
       */
      unlocked
        ? formMasterForm(p)
        : {
            type: "quotes", title: "Your remark", sub: p.published ? "The card is published — a change reaches the family as a correction." : "Only the form master of this class writes it.",
            quotes: [{ label: "Form master's remark", text: p.teacher.text, by: p.teacher.by ?? "You", role: p.teacher.role, when: p.teacher.when, pill: p.teacher.state, tone: remarkTone(p.teacher.state), emptyText: `You have not written ${p.student.first}'s remark yet.` }],
          },
      {
        type: "facts", title: "What has already been written", sub: "The subject results that will print beneath yours.", per: 1,
        facts: [
          ...p.subjects.slice(0, 5).map((subject): PanelFact => [subject.name, subject.total === null ? "Not in yet" : `${subject.total}${subject.grade ? ` · ${subject.grade}` : ""}`, subject.standing === "—" ? "" : subject.standing]),
          ["Publication", "By the Principal", "You write the remark; the Principal publishes"],
        ],
      },
    ]),
    p.history.length
      ? row("1fr", [{ type: "quotes", title: "What the family was told before", sub: "So two consecutive remarks do not contradict each other.", quotes: p.history.filter((entry) => entry.remark).slice(-2).reverse().map((entry) => ({ label: entry.term, text: entry.remark ?? "", by: "Published", when: entry.published ?? "" })) }])
      : row("1fr", [{ type: "note", tone: "neutral", icon: EYE, title: "No earlier term on record", body: "When this child has a published term behind them, what their family was told appears here." }]),
  ];
  return {
    crumb: { label: "Back to the remark list", href: "/report-cards/remarks" },
    title: p.student.name,
    tag: p.teacher.state === "Submitted" ? "Written" : p.teacher.state, tagTone: p.teacher.state === "Submitted" ? "positive" : p.teacher.state === "Draft" ? "progress" : "attention",
    desc: `${p.arm.name} · ${p.student.adm} · your remark prints above the Principal’s.`,
    primary: p.next ? { label: "Open the next child", icon: ARROW, href: remarkHref(p.arm.id, p.next.id) } : undefined,
    launchers: [{ label: "Preview the card", drawer: cardDrawer(p.student.id, p.term.id, p.student.name) }],
    rows,
  };
}

/** One arm: where every child stands, read as the family will — never published from here. */
export function teacherArmPage(a: CompletionArmPage, me: TeacherWorkspaceView): TabContent & { crumb: { label: string; href: string } } {
  const own = me.formArms.some((arm) => arm.id === a.arm.id);
  const children = a.children;
  const sum = a.sum;
  const first = children.find((child) => child.state === "Remark owed") ?? null;
  const rows: TableRow[] = children.map((child, index) => ({
    // "Written" is inside "Not written", so the remark filter looks for a token the row carries
    // rather than for the word on screen.
    keywords: `${child.name} ${child.adm} rmk-${child.remark === "Submitted" ? "written" : child.remark === "Draft" ? "draft" : "unwritten"}`,
    cells: [
      { kind: "name", name: child.name, sub: `Roll ${String(index + 1).padStart(2, "0")}` }, text(child.adm, { mono: true }), child.average === null ? text("—") : text(String(child.average), { mono: true }), text(child.pos === null ? "—" : String(child.pos)),
      child.grade ? pill(child.grade, gradeTone(child.grade)) : text("—"), pill(child.scores ? "Approved" : "Blocked", child.scores ? "positive" : "negative"), pill(child.remark === "Submitted" ? "Written" : child.remark, remarkTone(child.remark)),
      pill(child.review ? "Reviewed" : child.scores && child.remark === "Submitted" ? "Awaiting" : "Not yet", child.review ? "positive" : child.scores && child.remark === "Submitted" ? "submitted" : "neutral"), pill(child.state as CardState, cardTone(child.state)),
      { kind: "action", label: "View card", drawer: cardDrawer(child.id, a.term.id, child.name) },
    ] as TableCellKind[],
  }));
  const publish = a.publishDate;
  const ready = sum.ready + sum.published;
  const master = a.master?.name ?? "the form master";
  const readFirst = children[0] ? { label: "Read the first card", icon: EYE, drawer: cardDrawer(children[0].id, a.term.id, children[0].name) } : undefined;
  const writeRemarks = own && sum.owed ? { label: `Write the ${sum.owed} remarks you owe`, icon: PEN, href: "/report-cards/remarks" as const } : undefined;
  /*
   * What is holding this arm, each item naming the children it holds.
   *
   * The mockup puts this beside "who writes what" rather than leaving a reader to work it out from
   * five figures: a blocked sheet, a remark not written and a result not yet checked are three
   * different waits with three different owners.
   */
  const holding: ListItem[] = [
    ...(sum.blocked ? [{ label: `${sum.blocked} ${sum.blocked === 1 ? "card is" : "cards are"} waiting on a score sheet`, sub: "A subject sheet is not approved yet, so the card cannot be computed. Nobody is given a zero.", pill: "Blocked", tone: "negative" as const }] : []),
    ...(sum.owed ? [{ label: `${sum.owed} form master ${sum.owed === 1 ? "remark" : "remarks"} still to write`, sub: own ? "Yours." : `By ${master}.`, pill: "Remarks owed", tone: "attention" as const, ...(own ? { viewLabel: "Write them", href: "/report-cards/remarks" as const } : {}) }] : []),
    ...(sum.inReview ? [{ label: `${sum.inReview} waiting on review`, sub: "The result is checked before the card can go out.", pill: "Awaiting review", tone: "submitted" as const }] : []),
    ...(sum.withheld ? [{ label: `${sum.withheld} withheld`, sub: a.policy.withholdForDebt ? "An unpaid fee holds the card, by the school’s own rule." : "Held by a school administrator.", pill: "Withheld", tone: "withheld" as const }] : []),
    ...(!sum.blocked && !sum.owed && !sum.inReview && !sum.withheld ? [{ label: "Nothing is holding this arm", sub: "Every card is ready for the Principal to publish.", pill: "Ready", tone: "positive" as const }] : []),
  ];
  return {
    crumb: { label: "Back to Completion", href: "/report-cards/completion" },
    title: `${a.arm.name} · report cards`,
    tag: ready === children.length ? "All ready" : `${ready} of ${children.length} ready`,
    tagTone: ready === children.length ? "positive" : sum.blocked ? "negative" : "attention",
    desc: `Where each of the ${children.length} children stands. ${own ? "You write the form master’s remark; " : `${a.master?.name ?? "The form master"} writes the remarks; `}the Principal publishes${publish ? ` on ${shortDate(publish.iso)}` : ""}.`,
    primary: writeRemarks ?? readFirst,
    launchers: writeRemarks && readFirst ? [readFirst] : [],
    rows: [
      row("1fr", [{
        type: "kpi", title: `${a.arm.name} · ${a.term.name} ${a.term.session}`, per: 5,
        cards: [
          { label: "Ready", value: String(sum.ready + sum.published), unit: `of ${children.length}`, sub: "Scores, remark and review all in", tone: sum.ready + sum.published === children.length ? "positive" : "attention" },
          { label: "Blocked on scores", value: String(sum.blocked), sub: sum.blocked ? "A subject sheet is not approved" : "Every sheet is in", tone: sum.blocked ? "negative" : "positive" },
          { label: own ? "Your remarks owed" : "Remarks owed", value: String(sum.owed), sub: sum.owed ? (own ? "Write them from Remarks" : `By ${a.master?.name ?? "the form master"}`) : "All written", tone: sum.owed ? "attention" : "positive", link: own && sum.owed && first ? "Write them" : undefined, href: own && sum.owed ? "/report-cards/remarks" : undefined },
          { label: "Awaiting review", value: String(sum.inReview), sub: "Checked before publication", tone: sum.inReview ? "submitted" : "positive" },
          { label: "Published", value: String(sum.published), sub: sum.published ? "With families" : "Nothing has reached a family", tone: "neutral" },
        ],
      }]),
      row("1fr", [{
        type: "table", title: `Every child in ${a.arm.name}`, tag: `${sum.ready + sum.published} ready`, tagTone: sum.ready + sum.published === children.length ? "positive" : "attention", sub: "Open a child to read their card exactly as the family will see it.",
        meta: `${children.length} children · ${a.subjects.of} subjects · ${ready} ready · ${sum.blocked} blocked · ${sum.owed} remarks owed`, search: "Find a child by name or admission number", noun: "card", nounPlural: "children",
        filters: [
          { label: "State", value: "All", options: ["All", "Ready", "Blocked", "Remark owed", "Awaiting review", "Published", "Withheld"], column: 8 },
          { label: "Scores", value: "All", options: ["All", "Approved", "Blocked"], column: 5 },
          { label: "Remark", value: "All", options: ["All", "Written", "Draft", "Not written"], match: { Written: "rmk-written", Draft: "rmk-draft", "Not written": "rmk-unwritten" } },
        ],
        /*
         * The mockup's bulk action reads the first card ticked. A trigger here is data rather than
         * a callback, so it cannot name a row chosen after the page was drawn — the ticked rows
         * come down as a list instead, which is what a teacher chasing an arm actually wants.
         */
        selectable: true, bulkActs: [{ label: "Export the selected", export: true }],
        head: ["Student", "Admission no", "Avg", "Pos", "Grade", "Scores", "Remark", "Review", "State", ""], rows, per: 12, noRowOpen: true, foot: "View only. A card is published by the Principal, never from this page.",
      }]),
      row("1.1fr 1fr", [
        {
          type: "facts", title: "Who writes what on these cards", per: 1,
          facts: [
            ["Form master’s remark", own ? "You" : (a.master?.name ?? "Not assigned"), own ? `${a.remarksWritten} of ${children.length} written` : "You read it; you do not write it"],
            ["Subject comments", `${a.subjects.of} ${a.subjects.of === 1 ? "subject" : "subjects"}`, "Each teacher writes the line beside their own subject"],
            ["Principal’s remark", a.principalWritten ? `${a.principalWritten} of ${children.length} written` : "Written at publication", "By the Principal, never from this page"],
            ["Publication", publish ? shortDate(publish.iso) : "Not set yet", "By the Principal — in-app to the student and guardian portals"],
            ["Card design", a.school, "The same card the school prints"],
          ] as PanelFact[],
        },
        { type: "list", title: "What is holding this arm", sub: "Each item names the children it holds.", items: holding },
      ]),
      row("1fr", [{ type: "note", tone: "withheld", icon: SHIELD, title: "Publishing, printing and sending stay with the Principal", body: "You read a card exactly as the family will, and you write the form master’s remark. Nothing reaches a family from this page." }]),
    ],
  };
}
