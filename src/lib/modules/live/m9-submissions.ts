import { apiGet } from "@/lib/api/server";
import { plural } from "@/lib/modules/live/m7-format";
import { logSubmissionDrawer, resolveDrawer, viewDrawer, PG } from "@/lib/modules/live/m9-forms";
import type { SubmissionOptions, Submissions } from "@/lib/modules/live/m9-types";
import { text, type TabContent, type TrackerRow } from "@/lib/modules/panels";

/**
 * Submissions: everything families have sent in, with an owner, a state and an age. Which types a
 * school accepts, how fast it promises to answer and who reviews each is the school's own list.
 */

export const loadSubmissions = () => apiGet<Submissions>(`${PG}/submissions`);
export const loadSubmissionOptions = () => apiGet<SubmissionOptions>(`${PG}/submissions/options`);

export function submissionsTab(data: Submissions, o: SubmissionOptions): TabContent {
  const { totals } = data;
  const log = logSubmissionDrawer(o);
  const row = (item: Submissions["items"][number]): TrackerRow => ({ unit: `${item.type} · ${item.family}${item.child ? ` · ${item.child}` : ""}`, sub: item.detail, owner: item.owner, role: item.ownerRole, state: item.state, age: item.age, overdue: item.overdue, drawer: resolveDrawer(item), act: item.open ? "Resolve" : "Review" });
  const rows = data.items.map(row);
  const by = (key: (item: Submissions["items"][number]) => string) => data.items.slice().sort((a, b) => key(a).localeCompare(key(b))).map(row);
  const overdue = data.items.filter((item) => item.overdue);
  return {
    title: "Submissions",
    desc: "Everything parents have sent in, with an owner, a state and an age.",
    primary: { label: "Log a submission", icon: "M5 12.5l4.5 4.5 9-10", drawer: log },
    rows: [
      { cols: "1fr", panels: [{ type: "kpi", per: 4, cards: [{ label: "Open", value: String(totals.open), sub: `${plural(data.levels.filter((level) => level.accepted).length, "type")} accepted`, tone: totals.open ? "attention" : "positive" }, { label: "Past service level", value: String(totals.overdue), sub: "Escalated to their approver", tone: totals.overdue ? "negative" : "positive" }, { label: "Resolved this term", value: String(totals.resolved), sub: "Each with a recorded outcome", tone: "positive" }, { label: "Median time to resolve", value: totals.median === null ? "—" : `${totals.median} days`, sub: "Target is per type" }] }] },
      { cols: "1fr", panels: [{ type: "tracker", title: "Inbound submissions", sub: "By type, by owner, by class or by state.", meta: `${totals.open} open · ${totals.overdue} overdue`, noun: "submissions resolved", groups: ["By type", "By owner", "By state"], groupRows: { "By type": by((item) => item.type), "By owner": by((item) => item.owner), "By state": by((item) => item.state) }, rows, clear: { title: "Nothing is waiting on the school", body: totals.all ? "Every submission has been resolved or declined, each with a recorded outcome." : "No family has sent anything in yet. Log what a family tells you in person or by phone, and it is tracked like any other." } }] },
      {
        cols: "1.1fr 1fr",
        panels: [
          { type: "table", title: "Service level by type", sub: "Which submissions the school accepts is set in School Configuration · Policies.", head: ["Type", "Open", "Target", "Reviewed by", "Overdue"], noun: "type", nounPlural: "types", noRowOpen: true, rows: data.levels.map((level) => ({ cells: [text(level.name, { strong: true }), level.accepted ? text(String(level.open), { mono: true }) : text("Not accepted", { tone: "neutral" }), text(level.accepted ? `${level.target} days` : "—"), text(level.reviewer), level.accepted ? text(String(level.overdue), { mono: true, tone: level.overdue ? "negative" : undefined, strong: Boolean(level.overdue) }) : text("—")] })) },
          overdue.length
            ? { type: "note", tone: "attention", title: `${plural(overdue.length, "submission")} ${overdue.length === 1 ? "is" : "are"} past ${overdue.length === 1 ? "its" : "their"} service level`, body: "Each has escalated to the reviewer's approver, and the family has been told the school is looking at it.", acts: [{ label: `Open the ${overdue.length} overdue`, drawer: viewDrawer("Submissions", "Past their service level", "Oldest first.", overdue.sort((a, b) => b.days - a.days).slice(0, 12).map((item) => [`${item.type} · ${item.family}`, item.age, item.owner] as [string, string, string]), "Open any of them in the list to record an outcome.") }, { label: "Adjust service levels", href: "/school-configuration/policies" }] }
            : { type: "note", tone: "positive", title: "Nothing is past its service level", body: "Every open submission is inside the time the school promised.", acts: [{ label: "Adjust service levels", href: "/school-configuration/policies" }] },
        ],
      },
    ],
  };
}

