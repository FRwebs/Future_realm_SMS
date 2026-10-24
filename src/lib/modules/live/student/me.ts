import { SW } from "@/lib/api/student-workspace";
import { askDrawer, dLong, loadAskable, loadMe, loadPrefs } from "@/lib/modules/live/student/shared";
import type { StudentContent } from "@/lib/modules/live/student/shared";
import type { DrawerSpec } from "@/lib/modules/panels";
import { row } from "@/lib/modules/panels";

/* ───────────────────────── profile ───────────────────────── */

export async function profilePage(): Promise<StudentContent> {
  const [me, askable] = await Promise.all([loadMe(), loadAskable()]);
  const correct = askDrawer(askable.people, { to: me.formMaster?.id, topic: "Something else", text: "Something on my record needs correcting: " });
  return {
    eyebrow: `${me.level} · ${me.admissionNumber}`, title: me.name, desc: `${me.arm}${me.stream ? ` · ${me.stream}` : ""} · ${me.school}`,
    launchers: me.formMaster ? [{ label: "Something wrong? Tell your form master", drawer: correct }] : [],
    rows: [
      row("1fr", [{
        type: "facts", title: "Your record", sub: "Held by the school registry. Only the school can change it.", per: 3,
        facts: [
          ["Full name", me.name], ["Admission number", me.admissionNumber], ["Class", `${me.arm}${me.stream ? ` · ${me.stream} stream` : ""}`],
          ["Form master", me.formMaster?.name ?? "Not named yet"], ["Gender", me.gender ? me.gender.charAt(0) + me.gender.slice(1).toLowerCase() : "—"], ["Classroom", me.room ?? "—"],
          ["Date of birth", dLong(me.dateOfBirth)], ["Enrolled", dLong(me.enrolled)], ["School email", me.email ?? "—"],
        ],
      }]),
      row("minmax(0,1fr) minmax(0,1fr)", [
        {
          type: "facts", title: "Your parent or guardian", per: 1,
          facts: me.guardian ? [[me.guardian.name, `${me.guardian.relationship ?? "Guardian"} · primary contact`, "The school contacts them first, about everything"]] : [["No guardian on record", "The school has no guardian recorded for you", "Ask your form master to add one"]],
        },
        {
          type: "list", title: "What your parent sees", sub: "In the Parent Portal, set by the school.",
          items: [
            { label: "Attendance and late arrivals", sub: "Every mark, the day it is made", pill: "Shared", tone: "positive" },
            { label: "Results and report cards", sub: "When the school publishes them, not before", pill: "Shared", tone: "positive" },
            { label: "Timetable and this week’s lessons", sub: "The same as you see", pill: "Shared", tone: "positive" },
            { label: "School fees", sub: "Only your parent sees these — never you", pill: "Parent only", tone: "neutral" },
            { label: "Your messages to teachers", sub: "Between you and the teacher", pill: "Not shared", tone: "neutral" },
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
const CHANNELS = [{ key: "In-app", label: "In-app", sub: "Always on", locked: true }, { key: "Email", label: "Email", sub: "School email" }];

export async function notificationsPage(): Promise<StudentContent> {
  const [me, prefs] = await Promise.all([loadMe(), loadPrefs()]);
  return {
    eyebrow: "Settings", title: "Notifications", desc: "Choose how you are told about work, results and school news. Safety notices always reach you.",
    rows: [row("1fr", [{
      type: "embed", component: "student-prefs",
      props: {
        base: SW, categories: CATEGORIES, channels: CHANNELS, matrix: prefs.matrix, defaults: Object.fromEntries(CATEGORIES.map((category) => [`${category.key}:Email`, category.key !== "timetable"])),
        quiet: prefs.quiet, remind: prefs.remind, quietOptions: ["None", "21:00 – 07:00", "22:00 – 06:00"], remindOptions: ["The day before", "Two days before", "No reminder"],
        foot: `Email goes to ${me.email ?? "your school email"}. Email follows these choices for homework, marks, report cards, school announcements, new timetables and your teachers’ answers.`,
      },
    }])],
  };
}

/* ───────────────────────── account ───────────────────────── */

export async function accountPage(): Promise<StudentContent> {
  const me = await loadMe();
  const change: DrawerSpec = {
    kicker: "Account", title: "Change your password", mode: "form", sub: "Use at least eight characters. You stay signed in here; other devices are asked to sign in again.",
    fields: [
      { kind: "text", type: "password", label: "Current password", required: true, value: "", placeholder: "Your password now" },
      { kind: "text", type: "password", label: "New password", required: true, value: "", placeholder: "At least 8 characters" },
    ],
    commitLabel: "Update password", commitDone: "Password changed", commitDoneBody: "Use the new one next time you sign in.",
    submit: { endpoint: "/api/v1/profile/me/password", method: "PATCH", map: { "Current password": "currentPassword", "New password": "newPassword" } },
  };
  return {
    eyebrow: "Settings", title: "Account and security", desc: "Your sign-in and your password.",
    primary: { label: "Change password", drawer: change },
    rows: [
      row("1fr", [{
        type: "facts", title: "Signing in", per: 3,
        facts: [
          ["User ID", me.admissionNumber], ["School email", me.email ?? "—"], ["Account", "Created by your school", `Enrolled ${dLong(me.enrolled)}`],
        ],
      }]),
      row("1fr", [{ type: "note", tone: "progress", title: "Keep your account yours", body: "Choose a password nobody could guess, never share it, and sign out on a computer that is not yours. If you think someone else knows it, change it here — and tell your form master." }]),
    ],
  };
}
