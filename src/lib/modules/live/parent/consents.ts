import { apiGet, observe } from "@/lib/api/server";
import { localContracts } from "@/lib/api/local-contracts.zod";
import { name as nameCell, pill, row, text } from "@/lib/modules/panels";
import type { DrawerSpec, FormField, ListItem, PanelTone, TableCellKind, TableRow } from "@/lib/modules/panels";
import { PW, dLong, dShort, loadMe } from "@/lib/modules/live/parent/shared";
import type { ParentContent, ParentMe } from "@/lib/modules/live/parent/shared";

type Consent = {
  code: string; name: string; covers: string; blocks: string; required: boolean; who: string;
  state: "Given" | "Withdrawn" | "Declined" | "Not recorded"; on: string | null; how: string | null;
};

type SchoolForm = {
  id: string; title: string; kind: string; audience: string; due: string | null; open: boolean;
  facts: Array<[string, string, string?]>; ask: string | null; yes: string; no: string; sentOn: string; by: string;
  children: Array<{ id: string; first: string }>; answer: { decision: "YES" | "NO"; text: string; at: string } | null;
};
type Forms = { today: string; forms: SchoolForm[] };

const TABS = ["Forms to sign", "Consents"];
const TONE: Record<Consent["state"], PanelTone> = { Given: "positive", Withdrawn: "neutral", Declined: "neutral", "Not recorded": "attention" };

/** Giving, declining or withdrawing — each says plainly what the school may do, and is recorded at once. */
function decide(consent: Consent, status: "GIVEN" | "WITHDRAWN" | "NOT_GIVEN", school: string): DrawerSpec {
  const verb = status === "GIVEN" ? "Give" : status === "NOT_GIVEN" ? "Decline" : "Withdraw";
  return {
    mode: "commit", tone: status === "GIVEN" ? "progress" : "attention", kicker: "Forms and consents",
    title: `${verb} consent for ${consent.name.toLowerCase()}?`,
    sub: status === "GIVEN"
      ? `${school} may use this: ${consent.covers.charAt(0).toLowerCase()}${consent.covers.slice(1)}.`
      : `${consent.blocks || "The school will stop"}. You can change your mind at any time.`,
    commitLabel: verb, commitNote: "Recorded at once, with your name and the time.",
    commitDone: status === "GIVEN" ? "Consent given" : status === "NOT_GIVEN" ? "Consent declined" : "Consent withdrawn",
    commitDoneBody: "It is on the school’s consent register now.",
    submit: { endpoint: `${PW}/consents`, method: "POST", body: { code: consent.code, status } },
  };
}

function actions(consent: Consent, school: string): TableCellKind[] {
  if (consent.required && consent.state === "Given") return [{ kind: "text", text: "" }, { kind: "action", label: "Talk to the school", href: "/portals/parent/requests" }];
  if (consent.required) return [{ kind: "action", label: "Talk to the school", href: "/portals/parent/requests" }, { kind: "action", label: "Give", drawer: decide(consent, "GIVEN", school) }];
  if (consent.state === "Given") return [{ kind: "text", text: "" }, { kind: "action", label: "Withdraw", drawer: decide(consent, "WITHDRAWN", school) }];
  if (consent.state === "Not recorded") return [{ kind: "action", label: "Decline", drawer: decide(consent, "NOT_GIVEN", school) }, { kind: "action", label: "Give", drawer: decide(consent, "GIVEN", school) }];
  return [{ kind: "text", text: "" }, { kind: "action", label: "Give", drawer: decide(consent, "GIVEN", school) }];
}

export async function consentsPage(child: string, query: Record<string, string | undefined>): Promise<ParentContent> {
  const [me, data, sent] = await Promise.all([
    loadMe(),
    apiGet(`${PW}/consents`, observe<{ types: Consent[] }>(localContracts["src/lib/modules/live/parent/consents.ts#d42e60d4"])),
    apiGet(`${PW}/forms`, observe<Forms>(localContracts["src/lib/modules/live/parent/consents.ts#f0a4c8e1"])),
  ]);
  const one = child === "all" ? null : me.children.find((entry) => entry.id === child) ?? null;
  const forms = one ? sent.forms.filter((form) => form.children.some((kid) => kid.id === one.id)) : sent.forms;
  const waiting = forms.filter((form) => form.open && !form.answer).length;
  // A parent with a form waiting lands on it; otherwise on the consents.
  const tab = TABS.includes(query.tab ?? "") ? query.tab! : waiting ? TABS[0]! : TABS[1]!;
  return one ? childConsents(one.first, one.arm, data.types, me, tab, forms, sent.today, waiting) : familyConsents(data.types, me, forms, sent.today);
}

/** What a family sees of a form, and the one decision it asks for. The school's own words for yes and no are the buttons. */
function formDrawer(form: SchoolForm, today: string): DrawerSpec {
  const closed = !form.open;
  const fields: FormField[] = [
    ...form.facts.map(([label, value, hint]): FormField => ({ kind: "static", label, value, ...(hint ? { hint } : {}) })),
    { kind: "static", label: "From", value: form.by, hint: `Sent ${dLong(form.sentOn)}${form.due ? ` · reply by ${dLong(form.due)}` : ""}` },
    ...(closed ? [] : [
      { kind: "choice", label: "Your answer", required: true, value: form.answer ? (form.answer.decision === "YES" ? form.yes : form.no) : "", options: [form.yes, form.no] } as FormField,
      ...(form.ask ? [{ kind: "text", label: form.ask, required: true, value: form.answer?.text ?? "", when: { field: "Your answer", equals: form.yes } } as FormField] : []),
    ]),
  ];
  return {
    kicker: `${form.kind} form`, title: form.title, mode: closed ? "view" : "form", readOnly: closed,
    sub: closed ? "The school has closed this form." : form.due && form.due < today ? "The date to reply by has passed, but the school has not closed it." : "Your answer goes to the school at once. You can change it until the school closes the form.",
    fields, confirmTitle: "Send your answer to the school?", commitLabel: form.answer ? "Change my answer" : "Send my answer", commitDone: "Answer sent", commitDoneBody: "The school can see it now.",
    submit: {
      endpoint: `${PW}/forms/${form.id}/answer`, method: "POST",
      map: { "Your answer": "decision", ...(form.ask ? { [form.ask]: "text" } : {}) }, encode: { "Your answer": { [form.yes]: "YES", [form.no]: "NO" } },
    },
  };
}

function formItem(form: SchoolForm, today: string, withChildren: boolean): ListItem {
  const answered = form.answer;
  const late = form.open && !answered && form.due !== null && form.due < today;
  return {
    label: form.title,
    sub: answered
      ? `You answered “${answered.decision === "YES" ? form.yes : form.no}” on ${dLong(answered.at.slice(0, 10))}${answered.text ? ` · ${answered.text}` : ""}`
      : `${form.kind} form${withChildren && form.children.length ? ` · ${form.children.map((kid) => kid.first).join(" and ")}` : ""}${form.due ? ` · reply by ${dLong(form.due)}` : ""}`,
    pill: answered ? (answered.decision === "YES" ? "Signed" : "Declined") : late ? "Past its date" : form.due ? `Reply by ${dShort(form.due)}` : "Waiting",
    tone: answered ? (answered.decision === "YES" ? "positive" : "neutral") : late ? "negative" : "attention",
    viewLabel: answered ? (form.open ? "Change" : "View") : "Review", drawer: formDrawer(form, today),
  };
}

const NO_FORMS_EMPTY = "No form is waiting. When the school sends a trip, leave or agreement form, it appears here.";

function familyConsents(types: Consent[], me: ParentMe, forms: SchoolForm[], today: string): ParentContent {
  const missing = types.filter((type) => type.state === "Not recorded").length;
  return {
    eyebrow: "Whole family", title: "Forms and consents",
    desc: "Forms waiting for you, then every consent at a glance.",
    rows: [
      row("1fr", [{ type: "list", title: "Forms waiting for you", sub: `Across ${me.children.length === 1 ? "your child" : `all ${me.children.length} children`}.`, items: forms.filter((form) => form.open && !form.answer).map((form) => formItem(form, today, true)), empty: NO_FORMS_EMPTY }]),
      row("1fr", [{
        type: "table", title: "Consents at a glance", sub: "Recorded for your whole family at the school. Open a child to change one.",
        noun: "consent", nounPlural: "consents", dense: true, head: ["Purpose", "Status", "Recorded"],
        rows: types.map((type): TableRow => ({
          keywords: type.name, href: me.children[0] ? `/portals/parent/consents?child=${me.children[0].id}` : undefined,
          cells: [nameCell(type.name, type.covers, { avatar: false }), pill(type.state, TONE[type.state]), text(type.on ? `${dLong(type.on)}${type.how ? ` · ${type.how}` : ""}` : "Never recorded")],
        })),
        foot: `${me.school} holds these under the data protection law of its country.${missing ? ` ${missing} ${missing === 1 ? "is" : "are"} still waiting for a yes or no.` : ""}`,
      }]),
    ],
  };
}

function childConsents(first: string, arm: string, types: Consent[], me: ParentMe, tab: string, forms: SchoolForm[], today: string, waiting: number): ParentContent {
  const head = {
    eyebrow: `${first} · ${arm}`, title: "Forms and consents",
    tabs: [{ label: TABS[0]!, count: waiting || undefined }, { label: TABS[1]! }], tab,
    desc: "Held under the school’s own consent register. Changes are recorded at once.",
  };
  if (tab === TABS[0]) {
    return { ...head, rows: [row("1fr", [{ type: "list", title: "Forms", sub: "Trips, leave and agreements the school needs you to answer.", items: forms.map((form) => formItem(form, today, false)), empty: `No form for ${first}. When the school sends one, it appears here.` }])] };
  }
  return {
    ...head,
    rows: [row("1fr", [{
      type: "table", title: "What you have agreed to", sub: "Each line records who gave it, when, and how. A consent is held for your whole family, so it reads the same under each child.",
      noun: "consent", nounPlural: "consents", dense: true, noRowOpen: true, head: ["Purpose", "Status", "Recorded", "", ""],
      rows: types.map((type): TableRow => ({
        keywords: type.name,
        cells: [
          nameCell(type.name, type.covers, { avatar: false }), pill(type.state, TONE[type.state]),
          { kind: "text", text: type.on ? `${dLong(type.on)}${type.how ? ` · ${type.how}` : ""}` : "Never recorded" },
          ...actions(type, me.school),
        ],
      })),
      foot: `Safety notices reach you on every channel, whatever you choose here. A required consent is what lets ${me.school} hold ${first}’s record, so it ends only if ${first} leaves the school.`,
      empty: "The school has not asked for any consent.",
    }])],
  };
}

