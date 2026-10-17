import { renderToStaticMarkup } from "react-dom/server";

import { PanelRows } from "@/components/modules/panel-renderer";
import { admissionsTab, applicantPage, pipelinePage } from "@/lib/modules/live/m8-admissions";
import { changesTab } from "@/lib/modules/live/m8-changes";
import { advanceDrawer, collectorDrawer, decideChangeDrawer, enrolDrawer, mapGuardianDrawer, requestChangeDrawer, sensitiveDrawer } from "@/lib/modules/live/m8-forms";
import { studentRecordPage, type RecordSection } from "@/lib/modules/live/m8-record";
import { registryTab } from "@/lib/modules/live/m8-registry";
import type { AdmissionOptions, AdmissionsBoard, Applicant, ApplicantRow, ChangeItem, Changes, Dossier, EnrolOptions, Registry, RegistryRow } from "@/lib/modules/live/m8-types";
import type { TabContent } from "@/lib/modules/panels";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: () => {}, push: () => {}, replace: () => {} }),
  usePathname: () => "/",
}));

const apiGet = vi.fn();
vi.mock("@/lib/api/server", () => ({ apiGet: (...args: unknown[]) => apiGet(...args) }));

const markup = (tab: Pick<TabContent, "rows">) => renderToStaticMarkup(<PanelRows rows={tab.rows} />);

function row(over: Partial<RegistryRow> = {}): RegistryRow {
  return { id: "s-1", name: "Daniel Yusuf", boarding: "Day", arm: "Nursery 2 A", level: "Nursery 2", adm: "GFC/25/0001", gender: "Male", guardian: { id: "g-1", name: "Funke Yusuf", relation: "Mother", phone: "08030000000" }, att: 95.2, avg: 69.2, grade: "B", fee: "Part paid", portal: "Not activated", state: "Enrolled", ...over };
}

function registry(over: Partial<Registry> = {}): Registry {
  return {
    term: { id: "t-1", name: "Second Term", session: "2025/2026", label: "Second Term 2025/2026" },
    school: "Greenfield College",
    totals: { records: 2, enrolled: 1, withoutArm: 1, alumni: 0, withdrawn: 0, blocked: 0, in: 2, out: 1, owingFamilies: 1, noGuardianPortal: 1, noGuardian: 1, pendingChanges: 0, arms: 47 },
    rows: [row(), row({ id: "s-2", name: "Ada Obi", adm: "GFC/25/0002", arm: "No arm", level: "", guardian: null, att: null, avg: null, grade: "—", fee: "Not billed" })],
    options: { arms: ["Nursery 2 A"], levels: ["Nursery 2"] },
    ...over,
  };
}

const enrol: EnrolOptions = { admissionNumber: "GFC/26/0001", levels: ["JSS 1"], arms: [{ id: "a-1", name: "JSS 1 A", level: "JSS 1", seats: 5 }], terms: ["Second Term 2025/2026"], guardians: [{ id: "g-1", name: "Funke Yusuf", phone: "08030000000", children: 2 }] };
const rooms = [{ id: "a-1", name: "JSS 1 A", level: "JSS 1", seats: 5 }];

describe("M8 Registry", () => {
  it("names a student with no arm and no guardian rather than hiding them", () => {
    const html = markup(registryTab(registry(), enrol, rooms));
    expect(html).toContain("No arm");
    expect(html).toContain("None on file");
  });

  it("counts families, not children, against fees", () => {
    const html = markup(registryTab(registry(), enrol, rooms));
    expect(html).toContain("Families, not children");
  });

  it("opens each student at their own record", () => {
    const html = markup(registryTab(registry(), enrol, rooms));
    expect(html).toContain("/student-records/registry/s-1");
  });

  it("states the net of a term as in and out, never as a bare number", () => {
    const html = markup(registryTab(registry(), enrol, rooms));
    expect(html).toContain("2 in · 1 out");
    expect(html).toContain("+1");
  });
});

describe("M8 enrolment and record forms", () => {
  it("will not enrol without core record processing ticked by default", () => {
    const spec = enrolDrawer(enrol);
    const consent = spec.steps?.flatMap((step) => step.fields).find((field) => field.label === "Consent recorded");
    expect(consent && "checked" in consent ? consent.checked : []).toEqual(["Core record processing"]);
    expect(spec.submit?.endpoint).toBe("/api/v1/student-records/registry/enrol");
    expect(spec.steps?.length).toBe(4);
  });

  it("only offers the guardian questions that the chosen route needs", () => {
    const fields = enrolDrawer(enrol).steps?.[2].fields ?? [];
    expect(fields.find((field) => field.label === "Existing guardian")?.when).toEqual({ field: "Guardian", equals: "Link an existing guardian" });
    expect(fields.find((field) => field.label === "Phone")?.when).toEqual({ field: "Guardian", equals: "Add a new guardian" });
  });

  it("asks for a reason with every correction and shows the before and after to whoever decides", () => {
    expect(requestChangeDrawer(["Surname"], registry().rows).fields?.some((field) => field.label === "Why it matters" && field.required)).toBe(true);
    const item: ChangeItem = { id: "c-1", studentId: "s-1", student: "Daniel Yusuf", adm: "GFC/25/0001", field: "Surname", before: "Yusufu", after: "Yusuf", reason: "Birth certificate", evidence: null, by: { name: "Ngozi Eze", role: "Accountant" }, byId: "u-2", ownRequest: false, age: 2, hours: 48, at: "2026-10-10T00:00:00.000Z" };
    const spec = decideChangeDrawer(item);
    expect(JSON.stringify(spec.facts)).toContain("Yusufu");
    expect(spec.submit?.endpoint).toBe("/api/v1/student-records/changes/c-1/decide");
  });

  it("will not let someone decide a change they asked for", () => {
    const spec = decideChangeDrawer({ id: "c-2", studentId: "s-1", student: "Daniel", adm: "A", field: "Surname", before: "a", after: "b", reason: null, evidence: null, by: { name: "You", role: "Principal" }, byId: "u-1", ownRequest: true, age: 0, hours: 3, at: "" });
    expect(spec.submit).toBeUndefined();
    expect(spec.readOnly).toBe(true);
  });

  it("makes a collector without a photograph impossible", () => {
    const photo = collectorDrawer({ id: "s-1", name: "Daniel" }).fields?.find((field) => field.label === "Photograph file");
    expect(photo?.required).toBe(true);
  });

  it("logs the reason for opening a sensitive record", () => {
    const spec = sensitiveDrawer({ id: "s-1", name: "Daniel" });
    expect(spec.submit?.reasonRequired).toBe(true);
    expect(spec.submit?.endpoint).toBe("/api/v1/student-records/students/s-1/reveal");
  });

  it("maps a guardian either as a new one or one who already has children here", () => {
    const fresh = mapGuardianDrawer({ id: "s-1", name: "Daniel Yusuf" }, false, []);
    const linked = mapGuardianDrawer({ id: "s-1", name: "Daniel Yusuf" }, true, [{ id: "g-1", name: "Funke", phone: "0803", children: 1 }]);
    expect(fresh.fields?.some((field) => field.label === "Mobile number")).toBe(true);
    expect(linked.fields?.[0].kind).toBe("picker");
  });
});

function dossier(over: Partial<Dossier> = {}): Dossier {
  return {
    id: "s-1", name: "Daniel Yusuf", fullName: "Daniel Yusuf", initials: "DY", adm: "GFC/25/0001", status: "ACTIVE", state: "Enrolled", gender: "Male", dob: "2013-04-10T00:00:00.000Z", age: 13, nationality: "Nigerian", stateOfOrigin: null, language: "English", address: null, house: null, admitted: "2025-09-05T00:00:00.000Z", previousSchool: null,
    boarding: { is: false, where: null }, hasPhoto: false, portal: "Not activated", arm: { id: "a-1", name: "Nursery 2 A", level: "Nursery 2", capacity: 25 }, roll: 10, formMaster: null,
    term: { id: "t-2", name: "Second Term", session: "2025/2026", label: "Second Term 2025/2026" },
    attendance: { days: 21, present: 20, absent: 1, late: 0, excused: 0, pct: 95.2, sessions: [{ session: "2025/2026", terms: [{ term: "Second Term", days: 21, present: 20, absent: 1, late: 0, excused: 0, state: "In progress" }], days: 21, present: 20, absent: 1, late: 0, excused: 0, pct: 95.2, marked: 1 }], entries: [] },
    academic: { sheet: { avg: 69.2, total: 761, grade: "B", position: 6, outOf: 10, status: "PUBLISHED", passed: 7 }, subjects: [{ id: "sub-1", name: "Mathematics", category: "Core", teacher: null, dept: "—", total: 79, grade: "A", pos: 2, outOf: 10, classAvg: 68, standing: "Well above the class", state: "Published", components: [] }], scored: 1, strongest: { name: "Mathematics", total: 79 }, weakest: { name: "Mathematics", total: 79 }, history: [{ termId: "t-1", term: "First Term", session: "2025/2026", avg: 75.1, pos: 6, grade: "A", state: "Published", published: "2025-12-18T00:00:00.000Z", current: false }, { termId: "t-2", term: "Second Term", session: "2025/2026", avg: 69.2, pos: 6, grade: "B", state: "Published", published: "2026-04-08T00:00:00.000Z", current: true }], registration: { count: 1, track: "Registered with the arm's offering", fixed: false }, passMark: 40 },
    cards: [{ id: "rc-1", termId: "t-2", term: "Second Term", session: "2025/2026", avg: 69.2, pos: 6, grade: "B", state: "Published", published: "2026-04-08T00:00:00.000Z" }],
    wellbeing: { log: [], counselling: 0, visits: 0, health: null },
    family: { guardians: [], primaryId: null, consent: [{ code: "core", name: "Core record processing", required: true, status: "NOT_GIVEN", means: null, on: null }], collectors: [], sent: [], siblings: 0, guardianIds: [] },
    fees: { billed: 285000, paid: 160000, owing: 125000, state: "Part paid", days: 197, structures: ["JSS 2 Second Term Fees"], items: [{ name: "Tuition", amount: 200000, structure: "JSS 2 Second Term Fees", invoice: "INV-2026-001" }], invoices: [], receipts: [{ id: "p-1", ref: "RCT-2026-001", amount: 160000, mode: "Bank transfer", reference: "PAY-2026-001", at: "2026-04-03T00:00:00.000Z", term: "Second Term 2025/2026", by: "Ngozi Eze" }], familyId: "g-1" },
    records: { documents: [{ id: "m-1", label: "Birth certificate", source: "—", on: null, state: "Missing", file: "" }], missing: ["Birth certificate"], required: 5, changes: [], pending: 0, audit: [] },
    ...over,
  };
}

async function page(section: RecordSection, d: Dossier = dossier(), extra: Record<string, unknown> = {}) {
  apiGet.mockReset();
  apiGet.mockImplementation(async (url: string) => {
    if (url.includes("/results/")) return extra.result;
    if (url.includes("/students/")) return d;
    if (url.endsWith("/registry")) return registry();
    if (url.includes("guardians/options")) return { guardians: [] };
    throw new Error(`unexpected ${url}`);
  });
  const result = await studentRecordPage("s-1", section, { termId: extra.termId as string | undefined });
  return result ? markup(result.content) : "";
}

describe("M8 student record", () => {
  it("opens with the figures every tab behind it will confirm", async () => {
    const html = await page("overview");
    expect(html).toContain("95.2%");
    expect(html).toContain("₦125,000");
    expect(html).toContain("0 of 0");
  });

  it("names the form master it does not have, instead of inventing one", async () => {
    const html = await page("overview");
    expect(html).toContain("Nobody named");
  });

  it("lists what is not finished, each naming what it blocks", async () => {
    const html = await page("overview");
    expect(html).toContain("What is not finished on this record");
  });

  it("shows a term's result and links to its printed document", async () => {
    const html = await page("academic");
    expect(html).toContain("Results by term");
    expect(html).toContain("?term=t-1");
    expect((await page("report-cards")).includes("/print/result/s-1/t-2")).toBe(true);
  });

  it("tells a form master's missing remark apart from one never written", async () => {
    const result = { school: { name: "S", address: "", phone: "", email: "" }, student: { name: "Daniel", adm: "A", gender: "Male" }, attendance: { days: 1, present: 1, pct: 100 }, term: { id: "t-2", name: "Second Term", session: "2025/2026" }, arm: "Nursery 2 A", avg: 69.2, total: 761, grade: "B", position: 6, outOf: 10, status: "PUBLISHED", state: "Published", published: null, teacherComment: null, principalComment: "Satisfactory.", components: ["Exam"], subjects: [{ id: "x", name: "Maths", category: "Core", components: [{ name: "Exam", code: "E", order: 1, score: 50, max: 60 }], total: 50, grade: "C", classAvg: 60, standing: "Below the class" }] };
    const html = await page("academic", dossier(), { termId: "t-2", result });
    expect(html).toContain("Nothing was written for this term");
    expect(html).toContain("Satisfactory.");
  });

  it("explains a sensitive record without opening it", async () => {
    const html = await page("wellbeing");
    expect(html).toContain("Reveal the full record");
    expect(html).toContain("Sensitive");
  });

  it("says plainly that no guardian exists, and offers to map one", async () => {
    const html = await page("family");
    expect(html).toContain("No guardian is mapped to this child");
    expect(html).toContain("Link an existing guardian");
  });

  it("puts every receipt within reach of a reprint", async () => {
    const html = await page("fees");
    expect(html).toContain("/print/receipt/p-1");
    expect(html).toContain("never reissued");
  });

  it("lists the documents it is missing, and offers to record each", async () => {
    const html = await page("records");
    expect(html).toContain("Birth certificate");
    expect(html).toContain("Record it");
  });

  it("returns nothing for a student who is not there", async () => {
    apiGet.mockReset();
    apiGet.mockRejectedValue(new Error("404"));
    expect(await studentRecordPage("nobody", "overview")).toBeNull();
  });
});

function applicant(over: Partial<ApplicantRow> = {}): ApplicantRow {
  return { id: "ap-1", name: "Amara Okeke", gender: "Female", dob: "2014-04-08T00:00:00.000Z", ref: "ADM-1", forClass: "JSS 1", guardian: "Mrs Okeke", phone: "08034412201", screening: null, needsScreening: true, score: null, stage: "Applied", status: "SUBMITTED", days: 6, cycle: "2025/2026", cycleId: "c-1", feeCleared: false, duplicate: false, offerExpires: null, ...over };
}

const options: AdmissionOptions = { levels: ["JSS 1"], terms: ["Second Term 2025/2026"], staff: ["Mrs Adeniyi"], sessions: [] };

function board(over: Partial<AdmissionsBoard> = {}): AdmissionsBoard {
  return {
    cycle: "2025/2026",
    stages: [{ stage: "Enquiry", count: 0 }, { stage: "Applied", count: 1 }, { stage: "Assessed", count: 0 }, { stage: "Offered", count: 0 }, { stage: "Accepted", count: 0 }, { stage: "Enrolled", count: 1 }],
    rows: [applicant(), applicant({ id: "ap-2", name: "Tobi Adewale", ref: "ADM-2", stage: "Enrolled", needsScreening: false, status: "ENROLLED", score: 79 })],
    all: 2, closed: 0, sessions: [], holding: { needDate: 1, expiring: 0, noPhone: 0, toConvert: 0 }, conversion: 50, byClass: [{ name: "JSS 1", total: 2, enrolled: 1 }], cycles: [{ name: "2025/2026", enquiries: 2, applied: 2, offered: 1, enrolled: 1, rate: 50, open: true }], history: [],
    ...over,
  };
}

function applicantDetail(over: Partial<Applicant> = {}): Applicant {
  return {
    id: "ap-1", name: "Amara Okeke", gender: "Female", dob: "2014-04-08T00:00:00.000Z", ref: "ADM-1", forClass: "JSS 1", cycle: "2025/2026", stage: "Applied", stageIndex: 1, status: "REVIEWING", declined: false, waitlisted: false, days: 6, opened: "2026-09-02T00:00:00.000Z",
    next: { step: "fee", label: "Verify the application fee" }, feeCleared: false, guardian: { name: "Mrs Okeke", phone: "08034412201", email: null, secondName: null, secondPhone: null, address: null }, child: { previousSchool: null, medical: null },
    screening: null, offer: null, stages: ["Enquiry", "Applied", "Assessed", "Offered", "Accepted", "Enrolled"].map((name, index) => ({ name: name as Applicant["stages"][number]["name"], done: index <= 1, when: null, by: null, note: null })),
    documents: [{ label: "Birth certificate", source: "—", received: null, verified: false }], missingDocuments: ["Birth certificate"], said: [], placesLeft: 6, siblingInSchool: false, otherApplications: 0, student: null, duplicate: null, fee: { status: "PENDING", waived: false },
    ...over,
  };
}

describe("M8 Admissions", () => {
  it("reads each stage as a count that opens the list behind it", () => {
    const html = markup(admissionsTab(board(), options));
    expect(html).toContain("/student-records/admissions/pipeline/Applied");
    expect(html).toContain("1 awaiting a screening date");
  });

  it("says who is holding the cycle up", () => {
    const html = markup(admissionsTab(board(), options));
    expect(html).toContain("See who is holding this up");
  });

  it("never skips a stage: the drawer on an applicant asks only what the next real step asks", () => {
    expect(advanceDrawer(applicantDetail(), [])?.title).toBe("Verify the application fee");
    const review = advanceDrawer(applicantDetail({ status: "SUBMITTED", next: { step: "review", label: "Review the application" } }), []);
    expect(review?.fields?.[0].label).toBe("Review notes");
    expect(advanceDrawer(applicantDetail({ next: null }), [])).toBeNull();
  });

  it("converts to a student record by asking for an arm", () => {
    const spec = advanceDrawer(applicantDetail({ status: "FINANCIALLY_CLEARED", next: { step: "enrol", label: "Convert to a student record" } }), [{ name: "JSS 1 A" }]);
    expect(spec?.fields?.[0].label).toBe("Place them in");
    expect(spec?.submit?.body).toEqual({ step: "enrol" });
  });

  it("opens the applicant with the missing screening named as what blocks everything after it", () => {
    const html = markup(applicantPage(applicantDetail(), options, []).content);
    expect(html).toContain("No screening date has been booked for this child");
    expect(html).toContain("Request the missing ones");
  });

  it("offers a closed application a way back, and nothing else", () => {
    const content = applicantPage(applicantDetail({ stage: "Declined", declined: true, status: "REJECTED", next: null }), options, []).content;
    expect(content.primary?.label).toBe("Reopen this application");
  });

  it("sends the history page its own export", () => {
    const content = pipelinePage("History", { rows: board().rows, cycles: board().cycles, cycle: "2025/2026" }, options).content;
    expect(content.primary?.href).toBe("/student-records/admissions/export");
  });
});

describe("M8 Changes", () => {
  const changes = (over: Partial<Changes> = {}): Changes => ({ term: { name: "Second Term", session: "2025/2026", label: "Second Term 2025/2026" }, pending: [], approved: [], completeness: [{ key: "guardian", label: "No guardian contact", sub: "unreachable by any channel", count: 91, tone: "critical", items: [] }], duplicates: [], migration: null, total: 183, fields: ["Surname"], ...over });

  it("is honest that nothing is waiting", () => {
    const html = markup(changesTab(changes(), registry()));
    expect(html).toContain("Nothing is waiting on a decision");
  });

  it("counts what is incomplete across every check", () => {
    const html = markup(changesTab(changes(), registry()));
    expect(html).toContain("91");
    expect(html).toContain("No guardian contact");
  });

  it("does not pretend a migration happened", () => {
    const html = markup(changesTab(changes(), registry()));
    expect(html).toContain("No migration");
    expect(html).toContain("entered here, not migrated");
  });
});
