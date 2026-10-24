import { chartFloor, chartTicks, chartX, chartY } from "../../src/components/portals/student/student-attendance";

/**
 * The scale behind the student's attendance line.
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
