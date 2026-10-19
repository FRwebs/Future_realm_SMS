import { renderToStaticMarkup } from "react-dom/server";

import { PanelRows } from "@/components/modules/panel-renderer";
import { complianceTab } from "@/lib/modules/live/m14-compliance";
import { insightsTab } from "@/lib/modules/live/m14-insights";
import { reportsTab } from "@/lib/modules/live/m14-reports";
import type { Compliance, Insights, ReportsOverview } from "@/lib/modules/live/m14-types";
import { supportTab, syncTab } from "@/lib/modules/live/m16-sync-support";
import type { SupportOverview, SyncOverview } from "@/lib/modules/live/m16-types";
import type { TabContent } from "@/lib/modules/panels";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: () => {}, push: () => {}, replace: () => {} }), usePathname: () => "/" }));
vi.mock("@/lib/api/server", () => ({ apiGet: async () => ({}) }));

const markup = (tab: Pick<TabContent, "rows">) => renderToStaticMarkup(<PanelRows rows={tab.rows} />);

const sync = (over: Partial<SyncOverview> = {}): SyncOverview => ({ pending: 0, oldestMinutes: null, devices: 0, synced: 0, lastSyncedAt: null, lastWriteAt: "2026-10-19T10:00:00Z", lastWriteMineAt: null, queue: [], conflicts: [], ...over });

describe("M16 Sync", () => {
  it("says plainly that nothing is waiting, rather than showing an empty table", () => {
    expect(markup(syncTab(sync()))).toContain("Nothing is waiting to reach the school");
  });

  it("names what is waiting, how old it is and whose device holds it", () => {
    const html = markup(syncTab(sync({ pending: 2, oldestMinutes: 120, devices: 1, queue: [{ type: "ATTENDANCE", count: 2, oldestMinutes: 120, who: "Boma Hart", role: "TEACHER", refused: false, message: null }] })));
    expect(html).toContain("Boma Hart");
    expect(html).toContain("Attendance");
  });

  it("shows both versions of a conflict and offers the choice", () => {
    const html = markup(syncTab(sync({ conflicts: [{ id: "c1", kind: "ATTENDANCE", record: "Register · JSS 1 A · 2026-10-19", school: { summary: "20 present · 2 absent", by: "Ada Obi", at: "2026-10-19T08:00:00Z" }, device: { summary: "18 present · 4 absent", by: "Boma Hart", at: "2026-10-19T07:40:00Z" }, differing: 2, deviceLabel: null }] })));
    expect(html).toContain("20 present · 2 absent");
    expect(html).toContain("18 present · 4 absent");
    expect(html).toContain("1 unresolved");
  });

  it("keeps the record's reason on an item it refused", () => {
    expect(markup(syncTab(sync({ pending: 1, oldestMinutes: 5, devices: 1, queue: [{ type: "SCORE_ENTRY", count: 1, oldestMinutes: 5, who: "Boma Hart", role: "TEACHER", refused: true, message: "This sheet is approved and final." }] })))).toContain("This sheet is approved and final.");
  });
});

const support = (over: Partial<SupportOverview> = {}): SupportOverview => ({ status: { ok: true, checkedAt: new Date().toISOString(), databaseMs: 3, uptimeMinutes: 30 }, articles: [], satisfaction: { average: null, responses: 0 }, tickets: { tickets: [], open: 0, waitingOnSchool: 0, breached: 0, resolved: 0 }, responseTarget: "4 working hours", ...over });

describe("M16 Help & Support", () => {
  it("answers 'is it my internet or the system' before anything else", () => {
    expect(markup(supportTab(support()))).toContain("All systems operational");
    expect(markup(supportTab(support({ status: { ok: false, checkedAt: new Date().toISOString(), databaseMs: 0, uptimeMinutes: 1 } })))).toContain("is not answering");
  });

  it("offers a ticket when no guide has been written for the role", () => {
    expect(markup(supportTab(support()))).toContain("Raise a ticket to ask for a guide");
  });
});

const reports = (): ReportsOverview => ({ kpis: { standard: 1, custom: 0, scheduled: 0, datasets: 1, exports: 0 }, standard: [{ code: "broadsheet", name: "Broadsheet", answers: "Students against subjects", covers: "What results are checked on", lastAt: null, lastBy: null }], definitions: [], datasets: [{ code: "students", name: "Students · full record", rows: 207, lastAt: null, lastBy: null }], recent: [], schedules: ["On demand"], datasetOptions: [{ code: "students", name: "Students · full record", columns: ["Arm", "Status"] }] });

describe("M14 Reports", () => {
  it("links each report to the generator that reads live records, and shows the real row counts", () => {
    const tab = reportsTab(reports());
    expect(JSON.stringify(tab)).toContain("/api/v1/analytics-reports/reports/generate/standard/broadsheet");
    expect(markup(tab)).toContain("207");
  });
});

const returns = (over: Partial<Compliance> = {}): Compliance => ({ stats: { tracked: 2, bodies: 2, dueSoon: 0, blocked: 1, ready: 1, filed: 0, nextDays: 40 }, returns: [{ id: "r1", name: "Termly enrolment return", body: "SUBEB", period: "Second Term", dueOn: "2026-11-27T00:00:00Z", days: 40, format: "CSV", covers: "Enrolment", status: "NOT_STARTED", filedOn: null, ownerRole: "Registrar", ready: true, blocker: null }, { id: "r2", name: "Examination entry file", body: "WAEC", period: "2026/2027", dueOn: "2027-01-27T00:00:00Z", days: 100, format: "Fixed width", covers: "Candidates", status: "BLOCKED", filedOn: null, ownerRole: "Exam Officer", ready: false, blocker: "208 student photographs" }], gaps: [{ what: "Student photographs", count: 208, blocks: "Examination entry file", fix: "Student Records · Registry" }], archive: [], ...over });

describe("M14 Compliance", () => {
  it("names the return a gap blocks, so the gap has a consequence", () => {
    const html = markup(complianceTab(returns()));
    expect(html).toContain("1 return cannot be produced");
    expect(html).toContain("208 student photographs");
  });

  it("only offers to generate a return that can be produced today", () => {
    const tab = complianceTab(returns());
    expect(tab.primary?.label).toBe("Generate a return");
    expect(JSON.stringify(tab)).toContain("/api/v1/analytics-reports/compliance/r1/run");
    expect(JSON.stringify(tab)).not.toContain("/compliance/r2/run");
  });
});

describe("M14 Insights", () => {
  it("says so when a figure has nothing behind it, rather than showing zero", () => {
    const empty: Insights = { term: null, kpis: { average: null, averageMove: null, results: 0, attendance: null, attendanceMove: null, collection: null, collectionMove: null, billed: 0, portal: { activated: 0, guardians: 0, never: 0, pct: null }, growth: { admitted: 0, left: 0, net: 0 } }, grades: [], failing: null, scheme: "", correlation: [], subjects: [], weekdays: [], financial: { billed: 0, outstanding: 0, aged: 0, agedInvoices: 0, agedFamilies: 0, discounts: 0, discountRules: 0, discountPct: null }, engagement: { signedIn30: 0, activated: 0, signedInPct: null, channels: [], unreachable: 0, worst: null } };
    const html = markup(insightsTab(empty));
    expect(html).toContain("No result has been computed yet");
    expect(html).toContain("Not kept");
  });
});
