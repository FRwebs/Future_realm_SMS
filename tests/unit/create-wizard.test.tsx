import { renderToStaticMarkup } from "react-dom/server";

import { CreateWizard } from "@/components/modules/create-wizard";
import { buildBody } from "@/components/modules/module-drawer";
import { enrolDrawer } from "@/lib/modules/live/m8-forms";
import type { DrawerSpec, FormField } from "@/lib/modules/panels";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: () => {}, push: () => {}, replace: () => {} }), usePathname: () => "/" }));

const enrol = enrolDrawer({ admissionNumber: "GFC/26/0001", levels: ["JSS 1"], arms: [{ id: "a-1", name: "JSS 1 A", level: "JSS 1", seats: 5 }], terms: ["Second Term 2025/2026"], guardians: [] });

describe("The create page", () => {
  it("names every stage across the top and says what enrolment sets up before anything is entered", () => {
    const html = renderToStaticMarkup(<CreateWizard spec={enrol} />);
    for (const stage of ["Student", "Academic", "Family", "Review"]) expect(html).toContain(stage);
    expect(html).toContain("Step 1 of 4");
    expect(html).toContain("What enrolment sets up");
    expect(html).toContain("Nothing is written until the last step.");
  });

  it("starts on the first stage with Cancel, not Back", () => {
    const html = renderToStaticMarkup(<CreateWizard spec={enrol} />);
    expect(html).toContain("Cancel");
    expect(html).not.toContain(">Back<");
  });
});

describe("What a form sends", () => {
  const spec: DrawerSpec = { title: "Add a thing", submit: { endpoint: "/x", map: { Name: "name", Sensitive: "sensitive" } } };
  const fields = [
    { label: "Name", kind: "text" },
    { label: "Sensitive", kind: "static", value: "None exist yet" },
  ] as FormField[];

  it("never sends a line that only informs as if it were an answer", () => {
    expect(buildBody(spec.submit!, fields, { Name: "Ada", Sensitive: "None exist yet" }, "")).toEqual({ name: "Ada" });
  });

  it("sends the reason beside the answers when one was given", () => {
    expect(buildBody(spec.submit!, fields, { Name: "Ada" }, " Because ")).toEqual({ name: "Ada", reason: "Because" });
  });
});
