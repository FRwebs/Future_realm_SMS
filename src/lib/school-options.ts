import type { FilterOption } from "@/components/filters/filter-toolbar";

type SelectOption = { label: string; value: string };

export type NigeriaSchoolSection =
  | "CRECHE"
  | "NURSERY"
  | "PRIMARY"
  | "JUNIOR_SECONDARY"
  | "SENIOR_SECONDARY";

export type NigeriaClassValue =
  | "CRECHE"
  | "PRE_NURSERY"
  | "NURSERY_1"
  | "NURSERY_2"
  | "NURSERY_3"
  | "KG_RECEPTION"
  | "PRIMARY_1"
  | "PRIMARY_2"
  | "PRIMARY_3"
  | "PRIMARY_4"
  | "PRIMARY_5"
  | "PRIMARY_6"
  | "JSS_1"
  | "JSS_2"
  | "JSS_3"
  | "SSS_1"
  | "SSS_2"
  | "SSS_3";

export type NigeriaClassOption = {
  label: string;
  value: NigeriaClassValue;
  section: NigeriaSchoolSection;
  order: number;
};

export type NigeriaClassGroup = {
  label: string;
  section: NigeriaSchoolSection;
  options: NigeriaClassOption[];
};

const sectionLabels: Record<NigeriaSchoolSection, string> = {
  CRECHE: "Creche",
  NURSERY: "Nursery",
  PRIMARY: "Primary",
  JUNIOR_SECONDARY: "Junior Secondary",
  SENIOR_SECONDARY: "Senior Secondary"
};

export const nigeriaClassOptions = [
  { label: "Crèche", value: "CRECHE", section: "CRECHE", order: 1 },
  { label: "Pre-Nursery", value: "PRE_NURSERY", section: "NURSERY", order: 2 },
  { label: "Nursery 1", value: "NURSERY_1", section: "NURSERY", order: 3 },
  { label: "Nursery 2", value: "NURSERY_2", section: "NURSERY", order: 4 },
  { label: "KG / Reception", value: "KG_RECEPTION", section: "NURSERY", order: 5 },
  { label: "Nursery 3", value: "NURSERY_3", section: "NURSERY", order: 6 },
  { label: "Primary 1", value: "PRIMARY_1", section: "PRIMARY", order: 7 },
  { label: "Primary 2", value: "PRIMARY_2", section: "PRIMARY", order: 8 },
  { label: "Primary 3", value: "PRIMARY_3", section: "PRIMARY", order: 9 },
  { label: "Primary 4", value: "PRIMARY_4", section: "PRIMARY", order: 10 },
  { label: "Primary 5", value: "PRIMARY_5", section: "PRIMARY", order: 11 },
  { label: "Primary 6", value: "PRIMARY_6", section: "PRIMARY", order: 12 },
  { label: "JSS 1", value: "JSS_1", section: "JUNIOR_SECONDARY", order: 13 },
  { label: "JSS 2", value: "JSS_2", section: "JUNIOR_SECONDARY", order: 14 },
  { label: "JSS 3", value: "JSS_3", section: "JUNIOR_SECONDARY", order: 15 },
  { label: "SSS 1", value: "SSS_1", section: "SENIOR_SECONDARY", order: 16 },
  { label: "SSS 2", value: "SSS_2", section: "SENIOR_SECONDARY", order: 17 },
  { label: "SSS 3", value: "SSS_3", section: "SENIOR_SECONDARY", order: 18 }
] as const satisfies readonly NigeriaClassOption[];

export const nigeriaClassLookup = Object.fromEntries(
  nigeriaClassOptions.map((option) => [option.value, option])
) as Record<NigeriaClassValue, NigeriaClassOption>;

export const nigeriaClassGroups = (Object.keys(sectionLabels) as NigeriaSchoolSection[]).map((section) => ({
  label: sectionLabels[section],
  section,
  options: nigeriaClassOptions.filter((option) => option.section === section)
})) satisfies NigeriaClassGroup[];

export const basicEducationClassOptions = nigeriaClassOptions.filter((option) =>
  ["CRECHE", "NURSERY", "PRIMARY", "JUNIOR_SECONDARY"].includes(option.section)
);

export const secondaryClassOptions = nigeriaClassOptions.filter((option) =>
  ["JUNIOR_SECONDARY", "SENIOR_SECONDARY"].includes(option.section)
);

const aliases = new Map<string, NigeriaClassValue>();

function aliasKey(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[_./-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function registerAlias(value: NigeriaClassValue, ...inputs: string[]) {
  inputs.forEach((input) => aliases.set(aliasKey(input), value));
}

nigeriaClassOptions.forEach((option) => {
  registerAlias(option.value, option.value, option.label, option.label.replace(/\s+/g, ""));
});

registerAlias("CRECHE", "Creche", "Crèche", "Creche / Nursery", "Creche Nursery");
registerAlias("PRE_NURSERY", "Pre Nursery", "Prenursery", "Pre-nursery");
registerAlias("KG_RECEPTION", "KG", "Reception", "KG Reception", "KG / Reception", "Kindergarten");
registerAlias("JSS_1", "JSS1", "Junior Secondary 1", "Junior Secondary School 1");
registerAlias("JSS_2", "JSS2", "Junior Secondary 2", "Junior Secondary School 2");
registerAlias("JSS_3", "JSS3", "Junior Secondary 3", "Junior Secondary School 3");
registerAlias("SSS_1", "SS 1", "SS1", "SS_1", "SSS1", "Senior Secondary 1", "Senior Secondary School 1");
registerAlias("SSS_2", "SS 2", "SS2", "SS_2", "SSS2", "Senior Secondary 2", "Senior Secondary School 2");
registerAlias("SSS_3", "SS 3", "SS3", "SS_3", "SSS3", "Senior Secondary 3", "Senior Secondary School 3");

function splitClassAndArm(input: string) {
  const [base = "", ...rest] = input.split(/\s+-\s+/);
  return {
    base: base.trim(),
    arm: rest.join(" - ").trim()
  };
}

export function normalizeNigeriaClassValue(input?: string | null): NigeriaClassValue | undefined {
  if (!input) return undefined;
  const key = aliasKey(splitClassAndArm(input).base);
  const direct = aliases.get(key);
  if (direct) return direct;

  const matchingAlias = [...aliases.entries()]
    .sort((a, b) => b[0].length - a[0].length)
    .find(([alias]) => key === alias || key.startsWith(`${alias} `));

  return matchingAlias?.[1];
}

export function getNigeriaClassOptions() {
  return [...nigeriaClassOptions];
}

export function getNigeriaClassGroups() {
  return nigeriaClassGroups.map((group) => ({
    ...group,
    options: [...group.options]
  }));
}

export function getNigeriaClassLabel(value?: string | null) {
  const canonical = normalizeNigeriaClassValue(value);
  return canonical ? nigeriaClassLookup[canonical].label : (value ?? "Unassigned");
}

export function getNigeriaSchoolSection(value?: string | null): NigeriaSchoolSection | undefined {
  const canonical = normalizeNigeriaClassValue(value);
  return canonical ? nigeriaClassLookup[canonical].section : undefined;
}

export function isNurseryClass(value?: string | null) {
  return getNigeriaSchoolSection(value) === "NURSERY";
}

export function isPrimaryClass(value?: string | null) {
  return getNigeriaSchoolSection(value) === "PRIMARY";
}

export function isJuniorSecondaryClass(value?: string | null) {
  return getNigeriaSchoolSection(value) === "JUNIOR_SECONDARY";
}

export function isSeniorSecondaryClass(value?: string | null) {
  return getNigeriaSchoolSection(value) === "SENIOR_SECONDARY";
}

export function isBasicEducationClass(value?: string | null) {
  const section = getNigeriaSchoolSection(value);
  return Boolean(section && ["CRECHE", "NURSERY", "PRIMARY", "JUNIOR_SECONDARY"].includes(section));
}

export function compareNigeriaClassOrder(a?: string | null, b?: string | null) {
  const aClass = normalizeNigeriaClassValue(a);
  const bClass = normalizeNigeriaClassValue(b);
  const aOrder = aClass ? nigeriaClassLookup[aClass].order : Number.POSITIVE_INFINITY;
  const bOrder = bClass ? nigeriaClassLookup[bClass].order : Number.POSITIVE_INFINITY;

  if (aOrder !== bOrder) return aOrder - bOrder;
  return (a ?? "").localeCompare(b ?? "", "en-NG", { sensitivity: "base" });
}

export function sortNigeriaClasses<T extends string>(values: readonly T[]) {
  return [...values].sort(compareNigeriaClassOrder);
}

export function getNigeriaClassLookupNames(value?: string | null) {
  const canonical = normalizeNigeriaClassValue(value);
  if (!canonical) return [];

  const label = nigeriaClassLookup[canonical].label;
  return Array.from(new Set([label, label.replace(/^SSS /, "SS ")]));
}

export function formatNigeriaClassName(value?: string | null) {
  if (!value) return "Unassigned";
  const { arm } = splitClassAndArm(value);
  const label = getNigeriaClassLabel(value);
  return arm ? `${label} - ${arm}` : label;
}

export const nigerianClassOptions: FilterOption[] = [
  { label: "All classes", value: "" },
  ...nigeriaClassOptions.map((option) => ({ label: option.label, value: option.value }))
];

export const nigerianClassFieldOptions: SelectOption[] = nigeriaClassOptions.map((option) => ({
  label: option.label,
  value: option.value
}));

export const termOptions: FilterOption[] = [
  { label: "All terms", value: "" },
  { label: "First Term", value: "First Term" },
  { label: "Second Term", value: "Second Term" },
  { label: "Third Term", value: "Third Term" }
];

export const attendanceStatusOptions: SelectOption[] = [
  { label: "Present", value: "PRESENT" },
  { label: "Late", value: "LATE" },
  { label: "Absent", value: "ABSENT" },
  { label: "Excused", value: "EXCUSED" }
];

export const staffAttendanceStatusOptions: SelectOption[] = [
  ...attendanceStatusOptions,
  { label: "On leave", value: "ON_LEAVE" },
  { label: "Official duty", value: "OFFICIAL_DUTY" }
];

export const admissionStatusFilterOptions: FilterOption[] = [
  { label: "All stages", value: "" },
  { label: "Submitted", value: "SUBMITTED" },
  { label: "Reviewing", value: "REVIEWING" },
  { label: "Payment pending", value: "PAYMENT_PENDING" },
  { label: "Screening scheduled", value: "SCREENING_SCHEDULED" },
  { label: "Recommended", value: "RECOMMENDED" },
  { label: "Approved", value: "APPROVED" },
  { label: "Offer sent", value: "OFFER_SENT" },
  { label: "Financially cleared", value: "FINANCIALLY_CLEARED" },
  { label: "Enrolled", value: "ENROLLED" }
];

export const trainingCategoryOptions: SelectOption[] = [
  { label: "Pedagogy", value: "PEDAGOGY" },
  { label: "Classroom management", value: "CLASSROOM_MANAGEMENT" },
  { label: "Subject mastery", value: "SUBJECT_MASTERY" },
  { label: "Child protection", value: "CHILD_PROTECTION" },
  { label: "Assessment / grading", value: "ASSESSMENT_GRADING" },
  { label: "ICT / digital literacy", value: "ICT_DIGITAL_LITERACY" },
  { label: "Curriculum orientation", value: "CURRICULUM_ORIENTATION" },
  { label: "Compliance / professional development", value: "COMPLIANCE_PROFESSIONAL_DEVELOPMENT" }
];

export const feeGatewayOptions: SelectOption[] = [
  { label: "Paystack", value: "PAYSTACK" },
  { label: "Flutterwave", value: "FLUTTERWAVE" }
];
