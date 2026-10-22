import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";

import type { SessionPayload } from "../../../../src/lib/auth/session-core";
import { prisma } from "../../../../src/lib/db/prisma";
import { isTeachingRole, personaLabels, type TeachingPersona } from "../../../../src/lib/modules/teacher-workspace";
import { activeCovers } from "../../common/teaching-scope";
import { armName, fullName } from "../fee-management/fees.shared";
import { initials } from "../student-records/records.shared";

const DAY = 86_400_000;
const EARLY_YEARS = new Set(["CRECHE", "NURSERY"]);

export type Hat = { role: string; scope: string; detail: string };

/**
 * Who a teaching person is, read from what they are really assigned to — never from a switch. A form master is whoever is named
 * on an arm; a subject teacher is whoever is named on a subject-arm; a head of department holds the role; an early-years teacher is
 * the class teacher of an early-years arm. Everything the teacher's pages say about "your arms" and "your sheets" is derived from
 * this, so no two pages can describe a different teacher.
 */
@Injectable()
export class TeacherWorkspaceService {
  async me(session: SessionPayload) {
    if (!isTeachingRole(session.role)) throw new ForbiddenException("The teaching workspace is for teaching staff.");
    const user = await prisma.user.findFirst({
      where: { id: session.userId, schoolId: session.schoolId, deletedAt: null },
      include: { staffProfile: { include: { department: true } } }
    });
    if (!user) throw new NotFoundException("This account was not found.");

    const [formArms, assistantArms, subjectArms, term, covers] = await Promise.all([
      prisma.classRoom.findMany({ where: { schoolId: session.schoolId, classTeacherId: user.id, isActive: true, deletedAt: null }, include: { classLevel: true, _count: { select: { students: { where: { status: "ACTIVE" } } } } }, orderBy: { displayOrder: "asc" } }),
      prisma.classRoom.findMany({ where: { schoolId: session.schoolId, assistantClassTeacherId: user.id, isActive: true, deletedAt: null }, include: { classLevel: true, _count: { select: { students: { where: { status: "ACTIVE" } } } } }, orderBy: { displayOrder: "asc" } }),
      prisma.classSubject.findMany({ where: { schoolId: session.schoolId, isActive: true, OR: [{ teacherId: user.id }, { assistantTeacherId: user.id }] }, include: { subject: true, classRoom: { include: { classLevel: true } } }, orderBy: [{ subject: { name: "asc" } }] }),
      prisma.term.findFirst({ where: { schoolId: session.schoolId, isCurrent: true }, include: { academicSession: { select: { name: true } } } }),
      activeCovers(session.schoolId, session.userId)
    ]);

    const isHod = user.role === "HEAD_OF_DEPARTMENT";
    const earlyYears = formArms.some((arm) => EARLY_YEARS.has(String(arm.classLevel.schoolSection ?? "")) || arm.classLevel.section === "NURSERY");
    const coverRows = covers.filter((row) => row.subjectId && row.scope !== "REGISTER");
    const coverSubjects = coverRows.length
      ? await prisma.classSubject.findMany({ where: { schoolId: session.schoolId, isActive: true, OR: coverRows.map((row) => ({ classId: row.classId, subjectId: row.subjectId! })) }, include: { subject: true, classRoom: { include: { classLevel: true } } } })
      : [];
    const coverArms = covers.filter((row) => !row.subjectId);
    const coverRoomRows = coverArms.length ? await prisma.classRoom.findMany({ where: { id: { in: coverArms.map((row) => row.classId) } }, include: { classLevel: true, _count: { select: { students: { where: { status: "ACTIVE" } } } } } }) : [];

    const teaching = [
      ...subjectArms.map((row) => ({
        classId: row.classId, subjectId: row.subjectId, subject: row.subject.name, arm: armName(row.classRoom), periods: row.periodsPerWeek ?? row.subject.periodsPerWeek,
        assistant: row.teacherId !== user.id, basis: "Substantive" as "Substantive" | "Cover", until: null as string | null
      })),
      ...coverSubjects.filter((row) => !subjectArms.some((own) => own.id === row.id)).map((row) => ({
        classId: row.classId, subjectId: row.subjectId, subject: row.subject.name, arm: armName(row.classRoom), periods: row.periodsPerWeek ?? row.subject.periodsPerWeek,
        assistant: false, basis: "Cover" as "Substantive" | "Cover", until: coverRows.find((cover) => cover.classId === row.classId && cover.subjectId === row.subjectId)?.endsOn.toISOString() ?? null
      }))
    ];
    const ownRows = teaching.filter((row) => row.basis === "Substantive" && !row.assistant);
    // A person the school has made a Cover / Substitute or a Teaching Assistant is that, whatever they currently hold; everyone else is read from what they hold.
    const persona: TeachingPersona = user.role === "COVER_TEACHER" ? "cover" : user.role === "TEACHING_ASSISTANT" ? "teaching-assistant" : earlyYears ? "early-years" : isHod ? "head-of-department" : formArms.length ? "form-master" : ownRows.length ? "subject-teacher" : covers.length ? "cover" : assistantArms.length || teaching.some((row) => row.assistant) ? "teaching-assistant" : "subject-teacher";

    const department = user.staffProfile?.department ?? null;
    const hats: Hat[] = [];
    if (isHod && department) hats.push({ role: "Head of Department", scope: department.name, detail: "Review what the department submits — never your own" });
    for (const arm of formArms) hats.push({ role: earlyYears ? "Class Teacher" : "Form Master", scope: armName(arm), detail: earlyYears ? "The daily register, the observations, the remarks and this class’s families" : "The daily register, the remarks and this arm’s guardians" });
    if (teaching.length) {
      const subjects = [...new Set(teaching.map((row) => row.subject))];
      hats.push({ role: "Subject Teacher", scope: `${subjects.join(", ")} · ${teaching.map((row) => row.arm).join(", ")}`, detail: "Enter and submit scores, mark your period registers, read your own results" });
    }
    for (const cover of covers) {
      const room = coverRoomRows.find((entry) => entry.id === cover.classId);
      const row = coverSubjects.find((entry) => entry.classId === cover.classId && entry.subjectId === cover.subjectId);
      hats.push({ role: "Cover", scope: row ? `${row.subject.name} · ${armName(row.classRoom)}` : room ? armName(room) : "An arm", detail: `${cover.scope === "REGISTER" ? "The register" : "The register and score entry"} · ends ${cover.endsOn.toISOString().slice(0, 10)} — nothing carries past it` });
    }
    for (const arm of assistantArms) hats.push({ role: "Assistant form master", scope: armName(arm), detail: "Read its report cards · no register, no remarks" });

    /* who their own submissions go to: their head of department, else the academic lead, else the principal */
    const lead = async (roles: string[], departmentId?: string | null) =>
      prisma.user.findFirst({
        where: { schoolId: session.schoolId, id: { not: user.id }, isActive: true, deletedAt: null, role: { in: roles as never[] }, ...(departmentId ? { staffProfile: { departmentId } } : {}) },
        select: { firstName: true, lastName: true, role: true, jobTitle: true }
      });
    const above = (!isHod && department ? await lead(["HEAD_OF_DEPARTMENT"], department.id) : null) ?? (await lead(["VICE_PRINCIPAL_ACADEMICS"])) ?? (await lead(["PRINCIPAL", "HEAD_TEACHER"]));
    const reportsTo = above ? { name: fullName(above), title: above.jobTitle ?? above.role.replaceAll("_", " ").toLowerCase().replace(/^./, (c) => c.toUpperCase()) } : null;

    const now = Date.now();
    const weeks = term ? Math.max(1, Math.ceil((term.endDate.getTime() - term.startDate.getTime()) / (7 * DAY))) : 0;
    const week = term ? Math.min(weeks, Math.max(1, Math.floor((now - term.startDate.getTime()) / (7 * DAY)) + 1)) : 0;

    const name = fullName(user);
    return {
      persona,
      personaLabel: personaLabels[persona],
      person: {
        id: user.id,
        name,
        initials: initials(name),
        role: user.role,
        title: user.jobTitle ?? user.staffProfile?.designation ?? personaLabels[persona],
        employeeNo: user.staffProfile?.employeeNo ?? null,
        email: user.email,
        phone: user.phone ?? null,
        joined: user.staffProfile?.employmentDate?.toISOString() ?? null
      },
      department: department ? { id: department.id, name: department.name } : null,
      reportsTo,
      term: term ? { id: term.id, name: term.name, session: term.academicSession.name, startsOn: term.startDate.toISOString(), endsOn: term.endDate.toISOString(), week, weeks } : null,
      formArms: formArms.map((arm) => ({ id: arm.id, name: armName(arm), roll: arm._count.students, earlyYears: EARLY_YEARS.has(String(arm.classLevel.schoolSection ?? "")) })),
      assistantArms: assistantArms.map((arm) => ({ id: arm.id, name: armName(arm), roll: arm._count.students })),
      teaching,
      hats
    };
  }
}
