import type { ResourceField } from "@/components/forms/resource-form";

const LEVELS = [
  { label: "Not set", value: "" },
  { label: "None — hidden", value: "NONE" },
  { label: "View", value: "VIEW" },
  { label: "Edit", value: "EDIT" },
  { label: "Full", value: "FULL" }
];

/** One select per Back Office module, gathered into a single {module: level} map under `objectKey`. */
export function gridFields(modules: Array<{ label: string; value: string }>, objectKey: string, current: Record<string, unknown> | null | undefined, section: string, note?: string): ResourceField[] {
  return modules.map((module, index) => ({
    name: module.value,
    object: objectKey,
    label: module.label,
    type: "select" as const,
    defaultValue: typeof current?.[module.value] === "string" ? (current[module.value] as string) : "",
    options: LEVELS,
    section,
    note: index === 0 ? note : undefined
  }));
}
