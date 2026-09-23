import { armRows, armResultOf } from "@/lib/modules/school-data";

/**
 * The student registry.
 *
 * The registry is the same list the class rosters are cut from, so a child
 * opened here and a child opened from their arm land on one record with one set
 * of figures. Names are generated from the mockup's own pools with its stable
 * per-arm seed, so nothing shuffles between renders.
 */

const firstNames = [
  "Fatima", "Zainab", "Aisha", "Ngozi", "Chioma", "David", "Blessing", "Emeka", "Ibrahim",
  "Tunde", "Samuel", "Halima", "Chidi", "Bola", "Musa", "Ify", "Amaka", "Segun", "Hauwa",
  "Kelechi", "Yemi", "Nkechi", "Bashir", "Uche", "Grace", "Idris", "Folake", "Obinna", "Zara",
  "Peter", "Amina", "Chuka", "Ruth", "Sani", "Ada", "Kunle", "Rita", "Danjuma", "Ejiro", "Lami",
  "Tobi", "Maryam", "Eze", "Simi", "Bello", "Nneka",
];

const lastNames = [
  "Bello", "Yusuf", "Mohammed", "Chukwu", "Adebayo", "Eze", "Ade", "Okafor", "Sule", "Ogunlesi",
  "Bature", "Sani", "Okeke", "Adewale", "Idris", "Anyanwu", "Nwosu", "Balogun", "Garba", "Obi",
  "Lawal", "Uche", "Danladi", "Etim", "Aliyu",
];

const femaleFirst = new Set([
  "Fatima", "Zainab", "Aisha", "Ngozi", "Chioma", "Blessing", "Halima", "Bola", "Ify", "Amaka",
  "Hauwa", "Nkechi", "Grace", "Folake", "Zara", "Amina", "Ruth", "Ada", "Rita", "Lami", "Maryam",
  "Simi", "Nneka",
]);

/** A stable pseudo-random from a string, so nothing shuffles between renders. */
function seedOf(key: string): number {
  let seed = 0;
  for (let index = 0; index < key.length; index++) {
    seed = (seed * 31 + key.charCodeAt(index)) % 100000;
  }
  return seed;
}

export type FeeState = "Paid" | "Part paid" | "Outstanding";
export type PortalState = "Active" | "Invited" | "Not activated";

export type RegistryStudent = {
  name: string;
  admission: string;
  arm: string;
  className: string;
  gender: "Female" | "Male";
  /** Attendance this term. */
  attendance: number;
  fee: FeeState;
  portal: PortalState;
  /** Missing photograph, date of birth or the like. */
  incomplete: boolean;
};

/** The three children the mockup has sitting in no class arm at all. */
const unallocated: Array<[string, string]> = [
  ["Ibrahim Sule", "GIA/23/0430"],
  ["Blessing Ade", "GIA/23/0418"],
  ["Chioma Nwankwo", "GIA/2026/0421"],
];

export const registryStudents: RegistryStudent[] = (() => {
  const students: RegistryStudent[] = [];

  for (const row of armRows) {
    const seed = seedOf(row.arm);
    const year = /SSS/.test(row.arm) ? "23" : /JSS/.test(row.arm) ? "24" : "25";

    for (let index = 0; index < row.roll; index++) {
      const first = firstNames[(index * 7 + seed) % firstNames.length]!;
      const last = lastNames[(index * 5 + seed) % lastNames.length]!;
      const personal = seedOf(`${first}${last}${row.arm}${index}`);

      students.push({
        name: `${first} ${last}`,
        admission: `GIA/${year}/${String(400 + index * 3).padStart(4, "0")}`,
        arm: row.arm,
        className: row.className,
        // A child's gender is read from their given name, never guessed.
        gender: femaleFirst.has(first) ? "Female" : "Male",
        attendance: 74 + (personal % 26),
        fee: (["Paid", "Paid", "Part paid", "Paid", "Outstanding", "Paid"] as FeeState[])[
          personal % 6
        ]!,
        portal: (["Active", "Active", "Active", "Invited", "Not activated"] as PortalState[])[
          personal % 5
        ]!,
        incomplete: personal % 23 === 0,
      });
    }
  }

  for (const [name, admission] of unallocated) {
    const personal = seedOf(name);
    students.push({
      name,
      admission,
      arm: "No arm",
      className: "Unallocated",
      gender: femaleFirst.has(name.split(" ")[0]!) ? "Female" : "Male",
      attendance: 70 + (personal % 20),
      fee: "Outstanding",
      portal: "Not activated",
      incomplete: true,
    });
  }

  return students;
})();

export function registrySummary() {
  const allocated = registryStudents.filter((student) => student.arm !== "No arm");
  const noArm = registryStudents.filter((student) => student.arm === "No arm");

  return {
    total: registryStudents.length,
    enrolled: allocated.length,
    noArm: noArm.length,
    owing: registryStudents.filter((student) => student.fee !== "Paid").length,
    noPortal: registryStudents.filter((student) => student.portal !== "Active").length,
    incomplete: registryStudents.filter((student) => student.incomplete).length,
    arms: armRows.length,
  };
}

/** One arm's roster, cut from the same registry. */
export function rosterFor(arm: string): RegistryStudent[] {
  return registryStudents.filter((student) => student.arm === arm);
}

/** The term average for a student's arm — a child is ranked within their arm. */
export function armAverageFor(arm: string): number {
  return arm === "No arm" ? 0 : armResultOf(arm).average;
}

const guardianFemale = [
  "Fatima", "Zainab", "Aisha", "Ngozi", "Chioma", "Blessing", "Halima", "Bola", "Ify", "Amaka",
  "Hauwa", "Nkechi", "Grace", "Folake", "Zara", "Amina", "Ruth", "Ada", "Rita", "Lami", "Maryam",
  "Simi", "Nneka", "Ifeoma", "Chinelo", "Adaora",
];

const guardianMale = [
  "David", "Emeka", "Ibrahim", "Tunde", "Samuel", "Chidi", "Musa", "Segun", "Kelechi", "Bashir",
  "Uche", "Idris", "Obinna", "Peter", "Chuka", "Sani", "Kunle", "Danjuma", "Ejiro", "Tobi", "Eze",
  "Bello", "Sule", "Tayo", "Yusuf",
];

const occupations = [
  "Civil engineer", "Trader", "Physician", "Teacher", "Banker", "Contractor", "Accountant",
  "Nurse", "Civil servant", "Entrepreneur", "Lecturer", "Pharmacist", "Architect", "Lawyer",
];

/**
 * The guardian a child is registered under.
 *
 * A guardian's title and given name have to agree — "Mr Zainab" is the kind of
 * detail that makes a school stop trusting the whole list. The admission tail is
 * mixed into the given name so households stay high-cardinality; otherwise
 * unrelated children collapse into one implausible family.
 */
function guardianNameFor(student: RegistryStudent): { name: string; relation: string } {
  const seed = seedOf(`${student.name}${student.admission}guardian`);
  const female = seed % 2 === 0;
  const pool = female ? guardianFemale : guardianMale;
  const admissionTail = Number(student.admission.replace(/\D/g, "").slice(-3)) || seed;
  const given = pool[(seed * 3 + admissionTail) % pool.length]!;
  const initial = String.fromCharCode(65 + (admissionTail % 26));
  const surname = student.name.split(" ")[1] ?? "Bello";

  return {
    name: `${female ? "Mrs" : "Mr"} ${given} ${initial}. ${surname}`,
    relation: female ? "Mother" : "Father",
  };
}

export type Family = {
  name: string;
  relation: string;
  phone: string;
  email: string;
  occupation: string;
  portal: PortalState;
  children: RegistryStudent[];
  /** Children whose fees are not settled. */
  owing: number;
  hasSecondContact: boolean;
};

/**
 * Households, grouped from the registry.
 *
 * A real family is rarely more than four children in one school, and never has
 * two children with the same given name — but a child who does not fit is
 * re-homed into another household, never dropped. Dropping one leaves a real
 * debtor billed in the headline, absent from the debtor list, and impossible to
 * chase.
 */
export function families(): Family[] {
  const grouped = new Map<string, { relation: string; children: RegistryStudent[] }>();

  for (const student of registryStudents) {
    if (student.arm === "No arm") continue;
    const { name, relation } = guardianNameFor(student);
    const entry = grouped.get(name) ?? { relation, children: [] };
    entry.children.push(student);
    grouped.set(name, entry);
  }

  const households = new Map<string, { relation: string; children: RegistryStudent[] }>();

  for (const [name, entry] of grouped) {
    const kept: RegistryStudent[] = [];
    const spill: RegistryStudent[] = [];
    const seenGiven = new Set<string>();

    for (const child of entry.children) {
      const given = child.name.split(" ")[0]!;
      if (kept.length < 4 && !seenGiven.has(given)) {
        seenGiven.add(given);
        kept.push(child);
      } else {
        spill.push(child);
      }
    }

    households.set(name, { relation: entry.relation, children: kept });

    // Each overflow child becomes its own household, keyed off their admission
    // number so the name stays stable across renders.
    for (const child of spill) {
      const tail = child.admission.replace(/\D/g, "").slice(-4);
      const alternate = name.replace(
        / [A-Z]\. /,
        ` ${String.fromCharCode(65 + (Number(tail) % 26))}. `,
      );
      const key = alternate === name ? `${name} (${tail})` : alternate;
      const existing = households.get(key) ?? { relation: entry.relation, children: [] };
      existing.children.push(child);
      households.set(key, existing);
    }
  }

  return [...households.entries()]
    .filter(([, entry]) => entry.children.length > 0)
    .map(([name, entry]) => {
      const seed = seedOf(`${name}family`);
      const surname = name.split(" ").at(-1)!;
      const tail = String(1000 + (seed % 9000));

      return {
        name,
        relation: entry.relation,
        phone: `+234 80${seed % 9} ${tail.slice(0, 3)} ${tail}`,
        email: `${surname.toLowerCase()}.family@example.ng`,
        occupation: occupations[seed % occupations.length]!,
        portal: entry.children.some((child) => child.portal === "Active")
          ? "Active"
          : entry.children[0]!.portal,
        children: entry.children,
        owing: entry.children.filter((child) => child.fee !== "Paid").length,
        hasSecondContact: seed % 5 !== 0,
      } satisfies Family;
    });
}
