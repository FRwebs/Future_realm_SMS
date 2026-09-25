import {
  allocationLists,
  allocationOf,
  type AllocationTotals,
} from "@/lib/modules/allocations-data";
import { curricula, curriculumLayers } from "@/lib/modules/curriculum-data";
import { naira } from "@/lib/modules/fees-data";
import {
  action,
  name as nameCell,
  pill,
  row,
  text,
  type DrawerSpec,
  type ModuleContent,
  type TabContent,
  type PanelTone,
  type TableRow,
} from "@/lib/modules/panels";

/**
 * M02 · School Configuration — "How this school works, set once."
 *
 * Nothing on Profile is a draft, so there is no page-level Save: each block is
 * edited and saved on its own, in a modal that captures the whole block.
 *
 * The mockup reaches a curriculum and an allocation list through a drill-down
 * page. The workspace has no sub-page route, so each drill-down opens as a
 * drawer over its list, and the in-force curriculum's own panels — the six
 * layers, its components and its bands — sit under the list they belong to
 * rather than being dropped.
 */

const activeTerm = "Second Term 2026/2027";

/* ---------------------------------------------------------------- Profile */

const profileTab: TabContent = {
  title: "Profile",
  desc: "Who this school is.",
  primary: {
    label: "Edit identity",
    drawer: {
      mode: "commit",
      kicker: "School profile",
      title: "Edit identity",
      sub: "The school name here is the name printed on every report card.",
      facts: [
        ["School name", "Grace International Academy", "As printed on report cards"],
        ["Short name", "GIA", "Used in SMS, where characters cost money"],
        ["Motto", "Knowledge, Character, Service"],
        ["School type", "Private · co-educational · day and boarding"],
        ["Levels operated", "Nursery · Primary · Junior Secondary · Senior Secondary"],
        ["Effect", "Every card printed from now carries the new name", "Cards already issued keep theirs"],
      ],
      commitLabel: "Save identity",
      commitDone: "Identity saved",
      commitDoneBody: "The school name is in force on everything printed from now.",
    } satisfies DrawerSpec,
  },
  launchers: [
    {
      label: "Edit address & authority",
      drawer: {
        mode: "commit",
        kicker: "School profile",
        title: "Edit address & authority",
        sub: "Registration numbers are validated against the country's own pattern.",
        facts: [
          ["Country", "Nigeria · Federal Capital Territory"],
          ["Address", "14 Aminu Kano Crescent, Wuse II, Abuja"],
          ["Registration number", "FCT/EDU/PVT/2011/00842", "Valid against the FCT pattern"],
          ["Authority approval", "FCT-SEB/APR/2024/1180", "Expires 31 December 2027"],
        ],
        commitLabel: "Save address & authority",
        commitDone: "Address and authority saved",
        commitDoneBody: "The registration number was checked against the FCT pattern before saving.",
      } satisfies DrawerSpec,
    },
    {
      label: "Edit branding",
      drawer: {
        mode: "commit",
        kicker: "School profile",
        title: "Edit branding",
        sub: "Anything already printed keeps the branding it was printed with.",
        facts: [
          ["Logo", "gia-crest-2025.png", "Uploaded 4 January 2026"],
          ["Brand colours", "#0D2315 and #12796A"],
          ["Version", "This saves as version 4", "Version 3 is in force today"],
          ["Already printed", "Keeps version 3", "A parent's card is never restated behind them"],
        ],
        commitLabel: "Save branding",
        commitDone: "Branding saved as version 4",
        commitDoneBody: "Everything printed from now carries version 4. Nothing already issued changes.",
      } satisfies DrawerSpec,
    },
  ],
  rows: [
    row("1fr", [
      {
        type: "facts" as const,
        title: "Identity",
        sub: "The school name here is the name printed on every report card.",
        meta: "Last edited 14 August by you",
        per: 3,
        acts: [
          {
            label: "Edit identity",
            primary: true,
            drawer: {
              mode: "commit" as const,
              kicker: "School profile",
              title: "Edit identity",
              sub: "The school name here is the name printed on every report card.",
              facts: [
                ["School name", "Grace International Academy", "As printed on report cards"],
                ["Short name", "GIA", "Used in SMS, where characters cost money"],
                ["Motto", "Knowledge, Character, Service"],
              ],
              commitLabel: "Save identity",
              commitDone: "Identity saved",
              commitDoneBody: "The school name is in force on everything printed from now.",
            },
          },
        ],
        facts: [
          ["School name", "Grace International Academy", "As printed on report cards"],
          ["Short name", "GIA", "Used in SMS, where characters cost money"],
          ["Motto", "Knowledge, Character, Service"],
          ["Vision", "To raise confident, literate and morally grounded citizens of Africa."],
          ["School type", "Private · co-educational · day and boarding"],
          ["Levels operated", "Nursery · Primary · Junior Secondary · Senior Secondary"],
        ],
      },
    ]),
    row("1.1fr 1fr", [
      {
        type: "facts" as const,
        title: "Address and authority",
        sub: "Registration numbers are validated against the country's own pattern.",
        meta: "Approval expires in 15 months",
        per: 2,
        acts: [
          {
            label: "Edit address & authority",
            primary: true,
            drawer: {
              mode: "commit" as const,
              kicker: "School profile",
              title: "Edit address & authority",
              sub: "Registration numbers are validated against the country's own pattern.",
              facts: [
                ["Registration number", "FCT/EDU/PVT/2011/00842", "Valid against the FCT pattern"],
                ["Authority approval", "FCT-SEB/APR/2024/1180", "Expires 31 December 2027"],
              ],
              commitLabel: "Save address & authority",
              commitDone: "Address and authority saved",
              commitDoneBody: "The registration number was checked against the FCT pattern before saving.",
            },
          },
        ],
        facts: [
          ["Country", "Nigeria · Federal Capital Territory"],
          ["Address", "14 Aminu Kano Crescent, Wuse II, Abuja"],
          ["Registration number", "FCT/EDU/PVT/2011/00842", "Valid against the FCT pattern"],
          ["Authority approval", "FCT-SEB/APR/2024/1180", "Expires 31 December 2027"],
          ["Principal", "Adaeze Nwosu · +234 803 000 0004"],
          ["Proprietor", "Dr Emmanuel Nwosu · +234 803 000 0001"],
        ],
      },
      {
        type: "facts" as const,
        title: "Branding",
        tag: "Version 3 in force",
        tagTone: "positive" as PanelTone,
        sub: "Anything already printed keeps the branding it was printed with.",
        per: 2,
        acts: [
          {
            label: "Version history",
            drawer: {
              kicker: "Branding",
              title: "Branding version history",
              sub: "Every version, and what was printed under it.",
              readOnly: true,
              readOnlyNote: "A version is a record. It is never edited after the fact.",
              facts: [
                ["Version 3", "In force from 4 January 2026", "Current crest and colours"],
                ["Version 2", "11 March 2024 to 3 January 2026", "1,204 cards printed under it"],
                ["Version 1", "From the school's first term on Nooria", "Archived"],
              ],
            } satisfies DrawerSpec,
          },
          {
            label: "Edit branding",
            primary: true,
            drawer: {
              mode: "commit" as const,
              kicker: "School profile",
              title: "Edit branding",
              sub: "Anything already printed keeps the branding it was printed with.",
              facts: [
                ["Version", "This saves as version 4", "Version 3 is in force today"],
                ["Already printed", "Keeps version 3", "A parent's card is never restated behind them"],
              ],
              commitLabel: "Save branding",
              commitDone: "Branding saved as version 4",
              commitDoneBody: "Everything printed from now carries version 4. Nothing already issued changes.",
            },
          },
        ],
        facts: [
          ["Logo", "gia-crest-2025.png", "Uploaded 4 January 2026"],
          ["Brand colours", "#0D2315 and #12796A"],
          ["Principal's signature", "On file · signed 4 January 2026"],
          ["School stamp", "On file"],
          ["Web address", "graceacademy.nooria.app", "Issued 11 March 2024"],
          ["Change of address", "By request only", "Old links keep working for 12 months"],
        ],
      },
    ]),
    row("1.15fr 1fr", [
      {
        type: "facts" as const,
        title: "Data processing agreement",
        tag: "Accepted",
        sub: "The full text is readable here.",
        per: 2,
        acts: [
          {
            label: "Read full text",
            drawer: {
              kicker: "Data processing agreement",
              title: "Version 4.0 · issued 1 July 2026",
              sub: "What Future Realm may do with this school's data, and what it may not.",
              readOnly: true,
              readOnlyNote: "The agreement is a record of what was accepted. It is not edited here.",
              facts: [
                ["Data controller", "Grace International Academy", "The school decides what is collected and why"],
                ["Processor", "Future Realm Agency Ltd", "Acts only on the school's instructions"],
                ["Hosting country", "Nigeria · Lagos region", "Shown in-product, in plain words"],
                ["Accepted on", "8 July 2026, 10:42"],
                ["Accepting officer", "Dr Emmanuel Nwosu · Proprietor"],
                ["Retention", "Per the schedule in Audit & Security"],
              ],
            } satisfies DrawerSpec,
          },
        ],
        facts: [
          ["Version", "4.0 · issued 1 July 2026"],
          ["Accepted on", "8 July 2026, 10:42"],
          ["Accepting officer", "Dr Emmanuel Nwosu · Proprietor"],
          ["Data controller", "Grace International Academy"],
          ["Processor", "Future Realm Agency Ltd"],
          ["Hosting country", "Nigeria · Lagos region", "Shown in-product, in plain words"],
        ],
      },
      {
        type: "note" as const,
        tone: "attention" as PanelTone,
        icon: "M4.5 7h15l-1.2 12.5H5.7zM9 7V4.5h6V7M10 11v5M14 11v5",
        title: "42 sample records are still in this workspace",
        body: "Sample students, one sample class arm and two sample payments were created during setup so the product was not empty on your first afternoon.",
        acts: [
          {
            label: "Review the 42 records",
            drawer: {
              kicker: "Sample data",
              title: "The 42 sample records",
              sub: "Created during setup, and marked as samples ever since.",
              readOnly: true,
              readOnlyNote: "Clearing them is the separate action beside this one.",
              facts: [
                ["Students", "39", "None sits on a real roll"],
                ["Class arms", "1", "Sample Arm · no form master, no timetable"],
                ["Payments", "2", "Never counted in any collection figure"],
                ["Why they exist", "So the product was not empty on your first afternoon"],
              ],
            } satisfies DrawerSpec,
          },
          {
            label: "Clear all sample data",
            drawer: {
              mode: "commit" as const,
              kicker: "Sample data",
              title: "Clear all sample data",
              sub: "42 records created during setup are deleted.",
              facts: [
                ["Records deleted", "42", "39 students, 1 class arm, 2 payments"],
                ["Real records touched", "None", "Nothing marked as a sample is a real record"],
                ["Reversible", "No", "Once cleared, the samples are gone"],
              ],
              commitLabel: "Clear the 42 records",
              commitDone: "Sample data cleared",
              commitDoneBody: "42 records were deleted. Nothing real was touched.",
            } satisfies DrawerSpec,
          },
        ],
      },
    ]),
  ],
};

/* --------------------------------------------------------------- Calendar */

type TermRow = {
  name: string;
  order: string;
  opens: string;
  closes: string;
  days: string;
  midTerm: string;
  state: string;
  tone: PanelTone;
};

const terms: TermRow[] = [
  { name: "First Term", order: "Term 1 of 3", opens: "8 Sep 2025", closes: "12 Dec 2025", days: "62", midTerm: "27–31 Oct", state: "Closed", tone: "neutral" },
  { name: "Second Term", order: "Term 2 of 3", opens: "6 Jan 2026", closes: "27 Mar 2026", days: "54", midTerm: "16–20 Feb", state: "Active", tone: "positive" },
  { name: "Third Term", order: "Term 3 of 3", opens: "20 Apr 2026", closes: "17 Jul 2026", days: "52", midTerm: "1–5 Jun", state: "Not started", tone: "progress" },
];

const assessmentWindows = [
  { component: "First CA", spec: "Max 15 · weight 15%", opens: "19 Jan", closes: "30 Jan", release: "6 Feb", state: "Closed", tone: "neutral" as PanelTone },
  { component: "Second CA", spec: "Max 15 · weight 15%", opens: "16 Feb", closes: "27 Feb", release: "6 Mar", state: "Closed", tone: "neutral" as PanelTone },
  { component: "Project", spec: "Max 10 · weight 10%", opens: "2 Mar", closes: "13 Mar", release: "20 Mar", state: "Closed", tone: "neutral" as PanelTone },
  { component: "Examination", spec: "Max 60 · weight 60%", opens: "8 Sep", closes: "22 Sep", release: "2 Oct", state: "In progress", tone: "progress" as PanelTone },
];

const calendarTab: TabContent = {
  title: "Calendar",
  desc: "When the school operates.",
  primary: {
    label: "Add term",
    drawer: {
      mode: "commit" as const,
      kicker: "Calendar",
      title: "Add a term",
      sub: "A term is what every dated figure in the product is computed against.",
      facts: [
        ["Session", "2026/2027"],
        ["Terms defined", "3", "A school may run as many as it likes, named by the school"],
        ["School days", "Counted from the dates, less holidays and closures"],
        ["Active term", "Unchanged", "Adding a term never moves the active one"],
      ],
      commitLabel: "Add the term",
      commitDone: "Term added",
      commitDoneBody: "The term is on the calendar. Nothing is computed against it until it is made active.",
    },
  },
  launchers: [
    {
      label: "Add an event",
      drawer: {
        mode: "commit" as const,
        kicker: "Calendar",
        title: "Add an event",
        sub: "An event carries its dates, who sees it, and when they are reminded.",
        facts: [
          ["Visible to", "Chosen per event", "Staff, students, guardians, or the public calendar"],
          ["Reminder", "In-app, or in-app and SMS", "SMS is charged against the wallet"],
          ["School closed", "Optional", "A closed day is excluded from every attendance denominator"],
        ],
        commitLabel: "Add the event",
        commitDone: "Event added",
        commitDoneBody: "It is on the calendar, and the reminders are scheduled.",
      },
    },
    {
      label: "Add an assessment window",
      drawer: {
        mode: "commit" as const,
        kicker: "Calendar",
        title: "Add an assessment window",
        sub: "A window says when a component can be scored, and when the result reaches a guardian.",
        facts: [
          ["Weights", "Must total 100 across the term's components"],
          ["Result release", "A separate date from the close", "A school decides when a parent sees it"],
          ["Reopening", "With a reason, from the window's own modal"],
        ],
        commitLabel: "Add the window",
        commitDone: "Assessment window added",
        commitDoneBody: "Teachers can enter scores against it from its opening date.",
      },
    },
    {
      label: "Close the term & roll over",
      drawer: {
        mode: "commit" as const,
        kicker: "Calendar · F2",
        title: "Close Second Term and roll over",
        sub: "Closing a term finalises it and opens the next one.",
        facts: [
          ["Term closing", "Second Term 2026/2027"],
          ["Scores", "Frozen against the framework in force", "A closed term is never silently restated"],
          ["Report cards", "Must all be issued first", "The close is refused while any card is outstanding"],
          ["Next term", "Third Term 2026/2027 becomes active"],
          ["Reversible", "By request to Future Realm", "Reopening a closed term is an audited action"],
        ],
        commitLabel: "Close the term",
        commitDone: "Second Term closed",
        commitDoneBody: "Third Term is now the active term. Every dated figure is computed against it.",
      },
    },
  ],
  rows: [
    row("1fr", [
      {
        type: "note" as const,
        tone: "positive" as PanelTone,
        icon: "M5 12.5l4.5 4.5 9-10",
        title: "Active term · Second Term, 2026/2027 session",
        body: "Every dated figure in the product — attendance percentages, collection rates, submission deadlines, report cards — is computed against this term.",
        acts: [
          {
            label: "Change active term",
            drawer: {
              mode: "commit" as const,
              kicker: "Calendar",
              title: "Change the active term",
              sub: "Every dated figure in the product moves with it.",
              facts: [
                ["Active today", "Second Term 2026/2027"],
                ["What moves", "Attendance, collection, submissions, report cards", "Every figure is recomputed against the new term"],
                ["What does not", "Anything already issued", "A card keeps the term it was issued under"],
                ["Who sees it", "Everyone, immediately"],
              ],
              commitLabel: "Change the active term",
              commitDone: "Active term changed",
              commitDoneBody: "Every dated figure in the product is now computed against the new term.",
            } satisfies DrawerSpec,
          },
        ],
      },
    ]),
    row("1fr", [
      {
        type: "table" as const,
        title: "Terms in 2026/2027",
        sub: "As many terms as the school runs, named by the school.",
        meta: "3 terms defined · 168 school days",
        noun: "term",
        nounPlural: "terms",
        acts: [
          {
            label: "Add term",
            primary: true,
            drawer: {
              mode: "commit" as const,
              kicker: "Terms",
              title: "Add a term",
              sub: "A term is what every dated figure in the product is computed against.",
              facts: [
                ["Session", "2026/2027"],
                ["Active term", "Unchanged", "Adding a term never moves the active one"],
              ],
              commitLabel: "Add the term",
              commitDone: "Term added",
              commitDoneBody: "The term is on the calendar.",
            },
          },
        ],
        head: ["Term", "Opens", "Closes", "Days", "Mid-term break", "State", ""],
        rows: terms.map(
          (term): TableRow => ({
            cells: [
              nameCell(term.name, term.order, { avatar: false }),
              text(term.opens),
              text(term.closes),
              text(term.days, { mono: true }),
              text(term.midTerm),
              pill(term.state, term.tone),
              {
                kind: "action",
                label: "Edit",
                drawer: {
                  mode: "commit",
                  kicker: `Calendar · ${term.order}`,
                  title: `Edit ${term.name}`,
                  sub: `${term.opens} to ${term.closes}.`,
                  facts: [
                    ["Opens", term.opens],
                    ["Closes", term.closes],
                    ["School days", term.days, "Less holidays and closures"],
                    ["Mid-term break", term.midTerm],
                    ["State", term.state, term.state === "Closed" ? "A closed term's dates are a record" : ""],
                  ],
                  commitLabel: "Save the term",
                  commitDone: `${term.name} saved`,
                  commitDoneBody: "Every figure dated inside the term recomputes against the new dates.",
                },
              },
            ],
          }),
        ),
      },
    ]),
    row("1.15fr 1fr", [
      {
        type: "table" as const,
        title: "Assessment windows",
        sub: "When each component can be scored, and when the result reaches a guardian.",
        meta: "4 windows · weights total 100",
        noun: "window",
        nounPlural: "windows",
        acts: [
          {
            label: "Add window",
            primary: true,
            drawer: {
              mode: "commit" as const,
              kicker: "Assessment windows",
              title: "Add an assessment window",
              sub: "Weights must total 100 across the term's components.",
              facts: [
                ["Weights today", "100", "Adding a component means re-weighting the rest"],
                ["Result release", "A separate date from the close"],
              ],
              commitLabel: "Add the window",
              commitDone: "Assessment window added",
              commitDoneBody: "Teachers can enter scores against it from its opening date.",
            },
          },
        ],
        head: ["Component", "Opens", "Closes", "Result release", "State", ""],
        rows: assessmentWindows.map(
          (window): TableRow => ({
            cells: [
              nameCell(window.component, window.spec, { avatar: false }),
              text(window.opens),
              text(window.closes),
              text(window.release),
              pill(window.state, window.tone),
              {
                kind: "action",
                label: "Edit",
                drawer: {
                  mode: "commit",
                  kicker: "Assessment window",
                  title: `Edit ${window.component}`,
                  sub: window.spec,
                  facts: [
                    ["Opens", window.opens],
                    ["Closes", window.closes],
                    ["Result release", window.release, "When a guardian sees it"],
                    ["State", window.state],
                    [
                      "Reopening",
                      window.state === "Closed" ? "Needs a reason" : "Not needed — it is still open",
                      window.state === "Closed" ? "The reason is kept on the window" : "",
                    ],
                  ],
                  commitLabel: "Save the window",
                  commitDone: `${window.component} window saved`,
                  commitDoneBody: "The dates are in force. Nothing already scored changes.",
                },
              },
            ],
          }),
        ),
        foot: "A window that has closed can be reopened, with a reason, from its own modal.",
      },
      {
        type: "list" as const,
        title: "Events",
        sub: "Each with its dates, who sees it, and when they are reminded.",
        acts: [
          {
            label: "Add event",
            primary: true,
            drawer: {
              mode: "commit" as const,
              kicker: "Events",
              title: "Add an event",
              sub: "An event carries its dates, who sees it, and when they are reminded.",
              facts: [
                ["Visible to", "Chosen per event"],
                ["Reminder", "In-app, or in-app and SMS", "SMS is charged against the wallet"],
              ],
              commitLabel: "Add the event",
              commitDone: "Event added",
              commitDoneBody: "It is on the calendar, and the reminders are scheduled.",
            },
          },
        ],
        items: [
          {
            label: "Examination week",
            sub: "8–19 September · staff, students, guardians · 7-day reminder",
            pill: "In progress",
            tone: "progress" as PanelTone,
            viewLabel: "Edit",
            facts: [
              ["Event", "Examination week"],
              ["Type", "Examination"],
              ["Start date", "8 September 2026"],
              ["End date", "19 September 2026"],
              ["Location", "All examination halls"],
              ["Visible to", "Staff, students, guardians"],
              ["Reminder", "7 days before", "In-app and SMS"],
              ["Second reminder", "1 day before", "In-app"],
              ["State", "In progress"],
            ],
          },
          {
            label: "Parents' consultation day",
            sub: "26 September · guardians · 3-day reminder",
            pill: "Not started",
            viewLabel: "Edit",
            facts: [
              ["Event", "Parents' consultation day"],
              ["Type", "Meeting"],
              ["Start date", "26 September 2026"],
              ["Start time", "09:00"],
              ["End time", "14:00"],
              ["Location", "School hall"],
              ["Visible to", "Guardians"],
              ["Reminder", "3 days before", "In-app and SMS · 1,204 recipients"],
              ["State", "Not started"],
            ],
          },
          {
            label: "Independence Day",
            sub: "1 October · public holiday, pre-loaded · school closed",
            pill: "Not started",
            tone: "neutral" as PanelTone,
            viewLabel: "Edit",
            facts: [
              ["Event", "Independence Day"],
              ["Type", "Holiday", "Pre-loaded for Nigeria"],
              ["Start date", "1 October 2026"],
              ["All day", "Yes"],
              ["School closed", "Yes", "Excluded from every attendance denominator"],
              ["Visible to", "Staff, students, guardians, the public calendar"],
              ["Reminder", "No reminder"],
              ["State", "Not started"],
            ],
          },
          {
            label: "Prize-giving and speech day",
            sub: "3 October · everyone · 14-day reminder",
            pill: "Not started",
            viewLabel: "Edit",
            facts: [
              ["Event", "Prize-giving and speech day"],
              ["Type", "School event"],
              ["Start date", "3 October 2026"],
              ["Start time", "10:00"],
              ["End time", "15:00"],
              ["Location", "School hall"],
              ["Visible to", "Staff, students, guardians, the public calendar"],
              ["Reminder", "14 days before", "In-app and SMS"],
              ["State", "Not started"],
            ],
          },
          {
            label: "Inter-house sports",
            sub: "10–11 October · everyone · 7-day reminder",
            pill: "Not started",
            viewLabel: "Edit",
            facts: [
              ["Event", "Inter-house sports"],
              ["Type", "Sports"],
              ["Start date", "10 October 2026"],
              ["End date", "11 October 2026"],
              ["Location", "Main field"],
              ["Visible to", "Staff, students, guardians"],
              ["Reminder", "7 days before"],
              ["State", "Not started"],
            ],
          },
          {
            label: "Term ends",
            sub: "17 October · everyone · 14-day reminder",
            pill: "Not started",
            viewLabel: "Edit",
            facts: [
              ["Event", "Term ends"],
              ["Type", "Deadline"],
              ["Start date", "17 October 2026"],
              ["All day", "Yes"],
              ["Visible to", "Staff, students, guardians"],
              ["Reminder", "14 days before"],
              ["State", "Not started"],
            ],
          },
        ],
        foot: "Open any event to change its dates, visibility or reminders — or to delete it.",
      },
    ]),
  ],
};

/* ------------------------------------------------------------- Curriculum */

const inForce = curricula.find((entry) => entry.state === "In force")!;

/**
 * One layer, read-only, with Edit as the deliberate next step.
 *
 * The layer facts are the library standard's. This school's own Assessment
 * layer sits at 98, so those two figures are restated here — a layer that
 * warned about 98 while listing 100 would contradict itself on its own face.
 */
function layerDrawer(label: string, facts: [string, string, string?][]): DrawerSpec {
  const weightsWrong = label === "Assessment";
  const shown: [string, string, string?][] = weightsWrong
    ? facts.map((fact) =>
        fact[0] === "Project"
          ? ["Project", "Maximum 10 · weight 8%", "Raising this to 10% brings the total to 100"]
          : fact[0] === "Total weight"
            ? ["Total weight", "98 · must total exactly 100", "Short by 2"]
            : fact,
      )
    : facts;

  return {
    kicker: `${inForce.name} · layer`,
    title: label,
    sub: weightsWrong
      ? "Weights total 98 and must total 100 before this curriculum can be locked for the term."
      : "Read-only. Edit the layer to change any of it.",
    readOnly: true,
    readOnlyNote: weightsWrong
      ? "Weights total 98 and must total 100. Edit the layer to correct it."
      : "Read-only. Edit the layer to change any of it.",
    tone: weightsWrong ? "attention" : undefined,
    facts: shown,
  };
}

function curriculumDrawer(entry: (typeof curricula)[number]): DrawerSpec {
  return {
    kicker: `${entry.origin} · ${entry.basis}`,
    title: entry.name,
    sub: entry.sub,
    readOnly: entry.origin === "Nooria library",
    readOnlyNote:
      entry.origin === "Nooria library"
        ? "This is the library version, and it stays the library version. Adopt it, or tweak it into your own."
        : undefined,
    facts: [
      ["State", entry.state, entry.state === "In force" ? "Used by every arm" : "Not in force"],
      ["Layers set", `${entry.layers} of 6`, entry.layers === "6" ? "All six defined" : "Unfinished — a draft can be picked up later"],
      ["Arms using it", entry.arms, "Out of 42"],
      ["Region / basis", entry.basis],
      ["Subjects", entry.layers === "6" ? "34 · 3 choice groups" : "Not set"],
      [
        "Assessment",
        entry.state === "In force" ? "98 of 100" : "4 components, weights total 100",
        entry.state === "In force" ? "Weights must total 100 — the Project component is at 8%" : "",
      ],
      ...curriculumLayers.map(
        (layer): [string, string, string?] => [
          layer.label,
          layer.facts[0]![1],
          layer.facts[1]?.[1] ?? "",
        ],
      ),
    ],
  };
}

const curriculumTab: TabContent = {
  title: "Curriculum",
  desc: "One is in force. The rest are yours to copy, build or archive.",
  primary: {
    label: "Build a curriculum",
    drawer: {
      mode: "commit" as const,
      kicker: "Curriculum",
      title: "Build a curriculum",
      sub: "Seven sections, one at a time. Nothing is in force until you say so.",
      facts: [
        ["Sections", "7", "Name, then the six layers, then rollout"],
        ["Order", "Any", "Each layer saves on its own"],
        ["In force", "Not until you say so", "A draft affects no register, sheet or card"],
        ["Copy instead", "The Nooria standard can be copied as a starting point"],
      ],
      commitLabel: "Start building",
      commitDone: "Draft curriculum created",
      commitDoneBody: "Nothing is in force. Pick it up from the curriculum list whenever you like.",
    },
  },
  launchers: [
    { label: "Open the one in force", drawer: curriculumDrawer(inForce) },
    { label: "Preview the Nooria standard", drawer: curriculumDrawer(curricula[0]!) },
  ],
  rows: [
    row("1fr", [
      {
        type: "kpi" as const,
        per: 4,
        cards: [
          { label: "In force", value: "1", sub: "Grace International · all 42 arms", tone: "positive" as PanelTone },
          { label: "Available to adopt", value: "3", sub: "From the Nooria library", tone: "neutral" as PanelTone },
          { label: "Your own drafts", value: "1", sub: "Not in force", tone: "progress" as PanelTone },
          {
            label: "Layers needing attention",
            value: "1",
            sub: "Assessment weights total 98",
            tone: "attention" as PanelTone,
            link: "Open the layer",
            drawer: layerDrawer("Assessment", curriculumLayers[2]!.facts as [string, string, string?][]),
          },
        ],
      },
    ]),
    row("1fr", [
      {
        type: "table" as const,
        title: "All curricula",
        tag: "1 in force",
        tagTone: "positive" as PanelTone,
        sub: "Number 1 is the standard Nooria ships. Open any to see its six layers, or build your own.",
        meta: "5 curricula · 1 in force",
        search: "Find a curriculum by name, origin or region",
        filters: [
          { label: "Origin", value: "All", options: ["All", "Nooria library", "This school"], column: 2 },
          { label: "State", value: "All", options: ["All", "In force", "Available", "Draft", "Archived"], column: 5 },
        ],
        acts: [
          { label: "Preview the Nooria standard", drawer: curriculumDrawer(curricula[0]!) },
          {
            label: "Build a curriculum",
            primary: true,
            drawer: {
              mode: "commit" as const,
              kicker: "Curriculum",
              title: "Build a curriculum",
              sub: "Seven sections, one at a time. Nothing is in force until you say so.",
              facts: [
                ["Sections", "7"],
                ["In force", "Not until you say so"],
              ],
              commitLabel: "Start building",
              commitDone: "Draft curriculum created",
              commitDoneBody: "Nothing is in force. Pick it up from the curriculum list whenever you like.",
            },
          },
        ],
        head: ["#", "Curriculum", "Origin", "Region / basis", "Layers", "State", "Arms", ""],
        per: 8,
        noun: "curriculum",
        nounPlural: "curricula",
        rows: curricula.map(
          (entry, index): TableRow => ({
            cells: [
              text(String(index + 1), { strong: true, tone: index === 0 ? "positive" : undefined }),
              nameCell(entry.name, entry.sub, { avatar: false }),
              text(entry.origin),
              text(entry.basis),
              text(entry.layers, { mono: true }),
              pill(
                entry.state,
                entry.state === "In force" ? "positive" : entry.state === "Draft" ? "progress" : "neutral",
              ),
              text(entry.arms, { mono: true }),
              {
                kind: "action",
                label: entry.state === "Available" ? "Preview" : "Open",
                drawer: curriculumDrawer(entry),
              },
            ],
            keywords: `${entry.origin} ${entry.basis}`,
          }),
        ),
        foot: "The six configuration layers live inside a curriculum — open one to set them. Putting a curriculum in force replaces the current one from the next term.",
      },
    ]),
    // The mockup reaches these from inside the curriculum in force. There is no
    // sub-page route here, so they sit under the list they belong to.
    row("1fr", [
      {
        type: "note" as const,
        tone: "attention" as PanelTone,
        title: "Assessment weights total 98. They must total 100.",
        body: `In ${inForce.name}, the Project component is set to 8%. Raise it to 10%, or lower Examination from 60% to 58%.`,
        acts: [
          {
            label: "Open the assessment layer",
            drawer: layerDrawer("Assessment", curriculumLayers[2]!.facts as [string, string, string?][]),
          },
          {
            label: "Set Project to 10%",
            drawer: {
              mode: "commit" as const,
              kicker: inForce.name,
              title: "Set the Project weight to 10%",
              sub: "Weights then total 100 and the framework can be locked for the term.",
              facts: [
                ["Component", "Project · maximum 10"],
                ["Weight now", "8%"],
                ["Weight after", "10%"],
                ["Total after", "100", "First CA 15 · Second CA 15 · Project 10 · Examination 60"],
                ["Scores already entered", "None against Project this term", "Nothing is restated"],
              ],
              commitLabel: "Set Project to 10%",
              commitDone: "Project weight set to 10%",
              commitDoneBody: "Assessment weights now total 100. The framework can be locked for the term.",
            } satisfies DrawerSpec,
          },
        ],
      },
    ]),
    row("1fr", [
      {
        type: "tiles" as const,
        title: "The six layers",
        sub: `Inside ${inForce.name}. Open a layer to see exactly what this curriculum does. Each one saves on its own.`,
        per: 3,
        tiles: curriculumLayers.map((layer) => ({
          label: layer.label,
          sub:
            layer.label === "Assessment"
              ? "4 components · weights total 98 — needs 100"
              : layer.facts[0]![1],
          tone: layer.label === "Assessment" ? ("attention" as PanelTone) : undefined,
          drawer: layerDrawer(layer.label, layer.facts as [string, string, string?][]),
        })),
      },
    ]),
    row("1.1fr 1fr", [
      {
        type: "table" as const,
        title: "Assessment components",
        meta: "4 components · weights total 98",
        noun: "component",
        nounPlural: "components",
        head: ["Component", "Max", "Weight", "Aggregation", ""],
        rows: (
          [
            ["First CA", "Continuous assessment", "15", "15%"],
            ["Second CA", "Continuous assessment", "15", "15%"],
            ["Project", "Practical / research", "10", "8%"],
            ["Examination", "End of term", "60", "60%"],
          ] as const
        ).map(
          ([component, kind, max, weight]): TableRow => ({
            cells: [
              nameCell(component, kind, { avatar: false }),
              text(max, { mono: true }),
              text(weight, { mono: true, tone: component === "Project" ? "attention" : undefined }),
              text("Sum across term"),
              {
                kind: "action",
                label: "Edit",
                drawer: {
                  mode: "commit",
                  kicker: `${inForce.name} · assessment`,
                  title: `Edit ${component}`,
                  sub: `${kind} · maximum ${max}, weight ${weight}.`,
                  facts: [
                    ["Maximum", max],
                    ["Weight", weight, component === "Project" ? "Raising this to 10% brings the total to 100" : ""],
                    ["Aggregation", "Sum across term"],
                    ["Absent handling", "Excluded from the average, never scored zero"],
                    ["Locks", "On the first score entered against it"],
                  ],
                  commitLabel: `Save ${component}`,
                  commitDone: `${component} saved`,
                  commitDoneBody: "Nothing already scored against this component changes.",
                },
              },
            ],
          }),
        ),
        foot: "Absent handling: excluded from the average, never scored zero.",
      },
      {
        type: "table" as const,
        title: "Grading bands",
        tag: "Contiguous",
        noun: "band",
        nounPlural: "bands",
        head: ["Grade", "Range", "Label", "Points", ""],
        rows: (
          [
            ["A1", "75–100", "Excellent", "1"],
            ["B2", "70–74", "Very good", "2"],
            ["B3", "65–69", "Good", "3"],
            ["C4", "60–64", "Credit", "4"],
            ["D7", "40–59", "Pass", "7"],
            ["F9", "0–39", "Fail", "9"],
          ] as const
        ).map(
          ([grade, range, label, points]): TableRow => ({
            cells: [
              text(grade, { strong: true }),
              text(range),
              text(label),
              text(points, { mono: true }),
              {
                kind: "action",
                label: "Edit",
                drawer: {
                  mode: "commit",
                  kicker: `${inForce.name} · grading`,
                  title: `Edit ${grade}`,
                  sub: `${range} · ${label} · ${points} point${points === "1" ? "" : "s"}.`,
                  facts: [
                    ["Range", range],
                    ["Label", label, "What a parent reads on the card"],
                    ["Points", points],
                    ["Bands", "Contiguous", "No mark can fall between two bands"],
                    ["Pass mark", "40 · credit threshold 50"],
                  ],
                  commitLabel: `Save ${grade}`,
                  commitDone: `${grade} saved`,
                  commitDoneBody: "The bands stay contiguous. Nothing already graded changes.",
                },
              },
            ],
          }),
        ),
        foot: "Pass mark 40 · credit threshold 50.",
      },
    ]),
    row("1fr 1.1fr", [
      {
        type: "note" as const,
        tone: "withheld" as PanelTone,
        icon: "M7 10.5V8a5 5 0 0 1 10 0v2.5M5.5 10.5h13v9h-13z",
        title: "Assessment framework is locked for First Term",
        body: "Scores exist against this framework, so components, maximums and weights cannot change for a term already scored — changing them would silently restate results a parent has already received.",
        acts: [
          {
            label: "Create version 5",
            drawer: {
              mode: "commit" as const,
              kicker: inForce.name,
              title: "Create version 5",
              sub: "A new version takes effect from the next term.",
              facts: [
                ["Takes effect", "From the next term", "First Term keeps version 4"],
                ["Results already issued", "Keep the version they were issued under"],
                ["Reason", "Required on every version"],
                ["Heads of Department", "Notified when it is published"],
              ],
              commitLabel: "Create version 5",
              commitDone: "Version 5 created",
              commitDoneBody: "It takes effect from the next term. Nothing already issued changes.",
            } satisfies DrawerSpec,
          },
          {
            label: "Request an unlock",
            drawer: {
              mode: "commit" as const,
              kicker: "F12 · unlock request",
              title: "Request an unlock for First Term",
              sub: "An unlock lets a locked framework change for a term already scored.",
              facts: [
                ["Term", "First Term 2026/2027"],
                ["Approver", "Proprietor", "An unlock is never self-approved"],
                ["Reason", "Required", "Kept on the record permanently"],
                ["Effect if granted", "Results already issued may be restated", "Guardians are notified of any change"],
              ],
              commitLabel: "Send the request",
              commitDone: "Unlock request sent",
              commitDoneBody: "It is waiting on the Proprietor. Nothing is unlocked until they decide.",
            } satisfies DrawerSpec,
          },
        ],
      },
      {
        type: "note" as const,
        tone: "progress" as PanelTone,
        icon: "M6.5 3.5h8L18.5 8v12.5h-12zM9 12.5h6M9 16h4",
        title: "No report card design saves without being previewed against real scores",
        body: "The live preview renders your layout against JSS 2A's actual Second Term scores.",
        acts: [
          {
            label: "Preview against JSS 2A",
            href: "/report-cards/completion",
          },
          {
            label: "Choose another arm",
            href: "/report-cards/archive",
          },
        ],
      },
    ]),
    row("1fr", [
      {
        type: "note" as const,
        tone: "withheld" as PanelTone,
        icon: "M7 10.5V8a5 5 0 0 1 10 0v2.5M5.5 10.5h13v9h-13z",
        title: "A curriculum in force cannot be swapped mid-term",
        body: "Scores exist against the framework in force, so replacing it takes effect from the next term. Anything already issued keeps the framework it was issued under — a parent's report card is never restated behind them.",
        acts: [
          {
            label: "Put a curriculum in force",
            drawer: {
              mode: "commit" as const,
              kicker: "Curriculum",
              title: "Put a curriculum in force",
              sub: "It replaces the current one from the next term.",
              facts: [
                ["In force today", inForce.name, "All 42 arms"],
                ["Takes effect", "From the next term", "Never mid-term"],
                ["Already issued", "Keeps the framework it was issued under"],
                ["Who is told", "Every member of staff who enters or approves a score"],
              ],
              commitLabel: "Put it in force",
              commitDone: "Curriculum scheduled",
              commitDoneBody: "It takes over from the start of the next term. Nothing changes this term.",
            } satisfies DrawerSpec,
          },
          {
            label: "Request an unlock",
            drawer: {
              mode: "commit" as const,
              kicker: "F12 · unlock request",
              title: "Request an unlock",
              sub: "An unlock lets a locked framework change for a term already scored.",
              facts: [
                ["Approver", "Proprietor", "An unlock is never self-approved"],
                ["Reason", "Required", "Kept on the record permanently"],
              ],
              commitLabel: "Send the request",
              commitDone: "Unlock request sent",
              commitDoneBody: "It is waiting on the Proprietor.",
            } satisfies DrawerSpec,
          },
        ],
      },
    ]),
  ],
};

/* ------------------------------------------------------------ Allocations */

const totalsByList = new Map<string, AllocationTotals>(
  allocationLists.map((list) => [
    `${list.className}|${list.term}`,
    allocationOf(list.className, list.term),
  ]),
);

function totalsFor(list: (typeof allocationLists)[number]): AllocationTotals {
  return totalsByList.get(`${list.className}|${list.term}`)!;
}

const thisTermLists = allocationLists.filter((list) => list.term === activeTerm);
const publishedCount = thisTermLists.filter((list) => list.state === "Published").length;
const classesWithNoList = Math.max(0, 14 - thisTermLists.length);
const requiredTotals = thisTermLists.map((list) => totalsFor(list).required);

function allocationDrawer(list: (typeof allocationLists)[number]): DrawerSpec {
  const totals = totalsFor(list);
  const schoolOnly = totals.items.filter((entry) => /School store only/.test(entry.source));

  return {
    kicker: `${list.className} · ${list.term}`,
    title: list.name,
    sub: `${totals.items.length} items across ${totals.cats.length} categories. Prices are what the school states today, not what the school charges.`,
    readOnly: list.state === "Archived",
    readOnlyNote:
      list.state === "Archived"
        ? "Kept exactly as it was issued, so a family asking what they were told to buy last term gets the truth."
        : undefined,
    facts: [
      ["Required", naira(totals.required), `${totals.items.filter((entry) => entry.req).length} items every child must have`],
      ["Optional", naira(totals.optional), `${totals.items.filter((entry) => !entry.req).length} items a family may skip`],
      ["Full list", naira(totals.total), "If a family took everything"],
      ["Buy at school", naira(schoolOnly.reduce((sum, entry) => sum + entry.unit * entry.qty, 0)), `${schoolOnly.length} items only the school sells`],
      ["Categories", totals.cats.join(" · ")],
      ["Owner", list.owner, "Owns this list"],
      [
        "State",
        list.state,
        list.state === "Published"
          ? "Families can see it"
          : list.state === "Draft"
            ? "Not yet sent to anyone"
            : "Kept for the record",
      ],
      ["Printing", "With prices, or without them", "Without prices is for families who buy where they like"],
    ],
  };
}

const allocationsTab: TabContent = {
  title: "Allocations",
  desc: "What each class needs for a term, priced and printable for families.",
  primary: {
    label: "Create an allocation",
    drawer: {
      mode: "commit" as const,
      kicker: "Allocations",
      title: "Create an allocation",
      sub: "Choose the categories this class needs, then fill each one with the things in it and what they cost.",
      facts: [
        ["Categories", "Books, Stationery, Uniform, Boarding kit, Digital, Practical and laboratory, Sports"],
        ["Class and term", "One list per class per term"],
        ["Prices", "What the school says it should cost", "Not what the school charges"],
        ["Published", "In the guardian app and open for printing"],
      ],
      commitLabel: "Create the list",
      commitDone: "Allocation created",
      commitDoneBody: "It is a draft. No family can see it until it is published.",
    },
  },
  launchers: [
    {
      label: "Print every published list",
      drawer: {
        kicker: activeTerm,
        title: "Print every published list",
        sub: "One list per class, one copy per child on the roll.",
        facts: [
          ["Lists", String(publishedCount), "One per class"],
          ["Copies", "One per child on the roll", "Named, so nothing is swapped in the bag"],
          ["Prices", "Your choice at the print step"],
          ["Format", "PDF · school letterhead"],
        ],
      } satisfies DrawerSpec,
    },
    {
      label: "Send this term's lists to guardians",
      drawer: {
        mode: "commit" as const,
        kicker: "Every published list",
        title: "Send this term's lists to guardians",
        sub: "Each guardian receives only the list for their own child's class.",
        facts: [
          ["Lists sent", String(publishedCount), "Drafts are not sent"],
          ["Recipients", "Every guardian with a child in a covered class"],
          ["Channel", "The guardian app, and their chosen channel"],
          ["What they see", "Their child's list only", "Nothing about any other class"],
        ],
        commitLabel: "Send the lists",
        commitDone: "Lists sent",
        commitDoneBody: "Each guardian has the list for their own child's class, in the app and on their chosen channel.",
      } satisfies DrawerSpec,
    },
  ],
  rows: [
    row("1fr", [
      {
        type: "kpi" as const,
        per: 4,
        cards: [
          {
            label: "Lists published",
            value: String(publishedCount),
            unit: `of ${thisTermLists.length}`,
            sub:
              publishedCount === thisTermLists.length
                ? "Every class covered"
                : `${thisTermLists.length - publishedCount} still in draft`,
            tone: (publishedCount === thisTermLists.length ? "positive" : "attention") as PanelTone,
          },
          {
            label: "Classes with no list",
            value: String(classesWithNoList),
            sub:
              classesWithNoList > 0
                ? "Families there have been told nothing"
                : "All 14 classes covered",
            tone: (classesWithNoList > 0 ? "attention" : "positive") as PanelTone,
          },
          {
            label: "Cheapest required list",
            value: naira(Math.min(...requiredTotals)),
            sub: "Nursery 2 · starter pack",
            tone: "neutral" as PanelTone,
          },
          {
            label: "Dearest required list",
            value: naira(Math.max(...requiredTotals)),
            sub: "A senior list carries the calculator and the practical kit",
            tone: "neutral" as PanelTone,
          },
        ],
      },
    ]),
    row("1fr", [
      {
        type: "table" as const,
        title: "All allocations",
        tag: `${publishedCount} published`,
        tagTone: "positive" as PanelTone,
        sub: "One list per class per term. Open any to price it, edit it, or print it for the families.",
        meta: `${allocationLists.length} lists · across 2 terms`,
        search: "Find a list by name or class",
        filters: [
          {
            label: "Term",
            value: "All",
            options: ["All", activeTerm, "First Term 2026/2027"],
            column: 2,
          },
          {
            label: "Class",
            value: "All",
            options: ["All", "Nursery 2", "Primary 5", "JSS 1", "JSS 2", "JSS 3", "SSS 1", "SSS 2", "SSS 3"],
            column: 1,
          },
          {
            label: "State",
            value: "All",
            options: ["All", "Published", "Draft", "Archived"],
            column: 7,
          },
        ],
        acts: [
          {
            label: "Copy last term's lists",
            drawer: {
              mode: "commit" as const,
              kicker: "Allocations",
              title: "Copy last term's lists",
              sub: "Every archived list from First Term is copied into this term as a draft.",
              facts: [
                ["Lists copied", String(allocationLists.filter((list) => list.state === "Archived").length)],
                ["Copied as", "Drafts", "No family sees a copy until it is published"],
                ["Prices", "Carried over", "Review them before publishing"],
                ["Archived originals", "Untouched", "They are the record of what families were told"],
              ],
              commitLabel: "Copy the lists",
              commitDone: "Lists copied",
              commitDoneBody: "They are drafts in this term. Review the prices, then publish.",
            } satisfies DrawerSpec,
          },
          {
            label: "Create an allocation",
            primary: true,
            drawer: {
              mode: "commit" as const,
              kicker: "Allocations",
              title: "Create an allocation",
              sub: "Choose the categories this class needs, then fill each one.",
              facts: [
                ["Class and term", "One list per class per term"],
                ["Prices", "What the school says it should cost"],
              ],
              commitLabel: "Create the list",
              commitDone: "Allocation created",
              commitDoneBody: "It is a draft. No family can see it until it is published.",
            } satisfies DrawerSpec,
          },
        ],
        head: ["Allocation", "Class", "Term", "Items", "Required", "Optional", "Owner", "State", ""],
        per: 8,
        noun: "allocation",
        nounPlural: "allocations",
        rows: allocationLists.map((list): TableRow => {
          const totals = totalsFor(list);

          return {
            cells: [
              nameCell(list.name, totals.cats.join(" · "), { avatar: false }),
              text(list.className),
              text(list.term),
              text(String(totals.items.length), { mono: true }),
              text(naira(totals.required), { mono: true }),
              text(naira(totals.optional), { mono: true }),
              nameCell(list.owner, "Owns this list"),
              pill(
                list.state,
                list.state === "Published" ? "positive" : list.state === "Draft" ? "progress" : "neutral",
              ),
              { kind: "action", label: "Open", drawer: allocationDrawer(list) },
            ],
            keywords: `${list.className} ${list.owner} ${totals.cats.join(" ")}`,
          };
        }),
      },
    ]),
    row("1fr", [
      {
        type: "facts" as const,
        title: "A list is a standard the school sets, not a shop",
        per: 1,
        facts: [
          ["Where a family buys", "Anywhere the source column allows", "Only School store only removes the choice"],
          ["What the price means", "What the school says it should cost", "Not what the school charges"],
          ["Published", "In the guardian app and open for printing"],
          ["Archived", "Kept exactly as issued", "So a family asking what they were told last term gets the truth"],
        ],
      },
    ]),
  ],
};

/* ---------------------------------------------------------------- Policies */

type Policy = {
  setting: string;
  what: string;
  value: string;
  changes: string;
  act: string;
  href?: string;
};

const academicPolicies: Policy[] = [
  {
    setting: "Result publication mode",
    what: "Who releases results, and when",
    value: "Principal approval, then manual publish",
    changes: "Report cards stay unpublished until you publish them, even after approval.",
    act: "Edit",
  },
  {
    setting: "Score edit after submission",
    what: "Whether a teacher can revise",
    value: "Locked · correction request required",
    changes: "A submitted sheet routes through F5 with reason and evidence.",
    act: "Edit",
  },
  {
    setting: "Attendance mode",
    what: "Daily, per-period or hybrid",
    value: "Daily",
    changes: "Per-period becomes available once a timetable is published.",
    act: "Edit",
  },
  {
    setting: "Absence reason requirement",
    what: "Whether a reason is mandatory",
    value: "Required for absent, optional for late",
    changes: "A register will not save with an unexplained absence.",
    act: "Edit",
  },
  {
    setting: "Chronic absence threshold",
    what: "When a pattern becomes a case",
    value: "Below 75% in a term",
    changes: "Crosses into Compliance, Oversight and the student record.",
    act: "Edit",
  },
  {
    setting: "Session timeout",
    what: "Idle time before sign-out",
    value: "30 minutes",
    changes: "Unsaved entry is preserved locally through a timeout.",
    act: "Edit",
  },
];

const familyPolicies: Policy[] = [
  {
    setting: "Guardian portal visibility",
    what: "What a parent can see",
    value: "Results, attendance, fees, announcements",
    changes: "Explain This Result reaches guardians · enabled.",
    act: "Edit",
  },
  {
    setting: "Student portal visibility",
    what: "What a student can see",
    value: "Results and attendance only",
    changes: "Fee detail is never shown to students.",
    act: "Edit",
  },
  {
    setting: "Accepted guardian submissions",
    what: "6 of 8 types accepted",
    value: "Absence, contact, correction, result query, fee query, meeting",
    changes: "Consent actions and withdrawal notices are handled in person by school policy.",
    act: "Edit",
  },
  {
    setting: "Mass communication threshold",
    what: "When a send needs approval",
    value: "Above 150 recipients",
    changes: "Larger sends appear on Module 12 · Sent awaiting a decision.",
    act: "Edit",
  },
  {
    setting: "Approval routing overrides",
    what: "School-specific routes",
    value: "3 overrides in force",
    changes: "Configured in Module 13 · Routing; shown here for visibility.",
    act: "Open routing",
    href: "/approvals-workflow/workflow",
  },
  {
    setting: "Default channel and contact window",
    what: "Shared with Automation",
    value: "SMS · 07:00–19:00 WAT",
    changes: "One record, two entry points — editing here edits Module 12 · Automation.",
    act: "Edit",
  },
];

function policyRows(policies: Policy[]): TableRow[] {
  return policies.map(
    (policy): TableRow => ({
      cells: [
        nameCell(policy.setting, policy.what, { avatar: false }),
        text(policy.value, { strong: true }),
        text(policy.changes),
        policy.href
          ? action(policy.act, policy.href)
          : {
              kind: "action",
              label: policy.act,
              drawer: {
                mode: "commit",
                kicker: "Policies",
                title: `Edit ${policy.setting.toLowerCase()}`,
                sub: policy.what,
                facts: [
                  ["In force", policy.value],
                  ["What it changes", policy.changes],
                  ["Takes effect", "Immediately", "A policy is never scheduled — it is how the school behaves"],
                  ["Who is told", "Every member of staff the setting reaches"],
                ],
                commitLabel: "Save the policy",
                commitDone: `${policy.setting} saved`,
                commitDoneBody: policy.changes,
              },
            },
      ],
      keywords: policy.what,
    }),
  );
}

const policiesTab: TabContent = {
  title: "Policies",
  desc: "The rules that make Nooria behave like this school.",
  primary: {
    label: "Save policies",
    drawer: {
      mode: "commit" as const,
      kicker: "Policies",
      title: "Save policies",
      sub: "Every changed setting takes effect the moment it is saved.",
      facts: [
        ["Settings", "12 across two blocks"],
        ["Takes effect", "Immediately", "A policy is how the school behaves, not a scheduled change"],
        ["Audited", "Yes", "Every policy change is on the record with who made it"],
      ],
      commitLabel: "Save policies",
      commitDone: "Policies saved",
      commitDoneBody: "Every changed setting is in force, and the change is on the record.",
    },
  },
  rows: [
    row("1fr", [
      {
        type: "table" as const,
        title: "Academic and attendance policy",
        sub: "Each setting states what it changes, not what it is called internally.",
        noun: "setting",
        nounPlural: "settings",
        head: ["Setting", "Value", "What it changes", ""],
        rows: policyRows(academicPolicies),
      },
    ]),
    row("1fr", [
      {
        type: "table" as const,
        title: "Family, finance and communication policy",
        noun: "setting",
        nounPlural: "settings",
        head: ["Setting", "Value", "What it changes", ""],
        rows: policyRows(familyPolicies),
      },
    ]),
    row("1fr", [
      {
        type: "note" as const,
        tone: "offline" as PanelTone,
        icon: "M7 10.5V8a5 5 0 0 1 10 0v2.5M5.5 10.5h13v9h-13z",
        title: "Fee-linked result access is unavailable in Nigeria",
        body: "Withholding a child's result for unpaid fees is not permitted under the country configuration for Nigeria, so this school cannot enable it.",
      },
    ]),
  ],
};

export const schoolConfigurationContent: ModuleContent = {
  profile: profileTab,
  calendar: calendarTab,
  curriculum: curriculumTab,
  allocations: allocationsTab,
  policies: policiesTab,
};
