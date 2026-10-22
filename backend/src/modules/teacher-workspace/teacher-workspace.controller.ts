import { Body, Controller, Delete, Get, Header, Param, ParseIntPipe, Post, Put, Query, Res, UseGuards } from "@nestjs/common";
import type { Response } from "express";
import { ApiTags } from "@nestjs/swagger";

import type { SessionPayload } from "../../../../src/lib/auth/session-core";
import { CsrfGuard } from "../../auth/csrf.guard";
import { CurrentSession } from "../../auth/current-session.decorator";
import { SessionGuard } from "../../auth/session.guard";
import { ok } from "../student-records/records.shared";
import { TeacherCalendarService } from "./calendar.service";
import { MyDayService } from "./day.service";
import { PeriodRegistersService } from "./period-registers.service";
import { RegisterHistoryService } from "./register-history.service";
import { TeacherRemarksService } from "./remarks.service";
import { TeacherScoresService } from "./scores.service";
import { TeacherStudentsService } from "./students.service";
import { TeacherConcernsService } from "./concerns.service";
import { TeacherFamiliesService } from "./families.service";
import { AppraisalService } from "../staff-access/appraisal.service";
import { LeaveService } from "../staff-access/leave.service";
import { TeacherObservationsService } from "./observations.service";
import { LearningService } from "./learning.service";
import { TeacherEmploymentService } from "./employment.service";
import { TeacherNotesService } from "./lesson-notes/notes.service";
import { TeacherSchemeService } from "./lesson-notes/scheme.service";
import { TeacherMessagesService } from "./messages.service";
import { TeacherQuestionsService } from "./questions.service";
import { TeacherTimetableService } from "./timetable.service";
import { TeacherWorkspaceService } from "./workspace.service";

@ApiTags("teacher-workspace")
@Controller("v1/teacher-workspace")
@UseGuards(SessionGuard)
export class TeacherWorkspaceController {
  constructor(private readonly service: TeacherWorkspaceService, private readonly day: MyDayService, private readonly timetable: TeacherTimetableService, private readonly questions: TeacherQuestionsService, private readonly calendar: TeacherCalendarService, private readonly periods: PeriodRegistersService, private readonly history: RegisterHistoryService, private readonly scores: TeacherScoresService, private readonly remarks: TeacherRemarksService, private readonly studentsSvc: TeacherStudentsService, private readonly concerns: TeacherConcernsService, private readonly families: TeacherFamiliesService, private readonly messages: TeacherMessagesService, private readonly scheme: TeacherSchemeService, private readonly notes: TeacherNotesService, private readonly employment: TeacherEmploymentService, private readonly leave: LeaveService, private readonly appraisal: AppraisalService, private readonly learning: LearningService, private readonly observations: TeacherObservationsService) {}

  /** Who this teaching person is, from their real assignments. */
  @Get("me")
  me(@CurrentSession() session: SessionPayload) {
    return ok(this.service.me(session));
  }

  /** The head of department's view: every sheet of the department and who is holding it up. */
  @Get("oversight")
  oversight(@CurrentSession() session: SessionPayload) {
    return ok(this.day.oversight(session));
  }

  /** Their own timetable: today, and the week as a wall chart would show it. */
  @Get("timetable")
  myTimetable(@CurrentSession() session: SessionPayload) {
    return ok(this.timetable.timetable(session));
  }

  /** What they are assigned to, and what each assignment gives them. */
  @Get("teaching")
  teaching(@CurrentSession() session: SessionPayload) {
    return ok(this.timetable.teaching(session));
  }

  /** The questions this person has put to the office about their assignments, and the answers. */
  @Get("questions")
  myQuestions(@CurrentSession() session: SessionPayload) {
    return ok(this.questions.mine(session));
  }

  /** Ask the office about an assignment. A question, not a change. */
  @Post("questions")
  @UseGuards(CsrfGuard)
  ask(@CurrentSession() session: SessionPayload, @Body() body: unknown) {
    return ok(this.questions.ask(session, body));
  }

  /** The school calendar, with each date said in terms of this person's own work. */
  @Get("calendar")
  myCalendar(@CurrentSession() session: SessionPayload) {
    return ok(this.calendar.calendar(session));
  }

  /** The calendar as a file a phone's calendar app can take. */
  @Get("calendar/export")
  @Header("Content-Type", "text/calendar; charset=utf-8")
  @Header("Content-Disposition", 'attachment; filename="term-calendar.ics"')
  exportCalendar(@CurrentSession() session: SessionPayload) {
    return this.calendar.ics(session);
  }

  /** Today's registers: every daily register this person holds, and a period register for each period they teach. */
  @Get("registers")
  async registers(@CurrentSession() session: SessionPayload) {
    return ok(this.service.me(session).then(async (me) => ({ ...(await this.periods.today(session, me)), medianSeconds: await this.history.medianSeconds(session) })));
  }

  /** Every register this person holds, as a list — the Register tab's own index. */
  @Get("register-index")
  registerIndex(@CurrentSession() session: SessionPayload) {
    return ok(this.history.index(session));
  }

  /** The history behind them: an arm's days for a form master, the periods taken for everyone else. */
  @Get("register-history")
  registerHistory(@CurrentSession() session: SessionPayload, @Query("class") classId?: string) {
    return ok(this.history.history(session, classId));
  }

  @Get("period-registers/:classId/:subjectId/:period")
  periodState(@CurrentSession() session: SessionPayload, @Param("classId") classId: string, @Param("subjectId") subjectId: string, @Param("period", ParseIntPipe) period: number, @Query("date") date?: string) {
    return ok(this.periods.state(session, classId, subjectId, period, date));
  }

  @Post("period-registers/:classId/:subjectId/:period/draft")
  @UseGuards(CsrfGuard)
  periodDraft(@CurrentSession() session: SessionPayload, @Param("classId") classId: string, @Param("subjectId") subjectId: string, @Param("period", ParseIntPipe) period: number, @Body() body: unknown) {
    return ok(this.periods.saveDraft(session, classId, subjectId, period, body));
  }

  @Post("period-registers/:classId/:subjectId/:period/submit")
  @UseGuards(CsrfGuard)
  periodSubmit(@CurrentSession() session: SessionPayload, @Param("classId") classId: string, @Param("subjectId") subjectId: string, @Param("period", ParseIntPipe) period: number, @Body() body: unknown) {
    return ok(this.periods.submit(session, classId, subjectId, period, body));
  }

  /** Their own score sheets: one subject-arm is one sheet. */
  @Get("sheets")
  mySheets(@CurrentSession() session: SessionPayload) {
    return ok(this.scores.sheets(session));
  }

  /** The results their sheets produce, subject-arm by subject-arm. */
  @Get("results")
  myResults(@CurrentSession() session: SessionPayload) {
    return ok(this.scores.results(session));
  }

  @Get("results/:classId/:subjectId")
  myResult(@CurrentSession() session: SessionPayload, @Param("classId") classId: string, @Param("subjectId") subjectId: string) {
    return ok(this.scores.result(session, classId, subjectId));
  }

  /** One child in one of their subjects: how the total was reached, and the comment that prints beside it. */
  @Get("results/:classId/:subjectId/students/:studentId")
  myResultStudent(@CurrentSession() session: SessionPayload, @Param("classId") classId: string, @Param("subjectId") subjectId: string, @Param("studentId") studentId: string) {
    return ok(this.scores.student(session, classId, subjectId, studentId));
  }

  @Put("results/:classId/:subjectId/students/:studentId/comment")
  @UseGuards(CsrfGuard)
  saveSubjectComment(@CurrentSession() session: SessionPayload, @Param("classId") classId: string, @Param("subjectId") subjectId: string, @Param("studentId") studentId: string, @Body() body: unknown) {
    return ok(this.scores.saveComment(session, classId, subjectId, studentId, body));
  }

  /** The form class against every subject it takes. */
  @Get("broadsheet/:classId")
  formBroadsheet(@CurrentSession() session: SessionPayload, @Param("classId") classId: string) {
    return ok(this.scores.formBroadsheet(session, classId));
  }

  /** Submit the drafted remarks of the class together. */
  @Post("remarks/submit")
  @UseGuards(CsrfGuard)
  submitRemarks(@CurrentSession() session: SessionPayload, @Body() body: unknown) {
    return ok(this.remarks.submitArm(session, body));
  }

  /** Who the remarks go to. */
  @Get("remarks/recipient")
  remarksRecipient(@CurrentSession() session: SessionPayload) {
    return ok(this.remarks.recipient(session));
  }

  /** The children this person answers for or teaches. */
  @Get("students")
  myStudents(@CurrentSession() session: SessionPayload) {
    return ok(this.studentsSvc.students(session));
  }

  /** Report an incident: it goes to the deputy for administration. A teacher reports; they never read the file. */
  @Post("incidents")
  @UseGuards(CsrfGuard)
  incident(@CurrentSession() session: SessionPayload, @Body() body: unknown) {
    return ok(this.concerns.incident(session, body));
  }

  /** Raise a safeguarding concern: it goes to the safeguarding lead and to nobody else. */
  @Post("concerns")
  @UseGuards(CsrfGuard)
  concern(@CurrentSession() session: SessionPayload, @Body() body: unknown) {
    return ok(this.concerns.concern(session, body));
  }

  /** Ask for a change to a child's record. A request with a reason — the Principal decides it. */
  @Post("record-changes")
  @UseGuards(CsrfGuard)
  recordChange(@CurrentSession() session: SessionPayload, @Body() body: unknown) {
    return ok(this.concerns.change(session, body));
  }

  /** The guardians of the class: a number to call, and nothing more. */
  @Get("guardians")
  myGuardians(@CurrentSession() session: SessionPayload) {
    return ok(this.families.guardians(session));
  }

  /** What the families of the class have sent in. */
  @Get("submissions")
  mySubmissions(@CurrentSession() session: SessionPayload) {
    return ok(this.families.submissions(session));
  }

  @Post("submissions/:id/decide")
  @UseGuards(CsrfGuard)
  decideSubmission(@CurrentSession() session: SessionPayload, @Param("id") id: string, @Body() body: Record<string, unknown>) {
    return ok(this.families.decide(session, id, body));
  }

  /** What a form master needs to compose: the families of their class, the balance, the threshold. */
  @Get("messages/compose")
  composeInfo(@CurrentSession() session: SessionPayload) {
    return ok(this.messages.info(session));
  }

  /** Send to the families of the class. */
  @Post("messages")
  @UseGuards(CsrfGuard)
  sendMessage(@CurrentSession() session: SessionPayload, @Body() body: unknown) {
    return ok(this.messages.send(session, body));
  }

  /** What they have sent. */
  @Get("messages/sent")
  sentMessages(@CurrentSession() session: SessionPayload) {
    return ok(this.messages.sent(session));
  }

  /** "My Day": everything this person owes today, counted from their own assignments. */
  @Get("day")
  myDay(@CurrentSession() session: SessionPayload) {
    return ok(this.day.day(session));
  }

  /* ── Lesson notes: the scheme of work ── */

  @Get("curriculum")
  curriculum(@CurrentSession() session: SessionPayload) {
    return ok(this.scheme.overview(session));
  }

  @Get("curriculum/add/options")
  addSubjectOptions(@CurrentSession() session: SessionPayload) {
    return ok(this.scheme.addOptions(session));
  }

  @Post("curriculum/add")
  @UseGuards(CsrfGuard)
  addSubject(@CurrentSession() session: SessionPayload, @Body() body: unknown) {
    return ok(this.scheme.addSubject(session, body));
  }

  @Post("curriculum/import")
  @UseGuards(CsrfGuard)
  importScheme(@CurrentSession() session: SessionPayload, @Body() body: unknown) {
    return ok(this.scheme.importWeeks(session, body));
  }

  @Get("curriculum/:subjectId")
  schemeOf(@CurrentSession() session: SessionPayload, @Param("subjectId") subjectId: string, @Query("termId") termId?: string) {
    return ok(this.scheme.scheme(session, subjectId, termId));
  }

  @Put("curriculum/:subjectId")
  @UseGuards(CsrfGuard)
  replaceScheme(@CurrentSession() session: SessionPayload, @Param("subjectId") subjectId: string, @Body() body: unknown) {
    return ok(this.scheme.replace(session, subjectId, body));
  }

  @Delete("curriculum/:subjectId")
  @UseGuards(CsrfGuard)
  removeSubject(@CurrentSession() session: SessionPayload, @Param("subjectId") subjectId: string) {
    return ok(this.scheme.removeSubject(session, subjectId));
  }

  @Post("curriculum/:subjectId/catalogue/apply")
  @UseGuards(CsrfGuard)
  catalogueApply(@CurrentSession() session: SessionPayload, @Param("subjectId") subjectId: string, @Body() body: unknown) {
    return ok(this.scheme.applyCatalogue(session, subjectId, body));
  }

  @Post("curriculum/:subjectId/weeks/:week/coverage")
  @UseGuards(CsrfGuard)
  weekCoverage(@CurrentSession() session: SessionPayload, @Param("subjectId") subjectId: string, @Param("week", ParseIntPipe) week: number, @Body() body: unknown) {
    return ok(this.scheme.coverage(session, subjectId, week, body));
  }

  @Post("curriculum/:subjectId/submit")
  @UseGuards(CsrfGuard)
  submitScheme(@CurrentSession() session: SessionPayload, @Param("subjectId") subjectId: string, @Body() body: { termId?: string }) {
    return ok(this.scheme.submit(session, subjectId, body?.termId));
  }

  /* ── Lesson notes: the notes ── */

  @Get("notes")
  lessonNotes(@CurrentSession() session: SessionPayload, @Query("termId") termId?: string) {
    return ok(this.notes.landing(session, termId));
  }

  @Get("notes/review")
  reviewNotes(@CurrentSession() session: SessionPayload) {
    return ok(this.notes.review(session));
  }

  @Post("notes/review/sign")
  @UseGuards(CsrfGuard)
  signNotes(@CurrentSession() session: SessionPayload, @Body() body: unknown) {
    return ok(this.notes.signMany(session, body));
  }

  @Get("notes/review/:planId")
  readNote(@CurrentSession() session: SessionPayload, @Param("planId") planId: string) {
    return ok(this.notes.readNote(session, planId));
  }

  @Post("notes/review/:planId/decide")
  @UseGuards(CsrfGuard)
  decideNote(@CurrentSession() session: SessionPayload, @Param("planId") planId: string, @Body() body: unknown) {
    return ok(this.notes.decide(session, planId, body));
  }

  @Get("notes/coverage")
  coverage(@CurrentSession() session: SessionPayload) {
    return ok(this.notes.coverage(session));
  }

  @Get("notes/coverage/export")
  async exportCoverage(@CurrentSession() session: SessionPayload, @Res() res: Response) {
    const file = await this.notes.exportCoverage(session);
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${file.filename}"`);
    res.send(file.csv);
  }

  @Get("notes/history/:subjectId")
  noteHistory(@CurrentSession() session: SessionPayload, @Param("subjectId") subjectId: string) {
    return ok(this.notes.history(session, subjectId));
  }

  @Get("notes/history/:subjectId/:planId")
  noteHistoryRead(@CurrentSession() session: SessionPayload, @Param("subjectId") subjectId: string, @Param("planId") planId: string) {
    return ok(this.notes.historyNote(session, subjectId, planId));
  }

  @Get("notes/subject/:subjectId")
  subjectNotes(@CurrentSession() session: SessionPayload, @Param("subjectId") subjectId: string, @Query("termId") termId?: string) {
    return ok(this.notes.subject(session, subjectId, termId));
  }

  @Post("notes/subject/:subjectId/submit-drafts")
  @UseGuards(CsrfGuard)
  submitDrafts(@CurrentSession() session: SessionPayload, @Param("subjectId") subjectId: string, @Body() body: { termId?: string }) {
    return ok(this.notes.submitDrafts(session, subjectId, body?.termId));
  }

  @Get("notes/:subjectId/:week")
  note(@CurrentSession() session: SessionPayload, @Param("subjectId") subjectId: string, @Param("week", ParseIntPipe) week: number, @Query("termId") termId?: string) {
    return ok(this.notes.note(session, subjectId, week, termId));
  }

  @Post("notes/:subjectId/:week")
  @UseGuards(CsrfGuard)
  saveNote(@CurrentSession() session: SessionPayload, @Param("subjectId") subjectId: string, @Param("week", ParseIntPipe) week: number, @Body() body: unknown) {
    return ok(this.notes.save(session, subjectId, week, body));
  }

  @Post("notes/:subjectId/:week/submit")
  @UseGuards(CsrfGuard)
  submitNote(@CurrentSession() session: SessionPayload, @Param("subjectId") subjectId: string, @Param("week", ParseIntPipe) week: number, @Body() body: unknown) {
    return ok(this.notes.submit(session, subjectId, week, body));
  }

  @Post("notes/:subjectId/:week/withdraw")
  @UseGuards(CsrfGuard)
  withdrawNote(@CurrentSession() session: SessionPayload, @Param("subjectId") subjectId: string, @Param("week", ParseIntPipe) week: number, @Body() body: { termId?: string }) {
    return ok(this.notes.withdraw(session, subjectId, week, body?.termId));
  }

  @Post("notes/:subjectId/:week/revise")
  @UseGuards(CsrfGuard)
  reviseNote(@CurrentSession() session: SessionPayload, @Param("subjectId") subjectId: string, @Param("week", ParseIntPipe) week: number, @Body() body: { termId?: string }) {
    return ok(this.notes.revise(session, subjectId, week, body?.termId));
  }

  /* ── My Employment ── */

  @Get("employment/leave")
  myLeave(@CurrentSession() session: SessionPayload) {
    return ok(this.leave.mine(session));
  }

  @Post("employment/leave")
  @UseGuards(CsrfGuard)
  requestLeave(@CurrentSession() session: SessionPayload, @Body() body: unknown) {
    return ok(this.leave.request(session, body));
  }

  @Post("employment/leave/:id/withdraw")
  @UseGuards(CsrfGuard)
  withdrawLeave(@CurrentSession() session: SessionPayload, @Param("id") id: string) {
    return ok(this.leave.withdraw(session, id));
  }

  @Get("employment/assignments")
  myAssignments(@CurrentSession() session: SessionPayload) {
    return ok(this.employment.assignments(session));
  }

  @Post("employment/absence")
  @UseGuards(CsrfGuard)
  reportAbsence(@CurrentSession() session: SessionPayload, @Body() body: unknown) {
    return ok(this.employment.reportAbsence(session, body));
  }

  @Get("cover/gaps")
  coverGaps(@CurrentSession() session: SessionPayload) {
    return ok(this.employment.gaps(session));
  }

  @Post("cover")
  @UseGuards(CsrfGuard)
  assignCover(@CurrentSession() session: SessionPayload, @Body() body: unknown) {
    return ok(this.employment.assignCover(session, body));
  }

  @Post("cover/:id/end")
  @UseGuards(CsrfGuard)
  endCover(@CurrentSession() session: SessionPayload, @Param("id") id: string) {
    return ok(this.employment.endCover(session, id));
  }

  @Get("employment/appraisal")
  myAppraisal(@CurrentSession() session: SessionPayload) {
    return ok(this.appraisal.mine(session));
  }

  @Post("employment/appraisal/self")
  @UseGuards(CsrfGuard)
  saveSelf(@CurrentSession() session: SessionPayload, @Body() body: { submit?: boolean } & Record<string, unknown>) {
    const { submit, ...rest } = body ?? {};
    return ok(this.appraisal.saveSelf(session, rest, Boolean(submit)));
  }

  @Post("employment/appraisal/respond")
  @UseGuards(CsrfGuard)
  respondAppraisal(@CurrentSession() session: SessionPayload, @Body() body: unknown) {
    return ok(this.appraisal.respond(session, body));
  }

  @Get("employment/payslips")
  myPayslips(@CurrentSession() session: SessionPayload) {
    return ok(this.employment.payslips(session));
  }

  @Post("employment/documents")
  @UseGuards(CsrfGuard)
  addDocument(@CurrentSession() session: SessionPayload, @Body() body: unknown) {
    return ok(this.employment.addDocument(session, body));
  }

  /* ── Training ── */

  @Get("learning/home")
  learningHome(@CurrentSession() session: SessionPayload) {
    return ok(this.learning.home(session));
  }

  @Get("learning/catalogue")
  learningCatalogue(@CurrentSession() session: SessionPayload) {
    return ok(this.learning.catalogue(session));
  }

  @Get("learning/certificates")
  learningCertificates(@CurrentSession() session: SessionPayload) {
    return ok(this.learning.certificates(session));
  }

  @Get("learning/courses/:id")
  learningCourse(@CurrentSession() session: SessionPayload, @Param("id") id: string) {
    return ok(this.learning.course(session, id));
  }

  @Get("learning/courses/:id/lessons/:position")
  learningLesson(@CurrentSession() session: SessionPayload, @Param("id") id: string, @Param("position", ParseIntPipe) position: number) {
    return ok(this.learning.lesson(session, id, position));
  }

  @Post("learning/courses/:id/lessons/:position/answer")
  @UseGuards(CsrfGuard)
  learningAnswer(@CurrentSession() session: SessionPayload, @Param("id") id: string, @Param("position", ParseIntPipe) position: number, @Body() body: unknown) {
    return ok(this.learning.answer(session, id, position, body));
  }

  @Post("learning/certificates")
  @UseGuards(CsrfGuard)
  learningExternal(@CurrentSession() session: SessionPayload, @Body() body: unknown) {
    return ok(this.learning.addExternal(session, body));
  }

  @Post("learning/suggestions")
  @UseGuards(CsrfGuard)
  learningSuggest(@CurrentSession() session: SessionPayload, @Body() body: unknown) {
    return ok(this.learning.suggest(session, body));
  }

  /* ── Early years: observations ── */

  @Get("observations")
  observationsList(@CurrentSession() session: SessionPayload) {
    return ok(this.observations.list(session));
  }

  @Get("observations/summary")
  observationsSummary(@CurrentSession() session: SessionPayload) {
    return ok(this.observations.summary(session));
  }

  @Get("observations/photo/:id/:index")
  async observationPhoto(@CurrentSession() session: SessionPayload, @Param("id") id: string, @Param("index", ParseIntPipe) index: number, @Res() response: Response) {
    const photo = await this.observations.photo(session, id, index);
    response.setHeader("Content-Type", photo.type);
    response.setHeader("Cache-Control", "private, max-age=300");
    response.send(photo.bytes);
  }

  @Get("observations/:studentId")
  observationsChild(@CurrentSession() session: SessionPayload, @Param("studentId") studentId: string) {
    return ok(this.observations.child(session, studentId));
  }

  @Post("observations/:studentId")
  @UseGuards(CsrfGuard)
  observationsSave(@CurrentSession() session: SessionPayload, @Param("studentId") studentId: string, @Body() body: unknown) {
    return ok(this.observations.save(session, studentId, body));
  }
}
