import { chartFloor, chartTicks, chartX, chartY } from "../../src/components/modules/line-chart";
import { termShort } from "../../src/lib/modules/panels";

/**
 * The scale behind every line chart in this product.
 *
 * The whole point of this chart is that it does not start at zero. A term of
 * attendance lives between about 85% and 100%, and a 0–100 axis squashes all of
 * it into the top sixth of the panel, where a term at 88% and a term at 97%
 * look the same. The floor is what buys back that resolution, so these are the
 * numbers worth pinning down — they are easy to "simplify" into a plain
 * zero-based axis without anyone noticing the chart stopped saying anything.
 */

describe("where the scale starts", () => {
  it("drops to the round 5% below the lowest point", () => {
    expect(chartFloor([90, 100, 95])).toBe(85);
    expect(chartFloor([88, 92])).toBe(80);
    expect(chartFloor([97, 99, 100])).toBe(85);
  });

  it("starts at zero when a point is genuinely near it", () => {
    // A single day reads 100 (present) or 0 (away). Lifting the floor there
    // would draw an absence as though it were a near miss.
    expect(chartFloor([0, 100, 100])).toBe(0);
    expect(chartFloor([49])).toBe(0);
  });

  it("never rises above 85, so the 95% target line stays on the chart", () => {
    expect(chartFloor([100])).toBe(85);
    expect(chartFloor([100, 100, 100])).toBe(85);
    expect(chartY(95, chartFloor([100]))).toBeLessThan(100);
  });

  it("assumes a middling term when there is nothing to draw yet", () => {
    expect(chartFloor([])).toBe(85);
  });
});

describe("a measure that is not a percentage", () => {
  it("steps the floor by the same proportion of whatever the ceiling is", () => {
    // A term average out of 20. 17.4 is 87% of the scale, and 87 floors to 80
    // on a 100 scale — so this must floor to 16, which is 80% of 20.
    expect(chartFloor([17.4, 19, 18.2], 20)).toBe(16);
    expect(chartFloor([87, 95, 91], 100)).toBe(80);
    expect(chartY(20, 16, 20)).toBeCloseTo(8, 5);
    expect(chartY(16, 16, 20)).toBeCloseTo(92, 5);
  });

  it("lands a value in the same place on either scale", () => {
    // The whole point of carrying a ceiling: a figure and its percentage
    // equivalent are drawn at the same height.
    expect(chartY(18, chartFloor([17.4, 19, 18.2], 20), 20)).toBeCloseTo(chartY(90, chartFloor([87, 95, 91], 100), 100), 5);
  });

  it("still drops to zero when a point is near the bottom of its own scale", () => {
    expect(chartFloor([2, 18], 20)).toBe(0);
  });

  it("labels its ticks on its own scale", () => {
    expect(chartTicks(16, 20)).toEqual([20, 18, 16]);
    expect(chartTicks(0, 20)).toEqual([20, 10, 0]);
  });
});

describe("placing a value on the plot", () => {
  it("puts the top of the scale near the top and the floor near the bottom", () => {
    expect(chartY(100, 85)).toBeCloseTo(8, 5);
    expect(chartY(85, 85)).toBeCloseTo(92, 5);
  });

  it("leaves room above for the figure and below for the axis", () => {
    // 8% of head room and 8% of foot room: a figure sits 20px above its point.
    expect(chartY(100, 0)).toBeCloseTo(8, 5);
    expect(chartY(0, 0)).toBeCloseTo(92, 5);
  });

  it("spreads a lifted floor across the full height", () => {
    // The midpoint of the scale lands at the midpoint of the plot, whatever
    // the floor is — this is what a lifted floor buys.
    expect(chartY(92.5, 85)).toBeCloseTo(50, 5);
    expect(chartY(50, 0)).toBeCloseTo(50, 5);
  });
});

describe("placing a point across the plot", () => {
  it("runs the series from just inside one edge to just inside the other", () => {
    expect(chartX(0, 5)).toBeCloseTo(3, 5);
    expect(chartX(4, 5)).toBeCloseTo(97, 5);
    expect(chartX(2, 5)).toBeCloseTo(50, 5);
  });

  it("centres a lone point rather than pinning it to the axis", () => {
    // A student with one term on record should not have it drawn in the corner.
    expect(chartX(0, 1)).toBe(50);
  });
});

describe("the figures down the side", () => {
  it("shows the top, the floor and the midpoint between them", () => {
    expect(chartTicks(85)).toEqual([100, 93, 85]);
    expect(chartTicks(80)).toEqual([100, 90, 80]);
  });

  it("uses a plain 100/50/0 when the scale starts at zero", () => {
    expect(chartTicks(0)).toEqual([100, 50, 0]);
  });

  it("puts each tick where its own value falls", () => {
    for (const floor of [0, 75, 85]) {
      for (const tick of chartTicks(floor)) {
        expect(chartY(tick, floor)).toBeCloseTo(chartY(tick, floor), 5);
      }
      expect(chartY(chartTicks(floor)[0]!, floor)).toBeCloseTo(8, 5);
      expect(chartY(chartTicks(floor)[2]!, floor)).toBeCloseTo(92, 5);
    }
  });
});

describe("naming a term on a chart axis", () => {
  it("shortens a term and its session the way the mockup's axes do", () => {
    expect(termShort("Second Term", "2025/2026")).toBe("T2 25/26");
    expect(termShort("First Term", "2024/2025")).toBe("T1 24/25");
    expect(termShort("Third Term", "2025/2026")).toBe("T3 25/26");
  });

  it("leaves a term it does not recognise readable rather than blank", () => {
    expect(termShort("Summer", "2025/2026")).toBe("Summer 25/26");
    expect(termShort("Second Term", "Michaelmas")).toBe("T2 Michaelmas");
  });
});
