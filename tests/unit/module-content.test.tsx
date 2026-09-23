import { renderToStaticMarkup } from "react-dom/server";

import { PanelRows } from "@/components/modules/panel-renderer";
import { accountContent, accountTabs } from "@/lib/modules/account";
import { moduleContent } from "@/lib/modules/content";
import type { PanelRow } from "@/lib/modules/panels";
import { schoolModules } from "@/lib/modules/school-modules";

describe("module content", () => {
  it("registers content for every tab of every module", () => {
    for (const module of schoolModules) {
      for (const tab of module.tabs) {
        const content = moduleContent[module.code]?.[tab.slug];
        expect(content, `${module.slug}/${tab.slug}`).toBeDefined();
        expect(content!.rows.length, `${module.slug}/${tab.slug}`).toBeGreaterThan(0);
      }
    }
  });

  it("renders every tab without throwing", () => {
    for (const module of schoolModules) {
      for (const tab of module.tabs) {
        const content = moduleContent[module.code]![tab.slug]!;
        const html = renderToStaticMarkup(<PanelRows rows={content.rows} />);
        expect(html.length, `${module.slug}/${tab.slug}`).toBeGreaterThan(0);
      }
    }
  });

  it("renders the account page's tabs", () => {
    for (const tab of accountTabs) {
      const content = accountContent[tab.slug];
      expect(content, tab.slug).toBeDefined();
      expect(renderToStaticMarkup(<PanelRows rows={content!.rows} />).length).toBeGreaterThan(0);
    }
  });

  it("carries Command Center's real content through to the markup", () => {
    const today = renderToStaticMarkup(<PanelRows rows={moduleContent.m1!.today!.rows} />);
    for (const probe of ["My actions", "Term progress", "Chemistry SSS 2A", "94.2%"]) {
      expect(today, probe).toContain(probe);
    }

    // Every student record: 1,557 on an arm plus 3 in no arm. Attendance shows
    // the roll (1,557) instead, because a child in no arm is in no register.
    expect(today).toContain("1,560");

    const oversight = renderToStaticMarkup(<PanelRows rows={moduleContent.m1!.oversight!.rows} />);
    for (const probe of ["Quietly rotting", "Delegated work", "Civic Education", "1,433"]) {
      expect(oversight, probe).toContain(probe);
    }
  });

  it("carries Attendance's four tabs through to the markup", () => {
    const register = renderToStaticMarkup(<PanelRows rows={moduleContent.m4!.register!.rows} />);
    expect(register).toContain("Every arm, today");
    expect(register).toContain("Guardian explanations");
    expect(register).toContain("Emeka Okafor");
    // Derived from the shared arm table, so it matches Command Center.
    expect(register).toContain("1,557");

    const mark = renderToStaticMarkup(<PanelRows rows={moduleContent.m4!.mark!.rows} />);
    expect(mark).toContain("Choose an arm to mark");
    expect(mark).toContain("Marking is normally the form master&#x27;s job");

    const compliance = renderToStaticMarkup(<PanelRows rows={moduleContent.m4!.compliance!.rows} />);
    expect(compliance).toContain("Breaches by teacher");
    expect(compliance).toContain("Unmarked registers");
    expect(compliance).toContain("Backdated entries");

    const log = renderToStaticMarkup(<PanelRows rows={moduleContent.m4!.log!.rows} />);
    expect(log).toContain("Trend by arm");
    expect(log).toContain("Students needing attention");
    expect(log).toContain("Aisha Mohammed");
    expect(log).toContain("What the rules are");
  });

  it("carries the ported modules' real content through to the markup", () => {
    const probes: Record<string, [string, string[]]> = {
      // module code → [tab slug, phrases the mockup puts on it]
      m5: ["review", ["By arm", "Submission tracker", "Verification", "Nobody named"]],
      m6: ["completion", ["Report cards by arm", "What is holding the school up", "How publishing works here"]],
      m8: ["registry", ["Every student", "No class arm", "Admission no"]],
      m9: ["guardians", ["Every family", "never activated the portal", "Phone only"]],
      m10: ["collections", ["Payments received", "Debtor list", "GIA/RCP/26/1843"]],
      m13: ["queue", ["Waiting on me", "Raised by me", "Chemistry SSS 2A"]],
    };

    for (const [code, [tabSlug, phrases]] of Object.entries(probes)) {
      const html = renderToStaticMarkup(<PanelRows rows={moduleContent[code]![tabSlug]!.rows} />);
      for (const phrase of phrases) {
        expect(html, `${code}/${tabSlug} → ${phrase}`).toContain(phrase);
      }
    }
  });

  it("keeps every ported module's figures tied to the shared school data", () => {
    // Score Entry and Report Cards both describe the same 42 arms, so their
    // arm counts have to agree with the arm table itself.
    const results = renderToStaticMarkup(<PanelRows rows={moduleContent.m5!.results!.rows} />);
    expect(results).toContain("42 arms");
    // 1,540 computed of 1,557 on a roll — the 17 blocked on a missing score.
    expect(results).toContain("1,540");
    expect(results).toContain("1,557");

    const completion = renderToStaticMarkup(<PanelRows rows={moduleContent.m6!.completion!.rows} />);
    expect(completion).toContain("42 arms clear");
  });

  it("renders every arm of the school on the register", () => {
    const register = renderToStaticMarkup(<PanelRows rows={moduleContent.m4!.register!.rows} />);
    for (const arm of ["Nursery 1A", "Primary 3B", "JSS 2A", "SSS 3C"]) {
      expect(register, arm).toContain(arm);
    }
  });

  it("states what belongs on a tab that is not built yet", () => {
    // An unbuilt tab must say so and name the mockup's panels, rather than
    // rendering empty and reading as finished.
    // M02 School Configuration is not ported yet.
    const html = renderToStaticMarkup(<PanelRows rows={moduleContent.m2!.profile!.rows} />);
    expect(html).toContain("Not built yet");
    expect(html).toContain("Identity");
  });

  it("links only to module paths that exist", () => {
    const validPaths = new Set(
      schoolModules.flatMap((module) => module.tabs.map((tab) => `/${module.slug}/${tab.slug}`)),
    );

    const hrefs = new Set<string>();
    for (const module of schoolModules) {
      for (const tab of module.tabs) {
        const html = renderToStaticMarkup(<PanelRows rows={moduleContent[module.code]![tab.slug]!.rows} />);
        for (const match of html.matchAll(/href="(\/[^"]*)"/g)) hrefs.add(match[1]!);
      }
    }

    expect(hrefs.size).toBeGreaterThan(0);
    for (const href of hrefs) {
      expect(validPaths.has(href), `dangling link: ${href}`).toBe(true);
    }
  });
});

describe("triggers", () => {
  /** Every control the content declares, with where it points. */
  function triggersIn(rows: PanelRow[]) {
    const found: Array<{ what: string; wired: boolean }> = [];
    const note = (what: string, t: { href?: string; drawer?: unknown }) =>
      found.push({ what, wired: Boolean(t.href || t.drawer) });

    for (const panelRow of rows) {
      for (const panel of panelRow.panels) {
        if ("acts" in panel) {
          for (const act of panel.acts ?? []) note(`${panel.title} · ${act.label}`, act);
        }
        if (panel.type === "table") {
          for (const act of panel.bulkActs ?? []) note(`${panel.title} · bulk · ${act.label}`, act);
          for (const tableRow of panel.rows) {
            for (const cell of tableRow.cells) {
              if (cell.kind === "action") note(`${panel.title} · ${cell.label}`, cell);
            }
          }
        }
        if (panel.type === "tiles") {
          for (const tile of panel.tiles) note(`${panel.title} · ${tile.label}`, tile);
        }
        if (panel.type === "blockers") {
          for (const item of panel.items) note(`${panel.title} · ${item.action}`, item);
        }
        if (panel.type === "list") {
          for (const item of panel.items) {
            note(`${panel.title} · ${item.label}`, {
              href: item.href,
              drawer: item.drawer ?? (item.facts?.length ? {} : undefined),
            });
          }
        }
      }
    }
    return found;
  }

  /** Every drawer behind a named action in a named table. */
  function actionDrawers(rows: PanelRow[], tableTitle: string, label: string) {
    const found: unknown[] = [];
    for (const panelRow of rows) {
      for (const panel of panelRow.panels) {
        if (panel.type !== "table" || panel.title !== tableTitle) continue;
        for (const tableRow of panel.rows) {
          for (const cell of tableRow.cells) {
            if (cell.kind === "action" && cell.label === label && cell.drawer) {
              found.push(cell.drawer);
            }
          }
        }
      }
    }
    return found;
  }

  it("leaves no trigger on Command Center inert", () => {
    for (const tabSlug of ["today", "oversight"]) {
      const tab = moduleContent.m1![tabSlug]!;
      const triggers = triggersIn(tab.rows);

      expect(triggers.length, tabSlug).toBeGreaterThan(10);

      // Bulk actions act on a selection the page holds, so they are the one
      // control that legitimately carries no destination of its own.
      const dead = triggers.filter((t) => !t.wired && !t.what.includes("· bulk ·"));
      expect(dead.map((t) => t.what), `${tabSlug} has unwired triggers`).toEqual([]);
    }
  });

  it("gives both Command Center tabs a header action", () => {
    for (const tabSlug of ["today", "oversight"]) {
      const tab = moduleContent.m1![tabSlug]!;
      expect(tab.primary, tabSlug).toBeDefined();
      expect(Boolean(tab.primary!.href || tab.primary!.drawer), tabSlug).toBe(true);

      for (const launcher of tab.launchers ?? []) {
        expect(Boolean(launcher.href || launcher.drawer), launcher.label).toBe(true);
      }
    }
  });

  it("opens the same decision from Command Center and from the queue", () => {
    // One decision, one definition: a record has to read the same wherever it
    // is reached from.
    const fromCommandCenter = actionDrawers(moduleContent.m1!.today!.rows, "My actions", "Decide");
    const fromQueue = actionDrawers(moduleContent.m13!.queue!.rows, "Waiting on me", "Decide");

    expect(fromCommandCenter.length).toBe(6);
    expect(fromQueue.length).toBe(6);
    expect(fromCommandCenter).toEqual(fromQueue);
  });

  it("makes every Decide open a drawer rather than navigate away", () => {
    for (const [code, tabSlug, title] of [
      ["m1", "today", "My actions"],
      ["m13", "queue", "Waiting on me"],
    ] as const) {
      for (const panelRow of moduleContent[code]![tabSlug]!.rows) {
        for (const panel of panelRow.panels) {
          if (panel.type !== "table" || panel.title !== title) continue;
          for (const tableRow of panel.rows) {
            for (const cell of tableRow.cells) {
              if (cell.kind !== "action" || cell.label !== "Decide") continue;
              expect(cell.drawer, `${code}/${tabSlug} Decide`).toBeDefined();
              expect(cell.href, `${code}/${tabSlug} Decide should not navigate`).toBeUndefined();
              expect(cell.drawer!.mode).toBe("commit");
            }
          }
        }
      }
    }
  });

  it("states what a commit drawer will do, and what it did", () => {
    const oversight = moduleContent.m1!.oversight!;
    const drawer = oversight.primary!.drawer!;

    expect(drawer.mode).toBe("commit");
    expect(drawer.commitLabel).toBeTruthy();
    expect(drawer.commitDone).toBeTruthy();
    expect(drawer.commitDoneBody).toBeTruthy();
    // A notification is not an approval, and the copy has to say so.
    expect(`${drawer.sub} ${JSON.stringify(drawer.facts)}`).toMatch(/not an approval|never alters/i);
  });
});
