import { SW } from "@/lib/api/student-workspace";
import { apiGet } from "@/lib/api/server";
import { askDrawer, dLong, loadAskable, loadMe, loadPrefs } from "@/lib/modules/live/student/shared";
import type { StudentContent } from "@/lib/modules/live/student/shared";
import type { DrawerSpec, PanelFact, PanelTone, TableRow } from "@/lib/modules/panels";
import { row } from "@/lib/modules/panels";

/* ───────────────────────── profile ───────────────────────── */

export async function profilePage(): Promise<StudentContent> {
  const [me, askable] = await Promise.all([loadMe(), loadAskable()]);
  const correct = askDrawer(askable.people, { to: me.formMaster?.id, topic: "Something else", text: "Something on my record needs correcting: " });
  // The line under the name: where they are, which house, whether they board.
  const place = [me.arm, me.house, me.boarding, me.school].filter(Boolean).join(" · ");
  const collectors = me.collectors.length
    ? [me.collectors.map((person) => person.name).join(" or "), "Authorised by your parent; photo ID at the gate"]
    : ["Nobody is on the list yet", "Your parent can add one through the school office"];
  return {
    eyebrow: `${me.level} · ${me.admissionNumber}`, title: me.name, desc: place,
    launchers: me.formMaster ? [{ label: "Something wrong? Tell your form master", drawer: correct }] : [],
    rows: [
      row("1fr", [{
        type: "facts", title: "Your record", sub: "Held by the school registry. Only the school can change it.", per: 3,
        facts: [
          ["Full name", me.name], ["Admission number", me.admissionNumber], ["Class", `${me.arm}${me.stream ? ` · ${me.stream} stream` : ""}`],
          ["Form master", me.formMaster?.name ?? "Not named yet"], ["House", me.house ?? "Not in a house"], ["Attendance", me.boarding],
          ["Date of birth", dLong(me.dateOfBirth)], ["Enrolled", dLong(me.enrolled)], ["School email", me.email ?? "—"],
        ],
      }]),
      row("minmax(0,1fr) minmax(0,1fr)", [
        {
          type: "facts", title: "Your parent or guardian", per: 1,
          facts: [
            me.guardian
              ? [me.guardian.name, `${me.guardian.relationship ?? "Guardian"} · primary contact`, "The school contacts them first, about everything"] as PanelFact
              : ["No guardian on record", "The school has no guardian recorded for you", "Ask your form master to add one"] as PanelFact,
            ["Collected by", collectors[0]!, collectors[1]!] as PanelFact,
          ],
        },
        {
          type: "list", title: "What your parent sees", sub: "In the Parent Portal, set by the school.",
          items: [
            { label: "Attendance and late arrivals", sub: "Every mark, the day it is made", pill: "Shared", tone: "positive" },
            { label: "Results and report cards", sub: "When the school releases them, not before", pill: "Shared", tone: "positive" },
            { label: "Timetable and this week’s topics", sub: "The same as you see", pill: "Shared", tone: "positive" },
            { label: "Homework and marks", sub: "What is set, and what is late", pill: "Shared", tone: "positive" },
            { label: "Your messages to teachers", sub: "Between you, the teacher and your form master", pill: "Not shared", tone: "neutral" },
          ],
        },
      ]),
    ],
  };
}

/* ───────────────────────── notifications (what reaches you, and where) ───────────────────────── */

const CATEGORIES = [
  { key: "work", label: "Assignments", sub: "New work, a reminder before it is due, and marks" },
  { key: "results", label: "Results", sub: "Scores and report cards the school releases" },
  { key: "timetable", label: "Timetable changes", sub: "A covered lesson or a moved test" },
  { key: "school", label: "School announcements", sub: "Events, closures and reminders" },
  { key: "messages", label: "Messages from teachers", sub: "Replies to your questions" },
];
const CHANNELS = [
  { key: "In-app", label: "In-app", sub: "Always on", locked: true },
  { key: "Email", label: "Email", sub: "School email" },
  // Drawn because the mockup draws it, and fixed off because there is no phone
  // app to receive a push yet. The footnote below the matrix says so.
  { key: "Push", label: "Push", sub: "On your phone", unavailable: true },
];

export async function notificationsPage(): Promise<StudentContent> {
  const [me, prefs] = await Promise.all([loadMe(), loadPrefs()]);
  return {
    eyebrow: "Settings", title: "Notifications", desc: "Choose how you are told about work, results and school news. Safety notices always reach you.",
    rows: [row("1fr", [{
      type: "embed", component: "student-prefs",
      props: {
        base: SW, categories: CATEGORIES, channels: CHANNELS, matrix: prefs.matrix, defaults: Object.fromEntries(CATEGORIES.map((category) => [`${category.key}:Email`, category.key !== "timetable"])),
        quiet: prefs.quiet, remind: prefs.remind, quietOptions: ["None", "21:00 – 07:00", "22:00 – 06:00"], remindOptions: ["The day before", "Two days before", "No reminder"],
        foot: `Email goes to ${me.email ?? "your school email"}, and follows these choices for homework, marks, report cards, school announcements, new timetables and your teachers’ answers. Push needs the phone app, which is not out yet — until it is, that column stays off.`,
      },
    }])],
  };
}

/* ───────────────────────── account ───────────────────────── */

export async function accountPage(): Promise<StudentContent> {
  type Device = { id: string; device: string; where: string; lastActiveAt: string; startedAt: string; current: boolean };
  const [me, sec, devices] = await Promise.all([
    loadMe(),
    apiGet<{ mfaEnabled: boolean; mfaEnrolledAt: string | null; passwordChangedAt: string | null; createdAt: string; signIns: Array<{ id: string; at: string; success: boolean; device: string; where: string; newDevice: boolean; reason: string | null }> }>(`${SW}/security`),
    apiGet<Device[]>(`${SW}/sessions`).catch(() => [] as Device[]),
  ]);
  const change: DrawerSpec = {
    kicker: "Account", title: "Change your password", mode: "form", sub: "Use at least eight characters. You stay signed in here; other devices are asked to sign in again.",
    fields: [
      { kind: "text", type: "password", label: "Current password", required: true, value: "", placeholder: "Your password now" },
      { kind: "text", type: "password", label: "New password", required: true, value: "", placeholder: "At least 8 characters" },
    ],
    commitLabel: "Update password", commitDone: "Password changed", commitDoneBody: "Use the new one next time you sign in.",
    submit: { endpoint: "/api/v1/profile/me/password", method: "PATCH", map: { "Current password": "currentPassword", "New password": "newPassword" } },
  };
  const when = (iso: string) => new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Africa/Lagos" }).format(new Date(iso));
  const lastIn = sec.signIns.find((entry) => entry.success) ?? null;
  const rows: TableRow[] = sec.signIns.map((entry) => ({
    cells: [
      { kind: "name", name: entry.device, sub: entry.where || "Place not known", avatar: false }, { kind: "text", text: when(entry.at) },
      { kind: "pill", label: entry.success ? (entry.newDevice ? "New device" : "Signed in") : "Did not get in", tone: entry.success ? (entry.newDevice ? "attention" : "positive") : "negative" },
    ],
  }));
  return {
    eyebrow: "Settings", title: "Account and security", desc: "Your sign-in, your password and the devices you are signed in on.",
    primary: { label: "Change password", drawer: change },
    rows: [
      row("1fr", [{
        type: "facts", title: "Signing in", per: 3,
        facts: [
          ["User ID", me.admissionNumber], ["School email", me.email ?? "—"],
          ["Last sign-in", lastIn ? when(lastIn.at) : "—", lastIn ? lastIn.device : ""],
          ["Password", sec.passwordChangedAt ? `Changed ${dLong(sec.passwordChangedAt.slice(0, 10))}` : "Set by your school", "Change it from the button above"],
          ["Two-step sign-in", sec.mfaEnabled ? "On" : "Off", sec.mfaEnrolledAt ? `Since ${dLong(sec.mfaEnrolledAt.slice(0, 10))}` : "Not set up", sec.mfaEnabled ? "positive" : ""],
          ["Account", "Created by your school", `Enrolled ${dLong(me.enrolled)}`],
        ],
      }]),
      row("minmax(0,1.2fr) minmax(0,1fr)", [
        {
          type: "list",
          title: "Signed in on",
          sub: `${devices.length === 1 ? "1 device" : `${devices.length} devices`}. Sign out of any you do not recognise.`,
          empty: "No other device is signed in.",
          items: devices.map((device) => ({
            label: device.device,
            sub: `${device.where || "Place not known"} · last used ${when(device.lastActiveAt)}`,
            ...(device.current
              ? { pill: "This device", tone: "positive" as PanelTone }
              : {
                  viewLabel: "Sign out",
                  drawer: {
                    mode: "commit" as const,
                    tone: "attention" as PanelTone,
                    kicker: "Account",
                    title: "Sign out of this device?",
                    sub: `${device.device} is signed out straight away. Anything not yet synced on it is kept until it reconnects.`,
                    commitLabel: "Sign out",
                    commitDone: "Signed out",
                    commitDoneBody: `${device.device} is no longer signed in.`,
                    submit: { endpoint: `/api/v1/student-portal/ws/sessions/${device.id}/revoke`, method: "POST" as const },
                  },
                }),
          })),
        },
        { type: "embed", component: "student-two-step", props: { enabled: sec.mfaEnabled, since: sec.mfaEnrolledAt } },
      ]),
      row("1fr", [{ type: "table", title: "Recent sign-ins", sub: "The last times this account was signed in to. If one is not you, change your password and tell your form master.", noun: "sign-in", nounPlural: "sign-ins", head: ["Device", "When", "Result"], rows, per: 12, dense: true, noRowOpen: true, empty: "No sign-ins are on record yet." }]),
    ],
  };
}
