/**
 * The settings School Configuration → Policies lets a school decide.
 *
 * One catalogue serves both ends. The page reads it to say what each setting is
 * called, what it can be set to and what it changes; the API reads it to refuse
 * a value the setting cannot hold. Two copies of a list of options is how a
 * select offers a choice the server then rejects.
 *
 * A setting nobody has chosen shows its default, marked as one. Saving writes a
 * `ConfigurationItem` under the `school-policies` resource, keyed by `code`.
 */

export type PolicyValue = string | string[];
export type PolicyValues = Record<string, PolicyValue>;

export type PolicyField = {
  key: string;
  label: string;
  kind: "select" | "checks";
  options: string[];
  hint?: string;
};

export type PolicyDefinition = {
  code: string;
  area: "academic" | "family" | "students";
  label: string;
  /** The grey line under the setting's name. */
  sub: string;
  /** What it changes, in the school's terms rather than the column's. */
  changes: string;
  fields: PolicyField[];
  defaults: PolicyValues;
};

const lower = (value: string) => value.charAt(0).toLowerCase() + value.slice(1);

const GUARDIAN_SUBMISSIONS = [
  "Absence",
  "Contact change",
  "Correction",
  "Result query",
  "Fee query",
  "Meeting request",
  "Consent action",
  "Withdrawal notice",
];

export const POLICY_DEFINITIONS: PolicyDefinition[] = [
  {
    code: "result_publication_mode",
    area: "academic",
    label: "Result publication mode",
    sub: "Who releases results, and when",
    changes: "Report cards stay unpublished until you publish them, even after approval.",
    fields: [
      {
        key: "mode",
        label: "Result publication mode",
        kind: "select",
        options: [
          "Principal approval, then manual publish",
          "Principal approval, then automatic publish",
          "Exam officer publishes",
        ],
        hint: "Who has to say yes, and whether releasing is a separate act.",
      },
    ],
    defaults: { mode: "Principal approval, then manual publish" },
  },
  {
    code: "score_edit_after_submission",
    area: "academic",
    label: "Score edit after submission",
    sub: "Whether a teacher can revise",
    changes: "A submitted sheet can only change through a correction request, with a reason and evidence.",
    fields: [
      {
        key: "mode",
        label: "Score edit after submission",
        kind: "select",
        options: ["Locked · correction request required", "Open until approved", "Open until published"],
      },
    ],
    defaults: { mode: "Locked · correction request required" },
  },
  {
    code: "attendance_mode",
    area: "academic",
    label: "Attendance mode",
    sub: "Daily, per-period or hybrid",
    changes: "Per-period becomes available once a timetable is published.",
    fields: [
      {
        key: "mode",
        label: "Attendance mode",
        kind: "select",
        options: ["Daily", "Per period", "Hybrid · daily with per-period for senior classes"],
      },
    ],
    defaults: { mode: "Daily" },
  },
  {
    code: "absence_reason_requirement",
    area: "academic",
    label: "Absence reason requirement",
    sub: "Whether a reason is mandatory",
    changes: "A register will not save with an unexplained absence.",
    fields: [
      {
        key: "mode",
        label: "Absence reason requirement",
        kind: "select",
        options: [
          "Required for absent, optional for late",
          "Required for absent and late",
          "Always optional",
        ],
      },
    ],
    defaults: { mode: "Required for absent, optional for late" },
  },
  {
    code: "chronic_absence_threshold",
    area: "academic",
    label: "Chronic absence threshold",
    sub: "When a pattern becomes a case",
    changes: "Crosses into Compliance, Oversight and the student record.",
    fields: [
      {
        key: "mode",
        label: "Chronic absence threshold",
        kind: "select",
        options: [
          "Below 70% in a term",
          "Below 75% in a term",
          "Below 80% in a term",
          "Below 85% in a term",
        ],
      },
    ],
    defaults: { mode: "Below 75% in a term" },
  },
  {
    code: "session_timeout",
    area: "academic",
    label: "Session timeout",
    sub: "Idle time before sign-out",
    changes: "Unsaved entry is preserved locally through a timeout.",
    fields: [
      {
        key: "mode",
        label: "Session timeout",
        kind: "select",
        options: ["15 minutes", "30 minutes", "60 minutes", "2 hours"],
      },
    ],
    defaults: { mode: "30 minutes" },
  },
  {
    code: "guardian_portal_visibility",
    area: "family",
    label: "Guardian portal visibility",
    sub: "What a parent can see",
    changes: "What a guardian finds when they open the portal for their child.",
    fields: [
      {
        key: "sees",
        label: "A guardian can see",
        kind: "checks",
        options: ["Results", "Attendance", "Fees", "Announcements", "Timetable", "Report cards"],
      },
    ],
    defaults: { sees: ["Results", "Attendance", "Fees", "Announcements", "Timetable", "Report cards"] },
  },
  {
    code: "student_portal_visibility",
    area: "family",
    label: "Student portal visibility",
    sub: "What a student can see",
    changes: "Fee detail is never shown to students.",
    fields: [
      {
        key: "sees",
        label: "A student can see",
        kind: "checks",
        options: ["Results", "Attendance", "Timetable", "Announcements"],
        hint: "Fees are not on this list because a student is never shown them.",
      },
    ],
    defaults: { sees: ["Results", "Attendance", "Timetable", "Announcements"] },
  },
  {
    code: "guardian_submissions",
    area: "family",
    label: "Accepted guardian submissions",
    sub: "Which requests a parent can send",
    changes:
      "Consent actions and withdrawal notices are handled in person by school policy.",
    fields: [
      {
        key: "accepts",
        label: "Accepted from a guardian",
        kind: "checks",
        options: GUARDIAN_SUBMISSIONS,
      },
    ],
    defaults: {
      accepts: ["Absence", "Contact change", "Correction", "Result query", "Fee query", "Meeting request"],
    },
  },
  {
    code: "mass_communication_threshold",
    area: "family",
    label: "Mass communication threshold",
    sub: "When a send needs approval",
    changes: "A larger send waits for a decision before it goes out.",
    fields: [
      {
        key: "mode",
        label: "Mass communication threshold",
        kind: "select",
        options: [
          "Above 50 recipients",
          "Above 100 recipients",
          "Above 150 recipients",
          "Above 300 recipients",
          "Never needs approval",
        ],
      },
    ],
    defaults: { mode: "Above 150 recipients" },
  },
  {
    code: "default_channel_window",
    area: "family",
    label: "Default channel and contact window",
    sub: "Shared with Automation",
    changes: "The channel a message goes by, and the hours a family may be contacted.",
    fields: [
      {
        key: "channel",
        label: "Default channel",
        kind: "select",
        options: ["SMS", "WhatsApp", "Email", "In-app"],
      },
      {
        key: "opens",
        label: "Contact window opens",
        kind: "select",
        options: ["06:00", "07:00", "08:00", "09:00"],
      },
      {
        key: "closes",
        label: "Contact window closes",
        kind: "select",
        options: ["17:00", "18:00", "19:00", "20:00", "21:00"],
      },
    ],
    defaults: { channel: "SMS", opens: "07:00", closes: "19:00" },
  },
  {
    code: "student_homework",
    area: "students",
    label: "Homework hand-in",
    sub: "Whether students hand work in on the portal",
    changes: "Off, students still see what is set and when it is due; they hand it in on paper.",
    fields: [{ key: "mode", label: "Homework hand-in", kind: "select", options: ["Students hand work in on the portal", "On paper — the portal only shows what is set"] }],
    defaults: { mode: "Students hand work in on the portal" },
  },
  {
    code: "student_questions",
    area: "students",
    label: "Questions to teachers",
    sub: "Whether a student can ask a teacher from the portal",
    changes: "Off, the Ask a teacher buttons go and a student asks in person.",
    fields: [{ key: "mode", label: "Questions to teachers", kind: "select", options: ["Students may ask their teachers", "Students may not ask from the portal"] }],
    defaults: { mode: "Students may ask their teachers" },
  },
  {
    code: "student_question_readers",
    area: "students",
    label: "Who can read a student’s questions",
    sub: "A safeguarding choice",
    changes: "The form master sees the questions their arm has put to other teachers, read only. Nobody else does.",
    fields: [{ key: "mode", label: "Who can read a student’s questions", kind: "select", options: ["The teacher asked, and the form master", "Only the teacher asked"] }],
    defaults: { mode: "The teacher asked, and the form master" },
  },
  {
    code: "student_quiet_hours",
    area: "students",
    label: "Students’ quiet hours",
    sub: "When no email is sent to a student",
    changes: "A student who has chosen their own hours keeps them. The in-app notice is always there.",
    fields: [{ key: "mode", label: "Students’ quiet hours", kind: "select", options: ["None", "21:00 – 07:00", "22:00 – 06:00"] }],
    defaults: { mode: "21:00 – 07:00" },
  },
  {
    code: "student_calendar_link",
    area: "students",
    label: "Phone calendar link",
    sub: "A private link a student adds to their phone",
    changes: "Off, students cannot make a link, and any link already made stops working.",
    fields: [{ key: "mode", label: "Phone calendar link", kind: "select", options: ["Students may use a phone calendar link", "Students may not"] }],
    defaults: { mode: "Students may use a phone calendar link" },
  },
];

export function policyDefinition(code: string): PolicyDefinition | undefined {
  return POLICY_DEFINITIONS.find((item) => item.code === code);
}

/** What the table shows in the Value column for a setting's current values. */
export function summarisePolicy(code: string, values: PolicyValues): string {
  const list = (key: string) => {
    const found = values[key];
    return Array.isArray(found) ? found : [];
  };
  const one = (key: string) => {
    const found = values[key];
    return typeof found === "string" ? found : "";
  };

  if (code === "guardian_portal_visibility") {
    const items = list("sees");
    return items.length ? items.map((item, index) => (index === 0 ? item : lower(item))).join(", ") : "Nothing";
  }
  if (code === "student_portal_visibility") {
    const items = list("sees");
    if (!items.length) return "Nothing";
    if (items.length === 2 && items.includes("Results") && items.includes("Attendance")) {
      return "Results and attendance only";
    }
    return items.map((item, index) => (index === 0 ? item : lower(item))).join(", ");
  }
  if (code === "guardian_submissions") {
    const items = list("accepts");
    return items.length
      ? items.map((item, index) => (index === 0 ? item : lower(item))).join(", ")
      : "No request is accepted";
  }
  if (code === "default_channel_window") {
    return `${one("channel")} · ${one("opens")}–${one("closes")} WAT`;
  }
  return one("mode");
}

/** A line that depends on the values, where the static `sub` would go stale. */
export function policySub(definition: PolicyDefinition, values: PolicyValues): string {
  if (definition.code === "guardian_submissions") {
    const accepted = Array.isArray(values.accepts) ? values.accepts.length : 0;
    return `${accepted} of ${GUARDIAN_SUBMISSIONS.length} types accepted`;
  }
  return definition.sub;
}

/** The first problem with a payload, or null. Unknown keys are ignored by the caller. */
export function validatePolicyValues(definition: PolicyDefinition, input: Record<string, unknown>): string | null {
  for (const field of definition.fields) {
    const given = input[field.key];
    if (given === undefined) return `${field.label} is missing.`;
    if (field.kind === "select") {
      if (typeof given !== "string" || !field.options.includes(given)) {
        return `${field.label} has to be one of the choices offered.`;
      }
    } else {
      if (!Array.isArray(given) || given.some((item) => typeof item !== "string" || !field.options.includes(item))) {
        return `${field.label} has to be chosen from the options offered.`;
      }
    }
  }
  return null;
}
