import { area, choice, fixed, select } from "@/lib/modules/live/m7-forms";
import { plural } from "@/lib/modules/live/m7-format";
import type { Correction, CorrectionOptions, Grid, SheetPage } from "@/lib/modules/live/m5-types";
import type { DrawerSpec, FormField, PanelFact, PickerOption } from "@/lib/modules/panels";

/** Every modal in Score Entry & Results, as data. */

export const SR = "/api/v1/score-results";

const picker = (label: string, options: PickerOption[], o: Record<string, unknown> = {}) => ({ label, kind: "picker", options, checked: [], span: 2, ...o }) as FormField;

export const sheetHref = (classId: string, subjectId: string) => `/score-entry-results/review/${encodeURIComponent(classId)}/${encodeURIComponent(subjectId)}`;
export const armReviewHref = (classId: string) => `/score-entry-results/review/${encodeURIComponent(classId)}`;
export const reviewStudentHref = (classId: string, studentId: string) => `/score-entry-results/review/${encodeURIComponent(classId)}/students/${encodeURIComponent(studentId)}`;
export const gridHref = (classId: string, subjectId: string) => `/score-entry-results/enter/${encodeURIComponent(classId)}/${encodeURIComponent(subjectId)}`;
export const previewHref = (classId: string, subjectId: string) => `${gridHref(classId, subjectId)}/preview`;
export const broadsheetHref = (classId: string) => `/score-entry-results/enter/${encodeURIComponent(classId)}/broadsheet`;
export const resultArmHref = (classId: string) => `/score-entry-results/results/${encodeURIComponent(classId)}`;
export const resultStudentHref = (classId: string, studentId: string) => `/score-entry-results/results/${encodeURIComponent(classId)}/${encodeURIComponent(studentId)}`;

const when = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }) : "—");
const spread = (page: SheetPage) => page.distribution.filter((band) => band.count).map((band) => `${band.label} × ${band.count}`).join(" · ") || "Nothing scored";

/* ───────────────────────── deciding a sheet ───────────────────────── */

function decisionFacts(page: SheetPage): PanelFact[] {
  const s = page.stats;
  return [
    ["Sheet", `${page.subject.name} · ${page.arm.name}`, `${page.term.name} ${page.term.session}${page.frameworkAt ? ` · framework pinned ${when(page.frameworkAt)}` : ""}`],
    ["Teacher", page.teacher?.name ?? "No teacher mapped", page.decision.submittedBy ? `Submitted by ${page.decision.submittedBy}` : "Entered and submitted this sheet"],
    ["Children on the sheet", String(s.roll), `${s.scored} scored · ${s.roll - s.scored} not scored`],
    ["Components", page.columns.map((column) => `${column.name} ${column.max}`).join(" · "), "Each mark checked against its maximum"],
    ["Subject average", s.mean === null ? "—" : `${s.mean} / 100`, s.armMean === null ? "" : `Arm average ${s.armMean}`],
    ["Highest", s.high ? `${s.high.total} · ${s.high.name}` : "—"],
    ["Lowest", s.low ? `${s.low.total} · ${s.low.name}` : "—", s.low && s.low.total < page.subject.passMark ? "Below the pass mark" : ""],
    ["At credit or above", `${s.passed} of ${s.scored}`, "50 and above"],
    ["Below the pass mark", String(s.failed), `Under ${page.subject.passMark}`],
    ["Grade spread", spread(page), "Against this school's own bands"],
    ["Open flags", String(page.openFlags), page.openFlags ? "Each needs an outcome recorded before approval" : "Nothing flagged"],
    ["Validation", "Passed — no mark exceeds its maximum", "Absences excluded from the average, never scored zero"],
  ];
}

export function decisionDrawer(page: SheetPage, kind: "approve" | "rework" | "decline"): DrawerSpec {
  const teacher = page.teacher?.name ?? "the teacher";
  const base = { classId: page.arm.id, subjectId: page.subject.id };
  const endpoint = `${SR}/review/${base.classId}/${base.subjectId}/decide`;
  if (kind === "approve") {
    return {
      mode: "commit", kicker: "Score review · preview before you approve", title: `Approve ${page.subject.name} · ${page.arm.name}`, sub: "The sheet you are approving, exactly as it stands.",
      facts: [...decisionFacts(page), ["What approval does", `Makes all ${page.stats.scored} scores final`, "They feed the broadsheet, the position and the report card"], ["Reversible", "For 48 hours", "After that a correction request with a reason is required"], ["Cards it unblocks", String(page.cardsWaiting), `Every report card in ${page.arm.name} waiting on this subject`]],
      commitLabel: "Approve this sheet", commitNote: "Reversible for 48 hours after that.", commitDone: `${page.subject.name} · ${page.arm.name} approved`,
      commitDoneBody: `All ${page.stats.scored} scores are final and now feed the broadsheet, the positions and the report cards.`,
      next: { label: `Back to ${page.arm.name}`, href: armReviewHref(page.arm.id) },
      submit: { endpoint, method: "POST", body: { decision: "approve" } },
    };
  }
  if (kind === "rework") {
    return {
      mode: "commit", kicker: `Score review · ${page.arm.name}`, title: `Send ${page.subject.name} · ${page.arm.name} back for rework`,
      sub: "The scores already entered are kept. The teacher corrects what you name and resubmits the same sheet.",
      facts: [...decisionFacts(page).slice(0, 5), ["Effect", "The sheet returns to the teacher", "Everything entered is kept"], ["The teacher", "Corrects and resubmits", "They see exactly what you asked for"], ["Cards", "Stay blocked until it comes back", `${page.cardsWaiting} report cards in ${page.arm.name}`]],
      commitLabel: "Send it back", commitNote: `${teacher} is notified with your reason.`, commitDone: "Sent back for rework", commitDoneBody: "It is back with the teacher with your notes. The scores they already entered are kept.",
      next: { label: `Back to ${page.arm.name}`, href: armReviewHref(page.arm.id) },
      submit: { endpoint, method: "POST", body: { decision: "rework" }, reasonKey: "reason", reasonLabel: "What must be corrected — required", reasonRequired: true },
    };
  }
  return {
    mode: "commit", kicker: "Score review · preview before you decline", title: `Decline ${page.subject.name} · ${page.arm.name}`,
    sub: `Nothing on this sheet will count, and ${teacher} must enter it again from scratch.`,
    facts: [...decisionFacts(page), ["What declining does", "Voids the whole sheet", `${page.subject.name} · ${page.arm.name} returns to Not started`], ["The teacher", "Enters it again from scratch", "They are told your reason verbatim"], ["Cards", "Stay blocked", `${page.cardsWaiting} report cards in ${page.arm.name}`], ["If it is only partly wrong", "Send it back for rework instead", "That keeps what was entered and asks for a correction"]],
    commitLabel: "Decline this sheet", commitNote: `${teacher} is notified with your reason.`, commitDone: `${page.subject.name} · ${page.arm.name} declined`,
    commitDoneBody: `The sheet is void and reads Not started again. ${teacher} has your reason and must enter it afresh.`,
    next: { label: `Back to ${page.arm.name}`, href: armReviewHref(page.arm.id) },
    submit: { endpoint, method: "POST", body: { decision: "decline" }, reasonKey: "reason", reasonLabel: "Why you are declining it — required", reasonRequired: true },
  };
}

export function reverseDrawer(page: SheetPage): DrawerSpec {
  return {
    mode: "commit", kicker: `Score review · ${page.arm.name}`, title: `Take back the approval of ${page.subject.name}`, sub: "The sheet goes back to waiting for a decision. Nothing the teacher entered changes.",
    facts: [["Sheet", `${page.subject.name} · ${page.arm.name}`, page.decision.decidedBy ? `Approved by ${page.decision.decidedBy} on ${when(page.decision.decidedAt)}` : ""], ["Open until", page.reverseUntil ? new Date(page.reverseUntil).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "—", "Forty-eight hours from the approval"], ["Effect", "Its scores stop feeding the broadsheet", "Report cards in this arm are blocked again"]],
    commitLabel: "Take the approval back", commitDone: "Approval taken back", commitDoneBody: "The sheet is waiting for a decision again. The reversal is in the audit log under your name.",
    next: { label: "Back to the sheet", href: sheetHref(page.arm.id, page.subject.id) },
    submit: { endpoint: `${SR}/review/${page.arm.id}/${page.subject.id}/reverse`, method: "POST", reasonKey: "reason", reasonLabel: "Why it is being taken back — required", reasonRequired: true },
  };
}

export function flagOutcomeDrawer(page: SheetPage, flag: SheetPage["flags"][number]): DrawerSpec {
  return {
    mode: "form", kicker: `Verification · ${page.subject.name} · ${page.arm.name}`, title: flag.title, sub: flag.detail,
    commitLabel: "Record the outcome", commitDone: "Outcome recorded", commitDoneBody: "The sheet can be approved once every flag has an outcome. This one is kept with the sheet.",
    reviewNote: "A flag is a question the system asks of the numbers. The answer — and who gave it — stays with the sheet.",
    fields: [
      fixed("What was found", flag.detail, { span: 2, hint: flag.blocking ? "Needs an outcome before the sheet can be approved" : "Reported for information" }),
      select("Outcome", page.outcomes, { required: true, span: 2, value: flag.outcome?.outcome ?? page.outcomes[0] }),
      area("What you checked", { span: 2, optional: true, value: flag.outcome?.note ?? "", placeholder: "Say what you looked at. A follow-up outcome needs this." }),
    ],
    submit: { endpoint: `${SR}/review/${page.arm.id}/${page.subject.id}/flags`, method: "POST", body: { key: flag.key }, map: { Outcome: "outcome", "What you checked": "note" } },
  };
}

export function approveReadyDrawer(sheets: Array<{ classId: string; subjectId: string; name: string; roll: number }>, scope: string, arms?: string[]): DrawerSpec {
  const students = sheets.reduce((total, sheet) => total + sheet.roll, 0);
  return {
    mode: "commit", kicker: "Score review", title: `Approve ${plural(sheets.length, "sheet")}`, sub: `Every submitted sheet with no open flags${scope ? ` ${scope}` : ""}.`,
    facts: [
      ["Sheets", String(sheets.length), sheets.slice(0, 3).map((sheet) => sheet.name).join(", ") + (sheets.length > 3 ? "…" : "")],
      ["Scores that become final", String(students), "They feed the broadsheet and the report cards"],
      ["Open flags", "None", "A flagged sheet is never bulk-approved"],
      ["Sheets you entered", "Left out", "You cannot approve a sheet you entered"],
      ["Reversible", "For 48 hours", "After that a correction request is required"],
    ],
    commitLabel: `Approve all ${sheets.length}`, commitDone: `${plural(sheets.length, "sheet")} approved`, commitDoneBody: "Their scores are final and now feed the broadsheet.",
    submit: { endpoint: `${SR}/review/approve-ready`, method: "POST", body: arms ? { arms } : { sheets: sheets.map((sheet) => `${sheet.classId}:${sheet.subjectId}`) } },
  };
}

export function approveArmsDrawer(): DrawerSpec {
  return {
    mode: "commit", kicker: "Score review", title: "Approve everything ready in the selected arms", sub: "Every submitted sheet with no open flags, in each arm you ticked.",
    facts: [
      ["Which sheets", "Submitted, with no open flag", "A flagged sheet is never bulk-approved"],
      ["Sheets you entered", "Left out", "You cannot approve a sheet you entered"],
      ["Effect", "Those scores become final", "They feed the broadsheet and the report cards"],
      ["Reversible", "For 48 hours", "After that a correction request is required"],
    ],
    commitLabel: "Approve what is ready", commitDone: "Sheets approved", commitDoneBody: "Their scores are final and now feed the broadsheet. Anything left out is named on the next screen.",
    submit: { endpoint: `${SR}/review/approve-ready`, method: "POST" },
  };
}

/* ───────────────────────── entering ───────────────────────── */

export function submitDrawer(g: Grid): DrawerSpec {
  const s = g.stats;
  const best = g.rows.filter((row) => row.total !== null).slice().sort((a, b) => (b.total as number) - (a.total as number));
  return {
    mode: "commit", kicker: "Enter scores", title: `Submit ${g.subject.name} ${g.arm.name} for approval`, sub: "This is exactly what will be submitted. Check it before it leaves your hands.",
    facts: [
      ["Sheet", `${g.subject.name} · ${g.arm.name}`, `${g.term.name} ${g.term.session}`],
      ["Children", String(s.roll), "Every one of them needs a mark or an A"],
      ["Scored", `${s.scored} of ${s.roll}`, s.blanks ? `${s.blanks} still blank — they will have no total` : "No blanks"],
      ["Marked absent", String(s.absences), "Excluded from the average, never scored zero"],
      ["Highest", s.high ? String(s.high.total) : "—", s.high?.name ?? ""],
      ["Lowest", s.low ? String(s.low.total) : "—", s.low ? `${s.low.name}${best.length && s.low.total < g.passMark ? " · below the pass mark" : ""}` : ""],
      ["Average", s.mean === null ? "—" : String(s.mean), s.armMean === null ? "" : `Arm average ${s.armMean}`],
      ["Validation", "Passed · no mark exceeds its maximum", g.pinned ? `Checked against the framework pinned ${when(g.frameworkAt)}` : "Checked against the framework in force today"],
      ["Goes to", "The review queue", "An Exam Officer, who decides it"],
      ["After submission", "You can no longer edit it", "A change needs a correction request with a reason"],
    ],
    commitLabel: "Submit for approval", commitDone: "Submitted for approval", commitDoneBody: "It is in the review queue. You will be told when it is approved or returned.",
    next: { label: "Back to choosing a sheet", href: "/score-entry-results/enter" },
    submit: { endpoint: `${SR}/enter/${g.arm.id}/${g.subject.id}/submit`, method: "POST" },
  };
}

export function deleteEntryDrawer(g: Grid): DrawerSpec {
  return {
    mode: "commit", kicker: "Enter scores", title: `Delete the entry for ${g.subject.name} · ${g.arm.name}`,
    sub: "Every mark you have entered for this subject is removed. The sheet returns to Not started and nobody can see what was here.",
    facts: [["Sheet", `${g.subject.name} · ${g.arm.name}`, `${g.term.name} ${g.term.session}`], ["Scores removed", String(g.stats.scored), "Every component for every child"], ["Sheet becomes", "Not started", "It can be entered again from scratch"], ["Cards", "Stay blocked", `${g.stats.roll} report cards in ${g.arm.name}`], ["Reversible", "No", "The deletion itself is logged, but the marks are gone"]],
    commitLabel: "Delete the entry", commitNote: "You will be asked to confirm once more.", commitDone: "Entry deleted", commitDoneBody: `${g.subject.name} · ${g.arm.name} reads Not started again. The deletion is in the audit log under your name.`,
    next: { label: "Back to choosing a sheet", href: "/score-entry-results/enter" },
    submit: { endpoint: `${SR}/enter/${g.arm.id}/${g.subject.id}/delete`, method: "POST", reasonKey: "reason", reasonLabel: "Why you are deleting it — required", reasonRequired: true },
  };
}

/* ───────────────────────── corrections ───────────────────────── */

export function requestCorrectionDrawer(o: CorrectionOptions, preset: { student?: string; subject?: string; component?: string; arm?: string; label?: string } = {}): DrawerSpec {
  return {
    mode: "form", kicker: preset.label ?? "Score correction", title: "Request a score correction", sub: "Reason and evidence, two-step approval once a family has seen the result, and the consequence stated up front.",
    commitLabel: "Request the correction", commitDone: "Correction requested", commitDoneBody: "It is with the approvers. The mark does not change until they decide.",
    reviewNote: "A score that has been approved never changes quietly. A correction keeps the old mark, the new mark, your reason and the decision side by side.",
    fields: [
      picker("Child", o.students.map((student) => ({ value: student.id, label: student.name, sub: `${student.adm} · ${student.arm}`, group: student.arm })), { required: true, checked: preset.student ? [preset.student] : [], placeholder: "Search by name or admission number", noun: "child", nounPlural: "children", hint: "Corrections are made one child, one mark at a time." }),
      select("Subject", o.subjects, { required: true, value: preset.subject ?? o.subjects[0] }),
      select("Component", o.components, { required: true, value: preset.component ?? o.components[o.components.length - 1] }),
      { label: "Corrected mark", kind: "text", required: true, placeholder: "e.g. 54 — or A for absent", hint: "A mark within the component's maximum." } as FormField,
      select("Reason", o.reasons, { required: true, span: 2 }),
      area("What happened", { span: 2, required: true, placeholder: "Kept permanently beside both marks, and visible to the family if they ask." }),
      { label: "Evidence", kind: "area", span: 2, optional: true, placeholder: "What was seen: the re-marked script, the register of marks, a query letter." } as FormField,
      fixed("Who decides", o.routing, { hint: "From Approvals · Routing. The person who asks never decides." }),
      fixed("If it has reached a family", "A revision is issued and the family told", { hint: "The earlier version is kept — it is revised, not replaced" }),
    ],
    submit: { endpoint: `${SR}/corrections`, method: "POST", map: { Child: "student", Subject: "subject", Component: "component", "Corrected mark": "to", Reason: "reason", "What happened": "explanation", Evidence: "evidence" } },
  };
}

export function decideCorrectionDrawer(c: Correction): DrawerSpec {
  const step = c.nextStep ?? 1;
  const effect = c.effect;
  return {
    mode: "decide", kicker: `Score correction · ${c.arm}`, title: `${c.subject} · ${c.student}, ${c.from ?? "blank"} → ${c.to < 0 ? "absent" : c.to}`,
    sub: c.reachedParent ? `Step ${step} of 2 · this result has already reached the family.` : "One approval · this result has not reached the family.",
    facts: [
      ["Subject", `${c.subject} · ${c.arm}`, c.component], ["Child", c.student, c.adm], ["Change", `${c.from ?? "blank"} → ${c.to < 0 ? "absent" : c.to}`, c.to >= 0 && c.from !== null ? `${c.to - c.from > 0 ? "+" : ""}${c.to - c.from} marks` : ""],
      ["Reason", c.reason, c.evidence ?? "No evidence described"], ["What happened", c.explanation, ""], ["Requested by", c.requestedBy, c.requestedAt],
      ["Effect if approved", effect ? `Average ${effect.avgBefore ?? "—"} → ${effect.avgAfter ?? "—"}` : "Worked out when decided", effect ? `Position ${effect.posBefore ?? "—"} now` : ""],
      ["Reached a family?", c.reachedParent ? "Yes" : "No", c.reachedParent ? "Revision issued and the family told if approved" : "The result has not been published"],
      ...(c.stepOneBy ? ([["First step", `Agreed by ${c.stepOneBy}`, ""]] as PanelFact[]) : []),
    ],
    fields: [choice("Decision", ["Approve the correction", "Decline the correction"], { value: "Approve the correction" }), area("Note", { span: 2, optional: true, hint: "Required if you decline — the person who asked is told why." })],
    commitLabel: c.reachedParent && step === 1 ? "Record the first step" : "Record the decision", commitDone: "Decision recorded", commitDoneBody: c.reachedParent && step === 1 ? "It now waits for the second step." : "The sheet, the average and the position have moved with it.",
    submit: { endpoint: `${SR}/corrections/${c.id}/decide`, method: "POST", map: { Decision: "decision", Note: "note" } },
  };
}

export function viewCorrectionDrawer(c: Correction): DrawerSpec {
  return {
    mode: "view", kicker: `Score correction · ${c.arm}`, title: `${c.subject} · ${c.student}, ${c.from ?? "blank"} → ${c.to < 0 ? "absent" : c.to}`, sub: `${c.status === "APPROVED" ? "Approved" : "Declined"}${c.decidedBy ? ` by ${c.decidedBy}` : ""}.`, readOnly: true,
    facts: [
      ["Subject", `${c.subject} · ${c.arm}`, c.component], ["Child", c.student, c.adm], ["Change", `${c.from ?? "blank"} → ${c.to < 0 ? "absent" : c.to}`, ""], ["Reason", c.reason, c.evidence ?? ""], ["What happened", c.explanation, ""],
      ["Requested by", c.requestedBy, c.requestedAt], ["Decided by", c.decidedBy ?? "—", c.decidedAt ?? ""], ...(c.note ? ([["Decision note", c.note, ""]] as PanelFact[]) : []),
      ["Effect", c.effect ? `Average ${c.effect.avgBefore ?? "—"} → ${c.effect.avgAfter ?? "—"}` : "—", c.effect ? `Position ${c.effect.posBefore ?? "—"} → ${c.effect.posAfter ?? "—"}` : ""],
      ["Reached a family?", c.reachedParent ? "Yes" : "No", c.revision ? `Revision ${c.revision} issued · the earlier version is kept` : ""], ["State", c.status === "APPROVED" ? "Approved" : "Declined", ""],
    ],
  };
}

export const correctionTone = (status: string) => (status === "APPROVED" ? "positive" : status === "DECLINED" ? "neutral" : status === "IN_REVIEW" ? "progress" : "attention");
export const correctionLabel = (status: string) => (status === "APPROVED" ? "Approved" : status === "DECLINED" ? "Declined" : status === "IN_REVIEW" ? "In review" : "Awaiting");

