import type { Article, SyncConflict, Ticket } from "@/lib/modules/live/m16-types";
import { area, select, text } from "@/lib/modules/live/m7-forms";
import { dayLong } from "@/lib/modules/live/m7-format";
import type { DrawerSpec } from "@/lib/modules/panels";

/** Every modal in Sync & Support, as data. */

export const SUPPORT = "/api/v1/support";

export const CATEGORIES: Array<[string, string]> = [
  ["SYNC_OFFLINE_ISSUE", "Sync or offline"],
  ["TECHNICAL_BUG", "Something is not working"],
  ["NOTIFICATION_DELIVERY", "A message did not arrive"],
  ["RESULT_COMPUTATION", "A result looks wrong"],
  ["DATA_CORRECTION_REQUEST", "A record needs correcting"],
  ["DATA_ISSUE", "Data is missing or wrong"],
  ["BILLING", "Billing"],
  ["ACCOUNT_ACCESS", "Signing in or access"],
  ["FEATURE_REQUEST", "A feature we need"],
  ["OTHER", "Something else"],
];
export const PRIORITIES: Array<[string, string]> = [["LOW", "Low"], ["MEDIUM", "Normal"], ["HIGH", "High"], ["CRITICAL", "Critical"]];
export const readable = (value: string) => value.replace(/_/g, " ").toLowerCase().replace(/^./, (letter) => letter.toUpperCase());
export const categoryName = (value: string) => CATEGORIES.find(([code]) => code === value)?.[1] ?? readable(value);
export const priorityName = (value: string) => PRIORITIES.find(([code]) => code === value)?.[1] ?? readable(value);
const pair = (items: Array<[string, string]>) => Object.fromEntries(items.map(([code, label]) => [label, code]));

/** Raising a ticket asks for what support needs to answer it the first time. */
export function raiseTicketDrawer(pre?: { category?: string; subject?: string }): DrawerSpec {
  return {
    mode: "form",
    kicker: "Help & support",
    title: "Raise a ticket",
    sub: "Say what happened and what you expected. The answer comes back here, on the ticket.",
    commitLabel: "Raise the ticket",
    commitDone: "Ticket raised",
    commitDoneBody: "Support has it. You will be told here when they reply, and the response target is four working hours.",
    reviewNote: "Nothing about a student is sent unless you write it in the description.",
    fields: [
      select("What it is about", CATEGORIES.map(([, label]) => label), { required: true, span: 2, value: categoryName(pre?.category ?? "TECHNICAL_BUG") }),
      text("Subject", { required: true, span: 2, value: pre?.subject ?? "", placeholder: "SMS batch to 214 families failed on 3 recipients", hint: "A line somebody can scan in a list." }),
      area("What happened", { required: true, span: 2, placeholder: "What you did, what you saw, and what you expected. Twenty characters at least.", hint: "Include the class, the person or the time if you can." }),
      select("How urgent", PRIORITIES.map(([, label]) => label), { value: "Normal", hint: "Critical is for the school being unable to work." }),
    ],
    submit: { endpoint: `${SUPPORT}/tickets`, method: "POST", map: { "What it is about": "category", Subject: "subject", "What happened": "description", "How urgent": "priority" }, encode: { "What it is about": pair(CATEGORIES), "How urgent": pair(PRIORITIES) } },
  };
}

export function replyDrawer(ticket: Pick<Ticket, "id" | "ticketNo" | "subject">): DrawerSpec {
  return {
    mode: "form",
    kicker: ticket.ticketNo,
    title: `Reply · ${ticket.subject}`,
    sub: "It goes on the ticket, in order, and support reads it.",
    commitLabel: "Send the reply",
    commitDone: "Reply sent",
    commitDoneBody: "It is on the ticket now.",
    fields: [area("Reply", { required: true, span: 2, placeholder: "Answer what they asked, or add what you found." })],
    submit: { endpoint: `${SUPPORT}/tickets/${ticket.id}/reply`, method: "POST", map: { Reply: "body" } },
  };
}

/** A ticket read in full: what was asked, who has it, and everything said since. */
export function ticketDrawer(ticket: Ticket): DrawerSpec {
  return {
    mode: "view",
    kicker: `${ticket.ticketNo} · ${categoryName(ticket.category)}`,
    title: ticket.subject,
    sub: ticket.waitingOnSchool ? "Support has asked a question and is waiting for the school to answer." : ticket.open ? "With support." : "Closed out.",
    facts: [
      ["State", readable(ticket.status), ticket.slaBreached ? "Past its answer time" : ticket.slaDueAt && ticket.open ? `Answer due ${dayLong(ticket.slaDueAt)}` : ""],
      ["Priority", priorityName(ticket.priority)],
      ["Raised", dayLong(ticket.createdAt), ticket.raisedBy ? `By ${ticket.raisedBy}` : ""],
      ["With", ticket.assignedTo ?? "Not yet assigned"],
      ["What was said", ticket.description],
      ...ticket.messages.map((message): [string, string, string?] => [`${message.author}${message.authorRole ? ` · ${readable(message.authorRole)}` : ""}`, message.body, dayLong(message.createdAt)]),
    ],
    edit: ticket.open ? replyDrawer(ticket) : undefined,
    editLabel: "Reply",
    readOnly: true,
    readOnlyNote: ticket.open ? "Reply to add to the ticket; what is here cannot be edited." : "This ticket is closed. Raise a new one rather than reopening it.",
  };
}

export function articleDrawer(article: Article): DrawerSpec {
  return {
    mode: "info",
    kicker: `${article.category}${article.video ? " · video" : ""}`,
    title: article.title,
    sub: article.roleTarget ? `Written for ${article.roleTarget.toLowerCase()}` : "For everyone",
    facts: [["Read", `${article.views} ${article.views === 1 ? "time" : "times"}`, `${article.helpful} found it helpful · ${article.unhelpful} did not`], ["The article", article.body]],
    readOnly: true,
    readOnlyNote: "Not what you were after? Raise a ticket and say so — it improves the article.",
  };
}

const SIDES: Array<[string, string]> = [["The version on the record", "school"], ["The version from the device", "device"]];

/** Two versions of one record: both are shown, one is chosen, and the person who captured it is told which. */
export function resolveDrawer(conflict: SyncConflict): DrawerSpec {
  const at = (iso: string | null) => (iso ? new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "—");
  return {
    mode: "form",
    kicker: "Sync conflict",
    title: conflict.record,
    sub: "Two versions of one record. Choose which stands — the other stays in the audit trail.",
    commitLabel: "Apply my choice",
    commitDone: "Conflict resolved",
    commitDoneBody: "The record now says what you chose, and the person who captured the other version has been told.",
    reviewNote: "Choosing the device's version applies it as a correction under your name, with both values kept.",
    facts: [
      ["On the record", conflict.school.summary || "—", `${conflict.school.by} · ${at(conflict.school.at)}`],
      ["From the device", conflict.device.summary || "—", `${conflict.device.by} · captured ${at(conflict.device.at)}`],
      ["Where they differ", `${conflict.differing} ${conflict.differing === 1 ? "item" : "items"}`, conflict.deviceLabel ?? "Captured with no connection"],
    ],
    fields: [
      select("Which version stands", SIDES.map(([label]) => label), { required: true, span: 2, value: SIDES[0][0] }),
      area("A note for the person who captured it", { optional: true, span: 2, placeholder: "Why this version stands." }),
    ],
    submit: { endpoint: `/api/v1/sync/conflicts/${conflict.id}/resolve`, method: "POST", map: { "Which version stands": "choice", "A note for the person who captured it": "note" }, encode: { "Which version stands": Object.fromEntries(SIDES) } },
  };
}
