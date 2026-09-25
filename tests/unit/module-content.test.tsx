import { renderToStaticMarkup } from "react-dom/server";

import { PanelRows } from "@/components/modules/panel-renderer";
import { accountContentFor, accountTabs } from "@/lib/modules/account";
import type { SessionUser } from "@/lib/domain/types";
import { allocationOf } from "@/lib/modules/allocations-data";
import { curriculumLayers } from "@/lib/modules/curriculum-data";
import { armRows } from "@/lib/modules/school-data";
import { schoolClasses, uncoveredSubjectArms } from "@/lib/modules/teaching-data";
import { kpiSets, nairaM, payTotals, people, staffCounts } from "@/lib/modules/staff-data";
import { channels, planRates, studentsBilled, termCost } from "@/lib/modules/billing-data";
import { registryStudents } from "@/lib/modules/students-data";
import { audiences, costOf, households, reachOf } from "@/lib/modules/comms-data";
import {
  consentGap,
  consentHeld,
  integrityMonitors,
  openFlags,
  vendorSessions,
} from "@/lib/modules/audit-data";
import {
  blockedReturns,
  complianceReturns,
  nextDeadlineDays,
  recordGaps,
  totalRecordGaps,
} from "@/lib/modules/reporting-data";
import { naira } from "@/lib/modules/fees-data";
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

  it("writes the account page against whoever is signed in", () => {
    const session = {
      userId: "GIA-0004",
      schoolId: "school-1",
      role: "PRINCIPAL",
      email: "a.nwosu@graceacademy.ng",
      name: "Adaeze Nwosu",
      csrfToken: "t",
    } as SessionUser;
    const content = accountContentFor(session, "Grace International Academy");

    for (const tab of accountTabs) {
      const page = content[tab.slug];
      expect(page, tab.slug).toBeDefined();
      const html = renderToStaticMarkup(<PanelRows rows={page!.rows} />);
      expect(html.length, tab.slug).toBeGreaterThan(0);
      // This is the page that tells someone what the school holds about them,
      // so it must never show a name that is not theirs.
      expect(html, tab.slug).not.toContain("Not built yet");
    }

    const profile = renderToStaticMarkup(<PanelRows rows={content.profile!.rows} />);
    expect(profile).toContain("Adaeze Nwosu");
    expect(profile).toContain("a.nwosu@graceacademy.ng");
    expect(profile).toContain("Grace International Academy");
    // Initials stand in wherever no photograph exists.
    expect(profile).toContain("Initials · AN");

    // A second person gets their own page, not the first person's.
    const other = accountContentFor(
      { ...session, name: "Olubunmi Akinyele", email: "o.akinyele@example.ng" },
      "Greenfield College",
    );
    const otherProfile = renderToStaticMarkup(<PanelRows rows={other.profile!.rows} />);
    expect(otherProfile).toContain("Olubunmi Akinyele");
    expect(otherProfile).toContain("Initials · OA");
    expect(otherProfile).not.toContain("Adaeze Nwosu");
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

  it("carries every arm of the school on the register, a page at a time", () => {
    // The register is paginated, so the page renders ten arms — but the panel
    // behind it has to hold the whole school, or an arm becomes unreachable.
    const table = moduleContent
      .m4!.register!.rows.flatMap((row) => row.panels)
      .find((panel) => panel.type === "table" && panel.title === "Every arm, today");
    expect(table, "Every arm, today").toBeDefined();
    const armCells = (table as { rows: Array<{ cells: unknown[] }> }).rows.map((row) =>
      JSON.stringify(row.cells[0]),
    );
    for (const arm of ["Nursery 1A", "Primary 3B", "JSS 2A", "SSS 3C"]) {
      expect(armCells.some((cell) => cell.includes(arm)), arm).toBe(true);
    }

    const register = renderToStaticMarkup(<PanelRows rows={moduleContent.m4!.register!.rows} />);
    // The pager names the full count, so a truncated page never reads as the school.
    expect(register).toContain("42 arms");
    expect(register).toMatch(/Showing 1–\d+ of 42 arms/);
  });

  it("has no tab left saying it is not built yet", () => {
    // Every one of the 16 modules is ported, so the "not built yet" placeholder
    // must not survive anywhere — a page that reads as unfinished when it is
    // finished is as misleading as one that reads as finished when it is not.
    for (const module of schoolModules) {
      for (const tab of module.tabs) {
        const content = moduleContent[module.code]![tab.slug]!;
        const html = renderToStaticMarkup(<PanelRows rows={content.rows} />);
        expect(html, `${module.slug}/${tab.slug}`).not.toContain("Not built yet");
      }
    }
  });

  it("tells a teacher what works offline before they need to know", () => {
    const sync = renderToStaticMarkup(<PanelRows rows={moduleContent.m16!.sync!.rows} />);
    // Eleven each way, and the pair on every row is one that works against one
    // that does not — the list is only honest if both halves are stated.
    expect(sync).toContain("Mark attendance");
    expect(sync).toContain("Publish report cards");
    expect(sync).toContain("Resolve a sync conflict");

    // The queue names what is waiting and how old it is, never a bare count.
    expect(sync).toContain("41 min · JSS 2A, 4 Sep");
    expect(sync).toContain("nothing has been lost");
  });

  it("builds School Configuration from the same catalogue the allocations price", () => {
    const allocations = renderToStaticMarkup(
      <PanelRows rows={moduleContent.m2!.allocations!.rows} />,
    );
    // Eight lists this term, six of them published, from 14 across two terms.
    expect(allocations).toContain("14 allocations");
    expect(allocations).toContain("6 published");

    const jss1 = allocationOf("JSS 1", "Second Term 2026/2027");
    expect(allocations).toContain(naira(jss1.required));
    // A senior list carries the calculator, so it costs more than a nursery one.
    expect(jss1.required).toBeGreaterThan(
      allocationOf("Nursery 2", "Second Term 2026/2027").required,
    );

    // The curriculum in force is the only one that is, and its layers are all six.
    const curriculum = renderToStaticMarkup(
      <PanelRows rows={moduleContent.m2!.curriculum!.rows} />,
    );
    expect(curriculum).toContain("Grace International · Senior &amp; Junior");
    for (const layer of curriculumLayers) {
      // React escapes the ampersand in "Levels & Classes".
      expect(curriculum, layer.label).toContain(layer.label.replace("&", "&amp;"));
    }
  });

  it("counts Class & Timetable off the same arm table every module reads", () => {
    const html = renderToStaticMarkup(<PanelRows rows={moduleContent.m3!.classes!.rows} />);
    // 14 classes, 42 arms, and 1,560 students — the 1,557 on a roll plus the 3 in no arm.
    expect(html).toContain(`${schoolClasses().length} classes`);
    expect(html).toContain("42 arms");
    expect(html).toContain("1,560");

    // Every class's roll is the sum of its own arms' — a class holds arms, not students.
    for (const entry of schoolClasses()) {
      const armsOfClass = armRows.filter((arm) => arm.className === entry.name);
      expect(entry.roll, entry.name).toBe(
        armsOfClass.reduce((total, arm) => total + arm.roll, 0),
      );
    }

    // A subject nobody teaches blocks a whole arm, so it is never shown as blank.
    const subjects = renderToStaticMarkup(<PanelRows rows={moduleContent.m3!.subjects!.rows} />);
    expect(uncoveredSubjectArms.length).toBe(2);
    for (const entry of uncoveredSubjectArms) {
      expect(subjects, entry.arm).toContain(`Nobody named · ${entry.unassignedDays} days`);
    }
  });

  it("reads Staff & Access off one staff list, and names what is never activated", () => {
    // One staff count, read by the directory, permissions, payroll, leave and
    // appraisal alike — a school that sees two different counts trusts neither.
    const counts = staffCounts();
    expect(counts.total).toBe(people.length);
    expect(counts.active + counts.dormant + counts.never).toBe(counts.total);

    const directory = renderToStaticMarkup(<PanelRows rows={moduleContent.m7!.directory!.rows} />);
    expect(directory).toContain(`${counts.total} staff`);
    // A never-activated account carries how long it has been silently holding routing.
    expect(directory).toContain("Never activated · 43 days");

    // Payroll is short by exactly the people who are on no band.
    const totals = payTotals();
    expect(totals.unmapped).toBe(counts.never);
    expect(totals.n + totals.unmapped).toBe(people.length);

    const payroll = renderToStaticMarkup(<PanelRows rows={moduleContent.m7!.payroll!.rows} />);
    expect(payroll).toContain(nairaM(totals.cost));
    expect(payroll).toContain("not mapped to a band");

    // A KPI set cannot publish unless its weights total 100.
    for (const [name, set] of Object.entries(kpiSets)) {
      expect(set.reduce((total, kpi) => total + kpi.weight, 0), name).toBe(100);
    }
  });

  it("bills Subscription & Billing off the roll every other module reports", () => {
    // The plan is per student per term, counted at term start — so the billed
    // figure has to be the same roll the registry holds, not a literal.
    expect(studentsBilled).toBe(registryStudents.length);
    expect(termCost).toBe(studentsBilled * planRates.Elite);

    const plan = renderToStaticMarkup(<PanelRows rows={moduleContent.m11!.plan!.rows} />);
    expect(plan).toContain(naira(termCost));
    expect(plan).toContain(studentsBilled.toLocaleString("en-NG"));

    // Every tier's termly figure is that tier's rate against the same roll.
    for (const tier of ["Standard", "Premium", "Elite"] as const) {
      expect(plan, tier).toContain(naira(studentsBilled * planRates[tier]));
    }

    // A channel's balance is base plus topped-up, less what was used.
    const credits = renderToStaticMarkup(<PanelRows rows={moduleContent.m11!.credits!.rows} />);
    for (const channel of channels.filter((entry) => entry.paid)) {
      expect(channel.left).toBe(channel.base + channel.topped - channel.used);
      expect(credits, channel.name).toContain(channel.left.toLocaleString("en-NG"));
    }
  });

  it("excludes the unreachable before the count it asks you to approve", () => {
    // The rule the whole Communication Center turns on: the number you approve
    // is the number delivered, never an optimistic one.
    const guardians = audiences.find((entry) => entry.key === "Guardians")!;
    expect(guardians.matched).toBe(households.length);
    expect(reachOf(guardians)).toBe(guardians.matched - guardians.suppressed);
    expect(guardians.suppressed).toBeGreaterThan(0);

    const compose = renderToStaticMarkup(<PanelRows rows={moduleContent.m12!.compose!.rows} />);
    const reach = reachOf(guardians);
    expect(compose).toContain(`${reach.toLocaleString("en-NG")} people`);
    expect(compose).toContain(costOf(reach));

    // "Everyone" is the two audiences summed — matched and suppressed alike.
    const everyone = audiences.find((entry) => entry.key === "Everyone")!;
    const staff = audiences.find((entry) => entry.key === "Staff")!;
    expect(everyone.matched).toBe(guardians.matched + staff.matched);
    expect(everyone.suppressed).toBe(guardians.suppressed + staff.suppressed);

    // A locked rule says why, and offers no Edit at all.
    const automation = renderToStaticMarkup(<PanelRows rows={moduleContent.m12!.automation!.rows} />);
    expect(automation).toContain("Locked");
    expect(automation).toContain("a changed result must never arrive silently");
  });

  it("says which compliance returns cannot be produced, and what blocks each", () => {
    // A return has a recipient, a deadline and a format — it is either filed or
    // it is not. A blocked one names what is missing rather than filing short.
    expect(blockedReturns.length).toBeGreaterThan(0);
    for (const entry of blockedReturns) {
      expect(entry.blocker, entry.name).toBeTruthy();
    }

    const compliance = renderToStaticMarkup(
      <PanelRows rows={moduleContent.m14!.compliance!.rows} />,
    );
    for (const entry of blockedReturns) {
      expect(compliance, entry.name).toContain(entry.name);
      expect(compliance, entry.blocker).toContain(entry.blocker!);
    }

    // Every gap names the return it blocks, so it has a consequence.
    for (const gap of recordGaps) {
      expect(gap.blocks, gap.missing).toBeTruthy();
      expect(compliance, gap.missing).toContain(gap.missing);
    }
    expect(compliance).toContain(`${totalRecordGaps} record gaps`);

    // The next deadline is the soonest among returns still to file.
    const outstanding = complianceReturns.filter((entry) => entry.state !== "Filed");
    expect(nextDeadlineDays).toBe(Math.min(...outstanding.map((entry) => entry.days)));
  });

  it("logs Future Realm's own access the way it logs the school's", () => {
    // The audit log covers the vendor as plainly as it covers the school, and
    // elevated access never proceeds without a recorded confirmation.
    const log = renderToStaticMarkup(<PanelRows rows={moduleContent.m15!["audit-log"]!.rows} />);
    for (const session of vendorSessions) {
      expect(log, session.who).toContain(session.who);
      expect(log, session.why).toContain(session.why);
    }
    const elevated = vendorSessions.filter((session) => session.access !== "Read-only");
    expect(elevated).toHaveLength(1);
    expect(elevated[0]!.why).toMatch(/confirmed by/);

    // A monitor with nothing open still states what it looked for.
    const monitoring = renderToStaticMarkup(<PanelRows rows={moduleContent.m15!.monitoring!.rows} />);
    for (const monitor of integrityMonitors.filter((entry) => entry.open === 0)) {
      expect(monitor.found, monitor.monitor).toBeTruthy();
      expect(monitoring, monitor.monitor).toContain(monitor.found);
    }
    expect(openFlags).toBe(
      integrityMonitors.reduce((total, monitor) => total + monitor.open, 0),
    );

    // Consent coverage is read off the same roll every other module counts.
    expect(consentHeld + consentGap).toBe(registryStudents.length);
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
