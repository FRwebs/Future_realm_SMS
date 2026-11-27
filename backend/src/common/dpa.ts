import { ForbiddenException } from "@nestjs/common";
import { AuditAction } from "@prisma/client";

import type { SessionPayload } from "../../../src/lib/auth/session-core";
import { prisma } from "../../../src/lib/db/prisma";

/**
 * The data processing agreement between a school and FutureRealm.
 *
 * The school is the data controller: it decides what is held about its pupils, their families and its staff, and why. FutureRealm is the
 * processor: it holds those records on the school's behalf and does only what the school tells it to. Before FutureRealm handles
 * children's data the school accepts a versioned agreement; a newer version asks it to accept again. One place reads the agreement and one
 * place records its acceptance, so the school's Profile, its billing Account and the platform's compliance page cannot tell three stories.
 */

/** Who may accept it for a school: the person who owns it. */
export const DPA_ACCEPTERS = new Set(["SCHOOL_OWNER", "PROPRIETOR", "SUPER_ADMIN"]);

export const STANDARD_VERSION = "4.0";

/** The platform's standard wording, used for any version published without text of its own. A school should have it read by its own adviser. */
export const STANDARD_DPA_TEXT = `DATA PROCESSING AGREEMENT

1. The parties
The school ("the Controller") decides what personal data it holds about its pupils, their families, its staff and applicants, and why. FutureRealm ("the Processor") holds that data on the school's behalf, through the FutureRealm school management system.

2. What the Processor does
The Processor processes the school's personal data only on the school's documented instructions — the settings, records and requests the school makes in the system — and for no purpose of its own. It does not sell the data, use it to advertise, or use pupils' data to train products.

3. The data covered
Identity, contact, admission, attendance, assessment, report card, fee and payment, health and welfare, photograph, safeguarding, message and sign-in records of the school's pupils, their guardians and its staff, to the extent the school records them.

4. Children's data
The Controller is responsible for the lawful basis on which each kind of record is held and for the permissions it asks families for. The Processor gives it the tools to record, show and withdraw those permissions, and applies them when it sends or shows anything.

5. Confidentiality and security
The Processor keeps the data confidential, limits access to staff who need it, protects it in transit and at rest, keeps an audit trail of who changed what, and tests its safeguards regularly.

6. Sub-processors and hosting
The Processor uses only the sub-processors it names to the school, under terms no weaker than these, and hosts the school's data in the country or region the school's account states. It does not move the data elsewhere without telling the school first.

7. Personal data breaches
The Processor tells the school without undue delay, and within 72 hours of becoming aware, of any breach affecting its data, with what it knows about what happened, what was affected and what is being done.

8. Helping the school meet its duties
The Processor helps the school answer requests from families to see, correct or remove their data, within the time the law gives the school, and helps it with impact assessments and with the regulator.

9. Keeping and returning data
The school's data is kept for as long as the school's account is open and its retention schedule says. When the account closes, the Processor returns the school's data in a usable file, then deletes it after the retention period on the account, and says when it has.

10. Checking the Processor
The Processor gives the school what it needs to show it is keeping to this agreement, and lets the school, or an auditor it names, check it, with reasonable notice.

11. Changes
A new version of this agreement is issued with its date. The school is asked to accept it again before it applies to the school's data.`;

export async function ensureDpaVersion() {
  if (await prisma.dpaVersion.count()) return;
  await prisma.dpaVersion.create({
    data: { version: STANDARD_VERSION, effectiveFrom: new Date("2026-01-01T00:00:00Z"), summary: "The agreement every school has been offered since launch.", body: STANDARD_DPA_TEXT, isCurrent: true },
  });
}

/** The version in force, with its words — made if the platform has not published one yet, so a school is never left with nothing to read. */
export async function dpaInForce() {
  await ensureDpaVersion();
  const row = await prisma.dpaVersion.findFirst({ where: { isCurrent: true } });
  if (!row) return null;
  return { version: row.version, effectiveFrom: row.effectiveFrom.toISOString(), summary: row.summary, body: row.body?.trim() || STANDARD_DPA_TEXT, standard: !row.body?.trim() };
}

/** What the agreement says about this school: what is in force, what the school has accepted, by whom and when, and where its data is hosted. */
export async function agreementOf(schoolId: string) {
  const [school, current, subscription, retention] = await Promise.all([
    prisma.school.findUniqueOrThrow({ where: { id: schoolId }, select: { name: true, country: true, dpaStatus: true, dpaVersion: true, dpaAcceptedAt: true, dpaAcceptedById: true } }),
    dpaInForce(),
    prisma.schoolSubscription.findUnique({ where: { schoolId }, select: { hosting: true, dpoName: true, dpoEmail: true } }),
    prisma.retentionPolicy.findMany({ where: { schoolId }, select: { hostedIn: true } }),
  ]);
  const accepter = school.dpaAcceptedById ? await prisma.user.findUnique({ where: { id: school.dpaAcceptedById }, select: { firstName: true, lastName: true, role: true } }) : null;
  const signed = school.dpaStatus === "SIGNED";
  const hosting = subscription?.hosting?.trim() || [...new Set(retention.map((row) => row.hostedIn))].join(", ") || school.country || null;
  return {
    status: signed ? ("SIGNED" as const) : ("PENDING" as const),
    version: school.dpaVersion,
    acceptedAt: school.dpaAcceptedAt?.toISOString() ?? null,
    by: accepter ? `${accepter.firstName} ${accepter.lastName}` : null,
    byRole: accepter ? String(accepter.role).replace(/_/g, " ").toLowerCase() : null,
    current,
    /** Signed, but a newer version has been published since: the school is asked to accept again. */
    outdated: signed && Boolean(current) && school.dpaVersion !== current!.version,
    hosting,
    controller: school.name,
    processor: "FutureRealm",
    dpo: subscription?.dpoName || subscription?.dpoEmail ? { name: subscription?.dpoName ?? null, email: subscription?.dpoEmail ?? null } : null,
  };
}

/** The school accepts the version in force — never whatever a browser claims it read. */
export async function acceptDpa(session: SessionPayload) {
  if (!DPA_ACCEPTERS.has(session.role)) throw new ForbiddenException("Only the Proprietor can accept the data processing agreement for the school.");
  const current = await dpaInForce();
  const version = current?.version ?? STANDARD_VERSION;
  await prisma.school.update({ where: { id: session.schoolId }, data: { dpaStatus: "SIGNED", dpaVersion: version, dpaAcceptedAt: new Date(), dpaAcceptedById: session.userId } });
  await prisma.auditLog.create({
    data: { schoolId: session.schoolId, actorId: session.userId, action: AuditAction.SETTINGS_UPDATE, entityType: "School", entityId: session.schoolId, metadata: { summary: `Data processing agreement accepted · version ${version}` } },
  });
  return { version };
}
