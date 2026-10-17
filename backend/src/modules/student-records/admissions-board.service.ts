import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { ApplicationStatus, AuditAction, Prisma } from "@prisma/client";
import { z } from "zod";

import type { SessionPayload } from "../../../../src/lib/auth/session-core";
import { prisma } from "../../../../src/lib/db/prisma";
import { AdmissionsService } from "../admissions/admissions.service";
import { ConfigStore } from "../staff-access/staff-access.shared";
import { daysSince, fullName, genderLabel, nextAdmissionNumber } from "./records.shared";

/**
 * The admissions board: every applicant, where they are, and what moves them on. The pipeline is
 * read from the admissions workflow itself — each stage here is a group of real states — and
 * every action goes through that workflow, so a stage cannot be skipped from this page any more
 * than from anywhere else.
 */

export const STAGES = ["Enquiry", "Applied", "Assessed", "Offered", "Accepted", "Enrolled"] as const;
export type Stage = (typeof STAGES)[number];
type Closed = "Declined" | "Waitlisted";

const STAGE_OF: Record<string, Stage | Closed> = {
  DRAFT: "Enquiry",
  SUBMITTED: "Applied",
  REVIEWING: "Applied",
  INCOMPLETE: "Applied",
  AWAITING_DOCUMENTS: "Applied",
  PAYMENT_PENDING: "Applied",
  SCREENING_SCHEDULED: "Applied",
  SCREENING_COMPLETED: "Assessed",
  RECOMMENDED: "Assessed",
  APPROVED: "Assessed",
  CONDITIONALLY_APPROVED: "Assessed",
  OFFER_SENT: "Offered",
  ACCEPTED: "Accepted",
  FINANCIALLY_CLEARED: "Accepted",
  ENROLLED: "Enrolled",
  ACTIVE: "Enrolled",
  REJECTED: "Declined",
  DECLINED: "Declined",
  WAITLISTED: "Waitlisted"
};

/** The status each stage reopens at. */
const REOPEN_AT: Record<string, ApplicationStatus> = { Enquiry: "DRAFT", Applied: "SUBMITTED", Assessed: "SCREENING_COMPLETED", Offered: "OFFER_SENT" };

/** What the workflow wants next, from the state an application is in. */
const NEXT: Record<string, { step: string; label: string; stage?: string }> = {
  DRAFT: { step: "submit", label: "Send the application form" },
  SUBMITTED: { step: "review", label: "Review the application" },
  INCOMPLETE: { step: "review", label: "Review the application" },
  AWAITING_DOCUMENTS: { step: "review", label: "Review the application" },
  REVIEWING: { step: "fee", label: "Verify the application fee" },
  PAYMENT_PENDING: { step: "schedule", label: "Book a screening seat" },
  SCREENING_SCHEDULED: { step: "result", label: "Record the screening result" },
  SCREENING_COMPLETED: { step: "recommend", label: "Recommend the application" },
  RECOMMENDED: { step: "decide", label: "Decide on the application" },
  APPROVED: { step: "offer", label: "Issue the offer" },
  CONDITIONALLY_APPROVED: { step: "offer", label: "Issue the offer" },
  OFFER_SENT: { step: "accept", label: "Record the family's answer" },
  ACCEPTED: { step: "clear", label: "Clear the deposit" },
  FINANCIALLY_CLEARED: { step: "enrol", label: "Convert to a student record" }
};

const sessionSchema = z.object({ date: z.string().min(1), start: z.string().default("09:00"), end: z.string().default("11:00"), forLabel: z.string().default("All classes"), seats: z.coerce.number().int().positive().default(30), invigilator: z.string().default(""), venue: z.string().default("Main hall"), type: z.string().default("Written entrance assessment") });
export type ScreeningSession = z.infer<typeof sessionSchema> & { id: string };

const createSchema = z.object({
  name: z.string().trim().min(3, "Give the child's full name."),
  gender: z.string().default("Female"),
  dob: z.string().min(1, "Give the date of birth."),
  applyingFor: z.string().min(1, "Choose the class they are applying for."),
  entryTerm: z.string().optional(),
  previousSchool: z.string().optional(),
  guardianName: z.string().trim().min(3, "Give the guardian's name."),
  relation: z.string().default("Mother"),
  phone: z.string().trim().min(10, "An application with no contact cannot be progressed."),
  email: z.string().optional(),
  secondName: z.string().optional(),
  secondPhone: z.string().optional(),
  address: z.string().optional(),
  source: z.string().default("Website"),
  sibling: z.string().default("No"),
  sendForm: z.coerce.boolean().default(true)
});

const stepSchema = z.object({
  step: z.string(),
  note: z.string().optional(),
  reference: z.string().optional(),
  waived: z.coerce.boolean().default(false),
  amount: z.coerce.number().default(0),
  date: z.string().optional(),
  time: z.string().optional(),
  venue: z.string().optional(),
  invigilator: z.string().optional(),
  score: z.coerce.number().optional(),
  result: z.string().optional(),
  recommendation: z.string().optional(),
  decision: z.string().optional(),
  conditions: z.string().optional(),
  expiryDays: z.coerce.number().optional(),
  answer: z.string().optional(),
  className: z.string().optional(),
  relation: z.string().optional(),
  admission: z.string().optional(),
  documents: z.string().optional()
});

function splitName(name: string) {
  const [first, ...rest] = name.trim().split(/\s+/);
  return { first, last: rest.join(" ") || first };
}

@Injectable()
export class AdmissionsBoardService {
  constructor(private readonly admissions: AdmissionsService) {}

  private sessions(schoolId: string) {
    return new ConfigStore(schoolId, "screening-sessions");
  }

  private async audit(session: SessionPayload, action: AuditAction, entityId: string, metadata: Prisma.InputJsonValue) {
    await prisma.auditLog.create({ data: { schoolId: session.schoolId, actorId: session.userId, action, entityType: "AdmissionApplication", entityId, metadata } });
  }

  async options(session: SessionPayload) {
    const schoolId = session.schoolId;
    const [levels, terms, staff, sessions] = await Promise.all([
      prisma.classLevel.findMany({ where: { schoolId, isActive: true }, orderBy: { order: "asc" }, select: { name: true } }),
      prisma.term.findMany({ where: { schoolId }, include: { academicSession: true }, orderBy: { startDate: "desc" }, take: 6 }),
      prisma.user.findMany({ where: { schoolId, isActive: true, role: { in: ["PRINCIPAL", "ADMISSIONS_OFFICER", "ADMIN_OFFICER", "TEACHER", "CLASS_TEACHER", "SUBJECT_TEACHER"] } }, select: { firstName: true, lastName: true }, orderBy: { firstName: "asc" }, take: 40 }),
      this.sessionList(schoolId)
    ]);
    return { levels: levels.map((level) => level.name), terms: terms.map((term) => `${term.name} ${term.academicSession?.name ?? ""}`.trim()), staff: staff.map(fullName), sessions };
  }

  /** The assessment diary: sessions the school has scheduled, and the seats each has left. */
  async sessionList(schoolId: string) {
    const configured = await this.sessions(schoolId).list<ScreeningSession>();
    const booked = await prisma.admissionScreening.findMany({ where: { schoolId }, select: { scheduledAt: true, applicationId: true } });
    const key = (date: Date) => date.toISOString().slice(0, 16);
    const bookedAt = new Map<string, number>();
    for (const row of booked) bookedAt.set(key(row.scheduledAt), (bookedAt.get(key(row.scheduledAt)) ?? 0) + 1);
    const list = configured.map((row) => {
      const when = new Date(`${row.data.date}T${row.data.start}:00`);
      const taken = bookedAt.get(key(when)) ?? 0;
      return { id: row.id, date: row.data.date, start: row.data.start, end: row.data.end, forLabel: row.data.forLabel, seats: row.data.seats, booked: taken, invigilator: row.data.invigilator, venue: row.data.venue, type: row.data.type };
    });
    const covered = new Set(list.map((row) => key(new Date(`${row.date}T${row.start}:00`))));
    for (const [at, count] of bookedAt) {
      if (covered.has(at)) continue;
      const when = new Date(at + ":00.000Z");
      list.push({ id: `at:${at}`, date: at.slice(0, 10), start: at.slice(11, 16), end: "", forLabel: "Booked individually", seats: 0, booked: count, invigilator: "", venue: "", type: "Screening" });
      void when;
    }
    return list.sort((a, b) => `${a.date}${a.start}`.localeCompare(`${b.date}${b.start}`));
  }

  async addSession(session: SessionPayload, body: unknown) {
    const input = sessionSchema.parse(body);
    if (Number.isNaN(new Date(input.date).getTime())) throw new BadRequestException("That is not a date.");
    const id = `ses-${Date.now().toString(36)}`;
    await this.sessions(session.schoolId).put(id, `${input.date} ${input.start}`, input);
    await this.audit(session, AuditAction.CREATE, id, { summary: `Screening session scheduled · ${input.date} ${input.start}` });
    return { id };
  }

  /** Every applicant, the stages they sit in, and what is holding the cycle up. */
  async overview(session: SessionPayload) {
    const schoolId = session.schoolId;
    const [applications, sessions, current, config] = await Promise.all([
      prisma.admissionApplication.findMany({
        where: { schoolId },
        include: { desiredClass: { include: { classLevel: true } }, screenings: { orderBy: { scheduledAt: "desc" } }, offers: { orderBy: { createdAt: "desc" } }, history: { orderBy: { createdAt: "desc" }, take: 1 }, academicSession: { select: { id: true, name: true } } },
        orderBy: { submittedAt: "desc" }
      }),
      this.sessionList(schoolId),
      prisma.academicSession.findFirst({ where: { schoolId, isCurrent: true } }),
      prisma.admissionConfig.findFirst({ where: { schoolId, isActive: true }, select: { name: true } })
    ]);
    const rows = applications.map((row) => {
      const stage = STAGE_OF[row.status] ?? "Applied";
      const screening = row.screenings[0];
      const scored = screening?.score !== null && screening?.score !== undefined;
      const needsScreening = (stage === "Enquiry" || stage === "Applied") && !(screening && !screening.completedAt);
      return {
        id: row.id,
        name: fullName(row),
        gender: genderLabel(row.gender),
        dob: row.dateOfBirth.toISOString(),
        ref: row.applicationNo,
        forClass: row.desiredClass ? (row.desiredClass.classLevel?.name ?? row.desiredClass.name) : "Unassigned",
        guardian: row.guardianName,
        phone: row.guardianPhone,
        screening: screening ? { at: screening.scheduledAt.toISOString(), venue: screening.venue } : null,
        needsScreening,
        score: scored ? Math.round(((screening?.score ?? 0) / (screening?.maxScore || 100)) * 100) : null,
        stage,
        status: row.status,
        days: daysSince(row.history[0]?.createdAt ?? row.submittedAt),
        cycle: row.academicSession?.name ?? "Unassigned",
        cycleId: row.academicSessionId,
        feeCleared: row.feeWaived || row.applicationFeeStatus === "VERIFIED" || row.applicationFeeStatus === "WAIVED" || row.applicationFeeStatus === "NOT_REQUIRED",
        duplicate: row.duplicateFlag,
        offerExpires: row.offers[0]?.status === "SENT" ? row.offers[0].expiresAt.toISOString() : null
      };
    });
    const thisCycle = rows.filter((row) => !current || row.cycleId === current.id || !row.cycleId);
    const count = (stage: string, list = thisCycle) => list.filter((row) => row.stage === stage).length;
    const closed = thisCycle.filter((row) => row.stage === "Declined" || row.stage === "Waitlisted");
    const live = thisCycle.filter((row) => row.stage !== "Declined" && row.stage !== "Waitlisted");

    const byClass = new Map<string, { total: number; enrolled: number }>();
    for (const row of thisCycle) {
      const entry = byClass.get(row.forClass) ?? { total: 0, enrolled: 0 };
      entry.total += 1;
      if (row.stage === "Enrolled") entry.enrolled += 1;
      byClass.set(row.forClass, entry);
    }
    const cycles = new Map<string, { name: string; start: number; enquiries: number; applied: number; offered: number; enrolled: number }>();
    for (const application of applications) {
      const name = application.academicSession?.name ?? "Unassigned";
      const entry = cycles.get(name) ?? { name, start: 0, enquiries: 0, applied: 0, offered: 0, enrolled: 0 };
      entry.enquiries += 1;
      if (application.status !== "DRAFT") entry.applied += 1;
      if (application.offers.length) entry.offered += 1;
      if (application.status === "ENROLLED" || application.status === "ACTIVE") entry.enrolled += 1;
      cycles.set(name, entry);
    }

    const soon = Date.now() + 3 * 86_400_000;
    const expiring = rows.filter((row) => row.offerExpires && new Date(row.offerExpires).getTime() < soon);
    const noPhone = rows.filter((row) => !row.phone?.trim() && row.stage !== "Enrolled" && row.stage !== "Declined");
    const toConvert = rows.filter((row) => row.stage === "Accepted");
    const needDate = live.filter((row) => row.needsScreening && row.stage !== "Enrolled");
    const enrolled = count("Enrolled");

    return {
      cycle: current?.name ?? config?.name ?? "This cycle",
      stages: STAGES.map((stage) => ({ stage, count: count(stage) })),
      rows: thisCycle,
      all: rows.length,
      closed: closed.length,
      sessions,
      holding: {
        needDate: needDate.length,
        expiring: expiring.length,
        noPhone: noPhone.length,
        toConvert: toConvert.length
      },
      conversion: thisCycle.length ? Math.round((enrolled / thisCycle.length) * 100) : 0,
      byClass: Array.from(byClass.entries()).map(([name, value]) => ({ name, total: value.total, enrolled: value.enrolled })),
      cycles: Array.from(cycles.values()).map((entry) => ({ name: entry.name, enquiries: entry.enquiries, applied: entry.applied, offered: entry.offered, enrolled: entry.enrolled, rate: entry.enquiries ? Math.round((entry.enrolled / entry.enquiries) * 100) : 0, open: entry.name === current?.name })).sort((a, b) => b.name.localeCompare(a.name)),
      history: rows
    };
  }

  /** One applicant: their progress, their family, their screening and what they still owe. */
  async applicant(session: SessionPayload, id: string) {
    const schoolId = session.schoolId;
    const row = await prisma.admissionApplication.findFirst({
      where: { id, schoolId },
      include: {
        desiredClass: { include: { classLevel: true } },
        screenings: { orderBy: { scheduledAt: "desc" }, include: { interviewer: { select: { firstName: true, lastName: true } } } },
        offers: { orderBy: { createdAt: "desc" } },
        history: { orderBy: { createdAt: "asc" }, include: { changedBy: { select: { firstName: true, lastName: true } } } },
        documents: { orderBy: { uploadedAt: "desc" } },
        comments: { orderBy: { createdAt: "desc" }, include: { author: { select: { firstName: true, lastName: true } } } },
        registeredStudent: { select: { id: true, admissionNumber: true } },
        academicSession: { select: { name: true } },
        paymentLinks: { orderBy: { verifiedAt: "desc" } }
      }
    });
    if (!row) throw new NotFoundException("That application does not exist.");
    const stage = STAGE_OF[row.status] ?? "Applied";
    const config = await prisma.admissionConfig.findFirst({ where: { schoolId, isActive: true } });
    const required = Array.isArray(config?.requiredDocuments) ? (config?.requiredDocuments as string[]) : ["Birth certificate", "Passport photograph", "Previous school report", "Immunisation record", "Transfer certificate"];
    const have = new Set(row.documents.map((document) => document.label.toLowerCase()));
    const stageIndex = STAGES.indexOf(stage as Stage);
    const reached = (target: Stage) => {
      const wanted = Object.entries(STAGE_OF).filter(([, value]) => value === target).map(([status]) => status);
      return row.history.find((entry) => wanted.includes(entry.toStatus));
    };
    const screening = row.screenings[0];
    const placesLeft = row.desiredClass ? Math.max(0, row.desiredClass.capacity - (await prisma.student.count({ where: { schoolId, currentClassId: row.desiredClassId, status: "ACTIVE" } }))) : null;
    const sameGuardian = await prisma.student.count({ where: { schoolId, guardians: { some: { guardian: { phone: row.guardianPhone } } } } });
    const siblings = await prisma.admissionApplication.count({ where: { schoolId, guardianPhone: row.guardianPhone, id: { not: id } } });

    return {
      id: row.id,
      name: fullName(row),
      gender: genderLabel(row.gender),
      dob: row.dateOfBirth.toISOString(),
      ref: row.applicationNo,
      forClass: row.desiredClass ? (row.desiredClass.classLevel?.name ?? row.desiredClass.name) : "Unassigned",
      cycle: row.academicSession?.name ?? "—",
      stage,
      stageIndex,
      status: row.status,
      declined: stage === "Declined",
      waitlisted: stage === "Waitlisted",
      days: daysSince(row.history[row.history.length - 1]?.createdAt ?? row.submittedAt),
      opened: row.submittedAt.toISOString(),
      next: NEXT[row.status] ?? null,
      feeCleared: row.feeWaived || row.applicationFeeStatus === "VERIFIED" || row.applicationFeeStatus === "WAIVED" || row.applicationFeeStatus === "NOT_REQUIRED",
      guardian: { name: row.guardianName, phone: row.guardianPhone, email: row.guardianEmail, secondName: row.emergencyContactName, secondPhone: row.emergencyContactPhone, address: row.address },
      child: { previousSchool: row.previousSchool, medical: row.medicalNotes },
      screening: screening ? { at: screening.scheduledAt.toISOString(), venue: screening.venue, by: screening.interviewer ? fullName(screening.interviewer) : null, score: screening.score, max: screening.maxScore, result: screening.result, completed: Boolean(screening.completedAt) } : null,
      offer: row.offers[0] ? { number: row.offers[0].offerNumber, status: row.offers[0].status, sentAt: row.offers[0].sentAt?.toISOString() ?? null, expiresAt: row.offers[0].expiresAt.toISOString() } : null,
      stages: STAGES.map((name, index) => {
        const hit = reached(name);
        return { name, done: index <= stageIndex && stage !== "Declined", when: hit ? hit.createdAt.toISOString() : index === 0 ? row.submittedAt.toISOString() : null, by: hit?.changedBy ? fullName(hit.changedBy) : null, note: hit?.note ?? null };
      }),
      documents: required.map((label) => {
        const match = row.documents.find((document) => document.label.toLowerCase() === label.toLowerCase());
        return { label, source: match ? "Guardian upload" : "—", received: match ? match.uploadedAt.toISOString() : null, verified: match?.isVerified ?? false };
      }),
      missingDocuments: required.filter((label) => !have.has(label.toLowerCase())),
      said: [
        ...row.history.slice(-6).reverse().map((entry) => ({ label: entry.note ?? `Moved to ${entry.toStatus.replace(/_/g, " ").toLowerCase()}`, sub: `${entry.createdAt.toLocaleDateString("en-GB", { day: "numeric", month: "long" })}${entry.changedBy ? ` · ${fullName(entry.changedBy)}` : ""}` })),
        ...row.comments.slice(0, 4).map((comment) => ({ label: comment.body.slice(0, 90), sub: `${comment.createdAt.toLocaleDateString("en-GB", { day: "numeric", month: "long" })}${comment.author ? ` · ${fullName(comment.author)}` : ""}` }))
      ],
      placesLeft,
      siblingInSchool: sameGuardian > 0,
      otherApplications: siblings,
      student: row.registeredStudent ? { id: row.registeredStudent.id, adm: row.registeredStudent.admissionNumber } : null,
      duplicate: row.duplicateFlag ? row.duplicateReason : null,
      fee: { status: row.applicationFeeStatus, waived: row.feeWaived }
    };
  }

  async pipeline(session: SessionPayload, state: string) {
    const overview = await this.overview(session);
    const rows = state === "History" ? overview.history : overview.rows.filter((row) => row.stage === state);
    return { state, rows, cycles: overview.cycles, cycle: overview.cycle };
  }

  /* ───────────────────────── acting on an application ───────────────────────── */

  async create(session: SessionPayload, body: unknown) {
    const input = createSchema.parse(body);
    const { first, last } = splitName(input.name);
    const dob = new Date(input.dob);
    if (Number.isNaN(dob.getTime())) throw new BadRequestException("That is not a date of birth.");
    const level = input.applyingFor.trim();
    const created = await this.admissions.createApplication(session.schoolId, session.userId, {
      firstName: first,
      lastName: last,
      guardianName: input.guardianName,
      guardianPhone: input.phone,
      guardianEmail: input.email || "",
      address: input.address || "",
      emergencyContactName: input.secondName || "",
      emergencyContactPhone: input.secondPhone || "",
      previousSchool: input.previousSchool || "",
      desiredClass: level,
      gender: input.gender === "Male" ? "MALE" : input.gender === "Female" ? "FEMALE" : "OTHER",
      dateOfBirth: input.dob,
      draft: true
    });
    await prisma.admissionComment.create({ data: { schoolId: session.schoolId, applicationId: created.id, authorId: session.userId, body: `Found us through: ${input.source}. Sibling already in the school: ${input.sibling}. ${input.sendForm ? "Application form sent to the guardian." : "Form not yet sent."}`, isInternal: true } });
    return { id: created.id, ref: created.applicationNo };
  }

  async advance(session: SessionPayload, id: string, body: unknown) {
    const input = stepSchema.parse(body);
    const schoolId = session.schoolId;
    const actor = session.userId;
    const row = await prisma.admissionApplication.findFirst({ where: { id, schoolId } });
    if (!row) throw new NotFoundException("That application does not exist.");
    const expected = NEXT[row.status];
    if (!expected) throw new BadRequestException("This application is closed. Reopen it first.");
    if (expected.step !== input.step) throw new BadRequestException(`The next step for this application is “${expected.label}”, not that one.`);

    switch (input.step) {
      case "submit":
        await this.admissions.submitApplication(schoolId, actor, id);
        break;
      case "review":
        await this.admissions.reviewAdmission(schoolId, actor, "", id, { notes: input.note || "Reviewed — complete enough to proceed." });
        break;
      case "fee":
        await this.admissions.verifyApplicationFee(schoolId, actor, id, { amount: input.amount, reference: input.reference || "", waived: input.waived, note: input.note || "" });
        break;
      case "schedule": {
        if (!input.date) throw new BadRequestException("Choose the date of the screening.");
        await this.admissions.scheduleScreening(schoolId, actor, id, { scheduledAt: `${input.date}T${input.time || "09:00"}:00`, venue: input.venue || "Main hall", note: input.note || "" });
        break;
      }
      case "result":
        if (input.score === undefined) throw new BadRequestException("Give the score.");
        await this.admissions.recordScreeningResult(schoolId, actor, id, { score: input.score, result: input.result || (input.score >= 50 ? "PASS" : "FAIL"), recommendation: input.recommendation || "See remarks", remarks: input.note || "Assessment sat and scored." });
        break;
      case "recommend":
        await this.admissions.recommendApplication(schoolId, actor, id, { notes: input.note || "Recommended on the assessment result." });
        break;
      case "decide":
        await this.admissions.decideApplication(schoolId, actor, id, { decision: input.decision || "APPROVED", notes: input.note || "Decision recorded.", conditions: input.conditions || "" });
        break;
      case "offer":
        await this.admissions.issueOffer(schoolId, actor, id, { conditions: input.conditions || "", expiryDays: input.expiryDays });
        break;
      case "accept":
        if (input.answer === "decline") await this.admissions.declineOffer(schoolId, id, { note: input.note || "" });
        else await this.admissions.acceptOffer(schoolId, id, { note: input.note || "" });
        break;
      case "clear":
        await this.admissions.markFinanciallyCleared(schoolId, actor, id, { amount: input.amount, reference: input.reference || "", waived: input.waived, note: input.note || "Deposit received." });
        break;
      case "enrol": {
        const className = input.className || (await this.defaultClass(schoolId, id));
        const student = await this.admissions.enrollApplicant(schoolId, actor, id, { className, guardianRelationship: input.relation || "Parent", admissionNumber: input.admission || (await nextAdmissionNumber(schoolId)), portalAccountsCreated: false });
        await this.audit(session, AuditAction.CREATE, id, { summary: `Converted to a student record · ${student.admissionNumber}` });
        return { id, student: student.id, adm: student.admissionNumber };
      }
      default:
        throw new BadRequestException("That is not a step.");
    }
    return { id };
  }

  private async defaultClass(schoolId: string, id: string) {
    const row = await prisma.admissionApplication.findFirstOrThrow({ where: { id, schoolId }, include: { desiredClass: true } });
    if (!row.desiredClass) throw new BadRequestException("Choose the class to place them in.");
    return row.desiredClass.arm ? `${row.desiredClass.name} - ${row.desiredClass.arm}` : row.desiredClass.name;
  }

  /** Book seats for one applicant, a group, or everyone who has no date — skipping, and saying why, whoever is not ready. */
  async schedule(session: SessionPayload, body: unknown) {
    const input = z.object({ who: z.string().default("One applicant"), applicants: z.array(z.string()).default([]), session: z.string().min(1, "Choose a session."), date: z.string().optional(), start: z.string().optional(), venue: z.string().optional(), type: z.string().optional(), invigilator: z.string().optional() }).parse(body);
    const schoolId = session.schoolId;
    let date = input.date;
    let time = input.start || "09:00";
    let venue = input.venue || "Main hall";
    if (input.session.startsWith("A new")) {
      if (!date) throw new BadRequestException("Give the date of the new session.");
      await this.addSession(session, { date, start: time, end: "", forLabel: "All classes", seats: 30, invigilator: input.invigilator || "", venue, type: input.type || "Written entrance assessment" });
    } else {
      const known = (await this.sessionList(schoolId)).find((row) => input.session.startsWith(`${row.date} ${row.start}`) || row.id === input.session || input.session.includes(row.date));
      if (!known) throw new BadRequestException("That session is not in the diary.");
      date = known.date;
      time = known.start;
      venue = known.venue || venue;
    }
    const where: Prisma.AdmissionApplicationWhereInput = { schoolId, status: { in: ["REVIEWING", "PAYMENT_PENDING", "SUBMITTED", "DRAFT", "INCOMPLETE", "AWAITING_DOCUMENTS"] } };
    const candidates = input.who.startsWith("Everyone") ? await prisma.admissionApplication.findMany({ where: { ...where, screenings: { none: {} } }, select: { id: true, status: true, firstName: true, lastName: true } }) : await prisma.admissionApplication.findMany({ where: { ...where, id: { in: input.applicants } }, select: { id: true, status: true, firstName: true, lastName: true } });
    if (!candidates.length) throw new BadRequestException("Nobody who is ready can be booked — an applicant must be reviewed, with the application fee cleared, before a seat can be held.");
    const booked: string[] = [];
    const skipped: string[] = [];
    for (const candidate of candidates) {
      try {
        await this.admissions.scheduleScreening(schoolId, session.userId, candidate.id, { scheduledAt: `${date}T${time}:00`, venue, note: input.type || "Screening scheduled." });
        booked.push(fullName(candidate));
      } catch (error) {
        skipped.push(`${fullName(candidate)}: ${(error as Error).message}`);
      }
    }
    return { booked: booked.length, skipped };
  }

  /** Issue offers or close applications for everyone ticked, saying who could not be moved and why. */
  async bulk(session: SessionPayload, body: unknown) {
    const input = z.object({ action: z.enum(["offer", "decline"]), applicants: z.array(z.string()).min(1, "Tick who it is for."), expiryDays: z.coerce.number().optional(), conditions: z.string().optional(), by: z.string().optional(), reason: z.string().optional(), words: z.string().optional(), letter: z.coerce.boolean().optional() }).parse(body);
    const rows = await prisma.admissionApplication.findMany({ where: { schoolId: session.schoolId, id: { in: input.applicants } }, select: { id: true, status: true, firstName: true, lastName: true } });
    let done = 0;
    const skipped: string[] = [];
    for (const row of rows) {
      try {
        if (input.action === "offer") await this.advance(session, row.id, { step: "offer", expiryDays: input.expiryDays, conditions: input.conditions });
        else await this.decline(session, row.id, { by: input.by ?? "The school", reason: input.reason ?? "", words: input.words, letter: input.letter ?? true });
        done += 1;
      } catch (error) {
        const next = NEXT[row.status];
        skipped.push(`${fullName(row)}: ${input.action === "offer" && next ? `is at “${next.label}” — an offer can only be issued once the application is approved` : (error as Error).message}`);
      }
    }
    return { done, skipped };
  }

  async decline(session: SessionPayload, id: string, body: unknown) {
    const input = z.object({ by: z.string().default("The school"), reason: z.string().min(1, "Give the reason."), words: z.string().optional(), waitlist: z.coerce.boolean().default(false), letter: z.coerce.boolean().default(true) }).parse(body);
    const schoolId = session.schoolId;
    const row = await prisma.admissionApplication.findFirst({ where: { id, schoolId } });
    if (!row) throw new NotFoundException("That application does not exist.");
    if (["ENROLLED", "ACTIVE", "REJECTED", "DECLINED"].includes(row.status)) throw new BadRequestException("That application is already closed.");
    const to: ApplicationStatus = input.waitlist ? "WAITLISTED" : input.by === "The family" ? "DECLINED" : "REJECTED";
    const note = [input.reason, input.words].filter(Boolean).join(" — ");
    await prisma.$transaction([
      prisma.admissionStatusHistory.create({ data: { schoolId, applicationId: id, fromStatus: row.status, toStatus: to, changedById: session.userId, note, metadata: { declinedBy: input.by, letter: input.letter } } }),
      prisma.admissionApplication.update({ where: { id }, data: { status: to, decidedAt: new Date(), notes: note } })
    ]);
    await this.audit(session, AuditAction.REJECT, id, { summary: `Application ${input.waitlist ? "waitlisted" : "declined"} · ${input.reason}`, by: input.by });
    return { id, state: input.waitlist ? "Waitlisted" : "Declined" };
  }

  async reopen(session: SessionPayload, id: string, body: unknown) {
    const input = z.object({ at: z.string().min(1), reason: z.string().trim().min(5, "Say why it is being reopened.") }).parse(body);
    const schoolId = session.schoolId;
    const row = await prisma.admissionApplication.findFirst({ where: { id, schoolId } });
    if (!row) throw new NotFoundException("That application does not exist.");
    if (!["REJECTED", "DECLINED", "WAITLISTED"].includes(row.status)) throw new BadRequestException("Only a closed application can be reopened.");
    const to = REOPEN_AT[input.at];
    if (!to) throw new BadRequestException("Choose the stage to reopen it at.");
    await prisma.$transaction([
      prisma.admissionStatusHistory.create({ data: { schoolId, applicationId: id, fromStatus: row.status, toStatus: to, changedById: session.userId, note: `Reopened: ${input.reason}` } }),
      prisma.admissionApplication.update({ where: { id }, data: { status: to, decidedAt: null } })
    ]);
    await this.audit(session, AuditAction.UPDATE, id, { summary: `Application reopened at ${input.at}`, reason: input.reason });
    return { id };
  }

  async editContact(session: SessionPayload, id: string, body: unknown) {
    const input = z.object({ name: z.string().trim().min(3), relation: z.string().optional(), phone: z.string().trim().min(10), email: z.string().optional(), secondName: z.string().optional(), secondPhone: z.string().optional(), address: z.string().optional() }).parse(body);
    const row = await prisma.admissionApplication.findFirst({ where: { id, schoolId: session.schoolId } });
    if (!row) throw new NotFoundException("That application does not exist.");
    await prisma.admissionApplication.update({ where: { id }, data: { guardianName: input.name, guardianPhone: input.phone, guardianEmail: input.email || null, emergencyContactName: input.secondName || null, emergencyContactPhone: input.secondPhone || null, address: input.address || null } });
    await this.audit(session, AuditAction.UPDATE, id, { summary: "Applicant contact updated" });
    return { id };
  }

  async requestDocuments(session: SessionPayload, id: string, body: unknown) {
    const input = z.object({ documents: z.array(z.string()).min(1, "Choose what is needed."), due: z.string().optional(), message: z.string().optional(), via: z.array(z.string()).default([]) }).parse(body);
    const row = await prisma.admissionApplication.findFirst({ where: { id, schoolId: session.schoolId } });
    if (!row) throw new NotFoundException("That application does not exist.");
    try {
      await this.admissions.requestDocuments(session.schoolId, session.userId, id, { missingDocuments: input.documents.join(", "), note: input.message || `Please provide the documents listed, due ${input.due ?? "within a week"}.` });
    } catch {
      await prisma.admissionComment.create({ data: { schoolId: session.schoolId, applicationId: id, authorId: session.userId, body: `Documents requested: ${input.documents.join(", ")} (${input.due ?? "7 days"}).`, isInternal: true } });
    }
    return { id, requested: input.documents.length };
  }
}
