import { agreementBlocks } from "@/lib/domain/agreement-text";
import { STANDARD_DPA_TEXT } from "../../backend/src/common/dpa";

describe("an agreement read one clause at a time", () => {
  it("splits the standard wording into its numbered clauses, without repeating the title", () => {
    const blocks = agreementBlocks(STANDARD_DPA_TEXT);
    expect(blocks).toHaveLength(11);
    expect(blocks[0]).toMatchObject({ label: "1. The parties" });
    expect(blocks[0]!.body).toMatch(/the school \("the Controller"\)/i);
    expect(blocks.map((block) => block.label)).toContain("7. Personal data breaches");
    expect(blocks.some((block) => /^DATA PROCESSING AGREEMENT$/i.test(block.body))).toBe(false);
  });

  it("keeps text that does not follow the pattern whole, rather than guessing", () => {
    expect(agreementBlocks("One paragraph\nover two lines.")).toEqual([{ label: "", body: "One paragraph over two lines." }]);
    expect(agreementBlocks("")).toEqual([]);
  });
});
