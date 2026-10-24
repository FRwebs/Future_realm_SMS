import { deviceName, hide } from "../../backend/src/modules/student-portal/student-workspace.service";

/**
 * The student account page's "Signed in on" list.
 *
 * Both of these exist so a 15-year-old can answer one question — "is that me?"
 * — without being shown a user-agent string or a full IP address. A device they
 * cannot name is a device they cannot decide about, and an address shown in full
 * is more than they need and more than we should print.
 */

describe("naming a device from its user agent", () => {
  it("names a browser and the thing it is running on", () => {
    expect(deviceName("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36")).toBe("Chrome on Mac");
    expect(deviceName("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1")).toBe("Safari on iPhone or iPad");
    expect(deviceName("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/151.0.0.0 Safari/537.36 Edg/151.0.0.0")).toBe("Edge on Windows");
    expect(deviceName("Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/150.0.0.0 Mobile Safari/537.36")).toBe("Chrome on Android");
  });

  it("prefers the real browser over the compatibility token every browser carries", () => {
    // Every one of these ends in "Safari/537.36". Reading left to right would
    // call Chrome and Edge "Safari".
    expect(deviceName("Mozilla/5.0 (Macintosh) AppleWebKit/537.36 Chrome/152.0.0.0 Safari/537.36")).toBe("Chrome on Mac");
    expect(deviceName("Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36 Chrome/151.0.0.0 Safari/537.36 Edg/151.0")).toBe("Edge on Windows");
  });

  it("says plainly when a sign-in was not a person at a browser", () => {
    expect(deviceName("curl/8.7.1")).toBe("A script");
  });

  it("does not invent a name it does not have", () => {
    expect(deviceName(null)).toBe("Unknown device");
    expect(deviceName("")).toBe("Unknown device");
    // Something unrecognised is shown as itself, trimmed — never guessed at.
    expect(deviceName("SomeNewThing/1.0")).toBe("SomeNewThing/1.0");
  });
});

describe("hiding part of the address a device signed in from", () => {
  it("keeps the first half of an IPv4 address and hides the rest", () => {
    expect(hide("102.89.23.117")).toBe("102.89.•.•");
    expect(hide("127.0.0.1")).toBe("127.0.•.•");
  });

  it("keeps only the first two groups of an IPv6 address", () => {
    expect(hide("2001:db8:85a3:8d3:1319:8a2e:370:7348")).toBe("2001:db8:•");
  });

  it("returns nothing at all when no address was recorded", () => {
    expect(hide(null)).toBe("");
    expect(hide(undefined)).toBe("");
    expect(hide("")).toBe("");
  });
});
