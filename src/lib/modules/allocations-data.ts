/**
 * Allocations — what a class needs for a term.
 *
 * Every school hands families a list in week one. Here it is a record: named,
 * tied to a class and a term, priced, and printable with the prices or without
 * them. One catalogue drives every list, keyed off the stage, so a Nursery list
 * is a Nursery list and an SSS list carries the calculator the examination
 * board insists on.
 */

export type AllocationStage = "Nursery" | "Primary" | "JSS" | "SSS";

export type AllocationCategory =
  | "Books"
  | "Stationery"
  | "Uniform"
  | "Boarding kit"
  | "Digital";

export type AllocationItem = {
  cat: AllocationCategory;
  item: string;
  note: string;
  /** Where a family may buy it. "School store only" is the one that removes the choice. */
  source: string;
  unit: number;
  qty: number;
  /** Required items are what every child must have; the rest a family may skip. */
  req: boolean;
};

export type AllocationListState = "Published" | "Draft" | "Archived";

export type AllocationList = {
  name: string;
  className: string;
  term: string;
  state: AllocationListState;
  owner: string;
};

export const allocationLists: AllocationList[] = [
  { name: "Nursery 2 · starter pack", className: "Nursery 2", term: "Second Term 2026/2027", state: "Published", owner: "Mrs Ngozi Eze" },
  { name: "Primary 5 · term list", className: "Primary 5", term: "Second Term 2026/2027", state: "Published", owner: "Mrs Folake Adeniyi" },
  { name: "JSS 1 · term list", className: "JSS 1", term: "Second Term 2026/2027", state: "Published", owner: "Mr Tunde Bakare" },
  { name: "JSS 2 · term list", className: "JSS 2", term: "Second Term 2026/2027", state: "Published", owner: "Mr Ibrahim Danladi" },
  { name: "JSS 3 · term list", className: "JSS 3", term: "Second Term 2026/2027", state: "Published", owner: "Mrs Chinelo Obi" },
  { name: "SSS 1 · term list", className: "SSS 1", term: "Second Term 2026/2027", state: "Published", owner: "Mr Samuel Adeyemi" },
  { name: "SSS 2 · term list", className: "SSS 2", term: "Second Term 2026/2027", state: "Draft", owner: "Mr Samuel Adeyemi" },
  { name: "SSS 3 · final year list", className: "SSS 3", term: "Second Term 2026/2027", state: "Draft", owner: "Mrs Adaeze Nwosu" },
  { name: "JSS 1 · term list", className: "JSS 1", term: "First Term 2026/2027", state: "Archived", owner: "Mr Tunde Bakare" },
  { name: "SSS 1 · term list", className: "SSS 1", term: "First Term 2026/2027", state: "Archived", owner: "Mr Samuel Adeyemi" },
  { name: "Primary 5 · term list", className: "Primary 5", term: "First Term 2026/2027", state: "Archived", owner: "Mrs Folake Adeniyi" },
  { name: "Nursery 2 · starter pack", className: "Nursery 2", term: "First Term 2026/2027", state: "Archived", owner: "Mrs Ngozi Eze" },
  { name: "JSS 2 · term list", className: "JSS 2", term: "First Term 2026/2027", state: "Archived", owner: "Mr Ibrahim Danladi" },
  { name: "SSS 3 · final year list", className: "SSS 3", term: "First Term 2026/2027", state: "Archived", owner: "Mrs Adaeze Nwosu" },
];

const booksByStage: Record<AllocationStage, string[]> = {
  Nursery: ["Letterland workbook", "Number fun", "Rhymes and songs", "My first colouring book"],
  Primary: [
    "English studies", "Mathematics", "Basic science and technology", "National values",
    "Cultural and creative arts", "Computer studies", "French",
  ],
  JSS: [
    "English language", "Mathematics", "Basic science", "Social studies", "Civic education",
    "Business studies", "Agricultural science", "Computer studies", "French", "Home economics",
  ],
  SSS: [
    "English language", "Mathematics", "Biology", "Chemistry", "Physics", "Economics",
    "Geography", "Literature in English", "Civic education",
  ],
};

const publishers = [
  "Learn Africa", "University Press", "Spectrum Books", "Longman", "Evans Brothers",
  "Macmillan", "Cambridge", "Oxford", "Pearson",
];

export function allocationStage(className: string): AllocationStage {
  if (/^Nursery|^KG|^Kinder/i.test(className)) return "Nursery";
  if (/^Primary|^Grade [1-6]|^Year [1-6]/i.test(className)) return "Primary";
  if (/^JSS|^Grade [7-9]|^Year [7-9]/i.test(className)) return "JSS";
  return "SSS";
}

/** A stable price from the item's own name, so nothing moves between renders. */
function priceOf(key: string, base: number, spread: number): number {
  let seed = 0;
  for (let index = 0; index < key.length; index++) {
    seed = (seed * 31 + key.charCodeAt(index)) % 9973;
  }
  return base + (seed % spread) * 50;
}

function item(
  cat: AllocationCategory,
  label: string,
  note: string,
  source: string,
  unit: number,
  qty: number,
  req = true,
): AllocationItem {
  return { cat, item: label, note, source, unit, qty, req };
}

/** The catalogue for one class, driven by its stage. */
export function allocationItems(className: string): AllocationItem[] {
  const stage = allocationStage(className);
  const senior = stage === "JSS" || stage === "SSS";

  const books = booksByStage[stage].map((book, index) =>
    item(
      "Books",
      `${book} · ${className}`,
      `Recommended text · ${publishers[index % publishers.length]}`,
      "School bookshop, or any bookseller",
      priceOf(book + className, 2400, 40),
      1,
    ),
  );

  const stationery: AllocationItem[] = [
    item("Stationery", "Exercise books · 80 leaves", "Two per subject, covered and labelled", "Any stationer", 320, Math.max(6, books.length * 2)),
    item("Stationery", "Hard-cover notebook · A4", "For notes the child keeps all year", "Any stationer", 950, 2),
    item("Stationery", "Pens, pencils and eraser", "Blue and red pen · HB pencils", "Any stationer", 900, 1),
    item("Stationery", "Ruler · 30 cm", "Transparent, marked in centimetres", "Any stationer", 350, 1),
    ...(senior
      ? [
          item("Stationery", "Mathematical set", "Compass, protractor and set squares", "Any stationer", 1800, 1),
          item("Stationery", "Scientific calculator", "Non-programmable only — examination rule", "Any stationer", 6500, 1),
          item("Stationery", "Graph book", "For Mathematics and the sciences", "Any stationer", 700, 1),
        ]
      : [
          item("Stationery", "Colour pencils and drawing book", "For creative arts", "Any stationer", 2200, 1),
          item("Stationery", "Pencil case", "Named", "Any stationer", 750, 1),
        ]),
  ];

  const uniform: AllocationItem[] = [
    item("Uniform", "Daily uniform · 2 sets", "Named and numbered by the school store", "School store only", priceOf(`uniform${className}`, 12000, 30), 2),
    item("Uniform", "Sports wear · 1 set", "In the child's house colour", "School store only", 7800, 1),
    item("Uniform", "School shoes · black", "Plain black · trainers are not accepted", "Any shoe shop", 12000, 1),
    item("Uniform", "White socks · 3 pairs", "Ankle length", "Any shop", 1800, 3),
    item("Uniform", "School cardigan", "For the harmattan weeks", "School store only", 9200, 1, false),
    item("Uniform", "Name tag", "Printed by the school · one per child", "School store only", 800, 1),
    ...(senior
      ? [item("Uniform", "House tie", "Issued in the house colour", "School store only", 2400, 1)]
      : []),
  ];

  const kit: AllocationItem[] = [
    item("Boarding kit", "Mattress · 4 inch", "Boarders only · day students skip this", "School store only", 28000, 1, false),
    item("Boarding kit", "Bed sheets · 2 sets", "White only", "Any shop", 9000, 2, false),
    item("Boarding kit", "Bucket and toiletry set", "Boarders only", "Any shop", 6500, 1, false),
    item("Digital", "School tablet", "Loaded with the e-library. A family may use their own device instead.", "School store · instalments available", 96000, 1, false),
  ];

  return [...books, ...stationery, ...uniform, ...kit];
}

export type AllocationTotals = {
  className: string;
  term: string;
  items: AllocationItem[];
  required: number;
  optional: number;
  total: number;
  cats: AllocationCategory[];
};

const categoryOrder: AllocationCategory[] = [
  "Books", "Stationery", "Uniform", "Boarding kit", "Digital",
];

export function allocationOf(className: string, term: string): AllocationTotals {
  const items = allocationItems(className);
  const sum = (list: AllocationItem[]) =>
    list.reduce((total, entry) => total + entry.unit * entry.qty, 0);

  return {
    className,
    term,
    items,
    required: sum(items.filter((entry) => entry.req)),
    optional: sum(items.filter((entry) => !entry.req)),
    total: sum(items),
    cats: categoryOrder.filter((cat) => items.some((entry) => entry.cat === cat)),
  };
}

/** The tone the mockup gives each allocation category. */
export const categoryTone: Record<AllocationCategory, string> = {
  Books: "progress",
  Stationery: "neutral",
  Uniform: "positive",
  "Boarding kit": "attention",
  Digital: "submitted",
};
