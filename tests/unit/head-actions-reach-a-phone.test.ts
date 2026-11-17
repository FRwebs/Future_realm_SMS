import { describe, expect, it } from "vitest";

import { spilled } from "@/components/modules/module-workspace";
import type { PanelAction } from "@/lib/modules/panels";

const acts = (labels: string[]): PanelAction[] => labels.map((label) => ({ label, href: `/${label}` }) as PanelAction);

/**
 * A phone is never shown the head card, so an action that only lives there cannot be reached at
 * all — which is how the pages lifted out of Leave, Appraisal and Payroll would have been lost on
 * a phone. Every launcher reaches the panel strip; the ones the head already shows are marked so
 * a laptop hides them again rather than offering them twice.
 */
describe("the head's actions on a phone", () => {
  it("repeats what the head holds for the phone alone, and spills the rest to both", () => {
    const primary: PanelAction = { label: "Decide them" };
    const out = spilled(acts(["Leave policy", "Balances", "Export the register"]), primary);
    expect(out.map((act) => act.label)).toEqual(["Leave policy", "Balances", "Export the register"]);
    expect(out.map((act) => act.phoneOnly ?? false)).toEqual([true, false, false]);
  });

  it("keeps two for the head when there is no primary, and never a second dark button", () => {
    const out = spilled(acts(["KPI sets", "Moderate", "Export"]).map((act) => ({ ...act, primary: true })));
    expect(out.filter((act) => act.phoneOnly).map((act) => act.label)).toEqual(["KPI sets", "Moderate"]);
    expect(out.filter((act) => act.phoneOnly).every((act) => act.primary === false)).toBe(true);
  });

  it("has nothing to spill when a tab offers no launchers", () => {
    expect(spilled(undefined, { label: "Export for review" })).toEqual([]);
  });
});
