import { apiGet } from "@/lib/api/server";
import type { TeacherWorkspaceView } from "@/lib/api/teacher-workspace";
import { area, fixed, select, text } from "@/lib/modules/live/m7-forms";
import type { DrawerSpec, FormField, Panel, PanelFact, PanelRow, PanelTone, StepItem, TabContent, TableCellKind, TableRow } from "@/lib/modules/panels";
import { pill, row, text as cell } from "@/lib/modules/panels";

/**
 * M18 for a teaching person: My Employment — their own leave, what they hold and cover, their appraisal and their payslips. Everything
 * here is about the person reading it and nobody else; a decision about them is made by someone else and shown here as it stands.
 */

const API = "/api/v1/teacher-workspace";
const PLUS = "M12 5.5v13M5.5 12h13";
const PEN = "M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4";
const WARN = "M12 8.2v4.6M12 16h.02M12 3.6 21 19.4H3z";
const EYE = "M2.5 12s3.5-6.5 9.5-6.5S21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12zM12 14.6a2.6 2.6 0 1 0 0-5.2 2.6 2.6 0 0 0 0-5.2";

type Leave = {
  session: string | null; department: string | null; reportsTo: string | null;
  types: Array<{ name: string; entitlement: number | null; unit: string; per: string; used: number; pay: string; evidence: string; notice: string; coverRequired: boolean; halfDays: boolean; carry: string }>;
  rows: Array<{ id: string; type: string; startDate: string; endDate: string; dates: string; days: number; status: string; with: string | null; stage: string | null; cover: string; coverState: string; reason: string; note: string | null; createdAt: string; source: string; position: number; flow: Array<{ name: string; who: string }> }>;
};
type CoverRow = { id: string; what: string; classId: string; arm: string; forWhom: string; cover: string; grants: string; startsOn: string; endsOn: string; endsLabel: string; live: boolean; ended: boolean; daysLeft: number; reason: string | null };
type Assignments = {
  persona: string; department: string | null; term: { name: string; session: string } | null;
  holding: Array<{ what: string; where: string; load: string; kind: "form" | "subject" }>;
  covering: CoverRow[]; coveredFor: CoverRow[];
  absences: Array<{ day: string; label: string; reason: string; covers: Array<{ by: string; what: string; arm: string }> }>;
  absentToday: boolean; registersOnCover: number; today: { label: string; periods: number; registers: string[] };
};
export type Gaps = { day: string; scope: string; gaps: Array<{ userId: string; name: string; reason: string; holds: Array<{ classId: string; subjectId: string | null; what: string; arm: string; covered: boolean }> }>; candidates: Array<{ id: string; name: string }> };
type Appraisal = {
  cycle: string; published: boolean; publishedAt: string | null; publishedBy: string | null; deadline: string | null; set: string; id: string | null; status: string | null; selfSubmittedAt: string | null;
  reviewer: { name: string; title: string | null } | null; shared: boolean; overall: number | null; strengths: string | null; improvements: string | null; reviewerComment: string | null; staffComment: string | null; sharedAt: string | null; acknowledgedAt: string | null;
  previous: { cycle: string; score: number | null } | null;
  kpis: Array<{ name: string; measure: string; source: string; weight: number; target: string; automatic: boolean; auto: number | null; self: number | null; evidence: string | null; reviewer: number | null; comment: string | null }>;
};
type Payslips = {
  school: string; person: { name: string; employeeNo: string; designation: string; email: string }; band: { code: string; name: string; step: number | null } | null;
  record: { started: string; employment: string; reportsTo: { name: string; title: string } | null };
  slips: Array<{ id: string; month: number; year: number; label: string; gross: number; allowances: Array<{ name: string; amount: number }>; allowTotal: number; deductions: Array<{ name: string; amount: number }>; deductTotal: number; net: number; status: string; paidAt: string | null; method: string | null; reference: string | null; band: string | null; step: number | null }>;
  documents: Array<{ id: string; title: string; type: string; issuedBy: string | null; expiresOn: string | null; expiresLabel: string | null; days: number | null; expiry: string; verification: string; hasFile: boolean; note: string | null }>;
  docTypes: string[];
};

const ngn = (value: number) => `₦${value.toLocaleString("en-NG", { maximumFractionDigits: 2, minimumFractionDigits: 0 })}`;
const long = (iso: string | null) => (iso ? new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "Africa/Lagos" }).format(new Date(iso)) : "—");
const short = (iso: string | null) => (iso ? new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "Africa/Lagos" }).format(new Date(iso)) : "—");
const leaveTone = (status: string): PanelTone => (status === "Approved" || status === "Taken" ? "positive" : status === "Declined" ? "negative" : "submitted");

export async function teacherEmploymentTab(tabSlug: string, me: TeacherWorkspaceView, permissions: string[]): Promise<TabContent | null | undefined> {
  if (tabSlug === "leave") return leaveTab(await apiGet<Leave>(`${API}/employment/leave`));
  if (tabSlug === "my-assignments") {
    const mayAssign = me.persona === "head-of-department";
    const [assignments, gaps] = await Promise.all([apiGet<Assignments>(`${API}/employment/assignments`), mayAssign ? apiGet<Gaps>(`${API}/cover/gaps`).catch(() => null) : Promise.resolve(null)]);
    return assignmentsTab(assignments, gaps);
  }
  if (tabSlug === "appraisal") return appraisalTab(await apiGet<Appraisal>(`${API}/employment/appraisal`));
  if (tabSlug === "payslips") return payslipsTab(await apiGet<Payslips>(`${API}/employment/payslips`));
  void permissions;
  return undefined;
}

/* ───────────────────────── Leave ───────────────────────── */

function leaveTab(v: Leave): TabContent {
  const waiting = v.rows.filter((entry) => entry.status === "Waiting");
  const annual = v.types.find((type) => /annual/i.test(type.name));
  const sick = v.types.find((type) => /sick/i.test(type.name));
  const left = (type?: Leave["types"][number]) => (type && type.entitlement !== null ? Math.max(0, type.entitlement - type.used) : null);
  const typeNames = v.types.map((type) => type.name);
  const request: DrawerSpec = {
    mode: "form", kicker: "Leave", title: "Request leave", sub: "It goes to the people the school has named to decide it, in the order it names them. A decision reaches you in-app.",
    commitLabel: "Send the request", commitDone: "Request sent", commitDoneBody: "You can follow where it is from this page, and withdraw it until it is decided.",
    reviewNote: "Cover is arranged once leave is approved, never before. A type that needs notice refuses a start date that is too close.",
    fields: [
      select("Kind of leave", typeNames.length ? typeNames : ["Annual leave"], { required: true, span: 2 }),
      text("First day", { type: "date", required: true }),
      text("Last day", { type: "date", required: true }),
      area("Why", { required: true, span: 2, placeholder: "A sentence the person deciding can read." }),
      text("Who could cover your classes", { span: 2, optional: true, placeholder: "A colleague you have asked, if you have" }),
      fixed("The rules", v.types.map((type) => `${type.name}: ${type.entitlement === null ? "no ceiling" : `${type.entitlement} ${type.unit.toLowerCase()}${type.per ? ` ${type.per}` : ""}`}, notice ${type.notice.toLowerCase()}`).join(" · "), { span: 2, hint: "Set by the school, not by this screen." }),
    ] as FormField[],
    submit: { endpoint: `${API}/employment/leave`, method: "POST", map: { "Kind of leave": "type", "First day": "from", "Last day": "to", Why: "reason", "Who could cover your classes": "cover" } },
  };
  const withdraw = (entry: Leave["rows"][number]): DrawerSpec => ({
    mode: "commit", kicker: "Leave", title: "Withdraw this request", sub: "It leaves the queue of whoever has it. You can ask again.", facts: [["Leave", entry.type, `${entry.dates} · ${entry.days} day${entry.days === 1 ? "" : "s"}`], ["With", entry.with ?? "—", ""]],
    commitLabel: "Withdraw it", commitDone: "Request withdrawn", commitDoneBody: "Nobody is waiting on it any more.", submit: { endpoint: `${API}/employment/leave/${entry.id}/withdraw`, method: "POST" },
  });
  const rows: TableRow[] = v.rows.map((entry) => ({
    keywords: `${entry.type} ${entry.status}`,
    cells: [
      cell(entry.type, { strong: true }), cell(entry.dates), cell(String(entry.days), { mono: true }), cell(entry.with ? entry.with.replace(/^The /, "the ") : "—"),
      pill(entry.status, leaveTone(entry.status)), cell(entry.cover === "Not needed" ? "No cover needed" : entry.cover),
      entry.status === "Waiting"
        ? { kind: "action", label: "Withdraw", drawer: withdraw(entry) }
        : { kind: "action", label: "Open", drawer: { mode: "view", readOnly: true, kicker: "Leave", title: `${entry.type} · ${entry.dates}`, facts: [["State", entry.status, entry.note ?? ""], ["Days", String(entry.days), "Working days"], ["Cover", entry.cover, entry.coverState], ["Why", entry.reason, ""], ["Recorded", entry.source === "RECORDED" ? "After the fact, by the office" : "Asked for by you", short(entry.createdAt)]] as PanelFact[] } as DrawerSpec },
    ] as TableCellKind[],
  }));
  const latest = waiting[0];
  const steps: StepItem[] | null = latest
    ? [
        { label: `Asked · ${short(latest.createdAt)}`, state: "done" },
        ...latest.flow.map((stage, index): StepItem => ({ label: stage.name, sub: stage.who, state: index < latest.position ? "done" : index === latest.position ? "current" : "todo" })),
      ]
    : null;
  return {
    title: "Leave", desc: `${v.session ?? "This session"}. Your balance, your requests, and where each one is.`,
    primary: { label: "Request leave", icon: PLUS, drawer: request },
    // The mockup sends a person to My assignments to report it: that is where who holds their classes is shown.
    launchers: [{ label: "Report an absence today", href: "/my-employment/my-assignments" }],
    rows: ([
      row("1fr", [{
        type: "kpi", sub: `${v.session ?? ""} · entitlements are set by the school${v.reportsTo ? `, and ${v.reportsTo} is who you report to` : ""}.`, per: 4,
        cards: [
          { label: annual ? `${annual.name} left` : "Annual leave", value: left(annual) === null ? "—" : String(left(annual)), unit: annual && annual.entitlement !== null ? `of ${annual.entitlement} days` : undefined, sub: annual ? `${annual.used} taken this session` : "Not offered here", tone: "positive" },
          { label: sick ? `${sick.name}` : "Sick leave", value: left(sick) === null ? "—" : String(left(sick)), unit: sick && sick.entitlement !== null ? `of ${sick.entitlement} days` : undefined, sub: sick ? `${sick.used} taken` : "Not offered here" },
          { label: "Waiting on a decision", value: String(waiting.length), sub: latest ? `With ${(latest.with ?? "").replace(/^The /, "the ")}` : "Nothing is waiting", tone: waiting.length ? "progress" : "neutral" },
          { label: "Carried over", value: annual?.carry && !/^none$/i.test(annual.carry) ? "Allowed" : "None", sub: annual?.carry ?? "This school does not carry leave over" },
        ],
      }]),
      row("1fr", [{
        type: "table", title: "Your requests", sub: "Every request, and where it is now.", meta: `${v.rows.length} this session`, noun: "request", nounPlural: "requests", search: "Find a request",
        // Narrowed by the two things a person actually looks for: what kind of leave it
        // was, and whether it has been decided. Both are built from the requests on
        // record rather than a fixed list, so neither offers a filter that finds nothing.
        filters: v.rows.length > 1
          ? [
              { label: "Type", value: "All", options: ["All", ...new Set(v.rows.map((entry) => entry.type))] },
              { label: "State", value: "All", options: ["All", ...new Set(v.rows.map((entry) => entry.status))] },
            ]
          : undefined,
        head: ["Type", "Dates", "Days", "With", "State", "Cover", ""], rows, per: 10, noRowOpen: true, empty: "You have not asked for leave this session.", foot: "A decision reaches you in-app, whatever the outcome.",
      }]),
      steps ? row("1fr", [{ type: "steps", title: `Where your ${latest!.type.toLowerCase()} request is`, steps }]) : null,
    ].filter(Boolean) as PanelRow[]),
  };
}

/* ───────────────────────── My assignments ───────────────────────── */

function assignmentsTab(v: Assignments, gaps: Gaps | null): TabContent {
  const live = v.covering.filter((entry) => entry.live);
  const absence: DrawerSpec = {
    mode: "commit", kicker: "Cover", title: "Report that you are absent today", sub: "The head of department and the academic lead are told at once, and what you hold is listed for cover until someone is named.",
    facts: [["Today", v.today.label, ""], ["Periods affected", String(v.today.periods), "On today’s published timetable"], ["Registers now unowned", String(v.today.registers.length), v.today.registers.join(" · ") || "None"], ["Your access", "Unchanged", "Cover gives access to someone else; it does not remove yours"]],
    commitLabel: "Report the absence", commitDone: "Absence reported", commitDoneBody: "What you hold today is listed for cover.",
    submit: { endpoint: `${API}/employment/absence`, method: "POST", reasonKey: "reason", reasonLabel: "Reason — the office needs one line", reasonRequired: true },
  };
  const coverRows: TableRow[] = v.covering.map((entry) => ({
    keywords: `${entry.what} ${entry.arm} ${entry.forWhom}`,
    cells: [
      cell(entry.what, { strong: true }), cell(entry.arm), { kind: "name", name: entry.forWhom, sub: "Covered colleague", avatar: false },
      pill(entry.grants, entry.live ? "attention" : "neutral"), cell(entry.ended ? `Ended ${entry.endsLabel}` : entry.endsLabel, { tone: entry.live ? "negative" : undefined, strong: entry.live }),
      cell(entry.live ? "Marks are attributed to you, with the owner named alongside" : "—"),
      entry.live ? { kind: "action", label: "Open the register", href: `/attendance/mark/${entry.classId}` } : cell(""),
    ] as TableCellKind[],
  }));
  const coveredForRows: TableRow[] = v.absences.map((entry) => ({
    keywords: entry.label,
    cells: [cell(entry.label, { strong: true }), cell(entry.reason), cell(entry.covers.length ? entry.covers.map((cover) => cover.by).filter((name, index, all) => all.indexOf(name) === index).join(", ") : "Nobody was named"), cell(entry.covers.length ? entry.covers.map((cover) => `${cover.what} · ${cover.arm}`).join("; ") : "—")] as TableCellKind[],
  }));
  const holdRows: TableRow[] = v.holding.map((entry) => ({ keywords: `${entry.what} ${entry.where}`, cells: [cell(entry.what, { strong: true }), cell(entry.where), cell(entry.load), pill(entry.kind === "form" ? "Form class" : entry.load === "Second teacher" ? "Second teacher" : "Subject", "neutral")] as TableCellKind[] }));

  const gapRows: TableRow[] = (gaps?.gaps ?? []).flatMap((gap) =>
    gap.holds.map((hold) => ({
      keywords: `${gap.name} ${hold.what} ${hold.arm}`,
      cells: [
        { kind: "name", name: gap.name, sub: gap.reason, avatar: false }, cell(hold.what, { strong: true }), cell(hold.arm), pill(hold.covered ? "Covered" : "Nobody yet", hold.covered ? "positive" : "negative"),
        hold.covered ? cell("") : { kind: "action", label: "Assign cover", drawer: coverDrawer(gap, hold, gaps!) },
      ] as TableCellKind[],
    })),
  );
  return {
    title: "My assignments", desc: "What you hold, the cover you hold for others, and who has covered for you.",
    primary: { label: v.absentToday ? "Absence already reported today" : "Report an absence today", icon: WARN, ...(v.absentToday ? { href: "/my-employment/my-assignments" } : { drawer: absence }) },
    rows: ([
      row("1fr", [{
        type: "kpi", sub: "Cover is time-boxed by rule — an end date is mandatory, always.", per: 3,
        cards: [
          { label: "You are covering", value: String(live.length), unit: live.length === 1 ? "assignment" : "assignments", sub: live.map((entry) => `${entry.arm} · until ${entry.endsLabel}`).join(" · ") || "Nobody at the moment", tone: live.length ? "attention" : "neutral" },
          { label: "Covered for you", value: String(v.absences.length), unit: v.absences.length === 1 ? "day" : "days", sub: "This term" },
          { label: "Registers marked on cover", value: String(v.registersOnCover), unit: v.registersOnCover === 1 ? "register" : "registers", sub: "Attributed to you, with the owner named alongside" },
        ],
      }]),
      row("1fr", [{ type: "table", title: "What you hold", sub: "Your classes and subjects, from the school’s class structure.", meta: `${v.holding.length}`, noun: "assignment", nounPlural: "assignments", head: ["What", "Where", "Load", "Kind"], rows: holdRows, per: 12, noRowOpen: true, empty: "You are not named on a class or subject yet." }]),
      // Shown whether or not there is cover to show. "You are not covering for anyone"
      // is an answer; an absent panel is a question about whether the page is finished.
      row("1fr", [{ type: "table", title: "Your cover assignments", sub: "What each one grants, and when it ends.", meta: `${v.covering.length} this term`, noun: "assignment", nounPlural: "assignments", head: ["What", "Arm", "For whom", "Grants", "Ends", "Attribution", ""], rows: coverRows, per: 10, noRowOpen: true, empty: "You are not covering for anyone. Cover is arranged by a head of department or a school leader, and always carries an end date.", foot: "A cover teacher never inherits the owner’s remarks, family conversations or historic reach." }]),
      live.length ? row("1fr", [{ type: "note", tone: "attention", icon: WARN, title: `Your access to ${live[0]!.arm} ends on ${live[0]!.endsLabel}, without anyone remembering`, body: "The register returns to its owner. Nothing you did on cover is lost: every mark stays on the record under your name." }]) : null,
      row("1fr", [{ type: "table", title: "Covered for you", sub: "Days you were away, and who held your work.", meta: `${v.absences.length} this term`, noun: "day", nounPlural: "days", head: ["Date", "Reason", "Covered by", "What they held"], rows: coveredForRows, per: 10, noRowOpen: true, empty: "Nobody has covered for you this term.", foot: "Their marks are on your registers under their name, with yours alongside." }]),
      gaps ? row("1fr", [{ type: "table", title: "Gaps to fill today", sub: `Staff in ${gaps.scope === "department" ? "your department" : "the school"} who have said they are away, and what nobody holds yet.`, meta: `${gaps.gaps.length} away`, noun: "gap", nounPlural: "gaps", head: ["Who is away", "What", "Arm", "Cover", ""], rows: gapRows, per: 12, noRowOpen: true, empty: "Nobody in your department has reported an absence today.", foot: "Cover you assign always has an end date, and stops by itself on it." }]) : null,
    ].filter(Boolean) as PanelRow[]),
  };
}

export function coverDrawer(gap: Gaps["gaps"][number], hold: Gaps["gaps"][number]["holds"][number], gaps: Gaps): DrawerSpec {
  const options = gaps.candidates.map((person) => ({ value: person.id, label: person.name }));
  return {
    mode: "form", kicker: "Cover", title: `Cover ${hold.what} · ${hold.arm}`, sub: `For ${gap.name}, who is away today. The person you name holds it until the end date, and not a day after.`,
    commitLabel: "Assign cover", commitDone: "Cover assigned", commitDoneBody: "They are told, and it appears in their rail as cover with its end date.",
    fields: [
      select("Who covers", options.map((option) => option.label), { required: true, span: 2 }),
      select("It grants", hold.subjectId ? ["Register and scores", "Register only"] : ["Register only"], { span: 2 }),
      text("From", { type: "date", required: true }),
      text("Until", { type: "date", required: true, hint: "An end date is mandatory." }),
      area("Note", { span: 2, optional: true }),
    ] as FormField[],
    submit: {
      endpoint: `${API}/cover`, method: "POST", body: { classId: hold.classId, subjectId: hold.subjectId, ownerUserId: gap.userId },
      map: { "Who covers": "coverUserId", "It grants": "scope", From: "startsOn", Until: "endsOn", Note: "reason" },
      encode: { "Who covers": Object.fromEntries(options.map((option) => [option.label, option.value])), "It grants": { "Register and scores": "REGISTER_AND_SCORES", "Register only": "REGISTER" } },
    },
  };
}

/* ───────────────────────── Appraisal ───────────────────────── */

function appraisalTab(v: Appraisal): TabContent {
  // How the process works does not depend on a cycle being open, and it is most worth
  // reading before one is — so the same panel serves both states rather than appearing
  // only once the cycle it explains has already started.
  const howItWorks: Panel = {
    type: "facts", title: "How this cycle works", per: 1,
    facts: [
      ["Self-assessment", "Yours alone until you submit", "Your reviewer cannot see a draft"],
      ["Manager review", v.reviewer?.name ?? "Your reviewer", v.reviewer?.title ?? ""],
      ["Moderation", "A panel, once every review is in", "It can change a score, and it records why"],
      ["Shared with you", "Before it is final", "You may add a written response"],
      ["Effect on pay or access", "Not decided", "The school has not settled this — an open question, not a hidden one"],
    ] as PanelFact[],
  };
  const stageLabels = ["KPIs published", "Self-assessment", "Manager review", "Moderation", "Shared with you"];

  if (!v.published) {
    return {
      title: "Appraisal", desc: "This cycle, and what it is measured on.",
      rows: [
        // The stages are shown before the cycle opens too, all still to come: what is
        // ahead of you is part of knowing where you stand.
        row("1fr", [{ type: "steps", title: `${v.cycle} · not opened yet`, steps: stageLabels.map((label): StepItem => ({ label, state: "todo" })) }]),
        row("1fr", [{ type: "note", tone: "neutral", icon: EYE, title: `No appraisal has been published to you for ${v.cycle}`, body: "When the school publishes the cycle, your self-assessment opens here with the deadline. Until then this is what a teacher at this school is measured on." }]),
        row("1.25fr 1fr", [kpiTable(v), howItWorks]),
      ],
    };
  }
  const submitted = Boolean(v.selfSubmittedAt);
  const stage = v.shared ? 4 : submitted ? 2 : 1;
  const steps: StepItem[] = stageLabels.map((label, index): StepItem => ({ label, state: index < stage ? "done" : index === stage ? "current" : "todo" }));
  const selfDrawer = (submit: boolean): DrawerSpec => {
    const fields: FormField[] = [];
    const scores: Record<string, [string, string]> = {};
    const evidence: Record<string, [string, string]> = {};
    for (const kpi of v.kpis) {
      if (kpi.auto !== null) continue;
      fields.push(select(`${kpi.name} — your rating`, ["1", "2", "3", "4", "5"], { value: kpi.self ? String(kpi.self) : "3", span: 1, hint: `${kpi.measure}. Target: ${kpi.target}.` }));
      fields.push(area(`${kpi.name} — your evidence`, { value: kpi.evidence ?? "", span: 1, optional: true, placeholder: "What happened that shows it." }));
      scores[`${kpi.name} — your rating`] = ["scores", kpi.name];
      evidence[`${kpi.name} — your evidence`] = ["evidence", kpi.name];
    }
    return {
      mode: "form", kicker: v.cycle, title: submit ? "Submit your self-assessment" : "Your self-assessment", sub: "Yours alone until you submit it. Your reviewer cannot read a draft. Figures the product already holds are not asked of you.",
      commitLabel: submit ? "Submit it" : "Save the draft", commitDone: submit ? "Self-assessment submitted" : "Draft saved", commitDoneBody: submit ? `${v.reviewer?.name ?? "Your reviewer"} has it now and cannot be shown it twice.` : "Come back and finish it before the deadline.",
      fields, submit: { endpoint: `${API}/employment/appraisal/self`, method: "POST", body: { submit }, nest: { ...scores, ...evidence } },
    };
  };
  const respond: DrawerSpec = {
    mode: "form", kicker: v.cycle, title: "Add your response", sub: "Your reviewer’s comments are on this page. Your written response is kept with the appraisal.",
    commitLabel: "Send my response", commitDone: "Response recorded", commitDoneBody: "The appraisal is acknowledged.",
    fields: [area("Your response", { required: true, span: 2, value: v.staffComment ?? "" })], submit: { endpoint: `${API}/employment/appraisal/respond`, method: "POST", map: { "Your response": "comment" } },
  };
  const manual = v.kpis.filter((kpi) => kpi.auto === null);
  const writtenSelf = manual.filter((kpi) => kpi.self).length;
  return {
    title: "Appraisal", desc: `${v.cycle}. What you are measured on, and where it stands.`,
    primary: v.shared ? { label: v.acknowledgedAt ? "Edit your response" : "Add your response", icon: PEN, drawer: respond } : submitted ? undefined : { label: writtenSelf ? "Continue your self-assessment" : "Start your self-assessment", icon: PEN, drawer: selfDrawer(false) },
    launchers: !v.shared && !submitted && writtenSelf ? [{ label: "Submit it", drawer: selfDrawer(true) }] : [],
    rows: [
      row("1fr", [{ type: "steps", title: `${v.cycle} cycle`, steps }]),
      row("1fr", [{
        type: "kpi", sub: `${v.publishedBy ? `Published by ${v.publishedBy}. ` : ""}${v.kpis.length} KPIs, weighted to 100.`, per: 4,
        cards: [
          v.shared ? { label: "Stage", value: "Shared with you", sub: v.acknowledgedAt ? "You have responded" : "You may add a response", tone: "positive" } : submitted ? { label: "Stage", value: "Manager review", sub: `With ${v.reviewer?.name ?? "your reviewer"}`, tone: "submitted" } : { label: "Stage", value: "Self-assessment", sub: `${v.deadline ? `Due ${long(v.deadline)} · ` : ""}${writtenSelf ? "draft saved" : "not started"}`, tone: "progress" },
          { label: "From your own record", value: String(v.kpis.filter((kpi) => kpi.auto !== null).length), unit: `of ${v.kpis.length}`, sub: "Computed, not typed" },
          { label: "Your reviewer", value: v.reviewer?.name ?? "—", sub: v.reviewer?.title ?? "" },
          { label: v.previous ? "Last cycle" : "Overall", value: v.shared && v.overall !== null ? v.overall.toFixed(1) : v.previous?.score != null ? v.previous.score.toFixed(1) : "—", unit: "of 5", sub: v.shared ? "This cycle" : v.previous ? v.previous.cycle : "No earlier cycle on record", tone: "positive" },
        ],
      }]),
      row("1.25fr 1fr", [
        kpiTable(v),
        howItWorks,
      ]),
      ...(v.shared ? [row("1fr", [{ type: "quotes", title: "What your reviewer wrote", sub: v.sharedAt ? `Shared ${long(v.sharedAt)}` : "", quotes: [{ label: "Review", text: v.reviewerComment ?? "", by: v.reviewer?.name ?? "Your reviewer", emptyText: "No comment was left." }, ...(v.strengths ? [{ label: "Strengths", text: v.strengths, by: v.reviewer?.name ?? "" }] : []), ...(v.improvements ? [{ label: "To improve", text: v.improvements, by: v.reviewer?.name ?? "" }] : [])] }])] : []),
      ...(v.staffComment ? [row("1fr", [{ type: "quotes", title: "Your response", quotes: [{ label: "You wrote", text: v.staffComment, by: "You" }] }])] : []),
    ] as PanelRow[],
  };
}

function kpiTable(v: Appraisal): PanelRow["panels"][number] {
  const rows: TableRow[] = v.kpis.map((kpi) => ({
    keywords: kpi.name,
    cells: [
      cell(kpi.name, { strong: true }), cell(kpi.measure), cell(`${kpi.weight}%`, { mono: true }), cell(kpi.target),
      cell(kpi.auto !== null ? `${kpi.auto.toFixed(1)} of 5` : kpi.automatic ? "No figure yet" : kpi.self ? `You: ${kpi.self} of 5` : "Rated by a person", { mono: true }),
      pill(kpi.reviewer !== null ? `${kpi.reviewer} of 5` : kpi.automatic ? "Computed" : "Manager rating", kpi.reviewer !== null ? "positive" : "neutral"),
    ] as TableCellKind[],
  }));
  // Dense: it sits in the narrower half of a two-up, and the measured-by column needs
  // the room that padding would otherwise take.
  return { type: "table", dense: true, title: "What you are measured on", sub: "Where each figure comes from, and what it is worth.", meta: `${v.kpis.length} KPIs`, noun: "KPI", nounPlural: "KPIs", head: ["KPI", "Measured by", "Weight", "Target", "Your figure", "Reviewer"], rows, per: 12, noRowOpen: true, foot: "You are appraised against what happened, not against recollection." };
}

/* ───────────────────────── Payslips ───────────────────────── */

function payslipsTab(v: Payslips): TabContent {
  const latest = v.slips[0];
  const slipDrawer = (slip: Payslips["slips"][number]): DrawerSpec => ({
    mode: "view", readOnly: true, kicker: `Payslip · ${slip.label}`, title: slip.label, sub: `${v.school} · ${v.person.name} · ${v.person.employeeNo}`,
    facts: [
      ["Gross", ngn(slip.gross), slip.band ? `Band ${slip.band}${slip.step ? ` · step ${slip.step}` : ""}` : ""],
      ...slip.allowances.map((line): PanelFact => [line.name, ngn(line.amount), "Allowance"]),
      ...slip.deductions.map((line): PanelFact => [line.name, `−${ngn(line.amount)}`, "Deduction"]),
      ["Net pay", ngn(slip.net), slip.status === "PAID" ? `Paid${slip.paidAt ? ` ${long(slip.paidAt)}` : ""}${slip.method ? ` · ${slip.method}` : ""}` : "Approved, not yet paid"],
      ...(slip.reference ? [["Bank reference", slip.reference, ""] as PanelFact] : []),
    ],
  });
  const emailThem: DrawerSpec = {
    mode: "commit", kicker: "Payslips", title: "Email the chosen payslips to yourself", sub: "A payslip goes only to the address on your own staff record — it is never sent anywhere else.",
    facts: [["It goes to", v.person.email, "The address on your staff record"], ["What it contains", "The lines of the payslip", "Gross, each allowance and deduction, and net pay — as an email, not a PDF"], ["Who else sees it", "Nobody", "It is not copied to the office"]],
    commitLabel: "Email them", commitDone: "Payslips on their way", commitDoneBody: `They are queued for ${v.person.email}.`,
    submit: { endpoint: `${API}/employment/payslips/email`, method: "POST" },
  };
  const rows: TableRow[] = v.slips.map((slip) => ({
    id: slip.id, keywords: slip.label, drawer: slipDrawer(slip),
    cells: [cell(slip.label, { strong: true }), cell(ngn(slip.gross), { mono: true }), cell(ngn(slip.allowTotal), { mono: true }), cell(ngn(slip.deductTotal), { mono: true }), cell(ngn(slip.net), { mono: true, strong: true }), pill(slip.status === "PAID" ? "Paid" : "Approved", slip.status === "PAID" ? "positive" : "progress"), { kind: "action", label: "View", drawer: slipDrawer(slip) }] as TableCellKind[],
  }));
  const upload: DrawerSpec = {
    mode: "form", kicker: "My Employment", title: "File a document", sub: "A qualification or credential on your record. The school office verifies it before it counts.",
    commitLabel: "Send for verification", commitDone: "Document filed", commitDoneBody: "It shows here as waiting for the office until it has been checked.",
    fields: [
      text("Title", { required: true, span: 2, placeholder: "e.g. TRCN practising licence" }),
      select("Type", v.docTypes, { span: 2 }),
      text("Issued by", { optional: true, placeholder: "The awarding body" }),
      text("Expires on", { type: "date", optional: true, hint: "Leave blank if it does not expire." }),
      { label: "Photo of it", kind: "asset", options: ["No photo", "Attach a photo", "Remove it"], span: 2 } as FormField,
      area("Note for the office", { span: 2, optional: true }),
    ],
    submit: { endpoint: `${API}/employment/documents`, method: "POST", map: { Title: "title", Type: "type", "Issued by": "issuedBy", "Expires on": "expiresOn", "Photo of it": "file", "Note for the office": "notes" } },
  };
  const attention = v.documents.find((document) => document.expiry === "Expired" || document.expiry === "Expiring");
  const docRows: PanelFact[] = v.documents.map((document): PanelFact => [document.title, `${document.expiresLabel ? `${document.expiry === "Expired" ? "Expired" : "Expires"} ${document.expiresLabel}` : "No expiry"}`, document.verification]);

  /**
   * The three credentials a teaching post is conditional on, each stated whether or not
   * it is there.
   *
   * Listing only the documents that happen to be filed makes a missing one invisible —
   * and a teaching certificate nobody has filed is precisely the thing this panel exists
   * to surface. Each row is matched from the record by type or title; where nothing
   * matches it says so rather than going quiet.
   */
  const credential = (label: string, match: RegExp): PanelFact => {
    const found = v.documents.find((document) => match.test(document.type ?? "") || match.test(document.title));
    if (!found) return [label, "Not on file", "The office has nothing recorded"];
    const when = found.expiresLabel
      ? found.expiry === "Expired" ? `Expired ${found.expiresLabel}` : `Expires ${found.expiresLabel}`
      : "No expiry date on file";
    return [label, when, found.verification];
  };
  const credentialRows: PanelFact[] = [
    credential("Teaching certificate", /trcn|teach(ing)?[ _-]?cert/i),
    credential("Safeguarding clearance", /safeguard|police|dbs|clearance/i),
    credential("Right to work", /right[ _-]?to[ _-]?work|work[ _-]?permit|visa/i),
  ];
  return {
    title: "Payslips", desc: "What you were paid, what it was made of, and the documents on your record.",
    primary: latest ? { label: `View ${latest.label}`, icon: EYE, drawer: slipDrawer(latest) } : undefined,
    launchers: [{ label: "File a document", drawer: upload }],
    rows: ([
      attention ? row("1fr", [{ type: "note", tone: "attention", icon: WARN, title: `${attention.title} ${attention.expiry === "Expired" ? "has expired" : `expires ${attention.expiresLabel}`}`, body: "Upload the renewal before it lapses; the school office verifies it and it replaces this one on your record.", acts: [{ label: "Upload the renewal", drawer: upload }] }]) : null,
      row("1fr", [{
        type: "kpi", sub: "Record-keeping only. The school pays you through its own bank.", per: 4,
        cards: [
          { label: "Latest payslip", value: latest ? latest.label : "None yet", sub: latest ? (latest.paidAt ? `Paid ${long(latest.paidAt)}` : "Approved, not yet paid") : "A payslip appears once the school approves a payroll run" },
          { label: "Band", value: v.band ? v.band.code : "—", sub: v.band ? `${v.band.name}${v.band.step ? ` · step ${v.band.step}` : ""}` : "You have not been placed on a pay band" },
          { label: "Gross this month", value: latest ? ngn(latest.gross) : "—", sub: latest && latest.allowTotal ? `Plus ${ngn(latest.allowTotal)} in allowances` : "" },
          { label: "Net this month", value: latest ? ngn(latest.net) : "—", sub: latest ? `${ngn(latest.deductTotal)} deducted` : "", tone: "positive" },
        ],
      }]),
      row("1.1fr 1fr", [
        { type: "table", title: "Your payslips", sub: "Open one for the breakdown.", meta: `${v.slips.length} most recent`, noun: "payslip", nounPlural: "payslips", head: ["Month", "Gross", "Allowances", "Deductions", "Net", "State", ""], rows, per: 12, noRowOpen: false, selectable: true, bulkActs: [{ label: "Email them to me", drawer: emailThem, selection: { key: "ids", noun: "payslip" } }, { label: "Download selected", primary: true, export: true }], empty: "No payslip yet.", foot: "A payslip appears when the school approves the month’s run." },
        {
          type: "facts", title: "Your employment record", per: 1,
          facts: [["Started", long(v.record.started), ""], ["Employment", v.record.employment, ""], ["Reports to", v.record.reportsTo ? v.record.reportsTo.name : "—", v.record.reportsTo?.title ?? ""], ...credentialRows, ...docRows.filter((fact) => !credentialRows.some((row) => row[0] === fact[0]))] as PanelFact[],
          acts: [{ label: "File a document", drawer: upload }],
        },
      ]),
    ].filter(Boolean) as PanelRow[]),
  };
}

/** The gaps panel, for whoever assigns cover — a head of department on their own page, or the school's leadership in Staff & Access. */
export function gapsPanel(gaps: Gaps): PanelRow {
  const rows: TableRow[] = gaps.gaps.flatMap((gap) =>
    gap.holds.map((hold) => ({
      keywords: `${gap.name} ${hold.what} ${hold.arm}`,
      cells: [
        { kind: "name", name: gap.name, sub: gap.reason, avatar: false }, cell(hold.what, { strong: true }), cell(hold.arm), pill(hold.covered ? "Covered" : "Nobody yet", hold.covered ? "positive" : "negative"),
        hold.covered ? cell("") : { kind: "action", label: "Assign cover", drawer: coverDrawer(gap, hold, gaps) },
      ] as TableCellKind[],
    })),
  );
  return row("1fr", [{ type: "table", title: "Away today — and who holds their classes", sub: "Staff who have said they are not in, and what nobody holds yet. Cover you assign always has an end date.", meta: `${gaps.gaps.length} away`, noun: "gap", nounPlural: "gaps", head: ["Who is away", "What", "Arm", "Cover", ""], rows, per: 12, noRowOpen: true, empty: "Nobody has reported an absence today.", foot: "Cover stops by itself on its end date — nothing needs remembering." }]);
}
