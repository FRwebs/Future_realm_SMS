import { z } from "zod";

/**
 * What the sign-up wizard asks for, step by step. One schema per step: the wizard validates only the step on show, and each message is
 * what appears beside the field it is about. The words that change with the country (a "state" is a "region" elsewhere) and whether the
 * chosen web address is free are passed in, because only the wizard knows them.
 */
export interface SignupValues {
  firstName: string;
  lastName: string;
  gender: string;
  phone: string;
  email: string;
  position: string;
  country: string;
  schoolName: string;
  slug: string;
  state: string;
  lga: string;
  city: string;
  address: string;
  website: string;
  schoolType: string;
  curriculum: string;
  studentCount: string;
  regNumber1: string;
  regNumber2: string;
  levels: Record<string, boolean>;
  levelsOther: string;
  teacherSchoolName: string;
  subjects: Record<string, boolean>;
  subjectsOther: string;
  password: string;
  confirmPassword: string;
}

export interface SignupStepContext {
  step: number;
  admin: boolean;
  /** "State", "Region", "County" … — the country's own word for the first division, lower-cased inside messages. */
  level1Label: string;
  level2Label: string;
  /** The web address was checked and is taken or not allowed. */
  slugUnavailable: boolean;
}

const nothingPicked = (picked: Record<string, boolean>, other: string) => !Object.values(picked).some(Boolean) && !other.trim();

/** The fields each step owns, in the order a person meets them — what the wizard asks the form to check on "Next". */
export function fieldsOfStep({ step, admin }: Pick<SignupStepContext, "step" | "admin">): Array<keyof SignupValues> {
  if (step === 1) return ["firstName", "lastName", "gender", "phone", "email", "position", ...(admin ? [] : (["country"] as const))];
  if (step === 2 && admin) return ["schoolName", "slug", "country", "state", "city", "lga", "address", "schoolType", "curriculum", "studentCount", "levels"];
  if (step === 2) return ["subjects", "levels"];
  if (step === 3) return ["password", "confirmPassword"];
  return [];
}

export function createSignupStepSchema(context: SignupStepContext) {
  const { step, admin, level1Label, level2Label, slugUnavailable } = context;
  return z.custom<SignupValues>().superRefine((values, ctx) => {
    const need = (path: keyof SignupValues, message: string) => ctx.addIssue({ code: "custom", path: [path], message });
    const blank = (value: string) => !value.trim();

    if (step === 1) {
      if (blank(values.firstName)) need("firstName", "Enter your first name.");
      if (blank(values.lastName)) need("lastName", "Enter your last name.");
      if (!values.gender) need("gender", "Select a gender.");
      if (blank(values.phone)) need("phone", "Enter a phone number.");
      if (blank(values.email)) need("email", "Enter your email address.");
      if (!values.position) need("position", admin ? "Select your position." : "Select what you teach as.");
      if (!admin && !values.country) need("country", "Select a country.");
    }
    if (step === 2 && admin) {
      if (blank(values.schoolName)) need("schoolName", "Enter your school's name.");
      if (blank(values.slug) || slugUnavailable) need("slug", "Choose an available web address for your school.");
      if (!values.country) need("country", "Select a country.");
      if (blank(values.state)) need("state", `Enter a ${level1Label.toLowerCase()}.`);
      if (blank(values.city)) need("city", "Enter a city or town.");
      if (blank(values.lga)) need("lga", `Enter a ${level2Label.toLowerCase()}.`);
      if (blank(values.address)) need("address", "Enter the full address.");
      if (!values.schoolType) need("schoolType", "Select a school type.");
      if (!values.curriculum) need("curriculum", "Select a curriculum.");
      if (blank(values.studentCount)) need("studentCount", "Enter an estimated student count.");
      if (nothingPicked(values.levels, values.levelsOther)) need("levels", "Pick at least one level operated.");
    }
    if (step === 2 && !admin) {
      if (nothingPicked(values.subjects, values.subjectsOther)) need("subjects", "Pick at least one subject you teach.");
      if (nothingPicked(values.levels, values.levelsOther)) need("levels", "Pick at least one level you teach.");
    }
    if (step === 3) {
      if (values.password.length < 8) need("password", "Password must be at least 8 characters.");
      if (values.password !== values.confirmPassword) need("confirmPassword", "Passwords do not match.");
    }
  });
}
