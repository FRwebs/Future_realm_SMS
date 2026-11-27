import { describe as suite, expect, it } from "vitest";

import { describe } from "@/components/modules/module-drawer";
import { addSubjectDrawer } from "@/lib/modules/live/m3-forms";
import type { Overview, Teaching } from "@/lib/modules/live/m3-types";

const teaching = { teachers: [], catalogue: [{ id: "s1", name: "Civic", code: "CIV", category: "Core", department: null, choiceGroup: "Trade · pick exactly 1" }] } as unknown as Teaching;
const overview = { classes: [{ id: "l1", name: "JSS 1", arms: 2 }, { id: "l2", name: "SSS 1", arms: 1 }, { id: "l3", name: "Empty", arms: 0 }] } as unknown as Overview;

suite("the Add subject form", () => {
  const spec = addSubjectDrawer(teaching, overview);
  const fields = spec.fields ?? [];
  const field = (label: string) => fields.find((item) => item.label === label);

  it("asks the mockup's questions in the mockup's order", () => {
    expect(fields.map((item) => item.label)).toEqual([
      "Subject name", "Code", "Category", "Offer to", "Teacher", "Counts to the average", "Choice group", "Available for registration this term",
    ]);
  });

  it("makes the category an answer to give, not a default already chosen", () => {
    const category = field("Category");
    expect(category).toMatchObject({ kind: "select", value: "Select…", required: true });
  });

  it("offers Yes and No for the average, and keeps the school's own choice groups beside the stock ones", () => {
    expect(field("Counts to the average")).toMatchObject({ kind: "choice", options: ["Yes", "No"] });
    const group = field("Choice group");
    expect(group).toMatchObject({ kind: "select", value: "None" });
    expect((group as { options: string[] }).options).toEqual(["None", "Trade · pick exactly 1", "Language · pick at least 1"]);
  });

  it("offers it only to classes that have arms, and can be taken back", () => {
    expect((field("Offer to") as { options: string[] }).options).toEqual(["JSS 1", "SSS 1"]);
    expect(spec.undo?.endpoint).toContain("/teaching/subject/{id}/undo");
  });

  it("sends the choice group, the hold on registration and the average in the words the server reads", () => {
    expect(spec.submit?.encode?.["Counts to the average"]).toEqual({ Yes: "true", No: "false" });
    expect(spec.submit?.encode?.["Choice group"]).toEqual({ None: "" });
    expect(spec.submit?.map?.["Available for registration this term"]).toBe("registrationOpen");
  });
});

suite("reading a form back before it is saved", () => {
  it("says a switch in the words it carried on the form", () => {
    const switchField = { label: "Available", kind: "toggle", onLabel: "Available now", offLabel: "From next term" } as const;
    expect(describe(switchField, true)).toBe("Available now");
    expect(describe(switchField, false)).toBe("From next term");
    expect(describe({ label: "Plain", kind: "toggle" }, true)).toBe("Yes");
  });
});
