import { clocksOf, type ParentMe } from "@/lib/modules/live/parent/shared";

const school = (now: string, place: string) => ({ id: place, name: place, short: place, currency: "NGN", timezone: "Africa/Lagos", today: "2026-11-03", now, place });
const me = (schools: ParentMe["schools"], now = "10:34") => ({ now, schools }) as unknown as ParentMe;

describe("the clocks a family reads", () => {
  it("is the one time for a family at one school, or at schools on the same clock", () => {
    expect(clocksOf(me([school("10:34", "Abuja")]))).toBe("10:34");
    expect(clocksOf(me([school("10:34", "Abuja"), school("10:34", "Ibadan")]))).toBe("10:34");
    expect(clocksOf(me(undefined))).toBe("10:34");
  });

  it("names each school's own time when they differ", () => {
    expect(clocksOf(me([school("10:34", "Abuja"), school("09:34", "Accra")]))).toBe("10:34 Abuja · 09:34 Accra");
  });
});
