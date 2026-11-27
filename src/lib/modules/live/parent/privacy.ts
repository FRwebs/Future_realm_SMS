import { apiGet, observe } from "@/lib/api/server";
import { localContracts } from "@/lib/api/local-contracts.zod";
import { row, text } from "@/lib/modules/panels";
import type { DrawerSpec, ListItem, PanelFact, TableRow } from "@/lib/modules/panels";
import { PW } from "@/lib/modules/live/parent/shared";
import type { ParentContent } from "@/lib/modules/live/parent/shared";

type Notice = {
  controller: string; processor: string;
  schools: Array<{
    school: { id: string; name: string; short: string; place: string; phone: string | null };
    children: string[];
    dpo: { name: string | null; email: string | null } | null;
    hostedIn: string; regime: string | null;
    retention: Array<{ dataClass: string; kept: string; basis: string; hostedIn: string }>;
    permissions: Array<{ name: string; covers: string; basis: string; version: string | null }>;
    /** How many school days the school promises to answer a request for a copy of what it holds about the children. */
    copyWithinDays: number | null;
  }>;
};

/** What the school holds, said once, in the plain words a parent would use — it is the same for every school because it is what the product records. */
const ABOUT_YOU: PanelFact[] = [
  ["Who you are", "Your name, how you are related to each child, your phone number, email address, home address and occupation", "So the school can reach you, and knows who may collect a child"],
  ["How you want to be reached", "The language you use, and which messages may come by SMS, email or WhatsApp", "So the school writes to you the way you asked"],
  ["What you told the school", "The permissions you gave or withdrew, the requests you made, any concern you raised, and the messages you replied to", "So the school can show what was agreed, and when"],
  ["How you use this portal", "When and from which device you signed in", "To keep your account safe"],
];
const ABOUT_CHILDREN: PanelFact[] = [
  ["Who the child is", "Name, date of birth, admission details, class and arm", "To run the school and report to the authorities that require it"],
  ["How the child is doing", "Attendance, scores and report cards", "To teach, assess and tell you how your child is doing"],
  ["Fees", "What was billed, what was paid and when", "To keep the school's accounts, which the law requires"],
  ["Health and welfare", "Notes the school keeps about your child's health and wellbeing — only where you have agreed", "To look after your child"],
  ["Photographs", "Photographs of your child — only where you have agreed", "As you permitted"],
  ["Safeguarding", "A concern about a child's safety, held by the safeguarding lead alone. It is not shown in this portal", "To protect your child"],
];

export async function privacyPage(): Promise<ParentContent> {
  const data = await apiGet(`${PW}/privacy`, observe<Notice>(localContracts["src/lib/modules/live/parent/privacy.ts#3a5d2c16"]));
  const many = data.schools.length > 1;
  const names = data.schools.map((entry) => entry.school.name).join(" and ");

  const rights = (entry: Notice["schools"][number]): ListItem[] => {
    const days = entry.copyWithinDays;
    const copy: DrawerSpec = {
      mode: "commit", tone: "progress", kicker: "Your children's data", title: "Ask for the records held about your children?",
      sub: `${entry.school.name} prepares what it holds about ${entry.children.join(" and ") || "your children"} — results, attendance, fees and the rest — and sends it to you.${days ? ` It promises an answer within ${days} school ${days === 1 ? "day" : "days"}, and the date is shown on your request.` : ""}`,
      confirmTitle: "Send this request?",
      commitLabel: "Send the request", commitDone: "Request sent",
      commitDoneBody: "You can follow it, and the date it is due, under Requests.",
      submit: { endpoint: `${PW}/account/requests`, method: "POST", body: { kind: "copy" } },
    };
    return [
      { label: "Ask for the records held about your children", sub: `Results, attendance, fees and the rest.${days ? ` The school answers within ${days} school ${days === 1 ? "day" : "days"}; the date is on the request.` : ""}`, viewLabel: "Request", drawer: copy },
      { label: "Correct something", sub: "The school corrects its own record and keeps the history.", viewLabel: "Start", href: "/portals/parent/profile" },
      { label: "Change or withdraw a permission", sub: "Photographs, health information, sharing results. Recorded at once.", viewLabel: "Open", href: "/portals/parent/consents" },
    ];
  };

  const blocks = data.schools.flatMap((entry) => {
    const where = many ? ` · ${entry.school.short}` : "";
    const responsible: PanelFact[] = [
      ["The school", `${entry.school.name}${entry.school.place ? `, ${entry.school.place}` : ""}`, "Decides what is held about you and your children, and why. It is responsible for it"],
      ["The software", data.processor, "Holds the school's records on its behalf, and does only what the school tells it to"],
      ["Who to ask", entry.dpo ? [entry.dpo.name, entry.dpo.email].filter(Boolean).join(" · ") : entry.school.phone ? `The school office · ${entry.school.phone}` : "The school office", entry.dpo ? "The school's data protection contact" : "The school has not named a separate data protection contact"],
      ["Where it is kept", entry.hostedIn || "—", "The records are hosted in this country or region"],
      ...(entry.regime ? [["The law that applies", entry.regime, "If you are not satisfied with the school's answer, you may complain to the authority that enforces it"] as PanelFact] : []),
    ];
    const kept: TableRow[] = entry.retention.map((item) => ({ cells: [text(item.dataClass, { strong: true }), text(item.kept), text(item.basis)] }));
    const asked: ListItem[] = entry.permissions.map((item) => ({ label: item.name, sub: [item.covers, item.basis].filter(Boolean).join(" · "), pill: item.version ? `Wording of ${item.version}` : undefined, tone: "neutral" as const }));
    return [
      row("1fr", [{ type: "facts" as const, title: `Who is responsible${where}`, sub: "Two parties handle your family's information. Only one decides what to do with it.", per: 1, facts: responsible }]),
      row("minmax(0,1fr) minmax(0,1fr)", [
        { type: "facts" as const, title: `What is held about you${where}`, per: 1, facts: ABOUT_YOU },
        { type: "facts" as const, title: `What is held about your children${where}`, per: 1, facts: ABOUT_CHILDREN },
      ]),
      row("1fr", [{ type: "table" as const, title: `How long it is kept${where}`, sub: "The school's own schedule. When the time is up, the record is removed, not kept 'just in case'.", head: ["What", "Kept", "Why"], rows: kept, noun: "kind of record", nounPlural: "kinds of record", dense: true, noRowOpen: true, per: 12 }]),
      row("1fr", [{ type: "list" as const, title: `What the school asks your permission for${where}`, sub: "Each is yours to give or withdraw under Forms and consents. Core records are the one thing the school cannot hold a child's record without.", empty: "The school has not listed any permission.", items: asked }]),
      row("1fr", [{ type: "list" as const, title: `What you can do${where}`, sub: "Your rights over your own information, and over your children's.", items: rights(entry) }]),
    ];
  });

  return {
    eyebrow: "Your account", title: "Privacy and your data",
    desc: `What ${names || "your school"} and ${data.processor} hold about you and your children, why, for how long, and where — and what you can do about it.`,
    // The one thing a parent most often wants, and it needs no one at the school: their own data, as a file, now.
    primary: { label: "Download my data", href: `${PW}/account/download`, download: true },
    rows: blocks,
  };
}
