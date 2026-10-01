import { renderToStaticMarkup } from "react-dom/server";

import { PanelRows } from "@/components/modules/panel-renderer";
import type { ReportCardView } from "@/lib/domain/types";
import { archiveTab, completionTab, remarksTab } from "@/lib/modules/live/m6-report-cards";
import { directoryTab } from "@/lib/modules/live/m7-staff-access";
import type { TabContent } from "@/lib/modules/panels";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: () => {}, push: () => {}, replace: () => {} }),
  usePathname: () => "/",
}));

/**
 * The live builders turn an API payload into a tab. These exercise that
 * mapping directly, because the alternative — loading the page — proves the
 * dev server works rather than that the figures are right.
 *
 * The fixtures are shaped from what the endpoints actually returned against the
 * seeded school, not invented: a report card carries the remark fields the
 * workflow fills in, and a staff row carries the accountStatus the directory
 * colours by.
 */

function card(over: Partial<ReportCardView> = {}): ReportCardView {
  return {
    id: `rc-${Math.random().toString(36).slice(2, 8)}`,
    studentId: "stu-1",
    studentName: "Daniel Yusuf",
    className: "JSS 2 - Gold",
    term: "Second Term",
    status: "PUBLISHED",
    total: 553,
    average: 69.18,
    grade: "B",
    classTeacherRemark: "A steady term.",
    principalRemark: "Keep it up.",
    ...over,
  };
}

function markup(tab: TabContent): string {
  return renderToStaticMarkup(<PanelRows rows={tab.rows} />);
}

describe("M06 Report Cards", () => {
  it("counts a card as owing a remark when the field is blank, not just absent", () => {
    const cards = [
      card(),
      card({ studentName: "Esther Adewale", classTeacherRemark: "   " }),
      card({ studentName: "Ibrahim Salisu", classTeacherRemark: undefined }),
    ];

    const html = markup(remarksTab(cards));

    // Two of the three owe a class teacher's remark: one blank, one missing.
    expect(html).toContain("Esther Adewale");
    expect(html).toContain("Ibrahim Salisu");
    expect(html).not.toContain("Daniel Yusuf");
  });

  it("only lists cards that are actually waiting on somebody", () => {
    const complete = [card(), card({ studentName: "Fatima Bello" })];
    const html = markup(remarksTab(complete));

    expect(html).toContain("Every card has both remarks");
  });

  it("holds an arm back when a remark is missing, however many are published", () => {
    const cards = [
      card({ className: "JSS 1 - Silver", status: "PUBLISHED" }),
      card({ className: "JSS 1 - Silver", status: "PUBLISHED", classTeacherRemark: "" }),
    ];

    const html = markup(completionTab(cards));

    // One of the two is blocked, so the arm cannot read as finished.
    expect(html).toContain("Blocked");
    expect(html).not.toContain("1 / 1");
  });

  it("keeps an unpublished card out of the archive", () => {
    const cards = [
      card({ studentName: "Published Child", status: "PUBLISHED" }),
      card({ studentName: "Draft Child", status: "DRAFT" }),
      card({ studentName: "Locked Child", status: "LOCKED" }),
    ];

    const html = markup(archiveTab(cards));

    expect(html).toContain("Published Child");
    expect(html).toContain("Locked Child");
    expect(html).not.toContain("Draft Child");
  });
});

describe("M07 Staff & Access", () => {
  const person = (over: Record<string, unknown> = {}) => ({
    id: "sp-1",
    userId: "u-1",
    fullName: "Boma Hart",
    email: "teacher@greenfieldcollege.ng",
    phone: null,
    role: "TEACHER",
    roles: [],
    status: "ACTIVE",
    isActive: true,
    staffType: "ACADEMIC",
    employeeNo: "EMP-002",
    designation: null,
    departmentName: "Sciences",
    ...over,
  });

  it("reads a role as a title rather than a constant", () => {
    const html = markup(directoryTab([person({ role: "VICE_PRINCIPAL_ACADEMICS" }) as never]));
    expect(html).toContain("Vice Principal Academics");
    expect(html).not.toContain("VICE_PRINCIPAL_ACADEMICS");
  });

  it("counts a locked account as shut out, not merely inactive", () => {
    const staff = [
      person({ status: "ACTIVE" }),
      person({ id: "sp-2", fullName: "Locked Out", status: "LOCKED" }),
      person({ id: "sp-3", fullName: "Suspended One", status: "SUSPENDED" }),
    ];

    const html = markup(directoryTab(staff as never));
    // Two of three cannot sign in today.
    expect(html).toContain("Suspended or locked");
    expect(html).toContain("Cannot sign in today");
  });

  it("names the people with no department rather than only counting them", () => {
    const html = markup(directoryTab([person({ departmentName: null }) as never]));
    expect(html).toContain("Nothing to report them under");
  });
});
