import { NAV_REGISTRY } from "@/lib/navigation/registry";
import { uiKey } from "@/i18n/ui-key";
import en from "@/messages/en.json";

const known = new Set(Object.keys(en.ui));

describe("the words around the pages", () => {
  it("files every navigation entry and section title under a translatable key", () => {
    const missing = [...new Set(NAV_REGISTRY.flatMap((item) => [item.label, item.group ?? ""]))].filter((text) => text && !known.has(uiKey(text)));
    expect(missing).toEqual([]);
  });

  it("builds a key from what a label says, the same way on server and browser", () => {
    expect(uiKey("Class & Timetable")).toBe("class_timetable");
    expect(uiKey("Tell the school")).toBe("tell_the_school");
    expect(uiKey("  Security & audit ")).toBe("security_audit");
  });
});
