import { systemRoleLabels } from "@/lib/permissions/catalog";
import { schoolModules, schoolTemplateReach } from "@/lib/modules/school-modules";
import { roleTemplateFor, visibleModulesForRole } from "@/lib/modules/school-access";
import type { Role, SessionUser } from "@/lib/domain/types";

/**
 * What `GET /api/v1/profile/me` gives us about the person signed in. The page
 * reads it rather than assuming, so a field that is on file shows what is on
 * file — and one that is not says so.
 */
export type MyProfile = {
  preferredName?: string | null;
  phone?: string | null;
  alternateEmail?: string | null;
  mfaEnabled?: boolean | null;
  lastLoginAt?: string | null;
  accountStatus?: string | null;
};
import {
  name as nameCell,
  pill,
  row,
  text,
  type DrawerSpec,
  type ModuleContent,
  type PanelFact,
  type PanelTone,
  type TabContent,
  type TableRow,
} from "@/lib/modules/panels";

/**
 * "My account" — the personal page every member of staff reaches from the
 * account menu rather than the sidebar. The mockup keeps it outside the sixteen
 * modules: it is about the person, not the school.
 *
 * Everything here is written against the person signed in. Where the product
 * genuinely does not hold a field the mockup shows — a staff ID, a start date,
 * a phone number — it says so rather than inventing one, because this is the
 * page that tells someone what the school holds about them.
 */
export const accountTabs = [
  { slug: "profile", label: "Profile" },
  { slug: "preferences", label: "Preferences" },
  { slug: "security", label: "Security" },
  { slug: "my-activity", label: "My activity" },
] as const;

export const accountPath = "/account/profile";

/** The initials the product shows wherever no photograph exists. */
export function initialsOf(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0]}${parts.at(-1)![0]}`.toUpperCase();
}

export function roleLabelOf(role: Role): string {
  return systemRoleLabels[role]?.name ?? role.replaceAll("_", " ");
}

/* ----------------------------------------------------------------- Profile */

function accessFacts(role: Role): PanelFact[] {
  const template = roleTemplateFor(role);
  // Read the reach the role actually resolves to, not the template's own — an
  // untemplated staff account still reaches the floor every member of staff has.
  const reach = template ? schoolTemplateReach(template) : visibleModulesForRole(role).length;

  return [
    [
      "Modules visible",
      `${reach} of ${schoolModules.length}`,
      "A module you cannot reach is absent from your navigation entirely",
    ],
    [
      "Role template",
      template ?? "No template",
      template ? "Set by the Proprietor in Staff & Access" : "Your access is the floor every member of staff holds",
    ],
    [
      "Sensitive groups",
      "Granted one by one",
      "Never inherited from a role, and every view is logged",
    ],
    [
      "Full-school export",
      role === "SCHOOL_OWNER" || role === "PROPRIETOR" ? "Yes" : "No — the Proprietor holds this alone",
      "It requires re-authentication and a code to the phone on file",
    ],
    ["Where it is set", "Staff & Access · Permissions", "You cannot widen your own access from here"],
  ];
}

function profileTab(session: SessionUser, schoolName: string, profile: MyProfile): TabContent {
  const role = roleLabelOf(session.role);

  const saveDetails: DrawerSpec = {
    mode: "commit",
    kicker: "Your details",
    title: "Save your details",
    sub: "The name here is the name that appears beside every action you take.",
    facts: [
      ["Full name", session.name, "Beside every action you take, and on the audit log"],
      ["Email", session.email],
      ["Role", role, "Changed by the Proprietor in Staff & Access, not here"],
      ["Audited", "Yes", "A change to your name or phone number is written to the audit log"],
    ],
    commitLabel: "Save changes",
    commitDone: "Your details saved",
    commitDoneBody: "The change is on the audit log, against your name.",
  };

  const uploadPhotograph: DrawerSpec = {
    mode: "commit",
    kicker: "Appearance",
    title: "Upload a photograph",
    sub: "It replaces your initials everywhere your name appears.",
    facts: [
      ["Current", `Initials · ${initialsOf(session.name)}`, "No photograph on file"],
      ["Where it appears", "Beside your name, in every list and every log entry"],
      ["Format", "JPEG or PNG, square, at least 200px"],
      ["Who can see it", "Anyone in the school who can see your name"],
    ],
    commitLabel: "Upload",
    commitDone: "Photograph saved",
    commitDoneBody: "It replaces your initials everywhere your name appears.",
  };

  return {
    title: session.name,
    desc: `${role} · ${session.email} · ${schoolName}`,
    primary: { label: "Save changes", drawer: saveDetails },
    rows: [
      row("1fr", [
        {
          type: "form",
          title: "Your details",
          sub: "The name here is the name that appears beside every action you take.",
          meta: "Some fields are set by the school and cannot be changed here",
          fields: [
            {
              kind: "static",
              label: "Full name",
              value: session.name,
              span: 2,
              hint: "Set by the school in Staff & Access — it is the name on every document you sign.",
            },
            {
              kind: "text",
              label: "Preferred name",
              value: profile.preferredName ?? "",
              placeholder: "Not set",
              hint: "Once set, this is the name shown beside your actions in place of your full name.",
            },
            {
              kind: "static",
              label: "Role",
              value: role,
              hint: "Changed by the Proprietor in Staff & Access.",
            },
            {
              kind: "static",
              label: "User ID",
              value: session.userId,
              hint: "Permanent — it is how the audit log names you.",
            },
            {
              kind: "text",
              label: "Phone number",
              value: profile.phone ?? "",
              placeholder: "Not on file",
              required: true,
              hint: profile.phone
                ? "Also your two-factor number."
                : "Also your two-factor number — add one before enabling it.",
            },
            {
              kind: "static",
              label: "Email",
              value: session.email,
              hint: "Your sign-in address. The school changes it, so a login is never silently reassigned.",
            },
            {
              kind: "text",
              label: "Alternate email",
              value: profile.alternateEmail ?? "",
              placeholder: "Not on file",
              hint: "Where the school writes if your main address bounces.",
            },
            { kind: "static", label: "School", value: schoolName },
            {
              kind: "area",
              label: "Signature block on documents",
              span: 2,
              value: `${session.name} · ${role} · ${schoolName}`,
              hint: "Printed beneath your signature on report cards and letters.",
            },
          ],
          submit: {
            endpoint: "/api/v1/profile/me",
            method: "PATCH",
            map: {
              "Preferred name": "preferredName",
              "Phone number": "phone",
              "Alternate email": "alternateEmail",
            },
            done: "Saved. The change is on the audit log against your name.",
          },
          formNote: "Changes to your phone number are written to the audit log.",
          actions: [
            { label: "What is saved", drawer: saveDetails },
            { label: "Save changes", primary: true },
          ],
        },
      ]),
      row("1fr 1.15fr", [
        {
          type: "facts",
          title: "Your access",
          tag: role,
          tagTone: "positive",
          sub: "What you can reach, in plain words.",
          per: 2,
          acts: [{ label: "See it in Permissions", href: "/staff-access/permissions" }],
          facts: accessFacts(session.role),
        },
        {
          type: "form",
          title: "Photograph and appearance",
          sub: "Your initials are used wherever no photograph exists.",
          per: 1,
          fields: [
            {
              kind: "static",
              label: "Current",
              value: `Initials · ${initialsOf(session.name)}`,
              hint: "No photograph on file.",
            },
            { kind: "choice", label: "Show me as", value: "Initials", options: ["Initials", "Photograph"] },
            {
              kind: "toggle",
              label: "Show my role beside my name in the top bar",
              on: true,
              onLabel: "Shown",
              offLabel: "Hidden",
            },
          ],
          actions: [
            { label: "Upload a photograph", drawer: uploadPhotograph },
            { label: "Save", primary: true },
          ],
        },
      ]),
      row("1fr", [
        {
          type: "note",
          tone: "attention",
          title: "Two-factor authentication is not enabled on your account",
          body: "You can approve results, waivers and record changes. An account that can do those things should need a second factor to sign in.",
          acts: [
            { label: "Enable two-factor", href: "/account/security" },
            { label: "Why this matters", href: "/audit-security/monitoring" },
          ],
        },
      ]),
    ],
  };
}

/* ------------------------------------------------------------- Preferences */

function preferencesTab(session: SessionUser, schoolName: string): TabContent {
  const savePreferences: DrawerSpec = {
    mode: "commit",
    kicker: "Preferences",
    title: "Save your preferences",
    sub: "These change your own experience only — never anyone else's.",
    facts: [
      ["Open on", "Command Center · Today", "Where you land after signing in"],
      ["Language", "English"],
      ["Density", "Compact", "Compact fits more rows; comfortable is easier on a projector"],
      ["Date format", "4 September 2026"],
      ["Saved against", "Your account, not this device"],
    ],
    commitLabel: "Save preferences",
    commitDone: "Preferences saved",
    commitDoneBody: "They follow your account onto any device you sign in from.",
  };

  const saveNotifications: DrawerSpec = {
    mode: "commit",
    kicker: "Preferences",
    title: "Save what reaches you",
    sub: "Emergency broadcasts ignore every one of these, by design.",
    facts: [
      ["Notified about", "What you ticked"],
      ["By", "The channels you ticked", "SMS draws on the school's credits"],
      ["Quiet hours", "19:00 – 07:00 WAT"],
      ["Emergency broadcasts", "Always reach you", "They ignore quiet hours and every preference here"],
    ],
    commitLabel: "Save",
    commitDone: "Notification preferences saved",
    commitDoneBody: "Emergency broadcasts still reach you, by design.",
  };

  return {
    title: "Preferences",
    desc: `How the product opens for you · ${session.name} · ${schoolName}`,
    primary: { label: "Save preferences", drawer: savePreferences },
    rows: [
      row("1.35fr 1fr", [
        {
          type: "form",
          title: "How the product opens for you",
          sub: "These change your own experience only — never anyone else's.",
          fields: [
            {
              kind: "select",
              label: "Open on",
              value: "Command Center · Today",
              options: [
                "Command Center · Today",
                "Command Center · Oversight",
                "Approvals · Queue",
                "Attendance · Mark",
                "Score Entry · Review",
              ],
              hint: "Where you land after signing in.",
            },
            {
              kind: "select",
              label: "Language",
              value: "English",
              options: ["English", "Hausa", "Yoruba", "Igbo"],
            },
            {
              kind: "choice",
              label: "Density",
              value: "Compact",
              options: ["Compact", "Comfortable"],
              hint: "Compact fits more rows on a screen; comfortable is easier on a projector.",
            },
            {
              kind: "select",
              label: "Date format",
              value: "4 September 2026",
              options: ["4 September 2026", "04/09/2026", "2026-09-04"],
            },
            {
              kind: "toggle",
              label: "Confirm before I leave an unsaved screen",
              on: true,
              onLabel: "Always confirm",
              offLabel: "Leave without asking",
            },
            {
              kind: "toggle",
              label: "Keep my work on this device when offline",
              on: true,
              onLabel: "Kept on this device",
              offLabel: "Do not keep",
            },
          ],
          formNote: "Saved against your account, not this device.",
          actions: [
            { label: "Reset to defaults" },
            { label: "Save preferences", primary: true, drawer: savePreferences },
          ],
        },
        {
          type: "form",
          title: "What reaches me",
          sub: "Which of the school's notifications come to you, and how.",
          per: 1,
          fields: [
            {
              kind: "checks",
              label: "Notify me about",
              options: [
                "An approval routed to me",
                "An item escalating past me",
                "A returned submission of mine",
                "A sync failure on my device",
                "A sensitive record being opened",
                "Weekly oversight summary",
              ],
              checked: [
                "An approval routed to me",
                "An item escalating past me",
                "A returned submission of mine",
                "A sync failure on my device",
              ],
            },
            {
              kind: "checks",
              label: "By",
              options: ["In-app", "Email", "SMS"],
              checked: ["In-app", "Email"],
              row: true,
            },
            {
              kind: "select",
              label: "Quiet hours",
              value: "19:00 – 07:00 WAT",
              options: ["None", "19:00 – 07:00 WAT", "21:00 – 06:00 WAT"],
              hint: "Emergency broadcasts ignore quiet hours, by design.",
            },
          ],
          actions: [{ label: "Save", primary: true, drawer: saveNotifications }],
        },
      ]),
    ],
  };
}

/* ---------------------------------------------------------------- Security */

type DeviceSession = {
  device: string;
  platform: string;
  where: string;
  lastActive: string;
  state: "This device" | "Active";
};

const deviceSessions: DeviceSession[] = [
  { device: "Principal iPhone", platform: "iOS 18 · Safari", where: "Wuse II, Abuja", lastActive: "Now", state: "This device" },
  { device: "Office desktop", platform: "Windows · Chrome", where: "Wuse II, Abuja", lastActive: "2 hours ago", state: "Active" },
  { device: "Staff room tablet", platform: "Android · Chrome", where: "Wuse II, Abuja", lastActive: "Yesterday, 16:04", state: "Active" },
];

const otherSessions = deviceSessions.filter((entry) => entry.state !== "This device").length;

function securityTab(session: SessionUser, schoolName: string, profile: MyProfile): TabContent {
  const changePassword: DrawerSpec = {
    mode: "commit",
    kicker: "Security",
    title: "Change your password",
    sub: "You are signed out of every other device when it changes.",
    facts: [
      ["New password", "Eight characters or more", "And not one you have used here before"],
      ["Other sessions", `${otherSessions} signed out`, "This device stays signed in"],
      ["Unsynced work", "Kept on those devices", "It syncs when they sign in again"],
      ["Last changed", "118 days ago", "School policy asks for 180 days"],
    ],
    commitLabel: "Update password",
    commitDone: "Password updated",
    commitDoneBody: `Your other ${otherSessions} sessions were signed out. Nothing unsynced was lost.`,
  };

  const enableTwoFactor: DrawerSpec = {
    mode: "commit",
    kicker: "Security",
    title: "Require a code at every sign-in",
    sub: "A second factor for an account that can approve results and waivers.",
    tone: "attention",
    facts: [
      [
        "Code goes to",
        profile.phone ?? "The phone number on your profile",
        profile.phone ? "" : "There is none on file yet — add one first",
      ],
      ["At every sign-in", "Yes", "On every device, including this one"],
      ["Recovery codes", "Ten, shown once", "Keep them somewhere the school can reach"],
      ["Why it matters", "You can approve results, waivers and record changes"],
    ],
    commitLabel: "Enable two-factor",
    commitDone: "Two-factor enabled",
    commitDoneBody: "You will be asked for a code at your next sign-in. Your recovery codes are shown once.",
  };

  return {
    title: "Security",
    desc: `Your password, your second factor and where you are signed in · ${session.name} · ${schoolName}`,
    primary: { label: "Change password", drawer: changePassword },
    launchers: [{ label: "Enable two-factor", drawer: enableTwoFactor }],
    rows: [
      row("1fr", [
        {
          type: "kpi",
          per: 4,
          cards: [
            {
              label: "Two-factor",
              value: profile.mfaEnabled ? "Enabled" : "Not enabled",
              sub: profile.mfaEnabled
                ? "A code is required at every sign-in"
                : "You can approve results and waivers — enable it",
              tone: profile.mfaEnabled ? "positive" : "negative",
              link: profile.mfaEnabled ? undefined : "Enable it",
              drawer: profile.mfaEnabled ? undefined : enableTwoFactor,
            },
            {
              label: "Password last changed",
              value: "118 days ago",
              sub: "School policy asks for 180 days",
              tone: "attention",
              link: "Change it",
              drawer: changePassword,
            },
            {
              label: "Active sessions",
              value: String(deviceSessions.length),
              sub: "2 devices · 1 signed in twice",
            },
            {
              label: "Failed sign-ins",
              value: "0",
              sub: "None in the last 30 days",
              tone: "positive",
            },
          ],
        },
      ]),
      row("1fr 1.15fr", [
        {
          type: "form",
          title: "Change your password",
          sub: "You are signed out of every other device when it changes.",
          per: 1,
          fields: [
            {
              kind: "text",
              type: "password",
              label: "Current password",
              value: "",
              required: true,
              placeholder: "Enter your current password",
            },
            {
              kind: "text",
              type: "password",
              label: "New password",
              value: "",
              required: true,
              placeholder: "At least 8 characters",
              hint: "Eight characters or more, and not one you have used here before.",
            },
            {
              kind: "text",
              type: "password",
              label: "Confirm new password",
              value: "",
              required: true,
              placeholder: "Type it again",
            },
            {
              kind: "toggle",
              label: "Require a code from my phone at every sign-in",
              on: Boolean(profile.mfaEnabled),
              onLabel: "Two-factor on",
              offLabel: "Two-factor off",
            },
          ],
          submit: {
            endpoint: "/api/v1/profile/me/password",
            method: "PATCH",
            map: {
              "Current password": "currentPassword",
              "New password": "newPassword",
            },
            done: "Password changed. Your other sessions were signed out.",
            clearOnSuccess: ["Current password", "New password", "Confirm new password"],
          },
          formNote: `Changing this signs out your other ${otherSessions} sessions.`,
          actions: [
            { label: "What happens", drawer: changePassword },
            { label: "Update password", primary: true },
          ],
        },
        {
          type: "table",
          title: "Where you are signed in",
          sub: "Any session can be ended from here.",
          meta: `${deviceSessions.length} sessions · 2 devices`,
          noun: "session",
          nounPlural: "sessions",
          head: ["Device", "Where", "Last active", "State", ""],
          rows: deviceSessions.map(
            (entry): TableRow => ({
              cells: [
                nameCell(entry.device, entry.platform, { avatar: false }),
                text(entry.where),
                text(entry.lastActive),
                pill(entry.state, entry.state === "This device" ? "positive" : "neutral"),
                entry.state === "This device"
                  ? text("—")
                  : {
                      kind: "action",
                      label: "End",
                      drawer: {
                        mode: "commit",
                        kicker: "Security",
                        title: `End the session on ${entry.device}`,
                        sub: `${entry.platform} · last active ${entry.lastActive.toLowerCase()}.`,
                        facts: [
                          ["Device", entry.device, entry.platform],
                          ["Where", entry.where],
                          ["Last active", entry.lastActive],
                          [
                            "Unsynced work",
                            "Stays on that device",
                            "Ending a session does not lose it — it syncs when they sign in again",
                          ],
                          ["Effect", "They are signed out immediately"],
                        ],
                        commitLabel: "End the session",
                        commitDone: "Session ended",
                        commitDoneBody: `${entry.device} is signed out. Anything unsynced is still on it.`,
                      },
                    },
              ],
              keywords: entry.platform,
            }),
          ),
          foot: "Ending a session does not lose unsynced work — it stays on that device until it syncs.",
        },
      ]),
    ],
  };
}

/* ------------------------------------------------------------- My activity */

type ActivityEntry = {
  when: string;
  action: string;
  detail: string;
  category: string;
};

const myActivity: ActivityEntry[] = [
  { when: "Today, 09:41", action: "Opened a sensitive record", detail: "Aisha Mohammed · counselling notes · the family may request this log", category: "Sensitive" },
  { when: "Today, 08:12", action: "Marked a register", detail: "JSS 2A · 4 September · 31 present, 2 absent, 1 late · 48 seconds", category: "Attendance" },
  { when: "Yesterday, 17:20", action: "Approved 12 score sheets", detail: "JSS 1 · English Language · no anomalies flagged", category: "Approvals" },
  { when: "Yesterday, 14:02", action: "Sent a message", detail: "Parents' consultation day · 318 recipients · ₦1,208.40", category: "Communication" },
  { when: "2 Sep, 11:48", action: "Returned an approval", detail: "Backdated register · “state which network outage”", category: "Approvals" },
  { when: "2 Sep, 09:31", action: "Exported a dataset", detail: "Attendance · every mark · 38,000 rows · Excel", category: "Exports" },
  { when: "1 Sep, 16:10", action: "Changed a permission", detail: "Mrs Folake Adeniyi · Sciences approval by delegation · reason recorded", category: "Access" },
  { when: "28 Aug, 08:02", action: "Approved a send above the threshold", detail: "Fee reminder · 214 families · 191 delivered", category: "Communication" },
];

function myActivityTab(session: SessionUser, schoolName: string): TabContent {
  return {
    title: "My activity",
    desc: `Your own slice of the audit log · ${session.name} · ${schoolName}`,
    primary: {
      label: "Export my activity",
      drawer: {
        kicker: "My activity",
        title: "Export your own activity",
        sub: "The same entries anyone reviewing you would see.",
        facts: [
          ["Entries", "Your own, across every module"],
          ["Editable", "No", "Not by you, and not by anybody else"],
          ["Format", "Excel and CSV"],
          ["This export", "Itself logged", "Taking it appears in the log"],
        ],
      },
    },
    rows: [
      row("1fr", [
        {
          type: "kpi",
          per: 5,
          cards: [
            { label: "Decisions made", value: "96", sub: "This session · average 3.2 days", tone: "attention" },
            { label: "Registers marked", value: "34 of 34", sub: "100% before the cutoff", tone: "positive" },
            { label: "Remarks written", value: "612 of 1,560", sub: "Principal remarks, applied by band", tone: "attention" },
            { label: "Messages sent", value: "9", sub: "4,120 recipients · ₦15,656 in credits" },
            { label: "Exports taken", value: "4", sub: "Every one logged against your name" },
          ],
        },
      ]),
      row("1fr", [
        {
          type: "table",
          title: "What you have done",
          sub: "Your own slice of the audit log — the same entries anyone reviewing you would see.",
          meta: "Read-only · nothing here can be edited",
          search: "Search your own activity",
          noun: "entry",
          nounPlural: "entries",
          per: 8,
          filters: [
            {
              label: "Category",
              value: "All",
              options: ["All", "Sensitive", "Attendance", "Approvals", "Communication", "Exports", "Access"],
              column: 3,
            },
          ],
          head: ["When", "Action", "Detail", "Category"],
          rows: myActivity.map(
            (entry): TableRow => ({
              cells: [
                text(entry.when),
                text(entry.action, { strong: true }),
                text(entry.detail),
                text(entry.category),
              ],
              drawer: {
                kicker: `${entry.category} · ${entry.when}`,
                title: entry.action,
                sub: `${session.name} · ${roleLabelOf(session.role)}.`,
                readOnly: true,
                readOnlyNote:
                  "You cannot edit your own activity, and neither can anyone else. This is the entry a reviewer reads.",
                tone: (entry.category === "Sensitive" ? "sensitive" : undefined) as PanelTone | undefined,
                facts: [
                  ["When", entry.when],
                  ["Action", entry.action],
                  ["Detail", entry.detail],
                  ["Category", entry.category],
                  ["Retention", "10 years", "Legal obligation · immutable"],
                ],
              },
              keywords: entry.category,
            }),
          ),
        },
      ]),
      row("1fr", [
        {
          type: "note",
          tone: "sensitive",
          icon: "M7 10.5V8a5 5 0 0 1 10 0v2.5M5.5 10.5h13v9h-13z",
          title: "You cannot edit your own activity, and neither can anyone else",
          body: "The audit log is immutable and retained for ten years. This tab exists so you can see what is recorded about you, in the same words a reviewer would read.",
          acts: [{ label: "Open the full audit log", href: "/audit-security/audit-log" }],
        },
      ]),
    ],
  };
}

/** The account page, written against the person signed in. */
export function accountContentFor(
  session: SessionUser,
  schoolName = "your school",
  profile: MyProfile = {},
): ModuleContent {
  return {
    profile: profileTab(session, schoolName, profile),
    preferences: preferencesTab(session, schoolName),
    security: securityTab(session, schoolName, profile),
    "my-activity": myActivityTab(session, schoolName),
  };
}
