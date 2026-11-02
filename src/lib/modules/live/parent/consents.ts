import { apiGet, observe } from "@/lib/api/server";
import { localContracts } from "@/lib/api/local-contracts.zod";
import { name as nameCell, pill, row, text } from "@/lib/modules/panels";
import type { DrawerSpec, PanelTone, TableCellKind, TableRow } from "@/lib/modules/panels";
import { PW, dLong, loadMe } from "@/lib/modules/live/parent/shared";
import type { ParentContent, ParentMe } from "@/lib/modules/live/parent/shared";

type Consent = {
  code: string; name: string; covers: string; blocks: string; required: boolean; who: string;
  state: "Given" | "Withdrawn" | "Declined" | "Not recorded"; on: string | null; how: string | null;
};

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
  const [me, data] = await Promise.all([loadMe(), apiGet(`${PW}/consents`, observe<{ types: Consent[] }>(localContracts["src/lib/modules/live/parent/consents.ts#d42e60d4"]))]);
  const one = child === "all" ? null : me.children.find((entry) => entry.id === child) ?? null;
  return one ? childConsents(one.first, one.arm, data.types, me, query.tab === TABS[0] ? TABS[0]! : TABS[1]!) : familyConsents(data.types, me);
}

const NO_FORMS = "Trip, leave and agreement forms are not sent through the portal yet — the school asks on paper or by message.";

function familyConsents(types: Consent[], me: ParentMe): ParentContent {
  const missing = types.filter((type) => type.state === "Not recorded").length;
  return {
    eyebrow: "Whole family", title: "Forms and consents",
    desc: "Forms waiting for you, then every consent at a glance.",
    rows: [
      row("1fr", [{ type: "list", title: "Forms waiting for you", sub: `Across ${me.children.length === 1 ? "your child" : `all ${me.children.length} children`}.`, items: [], empty: `No form is waiting. ${NO_FORMS}` }]),
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

function childConsents(first: string, arm: string, types: Consent[], me: ParentMe, tab: string): ParentContent {
  const head = {
    eyebrow: `${first} · ${arm}`, title: "Forms and consents",
    tabs: TABS.map((label) => ({ label })), tab,
    desc: "Held under the school’s own consent register. Changes are recorded at once.",
  };
  if (tab === TABS[0]) {
    return { ...head, rows: [row("1fr", [{ type: "list", title: "Forms", sub: "Trips, leave and agreements the school needs you to answer.", items: [], empty: `No form is waiting for ${first}. ${NO_FORMS}` }])] };
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

