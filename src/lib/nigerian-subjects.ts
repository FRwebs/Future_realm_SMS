import type { NigeriaClassValue, NigeriaSchoolSection } from "@/lib/school-options";

export type NigerianSubjectDefault = {
  name: string;
  code: string;
  section: NigeriaSchoolSection;
  applicableClassLevels: NigeriaClassValue[];
  isCore: boolean;
  isOptional?: boolean;
  religionSpecific?: boolean;
  trackSpecific?: "SCIENCE" | "HUMANITIES" | "BUSINESS";
  tradeSubject?: boolean;
};

const primaryOneToThree: NigeriaClassValue[] = ["PRIMARY_1", "PRIMARY_2", "PRIMARY_3"];
const primaryFourToSix: NigeriaClassValue[] = ["PRIMARY_4", "PRIMARY_5", "PRIMARY_6"];
const juniorSecondary: NigeriaClassValue[] = ["JSS_1", "JSS_2", "JSS_3"];
const seniorSecondary: NigeriaClassValue[] = ["SSS_1", "SSS_2", "SSS_3"];

export const nigerianTradeSubjectDefaults: NigerianSubjectDefault[] = [
  "Solar Photovoltaic Installation and Maintenance",
  "Fashion Design and Garment Making",
  "Livestock Farming",
  "Beauty and Cosmetology",
  "Computer Hardware and GSM Repairs",
  "Horticulture and Crop Production"
].map((name, index) => ({
  name,
  code: `TRD${index + 1}`,
  section: "SENIOR_SECONDARY",
  applicableClassLevels: [...seniorSecondary],
  isCore: false,
  isOptional: true,
  tradeSubject: true
}));

export const nigerianSubjectDefaults: NigerianSubjectDefault[] = [
  ...[
    "Language Development",
    "Number Work",
    "Social Habits",
    "Health Habits",
    "Creative Play",
    "Rhymes and Poems"
  ].map((name, index) => ({
    name,
    code: `CR${index + 1}`,
    section: "CRECHE" as const,
    applicableClassLevels: ["CRECHE"] as NigeriaClassValue[],
    isCore: true
  })),
  ...[
    "English Skill",
    "Writing Skill",
    "Mathematics Skill",
    "Science",
    "Social Habits",
    "Health Habits",
    "Cultural and Creative Arts",
    "Rhymes and Poems"
  ].map((name, index) => ({
    name,
    code: `NUR${index + 1}`,
    section: "NURSERY" as const,
    applicableClassLevels: ["PRE_NURSERY", "NURSERY_1", "NURSERY_2", "KG_RECEPTION", "NURSERY_3"] as NigeriaClassValue[],
    isCore: true
  })),
  ...[
    "English Studies",
    "Mathematics",
    "Nigerian Language",
    "Basic Science",
    "Physical and Health Education",
    "Christian Religious Studies / Islamic Studies",
    "Nigerian History",
    "Social and Citizenship Studies",
    "Cultural and Creative Arts"
  ].map((name, index) => ({
    name,
    code: `LP${index + 1}`,
    section: "PRIMARY" as const,
    applicableClassLevels: [...primaryOneToThree],
    isCore: true,
    religionSpecific: name.includes("Religious")
  })),
  { name: "Arabic", code: "LPAR", section: "PRIMARY", applicableClassLevels: [...primaryOneToThree], isCore: false, isOptional: true },
  ...[
    "English Studies",
    "Mathematics",
    "Nigerian Language",
    "Basic Science and Technology",
    "Physical and Health Education",
    "Basic Digital Literacy",
    "Christian Religious Studies / Islamic Studies",
    "Nigerian History",
    "Social and Citizenship Studies",
    "Cultural and Creative Arts",
    "Pre-vocational Studies"
  ].map((name, index) => ({
    name,
    code: `UP${index + 1}`,
    section: "PRIMARY" as const,
    applicableClassLevels: [...primaryFourToSix],
    isCore: true,
    religionSpecific: name.includes("Religious")
  })),
  { name: "French", code: "UPFR", section: "PRIMARY", applicableClassLevels: [...primaryFourToSix], isCore: false, isOptional: true },
  { name: "Arabic", code: "UPAR", section: "PRIMARY", applicableClassLevels: [...primaryFourToSix], isCore: false, isOptional: true },
  ...[
    "English Studies",
    "Mathematics",
    "Nigerian Language",
    "Intermediate Science",
    "Physical and Health Education",
    "Digital Technologies",
    "Christian Religious Studies / Islamic Studies",
    "Nigerian History",
    "Social and Citizenship Studies",
    "Cultural and Creative Arts",
    "Business Studies",
    "One Trade Subject"
  ].map((name, index) => ({
    name,
    code: `JSS${index + 1}`,
    section: "JUNIOR_SECONDARY" as const,
    applicableClassLevels: [...juniorSecondary],
    isCore: true,
    religionSpecific: name.includes("Religious"),
    tradeSubject: name.includes("Trade")
  })),
  { name: "French", code: "JSSFR", section: "JUNIOR_SECONDARY", applicableClassLevels: [...juniorSecondary], isCore: false, isOptional: true },
  { name: "Arabic", code: "JSSAR", section: "JUNIOR_SECONDARY", applicableClassLevels: [...juniorSecondary], isCore: false, isOptional: true },
  ...[
    "English Language",
    "General Mathematics",
    "Citizenship and Heritage Studies",
    "Digital Technologies",
    "One Trade Subject"
  ].map((name, index) => ({
    name,
    code: `SSCORE${index + 1}`,
    section: "SENIOR_SECONDARY" as const,
    applicableClassLevels: [...seniorSecondary],
    isCore: true,
    tradeSubject: name.includes("Trade")
  })),
  ...["Biology", "Chemistry", "Physics", "Agriculture", "Further Mathematics", "Physical Education", "Health Education", "Foods and Nutrition", "Geography", "Technical Drawing"].map((name, index) => ({
    name,
    code: `SSSCI${index + 1}`,
    section: "SENIOR_SECONDARY" as const,
    applicableClassLevels: [...seniorSecondary],
    isCore: false,
    isOptional: true,
    trackSpecific: "SCIENCE" as const
  })),
  ...["Nigerian History", "Government", "Christian Religious Studies", "Islamic Studies", "One Nigerian Language", "French", "Arabic", "Visual Arts", "Music", "Literature in English", "Home Management", "Catering Craft"].map((name, index) => ({
    name,
    code: `SSHUM${index + 1}`,
    section: "SENIOR_SECONDARY" as const,
    applicableClassLevels: [...seniorSecondary],
    isCore: false,
    isOptional: true,
    religionSpecific: name.includes("Religious") || name === "Islamic Studies",
    trackSpecific: "HUMANITIES" as const
  })),
  ...["Accounting", "Commerce", "Marketing", "Economics"].map((name, index) => ({
    name,
    code: `SSBUS${index + 1}`,
    section: "SENIOR_SECONDARY" as const,
    applicableClassLevels: [...seniorSecondary],
    isCore: false,
    isOptional: true,
    trackSpecific: "BUSINESS" as const
  })),
  ...nigerianTradeSubjectDefaults
];

export function getNigerianSubjectDefaults(section?: NigeriaSchoolSection) {
  return nigerianSubjectDefaults.filter((subject) => !section || subject.section === section);
}

export function getNigerianSubjectsForClass(classValue: NigeriaClassValue) {
  return nigerianSubjectDefaults.filter((subject) => subject.applicableClassLevels.includes(classValue));
}
