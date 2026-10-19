import { renderToStaticMarkup } from "react-dom/server";

import { PanelRows } from "@/components/modules/panel-renderer";
import { consentTab } from "@/lib/modules/live/m9-consent";
import { addGuardianDrawer, consentTypeDrawer, familyConsentDrawer, inviteDrawer, mergeDrawer, phoneOnlyDrawer, resolveDrawer } from "@/lib/modules/live/m9-forms";
import { familyPage, guardiansTab } from "@/lib/modules/live/m9-guardians";
import { submissionsTab } from "@/lib/modules/live/m9-submissions";
import type { ConsentOverview, Families, Family, FamilyRow, GuardianOptions, SubmissionItem, Submissions } from "@/lib/modules/live/m9-types";
import type { TabContent } from "@/lib/modules/panels";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: () => {}, push: () => {}, replace: () => {} }),
  usePathname: () => "/",
}));
vi.mock("@/lib/api/server", () => ({ apiGet: async () => ({}) }));

const markup = (tab: Pick<TabContent, "rows">) => renderToStaticMarkup(<PanelRows rows={tab.rows} />);

function family(over: Partial<FamilyRow> = {}): FamilyRow {
  return { id: "g-1", name: "Funke Yusuf", relation: "Mother", phone: "08030000000", email: null, occupation: null, portal: "Not activated", delivery: "Delivered", consent: "None", consents: { core: "NOT_GIVEN", health: "NOT_GIVEN" }, children: [{ id: "s-1", name: "Daniel Yusuf", arm: "Nursery 2 A", level: "Nursery 2" }, { id: "s-2", name: "Maryam Yusuf", arm: "Nursery 2 A", level: "Nursery 2" }], owes: 1, amount: 125000, phoneOnly: false, second: false, language: "English", joined: 2026, givenBy: "—", ...over };
}

function families(over: Partial<Families> = {}): Families {
  return {
    rows: [family(), family({ id: "g-2", name: "Chika Ibe", phone: "08031112223", owes: 0, amount: 0, children: [{ id: "s-3", name: "Peace Ibe", arm: "JSS 1 C", level: "JSS 1" }] })],
    totals: { families: 2, children: 3, active: 0, never: 2, neverChildren: 3, failing: 0, noPhone: 0, phoneOnly: 0, second: 0, reachable: 2, otherLanguage: 0 },
    duplicates: [{ kind: "phone", key: "08031112223", ids: ["g-2", "g-3"], label: "08031112223 appears on 2 guardian records", sub: "Chika Ibe · 2 children between them", same: true }],
    options: { levels: ["JSS 1", "Nursery 2"], arms: ["JSS 1 C", "Nursery 2 A"] },
    ...over,
  };
}

const options: GuardianOptions = { students: [{ id: "s-1", name: "Daniel Yusuf", adm: "GFC/25/0001", arm: "Nursery 2 A" }], guardians: [], consents: ["Core record processing", "Health and welfare"], relations: ["Mother"], visibility: [] };

describe("M9 Guardians", () => {
  it("is one row per family, with every child under it", () => {
    const html = markup(guardiansTab(families()));
    expect(html).toContain("Daniel · Nursery 2 A");
    expect(html).toContain("Maryam · Nursery 2 A");
    expect(html).toContain("2 children");
  });

  it("says how many families never activated the portal, and how many children that leaves unreachable", () => {
    const html = markup(guardiansTab(families()));
    expect(html).toContain("2 families have never activated the portal — 3 children between them");
  });

  it("does not count a deliberately phone-only family as a failure", () => {
    const data = families({ rows: [family({ phoneOnly: true })], totals: { ...families().totals, families: 1, never: 0, neverChildren: 0, phoneOnly: 1 } });
    const html = markup(guardiansTab(data));
    expect(html).toContain("Phone-only");
    expect(html).not.toContain("have never activated the portal");
  });

  it("offers to merge a duplicate whose records carry one name", () => {
    const html = markup(guardiansTab(families()));
    expect(html).toContain("08031112223 appears on 2 guardian records");
    expect(html).toContain("Merge");
  });

  it("opens each family at its own page", () => {
    expect(markup(guardiansTab(families()))).toContain("/parents-guardians/guardians/g-1");
  });
});

describe("M9 forms", () => {
  it("requires every child to be mapped when adding a guardian", () => {
    const spec = addGuardianDrawer(options);
    const fields = spec.steps?.flatMap((step) => step.fields) ?? [];
    expect(spec.steps?.map((step) => step.title)).toEqual(["Guardian", "Children", "Review"]);
    expect(fields.find((field) => field.label === "Children in this school")?.required).toBe(true);
    expect(spec.submit?.endpoint).toBe("/api/v1/parents-guardians/guardians");
  });

  it("invites one family at its own address, and everyone through the shared one", () => {
    expect(inviteDrawer(1, 2, ["g-1"]).submit?.body).toEqual({ families: ["g-1"] });
    expect(inviteDrawer(5, 8).submit?.body).toBeUndefined();
  });

  it("marks a family phone-only at the family's address, or asks which one", () => {
    expect(phoneOnlyDrawer([], { id: "g-1", name: "Funke", phone: "0803" }).submit?.endpoint).toBe("/api/v1/parents-guardians/guardians/g-1/phone-only");
    const generic = phoneOnlyDrawer([{ id: "g-1", name: "Funke", phone: "0803" }]);
    expect(generic.fields?.some((field) => field.label === "Which family")).toBe(true);
    expect(generic.submit?.endpoint).toBe("/api/v1/parents-guardians/guardians/phone-only");
  });

  it("merges two chosen records, giving a reason", () => {
    const spec = mergeDrawer([{ id: "g-1", name: "A", phone: "1", children: [] }], ["g-1", "g-2"]);
    expect(spec.fields?.find((field) => field.label === "Why these are the same family")?.required).toBe(true);
    expect(spec.submit?.endpoint).toBe("/api/v1/parents-guardians/guardians/merge");
  });

  it("lets a consent type be removed, and says what removal keeps", () => {
    const type = { code: "photo", name: "Photography", short: "Photo", who: "Every guardian", required: false, covers: "x", blocks: "y", given: 0, gaps: 2, withdrawn: 0 };
    const spec = consentTypeDrawer(type);
    expect(spec.remove?.warn).toContain("kept");
    expect(consentTypeDrawer().remove).toBeUndefined();
  });

  it("records every consent for a family in one action", () => {
    const types = [{ code: "core", name: "Core record processing", short: "Core", who: "Every guardian", required: true, covers: "x", blocks: "Nothing can be published", given: 0, gaps: 1, withdrawn: 0 }];
    const spec = familyConsentDrawer(family(), types);
    expect(spec.submit?.nest?.["Core record processing"]).toEqual(["answers", "Core record processing"]);
  });

  it("will not close a submission without an outcome", () => {
    const item: SubmissionItem = { id: "sub-1", type: "Fee query", family: "Funke Yusuf", child: null, detail: "Disputes a line", owner: "Bursar", ownerRole: "Bursar", state: "New", open: true, overdue: false, age: "1 day · SLA 5", days: 1, sla: 5, outcome: null, channel: "In person", at: "", resolvedAt: null };
    expect(resolveDrawer(item).fields?.find((field) => field.label === "Outcome")?.required).toBe(true);
    expect(resolveDrawer({ ...item, open: false, state: "Resolved", outcome: "Done" }).submit).toBeUndefined();
  });
});

function detail(over: Partial<Family> = {}): Family {
  return {
    id: "g-1", name: "Funke Yusuf", initials: "FY", relation: "Mother", phone: "08030000000", email: null, occupation: null, address: null, language: "English", secondName: null, secondPhone: null, canSms: true, canEmail: true, phoneOnly: null, portal: "Not activated", delivery: "Delivered", invalidPhone: false, joined: 2026,
    children: [{ id: "s-1", name: "Daniel Yusuf", gender: "Male", boarding: "Boarding", adm: "GFC/25/0001", arm: "Nursery 2 A", level: "Nursery 2", att: 95.2, avg: 69.2, grade: "B", pos: 6, fee: "Part paid", billed: 285000, paid: 160000, owing: 125000, structures: [], state: "Enrolled", primary: true, see: [], collect: true }],
    owes: 1, amount: 125000, billed: 285000, days: 197, receipts: 1, attendance: 95, consent: "None", consents: [{ code: "core", name: "Core record processing", required: true, blocks: "Nothing can be published", status: "NOT_GIVEN", means: null, on: null }], collectors: [], sent: [], familyHref: "/fee-management/collections/families/g-1",
    ...over,
  };
}

describe("M9 family page", () => {
  it("warns that a family who never activated the portal cannot be reached digitally", () => {
    const html = markup(familyPage(detail(), options, families().rows).content);
    expect(html).toContain("This family has never activated the portal");
  });

  it("flags a phone number that will not receive an SMS", () => {
    const html = markup(familyPage(detail({ invalidPhone: true }), options, families().rows).content);
    expect(html).toContain("does not look like a Nigerian mobile");
  });

  it("links the balance to the same family in Fee Management", () => {
    expect(markup(familyPage(detail(), options, families().rows).content)).toContain("/fee-management/collections/families/g-1");
  });

  it("says Settled rather than ₦0 when nothing is owed", () => {
    const html = markup(familyPage(detail({ owes: 0, amount: 0 }), options, families().rows).content);
    expect(html).toContain("Settled");
  });
});

describe("M9 consent and submissions", () => {
  const overview = (over: Partial<ConsentOverview> = {}): ConsentOverview => ({
    types: [{ code: "core", name: "Core record processing", short: "Core", who: "Every guardian", required: true, covers: "x", blocks: "Nothing can be published", given: 0, gaps: 2, withdrawn: 0 }],
    rows: families().rows,
    totals: { families: 2, complete: 0, gaps: 2, noCore: 2, noCoreChildren: 3, required: 1, optional: 0, noPortal: 2 },
    withdrawals: [],
    options: { levels: [], arms: [] },
    ...over,
  });

  it("calls missing core consent the legal gap it is", () => {
    const html = markup(consentTab(overview()));
    expect(html).toContain("2 families have not given core record processing consent");
    expect(html).toContain("legally");
  });

  it("does not invent a withdrawal", () => {
    expect(markup(consentTab(overview()))).toContain("Withdrawals");
  });

  const subs = (over: Partial<Submissions> = {}): Submissions => ({ items: [], totals: { open: 0, overdue: 0, resolved: 0, median: null, all: 0 }, levels: [{ name: "Fee query", target: 5, reviewer: "Bursar", accepted: true, open: 0, overdue: 0 }, { name: "Consent action", target: 0, reviewer: "Handled in person", accepted: false, open: 0, overdue: 0 }], types: ["Fee query"], ...over });

  it("says nothing has been sent in, rather than that everything is resolved", () => {
    const html = markup(submissionsTab(subs(), { guardians: [], types: ["Fee query"] }));
    expect(html).toContain("No family has sent anything in yet");
  });

  it("shows a type the school does not accept as not accepted", () => {
    expect(markup(submissionsTab(subs(), { guardians: [], types: [] }))).toContain("Not accepted");
  });
});
