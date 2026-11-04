import { getTranslations } from "next-intl/server";

import { myProfileContract } from "@/lib/api/contracts";
import { apiGet, observe } from "@/lib/api/server";
import { localContracts } from "@/lib/api/local-contracts.zod";
import { LOCALES } from "@/i18n/locales";
import { formatDay } from "@/lib/date-format";
import { languagePanel, type AccountWords, type MyProfile } from "@/lib/modules/account";
import { name as nameCell, pill, row, text } from "@/lib/modules/panels";
import type { DrawerSpec, ListItem, PanelFact, PanelTone, TableRow } from "@/lib/modules/panels";
import { PW, dLong } from "@/lib/modules/live/parent/shared";
import type { ParentContent } from "@/lib/modules/live/parent/shared";

type Account = {
  name: string; userId: string | null; relationship: string; primaryFor: string[]; email: string | null; phone: string;
  address: string | null; timezone: string; language: string; since: string; sms: boolean; emailOn: boolean;
  schools: Array<{ name: string; short: string; place: string; children: string[] }>;
  offers: Array<{ id: string; name: string; relationship: string; school: string; short: string; place: string; children: string[] }>;
};
type Security = {
  mustChangePassword: boolean; mfaEnabled: boolean; mfaEnrolledAt: string | null; passwordChangedAt: string | null;
  signIns: Array<{ id: string; at: string; success: boolean; device: string; where: string; newDevice: boolean; reason: string | null }>;
};
type Device = { id: string; device: string; where: string; lastActiveAt: string; startedAt: string; current: boolean };

const TABS = ["Profile", "Security", "Schools and your data"];
const when = (iso: string) => formatDay(new Date(iso), { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Africa/Lagos" });

/** "Africa/Lagos" → "West Africa Standard Time (GMT+1)": the name a person knows their clock by. */
function zoneName(zone: string): string {
  try {
    const part = (style: "long" | "shortOffset") => new Intl.DateTimeFormat("en-GB", { timeZone: zone, timeZoneName: style }).formatToParts(new Date()).find((item) => item.type === "timeZoneName")?.value ?? "";
    return `${part("long")} (${part("shortOffset")})`;
  } catch {
    return zone;
  }
}

export async function accountPage(query: Record<string, string | undefined>): Promise<ParentContent> {
  const tab = TABS.includes(query.tab ?? "") ? query.tab! : TABS[0]!;
  const head = {
    eyebrow: "Your account", title: "Account and security",
    tabs: TABS.map((label) => ({ label })), tab,
    desc: "One account for your children’s school. Only you know your password.",
  };
  const account = await apiGet(`${PW}/account`, observe<Account>(localContracts["src/lib/modules/live/parent/account.ts#db490499"]));
  if (tab === "Security") return securityTab(head, account);
  if (tab === TABS[2]) return schoolsTab(head, account);
  return profileTab(head, account);
}

type Head = { eyebrow: string; title: string; tabs: Array<{ label: string }>; tab: string; desc: string };

async function profileTab(head: Head, account: Account): Promise<ParentContent> {
  const t = await getTranslations("shell.account");
  const words: AccountWords = {
    language: t("language"), languageSub: t("languageSub"), languageHint: LOCALES.length > 1 ? t("languageHint") : t("languageHintOff"),
    saved: t("savedLanguage"), save: t("saveLanguage"),
  };
  const mine = await apiGet("/api/v1/profile/me", myProfileContract).catch(() => ({}) as MyProfile);
  const contact: DrawerSpec = {
    kicker: "Your account", title: "Update your contact details", mode: "form",
    sub: "Fill in only what has changed. The school confirms it before its records change — it is the number it rings in an emergency.",
    fields: [
      { kind: "text", label: "Phone number", optional: true, value: "", placeholder: account.phone },
      { kind: "text", label: "Email", optional: true, value: "", placeholder: account.email ?? "" },
      { kind: "text", label: "Home address", optional: true, value: "", placeholder: account.address ?? "" },
      { kind: "area", label: "Anything the school should know?", optional: true, value: "" },
    ],
    confirmTitle: "Send this to the school?",
    commitLabel: "Send the request", commitDone: "Sent to the school",
    commitDoneBody: "Your details change when the school has confirmed them. You can follow it under Requests.",
    submit: {
      endpoint: `${PW}/account/requests`, method: "POST",
      map: { "Phone number": "phone", "Email": "email", "Home address": "address", "Anything the school should know?": "note" },
      body: { kind: "contact" },
    },
  };
  const facts: PanelFact[] = [
    ["Name", account.name],
    ["User ID", account.userId ?? "Not issued", account.userId ? "Use it to sign in instead of your email" : ""],
    ["Relationship", account.relationship, account.primaryFor.length ? `Primary contact for ${account.primaryFor.join(" and ")}` : "Not the primary contact"],
    ["Email", account.email ?? "Not recorded", "Also your sign-in"],
    ["Phone", account.phone, [account.sms ? "SMS" : "", account.emailOn ? "email" : ""].filter(Boolean).join(" and ") ? `The school may reach you by ${[account.sms ? "SMS" : "", account.emailOn ? "email" : ""].filter(Boolean).join(" and ")}` : "The school will not text or email you"],
    ["Home address", account.address ?? "Not recorded"],
    ["Time zone", zoneName(account.timezone), "The school’s times are shown in this zone"],
    ["Member since", dLong(account.since)],
  ];
  return {
    ...head,
    primary: { label: "Update contact details", drawer: contact },
    rows: [
      row("1fr", [{ type: "facts", title: "You", per: 3, facts }]),
      row("1fr", [languagePanel(mine, words)]),
    ],
  };
}

async function securityTab(head: Head, account: Account): Promise<ParentContent> {
  const [sec, devices] = await Promise.all([
    apiGet(`${PW}/security`, observe<Security>(localContracts["src/lib/modules/live/parent/account.ts#4e57b090"])),
    apiGet(`${PW}/sessions`, observe<Device[]>(localContracts["src/lib/modules/live/parent/account.ts#6feb8d65"])).catch(() => [] as Device[]),
  ]);
  const change: DrawerSpec = {
    kicker: "Your account", title: "Change your password", mode: "form",
    sub: "Use at least eight characters. You stay signed in here; other devices are asked to sign in again.",
    fields: [
      { kind: "text", type: "password", label: "Current password", required: true, value: "", placeholder: "Your password now" },
      { kind: "text", type: "password", label: "New password", required: true, value: "", placeholder: "At least 8 characters" },
    ],
    commitLabel: "Update password", commitDone: "Password changed", commitDoneBody: "Use the new one next time you sign in.",
    submit: { endpoint: "/api/v1/profile/me/password", method: "PATCH", map: { "Current password": "currentPassword", "New password": "newPassword" } },
  };
  const signIns: TableRow[] = sec.signIns.map((entry) => ({
    cells: [
      text(when(entry.at)),
      nameCell(entry.device, entry.where || "Place not known", { avatar: false }),
      pill(entry.success ? (entry.newDevice ? "New device" : "Signed in") : "Did not get in", entry.success ? (entry.newDevice ? "attention" : "positive") : "negative"),
    ],
  }));
  const deviceItems: ListItem[] = devices.map((device) => ({
    label: device.device,
    sub: `${device.where || "Place not known"} · last used ${when(device.lastActiveAt)}`,
    ...(device.current
      ? { pill: "This device", tone: "positive" as PanelTone }
      : {
          viewLabel: "Sign out",
          drawer: {
            mode: "commit" as const, tone: "attention" as PanelTone, kicker: "Your account", title: "Sign out of this device?",
            sub: `${device.device} is signed out straight away and will need your password to sign in again.`,
            commitLabel: "Sign out", commitDone: "Signed out", commitDoneBody: `${device.device} is no longer signed in.`,
            submit: { endpoint: `${PW}/sessions/${device.id}/revoke`, method: "POST" as const },
          } satisfies DrawerSpec,
        }),
  }));
  return {
    ...head,
    primary: { label: "Change password", drawer: change },
    rows: [
      ...(sec.mustChangePassword ? [row("1fr", [{ type: "note" as const, tone: "attention" as const, title: "Choose your own password to carry on", body: "The school gave you a temporary password. Use “Change password” above, with the temporary one as your current password." }])] : []),
      row("minmax(0,1fr) minmax(0,1fr)", [
        {
          type: "facts", title: "Sign-in protection", per: 1,
          facts: [
            ["Password", sec.passwordChangedAt ? `Changed ${dLong(sec.passwordChangedAt.slice(0, 10))}` : "Set by your school", "Change it from the button above"],
            ["Signing in with", account.userId ? `${account.userId} or ${account.email ?? "your email"}` : account.email ?? "Your email"],
          ] as PanelFact[],
        },
        { type: "embed", component: "student-two-step", props: { enabled: sec.mfaEnabled, since: sec.mfaEnrolledAt } },
      ]),
      row("1fr", [{
        type: "list", title: "Devices signed in", sub: "Sign out anything you don’t recognise.",
        empty: "No other device is signed in.", items: deviceItems,
      }]),
      row("1fr", [{
        type: "table", title: "Recent sign-ins", sub: "If one is not you, change your password and tell the school office.",
        noun: "sign-in", nounPlural: "sign-ins", head: ["When", "Device", "Result"], rows: signIns, per: 12, dense: true, noRowOpen: true,
        empty: "No sign-ins are on record yet.",
      }]),
    ],
  };
}

function schoolsTab(head: Head, account: Account): ParentContent {
  const copy: DrawerSpec = {
    mode: "commit", tone: "progress", kicker: "Your data", title: "Request a copy of your data?",
    sub: "The registrar prepares what the school holds about you and your children and sends it to you. You can follow the request under Requests.",
    confirmTitle: "Send this request?",
    commitLabel: "Request a copy", commitDone: "Copy requested", commitDoneBody: "The registrar will prepare it. You can follow it under Requests.",
    submit: { endpoint: `${PW}/account/requests`, method: "POST", body: { kind: "copy" } },
  };
  // A school that wrote this parent's own email is offered, never linked on its own: the parent says it is them.
  const offers: ListItem[] = account.offers.map((offer) => ({
    lead: { value: offer.short.slice(0, 3).toUpperCase(), tone: "attention" },
    label: offer.school,
    sub: [offer.place, `${offer.name}, ${offer.relationship.toLowerCase()}`, offer.children.join(" and ")].filter(Boolean).join(" · "),
    viewLabel: "This is me",
    drawer: {
      mode: "commit", tone: "progress", kicker: "Your schools", title: `Add ${offer.school} to your account?`,
      sub: `${offer.school} holds a record for ${offer.name} with your email address. If that is you, ${offer.children.length > 1 ? "its children join" : "the child joins"} the family you already see here, under the same sign-in. If it is not you, leave it — nothing is shared until you say so.`,
      confirmTitle: "Is this you?",
      commitLabel: "Yes, add this school", commitDone: "School added", commitDoneBody: `${offer.school} is now part of your account. Its children appear beside the others.`,
      submit: { endpoint: `${PW}/account/schools/${offer.id}/link`, method: "POST" },
    } satisfies DrawerSpec,
  }));
  return {
    ...head,
    rows: [
      ...(offers.length ? [row("1fr", [{
        type: "list" as const, title: "Another school has your email", sub: "Only you can say a record is yours. Check the name and the children before you add it.", items: offers,
      }])] : []),
      row("1fr", [{
        type: "list", title: "School linked to your account", sub: "The school is responsible for the records it holds about your children.",
        items: account.schools.map((school): ListItem => ({
          lead: { value: school.short.slice(0, 3).toUpperCase(), tone: "neutral" },
          label: school.name,
          sub: [school.place, school.children.join(" and ")].filter(Boolean).join(" · "),
          pill: "Linked", tone: "positive",
        })),
        empty: "No school is linked to your account.",
      }]),
      row("minmax(0,1fr) minmax(0,1fr)", [
        {
          type: "list", title: "Your data",
          items: [
            { label: "Ask for a copy of everything about you", sub: "What the school holds about you and your children, prepared by the registrar.", viewLabel: "Request a copy", drawer: copy },
            { label: "Correct something", sub: "Use a request — the school corrects its own record and keeps the history.", viewLabel: "Start", href: "/portals/parent/profile" },
          ],
        },
        { type: "note", tone: "neutral", icon: "M12 3.2 19 6v6c0 4-3 7.4-7 8.3-4-.9-7-4.3-7-8.3V6zM9.3 12l2 2 3.4-3.7", title: "Closing your account", body: "Your account stays open while the school holds a linked child’s record. Leaving the school starts with a withdrawal notice to the office." },
      ]),
    ],
  };
}
