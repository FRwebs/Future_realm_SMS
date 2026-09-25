import {
  name as nameCell,
  pill,
  row,
  text,
  type DrawerSpec,
  type ModuleContent,
  type PanelTone,
  type TabContent,
  type TableRow,
} from "@/lib/modules/panels";
import { armRows } from "@/lib/modules/school-data";
import {
  jss2aThursday,
  namedArms,
  schoolClasses,
  subjectArmTotals,
  subjectArms,
  teacherLoads,
  unallocatedStudents,
  uncoveredSubjectArms,
  venueBase,
  type SchoolClass,
  type SubjectArm,
  type TeacherLoad,
} from "@/lib/modules/teaching-data";

/**
 * M03 · Class & Timetable — "Classes, subjects, teachers, periods — and what
 * is uncovered."
 *
 * The unit throughout is the subject-arm, never the subject: a subject nobody
 * teaches in a named arm cannot be scored, so every report card in that arm is
 * blocked by it. Nothing here shows a bare count without naming the record that
 * clears it and the person who owns it.
 *
 * The mockup reaches an arm, a class, a teacher and the timetable builder
 * through drill-down pages. There is no sub-page route here, so each opens as a
 * drawer over the list it was reached from.
 */

const classes = schoolClasses();
const placed = armRows.reduce((total, arm) => total + arm.roll, 0);
const overCapacityArms = armRows.filter((arm) => arm.roll > arm.capacity);
const noArm = unallocatedStudents.length;

/* ---------------------------------------------------------------- Classes */

function classDrawer(entry: SchoolClass): DrawerSpec {
  return {
    kicker: "Classes",
    title: entry.name,
    sub: `${entry.stage} · ${entry.armsLabel} · ${entry.roll} students.`,
    facts: [
      ["Stage", entry.stage],
      ["Arms", entry.armsLabel, "A class holds arms, not students"],
      ["Students", String(entry.roll), `Against a capacity of ${entry.capacity}`],
      ["Form masters", entry.formMasters],
      [
        "Over capacity",
        entry.overCapacity.length ? entry.overCapacity.join(", ") : "None",
        entry.overCapacity.length ? "Allowed but flagged, never silently refused" : "",
      ],
      [
        "Uncovered subject-arms",
        entry.uncovered ? String(entry.uncovered) : "None",
        entry.uncovered ? "No score can exist until somebody is named" : "",
      ],
      [
        "Position in the ladder",
        String(classes.indexOf(entry) + 1),
        "Decides promotion order at term close",
      ],
      ["State", entry.state],
    ],
  };
}

function armDrawer(arm: (typeof armRows)[number]): DrawerSpec {
  const over = arm.roll > arm.capacity;
  const fill = Math.round((arm.roll / arm.capacity) * 100);

  return {
    kicker: `${arm.className} · arm`,
    title: arm.arm,
    sub: `Form master ${arm.formMaster}. ${arm.roll} of ${arm.capacity} places taken.`,
    tone: over ? "negative" : undefined,
    facts: [
      ["Form master", arm.formMaster, "One arm has exactly one named owner"],
      ["Roll", String(arm.roll), `${fill}% of capacity`],
      [
        "Capacity",
        String(arm.capacity),
        over ? `Over by ${arm.roll - arm.capacity} — allowed, but flagged` : "",
      ],
      ["Subjects offered", String(arm.subjects)],
      ["Stream", arm.stream],
      ["Venue base", venueBase(arm.arm)],
      ["Register", "Its own, every school day", "An arm is what a register is addressed to"],
      ["State", over ? "Over capacity" : arm.roll < arm.capacity * 0.8 ? "Under-filled" : "Open"],
    ],
  };
}

const allocateDrawer: DrawerSpec = {
  mode: "commit",
  kicker: "F13 · bulk allocation",
  title: `Allocate the ${noArm} students`,
  sub: "Three children enrolled this term have never been put in an arm.",
  facts: [
    ["Students", unallocatedStudents.join(", "), "Enrolled 1–3 September"],
    [
      "What it means today",
      "They are on no register and in no result",
      "Every attendance and score figure excludes them",
    ],
    ["Preview", "Shown before anything moves", "You accept the preview, not the button"],
    ["Reversible", "Within 48 hours", "After that a fresh allocation is needed"],
  ],
  commitLabel: `Allocate the ${noArm}`,
  commitDone: `${noArm} students allocated`,
  commitDoneBody: "They are on a register from tomorrow morning, and count in every figure from now.",
};

const classesTab: TabContent = {
  title: "Classes",
  desc: "Every class, its arms, and where each student sits.",
  primary: {
    label: "Add arm",
    drawer: {
      mode: "commit",
      kicker: "Classes",
      title: "Add an arm",
      sub: "An arm gets its own register, its own form master and its own roll.",
      facts: [
        ["Class", "Chosen when you add it"],
        ["Capacity", "Inherited from the class", "Changeable per arm"],
        ["Form master", "Required", "An arm with nobody named cannot mark a register"],
        ["Students", "None yet", "Move them in from another arm, or allocate new enrolments"],
      ],
      commitLabel: "Add the arm",
      commitDone: "Arm added",
      commitDoneBody: "It has its own register from tomorrow. Nobody is in it yet.",
    },
  },
  launchers: [
    {
      label: "Add a class",
      drawer: {
        mode: "commit",
        kicker: "Classes",
        title: "Add a class",
        sub: "A class is a rung on the promotion ladder, not a group of students.",
        facts: [
          ["Position in the ladder", "Decides promotion order at term close"],
          ["Arms", "3 by default · named A, B, C"],
          ["Capacity per arm", "Set here, changeable per arm"],
        ],
        commitLabel: "Add the class",
        commitDone: "Class added",
        commitDoneBody: "It is on the ladder. Add its arms next.",
      },
    },
    { label: "Bulk allocation", drawer: allocateDrawer },
  ],
  rows: [
    row("1fr", [
      {
        type: "kpi",
        per: 5,
        cards: [
          { label: "Classes", value: String(classes.length), sub: "The promotion ladder" },
          { label: "Class arms", value: String(armRows.length), sub: "Each with its own register" },
          {
            label: "Students",
            value: (placed + noArm).toLocaleString("en-NG"),
            sub: `${Math.round(placed / armRows.length)} per arm on average`,
          },
          {
            label: "Over capacity",
            value: String(overCapacityArms.length),
            unit: overCapacityArms.length === 1 ? "arm" : "arms",
            tone: overCapacityArms.length ? "attention" : "positive",
            link: overCapacityArms.length ? overCapacityArms.map((arm) => arm.arm).join(", ") : undefined,
            drawer: overCapacityArms.length ? armDrawer(overCapacityArms[0]!) : undefined,
          },
          {
            label: "No arm yet",
            value: String(noArm),
            unit: "students",
            tone: "negative",
            link: "Allocate",
            drawer: allocateDrawer,
          },
        ],
      },
    ]),
    row("1fr", [
      {
        type: "note",
        tone: "attention",
        title: `${noArm} students have no class arm`,
        body: `${unallocatedStudents.join(", ")} were enrolled this term and never allocated.`,
        acts: [
          { label: `Allocate the ${noArm} students`, drawer: allocateDrawer },
          { label: "See their records", href: "/student-records/registry" },
        ],
      },
    ]),
    row("1fr", [
      {
        type: "table",
        title: "Classes",
        sub: "The ladder students are promoted along. A class holds arms, not students.",
        meta: `${classes.length} classes · ${armRows.length} arms · ${(placed + noArm).toLocaleString("en-NG")} students`,
        noun: "class",
        nounPlural: "classes",
        per: 8,
        selectable: true,
        search: "Find a class by name or stage",
        filters: [
          {
            label: "Stage",
            value: "All stages",
            options: ["All stages", "Early Years", "Primary", "Junior Secondary", "Senior Secondary"],
            column: 1,
          },
        ],
        bulkActs: [
          {
            label: "Add an arm to each",
            drawer: {
              mode: "commit",
              kicker: "Classes",
              title: "Add an arm to each selected class",
              sub: "One new arm per class, each with its own register.",
              facts: [
                ["Naming", "The next letter in each class", "D where a class already runs A, B, C"],
                ["Form master", "Not set", "Each new arm needs one before it can mark"],
                ["Students", "None", "Nothing moves until you move it"],
              ],
              commitLabel: "Add the arms",
              commitDone: "Arms added",
              commitDoneBody: "Each has its own register. None has a form master or a student yet.",
            },
          },
          {
            label: "Change capacity",
            drawer: {
              mode: "commit",
              kicker: "Classes",
              title: "Change capacity",
              sub: "Capacity is a flag, not a barrier — an arm over it is never silently refused.",
              facts: [
                ["Applies to", "Every arm in the selected classes"],
                ["Arms already over", "Stay where they are", "They are flagged, not emptied"],
              ],
              commitLabel: "Change capacity",
              commitDone: "Capacity changed",
              commitDoneBody: "Arms over the new capacity are flagged. Nobody was moved.",
            },
          },
          { label: "Export selected", primary: true },
        ],
        acts: [
          {
            label: "Add class",
            primary: true,
            drawer: {
              mode: "commit",
              kicker: "Classes",
              title: "Add a class",
              sub: "A class is a rung on the promotion ladder, not a group of students.",
              facts: [
                ["Position in the ladder", "Decides promotion order at term close"],
                ["Arms", "3 by default · named A, B, C"],
              ],
              commitLabel: "Add the class",
              commitDone: "Class added",
              commitDoneBody: "It is on the ladder. Add its arms next.",
            },
          },
        ],
        head: ["Class", "Stage", "Arms", "Students", "Capacity", "Form masters", "State", ""],
        rows: classes.map(
          (entry): TableRow => ({
            cells: [
              text(entry.name, { strong: true }),
              text(entry.stage),
              text(entry.armsLabel),
              text(String(entry.roll), { mono: true }),
              text(String(entry.capacity), { mono: true }),
              text(entry.formMasters),
              pill(
                entry.state,
                entry.state === "Uncovered"
                  ? "negative"
                  : entry.state === "Over capacity"
                    ? "attention"
                    : "neutral",
              ),
              { kind: "action", label: "Open", drawer: classDrawer(entry) },
            ],
            keywords: entry.arms.join(" "),
          }),
        ),
        foot: "Open a class to change its arms, capacity or promotion position — or to delete it.",
      },
    ]),
    row("1fr", [
      {
        type: "table",
        title: "Class arms",
        tag: `${armRows.length} arms`,
        tagTone: "neutral",
        sub: "Every arm, who is responsible for it, and how full it is.",
        meta: `${armRows.length} arms · ${(placed + noArm).toLocaleString("en-NG")} students · ${overCapacityArms.length} over capacity`,
        noun: "arm",
        nounPlural: "arms",
        per: 10,
        selectable: true,
        search: "Find an arm by name, form master or stream",
        filters: [
          { label: "Class", value: "All classes", options: ["All classes", ...classes.map((entry) => entry.name)] },
          {
            label: "Stream",
            value: "All streams",
            options: ["All streams", "Not streamed", "Science", "Commercial", "Arts"],
            column: 5,
          },
          {
            label: "State",
            value: "All",
            options: ["All", "Open", "Over capacity", "Under-filled"],
            column: 6,
          },
        ],
        bulkActs: [
          {
            label: "Assign a form master",
            drawer: {
              mode: "commit",
              kicker: "Class arms",
              title: "Assign a form master",
              sub: "An arm with nobody named cannot mark a register.",
              facts: [
                ["Applies to", "Every selected arm"],
                ["Existing form masters", "Replaced", "The outgoing one keeps their subject teaching"],
                ["Who is told", "Both teachers, and the arm's guardians"],
              ],
              commitLabel: "Assign",
              commitDone: "Form masters assigned",
              commitDoneBody: "Each selected arm has a named owner, and both teachers were told.",
            },
          },
          { label: "Change capacity" },
          { label: "Export selected", primary: true },
        ],
        head: ["Arm", "Form master", "Roll", "Capacity", "Subjects", "Stream", "State", ""],
        rows: armRows.map((arm): TableRow => {
          const over = arm.roll > arm.capacity;

          return {
            cells: [
              text(arm.arm, { strong: true }),
              arm.formMaster
                ? nameCell(arm.formMaster, "Form master")
                : text("Nobody named", { tone: "negative", strong: true }),
              text(String(arm.roll), { mono: true }),
              text(`${arm.roll} / ${arm.capacity}`, { mono: true, tone: over ? "negative" : "positive" }),
              text(String(arm.subjects), { mono: true }),
              text(arm.stream),
              pill(
                over ? "Over capacity" : arm.roll < arm.capacity * 0.8 ? "Under-filled" : "Open",
                over ? "negative" : "neutral",
              ),
              { kind: "action", label: "Open", drawer: armDrawer(arm) },
            ],
            keywords: `${arm.formMaster} ${arm.className} ${arm.stream}`,
          };
        }),
        foot: "Open an arm for its roster, its subject teachers and its register history — or to delete it.",
      },
    ]),
    row("1fr 1.15fr", [
      {
        type: "note",
        tone: "progress",
        icon: "M9.5 11.3a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7M3 20v-1.2A4.6 4.6 0 0 1 7.6 14h3.8a4.6 4.6 0 0 1 4.6 4.8V20",
        title: "Balancing proposal for JSS 2A",
        body: "JSS 2A holds 34 against a capacity of 32. Splitting into JSS 2A and a new JSS 2D would give 17 and 17.",
        acts: [
          {
            label: "Review the proposal",
            drawer: {
              mode: "commit",
              kicker: "F13 · balancing",
              title: "Split JSS 2A into JSS 2A and JSS 2D",
              sub: "34 students become 17 and 17, against a capacity of 32 each.",
              facts: [
                ["Arm today", "JSS 2A · 34 of 32"],
                ["After the split", "JSS 2A 17 · JSS 2D 17"],
                ["New arm", "JSS 2D", "Needs a form master before it can mark a register"],
                ["Who moves", "17 students, named in the preview", "Chosen to keep friendship groups where possible"],
                ["Their scores", "Move with them", "Nothing entered is lost or restated"],
                ["Guardians", "Told once the split is accepted"],
              ],
              commitLabel: "Accept the split",
              commitDone: "JSS 2A split",
              commitDoneBody: "17 students are now in JSS 2D. It needs a form master before it can mark a register.",
            },
          },
          {
            label: "Change capacity instead",
            drawer: {
              mode: "commit",
              kicker: "Class arms",
              title: "Raise JSS 2A's capacity to 34",
              sub: "Nobody moves. The arm stops being flagged.",
              facts: [
                ["Capacity now", "32"],
                ["Capacity after", "34"],
                ["Students moved", "None"],
                ["Effect", "The over-capacity flag clears", "The room is still the size it was"],
              ],
              commitLabel: "Raise the capacity",
              commitDone: "Capacity raised to 34",
              commitDoneBody: "JSS 2A is no longer flagged. Nobody moved.",
            },
          },
        ],
      },
      {
        type: "list",
        title: "Recent allocations",
        readOnly: true,
        items: [
          {
            label: "14 students moved JSS 1B → JSS 1D",
            sub: "By you, 2 September · reversal window closed · preview accepted",
            pill: "Complete",
          },
          {
            label: "62 students promoted JSS 3 → SSS 1",
            sub: "By Dr Emmanuel Nwosu, 20 August · typed confirmation, 62 above the 50 threshold",
            pill: "Complete",
          },
          {
            label: `${noArm} students awaiting allocation`,
            sub: "Enrolled 1–3 September · no arm · excluded from all registers",
            pill: "Not started",
            tone: "attention",
          },
        ],
      },
    ]),
  ],
};

/* --------------------------------------------------------------- Subjects */

function subjectArmDrawer(entry: SubjectArm): DrawerSpec {
  const assigned = Boolean(entry.teacher);

  return {
    kicker: "Subject catalogue",
    title: `${entry.subject} · ${entry.arm}`,
    sub: assigned
      ? `Taught by ${entry.teacher}.`
      : "Nobody teaches this yet — name someone here.",
    tone: assigned ? undefined : "negative",
    facts: [
      ["Subject", entry.subject, `Code ${entry.code}`],
      ["Arm", entry.arm],
      ["Category", entry.category],
      [
        "Teacher",
        entry.teacher || "Not assigned",
        assigned
          ? `${entry.department} department`
          : `Unassigned for ${entry.unassignedDays} days — no scores can exist until someone is named`,
      ],
      ["Teacher state", assigned ? "Assigned" : "Not assigned"],
      ["Takers", String(entry.takers), "Students registered for it in this arm"],
      ["Periods a week", assigned ? "4" : "0"],
      ["Counts to the average", "Yes"],
      ["Compulsory here", /Core/.test(entry.category) ? "Yes" : "No"],
      [
        "Removing it",
        `Unregisters ${entry.takers} students`,
        "Scores already entered are kept but no longer count",
      ],
    ],
  };
}

function teacherDrawer(teacher: TeacherLoad): DrawerSpec {
  const held = subjectArms.filter((entry) => entry.teacher === teacher.name);
  const over = teacher.periods > subjectArmTotals.ceiling;

  return {
    kicker: `${teacher.department} department`,
    title: teacher.name,
    sub: `Every subject-arm this teacher holds, and what it costs them in periods.`,
    tone: over ? "negative" : undefined,
    facts: [
      ["Department", teacher.department],
      ["Distinct subjects", String(teacher.subjects.length), teacher.subjects.join(", ")],
      ["Arms taught", teacher.arms],
      [
        "Periods a week",
        `${teacher.periods} of ${subjectArmTotals.ceiling}`,
        over
          ? "Over the ceiling — a mapping has to move, or the ceiling has to be raised with a reason"
          : teacher.verdict,
      ],
      [
        "Subject-arms held",
        String(held.length),
        held.length ? held.map((entry) => `${entry.subject} ${entry.arm}`).join(", ") : "None named here",
      ],
      [
        "Students taught",
        String(held.reduce((total, entry) => total + entry.takers, 0)),
        "Across every arm they hold",
      ],
      [
        "Score sheets owed",
        teacher.name === "Mr Samuel Adeyemi" ? "1" : "0",
        teacher.name === "Mr Samuel Adeyemi"
          ? "Chemistry SSS 2A · returned 9 days ago"
          : "Nothing outstanding",
      ],
    ],
  };
}

const invalidCombinations: Array<[string, string]> = [
  [
    "Chioma Adebayo · SSS 2A",
    "No trade subject selected. The Senior Secondary rule requires exactly one from the Trade choice group.",
  ],
  [
    "Emeka Okafor · SSS 1B",
    "Takes 12 subjects. The maximum at Senior Secondary is 11 for this school.",
  ],
  [
    "Fatima Bello · SSS 2B",
    "Registered for Physics, which is restricted to the Science stream. She is in the Commercial stream.",
  ],
  [
    "Tunde Ogunlesi · SSS 3A",
    "Takes 7 subjects. The minimum at Senior Secondary is 8 for this school.",
  ],
];

const subjectsTab: TabContent = {
  title: "Subjects",
  desc: "What each class offers and what each student takes.",
  primary: {
    label: "Register subjects",
    drawer: {
      mode: "commit",
      kicker: "Subjects",
      title: "Register subjects",
      sub: "The school registers on the student's behalf. Registration closes at the end of week 2.",
      facts: [
        ["Who registers", "The school", "Not the student, and not the guardian"],
        ["Rules enforced", "At the point of registration", "A combination that breaks a rule is refused, with the rule named"],
        ["Carried forward", "Automatic from the previous term"],
        ["Changing after close", "Needs approval"],
      ],
      commitLabel: "Register",
      commitDone: "Subjects registered",
      commitDoneBody: "Every registration was checked against the rules in force before it was saved.",
    },
  },
  launchers: [
    {
      label: "Add a subject",
      drawer: {
        mode: "commit",
        kicker: "Subjects",
        title: "Add a subject",
        sub: "A subject in the catalogue is not yet taught anywhere — that takes a subject-arm.",
        facts: [
          ["Catalogue", `${subjectArmTotals.subjects} subjects today`],
          ["Category", "Core, elective, trade or co-curricular"],
          ["Counts to the average", "Your choice per subject"],
          ["Next step", "Offer it to an arm, and name who teaches it there"],
        ],
        commitLabel: "Add the subject",
        commitDone: "Subject added",
        commitDoneBody: "It is in the catalogue. Nobody takes it until it is offered to an arm.",
      },
    },
  ],
  rows: [
    row("1fr", [
      {
        type: "kpi",
        per: 4,
        cards: [
          {
            label: "Subjects in catalogue",
            value: String(subjectArmTotals.subjects),
            sub: "Core, elective, trade and co-curricular",
          },
          { label: "Choice groups", value: "3", sub: "Trade, language and stream rules" },
          {
            label: "Invalid combinations",
            value: String(invalidCombinations.length),
            sub: "Named by student and rule broken",
            tone: "negative",
            link: `See the ${invalidCombinations.length}`,
          },
          {
            label: "Not counted to average",
            value: "1",
            sub: "Physical Education · the school's own decision",
          },
        ],
      },
    ]),
    row("1fr", [
      {
        type: "blockers",
        title: "Invalid subject combinations",
        tag: `${invalidCombinations.length} students`,
        tagTone: "negative",
        acts: [{ label: "Export list" }],
        items: invalidCombinations.map(([title, detail]) => ({
          title,
          detail,
          action: "Fix registration",
          drawer: {
            mode: "commit" as const,
            kicker: "Registration",
            title: `Fix ${title}`,
            sub: detail,
            facts: [
              ["Student", title.split(" · ")[0]!],
              ["Arm", title.split(" · ")[1]!],
              ["Rule broken", detail],
              ["Where the rule is set", "Curriculum · Subjects", "Enforced at the point of registration"],
              ["Until it is fixed", "The registration stands", "A broken combination is flagged, never silently corrected"],
            ],
            commitLabel: "Fix the registration",
            commitDone: "Registration fixed",
            commitDoneBody: "The combination now satisfies every rule in force.",
          },
        })),
      },
    ]),
    row("1fr", [
      {
        type: "table",
        title: "Subject catalogue",
        tag: `${subjectArmTotals.unassigned} unassigned`,
        tagTone: "negative",
        sub: "Filter to a class or an arm to see exactly what that arm offers and who teaches it.",
        meta: `${subjectArmTotals.subjects} subjects · ${subjectArmTotals.subjectArms} subject-arms · ${subjectArmTotals.unassigned} with no teacher`,
        noun: "subject",
        nounPlural: "subjects",
        per: 8,
        selectable: true,
        search: "Find a subject by name, code, category or teacher",
        filters: [
          { label: "Arm", value: "All arms", options: ["All arms", ...namedArms], column: 3 },
          { label: "Teacher", value: "All", options: ["All", "Assigned", "Not assigned"], column: 5 },
          {
            label: "Category",
            value: "All categories",
            options: [
              "All categories", "Core", "Science", "Commercial", "Arts",
              "Language", "Trade", "Co-curricular", "Humanities", "Vocational",
            ],
            column: 2,
          },
        ],
        bulkActs: [
          { label: "Assign a teacher to all" },
          { label: "Change the offering" },
          { label: "Export selected", primary: true },
        ],
        acts: [
          { label: `Assign the ${subjectArmTotals.unassigned} uncovered`, drawer: subjectArmDrawer(uncoveredSubjectArms[0]!) },
          {
            label: "Add subject",
            primary: true,
            drawer: {
              mode: "commit",
              kicker: "Subject catalogue",
              title: "Add a subject",
              sub: "A subject in the catalogue is not yet taught anywhere.",
              facts: [
                ["Catalogue", `${subjectArmTotals.subjects} subjects today`],
                ["Next step", "Offer it to an arm, and name who teaches it there"],
              ],
              commitLabel: "Add the subject",
              commitDone: "Subject added",
              commitDoneBody: "It is in the catalogue. Nobody takes it until it is offered to an arm.",
            },
          },
        ],
        head: ["Subject", "Code", "Category", "Arm", "Teacher", "Teacher state", "Takers", ""],
        rows: subjectArms.map(
          (entry): TableRow => ({
            cells: [
              text(entry.subject, { strong: true }),
              text(entry.code),
              text(entry.category),
              text(entry.arm),
              entry.teacher
                ? nameCell(entry.teacher, entry.department)
                : text(`Nobody named · ${entry.unassignedDays} days`, { tone: "negative", strong: true }),
              pill(entry.teacher ? "Assigned" : "Not assigned", entry.teacher ? "positive" : "negative"),
              text(String(entry.takers), { mono: true }),
              {
                kind: "action",
                label: entry.teacher ? "Edit" : "Assign",
                drawer: subjectArmDrawer(entry),
              },
            ],
            keywords: `${entry.teacher} ${entry.department}`,
          }),
        ),
        foot: "Teacher state says plainly whether a subject-arm has anybody to teach it. Assign from the row, or from the subject's own modal.",
      },
    ]),
    row("1fr", [
      {
        type: "table",
        title: "Teachers and what they teach",
        sub: "Open a teacher to see every subject-arm they hold, and to change any of them.",
        meta: `${subjectArmTotals.teachingStaff} teaching staff · ${subjectArmTotals.assigned} of ${subjectArmTotals.subjectArms} subject-arms covered`,
        noun: "teacher",
        nounPlural: "teachers",
        per: 8,
        search: "Find a teacher by name or department",
        filters: [
          {
            label: "Department",
            value: "All departments",
            options: [
              "All departments", "Mathematics", "Languages", "Sciences",
              "Commerce", "Humanities", "Vocational",
            ],
            column: 1,
          },
          {
            label: "Load",
            value: "All",
            options: ["All", "Over the ceiling", "At the ceiling", "Under-loaded", "Within range"],
            column: 5,
          },
        ],
        acts: [
          {
            label: "Map a subject to a teacher",
            primary: true,
            drawer: {
              mode: "commit",
              kicker: "Teachers",
              title: "Map a subject to a teacher",
              sub: "A mapping always names the exact arm — never just the subject.",
              facts: [
                ["Ceiling", `${subjectArmTotals.ceiling} periods a week`, "A mapping that breaks it is refused, with the load named"],
                ["Effect", "The teacher can enter scores for that subject-arm"],
                ["Who is told", "The teacher, and the Head of Department"],
              ],
              commitLabel: "Map it",
              commitDone: "Subject mapped",
              commitDoneBody: "The teacher can enter scores for that subject-arm from now.",
            },
          },
        ],
        head: ["Teacher", "Department", "Subjects", "Arms taught", "Periods", "Load", ""],
        rows: teacherLoads.map(
          (teacher): TableRow => ({
            cells: [
              nameCell(teacher.name, teacher.department),
              text(teacher.department),
              text(String(teacher.subjects.length), { mono: true }),
              text(teacher.arms),
              text(String(teacher.periods), { mono: true }),
              text(teacher.verdict, {
                strong: teacher.verdict !== "Within range",
                tone:
                  teacher.periods > subjectArmTotals.ceiling
                    ? "negative"
                    : teacher.periods < 12
                      ? "attention"
                      : undefined,
              }),
              { kind: "action", label: "View", drawer: teacherDrawer(teacher) },
            ],
            keywords: teacher.subjects.join(" "),
          }),
        ),
        foot: `The ceiling is ${subjectArmTotals.ceiling} periods a week. A mapping always names the exact arm — never just the subject.`,
      },
    ]),
    row("1.1fr 1fr", [
      {
        type: "facts",
        title: "Registration rules in force",
        sub: "Set in Curriculum · Subjects and enforced at the point of registration.",
        per: 2,
        facts: [
          ["Minimum at Senior Secondary", "8 subjects"],
          ["Maximum at Senior Secondary", "11 subjects"],
          ["Trade choice group", "Exactly 1 of 6"],
          ["Language choice group", "At least 1 of 3"],
          ["Stream restriction", "Physics, Chemistry, Biology · Science only"],
          ["Carried forward", "Automatic from previous term"],
        ],
      },
      {
        type: "list",
        title: "Bulk registration",
        sub: "The common case is a whole arm taking the same offering.",
        items: [
          {
            label: "JSS 1A — register 29 students for the JSS 1 core offering",
            sub: "12 subjects each · preview shows 348 registrations",
            pill: "Ready",
            viewLabel: "Run",
            drawer: {
              mode: "commit",
              kicker: "Bulk registration · JSS 1A",
              title: "Register 29 students for the JSS 1 core offering",
              sub: "Every child in the arm takes the same 12 subjects.",
              facts: [
                ["Students", "29", "Every child on the JSS 1A roll"],
                ["Subjects each", "12"],
                ["Registrations created", "348"],
                ["Rules checked", "Every one, per student", "A child who breaks a rule is skipped and named"],
                ["Reversible", "Yes, until the first score is entered"],
              ],
              commitLabel: "Register the 29",
              commitDone: "29 students registered",
              commitDoneBody: "348 registrations were created. Every one satisfies the rules in force.",
            },
          },
          {
            label: "SSS 1A — register 26 students for the Science offering",
            sub: "9 core plus 1 trade choice · 26 choices still to make individually",
            pill: "Partial",
            tone: "attention",
            viewLabel: "Run",
            drawer: {
              mode: "commit",
              kicker: "Bulk registration · SSS 1A",
              title: "Register 26 students for the Science offering",
              sub: "The 9 core subjects go in for everybody. The trade choice cannot be made for them.",
              facts: [
                ["Students", "26"],
                ["Core subjects", "9", "Identical for every child in the offering"],
                ["Trade choice", "1 of 6, per student", "26 choices still to make individually"],
                ["After this runs", "26 students still short of the Trade rule", "They will appear as invalid combinations until the choices are made"],
              ],
              commitLabel: "Register the core 9",
              commitDone: "26 students registered for the core 9",
              commitDoneBody: "Each still needs a trade choice. They appear as invalid combinations until it is made.",
            },
          },
          {
            label: "SSS 2B — registered on 8 January",
            sub: "24 students · by Mrs Blessing Uche · 1 override recorded",
            pill: "Complete",
          },
        ],
      },
    ]),
  ],
};

/* --------------------------------------------------------------- Teaching */

const assignmentRows: Array<{
  subject: string;
  arm: string;
  teacher: string;
  department: string;
  assistant: string;
  periods: string;
  days?: number;
}> = [
  { subject: "Civic Education", arm: "JSS 3A", teacher: "", department: "", assistant: "—", periods: "2", days: 34 },
  { subject: "Civic Education", arm: "JSS 3C", teacher: "", department: "", assistant: "—", periods: "2", days: 34 },
  { subject: "Mathematics", arm: "JSS 2A", teacher: "Mr Ibrahim Danladi", department: "Mathematics", assistant: "—", periods: "5" },
  { subject: "Chemistry", arm: "SSS 2A", teacher: "Mr Samuel Adeyemi", department: "Sciences", assistant: "Miss Grace Etim", periods: "4" },
  { subject: "English Language", arm: "JSS 1A", teacher: "Mrs Folake Adeniyi", department: "Languages", assistant: "—", periods: "5" },
  { subject: "Financial Accounting", arm: "SSS 2B", teacher: "Mrs Blessing Uche", department: "Commerce", assistant: "—", periods: "4" },
  { subject: "Physics", arm: "SSS 3A", teacher: "Mr Peter Obi", department: "Sciences", assistant: "—", periods: "4" },
  { subject: "French", arm: "JSS 1C", teacher: "Mrs Ngozi Eze", department: "Languages", assistant: "—", periods: "2" },
];

const assignUncoveredDrawer: DrawerSpec = {
  mode: "commit",
  kicker: "Teaching",
  title: `Assign the ${subjectArmTotals.unassigned} uncovered subject-arms`,
  sub: "Civic Education in JSS 3A and JSS 3C has had nobody for 34 days.",
  facts: [
    ["Subject-arms", uncoveredSubjectArms.map((entry) => `${entry.subject} ${entry.arm}`).join(" · ")],
    ["Unassigned for", "34 days", "Counted from the start of term"],
    [
      "What it blocks",
      `${uncoveredSubjectArms.reduce((total, entry) => total + entry.takers, 0)} report cards`,
      "No score can exist for a subject nobody teaches",
    ],
    ["Owner", "Mrs Folake Adeniyi · Head of Languages", "The department the subject sits in"],
    ["Effect", "Scores can be entered from the moment somebody is named"],
  ],
  commitLabel: "Assign them",
  commitDone: "Subject-arms assigned",
  commitDoneBody: "Both are covered. Scores can be entered, and the blocked report cards can compute.",
};

const teachingTab: TabContent = {
  title: "Teaching",
  desc: "Who teaches what, to whom — and whether anything is uncovered.",
  primary: {
    label: `Assign the ${subjectArmTotals.unassigned} uncovered`,
    drawer: assignUncoveredDrawer,
  },
  launchers: [{ label: "Open the timetable", href: "/class-timetable/timetable" }],
  rows: [
    row("1fr", [
      {
        type: "kpi",
        per: 5,
        cards: [
          { label: "Subject-arms", value: String(subjectArmTotals.subjectArms), sub: `Across ${armRows.length} arms` },
          {
            label: "Assigned",
            value: String(subjectArmTotals.assigned),
            unit: `of ${subjectArmTotals.subjectArms}`,
            sub: "Primary teacher named",
            tone: "positive",
          },
          {
            label: "Unassigned",
            value: String(subjectArmTotals.unassigned),
            sub: "Civic Education JSS 3A and 3C · 34 days",
            tone: "negative",
            link: "Assign them",
            drawer: assignUncoveredDrawer,
          },
          {
            label: "Load outside ceiling",
            value: "2",
            sub: `Ceiling is ${subjectArmTotals.ceiling} periods a week`,
            tone: "attention",
          },
          {
            label: "Timetables in draft",
            value: "2",
            sub: "Version 5 and a Third Term proposal",
            tone: "attention",
            link: "Open timetables",
            href: "/class-timetable/timetable",
          },
        ],
      },
    ]),
    row("1fr", [
      {
        type: "table",
        title: "Assignments · subject × arm",
        tag: `${subjectArmTotals.unassigned} unassigned`,
        tagTone: "negative",
        sub: "Unassigned combinations carry days since term start.",
        meta: `${subjectArmTotals.subjectArms} subject-arms · ${subjectArmTotals.assigned} assigned`,
        noun: "subject-arm",
        nounPlural: "subject-arms",
        per: 8,
        selectable: true,
        search: "Find by subject, arm or teacher",
        filters: [
          { label: "Arm", value: "All", options: ["All", ...namedArms], column: 1 },
          { label: "State", value: "All", options: ["All", "Assigned", "Unassigned"], column: 5 },
        ],
        bulkActs: [
          { label: "Bulk assign teacher" },
          { label: "Export selected", primary: true },
        ],
        acts: [{ label: `Assign the ${subjectArmTotals.unassigned} uncovered`, drawer: assignUncoveredDrawer }],
        head: ["Subject", "Arm", "Primary teacher", "Assistant", "Periods", "State", ""],
        rows: assignmentRows.map((entry): TableRow => {
          const mapped =
            subjectArms.find((sa) => sa.subject === entry.subject && sa.arm === entry.arm) ??
            subjectArms.find((sa) => sa.subject === entry.subject)!;

          return {
            cells: [
              text(entry.subject, { strong: true }),
              text(entry.arm),
              entry.teacher
                ? nameCell(entry.teacher, entry.department)
                : text(`Unassigned · ${entry.days} days`, { tone: "negative", strong: true }),
              entry.assistant === "—"
                ? text("—")
                : nameCell(entry.assistant, "Assistant"),
              text(entry.periods, { mono: true }),
              pill(entry.teacher ? "Assigned" : "Unassigned", entry.teacher ? "positive" : "negative"),
              {
                kind: "action",
                label: entry.teacher ? "Edit" : "Assign",
                drawer: subjectArmDrawer(mapped),
              },
            ],
            keywords: entry.teacher || "unassigned",
          };
        }),
      },
    ]),
    row("1.15fr 1fr", [
      {
        type: "table",
        title: "Schedule · JSS 2A, Thursday",
        sub: "The arm's day as the running timetable has it.",
        meta: "8 periods · no unresolved clashes",
        noun: "period",
        nounPlural: "periods",
        head: ["Period", "Time", "Subject", "Teacher", "Venue"],
        rows: jss2aThursday.slice(0, 6).map(
          (slot): TableRow => ({
            cells: [
              text(slot.period, { strong: slot.period !== "—" }),
              text(slot.time),
              text(slot.subject, slot.subject === "Break" ? {} : { strong: true }),
              text(slot.teacher),
              text(slot.venue),
            ],
          }),
        ),
      },
      {
        type: "bars",
        title: "Teaching load",
        sub: `The school ceiling is ${subjectArmTotals.ceiling} periods a week.`,
        rows: [
          { label: "Mr Ibrahim Danladi", value: 100, display: "27 of 24", tone: "negative", sub: "3 periods above the school ceiling" },
          { label: "Mrs Folake Adeniyi", value: 89, display: "24 of 24", tone: "attention", sub: "At the ceiling exactly" },
          { label: "Mr Samuel Adeyemi", value: 78, display: "21 of 24", tone: "positive" },
          { label: "Mrs Ngozi Eze", value: 67, display: "18 of 24", tone: "positive" },
          { label: "Miss Grace Etim", value: 22, display: "6 of 24", tone: "attention", sub: "Newly activated · capacity for 3 more subject-arms" },
        ],
        foot: "A teacher over the ceiling has to give a mapping up, or the ceiling has to be raised for them with a recorded reason.",
      },
    ]),
  ],
};

/* -------------------------------------------------------------- Timetable */

type TimetableRow = {
  name: string;
  sub: string;
  term: string;
  state: "Running" | "Draft" | "Archived";
  arms: string;
  builtBy: string;
  edited: string;
};

const timetables: TimetableRow[] = [
  { name: "Version 4 · running", sub: "Second Term 2026/2027 · 8 periods a day", term: "Second Term", state: "Running", arms: "42", builtBy: "You", edited: "14 Jan" },
  { name: "Version 5 · draft", sub: "2 pending changes from version 4", term: "Second Term", state: "Draft", arms: "42", builtBy: "Mr Samuel Adeyemi", edited: "Yesterday" },
  { name: "Third Term proposal", sub: "Built ahead of the term, not yet reviewed", term: "Third Term", state: "Draft", arms: "42", builtBy: "Mr Samuel Adeyemi", edited: "2 Sep" },
  { name: "Version 3", sub: "Superseded by version 4", term: "Second Term", state: "Archived", arms: "42", builtBy: "You", edited: "9 Jan" },
  { name: "First Term final", sub: "The timetable the first term ran on", term: "First Term", state: "Archived", arms: "41", builtBy: "Mrs Folake Adeniyi", edited: "4 Dec" },
];

function previewDrawer(entry: TimetableRow): DrawerSpec {
  return {
    kicker: `${entry.term} · ${entry.state.toLowerCase()}`,
    title: entry.name,
    sub: `${entry.sub}. JSS 2A's Thursday on this timetable is below.`,
    readOnly: entry.state === "Archived",
    readOnlyNote:
      entry.state === "Archived"
        ? "Kept exactly as it ran. Readable, not editable."
        : undefined,
    facts: [
      ["Term", entry.term],
      ["State", entry.state],
      ["Arms covered", entry.arms, `Of the ${armRows.length} in the school`],
      ["Built by", entry.builtBy],
      ["Last edited", entry.edited],
      ["Periods a day", "8", "40 minutes each, from 08:00, break after period 3"],
      ...jss2aThursday.map(
        (slot): [string, string, string?] => [
          slot.period === "—" ? "Break" : `Period ${slot.period}`,
          slot.subject === "Break" ? slot.time : `${slot.subject} · ${slot.teacher}`,
          slot.subject === "Break" ? "" : `${slot.time} · ${slot.venue}`,
        ],
      ),
    ],
  };
}

/**
 * One arm's week on the running timetable.
 *
 * The mockup's "View week" opens the arm you clicked, not a fixed one. Only
 * JSS 2A's actual day is stated in the mockup, so every other arm's drawer
 * names what is true of it — its master, its periods, its subjects, its block —
 * rather than showing another arm's lessons under its name.
 */
function armWeekDrawer(arm: (typeof armRows)[number]): DrawerSpec {
  const known = arm.arm === "JSS 2A";

  return {
    kicker: "Version 4 · running",
    title: `${arm.arm} · the running week`,
    sub: known
      ? "Thursday, as its teachers and guardians see it."
      : "The same week its teachers and guardians see.",
    facts: [
      ["Arm", arm.arm, arm.className],
      ["Form master", arm.formMaster || "Nobody named"],
      ["Periods a week", "40", "8 a day, 40 minutes each, from 08:00"],
      ["Subjects", String(arm.subjects)],
      ["Venue base", venueBase(arm.arm), "Where its lessons sit unless a subject needs a specialist room"],
      ["Break", "10:00–10:20", "After period 3"],
      ...(known
        ? jss2aThursday.map(
            (slot): [string, string, string?] => [
              slot.period === "—" ? "Break" : `Period ${slot.period}`,
              slot.subject === "Break" ? slot.time : `${slot.subject} · ${slot.teacher}`,
              slot.subject === "Break" ? "" : `${slot.time} · ${slot.venue}`,
            ],
          )
        : ([["Day shown", "Open the full-week preview to pick a day", ""]] as Array<[string, string, string?]>)),
    ],
  };
}

const publishDrawer: DrawerSpec = {
  mode: "commit",
  kicker: "Timetable",
  title: "Publish a timetable",
  sub: "Publishing replaces the running one and tells every teacher whose periods changed.",
  facts: [
    ["Running today", "Version 4 · published 14 January"],
    ["Clashes", "Checked against every teacher and every venue", "A timetable with unresolved clashes cannot be published"],
    ["Who is told", "Every teacher whose periods changed", "SMS and in-app"],
    ["Per-period attendance", "Becomes available for every arm on it"],
    ["Reversible", "Yes — the previous version can be republished", "Staff would be notified again"],
  ],
  commitLabel: "Publish it",
  commitDone: "Timetable published",
  commitDoneBody: "It is the running timetable. Every teacher whose periods changed has been told.",
};

const timetableTab: TabContent = {
  title: "Timetable",
  desc: "Every timetable built, and which one is running.",
  primary: {
    label: "New timetable",
    drawer: {
      mode: "commit",
      kicker: "Timetable",
      title: "New timetable",
      sub: "Pick a subject, then tap the periods it runs in. Nothing is published by saving a draft.",
      facts: [
        ["Term", "Second Term 2026/2027"],
        ["Periods a day", "8 · 40 minutes each", "First period at 08:00, break after period 3"],
        ["School days", "Mon to Fri"],
        ["Clash checking", "On every tap", "A draft may hold clashes. Publishing one may not."],
      ],
      commitLabel: "Save the draft",
      commitNote: "Nothing is published by saving a draft.",
      commitDone: "Timetable saved as a draft",
      commitDoneBody: "It is in the list of timetables. The running timetable is untouched.",
    },
  },
  launchers: [
    { label: "Preview the running timetable", drawer: previewDrawer(timetables[0]!) },
    { label: "Publish a timetable", drawer: publishDrawer },
  ],
  rows: [
    row("1fr", [
      {
        type: "note",
        tone: "positive",
        icon: "M5 12.5l4.5 4.5 9-10",
        title: "Running now · Second Term 2026/2027, version 4",
        body: `Published 14 January by you. ${armRows.length} arms, ${subjectArmTotals.subjectArms} subject-arms, 8 periods a day, no unresolved clashes. Per-period attendance is available for every arm on it.`,
        acts: [
          { label: "Preview it", drawer: previewDrawer(timetables[0]!) },
          { label: "Publish a different one", drawer: publishDrawer },
        ],
      },
    ]),
    row("1fr", [
      {
        type: "kpi",
        per: 4,
        cards: [
          {
            label: "Running",
            value: "1",
            sub: "Version 4 · published 14 January",
            tone: "positive",
            link: "Preview it",
            drawer: previewDrawer(timetables[0]!),
          },
          {
            label: "In draft",
            value: "2",
            sub: "Version 5 and a Third Term proposal",
            tone: "progress",
          },
          {
            label: "Arms covered",
            value: String(armRows.length),
            unit: `of ${armRows.length}`,
            sub: "Every arm has periods on the running version",
            tone: "positive",
          },
          {
            label: "Unresolved clashes",
            value: "0",
            sub: "Checked on every save, not only on publish",
            tone: "positive",
          },
        ],
      },
    ]),
    row("1fr", [
      {
        type: "table",
        title: "All timetables",
        sub: "The running one is marked. Open any to preview, edit, publish or delete.",
        meta: `${timetables.length} timetables · 1 running`,
        noun: "timetable",
        nounPlural: "timetables",
        per: 8,
        search: "Find a timetable by name, term or who built it",
        filters: [
          {
            label: "Term",
            value: "All terms",
            options: ["All terms", "First Term", "Second Term", "Third Term"],
            column: 1,
          },
          { label: "State", value: "All", options: ["All", "Running", "Draft", "Archived"], column: 2 },
        ],
        acts: [
          { label: "Publish a timetable", drawer: publishDrawer },
          {
            label: "New timetable",
            primary: true,
            drawer: {
              mode: "commit",
              kicker: "Timetable",
              title: "New timetable",
              sub: "Pick a subject, then tap the periods it runs in.",
              facts: [
                ["Clash checking", "On every tap"],
                ["Published", "Nothing, until you publish it"],
              ],
              commitLabel: "Save the draft",
              commitDone: "Timetable saved as a draft",
              commitDoneBody: "It is in the list of timetables. The running timetable is untouched.",
            },
          },
        ],
        head: ["Timetable", "Term", "State", "Arms", "Built by", "Last edited", ""],
        rows: timetables.map(
          (entry): TableRow => ({
            cells: [
              nameCell(entry.name, entry.sub, { avatar: false }),
              text(entry.term),
              pill(
                entry.state,
                entry.state === "Running" ? "positive" : entry.state === "Draft" ? "progress" : "neutral",
              ),
              text(entry.arms, { mono: true }),
              text(entry.builtBy),
              text(entry.edited),
              { kind: "action", label: "Preview", drawer: previewDrawer(entry) },
            ],
            keywords: `${entry.builtBy} ${entry.sub}`,
          }),
        ),
        foot: "Publishing a timetable notifies every teacher whose periods changed, and never silently replaces the running one.",
      },
    ]),
    row("1fr", [
      {
        type: "table",
        title: "What is running, by arm",
        sub: "Choose a class and an arm to see the week that arm is actually on.",
        meta: `Version 4 · every one of the ${armRows.length} arms is on it`,
        noun: "arm",
        nounPlural: "arms",
        per: 8,
        search: "Find an arm or a form master",
        filters: [
          { label: "Class", value: "All classes", options: ["All classes", ...classes.map((entry) => entry.name)], column: 1 },
          { label: "Venue", value: "All", options: ["All", "Block A", "Block B", "Block C"], column: 5 },
        ],
        acts: [{ label: "Preview the running week", primary: true, drawer: previewDrawer(timetables[0]!) }],
        head: ["Arm", "Class", "Form master", "Periods", "Subjects", "Venue base", ""],
        rows: armRows.map(
          (arm): TableRow => ({
            cells: [
              text(arm.arm, { strong: true }),
              text(arm.className),
              arm.formMaster
                ? nameCell(arm.formMaster, "Form master")
                : text("Nobody named", { tone: "negative", strong: true }),
              text("40", { mono: true }),
              text(String(arm.subjects), { mono: true }),
              text(venueBase(arm.arm)),
              { kind: "action", label: "View week", drawer: armWeekDrawer(arm) },
            ],
            keywords: arm.formMaster,
          }),
        ),
        foot: "View week opens that arm's own grid — the same one its teachers and guardians see.",
      },
    ]),
    row("1.15fr 1fr", [
      {
        type: "table",
        title: "Running timetable · JSS 2A, Thursday",
        tag: "Version 4",
        tagTone: "positive",
        sub: "A single arm's day. Change the arm or the day from the preview.",
        meta: "8 periods · no clashes",
        noun: "period",
        nounPlural: "periods",
        acts: [{ label: "Preview the full week", drawer: previewDrawer(timetables[0]!) }],
        head: ["Period", "Time", "Subject", "Teacher", "Venue"],
        rows: jss2aThursday.map(
          (slot): TableRow => ({
            cells: [
              text(slot.period, { strong: slot.period !== "—" }),
              text(slot.time),
              text(slot.subject, slot.subject === "Break" ? {} : { strong: true }),
              text(slot.teacher),
              text(slot.venue),
            ],
          }),
        ),
      },
      {
        type: "list",
        title: "What changed, and who was told",
        sub: "Every publish leaves this behind.",
        readOnly: true,
        items: [
          {
            label: "Version 4 published — 9 periods moved, 2 rooms reassigned",
            sub: "14 January by you · 14 staff notified, all delivered",
            pill: "Complete",
            viewLabel: "View",
            facts: [
              ["Version", "4"],
              ["Published", "14 January 2026, 16:20", "By you · Adaeze Nwosu"],
              ["Periods moved", "9", "JSS 2A, JSS 3B and SSS 1A affected"],
              ["Rooms reassigned", "2", "Laboratory 1 and Block B · 3"],
              ["Staff notified", "14", "SMS and in-app · all 14 delivered"],
              ["Clashes at publish", "0", "Checked against every teacher and every venue"],
              ["Reversible", "Yes — version 3 can be republished", "Staff would be notified again"],
            ],
          },
          {
            label: "Version 3 published — first full timetable of the term",
            sub: "9 January by you · 42 staff notified",
            pill: "Complete",
            viewLabel: "View",
            facts: [
              ["Version", "3"],
              ["Published", "9 January 2026, 09:05", "By you"],
              ["Arms covered", "42", "Every arm for the first time this term"],
              ["Staff notified", "42", "All delivered"],
              ["Clashes at publish", "0"],
            ],
          },
          {
            label: "Version 2 discarded before publishing",
            sub: "7 January by Mr Samuel Adeyemi · 3 unresolved clashes",
            pill: "Cancelled",
            tone: "attention",
            viewLabel: "View",
            facts: [
              ["Version", "2"],
              ["Discarded", "7 January 2026", "By Mr Samuel Adeyemi"],
              ["Reason", "3 unresolved venue clashes", "Laboratory 1 double-booked in periods 3, 4 and 6"],
              ["Staff notified", "0", "Nothing was published"],
            ],
          },
          {
            label: "First Term final — archived at term close",
            sub: "4 December, automatic at term close",
            pill: "Complete",
            viewLabel: "View",
            facts: [
              ["Timetable", "First Term final"],
              ["Archived", "4 December 2025", "Automatically at term close"],
              ["Arms covered", "41"],
              ["Kept for", "The full session", "Readable, not editable"],
            ],
          },
        ],
      },
    ]),
  ],
};

/* --------------------------------------------------------------- Coverage */

const coverageTab: TabContent = {
  title: "Coverage",
  desc: "Is this school actually ready to teach?",
  primary: { label: "Fix the top gap", drawer: assignUncoveredDrawer },
  rows: [
    row("1fr", [
      {
        type: "kpi",
        per: 4,
        cards: [
          {
            label: "Subject-arms uncovered",
            value: String(subjectArmTotals.unassigned),
            sub: "Civic Education JSS 3A and 3C · 34 days",
            tone: "negative",
            link: "Assign teachers",
            href: "/class-timetable/teaching",
          },
          {
            label: "Students with no arm",
            value: String(noArm),
            sub: "Excluded from every register and result",
            tone: "negative",
            link: "Allocate",
            drawer: allocateDrawer,
          },
          {
            label: "Load outside ceiling",
            value: "2",
            sub: "1 above 24 periods · 1 far below",
            tone: "attention",
            link: "See loads",
            href: "/class-timetable/teaching",
          },
          {
            label: "Timetables unpublished",
            value: "6 of 42",
            sub: "Per-period attendance unavailable for those arms",
            tone: "attention",
            link: "Publish",
            drawer: publishDrawer,
          },
        ],
      },
    ]),
    row("1fr", [
      {
        type: "tracker",
        title: "Coverage checks",
        meta: "8 checks · term day 34",
        clear: {
          title: "This school is ready to teach",
          body: "All eight coverage checks pass. Nothing is uncovered.",
        },
        rows: [
          { unit: "Unassigned subject-classes", sub: "Civic Education · JSS 3A, JSS 3C", owner: "Mrs Folake Adeniyi", role: "Head of Languages", state: "Unassigned", age: "34 days", overdue: true },
          { unit: "Students with no arm", sub: `${noArm} students enrolled 1–3 September`, owner: "Miss Grace Etim", role: "Registrar", state: "Not started", age: "4 days", overdue: true },
          { unit: "Invalid subject combinations", sub: "4 students named by rule broken", owner: "Mr Samuel Adeyemi", role: "Exam Officer", state: "In progress", age: "9 days" },
          { unit: "Load outside the ceiling", sub: "Mr Ibrahim Danladi at 27 of 24 periods", owner: "Adaeze Nwosu", role: "Principal · you", state: "In progress", age: "12 days" },
          { unit: "Arms over capacity", sub: "JSS 2A at 34 of 32", owner: "Adaeze Nwosu", role: "Principal · you", state: "In progress", age: "21 days" },
          { unit: "Unpublished timetables", sub: "6 arms in draft", owner: "Mr Samuel Adeyemi", role: "Exam Officer", state: "Draft", age: "6 days" },
          { unit: "Teachers with no assignment", sub: "None — every activated staff member has work", owner: "Adaeze Nwosu", role: "Principal · you", state: "Complete", age: "—" },
          { unit: "Unresolved clashes", sub: "None across 42 arms and 31 venues", owner: "Mr Samuel Adeyemi", role: "Exam Officer", state: "Complete", age: "—" },
        ],
      },
    ]),
  ],
};

export const classTimetableContent: ModuleContent = {
  classes: classesTab,
  subjects: subjectsTab,
  teaching: teachingTab,
  timetable: timetableTab,
  coverage: coverageTab,
};
