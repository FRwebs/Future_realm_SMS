import { renderToStaticMarkup } from "react-dom/server";

import { PanelRows } from "@/components/modules/panel-renderer";
import { row } from "@/lib/modules/panels";
import type { Panel } from "@/lib/modules/panels";

/**
 * A route that hands back a file is not somewhere the client router can go.
 *
 * Asked through a Next link it fetches, finds no page and does nothing — which is how "Export the
 * day" came to be a button that downloaded nothing at all. Marked `download`, it is drawn as a
 * plain anchor the browser saves.
 */
describe("a link that hands back a file", () => {
  const panel = (download?: boolean): Panel => ({
    type: "list",
    title: "Exports",
    items: [{ label: "The day" }],
    acts: [{ label: "Export the day", href: "/attendance/register/export?from=2026-04-17", ...(download ? { download: true } : {}) }],
  });

  it("is a plain anchor the browser downloads, not a route the client router opens", () => {
    const html = renderToStaticMarkup(<PanelRows rows={[row("1fr", [panel(true)])]} />);
    expect(html).toContain('download=""');
    expect(html).toContain("/attendance/register/export?from=2026-04-17");
  });

  it("is an ordinary link when it goes to a page", () => {
    const html = renderToStaticMarkup(<PanelRows rows={[row("1fr", [panel()])]} />);
    expect(html).not.toContain('download=""');
    expect(html).toContain("/attendance/register/export?from=2026-04-17");
  });
});
