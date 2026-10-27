import { Controller, Get, Module, Post, UseGuards } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";

import type { SessionPayload } from "../../../../src/lib/auth/session-core";
import { prisma } from "../../../../src/lib/db/prisma";
import { CsrfGuard } from "../../auth/csrf.guard";
import { CurrentSession } from "../../auth/current-session.decorator";
import { SessionGuard } from "../../auth/session.guard";
import { ok } from "../student-records/records.shared";
import { decideNotice } from "../../../../src/lib/staff-notices";
import type { Preferences } from "../../../../src/lib/preferences";

/** Where each kind of notice opens. Matched on the title, so every service that writes one stays a one-liner. */
const DESTINATIONS: Array<[RegExp, string]> = [
  [/lesson note is waiting/i, "/lesson-notes/review"],
  [/lesson note was (signed|returned)/i, "/lesson-notes/notes"],
  [/leave is waiting/i, "/approvals-workflow/queue"],
  [/asked the office/i, "/approvals-workflow/queue"],
  [/teacher is absent/i, "/my-employment/my-assignments"],
  [/given cover/i, "/my-employment/my-assignments"],
  [/safeguarding concern has been raised|urgent safeguarding/i, "/student-records/changes"],
  [/self-assessment is ready/i, "/staff-access/appraisal"],
  [/certificate was (verified|not accepted)/i, "/training/certificates"],
  [/remarks submitted/i, "/report-cards/completion"],
  [/truancy alert/i, "/attendance/register"],
  [/record change requested/i, "/student-records/changes"],
  [/incident reported/i, "/student-records/registry"]
];

/**
 * A person's own notices — the same feed for a teacher, a head of department, a principal or a counsellor. Anything the product tells
 * somebody (a leave request waiting, a note to sign, cover given, a concern raised) lands here and links to where it is dealt with,
 * so no flow between the portals ends in a message nobody can see.
 */
@ApiTags("notifications")
@Controller("v1/notifications")
@UseGuards(SessionGuard)
export class NotificationsController {
  @Get("mine")
  mine(@CurrentSession() session: SessionPayload) {
    return ok(
      Promise.all([
        prisma.notificationLog.findMany({ where: { schoolId: session.schoolId, channel: "IN_APP", OR: [{ userId: session.userId }, { userId: null }] }, orderBy: { sentAt: "desc" }, take: 50 }),
        prisma.user.findUnique({ where: { id: session.userId }, select: { preferences: true } }),
      ]).then(([all, me]) => {
        // What this person asked not to hear about (Preferences → What reaches me) is left out of their bell; emergencies never are.
        const chosen = (me?.preferences as Preferences | null) ?? null;
        return all.filter((row) => decideNotice(chosen, { channel: "IN_APP", title: row.title, urgency: typeof (row.metadata as { urgency?: unknown } | null)?.urgency === "string" ? (row.metadata as { urgency: string }).urgency : null }) !== "suppress");
      }).then((rows) =>
        rows.map((row) => ({ id: row.id, title: row.title, body: row.body, status: row.status, sentAt: row.sentAt?.toISOString() ?? null, href: DESTINATIONS.find(([pattern]) => pattern.test(row.title))?.[1] ?? null }))
      )
    );
  }

  @Post("read")
  @UseGuards(CsrfGuard)
  read(@CurrentSession() session: SessionPayload) {
    return ok(prisma.notificationLog.updateMany({ where: { schoolId: session.schoolId, userId: session.userId, channel: "IN_APP", status: { not: "READ" } }, data: { status: "READ" } }).then((result) => ({ marked: result.count })));
  }
}

@Module({ controllers: [NotificationsController] })
export class NotificationsModule {}
