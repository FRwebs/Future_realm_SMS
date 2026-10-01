import { apiGet } from "@/lib/api/server";
import {
  pill,
  text,
  type FormField,
  type Panel,
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

function profileTab(school: SchoolRecord): TabContent {
  const place = [school.address, school.city, school.lga, school.state, school.country]
    .filter(Boolean)
    .join(", ");

  // Only the fields the PATCH schema accepts are editable. Showing a box the
  // endpoint would reject is how a form teaches people it is broken.
  const identityFields: FormField[] = [
    { label: "School name", kind: "text", value: school.name, required: true },
    { label: "School code", kind: "text", value: school.schoolCode ?? "", optional: true },
    { label: "Address", kind: "text", value: school.address ?? "", span: 2, optional: true },
    { label: "City", kind: "text", value: school.city ?? "", optional: true },
    { label: "State", kind: "text", value: school.state ?? "", optional: true },
    { label: "Country", kind: "text", value: school.country ?? "Nigeria", optional: true },
    { label: "Timezone", kind: "text", value: school.timezone, optional: true },
  ];

  // The endpoint validates the whole record on every save, so `name` has to
  // travel even when nobody is editing it — without it the save is rejected
  // for a field this form does not show. A static field carries its value into
  // the payload, so it both says which school is being edited and satisfies
  // the schema.
  const authorityFields: FormField[] = [
    { label: "School", kind: "static", value: school.name, span: 2 },
    { label: "Proprietor", kind: "text", value: school.ownerName ?? "", optional: true },
    { label: "Proprietor email", kind: "text", value: school.ownerEmail ?? "", optional: true },
    { label: "Proprietor phone", kind: "text", value: school.ownerPhone ?? "", optional: true },
  ];

  return {
    title: "Profile",
    desc: "Who this school is, as the platform holds it.",
    launchers: [{ label: "Staff & access", href: "/staff-access/directory" }],
    rows: [
      {
        cols: "1fr",
        panels: [
          {
            type: "facts",
            title: "Registered identity",
            sub: "Set when the school was onboarded. Some of it cannot be edited here.",
            tag: school.verifiedAt ? "Verified" : "Unverified",
            tagTone: school.verifiedAt ? "positive" : "attention",
            facts: [
              ["Name", school.name],
              ["Category", school.category?.replace(/_/g, " ") ?? "—"],
              ["School code", school.schoolCode ?? "not issued"],
              ["Address", place || "not recorded"],
              ["Workspace", school.subdomain ? `${school.subdomain}.futurerealm.school` : school.slug],
              ["Website", school.website ?? "none"],
              ["Currency", school.currency],
              ["Timezone", school.timezone],
              ["Calls a year", school.academicYearLabel],
              ["Calls a term", school.termLabel],
              ["CAC number", school.cacNumber ?? "not recorded"],
              ["Ministry approval", school.ministryApprovalNumber ?? "not recorded"],
              ["Verified", school.verifiedAt ? dateLabel(school.verifiedAt) : "not yet"],
            ],
          },
        ],
      },
      {
        cols: "1fr 1fr",
        panels: [
          {
            type: "form",
            title: "Edit identity",
            sub: "Saved straight to the school record.",
            fields: identityFields,
            submit: {
              endpoint: `${CONFIG}/school-information/${school.id}`,
              method: "PATCH",
              map: {
                "School name": "name",
                "School code": "schoolCode",
                Address: "address",
                City: "city",
                State: "state",
                Country: "country",
                Timezone: "timezone",
              },
              done: "Identity saved.",
            },
          },
          {
            type: "form",
            title: "Edit authority",
            sub: "Who answers for this school.",
            fields: authorityFields,
            submit: {
              endpoint: `${CONFIG}/school-information/${school.id}`,
              method: "PATCH",
              map: {
                School: "name",
                Proprietor: "ownerName",
                "Proprietor email": "ownerEmail",
                "Proprietor phone": "ownerPhone",
              },
              done: "Authority saved.",
            },
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

export async function schoolConfigurationLiveTab(
  tabSlug: string,
): Promise<TabContent | null | undefined> {
  if (tabSlug === "profile") {
    const payload = await apiGet<{ record: SchoolRecord }>(`${CONFIG}/school-information`);
    if (!payload?.record) return undefined;
    return profileTab(payload.record);
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

  // Allocations and Policies still render their authored content: allocations
  // is priced off FeeStructure, which this school has one row of, and policies
  // is backed by the configuration module's generic key-value store, which is
  // empty here. Returning undefined is "not wired yet", not a failure, so
  // neither tab shows a stale-data banner it has not earned.
  return undefined;
}
