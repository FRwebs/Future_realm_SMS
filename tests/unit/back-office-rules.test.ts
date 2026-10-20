import { describe, expect, it } from "vitest";

import { moduleOfPath, RANK } from "../../backend/src/modules/team-access/access";
import { checkBands } from "../../backend/src/modules/config-library/templates.service";
import { contrastOnWhite } from "../../backend/src/modules/plans-features/branding";
import { fill } from "../../backend/src/modules/platform-policy/triggers";

const bands = (...rows: Array<[string, number, number]>) => rows.map(([grade, min, max]) => ({ grade, min, max, remark: "" }));

describe("a grading scale", () => {
  it("passes when it covers 0 to 100 once", () => {
    expect(checkBands(bands(["A", 70, 100], ["B", 50, 69], ["F", 0, 49]), 50)).toEqual([]);
  });

  it("is refused when a gap leaves some scores with no grade", () => {
    expect(checkBands(bands(["A", 70, 100], ["B", 50, 60], ["F", 0, 49]), 50).join(" ")).toMatch(/gap between B/);
  });

  it("is refused when bands overlap, start above 0, or stop short of 100", () => {
    expect(checkBands(bands(["A", 60, 100], ["B", 50, 65], ["F", 0, 49]), 50).join(" ")).toMatch(/overlap/);
    expect(checkBands(bands(["A", 70, 100], ["F", 5, 69]), 50).join(" ")).toMatch(/start at 0/);
    expect(checkBands(bands(["A", 70, 95], ["F", 0, 69]), 50).join(" ")).toMatch(/reach 100/);
  });

  it("is refused when the pass mark sits outside every band, or two bands share a grade", () => {
    expect(checkBands(bands(["A", 70, 100], ["F", 0, 69]), 120).join(" ")).toMatch(/pass mark/);
    expect(checkBands(bands(["A", 50, 100], ["A", 0, 49]), 50).join(" ")).toMatch(/share a grade/);
  });
});

describe("school branding", () => {
  it("measures how readable a colour is on white paper", () => {
    expect(contrastOnWhite("#000000")).toBeGreaterThan(15);
    expect(contrastOnWhite("#25593f")).toBeGreaterThan(3);
    expect(contrastOnWhite("#ffee99")).toBeLessThan(3);
  });
});

describe("Back Office access", () => {
  it("puts each API path in the module it belongs to", () => {
    expect(moduleOfPath("/api/super-admin/billing/concessions")).toBe("billing");
    expect(moduleOfPath("/api/super-admin/feature-flags/overrides")).toBe("plans");
    expect(moduleOfPath("/api/super-admin/audit-logs?limit=5")).toBe("security");
    expect(moduleOfPath("/api/super-admin/impersonate/abc")).toBe("schools");
    expect(moduleOfPath("/api/super-admin/my-work")).toBeNull();
    expect(moduleOfPath("/api/v1/dashboard")).toBeNull();
  });

  it("ranks the levels so Edit outranks View and Full outranks Edit", () => {
    expect(RANK.NONE).toBeLessThan(RANK.VIEW);
    expect(RANK.VIEW).toBeLessThan(RANK.EDIT);
    expect(RANK.EDIT).toBeLessThan(RANK.FULL);
  });
});

describe("a message template attached to a trigger", () => {
  it("fills its placeholders and leaves unknown ones visible", () => {
    expect(fill("{{school}} ends on {{endDate}}.", { school: "Greenfield", endDate: "1 Nov" })).toBe("Greenfield ends on 1 Nov.");
    expect(fill("Hello {{ school }} {{nobody}}", { school: "X" })).toBe("Hello X {{nobody}}");
  });
});
