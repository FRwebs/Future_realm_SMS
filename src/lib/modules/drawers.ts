import type { DrawerSpec, PanelFact } from "@/lib/modules/panels";

/**
 * Drawers the mockup reuses across modules.
 *
 * Both of these are notifications, and the mockup is emphatic about what that
 * means: a message lands on someone's phone and in their inbox. Nothing is
 * approved, no state moves, no deadline shifts. The copy says so plainly,
 * because a person about to press the button needs to know it is not a decision.
 */

/** Notify several people at once — each gets only what they personally owe. */
export function nudgeDrawer(options: {
  count: number;
  kicker?: string;
  title?: string;
  who?: string;
  what?: string;
  channels?: string;
  extra?: PanelFact[];
}): DrawerSpec {
  const { count, who, what, channels = "In-app and email", extra = [] } = options;

  return {
    mode: "commit",
    kicker: options.kicker ?? "Notification",
    title: options.title ?? `Notify ${count} staff`,
    sub: "This sends a notification. It is not an approval, and it changes nothing on any record.",
    facts: [
      [
        "Who is notified",
        `${count}${who ? ` · ${who}` : ""}`,
        "Each person receives only the items they personally owe",
      ],
      ["Channel", channels, "In-app is instant. Email arrives within a minute."],
      [
        "What they see",
        what ?? "A list of what they owe, with a link straight to it",
        "Nothing is disclosed about anyone else",
      ],
      ["Already notified today", "0", "Duplicates in one day are skipped"],
      [
        "Changes anything?",
        "No",
        "A notification never alters a record, a state or a deadline",
      ],
      [
        "Recorded as",
        "A notification in the audit log",
        "Under your name, with the recipient list",
      ],
      ...extra,
    ],
    commitLabel: "Send the notification",
    commitNote: "Delivered immediately · nothing is approved by this.",
    commitDone: `Notification sent to ${count} staff`,
    commitDoneBody:
      "It is on their phone and in their inbox now. Each one received only what they personally owe.",
  };
}

/** Notify one named person about one named thing they owe. */
export function notifyPersonDrawer(options: {
  name: string;
  role?: string;
  owes: string;
  items?: string | number;
  oldest?: string;
  last?: string;
  due?: string;
  kicker?: string;
}): DrawerSpec {
  const {
    name,
    role,
    owes,
    items = 1,
    oldest = "—",
    last = "Never",
    due = "In 2 days",
  } = options;

  const count = String(items);
  const unassigned = /unassigned|nobody/i.test(name);
  // Someone who has never been told, or has sat on it for a fortnight, gets the
  // firmer wording — the mockup picks the urgency rather than asking every time.
  const urgency =
    /never/i.test(last) || /\d{2,} days/.test(oldest)
      ? "Firm · names the deadline"
      : "Reminder";

  return {
    mode: "commit",
    kicker: `${options.kicker ?? "Oversight"} · notification`,
    title: `Notify ${name}`,
    sub: "This is exactly what will be sent, and to whom. Nothing on any record changes.",
    facts: [
      [
        "Who is notified",
        unassigned ? "No teacher is mapped — nobody to notify" : name,
        unassigned
          ? "Assign a teacher first; a notification cannot reach an empty mapping."
          : (role ?? "Staff"),
      ],
      [
        "What they owe",
        owes,
        `${count} ${count === "1" ? "item" : "items"} · oldest ${oldest} · last notified ${last}`,
      ],
      ["Channel", "In-app inbox and SMS", "In-app is instant. SMS costs 1 credit per recipient."],
      ["Urgency", urgency, "Chosen from how long it has sat and whether they have been told before"],
      ["Do it by", due, "Stated in the message. It does not move any deadline on the record."],
      ["Changes anything?", "No", "A notification never changes a record, a state or a deadline"],
    ],
    commitLabel: "Send the notification",
    commitNote: "A notification never changes a record, a state or a deadline.",
    commitDone: `Notification sent to ${name}`,
    commitDoneBody:
      "It is in their in-app inbox and on their phone now. Nothing on any record changed.",
  };
}

/** A read-only export, stated before it is produced. */
export function exportDrawer(options: {
  title: string;
  what: string;
  scope: string;
  format?: string;
  note?: string;
}): DrawerSpec {
  return {
    mode: "commit",
    kicker: "Export",
    title: options.title,
    sub: "Producing a file changes nothing. The export itself is written to the audit log.",
    facts: [
      ["What is exported", options.what],
      ["Scope", options.scope, "Only what your access already lets you see"],
      ["Format", options.format ?? "CSV and PDF", "Both are produced together"],
      ["Recorded as", "An export in the audit log", "Under your name, with the scope above"],
      ...(options.note ? ([["Note", options.note]] as PanelFact[]) : []),
    ],
    commitLabel: "Produce the file",
    commitDone: "Export produced",
    commitDoneBody: "The file is ready to download, and the export is recorded in the audit log.",
  };
}
