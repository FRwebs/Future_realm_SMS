import { z } from "zod";

import { sayWhatIsWrong } from "../../backend/src/common/api-exception.filter";

describe("what a refused input says", () => {
  it("names the field and what is wrong, not the validator's report", () => {
    const result = z.object({ email: z.string().email(), name: z.string().min(2) }).safeParse({ email: "nope", name: "A" });
    expect(result.success).toBe(false);
    const said = sayWhatIsWrong((result as { error: z.ZodError }).error);
    expect(said).toContain("email:");
    expect(said).toContain("name:");
    expect(said).not.toContain("{");
  });

  it("says how many more there are past the first three", () => {
    const result = z.object({ a: z.string(), b: z.string(), c: z.string(), d: z.string(), e: z.string() }).safeParse({});
    expect(sayWhatIsWrong((result as { error: z.ZodError }).error)).toMatch(/\(and 2 more\)$/);
  });
});
