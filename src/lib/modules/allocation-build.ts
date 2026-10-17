/**
 * The allocation builder's vocabulary, as data.
 *
 * An allocation is the list a school hands a family in week one. The mockup
 * builds one by naming it, ticking the categories it covers, and filling each
 * category with items — so the categories, and what each one means in the fee
 * schema, are authored here rather than buried in the component.
 */

export type AllocationItem = {
  /** Which category chip this line sits under. */
  cat: string;
  item: string;
  note: string;
  qty: number;
  unit: number;
  /** A required line is one every family is asked for. */
  req: boolean;
};

export type AllocationCategory = { label: string; sub: string };

/** The categories a Nigerian school's list is actually made of. */
export const ALLOCATION_CATEGORIES: AllocationCategory[] = [
  { label: "Books", sub: "Texts and workbooks" },
  { label: "Stationery", sub: "Everyday writing kit" },
  { label: "Uniform", sub: "Worn every day" },
  { label: "Boarding kit", sub: "Boarders only" },
  { label: "Digital", sub: "Devices and licences" },
  { label: "Practical and laboratory", sub: "Science and technical" },
  { label: "Sports", sub: "House and games kit" },
];

export const DEFAULT_CATEGORIES = ["Books", "Stationery", "Uniform"];

/** The tone each category carries, so a group is recognisable at a glance. */
export const CATEGORY_TONES: Record<string, "neutral" | "progress" | "positive" | "attention" | "submitted"> = {
  Books: "progress",
  Stationery: "neutral",
  Uniform: "positive",
  "Boarding kit": "attention",
  Digital: "submitted",
  "Practical and laboratory": "neutral",
  Sports: "positive",
};

/**
 * What a category is stored as.
 *
 * The fee schema holds a fixed set of component types, and a list's categories
 * are the school's own words. This is the pairing, so a category the school
 * invents still lands somewhere truthful rather than being refused.
 */
export const CATEGORY_COMPONENT: Record<string, string> = {
  Books: "BOOKS",
  Stationery: "OTHER",
  Uniform: "UNIFORM",
  "Boarding kit": "HOSTEL",
  Digital: "ICT_FEE",
  "Practical and laboratory": "OTHER",
  Sports: "OTHER",
};

export function componentFor(category: string): string {
  return CATEGORY_COMPONENT[category] ?? "OTHER";
}

export function lineTotal(item: AllocationItem): number {
  return (item.unit || 0) * (item.qty || 1);
}

export function sumLines(items: AllocationItem[]): number {
  return items.reduce((total, item) => total + lineTotal(item), 0);
}
