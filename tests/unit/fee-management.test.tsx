import { renderToStaticMarkup } from "react-dom/server";

import { PanelRows } from "@/components/modules/panel-renderer";
import { collectionsTab, familyPage, formClassTab } from "@/lib/modules/live/m10-collections";
import {
  adjustDrawer,
  closeDayDrawer,
  countDrawer,
  deleteStructureDrawer,
  meetingDrawer,
  planDrawer,
  publishDrawer,
  recordPaymentDrawer,
  remindersDrawer,
  waiverDrawer,
  writeOffDrawer,
} from "@/lib/modules/live/m10-forms";
import { historyTab } from "@/lib/modules/live/m10-history";
import { reviewTab } from "@/lib/modules/live/m10-review";
import { rulesPage, structurePage, structuresTab } from "@/lib/modules/live/m10-structures";
import type { CashUpRow, Collections, FamilyDetail, FamilyRow, History, PublishPreview, Review, StructureDetail, StructureRow, Structures } from "@/lib/modules/live/m10-types";
import type { TabContent } from "@/lib/modules/panels";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: () => {}, push: () => {}, replace: () => {} }),
  usePathname: () => "/",
}));

const markup = (tab: Pick<TabContent, "rows">) => renderToStaticMarkup(<PanelRows rows={tab.rows} />);

function family(over: Partial<FamilyRow> = {}): FamilyRow {
  return {
    id: "f-1", name: "Yusuf family", relation: "Mother", phone: "08030000000", portal: "Not activated", owing: 125000, billed: 285000, paid: 160000, days: 197, bucket: "90+ days", stage: "Not started",
    children: [{ id: "s-1", name: "Daniel", arm: "JSS 2 A", level: "JSS 2", owing: 125000 }], canSms: true, ...over,
  };
}

function collections(over: Partial<Collections> = {}): Collections {
  const debtors = [family(), family({ id: "f-2", name: "Adewale family", owing: 30000, days: 12, bucket: "Current" })];
  return {
    term: { id: "t-1", name: "Second Term", session: "2025/2026", label: "Second Term 2025/2026" },
    school: "Greenfield College",
    totals: { expected: 1575000, collected: 160000, outstanding: 155000, families: 2, over90: 125000, over90Families: 1, discount: 0, lastTermRate: null, receipts: 1 },
    payments: [{ id: "p-1", ref: "RCT-2026-001", student: "Daniel Yusuf", adm: "GFC/25/0001", arm: "JSS 2 A", amount: 160000, kind: "Part payment", mode: "Bank transfer", bankRef: null, by: "Ngozi Eze", at: "2026-04-03T00:00:00.000Z", invoice: "INV-2026-001" }],
    recent: { amount: 0 },
    debtors,
    bars: { sections: [{ name: "Nursery and Primary", billed: 285000, paid: 160000 }], methods: [{ name: "Bank transfer", amount: 160000 }], items: [{ name: "Tuition", expected: 200000, collected: 112000 }] },
    payers: [{ id: "s-1", name: "Daniel Yusuf", adm: "GFC/25/0001", arm: "JSS 2 A", owing: 125000, billed: 285000, paid: 160000, family: "Yusuf family", guardian: "f-1" }],
    options: { levels: ["JSS 2"], arms: ["JSS 2 A"], methods: ["Bank transfer"] },
    receiptPrefix: "RCT",
    ...over,
  };
}

function detail(over: Partial<FamilyDetail> = {}): FamilyDetail {
  return {
    family: { ...family(), email: null, guardianId: "g-1" },
    children: [{ id: "s-1", name: "Daniel Yusuf", adm: "GFC/25/0001", arm: "JSS 2 A", boarding: true, structures: ["JSS 2 Second Term Fees"], billed: 285000, paid: 160000, owing: 125000, state: "Part paid", invoices: [{ id: "i-1", number: "INV-2026-001", structure: "JSS 2 Second Term Fees", total: 285000, received: 160000, balance: 125000, issuedOn: "2026-04-01T00:00:00.000Z", items: [{ description: "Tuition", amount: 200000 }] }] }],
    receipts: [],
    contacts: [],
    plans: [],
    adjustments: [],
    policy: { receiptPrefix: "RCT", writeOffBy: "The Proprietor only", approvalLimit: 50000 },
    ...over,
  };
}

function structureRow(over: Partial<StructureRow> = {}): StructureRow {
  return { id: "fs-1", ref: "FS-1", name: "JSS 2 Second Term Fees", kind: "Day", state: "Published", classes: ["JSS 2"], mapped: true, items: 3, students: 1, termly: 285000, expected: 285000, term: "t-1", session: "s-1", ...over };
}

function structures(over: Partial<Structures> = {}): Structures {
  return {
    term: { id: "t-1", label: "Second Term 2025/2026" },
    structures: [structureRow(), structureRow({ id: "fs-2", name: "Nursery Second Term Fees", mapped: false, classes: [], students: 0, expected: 0 })],
    totals: { count: 2, published: 2, draft: 0, expected: 285000, classesMapped: 1, classes: 21, placements: 1, boarders: 0, rules: 0, discount: 0 },
    rules: [],
    levels: [{ id: "l-1", name: "JSS 2" }],
    unmappedStructures: 1,
    ...over,
  };
}

function structureDetail(over: Partial<StructureDetail> = {}): StructureDetail {
  return {
    ...structureRow(),
    items: [{ id: "it-1", name: "Tuition", type: "Mandatory", freq: "Termly", amount: 200000, takers: 1, expected: 200000, collected: 112000, pct: 56 }],
    levels: [{ id: "l-1", name: "JSS 2", students: 1, billed: 285000, pct: 56 }],
    allLevels: [{ id: "l-1", name: "JSS 2" }, { id: "l-2", name: "JSS 3" }],
    publishedOn: "2026-04-01T00:00:00.000Z",
    termLabel: "Second Term 2025/2026",
    termlyAll: 285000,
    sessional: 0,
    rules: [],
    owner: null,
    note: null,
    ...over,
  };
}

function preview(over: Partial<PublishPreview> = {}): PublishPreview {
  return { id: "fs-1", name: "JSS 2 Second Term Fees", state: "Draft", mapped: true, kind: "Day", invoices: 61, alreadyBilled: 0, perStudent: 285000, total: 17385000, families: 54, noPhone: 2, noGuardian: 1, rules: [{ name: "Sibling discount", auto: true }], concession: null, ...over };
}

function cashDay(over: Partial<CashUpRow> = {}): CashUpRow {
  return { day: "2026-10-14", recorded: 50000, counted: 48000, variance: -2000, by: "Tunde Adeyemi", byRole: "PRINCIPAL", state: "Unreconciled", note: null, ...over };
}

function review(over: Partial<Review> = {}): Review {
  return {
    term: "Second Term 2025/2026",
    cashup: [cashDay()],
    unreconciled: 1,
    oldestUnreconciled: "2026-10-14",
    openVariance: -2000,
    recorders: [{ name: "Ngozi Eze", role: "accountant", n: 1, value: 160000, reversals: 0, duplicates: 0 }],
    flags: [{ key: "duplicate", label: "Duplicate bank reference", count: 0, found: "Every bank reference is unique.", action: "Review", items: [] }],
    flagCount: 0,
    waivers: [{ id: "w-1", family: "Mohammed family", child: "Ibrahim Salisu", arm: "Nursery 2 A", type: "Partial waiver", value: 45000, reason: "Hardship — father's business closed.", days: 8, by: "Ngozi Eze", invoice: "INV-2026-003" }],
    waiverValue: 45000,
    oldestWaiver: 8,
    ...over,
  };
}

function history(over: Partial<History> = {}): History {
  return {
    session: "2025/2026",
    kpis: { collectedSession: 160000, collectedTerm: 160000, expectedTerm: 1575000, receipts: 1, reversals: 0, reversalValue: 0, outstanding: 200000 },
    terms: [{ id: "t-1", session: "2025/2026", term: "Second Term", expected: 1575000, collected: 160000, rate: 10, never: 1415000, receipts: 1, state: "In progress" }],
    sections: [{ name: "Nursery and Primary", students: 6, expected: 1575000, collected: 160000, rate: 10 }],
    receipts: [{ id: "p-1", ref: "RCT-2026-001", student: "Daniel Yusuf", adm: "GFC/25/0001", arm: "Nursery 2 A", amount: 160000, mode: "Bank transfer", bankRef: null, by: "Ngozi Eze", at: "2026-04-03T00:00:00.000Z" }],
    recorders: ["Ngozi Eze"],
    options: { sessions: ["2025/2026"] },
    ...over,
  };
}

describe("M10 Collections", () => {
  it("shows a family once, with every child under it", () => {
    const html = markup(collectionsTab(collections()));
    expect(html).toContain("Yusuf family");
    expect(html).toContain("Daniel · JSS 2 A");
    expect(html).toContain("₦125,000");
  });

  it("names the past-90-days families and asks for a meeting rather than another reminder", () => {
    const html = markup(collectionsTab(collections()));
    expect(html).toContain("is more than 90 days old, across 1 family");
    expect(html).toContain("a meeting rather than another reminder");
  });

  it("does not claim a previous term it cannot compare against", () => {
    const html = markup(collectionsTab(collections()));
    expect(html).toContain("No earlier term");
  });

  it("offers the receipt for a payment on record", () => {
    const html = markup(collectionsTab(collections()));
    expect(html).toContain("RCT-2026-001");
    expect(html).toContain("/print/receipt/p-1");
  });

  it("shows a form master only the status of their own class, never an amount", () => {
    const html = markup(formClassTab({ className: "JSS 2 A", outstanding: 1, rows: [{ id: "s-1", name: "Daniel Yusuf", adm: "GFC/25/0001", status: "Part paid", guardian: "Yusuf family" }] }));
    expect(html).toContain("Daniel Yusuf");
    expect(html).toContain("Part paid");
    expect(html).not.toContain("₦");
  });
});

describe("M10 family page", () => {
  it("restates the balance, the age, and what the school may do about it", () => {
    const page = familyPage(detail(), collections());
    const html = markup(page);
    expect(html).toContain("This balance is 197 days old");
    expect(html).toContain("Write off with approval");
    expect(page.crumb.href).toBe("/fee-management/collections");
  });

  it("lists the children's totals in a footer, not as another child", () => {
    const html = markup(familyPage(detail(), collections()));
    expect(html).toContain("<tfoot");
    expect(html).toContain("Total");
  });
});

describe("M10 forms", () => {
  it("puts the student's balance beside their name and refuses to submit nothing", () => {
    const spec = recordPaymentDrawer(collections());
    const picker = spec.fields?.find((field) => field.kind === "picker");
    expect(picker && "options" in picker ? picker.options?.[0].sub : "").toContain("owes ₦125,000 of ₦285,000");
    expect(spec.submit?.endpoint).toBe("/api/v1/fee-management/payments");
  });

  it("sends a reminder to chosen families, and says how many", () => {
    const spec = remindersDrawer({ count: 3, amount: 200000 });
    expect(spec.submit?.endpoint).toBe("/api/v1/fee-management/reminders");
    expect(JSON.stringify(spec)).toContain("3");
  });

  it("books a meeting for one family at its own address and for many at the shared one", () => {
    expect(meetingDrawer({ family: family() }).submit?.endpoint).toBe("/api/v1/fee-management/families/f-1/meeting");
    expect(meetingDrawer({ selection: true }).submit?.endpoint).toBe("/api/v1/fee-management/meetings");
  });

  it("agrees a plan and an adjustment against the family", () => {
    expect(planDrawer(detail()).submit?.endpoint).toBe("/api/v1/fee-management/families/f-1/plan");
    expect(adjustDrawer(detail()).submit?.endpoint).toBe("/api/v1/fee-management/families/f-1/adjust");
  });

  it("states who may write off a balance, and takes a reason", () => {
    const spec = writeOffDrawer(detail());
    expect(spec.submit?.endpoint).toBe("/api/v1/fee-management/families/f-1/write-off");
    expect(JSON.stringify(spec)).toContain("The Proprietor");
  });

  it("makes a variance something that has to be explained before the day closes", () => {
    const short = closeDayDrawer(cashDay());
    const balanced = closeDayDrawer(cashDay({ counted: 50000, variance: 0 }));
    expect(short.submit?.reasonRequired).toBe(true);
    expect(balanced.submit?.reasonRequired).toBe(false);
    expect(countDrawer(cashDay()).submit?.endpoint).toBe("/api/v1/fee-management/review/cash-up/2026-10-14/count");
  });

  it("decides a waiver at its own address", () => {
    expect(waiverDrawer(review().waivers[0]).submit?.endpoint).toBe("/api/v1/fee-management/review/waivers/w-1/decide");
  });

  it("publishes in two steps and says what it will bill before it does", () => {
    const spec = publishDrawer(preview());
    expect(spec.steps?.length).toBe(2);
    expect(JSON.stringify(spec)).toContain("61");
    expect(spec.submit?.endpoint).toBe("/api/v1/fee-management/structures/fs-1/publish");
  });

  it("says plainly when publishing would bill nobody", () => {
    const spec = publishDrawer(preview({ mapped: false, invoices: 0 }));
    expect(JSON.stringify(spec)).toContain("no class is mapped");
  });

  it("will not delete a structure without a reason", () => {
    expect(deleteStructureDrawer(structureDetail()).submit?.reasonRequired).toBe(true);
  });
});

describe("M10 Structures", () => {
  it("lists every structure and flags those with no class mapped", () => {
    const html = markup(structuresTab(structures(), ["Second Term 2025/2026"]));
    expect(html).toContain("JSS 2 Second Term Fees");
    expect(html).toContain("Nursery Second Term Fees");
    expect(html).toContain("Not mapped to any class");
  });

  it("opens a structure at its own page", () => {
    const html = markup(structuresTab(structures(), []));
    expect(html).toContain("/fee-management/structures/fs-1");
  });

  it("shows the classes a structure charges, and an honest empty state when there are none", () => {
    const mapped = markup(structurePage(structureDetail(), preview(), structures(), []));
    expect(mapped).toContain("JSS 2");
    const bare = markup(structurePage(structureDetail({ levels: [], classes: [], mapped: false }), preview({ mapped: false }), structures(), []));
    expect(bare).toContain("No class mapped");
  });

  it("states the rules page's promise: always a visible line, never a quiet cut", () => {
    const html = markup(rulesPage(structures()));
    expect(html).toContain("never a quietly reduced amount");
  });

  it("shows a rule with the families it touches", () => {
    const html = markup(rulesPage(structures({ rules: [{ code: "r-1", name: "Sibling discount", appliesTo: "Second child onward", valueIs: "A percentage", value: 10, items: ["Tuition"], stacks: "No · the largest applies", until: "I remove it", visible: true, families: 3 }] })));
    expect(html).toContain("Sibling discount");
    expect(html).toContain("Second child onward");
  });
});

describe("M10 Review", () => {
  it("lists the unreconciled day with its shortfall", () => {
    const html = markup(reviewTab(review()));
    expect(html).toContain("14 October");
    expect(html).toContain("Unreconciled");
  });

  it("says the books are clean when there is nothing to flag", () => {
    const html = markup(reviewTab(review()));
    expect(html).toContain("Every bank reference is unique.");
  });

  it("keeps the decision on a waiver away from whoever asked", () => {
    const html = markup(reviewTab(review()));
    expect(html).toContain("never by whoever asked");
    expect(html).toContain("Mohammed family");
  });

  it("is honest when no cash has been taken", () => {
    const html = markup(reviewTab(review({ cashup: [], unreconciled: 0, oldestUnreconciled: null, openVariance: 0 })));
    expect(html).toContain("No cash has been taken");
  });
});

describe("M10 History", () => {
  it("reads the term and section figures off the books", () => {
    const html = markup(historyTab(history()));
    expect(html).toContain("Second Term");
    expect(html).toContain("Nursery and Primary");
    expect(html).toContain("₦160,000");
  });

  it("stamps a reprint as a duplicate and keeps the original the only record", () => {
    const html = markup(historyTab(history()));
    expect(html).toContain("A reprint is stamped DUPLICATE");
    expect(html).toContain("Reprint");
  });

  it("says 1 receipt, not 1 receipts", () => {
    const html = markup(historyTab(history()));
    expect(html).toContain("1 receipt");
    expect(html).not.toContain("1 receipts");
  });
});
