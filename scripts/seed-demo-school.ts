/*
 * Stand up one complete school, with a form master, a parent and a student under it.
 *
 * This exists to give the product a school whose data is whole — a class that really has a form
 * master, a child really in that class, and a parent really attached to that child — so the three
 * portals can be opened side by side without the gaps a hand-made record leaves behind.
 *
 * It is additive and nothing else. It creates; it never deletes, truncates or resets. That matters
 * because `prisma/seed.ts` — the ordinary seed — empties the database before it writes, and must
 * never be pointed at a live one. This script can be, and it stops before writing if the school or
 * any of the four accounts already exists.
 *
 * It works through the product's own API rather than writing rows directly, so the school is built
 * by the same code that builds a real one: the session and its terms, the grading scheme, the
 * subjects, the class levels and their arms, the trial. Only the last step touches the database —
 * giving the three invited accounts a password, which the product otherwise leaves to an email
 * nobody will receive here.
 *
 *   npx tsx scripts/seed-demo-school.ts            # against whatever BASE points at
 *
 * Every value is read from the environment, because an email address typed into a live database is
 * not something to guess:
 *
 *   BASE            the app to build it through      (default http://localhost:3000)
 *   SCHOOL_NAME     the school                       (required)
 *   SCHOOL_SLUG     its web address                  (default: from the name)
 *   OWNER_NAME / OWNER_EMAIL / OWNER_PHONE           (required)
 *   TEACHER_NAME / TEACHER_EMAIL / TEACHER_PHONE     (required)
 *   PARENT_NAME / PARENT_EMAIL / PARENT_PHONE        (required)
 *   STUDENT_NAME / STUDENT_DOB                       (required; DOB as YYYY-MM-DD)
 *   PASSWORD        the password all four are given  (required, 8+)
 */

import { PrismaClient } from "@prisma/client";

import { hashPassword } from "../src/lib/auth/password";

const prisma = new PrismaClient();

const BASE = (process.env.BASE ?? "http://localhost:3000").replace(/\/$/, "");

/** A child's sign-in address, made from the school's own web address so it is theirs and unique. */
function studentEmail(slug: string, admissionNumber: string): string {
  return `${admissionNumber.replace(/[^A-Za-z0-9]+/g, ".").replace(/^\.|\.$/g, "").toLowerCase()}@${slug}.futurerealm.school`;
}

function need(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is not set. Every name, address and password is given explicitly — none is invented here.`);
  return value;
}

const CONFIG = {
  schoolName: need("SCHOOL_NAME"),
  slug: process.env.SCHOOL_SLUG?.trim() || undefined,
  owner: { name: need("OWNER_NAME"), email: need("OWNER_EMAIL").toLowerCase(), phone: need("OWNER_PHONE") },
  teacher: { name: need("TEACHER_NAME"), email: need("TEACHER_EMAIL").toLowerCase(), phone: need("TEACHER_PHONE") },
  parent: { name: need("PARENT_NAME"), email: need("PARENT_EMAIL").toLowerCase(), phone: need("PARENT_PHONE") },
  student: { name: need("STUDENT_NAME"), dob: need("STUDENT_DOB") },
  password: need("PASSWORD"),
};

if (CONFIG.password.length < 8) throw new Error("PASSWORD must be at least 8 characters.");

/* ───────────────────────────── a session that keeps its cookies ───────────────────────────── */

const jar = new Map<string, string>();
let csrf = "";

function remember(response: Response) {
  for (const line of response.headers.getSetCookie?.() ?? []) {
    const [pair] = line.split(";");
    const at = pair.indexOf("=");
    if (at > 0) jar.set(pair.slice(0, at).trim(), pair.slice(at + 1).trim());
  }
  const token = jar.get("fr_csrf");
  if (token) csrf = decodeURIComponent(token);
}

async function call<T>(path: string, method: "GET" | "POST", body?: unknown): Promise<T> {
  const response = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      "content-type": "application/json",
      ...(jar.size ? { cookie: [...jar].map(([key, value]) => `${key}=${value}`).join("; ") } : {}),
      ...(csrf ? { "x-csrf-token": csrf } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    redirect: "manual",
  });
  remember(response);
  const text = await response.text();
  let parsed: { ok?: boolean; error?: string; message?: string; data?: T } = {};
  try {
    parsed = JSON.parse(text) as typeof parsed;
  } catch {
    throw new Error(`${method} ${path} answered ${response.status} with something that is not JSON: ${text.slice(0, 200)}`);
  }
  if (!response.ok || parsed.ok === false) {
    throw new Error(`${method} ${path} refused (${response.status}): ${parsed.error ?? parsed.message ?? text.slice(0, 200)}`);
  }
  return (parsed.data ?? (parsed as unknown)) as T;
}

/* ───────────────────────────── nothing is written over ───────────────────────────── */

async function refuseIfAnyExists() {
  const emails = [CONFIG.owner.email, CONFIG.teacher.email, CONFIG.parent.email];
  const taken = await prisma.user.findMany({ where: { email: { in: emails } }, select: { email: true } });
  if (taken.length) {
    throw new Error(`These accounts already exist, so nothing was written: ${taken.map((row) => row.email).join(", ")}. Use different addresses, or remove them first.`);
  }
  const named = await prisma.school.findFirst({ where: { name: CONFIG.schoolName }, select: { name: true, slug: true } });
  if (named) throw new Error(`A school called "${named.name}" is already here (${named.slug}), so nothing was written.`);
}

/* ───────────────────────────── the steps ───────────────────────────── */

type Registered = { school: { id: string; name: string; slug: string } };
type Overview = {
  classes: Array<{ id: string; name: string }>;
  arms: Array<{ id: string; name: string; levelId: string; roll: number }>;
};

async function main() {
  console.log(`Building "${CONFIG.schoolName}" through ${BASE}`);
  await refuseIfAnyExists();

  // 1 · the school itself, by the same path a real sign-up takes: session, terms, grading scheme,
  //     assessment components, subjects, class levels and their arms, and the trial.
  const registered = await call<Registered>("/api/v1/onboarding/schools", "POST", {
    schoolName: CONFIG.schoolName,
    ...(CONFIG.slug ? { slug: CONFIG.slug } : {}),
    category: "MIXED",
    ownerName: CONFIG.owner.name,
    ownerEmail: CONFIG.owner.email,
    ownerPhone: CONFIG.owner.phone,
    position: "Proprietor",
    password: CONFIG.password,
    country: "Nigeria",
    startTrial: true,
    // Real rungs, so the school has classes of its own and not only the demonstration one.
    levels: ["Primary / Elementary", "Junior Secondary", "Senior Secondary"],
  });
  const school = registered.school;
  console.log(`  school      ${school.name} · ${school.slug}`);

  // The sign-up answers with a session already, so the owner is signed in from here.
  const structure = await call<Overview>("/api/v1/class-structure/overview", "GET");
  // A real class, never the demonstration one: the sample class is taken away by itself once the
  // school has students of its own, and anyone standing in it would go with it.
  const real = structure.classes.filter((entry) => !/sample/i.test(entry.name));
  const level = real.find((entry) => structure.arms.some((item) => item.levelId === entry.id));
  const arm = level ? structure.arms.find((item) => item.levelId === level.id) : undefined;
  if (!level || !arm) throw new Error("The new school has no class of its own to put anyone in.");
  console.log(`  class       ${level.name} · ${arm.name}`);

  // 2 · the form master, named on that arm
  await call("/api/v1/staff-access/staff", "POST", {
    name: CONFIG.teacher.name,
    email: CONFIG.teacher.email,
    phone: CONFIG.teacher.phone,
    role: "Form Master",
    employment: "Full time",
    startDate: new Date().toISOString().slice(0, 10),
    formArm: arm.id,
    arms: [arm.id],
  });
  console.log(`  form master ${CONFIG.teacher.name}`);

  // 3 · the child in that arm, and the parent against the child, in one enrolment
  await call("/api/v1/student-records/registry/enrol", "POST", {
    name: CONFIG.student.name,
    dob: CONFIG.student.dob,
    gender: "Female",
    nationality: "Nigerian",
    level: level.name,
    arm: arm.name,
    boarding: "Day",
    guardianMode: "Add a new guardian",
    guardianName: CONFIG.parent.name,
    relation: "Mother",
    phone: CONFIG.parent.phone,
    email: CONFIG.parent.email,
    // The basis for holding the record at all; the product refuses an enrolment without it.
    consent: ["Core record processing"],
  });
  console.log(`  student     ${CONFIG.student.name}`);
  console.log(`  parent      ${CONFIG.parent.name}`);

  /*
   * 4 · the sign-ins.
   *
   * The teacher is invited by the product and already has an account, so it is only given the
   * password the activation email would otherwise have asked them to choose. A child and a parent
   * are different: the product has no endpoint that issues either a student or a guardian login —
   * only the ordinary seed makes them — so they are created here, the same way it does, and
   * attached to the records the enrolment just wrote.
   */
  const passwordHash = hashPassword(CONFIG.password);
  const owner = await prisma.user.findFirst({ where: { schoolId: school.id, role: "SCHOOL_OWNER" }, select: { id: true } });

  const teacher = await prisma.user.findFirst({ where: { schoolId: school.id, email: CONFIG.teacher.email }, select: { id: true } });
  if (!teacher) throw new Error("The form master was created but has no account to sign in with.");
  await prisma.user.update({ where: { id: teacher.id }, data: { passwordHash, isActive: true, emailVerifiedAt: new Date() } });

  const [firstName, ...restOfName] = CONFIG.student.name.trim().split(/\s+/);
  const childRecord = await prisma.student.findFirst({
    where: { schoolId: school.id, firstName, lastName: restOfName.join(" ") },
    select: { id: true, userId: true, admissionNumber: true },
  });
  if (!childRecord) throw new Error("The child was enrolled but cannot be found again.");
  const childLogin = childRecord.userId
    ? await prisma.user.update({ where: { id: childRecord.userId }, data: { passwordHash, isActive: true }, select: { id: true, email: true } })
    : await issue({ email: studentEmail(school.slug, childRecord.admissionNumber), firstName, lastName: restOfName.join(" "), role: "STUDENT" });
  if (!childRecord.userId) await prisma.student.update({ where: { id: childRecord.id }, data: { userId: childLogin.id } });

  const [parentFirst, ...parentRest] = CONFIG.parent.name.trim().split(/\s+/);
  const guardianRecord = await prisma.guardian.findFirst({ where: { schoolId: school.id, email: CONFIG.parent.email }, select: { id: true, userId: true } });
  if (!guardianRecord) throw new Error("The parent was created but cannot be found again.");
  const parentLogin = guardianRecord.userId
    ? await prisma.user.update({ where: { id: guardianRecord.userId }, data: { passwordHash, isActive: true }, select: { id: true, email: true } })
    : await issue({ email: CONFIG.parent.email, firstName: parentFirst ?? "Parent", lastName: parentRest.join(" "), role: "PARENT" });
  if (!guardianRecord.userId) await prisma.guardian.update({ where: { id: guardianRecord.id }, data: { userId: parentLogin.id } });

  /** A sign-in of this school's own, with the role's permissions attached as the product attaches them. */
  async function issue(person: { email: string; firstName: string; lastName: string; role: "STUDENT" | "PARENT" }) {
    const made = await prisma.user.create({
      data: { schoolId: school.id, email: person.email, firstName: person.firstName, lastName: person.lastName || person.firstName, passwordHash, role: person.role, isActive: true },
      select: { id: true, email: true },
    });
    const systemRole = await prisma.role.findFirst({ where: { schoolId: school.id, systemRole: person.role }, select: { id: true } });
    if (systemRole && owner) await prisma.userRoleAssignment.create({ data: { schoolId: school.id, userId: made.id, roleId: systemRole.id, assignedById: owner.id } });
    return made;
  }

  const childAccount = childLogin;
  const child = childRecord;
  console.log(`  sign-ins    teacher, parent and child can all sign in`);

  console.log("\nFour logins, all in this one school:");
  console.log(`  Owner        ${CONFIG.owner.email}`);
  console.log(`  Form master  ${CONFIG.teacher.email}`);
  console.log(`  Parent       ${parentLogin.email}`);
  console.log(`  Student      ${childAccount?.email ?? "(no portal account was made)"}${child?.admissionNumber ? ` · ${child.admissionNumber}` : ""}`);
  console.log(`  Password     the one you gave in PASSWORD`);
}

main()
  .catch((error: unknown) => {
    console.error(`\nStopped: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
