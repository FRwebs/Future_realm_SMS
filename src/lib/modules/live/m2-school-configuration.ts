import { apiGet } from "@/lib/api/server";
import {
  pill,
  text,
  type Panel,
  type PanelFact,
  type PanelRow,
  type TabContent,
  type TableRow,
} from "@/lib/modules/panels";

/**
 * M02 School Configuration, read from `GET /v1/configuration/:resource`.
 *
 * That module already owns this ground — school-information, sessions-terms,
 * school-calendar, subjects and class-levels are all resources it serves and
 * accepts writes for — so this tab needed no new endpoint. What it needed was
 * to stop describing a school and start showing one.
 *
 * Every write here goes back through the same module: the profile form PATCHes
 * school-information, and the calendar's buttons POST to sessions-terms and
 * school-calendar. Nothing on this page reports a change it did not make.
 */

type SchoolRecord = {
  id: string;
  name: string;
  slug: string;
  category: string;
  schoolCode: string | null;
  address: string | null;
  city: string | null;
  lga: string | null;
  state: string | null;
  country: string | null;
  website: string | null;
  timezone: string;
  currency: string;
  academicYearLabel: string;
  termLabel: string;
  ownerName: string | null;
  ownerEmail: string | null;
  ownerPhone: string | null;
  cacNumber: string | null;
  ministryApprovalNumber: string | null;
  subdomain: string | null;
  verifiedAt: string | null;
  estimatedStudentCount: number | null;
  logoUrl: string | null;
  primaryColor: string | null;
  secondaryColor: string | null;
  shortName: string | null;
  motto: string | null;
  vision: string | null;
  schoolType: string | null;
  curriculumPreference: string | null;
  principalName: string | null;
  principalPhone: string | null;
  principalEmail: string | null;
  levelsOperated: string[];
};

type BrandingVersion = {
  id: string;
  logoUrl: string | null;
  primaryColour: string;
  secondaryColour: string;
  appliedTo: string;
  status: string;
  createdAt: string;
};

type TermRecord = {
  id: string;
  name: string;
  order: number;
  startDate: string;
  endDate: string;
  isCurrent: boolean;
};

type SessionRecord = {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  isCurrent: boolean;
  terms: TermRecord[];
};

type CalendarRecord = {
  id: string;
  title: string;
  category?: string | null;
  startsAt: string;
  endsAt: string;
  description?: string | null;
};

type SubjectRecord = {
  id: string;
  name: string;
  code: string | null;
  /** The resource returns the id only — it does not join the department name. */
  departmentId: string | null;
  section: string | null;
  isCore: boolean | null;
  isWaecSubject: boolean | null;
  periodsPerWeek: number | null;
};

type ClassLevelRecord = { id: string; name: string; order: number };

const CONFIG = "/api/v1/configuration";

/** The note panel takes an SVG path, not an icon name; its default is a warning triangle. */
const CHECK_ICON = "M20 6 9 17l-5-5";

function dateLabel(iso: string | null | undefined): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" });
}

/** Where a term sits relative to today, which is derived and never stored. */
function termState(term: TermRecord): { label: string; tone: "positive" | "attention" | "neutral" } {
  const now = Date.now();
  const start = new Date(term.startDate).getTime();
  const end = new Date(term.endDate).getTime();
  if (now < start) return { label: "Upcoming", tone: "neutral" };
  if (now > end) return { label: "Closed", tone: "neutral" };
  return { label: "In progress", tone: "positive" };
}

/* ─────────────────────────── Profile ─────────────────────────── */

function identityDrawer(school: SchoolRecord) {
  return {
    mode: "commit" as const,
    kicker: "School profile",
    title: "Edit identity",
    sub: "The school name here is the name printed on every report card.",
    commitLabel: "Save identity",
    commitNote: "Cards already issued keep the name they were printed with.",
    commitDone: "Identity saved",
    commitDoneBody: "Everything printed from now carries the new name.",
    // The mockup leads a commit drawer with context and what the save will do,
    // then the boxes. A drawer that opens straight into inputs tells somebody
    // what to type and not what it changes.
    facts: [
      ["School type", school.schoolType ?? school.category?.replace(/_/g, " ") ?? "—"],
      [
        "Levels operated",
        school.levelsOperated?.length ? school.levelsOperated.join(" · ") : "none configured",
        "Read from the class levels this school runs",
      ],
      ["Workspace", school.subdomain ? `${school.subdomain}.futurerealm.school` : school.slug],
      [
        "Effect",
        "Every card printed from now carries the new name",
        "Cards already issued keep theirs",
      ],
    ] as PanelFact[],
    fields: [
      { label: "School name", kind: "text" as const, value: school.name, required: true, span: 2 as const },
      {
        label: "Short name",
        kind: "text" as const,
        value: school.shortName ?? "",
        optional: true,
        hint: "Used in SMS, where characters cost money.",
      },
      { label: "School code", kind: "text" as const, value: school.schoolCode ?? "", optional: true },
      { label: "Motto", kind: "text" as const, value: school.motto ?? "", span: 2 as const, optional: true },
      { label: "Vision", kind: "area" as const, value: school.vision ?? "", span: 2 as const, optional: true },
      { label: "Timezone", kind: "text" as const, value: school.timezone, optional: true },
    ],
    submit: {
      endpoint: `${CONFIG}/school-information/${school.id}`,
      method: "PATCH" as const,
      map: {
        "School name": "name",
        "Short name": "shortName",
        "School code": "schoolCode",
        Motto: "motto",
        Vision: "vision",
        Timezone: "timezone",
      },
    },
  };
}

function addressDrawer(school: SchoolRecord) {
  return {
    mode: "commit" as const,
    kicker: "School profile",
    title: "Edit address & authority",
    sub: "Who answers for this school, and where it operates from.",
    commitLabel: "Save address & authority",
    commitNote: "The school name travels with this save because the record is validated whole.",
    commitDone: "Address and authority saved",
    commitDoneBody: "The school record has been updated.",
    facts: [
      ["School", school.name],
      ["CAC number", school.cacNumber ?? "not recorded", "Not editable here — set at registration"],
      [
        "Ministry approval",
        school.ministryApprovalNumber ?? "not recorded",
        "Required to operate; asked for on every return",
      ],
      [
        "Effect",
        "Returns and printed documents use this address from now",
        "Anything already filed keeps the address it carried",
      ],
    ] as PanelFact[],
    fields: [
      { label: "School", kind: "static" as const, value: school.name, span: 2 as const },
      { label: "Address", kind: "text" as const, value: school.address ?? "", span: 2 as const, optional: true },
      { label: "City", kind: "text" as const, value: school.city ?? "", optional: true },
      { label: "State", kind: "text" as const, value: school.state ?? "", optional: true },
      { label: "Country", kind: "text" as const, value: school.country ?? "Nigeria", optional: true },
      { label: "Proprietor", kind: "text" as const, value: school.ownerName ?? "", optional: true },
      { label: "Proprietor email", kind: "text" as const, value: school.ownerEmail ?? "", optional: true },
      { label: "Proprietor phone", kind: "text" as const, value: school.ownerPhone ?? "", optional: true },
    ],
    submit: {
      endpoint: `${CONFIG}/school-information/${school.id}`,
      method: "PATCH" as const,
      map: {
        School: "name",
        Address: "address",
        City: "city",
        State: "state",
        Country: "country",
        Proprietor: "ownerName",
        "Proprietor email": "ownerEmail",
        "Proprietor phone": "ownerPhone",
      },
    },
  };
}

function brandingDrawer(school: SchoolRecord) {
  return {
    mode: "commit" as const,
    kicker: "School profile",
    title: "Edit branding",
    sub: "Anything already printed keeps the branding it was printed with.",
    commitLabel: "Save branding",
    commitNote: "A parent's card is never restated behind them.",
    commitDone: "Branding saved",
    commitDoneBody: "Everything printed from now carries the new colours.",
    facts: [
      ["In force today", `${school.primaryColor ?? "unset"} / ${school.secondaryColor ?? "unset"}`],
      ["Logo", school.logoUrl ?? "none uploaded"],
      [
        "Effect",
        "Everything printed from now carries the new colours",
        "A parent's card is never restated behind them",
      ],
    ] as PanelFact[],
    fields: [
      { label: "School", kind: "static" as const, value: school.name, span: 2 as const },
      { label: "Primary colour", kind: "text" as const, value: school.primaryColor ?? "", optional: true },
      { label: "Secondary colour", kind: "text" as const, value: school.secondaryColor ?? "", optional: true },
      { label: "Logo", kind: "static" as const, value: school.logoUrl ?? "none uploaded", span: 2 as const },
    ],
    submit: {
      endpoint: `${CONFIG}/school-information/${school.id}`,
      method: "PATCH" as const,
      map: {
        School: "name",
        "Primary colour": "primaryColor",
        "Secondary colour": "secondaryColor",
      },
    },
  };
}

/**
 * M02 · Profile, in the shape the mockup draws it: four facts panels, each
 * owning the actions that belong to it.
 *
 * An earlier pass replaced this with one facts panel and two inline forms,
 * which lost every trigger the mockup has. The drawers now carry inputs rather
 * than only describing a change — editing opens in a drawer here, so a drawer
 * that cannot edit makes the whole page read-only.
 */
function brandingHistoryDrawer(branding: BrandingVersion[]) {
  return {
    kicker: "Branding",
    title: "Version history",
    sub: branding.length
      ? "Every version, and what it was applied to."
      : "Nothing has been versioned yet.",
    readOnly: true,
    readOnlyNote:
      "A card already issued keeps the branding it was printed with. History is never rewritten.",
    facts: branding.length
      ? (branding.map((version) => [
          `${version.status.toLowerCase()} · ${dateLabel(version.createdAt)}`,
          `${version.primaryColour} / ${version.secondaryColour} · ${version.appliedTo.replace(/_/g, " ")}`,
        ]) as PanelFact[])
      : ([
          ["Versions on file", "none"],
          [
            "Why",
            "Branding has only ever been set directly on the school record, so there is nothing to compare against.",
          ],
        ] as PanelFact[]),
  };
}

function agreementDrawer() {
  return {
    kicker: "Data processing",
    title: "Data processing agreement",
    sub: "What the product can say about this, honestly.",
    readOnly: true,
    facts: [
      ["Agreement on file", "none"],
      [
        "What exists instead",
        "The school record, the audit trail, and consent per guardian — facts about what is held, not a signed undertaking about how it may be used.",
      ],
      [
        "Why it is not shown",
        "Nothing stores an agreement, its text or its signatory. Printing one here would be inventing a legal document.",
      ],
      ["Where the real figures are", "Audit & Security · Data protection"],
    ] as PanelFact[],
  };
}

function sampleDataDrawer() {
  return {
    kicker: "Data processing",
    title: "Sample data",
    sub: "What can and cannot be said about demonstration records.",
    readOnly: true,
    facts: [
      ["Sample records identifiable", "no", "Nothing marks a row as sample data"],
      [
        "What that means",
        "Seeded and real records are indistinguishable once written, so clearing sample data could delete a real child's record.",
      ],
      [
        "What would fix it",
        "A flag written at seed time, or a separate demonstration school. Either is a decision rather than a button.",
      ],
    ] as PanelFact[],
  };
}

function profileTab(school: SchoolRecord, branding: BrandingVersion[]): TabContent {
  const place = [school.address, school.city, school.lga, school.state, school.country]
    .filter(Boolean)
    .join(", ");
  const inForce = branding.find((version) => version.status === "APPLIED") ?? branding[0] ?? null;
  const registered = Boolean(school.cacNumber && school.ministryApprovalNumber);

  return {
    title: "Profile",
    desc: "Who this school is.",
    primary: { label: "Edit identity", drawer: identityDrawer(school) },
    launchers: [
      { label: "Edit address & authority", drawer: addressDrawer(school) },
      { label: "Edit branding", drawer: brandingDrawer(school) },
    ],
    rows: [
      {
        cols: "1fr",
        panels: [
          {
            type: "facts",
            title: "Identity",
            sub: "The school name here is the name printed on every report card.",
            meta: school.verifiedAt ? `Verified ${dateLabel(school.verifiedAt)}` : "Not yet verified",
            tag: school.verifiedAt ? "Verified" : "Unverified",
            tagTone: school.verifiedAt ? "positive" : "attention",
            per: 3,
            acts: [{ label: "Edit identity", primary: true, drawer: identityDrawer(school) }],
            facts: [
              ["School name", school.name, "As printed on report cards"],
              ["Short name", school.shortName ?? "not set", "Used in SMS, where characters cost money"],
              ["Motto", school.motto ?? "not recorded"],
              ["Vision", school.vision ?? "not recorded"],
              ["School type", school.schoolType ?? school.category?.replace(/_/g, " ") ?? "—"],
              [
                "Levels operated",
                school.levelsOperated?.length ? school.levelsOperated.join(" · ") : "none configured",
                `${school.levelsOperated?.length ?? 0} class levels`,
              ],
              ["Curriculum", school.curriculumPreference ?? "not recorded"],
              ["School code", school.schoolCode ?? "not issued"],
              ["Workspace", school.subdomain ? `${school.subdomain}.futurerealm.school` : school.slug],
              ["Currency", school.currency],
              ["Timezone", school.timezone],
              ["Calls a year / term", `${school.academicYearLabel} · ${school.termLabel}`],
            ],
          },
        ],
      },
      {
        cols: "1.1fr 1fr",
        panels: [
          {
            type: "facts",
            title: "Address and authority",
            sub: "Registration numbers are what a return is checked against.",
            meta: registered ? "Fully registered" : "Registration incomplete",
            tag: registered ? "Complete" : "Missing",
            tagTone: registered ? "positive" : "negative",
            per: 2,
            acts: [{ label: "Edit address & authority", drawer: addressDrawer(school) }],
            facts: [
              ["Address", place || "not recorded"],
              ["Website", school.website ?? "none"],
              ["Proprietor", school.ownerName ?? "not recorded"],
              ["Proprietor email", school.ownerEmail ?? "not recorded"],
              ["Proprietor phone", school.ownerPhone ?? "not recorded"],
              [
                "Principal",
                school.principalName
                  ? `${school.principalName}${school.principalPhone ? ` · ${school.principalPhone}` : ""}`
                  : "none appointed",
                "Read from the staff record, not typed here",
              ],
              ["CAC number", school.cacNumber ?? "not recorded", "Asked for on every return"],
              ["Ministry approval", school.ministryApprovalNumber ?? "not recorded", "Required to operate"],
            ],
          },
          {
            type: "facts",
            title: "Branding",
            sub: "What appears on a report card.",
            meta: branding.length ? `${branding.length} version(s)` : "No version history",
            per: 1,
            acts: [
              { label: "Version history", drawer: brandingHistoryDrawer(branding) },
              { label: "Edit branding", drawer: brandingDrawer(school) },
            ],
            facts: [
              ["Primary colour", school.primaryColor ?? "not set"],
              ["Secondary colour", school.secondaryColor ?? "not set"],
              ["Logo", school.logoUrl ?? "none uploaded"],
              [
                "In force",
                inForce ? `${inForce.primaryColour} / ${inForce.secondaryColour}` : "the colours above",
                inForce ? `Applied to ${inForce.appliedTo.replace(/_/g, " ")}` : "No separate version recorded",
              ],
            ],
          },
        ],
      },
      {
        cols: "1.15fr 1fr",
        panels: [
          {
            type: "facts",
            title: "Data processing agreement",
            sub: "What this school has agreed about the records it holds.",
            meta: "No agreement is recorded",
            tag: "Not signed",
            tagTone: "negative",
            per: 2,
            acts: [{ label: "Read full text", drawer: agreementDrawer() }],
            facts: [
              ["Agreement", "not recorded"],
              ["Signed by", "—"],
              ["Consent records", "Audit & Security · Data protection"],
              ["Audit trail", "Audit & Security · Audit log"],
            ],
          },
          {
            type: "note",
            tone: "attention",
            title: "Sample data cannot be told apart from real records",
            body: "Nothing marks a row as demonstration data, so a 'clear sample data' action could not distinguish a seeded record from a real child's. What would fix it is a flag written at seed time, or a separate demonstration school.",
            acts: [{ label: "Review sample data", drawer: sampleDataDrawer() }],
          },
        ],
      },
    ],
  };
}

/* ─────────────────────────── Calendar ─────────────────────────── */

function calendarTab(sessions: SessionRecord[], events: CalendarRecord[]): TabContent {
  const current = sessions.find((item) => item.isCurrent) ?? sessions[0];
  const terms = sessions.flatMap((item) =>
    item.terms.map((term) => ({ term, sessionName: item.name })),
  );
  const currentTerm = terms.find((item) => item.term.isCurrent);

  const termRows: TableRow[] = terms.map(({ term, sessionName }) => {
    const state = termState(term);
    return {
      cells: [
        text(term.name, { strong: term.isCurrent }),
        text(sessionName),
        text(dateLabel(term.startDate)),
        text(dateLabel(term.endDate)),
        pill(term.isCurrent ? "Current" : state.label, term.isCurrent ? "positive" : state.tone),
      ],
      keywords: `${term.name} ${sessionName}`,
    };
  });

  const eventPanel: Panel = events.length
    ? {
        type: "table",
        title: "School calendar",
        sub: "Holidays, resumption, examinations and everything families are told about.",
        head: ["Event", "Category", "Starts", "Ends"],
        per: 10,
        rows: events.map((event) => ({
          cells: [
            text(event.title, { strong: true }),
            pill(event.category ?? "General"),
            text(dateLabel(event.startsAt)),
            text(dateLabel(event.endsAt)),
          ],
          keywords: `${event.title} ${event.category ?? ""}`,
        })),
      }
    : {
        type: "note",
        tone: "attention",
        title: "No calendar events recorded",
        body: "This school has no holidays, resumption dates or examination windows on file. Until it does, nothing on this page can tell a family when the term starts, and the Command Center's term milestones have nothing to count down to.",
      };

  return {
    title: "Calendar",
    desc: currentTerm
      ? `When the school operates. ${currentTerm.term.name} of ${currentTerm.sessionName} is running.`
      : "When the school operates.",
    launchers: [{ label: "Attendance register", href: "/attendance/register" }],
    rows: [
      {
        cols: "1fr",
        panels: [
          {
            type: "kpi",
            title: "The academic year as configured",
            per: 4,
            cards: [
              {
                label: "Sessions on file",
                value: String(sessions.length),
                sub: current ? `Current: ${current.name}` : "None marked current",
                tone: sessions.length ? undefined : "attention",
              },
              {
                label: "Terms on file",
                value: String(terms.length),
                sub: currentTerm ? `${currentTerm.term.name} is running` : "No term marked current",
                tone: currentTerm ? undefined : "attention",
              },
              {
                label: "Calendar events",
                value: String(events.length),
                sub: events.length ? "Across all sessions" : "Nothing scheduled",
                tone: events.length ? undefined : "attention",
              },
              {
                label: "Session ends",
                value: current ? dateLabel(current.endDate) : "—",
                sub: current ? `Began ${dateLabel(current.startDate)}` : "No session on file",
              },
            ],
          },
        ],
      },
      {
        cols: "1fr",
        panels: [
          termRows.length
            ? {
                type: "table",
                title: "Sessions and terms",
                sub: "Every term this school has configured, and which one is current.",
                meta: `${sessions.length} session${sessions.length === 1 ? "" : "s"} · ${terms.length} terms`,
                head: ["Term", "Session", "Starts", "Ends", "State"],
                per: 10,
                rows: termRows,
              }
            : {
                type: "note",
                tone: "attention",
                title: "No terms configured",
                body: "Attendance, results and fees are all scoped to a term. Until one exists, those modules have nothing to count against.",
              },
        ],
      },
      { cols: "1fr", panels: [eventPanel] },
    ],
  };
}

/* ─────────────────────────── Curriculum ─────────────────────────── */

function sectionLabel(section: string | null): string {
  if (!section) return "Unassigned";
  return section
    .toLowerCase()
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function curriculumTab(subjects: SubjectRecord[], levels: ClassLevelRecord[]): TabContent {
  const core = subjects.filter((item) => item.isCore).length;
  const waec = subjects.filter((item) => item.isWaecSubject).length;
  const noDepartment = subjects.filter((item) => !item.departmentId).length;
  const sections = new Map<string, number>();
  for (const subject of subjects) {
    const key = sectionLabel(subject.section);
    sections.set(key, (sections.get(key) ?? 0) + 1);
  }
  const departments = new Set(subjects.map((item) => item.departmentId).filter(Boolean));
  const periodless = subjects.filter((item) => !item.periodsPerWeek).length;

  const subjectRows: TableRow[] = subjects.map((subject) => ({
    cells: [
      text(subject.name, { strong: true }),
      text(subject.code ?? "—", { mono: true }),
      pill(sectionLabel(subject.section), subject.section ? "neutral" : "attention"),
      text(subject.periodsPerWeek ? `${subject.periodsPerWeek}/week` : "—", {
        tone: subject.periodsPerWeek ? undefined : "attention",
      }),
      pill(subject.isCore ? "Core" : "Elective", subject.isCore ? "positive" : "neutral"),
      text(subject.isWaecSubject ? "WAEC" : "—", {
        tone: subject.isWaecSubject ? "positive" : undefined,
      }),
    ],
    keywords: `${subject.name} ${subject.code ?? ""} ${sectionLabel(subject.section)}`,
  }));

  const sectionRows = Array.from(sections.entries()).sort((a, b) => b[1] - a[1]);

  return {
    title: "Curriculum",
    desc: "The subjects this school teaches, and the levels it teaches them at.",
    launchers: [{ label: "Scheme of work", href: "/class-timetable/teaching" }],
    rows: [
      {
        cols: "1fr",
        panels: [
          {
            type: "kpi",
            title: "What the school teaches",
            per: 5,
            cards: [
              { label: "Subjects", value: String(subjects.length), sub: "On the curriculum" },
              { label: "Core", value: String(core), sub: `${subjects.length - core} elective` },
              { label: "WAEC subjects", value: String(waec), sub: "Carried to the certificate" },
              {
                label: "Departments",
                value: String(departments.size),
                sub: noDepartment ? `${noDepartment} subject(s) unassigned` : "Every subject assigned",
                tone: noDepartment ? "attention" : undefined,
              },
              {
                label: "Class levels",
                value: String(levels.length),
                sub: levels.length
                  ? `${levels[0]?.name} to ${levels[levels.length - 1]?.name}`
                  : "None configured",
                tone: levels.length ? undefined : "attention",
              },
            ],
          },
        ],
      },
      {
        cols: "1.1fr 1fr",
        panels: [
          {
            type: "bars",
            title: "Subjects by section",
            sub: "Where the curriculum is weighted.",
            rows: sectionRows.map(([label, count]) => ({
              label,
              value: count,
              display: `${count}`,
            })),
          },
          periodless
            ? {
                type: "note",
                tone: "attention",
                title: `${periodless} subject${periodless === 1 ? " has" : "s have"} no periods a week`,
                body: "A subject with no period count cannot be placed on a timetable automatically — Class & Timetable has nothing to allocate against it.",
              }
            : {
                type: "note",
                tone: "positive",
                icon: CHECK_ICON,
                title: "Every subject carries a period count",
                body: "Class & Timetable can allocate all of them without being told how long each one runs.",
              },
        ],
      },
      {
        cols: "1fr",
        panels: [
          {
            type: "table",
            title: "Subjects",
            sub: "Everything this school teaches, as configured.",
            meta: `${subjects.length} subjects · ${core} core · ${waec} WAEC`,
            head: ["Subject", "Code", "Section", "Periods", "Kind", "Exam"],
            per: 12,
            rows: subjectRows,
          },
        ],
      },
    ],
  };
}

/* ─────────────────────────── entry ─────────────────────────── */


type PolicyItem = {
  id: string;
  resource: string;
  name: string;
  code: string | null;
  description: string | null;
  data: Record<string, unknown> | null;
  status: string;
  displayOrder: number;
};

/** The four areas whose rules change how the product behaves day to day. */
const POLICY_AREAS: Array<{ resource: string; label: string; blurb: string }> = [
  { resource: "attendance", label: "Attendance", blurb: "When a child counts as late, and when somebody is told." },
  { resource: "promotions", label: "Promotion", blurb: "What it takes to move up, and who signs off a repeat." },
  { resource: "exam", label: "Examination", blurb: "How a mark is composed, and when a result stops being editable." },
  { resource: "finance", label: "Fees", blurb: "When an invoice falls due, and what happens if it does not." },
];

function policyValue(item: PolicyItem): string {
  if (!item.data || typeof item.data !== "object") return "—";
  const entries = Object.entries(item.data);
  if (!entries.length) return "—";
  return entries
    .map(([key, value]) => {
      const label = key
        .replace(/([A-Z])/g, (char) => ` ${char.toLowerCase()}`)
        .replace(/^./, (char) => char.toUpperCase());
      return `${label}: ${String(value)}`;
    })
    .join(" · ");
}

/**
 * M02 · Policies — the rules that make the product behave like this school.
 *
 * They live in ConfigurationItem, which the configuration module has always
 * served. What the tab adds is which areas are *unset*: a policy area with no
 * rule is not a school with no opinion, it is the product falling back to a
 * default nobody here chose.
 */
function policiesTab(byArea: Map<string, PolicyItem[]>): TabContent {
  const set = POLICY_AREAS.filter((area) => (byArea.get(area.resource) ?? []).length > 0);
  const unset = POLICY_AREAS.filter((area) => (byArea.get(area.resource) ?? []).length === 0);
  const total = POLICY_AREAS.reduce((sum, area) => sum + (byArea.get(area.resource) ?? []).length, 0);

  return {
    title: "Policies",
    desc: "The rules that make this product behave like this school.",
    launchers: [{ label: "Calendar", href: "/school-configuration/calendar" }],
    rows: [
      {
        cols: "1fr",
        panels: [
          {
            type: "kpi",
            title: "Rules on file",
            per: 4,
            cards: [
              { label: "Rules set", value: String(total), sub: `Across ${set.length} areas` },
              {
                label: "Areas configured",
                value: `${set.length} of ${POLICY_AREAS.length}`,
                sub: unset.length ? `${unset.length} running on defaults` : "Every area decided",
                tone: unset.length ? "attention" : "positive",
              },
              {
                label: "Pass mark",
                value:
                  String(
                    (byArea.get("promotions") ?? []).find((item) => item.code === "PROMOTION_MARK")
                      ?.data?.passMark ?? "—",
                  ) + "%",
                sub: "Below this a child repeats",
              },
              {
                label: "Fees due after",
                value:
                  String(
                    (byArea.get("finance") ?? []).find((item) => item.code === "FEE_DUE")?.data
                      ?.dueDays ?? "—",
                  ) + " days",
                sub: "From the start of term",
              },
            ],
          },
        ],
      },
      {
        cols: "1fr",
        panels: [
          unset.length
            ? {
                type: "note",
                tone: "attention",
                title: `${unset.length} policy area${unset.length === 1 ? " has" : "s have"} no rule recorded`,
                body: `${unset
                  .map((area) => area.label)
                  .join(", ")} ${unset.length === 1 ? "is" : "are"} running on the product's defaults. That is not this school having no opinion — it is a decision nobody here made, taking effect anyway.`,
              }
            : {
                type: "note",
                tone: "positive",
                icon: CHECK_ICON,
                title: "Every policy area has been decided",
                body: "Nothing on this page is running on a default the school did not choose.",
              },
        ],
      },
      ...POLICY_AREAS.map((area): PanelRow => {
        const items = byArea.get(area.resource) ?? [];
        const panel: Panel = items.length
          ? {
              type: "table",
              title: area.label,
              sub: area.blurb,
              meta: `${items.length} rule${items.length === 1 ? "" : "s"}`,
              head: ["Rule", "What it means", "Setting"],
              per: 10,
              rows: items
                .slice()
                .sort((a, b) => a.displayOrder - b.displayOrder)
                .map((item) => ({
                  cells: [
                    text(item.name, { strong: true }),
                    text(item.description ?? "—"),
                    text(policyValue(item), { mono: true }),
                  ],
                  keywords: `${item.name} ${item.code ?? ""}`,
                })),
            }
          : {
              type: "note",
              tone: "attention",
              title: `${area.label} has no rule recorded`,
              body: `${area.blurb} Nothing here has been set, so the product's default applies.`,
            };
        return { cols: "1fr", panels: [panel] };
      }),
    ],
  };
}


type FeeItem = {
  id: string;
  label: string;
  componentType: string;
  amount: number;
  isOptional: boolean;
  isActive: boolean;
};

type FeeStructure = {
  id: string;
  name: string;
  currency: string;
  session: string | null;
  term: string | null;
  className: string | null;
  recurrence: string;
  isOneTime: boolean;
  isActive: boolean;
  total: number;
  items: FeeItem[];
};

function componentLabel(value: string): string {
  const words = value.replace(/_/g, " ").toLowerCase().trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** What a family must pay, as distinct from what they may decline. */
function requiredTotal(structure: FeeStructure): number {
  return structure.items
    .filter((item) => item.isActive && !item.isOptional)
    .reduce((sum, item) => sum + item.amount, 0);
}

function optionalTotal(structure: FeeStructure): number {
  return structure.items
    .filter((item) => item.isActive && item.isOptional)
    .reduce((sum, item) => sum + item.amount, 0);
}

function naira(value: number): string {
  return `₦${Math.round(value).toLocaleString("en-NG")}`;
}

/**
 * M02 · Allocations — what a term costs a family, as they would be told it.
 *
 * Structures reads the same records from the bursar's side; this reads them
 * from the family's. The question here is not what the school charges in total
 * but what a parent in each section has to find, and which lines they can say
 * no to — which is the difference between a bill and a demand.
 */
function allocationsTab(structures: FeeStructure[]): TabContent {
  const active = structures.filter((structure) => structure.isActive && structure.items.length);
  const cheapest = active.slice().sort((a, b) => requiredTotal(a) - requiredTotal(b))[0];
  const dearest = active.slice().sort((a, b) => requiredTotal(b) - requiredTotal(a))[0];
  const withOptions = active.filter((structure) => optionalTotal(structure) > 0);

  return {
    title: "Allocations",
    desc: "What a term costs a family in each section, and what they can decline.",
    launchers: [{ label: "Fee structures", href: "/fee-management/structures" }],
    rows: [
      {
        cols: "1fr",
        panels: [
          {
            type: "kpi",
            title: "What families are asked for",
            per: 4,
            cards: [
              {
                label: "Sections priced",
                value: String(active.length),
                sub: active.length ? "Each with its own structure" : "Nothing priced",
                tone: active.length ? undefined : "attention",
              },
              {
                label: "Lowest required",
                value: cheapest ? naira(requiredTotal(cheapest)) : "—",
                sub: cheapest?.name ?? "—",
              },
              {
                label: "Highest required",
                value: dearest ? naira(requiredTotal(dearest)) : "—",
                sub: dearest?.name ?? "—",
              },
              {
                label: "Sections with options",
                value: `${withOptions.length} of ${active.length}`,
                sub: "Transport, boarding, books",
              },
            ],
          },
        ],
      },
      {
        cols: "1fr",
        panels: [
          cheapest && dearest && requiredTotal(dearest) > requiredTotal(cheapest) * 2
            ? {
                type: "note",
                tone: "attention",
                title: `A ${dearest.name.split(" ")[0].toLowerCase()} place costs more than twice a ${cheapest.name.split(" ")[0].toLowerCase()} one`,
                body: `${naira(requiredTotal(dearest))} against ${naira(requiredTotal(cheapest))} before anything optional. Worth knowing when a family has children in both, because the invoice they receive is the sum and nobody has told them it would be.`,
              }
            : {
                type: "note",
                tone: "neutral",
                title: "Fees are broadly level across sections",
                body: "No section costs disproportionately more than another before options.",
              },
        ],
      },
      ...active.map((structure): PanelRow => ({
        cols: "1fr",
        panels: [
          {
            type: "table",
            title: structure.name,
            sub: `${naira(requiredTotal(structure))} required${optionalTotal(structure) ? `, up to ${naira(structure.total)} with everything` : ""}`,
            meta: `${structure.items.length} line${structure.items.length === 1 ? "" : "s"}`,
            head: ["Line", "Kind", "Amount", "Can decline"],
            per: 10,
            rows: structure.items.map((item) => ({
              cells: [
                text(item.label, { strong: !item.isOptional }),
                text(componentLabel(item.componentType)),
                text(naira(item.amount)),
                item.isOptional ? pill("optional", "neutral") : pill("required", "attention"),
              ],
              keywords: `${item.label} ${item.componentType}`,
            })),
          },
        ],
      })),
    ],
  };
}

export async function schoolConfigurationLiveTab(
  tabSlug: string,
): Promise<TabContent | null | undefined> {
  if (tabSlug === "profile") {
    const payload = await apiGet<{ record: SchoolRecord }>(`${CONFIG}/school-information`);
    if (!payload?.record) return undefined;
    const branding = await apiGet<BrandingVersion[]>("/api/v1/configuration/branding-versions").catch(
      () => [] as BrandingVersion[],
    );
    return profileTab(payload.record, branding ?? []);
  }

  if (tabSlug === "calendar") {
    const [terms, events] = await Promise.all([
      apiGet<{ records: SessionRecord[] }>(`${CONFIG}/sessions-terms`),
      apiGet<{ records: CalendarRecord[] }>(`${CONFIG}/school-calendar`),
    ]);
    return calendarTab(terms?.records ?? [], events?.records ?? []);
  }

  if (tabSlug === "curriculum") {
    const [subjects, levels] = await Promise.all([
      apiGet<{ records: SubjectRecord[] }>(`${CONFIG}/subjects`),
      apiGet<{ records: ClassLevelRecord[] }>(`${CONFIG}/class-levels`),
    ]);
    return curriculumTab(subjects?.records ?? [], levels?.records ?? []);
  }

  if (tabSlug === "policies") {
    const areas = await Promise.all(
      POLICY_AREAS.map(async (area) => {
        const payload = await apiGet<{ records: PolicyItem[] }>(
          `${CONFIG}/${area.resource}`,
        ).catch(() => ({ records: [] as PolicyItem[] }));
        return [area.resource, payload?.records ?? []] as const;
      }),
    );
    return policiesTab(new Map(areas));
  }

  if (tabSlug === "allocations") {
    const structures = await apiGet<FeeStructure[]>("/api/v1/finance/fee-structures");
    return allocationsTab(structures ?? []);
  }

  return undefined;
}
