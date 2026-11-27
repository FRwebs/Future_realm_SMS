import { Injectable, NotFoundException } from "@nestjs/common";

import type { SessionPayload } from "../../../../src/lib/auth/session-core";
import { prisma } from "../../../../src/lib/db/prisma";
import { STANDARD_RETENTION, keptFor } from "../../common/retention-schedule";
import { loadConsentTypes } from "../student-records/consent.shared";
import { submissionTypes } from "../guardian-management/submission-intake";

const PRODUCT = "FutureRealm";
const iso = (date: Date | null | undefined) => (date ? date.toISOString() : null);

/**
 * A parent's privacy: what the school and its software hold about them and their children, why, for how long and where — in the words a
 * parent reads, from the school's own records — and their own data as a file they can take away at once.
 *
 * The notice is not a fixed page of legal text: the school's name, its data-protection contact, its retention schedule and the wording of
 * each permission it asks for are read from the school, so two schools never share a notice that is wrong for one of them.
 */
@Injectable()
export class ParentPrivacyService {
  private async mine(session: SessionPayload) {
    const guardians = await prisma.guardian.findMany({
      where: { userId: session.userId, mergedIntoId: null },
      include: { students: { include: { student: { include: { currentClass: { select: { name: true, arm: true } } } } } } },
      orderBy: { createdAt: "asc" },
    });
    if (!guardians.length) throw new NotFoundException("No guardian profile is linked to this account.");
    return guardians;
  }

  async notice(session: SessionPayload) {
    const guardians = await this.mine(session);
    const schoolIds = [...new Set(guardians.map((guardian) => guardian.schoolId))];
    const [schools, subscriptions, retention, regimes] = await Promise.all([
      prisma.school.findMany({ where: { id: { in: schoolIds } }, select: { id: true, name: true, shortName: true, city: true, state: true, country: true, mainPhone: true } }),
      prisma.schoolSubscription.findMany({ where: { schoolId: { in: schoolIds } }, select: { schoolId: true, dpoName: true, dpoEmail: true, hosting: true } }),
      prisma.retentionPolicy.findMany({ where: { schoolId: { in: schoolIds } }, orderBy: { dataClass: "asc" } }),
      prisma.countryProfile.findMany({ select: { country: true, dataProtectionRegime: true } }),
    ]);
    const out = [];
    for (const schoolId of schoolIds) {
      const school = schools.find((entry) => entry.id === schoolId);
      if (!school) continue;
      const types = await loadConsentTypes(schoolId);
      const own = retention.filter((row) => row.schoolId === schoolId);
      // A school that has not opened its governance page yet still keeps what the standard schedule says, so that is what it is told.
      const schedule = own.length ? own.map((row) => ({ dataClass: row.dataClass, kept: keptFor(row), basis: row.basis, hostedIn: row.hostedIn })) : STANDARD_RETENTION.map((row) => ({ dataClass: row.dataClass, kept: keptFor(row), basis: row.basis, hostedIn: school.country || "Nigeria" }));
      const sub = subscriptions.find((entry) => entry.schoolId === schoolId);
      const asked = await submissionTypes(schoolId);
      const copy = asked.find((type) => type.name === "Data copy request");
      out.push({
        school: { id: school.id, name: school.name, short: school.shortName?.trim() || school.name, place: [school.city, school.state, school.country].filter(Boolean).join(", "), phone: school.mainPhone ?? null },
        children: guardians.filter((guardian) => guardian.schoolId === schoolId).flatMap((guardian) => guardian.students.map((link) => link.student.firstName)),
        dpo: sub?.dpoName || sub?.dpoEmail ? { name: sub?.dpoName ?? null, email: sub?.dpoEmail ?? null } : null,
        hostedIn: sub?.hosting?.trim() || [...new Set(schedule.map((row) => row.hostedIn))].join(", "),
        regime: regimes.find((entry) => entry.country === school.country)?.dataProtectionRegime ?? null,
        retention: schedule,
        permissions: types.map((type) => ({ name: type.name, covers: type.covers, basis: type.basis ? "Needed to hold the record at all" : type.required ? "Required" : "Your choice, withdrawable any time", version: type.version ?? null })),
        copyWithinDays: copy?.accepted ? copy.target : null,
      });
    }
    return { controller: "the school", processor: PRODUCT, schools: out };
  }

  /** Everything the portal can say about this parent themselves — a file they take away, not a request the registrar fills in by hand. */
  async download(session: SessionPayload) {
    const guardians = await this.mine(session);
    const ids = guardians.map((guardian) => guardian.id);
    const schoolIds = [...new Set(guardians.map((guardian) => guardian.schoolId))];
    const [schools, user, consents, requests, concerns, signIns, types] = await Promise.all([
      prisma.school.findMany({ where: { id: { in: schoolIds } }, select: { id: true, name: true } }),
      prisma.user.findFirst({ where: { id: session.userId }, select: { email: true, userCode: true, username: true, createdAt: true, lastLoginAt: true, mfaEnabled: true } }),
      prisma.familyConsent.findMany({ where: { guardianId: { in: ids } }, orderBy: { recordedAt: "desc" } }),
      prisma.guardianSubmission.findMany({ where: { guardianId: { in: ids } }, orderBy: { createdAt: "desc" } }),
      prisma.safeguardingConcern.findMany({ where: { raisedById: session.userId }, orderBy: { createdAt: "desc" }, select: { studentId: true, summary: true, urgent: true, status: true, createdAt: true } }),
      prisma.loginAttempt.findMany({ where: { userId: session.userId }, orderBy: { createdAt: "desc" }, take: 100, select: { success: true, ipAddress: true, device: true, location: true, createdAt: true } }),
      Promise.all(schoolIds.map(async (id) => [id, await loadConsentTypes(id)] as const)),
    ]);
    const schoolName = (id: string) => schools.find((entry) => entry.id === id)?.name ?? "";
    const kids = new Map(guardians.flatMap((guardian) => guardian.students.map((link) => [link.studentId, link.student] as const)));
    const kidName = (id: string | null | undefined) => (id ? (kids.get(id) ? `${kids.get(id)!.firstName} ${kids.get(id)!.lastName}` : null) : null);
    const typeName = (schoolId: string, code: string) => types.find(([id]) => id === schoolId)?.[1].find((type) => type.code === code)?.name ?? code;
    return {
      about: "Your own data, as the school's records and this portal hold it. Generated when you asked for it.",
      generatedAt: new Date().toISOString(),
      account: { email: user?.email ?? null, signInName: user?.userCode ?? user?.username ?? null, createdAt: iso(user?.createdAt), lastSignIn: iso(user?.lastLoginAt), twoStep: Boolean(user?.mfaEnabled) },
      asGuardianAt: guardians.map((guardian) => ({
        school: schoolName(guardian.schoolId),
        name: `${guardian.firstName} ${guardian.lastName}`, relationship: guardian.relationship, phone: guardian.phone, email: guardian.email, address: guardian.address, occupation: guardian.occupation,
        language: guardian.language, mayTextYou: guardian.canReceiveSms, mayEmailYou: guardian.canReceiveEmail, onRecordSince: iso(guardian.createdAt),
        children: guardian.students.map((link) => ({ name: `${link.student.firstName} ${link.student.lastName}`, admissionNumber: link.student.admissionNumber, class: link.student.currentClass ? [link.student.currentClass.name, link.student.currentClass.arm].filter(Boolean).join(" ") : null, yourRelation: link.relation ?? guardian.relationship, primaryContact: link.isPrimary, mayCollect: link.canCollect })),
      })),
      permissionsYouGave: consents.map((row) => ({ school: schoolName(row.schoolId), permission: typeName(row.schoolId, row.typeCode), child: kidName(row.studentId), answer: row.status, recordedAt: iso(row.recordedAt), wording: row.noticeVersion ?? null })),
      requestsYouMade: requests.map((row) => ({ school: schoolName(row.schoolId), type: row.type, child: kidName(row.studentId), yourWords: row.detail, state: row.state, handledBy: row.ownerName, outcome: row.outcome, sentAt: iso(row.createdAt), closedAt: iso(row.resolvedAt) })),
      concernsYouRaised: concerns.map((row) => ({ child: kidName(row.studentId), yourWords: row.summary, markedUrgent: row.urgent, state: row.status === "CLOSED" ? "Closed" : "With the safeguarding lead", sentAt: iso(row.createdAt) })),
      signIns: signIns.map((row) => ({ at: iso(row.createdAt), worked: row.success, device: row.device, address: row.ipAddress, place: row.location })),
      notInThisFile: [
        "Your children's own records — results, attendance, fees, health and welfare notes, photographs. They belong to the school's record of the child; ask for them under Requests, and the school answers by a dated deadline.",
        "Messages the school sent you. They are in Messages for as long as the school keeps them.",
      ],
    };
  }
}
