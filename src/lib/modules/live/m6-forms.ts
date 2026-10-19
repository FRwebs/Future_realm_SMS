import { documentDrawer } from "@/lib/modules/live/documents";
import { nudgeDrawer } from "@/lib/modules/live/m4-forms";
import type { ArchiveOverview, RemarkPage } from "@/lib/modules/live/m6-types";
import { area, checks, choice, fixed, select, toggle } from "@/lib/modules/live/m7-forms";
import { plural } from "@/lib/modules/live/m7-format";
import type { DrawerSpec, FormField, PickerOption } from "@/lib/modules/panels";

/** Every modal in Report Cards, as data. */

export const RC = "/api/v1/report-cards";

export const remarkHref = (classId: string, studentId: string) => `/report-cards/remarks/${encodeURIComponent(classId)}/${encodeURIComponent(studentId)}`;
export const completionHref = (classId: string) => `/report-cards/completion/${encodeURIComponent(classId)}`;
/** A child's card, opened in its modal over whatever page it was asked for from. */
export const cardDrawer = (studentId: string, termId: string | undefined, name: string): DrawerSpec => documentDrawer("card", studentId, { title: `${name}'s report card`, kicker: "Report card", query: { term: termId } });

const pair = (items: Array<{ value: string; label: string }>) => Object.fromEntries(items.map((item) => [item.label, item.value]));
const picker = (label: string, options: PickerOption[], o: Record<string, unknown> = {}) => ({ label, kind: "picker", options, checked: [], span: 2, ...o }) as FormField;

/* ───────────────────────── remarks ───────────────────────── */

export function reviewDrawer(p: RemarkPage): DrawerSpec {
  const next = p.next;
  const s = p.summary;
  const preset = p.mine.text || p.suggestion;
  return {
    mode: "form", kicker: `Reports · ${p.arm.name}`, title: `Your review of ${p.student.name}`, sub: "It goes onto the card beside the form master's remark.",
    commitLabel: next ? "Submit and open the next" : "Submit the review", commitDone: "Review submitted", commitDoneBody: next ? `Opening ${next.name} is one tap away.` : `That was the last child in ${p.arm.name}.`,
    reviewNote: "This is the sentence a family reads most carefully. It prints under the form master's. Nothing reaches a family until the card is published.",
    next: next ? { label: `Open ${next.name}`, href: remarkHref(p.arm.id, next.id) } : { label: `Back to reports`, href: "/report-cards/remarks" },
    fields: [
      fixed("This term", s.average === null ? "No result yet" : `${s.average} average · position ${s.pos ?? "—"} of ${s.outOf} · grade ${s.grade ?? "—"}`, { hint: `Band: ${s.band} · best ${s.best?.name ?? "—"} · weakest ${s.weakest?.name ?? "—"}` }),
      area(`Review of ${p.student.first}`, { span: 2, required: true, value: preset, placeholder: "Write it in your own words — two or three sentences is plenty.", hint: p.mine.text ? "What you saved is here." : "The suggestion for this band is pre-filled. Edit it into your own words." }),
      choice("Tone", p.tones, { span: 2, value: p.mine.tone }),
      checks("Also flag to the school", p.flagOptions, p.mine.flags, { span: 2 }),
      choice("Save as", ["Final · ready for the card", "Draft · I will come back to it"], { span: 2, value: "Final · ready for the card" }),
    ],
    submit: { endpoint: RC + "/remarks", method: "POST", body: { student: p.student.id, author: "PRINCIPAL" }, map: { [`Review of ${p.student.first}`]: "text", Tone: "tone", "Also flag to the school": "flags", "Save as": "final" }, encode: { "Save as": { "Final · ready for the card": "true", "Draft · I will come back to it": "false" } } },
  };
}

export function formMasterDrawer(p: RemarkPage): DrawerSpec {
  return {
    mode: "form", kicker: `Remarks · ${p.arm.name}`, title: `Form master's remark · ${p.student.name}`, sub: p.teacher.state === "Submitted" ? "Already on the card. Saving replaces it until the card is published." : "A card cannot generate without it.",
    commitLabel: "Save the remark", commitDone: "Remark saved", commitDoneBody: `It is on ${p.student.name}'s card. Nothing is published to the family yet.`,
    reviewNote: `This appears on the printed card, in the guardian portal, and in the school's permanent record of this child. If you are not the form master it is logged as written on their behalf.`,
    fields: [
      fixed("This term", p.summary.average === null ? "No result yet" : `${p.summary.average} average · position ${p.summary.pos ?? "—"} · grade ${p.summary.grade ?? "—"}`, { hint: `Band: ${p.summary.band} · best ${p.summary.best?.name ?? "—"} · weakest ${p.summary.weakest?.name ?? "—"}` }),
      area("Remark", { span: 2, required: true, value: p.teacher.text || p.suggestion, hint: "The suggestion for this band is pre-filled. A family reads this sentence more carefully than the numbers." }),
      choice("Tone", p.tones, { span: 2, value: p.mine.tone }),
      checks("Also flag to the school", p.flagOptions, [], { span: 2 }),
      choice("Save as", ["Final · ready for the card", "Draft · I will come back to it"], { span: 2, value: "Final · ready for the card" }),
    ],
    submit: { endpoint: RC + "/remarks", method: "POST", body: { student: p.student.id, author: "FORM_MASTER" }, map: { Remark: "text", Tone: "tone", "Also flag to the school": "flags", "Save as": "final" }, encode: { "Save as": { "Final · ready for the card": "true", "Draft · I will come back to it": "false" } } },
  };
}

export function bandDrawer(arms: Array<{ id: string; name: string }>, preset: string[], bands: string[], label: string): DrawerSpec {
  return {
    mode: "form", kicker: `Reports · ${label}`, title: "Apply a band review", sub: "One wording for everyone in a band, then refined child by child.",
    commitLabel: "Apply the review", commitDone: "Band review applied", commitDoneBody: "Each one is on the child's card now. Open any of them to refine the wording.",
    reviewNote: "{first} in the wording becomes each child's own first name. Cards already published are never touched.",
    fields: [
      checks("Arms", arms.map((arm) => arm.name), preset, { span: 2, required: true }),
      select("Band", bands, { required: true, value: bands[0], hint: "By term average: Excellent 75+, Very good 70+, Good 65+, Fair 50+, Weak 40+." }),
      area("Wording", { span: 2, required: true, value: "An excellent result. {first} has earned it, and the school is proud of the standard set this term." }),
      choice("Tone", ["Encouraging", "Plain", "Firm"], { span: 2, value: "Encouraging" }),
      toggle("Only children with no review yet", true, "Anything already written is left as it is", "Overwrite what is there", { span: 2 }),
    ],
    submit: { endpoint: `${RC}/remarks/band`, method: "POST", map: { Arms: "arms", Band: "band", Wording: "text", Tone: "tone", "Only children with no review yet": "onlyEmpty" }, encode: { Arms: pair(arms.map((arm) => ({ value: arm.id, label: arm.name }))) } },
  };
}

export const notifyBehind = (people: Array<{ id: string; name: string }>, school: string, title = "Notify the form masters behind"): DrawerSpec =>
  nudgeDrawer({ endpoint: `${RC}/notify`, people, kicker: "Report cards", title, who: "form masters who have not finished their remarks", what: "How many remarks they owe, and the publish date it holds up", href: "/report-cards/remarks", message: `You still owe form master remarks for report cards. They cannot be generated without them. Please write them. — ${school || "the school"}` });

/* ───────────────────────── publishing ───────────────────────── */

type Scope = { arms?: string[]; level?: string; everything?: boolean; students?: string[] };

export function publishDrawer(o: { label: string; ready: number; total: number; skipped?: Array<[string, number]>; scope: Scope; reversibleMinutes: number; withholdForDebt: boolean; term: string }): DrawerSpec {
  const left = o.total - o.ready;
  return {
    mode: "commit", kicker: `Report cards · ${o.term}`, title: o.ready === o.total ? `Publish ${o.total === 1 ? "the" : "all"} ${plural(o.total, "card")} · ${o.label}` : `Publish ${plural(o.ready, "card")} · ${o.label}`,
    sub: "Publishing puts the card in the student portal and the guardian portal at the same time.",
    facts: [
      ["Scope", `${o.label} · ${o.ready} of ${plural(o.total, "card")}`, "Only cards with scores, a remark and a review"],
      ["Skipped", left ? `${plural(left, "child", "children")}` : "None", left ? (o.skipped ?? []).filter(([, count]) => count).map(([name, count]) => `${count} ${name}`).join(" · ") || "Something on their row is still outstanding — never published half-finished" : "Every card is final"],
      ["Goes to", "Student portal and guardian portal", "Both at once, free, instantly"],
      ["Families notified", "Yes · in-app", "SMS, email and WhatsApp are a separate send"],
      ["Fee balances", o.withholdForDebt ? "A child with an unpaid balance is left out" : "Not withheld", o.withholdForDebt ? "Your policy — changeable in the school's report card policy" : "Your policy publishes cards regardless of debt"],
      ["Reversible", `For ${o.reversibleMinutes} minutes`, "After that a correction reissues the card and tells the family why"],
      ["Logged as", "Your name", o.ready === 1 ? "Against the card" : `Against every one of the ${o.ready} cards`],
    ],
    commitLabel: o.ready === o.total ? (o.total === 1 ? "Publish it" : `Publish all ${o.total}`) : `Publish these ${o.ready}`, commitDone: `${plural(o.ready, "card")} published`,
    commitDoneBody: "They are in the student and guardian portals now, and every family has been notified in-app.",
    submit: { endpoint: `${RC}/publish`, method: "POST", body: o.scope as Record<string, unknown> },
  };
}

export function printDrawer(o: { label: string; total: number; drafts: number; scope: Scope; wider?: string }): DrawerSpec {
  return {
    mode: "output", kicker: o.label, title: "Print report cards", sub: "One page per child, in roll order.",
    facts: [
      ["Scope", `${o.label} · ${plural(o.total, "child", "children")}`, o.wider ?? "Choose a wider scope from the tab"],
      ["Drafts included", o.drafts ? `Yes · ${o.drafts} watermarked DRAFT` : "None — every card is final", "A draft card is printed watermarked so it can never be handed out by mistake"],
      ["Paper", "A4 · portrait", "Save as PDF from the print dialog"],
      ["Stamp block", "Included", "A card is invalid without the school stamp"],
    ],
    commitLabel: "Open the print run", commitDone: "Print run recorded", commitDoneBody: "The run is on the history, under your name.",
    submit: { endpoint: `${RC}/print`, method: "POST", body: o.scope as Record<string, unknown> },
  };
}

export function sendDrawer(o: { label: string; ready: number; total: number; scope: Scope; school: string; term: string }): DrawerSpec {
  const skipped = o.total - o.ready;
  return {
    mode: "form", kicker: o.label, title: "Send cards to guardians", sub: "Only published cards can be sent.",
    commitLabel: "Send them", commitDone: "Cards sent", commitDoneBody: "Every guardian on the list has been written to, by the channels you chose.",
    reviewNote: "This is a send outside the app, so it costs credits and cannot be recalled once it leaves.",
    fields: [
      fixed("Scope", `${o.label} · ${plural(o.ready, "card")} ready`, { hint: skipped ? `${skipped} children are skipped — their card is not final` : "Every card here is final" }),
      checks("Channels", ["SMS with a portal link · 1 credit each", "Email with a link · free", "WhatsApp · 1 credit each", "Printed copy for collection · free"], ["SMS with a portal link · 1 credit each", "Email with a link · free"], { span: 2, required: true, hint: "The in-app portal is always used. SMS and email are queued, not yet delivered." }),
      choice("Recipients", ["Primary guardian only", "Every guardian on the record"], { span: 2, value: "Primary guardian only" }),
      area("Message", { span: 2, required: true, value: `Dear parent, your child's ${o.term} report card is now available. You can open it in the parent portal. — ${o.school || "the school"}` }),
      toggle("Also publish to the portals now", true, "Published to the student and guardian portal", "Send only — do not publish", { span: 2 }),
    ],
    submit: { endpoint: `${RC}/send`, method: "POST", body: o.scope as Record<string, unknown>, map: { Channels: "channels", Recipients: "recipients", Message: "message", "Also publish to the portals now": "publish" } },
  };
}

export function withholdDrawer(student: { id: string; name: string }, label: string): DrawerSpec {
  return {
    mode: "form", kicker: label, title: `Withhold ${student.name}'s card`, sub: "It is never published with the rest, until you release it.",
    commitLabel: "Withhold it", commitDone: "Card withheld", commitDoneBody: "It is skipped by every publish, and listed on the archive as withheld.",
    reviewNote: "Withholding a card is the school's decision and is kept on record with your reason. It cannot be done once a family has the card.",
    fields: [area("Why", { span: 2, required: true, placeholder: "The reason the school recorded." })],
    submit: { endpoint: `${RC}/withhold`, method: "POST", body: { student: student.id }, map: { Why: "reason" } },
  };
}

export function releaseDrawer(student: { id: string; name: string }): DrawerSpec {
  return { mode: "commit", kicker: "Report cards", title: `Release ${student.name}'s card`, sub: "It goes back to being an ordinary card, published with the rest when it is ready.", facts: [["Child", student.name], ["Effect", "No longer withheld", "It is still not published until you publish it"]], commitLabel: "Release it", commitDone: "Card released", commitDoneBody: "It is an ordinary card again.", submit: { endpoint: `${RC}/release/${student.id}`, method: "POST" } };
}

export function reissueDrawer(a: ArchiveOverview, pre?: { id: string; name: string; termId: string }): DrawerSpec {
  const students = Array.from(new Map(a.rows.map((row) => [row.studentId, row])).values());
  return {
    mode: "form", kicker: "Archive", title: "Reissue a card", sub: "A card the family holds is revised, never replaced.",
    commitLabel: "Reissue", commitDone: "Card reissued", commitDoneBody: "The reissue is on the history. A corrected result adds a revision beside the original.",
    reviewNote: "Lost or damaged copies are printed again as they were. A corrected result issues a new revision and tells the family why.",
    fields: [
      picker("Child", students.map((row) => ({ value: row.studentId, label: row.name, sub: row.adm, group: row.arm })), { required: true, checked: pre ? [pre.id] : [], placeholder: "Search by name or admission number", noun: "child", nounPlural: "children" }),
      select("Term", a.terms.map((term) => `${term.name} ${term.session}`), { required: true, value: (() => { const chosen = pre ? a.terms.find((term) => term.id === pre.termId) : a.terms.find((term) => term.current) ?? a.terms[0]; return chosen ? `${chosen.name} ${chosen.session}` : undefined; })() }),
      select("Reason", ["Lost", "Damaged", "Corrected result", "Never delivered"], { required: true }),
      choice("Delivery", ["Print", "Portal", "Both"], { span: 2, value: "Both" }),
    ],
    submit: { endpoint: `${RC}/archive/reissue`, method: "POST", map: { Child: "student", Term: "term", Reason: "reason", Delivery: "delivery" }, encode: { Term: pair(a.terms.map((term) => ({ value: term.id, label: `${term.name} ${term.session}` }))) } },
  };
}
