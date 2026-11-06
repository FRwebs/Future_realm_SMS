import { tightCopy, tightPanel } from "@/lib/ui/phone-copy";

describe("tight copy for a phone", () => {
  it("leaves a line that is already short exactly as it is", () => {
    expect(tightCopy("note", "Saved on this phone as you type.")).toBe("Saved on this phone as you type.");
    expect(tightCopy("rhint", "Marks close on Friday")).toBe("Marks close on Friday");
  });

  it("drops a sub line that only explains the title in prose", () => {
    expect(tightCopy("bsub", "Everything your child has been marked on this term is gathered here for you to read at your own pace.")).toBe("");
  });

  it("keeps a line of facts, trimmed to fit", () => {
    expect(tightCopy("bsub", "JSS 2 Gold · 34 on the register · 31 present today · 2 late · 1 away with a note from home")).toBe("JSS 2 Gold · 34 on the register · 31 present today · 2 late");
  });

  it("keeps a foot only when it carries a number", () => {
    expect(tightCopy("foot", "Every mark here is final once the school has published the term's results.")).toBe("");
    expect(tightCopy("foot", "Receipts for 3 payments are kept here until the end of the year, whatever happens.")).toMatch(/3 payments/);
  });

  it("ends a note at its first explanatory turn", () => {
    expect(tightCopy("note", "Your courses unlock once payment is confirmed — the receipt goes to your email address on file."))
      .toBe("Your courses unlock once payment is confirmed.");
  });

  it("only touches the supporting lines of a panel, and leaves the original alone", () => {
    const panel = {
      type: "list",
      title: "A title that is left exactly as it is, however long it runs on for",
      sub: "Everything your child has been marked on this term is gathered here for you to read at your own pace.",
      rows: [{ label: "Chemistry quiz", value: "18 / 20", sub: "Marked by Mrs Okafor and returned on Tuesday morning with comments" }]
    };
    const out = tightPanel(panel);
    expect(out.title).toBe(panel.title);
    expect(out.sub).toBe("");
    expect(out.rows[0].label).toBe("Chemistry quiz");
    expect(out.rows[0].value).toBe("18 / 20");
    expect(panel.sub).toMatch(/gathered here/);
  });
});
