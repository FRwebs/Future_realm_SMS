import { apiGet, observe } from "@/lib/api/server";
import { localContracts } from "@/lib/api/local-contracts.zod";
import { name as nameCell, row, text } from "@/lib/modules/panels";
import type { DrawerSpec, FormField, ListItem, PanelFact, TableRow } from "@/lib/modules/panels";
import { PW, dLong, loadMe } from "@/lib/modules/live/parent/shared";
import type { ParentContent } from "@/lib/modules/live/parent/shared";

type Pending = { id: string; type: string; detail: string; state: string; owner: string | null; role: string | null; opened: string };
type Kid = {
  id: string; name: string; first: string; initials: string; admissionNumber: string;
  dob: string; gender: string; arm: string; level: string; tutor: string | null; house: string | null;
  boarding: { boarder: boolean; where: string }; enrolled: string; status: string;
  health: { bloodGroup: string | null; genotype: string | null; allergies: string | null; conditions: string | null; notes: string | null } | null;
  collectors: Array<{ id: string; name: string; relation: string; phone: string; hasPhoto: boolean; until: string | null }>;
  guardians: Array<{ id: string; name: string; relation: string; primary: boolean; me: boolean; phone: string | null; email: string | null }>;
  documents: Array<{ id: string; label: string; fileName: string; source: string; on: string; checked: boolean; note: string | null }>;
  pending: Pending[];
};
type Profile = { school: { name: string; short: string; place: string; curriculum: string }; children: Kid[] };

const SHIELD = "M12 3.2 19 6v6c0 4-3 7.4-7 8.3-4-.9-7-4.3-7-8.3V6zM9.3 12l2 2 3.4-3.7";
const TABS = ["Details", "Health", "Collection", "Family", "Documents"];
const CHANGES = ["Name", "Date of birth", "Gender", "Home address", "Health information", "Class or house", "Something else"];
const DOCUMENTS = ["Birth certificate", "Passport", "Immunisation card", "Medical letter", "Previous school report", "Other"];
const RELATIONS = ["Mother", "Father", "Grandparent", "Aunt or uncle", "Sibling (adult)", "Family friend", "Driver", "Other"];
const none = (value: string | null | undefined, word = "None recorded") => (value?.trim() ? value.trim() : word);
const initialsOf = (value: string) => value.split(/\s+/).map((part) => part[0] ?? "").join("").slice(0, 2).toUpperCase();

export async function profilePage(child: string, query: Record<string, string | undefined>): Promise<ParentContent> {
  const [, data] = await Promise.all([loadMe(), apiGet(`${PW}/profile?child=${encodeURIComponent(child)}`, observe<Profile>(localContracts["src/lib/modules/live/parent/profile.ts#1964de19"]))]);
  const one = child === "all" ? null : data.children.find((entry) => entry.id === child) ?? null;
  return one ? childProfile(one, data.school, query) : familyProfile(data);
}

/** A correction is a request, never an edit: the school corrects its own record and keeps the history. */
export function correctionDrawer(kids: Array<Pick<Kid, "id" | "first" | "name">>, chosen?: Pick<Kid, "id" | "first" | "name">, what?: string): DrawerSpec {
  const fields: FormField[] = [
    ...(chosen ? [] : [{ kind: "select", label: "Which child?", required: true, value: kids[0]?.name ?? "", options: kids.map((kid) => kid.name) } as FormField]),
    { kind: "select", label: "What needs changing?", required: true, value: what ?? CHANGES[0]!, options: CHANGES },
    { kind: "area", label: "What should it say?", required: true, value: "", placeholder: "The right spelling, date or detail — in your own words" },
    { kind: "text", label: "What backs it up?", optional: true, value: "", placeholder: "For example: birth certificate, seen at the office" },
  ];
  return {
    kicker: "Child profile", title: chosen ? `Ask for a correction to ${chosen.first}’s record` : "Ask for a correction", mode: "form",
    sub: "The school checks it and changes its own record. You can follow the request under Requests.",
    fields, confirmTitle: "Send this to the school?",
    commitLabel: "Send the request", commitDone: "Sent to the school",
    commitDoneBody: "The record changes only when the school accepts it. You can follow it under Requests.",
    submit: {
      endpoint: "/api/v1/parent-portal/ws/profile/requests", method: "POST",
      map: { "What needs changing?": "what", "What should it say?": "change", "What backs it up?": "evidence", ...(chosen ? {} : { "Which child?": "child" }) },
      body: chosen ? { child: chosen.id } : {},
      ...(chosen ? {} : { encode: { "Which child?": Object.fromEntries(kids.map((kid) => [kid.name, kid.id])) } }),
    },
  };
}

function personDrawer(kid: Kid): DrawerSpec {
  return {
    kicker: "Collection", title: `Someone new to collect ${kid.first}`, mode: "form",
    sub: "The school checks them and takes their photograph before the gate will release your child. Someone new for one day only? Send a note from Requests.",
    fields: [
      { kind: "text", label: "Their full name", required: true, value: "" },
      { kind: "select", label: "Who are they to " + kid.first + "?", required: true, value: RELATIONS[0]!, options: RELATIONS },
      { kind: "text", label: "Their phone number", required: true, value: "", placeholder: "A number the gate can call" },
    ],
    confirmTitle: "Send this to the school?",
    commitLabel: "Send the request", commitDone: "Sent to the school",
    commitDoneBody: "They are added once the school has checked them. You can follow it under Requests.",
    submit: {
      endpoint: "/api/v1/parent-portal/ws/profile/requests", method: "POST",
      body: { child: kid.id, what: "Add a collection person" },
      nest: { "Their full name": ["person", "name"], ["Who are they to " + kid.first + "?"]: ["person", "relation"], "Their phone number": ["person", "phone"] },
    },
  };
}

/** The honest version of an upload: what it is and what it is called are kept; the paper stays with the family until the registrar asks. */
function uploadDrawer(kids: Kid[], chosen?: Kid): DrawerSpec {
  return {
    kicker: "Documents", title: chosen ? `A document for ${chosen.first}’s record` : "A document for the record", mode: "form",
    sub: "The registrar checks it before it counts. The portal keeps the entry, not the file — the registrar will ask for the original if they need to see it.",
    fields: [
      ...(chosen ? [] : [{ kind: "select", label: "Which child?", required: true, value: kids[0]?.name ?? "", options: kids.map((kid) => kid.name) } as FormField]),
      { kind: "select", label: "What is it?", required: true, value: DOCUMENTS[0]!, options: DOCUMENTS },
      { kind: "text", label: "What is it called?", optional: true, value: "", placeholder: "For example: birth-certificate.pdf" },
      { kind: "text", label: "A note for the registrar", optional: true, value: "" },
    ],
    confirmTitle: "Put this on the record?",
    commitLabel: "Add to the record", commitDone: "Added, being checked",
    commitDoneBody: "It shows as Being checked until the registrar has seen the paper.",
    submit: {
      endpoint: "/api/v1/parent-portal/ws/profile/documents", method: "POST",
      map: { "What is it?": "type", "What is it called?": "fileName", "A note for the registrar": "note", ...(chosen ? {} : { "Which child?": "child" }) },
      body: chosen ? { child: chosen.id } : {},
      ...(chosen ? {} : { encode: { "Which child?": Object.fromEntries(kids.map((kid) => [kid.name, kid.id])) } }),
    },
  };
}

const requestItem = (item: Pending, kid: Kid, withChild: boolean): ListItem => ({
  label: `${withChild ? `${kid.first} · ` : ""}${item.type}`,
  sub: `${item.detail.length > 90 ? `${item.detail.slice(0, 88)}…` : item.detail} · ${item.owner ? `With ${item.owner}${item.role ? `, ${item.role}` : ""}` : "Not yet with anyone"} · sent ${dLong(item.opened)}`,
  pill: item.state, tone: "progress",
  href: "/portals/parent/requests",
});

function familyProfile(data: Profile): ParentContent {
  const { school, children: kids } = data;
  const changing: ListItem[] = kids.flatMap((kid) => [
    ...kid.pending.map((item) => requestItem(item, kid, true)),
    ...kid.documents.filter((doc) => !doc.checked).map((doc): ListItem => ({
      label: `${kid.first} · ${doc.label}`, sub: `${doc.source || "Added"} · ${dLong(doc.on)}`, pill: "Being checked", tone: "submitted",
      href: `/portals/parent/profile?child=${kid.id}&tab=Documents`,
    })),
  ]);
  const health: ListItem[] = kids.map((kid) => ({
    label: `${kid.first} · allergies: ${none(kid.health?.allergies, "none recorded").toLowerCase()}`,
    sub: `Conditions: ${none(kid.health?.conditions, "none recorded").toLowerCase()}`,
    href: `/portals/parent/profile?child=${kid.id}&tab=Health`,
  }));

  return {
    eyebrow: "Whole family", title: "Child profiles",
    desc: "What each school holds. To change anything, send a request.",
    primary: { label: "Request a correction", drawer: correctionDrawer(kids) },
    rows: [
      row("1fr", [{
        type: "table", title: "On record at each school", noun: "child", nounPlural: "children", dense: true,
        head: ["Child", "Class", "School", "Boarding", "Date of birth", "Collection", ""],
        rows: kids.map((kid): TableRow => {
          const dobAsked = kid.pending.some((item) => /date of birth/i.test(item.detail));
          return {
            href: `/portals/parent/profile?child=${kid.id}`,
            keywords: `${kid.name} ${kid.admissionNumber} ${kid.arm}`,
            cells: [
              nameCell(kid.name, kid.admissionNumber, { avatar: false }),
              nameCell(kid.arm, kid.tutor ? `Form master · ${kid.tutor}` : kid.level, { avatar: false }),
              nameCell(school.short, school.place, { avatar: false }),
              nameCell(kid.boarding.boarder ? "Boarder" : "Day student", kid.boarding.boarder ? kid.boarding.where : kid.house ?? "", { avatar: false }),
              nameCell(dLong(kid.dob), dobAsked ? "Correction requested" : "", { avatar: false }),
              text(`${kid.collectors.length} ${kid.collectors.length === 1 ? "person" : "people"}`),
              { kind: "action", label: "Open", href: `/portals/parent/profile?child=${kid.id}` },
            ],
          };
        }),
        empty: "No child is linked to your account yet.",
      }]),
      row("minmax(0,1fr) minmax(0,1fr)", [
        { type: "list", title: "Being checked or changed", sub: "Corrections and documents the school is working on.", items: changing, empty: "Nothing is being changed." },
        { type: "list", title: "Health notes the school holds", sub: "Open a child for the full health record.", items: health, empty: "No child is linked to your account yet." },
      ]),
    ],
  };
}

function childProfile(kid: Kid, school: Profile["school"], query: Record<string, string | undefined>): ParentContent {
  const tab = TABS.includes(query.tab ?? "") ? query.tab! : TABS[0]!;
  const head = {
    eyebrow: `${kid.admissionNumber} · ${school.short}`, title: kid.name,
    tabs: TABS.map((label) => ({ label })), tab,
    desc: `What ${school.short} holds about ${kid.first}. To change it, send a request.`,
    primary: { label: "Request a correction", drawer: correctionDrawer([kid], kid) },
  };

  if (tab === "Health") {
    const h = kid.health;
    const facts: PanelFact[] = h
      ? [
          ["Blood group", none(h.bloodGroup)], ["Genotype", none(h.genotype)], ["Allergies", none(h.allergies)],
          ["Conditions", none(h.conditions)], ["Notes", none(h.notes, "Nothing further recorded")],
        ]
      : [];
    return {
      ...head,
      rows: [
        row("1fr", [h
          ? { type: "facts", title: "Health and welfare", sub: "As the school’s health record stands today.", per: 3, facts }
          : { type: "note", tone: "neutral", title: "No health record is held yet", body: `${school.short} has not recorded anything about ${kid.first}’s health. If something should be known, send a correction so the nurse can add it.` }]),
        row("1fr", [{ type: "note", tone: "sensitive", icon: SHIELD, title: "Sensitive information", body: `This is health information about ${kid.first}. You cannot edit it here — send a request and the school changes its own record.` }]),
      ],
    };
  }

  if (tab === "Collection") {
    return {
      ...head,
      primary: { label: "Add a person", drawer: personDrawer(kid) },
      rows: [row("1fr", [{
        type: "list", title: `Authorised to collect ${kid.first}`,
        sub: "The gate checks each person against the school’s list. Someone new, even for one day? Use Add a person.",
        items: kid.collectors.map((person): ListItem => ({
          lead: { value: initialsOf(person.name), tone: "neutral" },
          label: person.name,
          sub: `${person.relation} · ${person.phone}${person.hasPhoto ? " · photograph on file" : " · no photograph yet"}`,
          pill: person.until ? `Until ${dLong(person.until)}` : "Authorised", tone: "positive",
        })),
        empty: `Nobody is on ${kid.first}’s collection list yet. Add the people who may collect them.`,
      }])],
    };
  }

  if (tab === "Family") {
    return {
      ...head,
      rows: [row("1fr", [{
        type: "list", title: `Guardians linked to ${kid.first}`,
        sub: "Each guardian has their own login and settings. You see who is linked, not how to reach them.",
        items: kid.guardians.map((person): ListItem => ({
          lead: { value: initialsOf(person.name), tone: person.me ? "positive" : "neutral" },
          label: person.me ? `${person.name} · you` : person.name,
          sub: [person.relation, person.primary ? "primary contact" : "secondary contact", person.phone, person.email].filter(Boolean).join(" · "),
          pill: "Linked", tone: "positive",
        })),
        empty: "No guardian is linked to this child.",
      }])],
    };
  }

  if (tab === "Documents") {
    return {
      ...head,
      primary: { label: "Add a document", drawer: uploadDrawer([kid], kid) },
      rows: [row("1fr", [{
        type: "list", title: `On ${kid.first}’s record`, sub: "Anything you add shows as Being checked until the registrar has seen it.",
        items: kid.documents.map((doc): ListItem => ({
          label: doc.label,
          sub: [doc.source || "Held by the school", dLong(doc.on), doc.note].filter(Boolean).join(" · "),
          pill: doc.checked ? "Accepted" : "Being checked", tone: doc.checked ? "positive" : "submitted",
        })),
        empty: `No document is on ${kid.first}’s record yet.`,
      }])],
    };
  }

  const dobAsked = kid.pending.find((item) => /date of birth/i.test(item.detail));
  const facts: PanelFact[] = [
    ["Full name", kid.name], ["Admission number", kid.admissionNumber],
    ["Date of birth", dLong(kid.dob), dobAsked ? `A correction is with ${dobAsked.owner ?? "the school"}` : "", dobAsked ? "submitted" : ""],
    ["Gender", kid.gender], ["Class", kid.arm, kid.level], ["Form master", kid.tutor ?? "Not assigned yet"],
    ["House", kid.house ?? "Not assigned"], ["Boarding", kid.boarding.boarder ? "Boarder" : "Day student", kid.boarding.where],
    ["Enrolled", dLong(kid.enrolled)], ["School", school.name, school.place], ["Curriculum", school.curriculum || "Not recorded"],
    ["Status", kid.status === "ACTIVE" ? "Enrolled" : kid.status.charAt(0) + kid.status.slice(1).toLowerCase(), "", kid.status === "ACTIVE" ? "positive" : "attention"],
  ];
  return {
    ...head,
    rows: [
      row("1fr", [{ type: "facts", title: "Identity", per: 4, facts }]),
      ...(kid.pending.length
        ? [row("1fr", [{ type: "list", title: "Being checked or changed", sub: "Requests you have sent about this record.", items: kid.pending.map((item) => requestItem(item, kid, false)) } as const])]
        : []),
    ],
  };
}
