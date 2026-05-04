import { Controller, ForbiddenException, Get, Param, Res, UseGuards } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import type { Response } from "express";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

import type { SessionPayload } from "../../../../src/lib/auth/session-core";
import { prisma } from "../../../../src/lib/db/prisma";
import { buildReportCardPdf } from "../../../../src/lib/pdf/report-card";
import { formatNigeriaClassName } from "../../../../src/lib/school-options";
import { CurrentSession } from "../../auth/current-session.decorator";
import { RolesGuard } from "../../auth/roles.guard";
import { Roles } from "../../auth/roles.decorator";
import { SessionGuard } from "../../auth/session.guard";

const broadsheetExportRoles = [
  "SUPER_ADMIN",
  "SCHOOL_OWNER",
  "PROPRIETOR",
  "ADMINISTRATOR",
  "PRINCIPAL",
  "HEAD_TEACHER",
  "VICE_PRINCIPAL_ACADEMICS",
  "ADMIN_OFFICER",
  "EXAM_OFFICER",
  "EXAMINATION_OFFICER",
  "HEAD_OF_DEPARTMENT",
  "CLASS_TEACHER"
] as const;

const reportCardRoles = [
  "SUPER_ADMIN",
  "SCHOOL_OWNER",
  "PRINCIPAL",
  "VICE_PRINCIPAL_ACADEMICS",
  "ADMIN_OFFICER",
  "HEAD_OF_DEPARTMENT",
  "TEACHER",
  "CLASS_TEACHER",
  "SUBJECT_TEACHER",
  "EXAM_OFFICER",
  "EXAMINATION_OFFICER",
  "PARENT",
  "STUDENT"
] as const;

@ApiTags("reports")
@Controller("v1/reports")
@UseGuards(SessionGuard, RolesGuard)
export class ReportsController {
  @Get("broadsheet/:broadsheetId/pdf")
  @Roles(...broadsheetExportRoles)
  async broadsheetPdf(@CurrentSession() session: SessionPayload, @Param("broadsheetId") broadsheetId: string, @Res() response: Response) {
    const broadsheet = await this.loadBroadsheetForExport(session, broadsheetId);
    const rows = broadsheet.rows.slice(0, 24);
    const pdf = await PDFDocument.create();
    const page = pdf.addPage([842, 595]);
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const boldFont = await pdf.embedFont(StandardFonts.HelveticaBold);

    page.drawRectangle({ x: 0, y: 535, width: 842, height: 60, color: rgb(0.14, 0.35, 0.25) });
    page.drawText(`${broadsheet.className} Broadsheet`, { x: 36, y: 562, size: 20, font: boldFont, color: rgb(1, 1, 1) });
    page.drawText(`${broadsheet.term}${broadsheet.session ? ` · ${broadsheet.session}` : ""}`, { x: 36, y: 544, size: 11, font, color: rgb(0.92, 0.94, 0.93) });

    const headers = ["Student", "Admission No", "Average", "Position", "Promotion"];
    [36, 250, 390, 470, 550].forEach((x, index) => page.drawText(headers[index], { x, y: 505, size: 10, font: boldFont, color: rgb(0.1, 0.13, 0.12) }));
    rows.forEach((row, index) => {
      const y = 480 - index * 18;
      page.drawText(row.studentName.slice(0, 30), { x: 36, y, size: 9, font });
      page.drawText((row.admissionNumber ?? "-").slice(0, 18), { x: 250, y, size: 9, font });
      page.drawText(`${row.average}%`, { x: 390, y, size: 9, font });
      page.drawText(`${row.position ?? "-"}`, { x: 470, y, size: 9, font });
      page.drawText((row.promotionStatus ?? "Pending").slice(0, 40), { x: 550, y, size: 9, font });
    });

    const bytes = await pdf.save();
    response.setHeader("Content-Type", "application/pdf");
    response.setHeader("Content-Disposition", `inline; filename="${broadsheet.className.replaceAll(" ", "_")}_broadsheet.pdf"`);
    response.end(Buffer.from(bytes));
  }

  @Get("broadsheet/:broadsheetId/csv")
  @Roles(...broadsheetExportRoles)
  async broadsheetCsv(@CurrentSession() session: SessionPayload, @Param("broadsheetId") broadsheetId: string, @Res() response: Response) {
    const broadsheet = await this.loadBroadsheetForExport(session, broadsheetId);
    const rows = this.buildBroadsheetExportRows(broadsheet);
    const csv = rows.map((row) => row.map((cell) => `"${cell.replaceAll('"', '""')}"`).join(",")).join("\n");
    response.setHeader("Content-Type", "text/csv; charset=utf-8");
    response.setHeader("Content-Disposition", `attachment; filename="${broadsheet.className.replaceAll(" ", "_")}_broadsheet.csv"`);
    response.send(csv);
  }

  @Get("broadsheet/:broadsheetId/excel")
  @Roles(...broadsheetExportRoles)
  async broadsheetExcel(@CurrentSession() session: SessionPayload, @Param("broadsheetId") broadsheetId: string, @Res() response: Response) {
    const broadsheet = await this.loadBroadsheetForExport(session, broadsheetId);
    const rows = this.buildBroadsheetExportRows(broadsheet);
    const html = `<!doctype html><html><head><meta charset="utf-8" /></head><body><table>${rows
      .map((row, index) => {
        const tag = index === 0 ? "th" : "td";
        return `<tr>${row.map((cell) => `<${tag}>${this.escapeHtml(cell)}</${tag}>`).join("")}</tr>`;
      })
      .join("")}</table></body></html>`;

    response.setHeader("Content-Type", "application/vnd.ms-excel; charset=utf-8");
    response.setHeader("Content-Disposition", `attachment; filename="${broadsheet.className.replaceAll(" ", "_")}_broadsheet.xls"`);
    response.send(html);
  }

  @Get("report-card/:studentId")
  @Roles(...reportCardRoles)
  async reportCard(
    @CurrentSession() session: SessionPayload,
    @Param("studentId") studentId: string,
    @Res() response: Response
  ) {
    const student = await prisma.student.findFirstOrThrow({
      where: {
        id: studentId,
        schoolId: session.schoolId,
        ...(session.role === "STUDENT" ? { userId: session.userId } : {}),
        ...(session.role === "PARENT"
          ? { guardians: { some: { guardian: { schoolId: session.schoolId, userId: session.userId } } } }
          : {})
      },
      include: {
        currentClass: true,
        resultSheets: {
          ...(session.role === "STUDENT" || session.role === "PARENT"
            ? { where: { status: "PUBLISHED" as const, publishedAt: { not: null } } }
            : {}),
          orderBy: { publishedAt: "desc" },
          include: {
            term: { include: { academicSession: true } },
            scoreEntries: {
              include: {
                subject: true,
                assessmentComponent: true
              }
            }
          }
        },
        attendance: {
          select: {
            status: true
          }
        },
        invoices: {
          select: {
            balance: true
          }
        },
        guardians: {
          include: {
            guardian: true
          }
        }
      }
    });

    if (session.role === "STUDENT" && student.userId !== session.userId) {
      throw new ForbiddenException("Students can only download their own report card.");
    }

    const latestSheet = student.resultSheets[0];
    if ((session.role === "STUDENT" || session.role === "PARENT") && (!latestSheet?.publishedAt || latestSheet.status !== "PUBLISHED")) {
      throw new ForbiddenException("Report card is available only after result publication.");
    }
    const gradeMap = new Map<string, { subject: string; ca: number; exam: number; total: number; grade: string }>();

    latestSheet?.scoreEntries.forEach((entry) => {
      const key = entry.subjectId;
      const existing = gradeMap.get(key) ?? {
        subject: entry.subject.name,
        ca: 0,
        exam: 0,
        total: 0,
        grade: latestSheet.grade ?? "N/A"
      };
      if (entry.assessmentComponent.code === "CA") existing.ca = entry.score;
      if (entry.assessmentComponent.code === "EXAM") existing.exam = entry.score;
      existing.total = existing.ca + existing.exam;
      gradeMap.set(key, existing);
    });

    const bytes = await buildReportCardPdf({
      schoolName: "FutureRealm SMS School",
      student: {
        id: student.id,
        admissionNumber: student.admissionNumber,
        fullName: `${student.firstName} ${student.lastName}`,
        className: student.currentClass
          ? formatNigeriaClassName(student.currentClass.arm ? `${student.currentClass.name} - ${student.currentClass.arm}` : student.currentClass.name)
          : "Unassigned",
        guardianName: student.guardians[0]?.guardian.firstName ?? "No guardian",
        status: student.status,
        attendanceRate:
          student.attendance.length === 0
            ? 0
            : (student.attendance.filter((item) => item.status !== "ABSENT").length /
                student.attendance.length) *
              100,
        averageScore: Number(latestSheet?.averageScore ?? 0),
        outstandingBalance: student.invoices.reduce((sum, invoice) => sum + Number(invoice.balance), 0)
      },
      sessionLabel: latestSheet?.term.academicSession.name ?? "Current Session",
      termLabel: latestSheet?.term.name ?? "Current Term",
      grades: Array.from(gradeMap.entries()).map(([key, value]) => ({
        id: key,
        studentId: student.id,
        studentName: `${student.firstName} ${student.lastName}`,
        className: student.currentClass
          ? formatNigeriaClassName(student.currentClass.arm ? `${student.currentClass.name} - ${student.currentClass.arm}` : student.currentClass.name)
          : "Unassigned",
        subject: value.subject,
        continuousAssessment: value.ca,
        exam: value.exam,
        total: value.total,
        grade: value.grade
      }))
    });

    response.setHeader("Content-Type", "application/pdf");
    response.setHeader(
      "Content-Disposition",
      `inline; filename="${student.firstName}_${student.lastName}_report_card.pdf"`
    );
    response.end(Buffer.from(bytes));
  }

  private async loadBroadsheetForExport(session: SessionPayload, broadsheetId: string) {
    const broadsheet = await prisma.broadsheet.findFirstOrThrow({
      where: { id: broadsheetId, schoolId: session.schoolId },
      include: { classRoom: true, term: { include: { academicSession: true } } }
    });
    const data = broadsheet.data as {
      rows?: Array<{
        studentName: string;
        admissionNumber?: string;
        average: number;
        position?: number;
        promotionStatus?: string;
        subjects?: Array<{ subject: string; total: number; grade: string }>;
      }>;
    };
    return {
      className: broadsheet.classRoom ? formatNigeriaClassName(broadsheet.classRoom.arm ? `${broadsheet.classRoom.name} - ${broadsheet.classRoom.arm}` : broadsheet.classRoom.name) : "Broadsheet",
      term: broadsheet.term.name,
      session: broadsheet.term.academicSession?.name,
      rows: data.rows ?? []
    };
  }

  private buildBroadsheetExportRows(broadsheet: Awaited<ReturnType<ReportsController["loadBroadsheetForExport"]>>) {
    const subjects = Array.from(new Set(broadsheet.rows.flatMap((row) => row.subjects?.map((subject) => subject.subject) ?? [])));
    return [
      ["Student", "Admission Number", ...subjects, "Average", "Position", "Promotion Status"],
      ...broadsheet.rows.map((row) => [
        row.studentName,
        row.admissionNumber ?? "",
        ...subjects.map((subjectName) => {
          const subject = row.subjects?.find((item) => item.subject === subjectName);
          return subject ? `${subject.total} (${subject.grade})` : "";
        }),
        String(row.average),
        String(row.position ?? ""),
        row.promotionStatus ?? ""
      ])
    ];
  }

  private escapeHtml(value: string) {
    return value
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  }
}
