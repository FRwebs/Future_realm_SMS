import { apiGet, observe } from "@/lib/api/server";
import { localContracts } from "@/lib/api/local-contracts.zod";
import { PG } from "@/lib/modules/live/m9-forms";
import { area, checks, choice, select, text } from "@/lib/modules/live/m7-forms";
import { name as nameCell, pill, type DrawerSpec, type KpiCard, type PanelFact, type TabContent, type TableRow } from "@/lib/modules/panels";

/**
 * Forms the school sends its families to answer — a trip, a leave, an agreement — and who has answered each. A family answers once for all
 * its children; the answer is theirs to change until the school closes the form.
 */

type FormRow = {
  id: string; title: string; kind: string; audience: string; due: string | null; status: "OPEN" | "CLOSED";
  facts: Array<[string, string, string?]>; ask: string | null; yes: string; no: string; createdAt: string; createdBy: string;
  families: number; yesCount: number; noCount: number;
  answers: Array<{ family: string; children: string[]; decision: "YES" | "NO" | null; text: string; at: string | null }>;
};
type FormsOverview = { forms: FormRow[]; classes: Array<{ id: string; name: string }>; kinds: string[] };

export const loadForms = () => apiGet(`${PG}/forms`, observe<FormsOverview>(localContracts["src/lib/modules/live/m9-family-forms.ts#7c1d52a9"]));

const day = (iso: string) => new Date(`${iso.slice(0, 10)}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

function sendDrawer(data: FormsOverview): DrawerSpec {
  return {
    mode: "form", kicker: "Parents & Guardians · forms", title: "Send a form to families",
    sub: "Each family answers once for all its children, and is told in the portal the moment you send it.",
    fields: [
      text("Title", { span: 2, required: true, placeholder: "For example: Primary 4 excursion to Zuma Rock" }),
      select("Kind", data.kinds, { value: data.kinds[0] }),
      text("Reply by", { type: "date", hint: "Families who have not answered by then are shown as past their date." }),
      choice("Who it goes to", ["Every family", "Chosen classes"], { span: 2, value: "Every family" }),
      { ...checks("Which classes", data.classes.map((room) => room.name), [], { span: 2 }), when: { field: "Who it goes to", equals: "Chosen classes" } },
      area("What the form says", { span: 2, required: true, value: "", placeholder: "Date: Friday 6 November\nWhere: Zuma Rock visitor centre\nCost: ₦8,500, added to the invoice only if you agree", hint: "One “Label: value” to a line reads as a list to families; plain sentences read as a paragraph." }),
      text("A question for them to answer in words", { span: 2, optional: true, placeholder: "For example: Who will be collecting your child?", hint: "Leave it empty if yes or no is enough." }),
      text("The yes button", { value: "I agree" }),
      text("The no button", { value: "I do not agree" }),
    ],
    commitLabel: "Send to families", commitDone: "Form sent", commitDoneBody: "Families have been told in their portal. Answers appear here as they arrive.",
    submit: {
      endpoint: `${PG}/forms`, method: "POST",
      map: { Title: "title", Kind: "kind", "Reply by": "due", "Who it goes to": "who", "Which classes": "classes", "What the form says": "details", "A question for them to answer in words": "ask", "The yes button": "yes", "The no button": "no" },
    },
  };
}

function detail(form: FormRow): DrawerSpec {
  const answered = form.answers.filter((answer) => answer.decision);
  const waiting = form.families - answered.length;
  const facts: PanelFact[] = [
    ["Goes to", form.audience, `${form.families} ${form.families === 1 ? "family" : "families"}`],
    ["Reply by", form.due ? day(form.due) : "No date", `Sent ${day(form.createdAt)} by ${form.createdBy}`],
    ["Answers", `${form.yesCount} “${form.yes}” · ${form.noCount} “${form.no}” · ${Math.max(0, waiting)} waiting`, form.status === "CLOSED" ? "Closed — no more answers are taken" : "Open"],
    ...form.facts.map(([label, value, hint]): PanelFact => [label, value, hint ?? ""]),
    ...(form.ask ? [["Question asked", form.ask] as PanelFact] : []),
    ...form.answers.slice(0, 60).map((answer): PanelFact => [
      answer.family,
      answer.decision === "YES" ? form.yes : answer.decision === "NO" ? form.no : "Not answered",
      [answer.children.join(" and "), answer.text, answer.at ? day(answer.at) : ""].filter(Boolean).join(" · "),
      answer.decision === "YES" ? "positive" : answer.decision === "NO" ? "attention" : "",
    ]),
  ];
  return { kicker: `${form.kind} form`, title: form.title, mode: "view", readOnly: true, sub: `${form.audience} · ${form.status === "OPEN" ? "open" : "closed"}`, facts };
}

const closeDrawer = (form: FormRow): DrawerSpec => ({
  mode: "commit", tone: "attention", kicker: "Parents & Guardians · forms", title: `Close “${form.title}”?`,
  sub: "Families can no longer answer it, or change what they answered. What they sent stays on the record.",
  commitLabel: "Close the form", commitDone: "Form closed", commitDoneBody: "It no longer appears to families who did not answer it.",
  submit: { endpoint: `${PG}/forms/${form.id}/close`, method: "POST" },
});

export function familyFormsTab(data: FormsOverview): TabContent {
  const open = data.forms.filter((form) => form.status === "OPEN");
  const waiting = open.reduce((sum, form) => sum + Math.max(0, form.families - form.yesCount - form.noCount), 0);
  const cards: KpiCard[] = [
    { label: "Open forms", value: String(open.length), sub: open.length ? "Families are being asked" : "Nothing is out", tone: open.length ? "progress" : "neutral" },
    { label: "Answers waiting", value: String(waiting), sub: waiting ? "Families who have not replied" : "Everyone has replied", tone: waiting ? "attention" : "positive" },
    { label: "Sent in all", value: String(data.forms.length), sub: `${data.forms.length - open.length} closed`, tone: "neutral" },
  ];
  const rows: TableRow[] = data.forms.map((form) => {
    const answered = form.yesCount + form.noCount;
    return {
      id: form.id, drawer: detail(form), keywords: `${form.title} ${form.kind} ${form.audience}`,
      cells: [
        nameCell(form.title, `${form.kind} · sent ${day(form.createdAt)}`, { avatar: false }),
        { kind: "text", text: form.audience },
        { kind: "text", text: form.due ? day(form.due) : "—" },
        { kind: "text", text: `${answered} of ${form.families}`, mono: true },
        { kind: "text", text: `${form.yesCount} · ${form.noCount}`, mono: true },
        pill(form.status === "OPEN" ? "Open" : "Closed", form.status === "OPEN" ? "progress" : "neutral"),
        form.status === "OPEN" ? { kind: "action", label: "Close", drawer: closeDrawer(form) } : { kind: "text", text: "" },
      ],
    };
  });
  return {
    title: "Forms", desc: "Trips, leave and agreements the school needs families to answer — and who has.",
    primary: { label: "Send a form", icon: "M4 5.5h16v10.5H9l-5 4z", drawer: sendDrawer(data) },
    rows: [
      { cols: "1fr", panels: [{ type: "kpi", title: "Forms out to families", per: 3, cards }] },
      {
        cols: "1fr",
        panels: [{
          type: "table", title: "Every form", sub: "Open one to see each family’s answer.", noun: "form", nounPlural: "forms", per: 10, search: "Find a form",
          head: ["Form", "Goes to", "Reply by", "Answered", "Yes · No", "State", ""], rows,
          empty: "No form has been sent yet. Send one and every family it reaches is told in their portal.",
        }],
      },
    ],
  };
}
