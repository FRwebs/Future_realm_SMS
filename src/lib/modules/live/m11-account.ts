import { apiGet } from "@/lib/api/server";
import { dayLabel, dayLong, plural } from "@/lib/modules/live/m7-format";
import { SB, agreementDrawer, agreementReadDrawer, closureDrawer, exportDrawer, preferencesDrawer, transferDrawer } from "@/lib/modules/live/m11-forms";
import type { Account } from "@/lib/modules/live/m11-types";
import { pill, text, type PanelFact, type PanelTone, type TabContent, type TableRow } from "@/lib/modules/panels";

/**
 * Account: the rare, consequential settings. The agreement the school holds with Future Realm,
 * who is written to, who owns the school — and the two things that cannot be done lightly:
 * taking everything out, and closing.
 */

export const loadAccount = () => apiGet<Account>(`${SB}/account`);
export const exportHref = (token: string) => `/subscription-billing/account/export/${encodeURIComponent(token)}`;

const TRANSFER_STATE: Record<string, string> = { EVIDENCE_COLLECTED: "Evidence with Future Realm", NOTICE_SENT: "Notice sent", OBJECTION_RAISED: "Objection raised", APPROVED: "Approved", EXECUTED: "Completed", FROZEN: "Frozen" };

export function accountTab(a: Account): TabContent {
  const signed = a.agreement.status === "SIGNED";
  const outdated = signed && Boolean(a.agreement.current) && a.agreement.version !== a.agreement.current;
  const exportAction = { label: "Generate a full export", drawer: exportDrawer(a) };

  const dpa: PanelFact[] = [
    ["Version", a.agreement.version ?? (signed ? "Not recorded" : "—"), a.agreement.version ? "" : signed ? "Signed before versions were kept" : "Not yet accepted"],
    ["Accepted on", a.agreement.acceptedAt ? dayLong(a.agreement.acceptedAt) : signed ? "Not recorded" : "Not yet accepted", a.agreement.by ?? ""],
    ["Hosting country", a.agreement.hosting ?? "As set out in the agreement", a.agreement.hosting ? "" : "Not recorded on this account"],
    ["Retention on closure", `${a.agreement.retentionDays} days, then permanent deletion`, a.agreement.retentionDefault ? "The platform default" : "Agreed for this school"],
    ["Data Protection Officer", a.agreement.dpo ? `${a.agreement.dpo.name}${a.agreement.dpo.email ? ` · ${a.agreement.dpo.email}` : ""}` : "Not named", a.agreement.dpo ? "" : "Name one under Edit contacts and preferences"],
  ];
  const contacts: PanelFact[] = [
    ["Billing contact", a.contacts.billing ?? "Not named", a.contacts.billingEmail ?? ""],
    ["School contact", a.contacts.school ?? "Not named", ""],
    ["Account Manager", a.contacts.manager ?? "Not assigned", a.contacts.managerEmail ?? ""],
    ["Future Realm communications", a.contacts.productOnly ? "Product and billing only" : "Product, billing and marketing", a.contacts.productOnly ? "Marketing declined" : ""],
    ["Web address", a.address.subdomain ? `${a.address.subdomain}` : "Not issued", `Issued ${dayLong(a.address.issued)}`],
    ["Change of address", "By request", "Old links keep working for 12 months"],
  ];

  const exports: TableRow[] = a.exports.map((row) => ({
    href: row.expired ? undefined : exportHref(row.token),
    cells: [text(dayLabel(row.createdAt), { strong: true }), text(plural(row.datasets.length, "dataset")), text(row.rows.toLocaleString("en-NG"), { mono: true }), text(row.expired ? "Expired" : `Until ${dayLabel(row.expiresAt)}`), pill(row.downloadedAt ? "Downloaded" : row.expired ? "Never downloaded" : "Ready", row.downloadedAt ? "positive" : row.expired ? "neutral" : "attention"), row.expired ? text("—") : { kind: "action" as const, label: "Open", href: exportHref(row.token) }],
  }));
  const datasets: PanelFact[] = a.datasets.map((name) => [name, (a.counts[name] ?? 0).toLocaleString("en-NG"), "rows"] as PanelFact);

  return {
    title: "Account",
    desc: "The rare, consequential settings.",
    primary: { label: "Edit contacts and preferences", icon: "M5 12.5l4.5 4.5 9-10", drawer: preferencesDrawer(a) },
    launchers: [{ label: "Transfer ownership", drawer: transferDrawer(a) }],
    rows: [
      ...(outdated ? [{ cols: "1fr", panels: [{ type: "note" as const, tone: "negative" as PanelTone, title: `Version ${a.agreement.current} of the data processing agreement is ready to accept`, body: `Your school accepted version ${a.agreement.version ?? "an earlier one"}. Future Realm has since published ${a.agreement.current}; accepting it keeps the record of what governs your data current.`, acts: a.canOwn ? [{ label: "Read and accept it", drawer: agreementDrawer(a) }] : [] }] }] : []),
      ...(!signed ? [{ cols: "1fr", panels: [{ type: "note" as const, tone: "negative" as PanelTone, title: "The data processing agreement has not been accepted", body: "Future Realm holds a school's records on the basis of this agreement. Until the Proprietor accepts it, the school has no recorded basis for the data it holds here.", acts: a.canOwn ? [{ label: "Accept the agreement", drawer: agreementDrawer(a) }] : [] }] }] : []),
      {
        cols: "1.1fr 1fr",
        panels: [
          { type: "facts", title: "Data processing agreement", tag: outdated ? "Newer version available" : signed ? "Accepted" : "Pending", tagTone: signed && !outdated ? "positive" : "negative", sub: "Version, acceptance record and what it commits Future Realm to.", acts: [{ label: "Read the record", drawer: agreementReadDrawer(a) }, ...((!signed || outdated) && a.canOwn ? [{ label: "Accept it", primary: true, drawer: agreementDrawer(a) }] : [])], per: 2, facts: dpa },
          { type: "facts", title: "Contacts and web address", sub: "Who Future Realm writes to, and where your school lives.", acts: [{ label: "Edit", primary: true, drawer: preferencesDrawer(a) }], per: 2, facts: contacts },
        ],
      },
      {
        cols: "1fr 1fr",
        panels: [
          a.transfer
            ? { type: "note", tone: "sensitive", title: `An ownership transfer is in progress · ${TRANSFER_STATE[a.transfer.status] ?? a.transfer.status}`, body: `Requested ${dayLong(a.transfer.createdAt)}. Future Realm reviews the evidence, gives notice, and approves in two steps; nothing changes for you until then. The incoming owner receives a new account, never the outgoing owner's login.` }
            : { type: "note", tone: "sensitive", icon: "M9.5 11.3a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7M3 20v-1.2A4.6 4.6 0 0 1 7.6 14h3.8a4.6 4.6 0 0 1 4.6 4.8V20", title: "Ownership transfer creates a new account for the incoming owner", body: "The incoming owner never receives the outgoing owner's login. Handing over a login destroys the audit trail that protects the school — every action either owner took would become indistinguishable.", acts: a.canOwn ? [{ label: "Start a transfer", drawer: transferDrawer(a) }] : [] },
          a.closure
            ? { type: "note", tone: "attention", title: `Closure has been requested · ${a.closure.status.toLowerCase()}`, body: `Requested ${dayLong(a.closure.createdAt)}. The school's data is kept for ${a.closure.retentionDays} days, then permanently deleted. Nothing has been deleted yet.` }
            : { type: "note", tone: a.exportDelivered ? "attention" : "negative", title: a.exportDelivered ? "A full export has been delivered — closure can be requested" : "Closure is blocked until a full export has been delivered", body: "Only the Proprietor can request closure, and the request cannot proceed until a full-school export has been generated and downloaded.", acts: a.canOwn ? (a.exportDelivered ? [{ label: "Request closure", drawer: closureDrawer(a) }, exportAction] : [exportAction, { label: "About closure", drawer: closureDrawer(a) }]) : [] },
        ],
      },
      {
        cols: "1.15fr 1fr",
        panels: [
          { type: "table", title: "Full exports", sub: "Every export taken, whether it was downloaded, and when it lapses.", meta: `${plural(a.exports.length, "export")}`, acts: [{ label: "Generate a full export", primary: true, drawer: exportDrawer(a) }], head: ["Taken", "Datasets", "Rows", "Available", "State", ""], noun: "export", nounPlural: "exports", noRowOpen: true, rows: exports, emptyTitle: "No export has been taken", emptyBody: "Every export needs your password, notifies the leadership, and is logged.", foot: "Available on every tier, as CSV that Excel opens. An export lapses after 24 hours." },
          { type: "facts", title: "What a full export holds", sub: "Every dataset in the workspace, and how big it is today.", per: 3, facts: datasets },
        ],
      },
    ],
  };
}
