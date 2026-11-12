import { describe, expect, it } from "vitest";

import { ApiRequestError, isRefusal } from "@/lib/api/server";

/**
 * Telling "you may not see this" apart from "this is broken".
 *
 * The back office's cockpit is one page shared by every internal role, and several of its panels
 * read things a given role is deliberately not given. Before this, one of those refusals threw the
 * whole page away — a Support Agent saw "Something went wrong" instead of their own queue. The
 * page can only survive a refusal if it can recognise one, and it must not use the same escape to
 * swallow a genuine failure.
 */
describe("a read the API turned down", () => {
  it("carries the status and the path it was refused on", () => {
    const refused = new ApiRequestError("This platform role cannot perform this action. (status 403)", 403, "/api/super-admin/security");
    expect(refused.status).toBe(403);
    expect(refused.path).toBe("/api/super-admin/security");
    expect(refused).toBeInstanceOf(Error);
  });

  it("counts a refusal as something a page may live without", () => {
    expect(isRefusal(new ApiRequestError("forbidden", 403, "/p"))).toBe(true);
    expect(isRefusal(new ApiRequestError("not found", 404, "/p"))).toBe(true);
  });

  it("counts anything else as a failure, so it is still thrown", () => {
    expect(isRefusal(new ApiRequestError("server error", 500, "/p"))).toBe(false);
    expect(isRefusal(new ApiRequestError("bad gateway", 502, "/p"))).toBe(false);
    expect(isRefusal(new ApiRequestError("bad request", 400, "/p"))).toBe(false);
    // a fault that never reached the API at all — a parse failure, a dropped connection
    expect(isRefusal(new Error("Failed to parse JSON response"))).toBe(false);
    expect(isRefusal(new TypeError("fetch failed"))).toBe(false);
    expect(isRefusal(undefined)).toBe(false);
    expect(isRefusal("403")).toBe(false);
  });
});
