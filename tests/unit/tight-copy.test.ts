import { describe, expect, it } from "vitest";

import { cut, isData, lead, segments, tightFor, tighten } from "@/lib/ui/tight-copy";

/**
 * The phone's copy rule, which decides what a small screen is told and what it is spared.
 *
 * The rule's whole value is that it never invents words: each case below checks that what comes back is the string itself, a piece
 * of the string, or nothing at all.
 */
describe("the phone’s copy rule", () => {
  it("leaves a line that already fits a phone exactly as it was", () => {
    const short = "Released since the last report card.";
    expect(tighten("bsub", short)).toBe(short);
    expect(tightFor(true, "bsub", "Marked absent")).toBe("Marked absent");
  });

  it("touches nothing at all on a laptop", () => {
    const long = "Every mark on this sheet is final, exactly as the school published it, and cannot be changed here.";
    expect(tightFor(false, "bsub", long)).toBe(long);
  });

  it("keeps the segments of a data line that fit, and drops the rest", () => {
    const line = "Second Term · Week 16 · 18 arms · 351 children · registers counted from Mon 23 Mar";
    const out = segments(line, 40);
    expect(out.startsWith("Second Term · Week 16")).toBe(true);
    expect(out.length).toBeLessThanOrEqual(40 + "Second Term".length);
    expect(line.startsWith(out.split(" · ")[0]!)).toBe(true);
  });

  it("tells a data line from prose", () => {
    expect(isData("Second Term · Week 16")).toBe(true);
    expect(isData("18 of 20")).toBe(true);
    expect(isData("the register decides the day")).toBe(false);
  });

  it("cuts a sentence at its seam, not mid-thought", () => {
    expect(cut("Pay the outstanding balance, so the report card is released")).toBe("Pay the outstanding balance");
    expect(cut("Held since 21 August — by the principal")).toBe("Held since 21 August");
    // too little before the seam to be worth keeping on its own, so it is left whole
    expect(cut("Pay it, so the card is released")).toBe("Pay it, so the card is released");
  });

  it("drops an instruction and keeps the sentence that says something", () => {
    expect(lead("Tap a row to open it. 12 arms are still unmarked.")).toBe("12 arms are still unmarked.");
  });

  it("prefers the sentence carrying the figure when asked for one", () => {
    expect(lead("The register is yours to mark. 18 of 20 are present.", true)).toBe("18 of 20 are present.");
  });

  it("drops a description a phone has no room for rather than truncating it", () => {
    const prose = "The whole school's day, arm by arm, as each form master recorded it on the morning register this term.";
    expect(tighten("head", prose)).toBe("");
  });

  it("keeps a note to one clause", () => {
    const note = "Your school has not made fee details visible to parents, so nothing is shown here until it does.";
    expect(tighten("note", note)).toBe("Your school has not made fee details visible to parents.");
  });

  it("uses the hand-written short form where the product has one", () => {
    expect(tighten("bsub", "Partners get their own login. This decides what they will see when they use it."))
      .toBe("What the partner sees");
  });

  it("rewrites a shape the product repeats, keeping its figures", () => {
    expect(tighten("foot", "This balance is 203 days old and two reminders have gone unanswered"))
      .toBe("203 days old · 2 reminders unanswered");
    expect(tighten("head", "Step 2 of 3 — choose the arms this applies to")).toContain("Step 2 of 3 · ");
  });

  it("never returns words that were not in the original", () => {
    const lines = [
      "Open an arm for its student list, or open the teacher to see everything they are responsible for.",
      "Each figure matches the attendance line on that term's report card.",
      "Latest report card and this term's released scores. Tap any subject to see how its score was reached.",
    ];
    for (const line of lines) {
      for (const rule of ["head", "bsub", "note", "tile", "opt"] as const) {
        const out = tighten(rule, line);
        if (!out) continue;
        // every word that survives came from the line it was made from
        const source = line.toLowerCase().replace(/[^a-z0-9’ ]/g, " ");
        for (const word of out.toLowerCase().replace(/[^a-z0-9’ ]/g, " ").split(/\s+/).filter(Boolean)) {
          expect(source).toContain(word);
        }
      }
    }
  });

  it("leaves a string below the floor alone, however it is ruled", () => {
    expect(tightFor(true, "head", "Nothing owed")).toBe("Nothing owed");
  });
});
