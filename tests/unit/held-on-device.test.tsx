// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { vi } from "vitest";

import { PanelRows } from "@/components/modules/panel-renderer";
import { row, type Panel } from "@/lib/modules/panels";
import { OUTBOX_KEYS } from "@/lib/offline/outbox";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/",
}));

/**
 * A figure that belongs to the device, not to the school.
 *
 * "Saved on this device" counts what one teacher's phone is still carrying — observations written
 * with no connection. The page is drawn on the server, which cannot know that, so the card is
 * authored at zero and corrected once the device has been read. Rendering a stale zero over work
 * that is actually waiting would be the one wrong answer here, because the teacher would think it
 * had gone.
 */

const held = (count: number) =>
  window.localStorage.setItem(
    OUTBOX_KEYS.OBSERVATION,
    JSON.stringify(Array.from({ length: count }, (_, index) => ({ clientId: `c${index}`, kind: "OBSERVATION", studentId: `st${index}`, capturedAt: new Date().toISOString(), label: "An observation", body: {} }))),
  );

const panel: Panel = {
  type: "kpi",
  per: 2,
  cards: [
    { label: "Observations this half-term", value: "9", sub: "Across 6 areas" },
    { label: "Saved on this device", value: "0", sub: "Written with no connection — sent when there is one", tone: "neutral", device: "OBSERVATION" },
  ],
};

describe("a figure read off the device", () => {
  beforeEach(() => window.localStorage.clear());

  it("says what this device is still holding, not what the server guessed", async () => {
    held(2);
    render(<PanelRows rows={[row("1fr", [panel])]} />);
    expect(await screen.findByText("2")).toBeTruthy();
    // the school's own figure beside it is untouched
    expect(screen.getByText("9")).toBeTruthy();
  });

  it("reads zero when nothing is waiting", async () => {
    render(<PanelRows rows={[row("1fr", [panel])]} />);
    expect(await screen.findByText("0")).toBeTruthy();
    expect(screen.queryByText("2")).toBeNull();
  });
});
