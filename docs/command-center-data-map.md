# Command Center → backend → database

Every component on M01 Command Center, the endpoint that should feed it, and the
query behind that endpoint.

Today the module renders entirely from the in-repo derived layers
(`src/lib/modules/school-data.ts`, `fees-data.ts`, `decisions.ts`). Nothing on
either tab calls the API. This document is the map from each component to the
data that should replace those layers.

**Status column:** ✅ endpoint exists and returns this · ◑ endpoint exists but
does not return this yet · ❌ nothing exists.

Every query below is implicitly scoped `where: { schoolId }` from the session,
and to the current term where a term applies. That scoping is not repeated per
row.

---

## Tab 1 · Today

### KPI row — 6 cards

| # | Card | Status | Endpoint | Query |
|---|---|---|---|---|
| 1 | Total students | ✅ | `GET /v1/dashboard/overview` | `student.count({ where: { status: "ACTIVE" } })`. The card's sub ("+14 this term · 3 withdrawals") needs two more: `student.count({ where: { createdAt: { gte: term.startDate } } })` and `student.count({ where: { status: "WITHDRAWN", updatedAt: { gte: term.startDate } } })`. |
| 2 | Attendance today | ◑ | `GET /v1/dashboard/overview` | Percentage: `studentAttendance.groupBy({ by: ["status"], where: { date: today } })` — already fetched. **Missing:** "N of 42 classes unmarked" needs `classRoom.count()` minus `studentAttendance.groupBy({ by: ["classId"], where: { date: today } })._count`. |
| 3 | Collected this term | ✅ | `GET /v1/dashboard/overview` | `invoice.aggregate({ _sum: { total: true, balance: true }, where: { status: { not: "VOID" } } })`. Collected = `total − balance`. |
| 4 | Score submissions | ❌ | `GET /v1/dashboard/overview` (extend) | `resultSheet.groupBy({ by: ["status"], where: { termId } })`. "38 of 54" = sheets not `DRAFT` over total expected; "7 returned" = count where `status: "RETURNED"`. |
| 5 | Message credits | ❌ | `GET /v1/dashboard/overview` (extend) | `notificationWallet.findUnique({ where: { schoolId } })` → `smsBalance`, `lowBalanceThreshold`. |
| 6 | Sync depth | ❌ | `GET /v1/dashboard/overview` (extend) | `syncDraft.count({ where: { userId: session.userId, syncedAt: null } })`; "last synced" = `syncDraft.findFirst({ where: { userId }, orderBy: { syncedAt: "desc" } })`. |

**Recommendation:** cards 4–6 belong on the existing `overview` response rather
than three new endpoints. It is already cached for 15s and already does a
`Promise.all`, so they cost one round trip, not four.

---

### Table · "My actions"

Six decisions routed to the signed-in user: score correction, fee waiver,
results approval, record change, access grant, communication above threshold.

| Status | Endpoint | Query |
|---|---|---|
| ❌ | `GET /v1/approvals/queue?assignee=me` | See below — this is the one real gap. |

There is **no general approval queue** in the schema. The six decision kinds
live in five unrelated places:

| Decision kind | Model that holds it | Query |
|---|---|---|
| Score correction / results | `ResultSheet` + `ResultApproval` | `resultSheet.findMany({ where: { status: { in: ["SUBMITTED", "UNDER_REVIEW"] } }, include: { student, classRoom, createdBy } })` |
| Fee waiver | `FeeWaiver` | `feeWaiver.findMany({ where: { status: "PENDING" } })` |
| Record change | `DataCorrectionRecord`, `ProfileEditRequest` | `profileEditRequest.findMany({ where: { status: "PENDING" } })` |
| Access grant | — | no model; staff access changes are applied directly |
| Communication above threshold | — | no model; the 150-recipient threshold is a policy with nothing persisting a held send |
| Leave | `LeaveRequest` | `leaveRequest.findMany({ where: { status: "PENDING" } })` |

**Recommendation:** add one `ApprovalRequest` model — `{ schoolId, kind, subjectType, subjectId, requestedById, assigneeRole, assigneeId, status, blocking, raisedAt, decidedAt, decidedById, reason }` — written by whichever service raises the decision, and have the queue read that single table. Without it, "My actions" is a six-way union that has to be re-sorted by priority and age in application code on every page load, and two of the six kinds have nowhere to come from at all.

The `blocking` column ("1 teacher · 34 cards") is the count the decision
unblocks and should be denormalised onto the row at raise time; recomputing it
per render means a query per decision.

---

### Tiles · "Quick actions"

| Status | Endpoint | Query |
|---|---|---|
| n/a | none | Navigation only — four links to other modules. The sub-labels are live counts ("38 of 54 sheets in") and should reuse KPI 4 rather than query again. |

---

### List · "Term progress" — 5 milestones

| Status | Endpoint | Query |
|---|---|---|
| ◑ | `GET /v1/dashboard/context` (extend) | `term.findFirst({ where: { isCurrent: true } })` already returns the term. The five milestones — CA window closed, examination week, submission deadline, publication, term close — are **calendar events**, not derived state. |

The milestone dates need a source. `Term` carries start and end only. Either
add an `AcademicCalendarEvent` model (`{ schoolId, termId, kind, name, startsOn,
endsOn, state }`) or read the assessment windows M02 Calendar already defines.
The second is better: one calendar, two readers.

State per milestone is derived, not stored: `startsOn < now < endsOn` → in
progress; `endsOn < now` → closed.

---

### List · "Activity" — 4 recent entries

| Status | Endpoint | Query |
|---|---|---|
| ◑ | `GET /v1/audit/recent?take=4` | `auditLog.findMany({ orderBy: { createdAt: "desc" }, take: 4, include: { actor: { select: { firstName, lastName, role } } } })` |

The model and its indexes exist (`@@index([schoolId, action, createdAt])`, which
this query uses). What's missing is a **school-facing** read endpoint — the
audit surface today is under `super-admin`. Add it under `v1` with a permission
check, because a principal must see their own school's log without platform
access.

The rendered sentence ("Mrs Folake Adeniyi approved 12 score sheets") is a
summary of several rows. Either group by `(actorId, action, entityType)` within
a window, or write a summary line into `metadata` at audit time. Grouping is
cheaper to build and does not change what is already recorded.

---

## Tab 2 · Oversight

### KPI row — 4 cards

| # | Card | Status | Endpoint | Query |
|---|---|---|---|---|
| 1 | Cards that would generate now | ❌ | `GET /v1/report-cards/readiness` | `reportCard.count({ where: { termId, status: { not: "DRAFT" } } })`, or for un-generated cards: students whose every `resultSheet` for the term is `APPROVED`. |
| 2 | Cards blocked | ❌ | same | The complement — students with at least one sheet not `APPROVED`, or a subject-arm with no teacher. |
| 3 | People holding it up | ❌ | same | `distinct` count of the owners behind those blockers. |
| 4 | Days of slack left | ◑ | `GET /v1/dashboard/context` | Publication date minus today. Needs the calendar above. |

**Recommendation:** one `readiness` endpoint returning all four plus the blocker
breakdown below, because they are four views of one computation. Splitting them
means running the same join four times.

---

### Blockers · "What is blocking those 127 cards"

Four named blockers, each with the record that clears it and the person who owns
it.

| Status | Endpoint | Query |
|---|---|---|
| ❌ | `GET /v1/report-cards/readiness` (same call) | One query per blocker kind, unioned: |

| Blocker | Query |
|---|---|
| Scores unapproved | `resultSheet.findMany({ where: { termId, status: { not: "APPROVED" } }, include: { classRoom, createdBy } })` grouped by class |
| Remarks outstanding | `resultSheet.findMany({ where: { termId, teacherComment: null } })` grouped by `classRoom.classTeacherId` |
| Subject with no teacher | subject-arms with no teacher assignment — the subject↔class↔teacher join; **this mapping has no single model today** and is the weakest link |
| No consent recorded | `student.findMany({ where: { consents: { none: { kind: "CORE" } } } })` against `ConsentRecord` |

The third is the one to resolve first: M03 Class & Timetable is built on
"subject-arm" as the unit, and the schema has no table that says *this subject,
in this arm, is taught by this person*. Until it exists, "Civic Education has no
teacher" cannot be computed — and it is the largest blocker on the page (112 of
the 127 cards).

---

### Table · "Who is holding the school up"

Staff with outstanding work, filterable by what they owe and their role.

| Status | Endpoint | Query |
|---|---|---|
| ❌ | `GET /v1/staff/outstanding` | A per-person aggregate across four sources: |

```
remarks     resultSheet.groupBy({ by: ["createdById"], where: { termId, teacherComment: null } })
sheets      resultSheet.groupBy({ by: ["createdById"], where: { termId, status: { in: ["DRAFT","RETURNED"] } } })
approvals   (the ApprovalRequest model proposed above), groupBy assigneeId where status PENDING
cash-up     payment.groupBy({ by: ["recordedById"], where: { reconciledAt: null } })
```

joined to `staffProfile` / `user` for name, role and department.

This is the page's most expensive component — four group-bys and a join. It
should be its own endpoint with its own cache, not folded into `overview`, and
it should page: the table already declares `per: 8`.

---

## What to build, in order

1. **`ApprovalRequest` model + `GET /v1/approvals/queue`.** Unblocks "My actions" here and the whole of M13 Approvals & Workflow. Nothing else on this page is blocked by a missing model.
2. **Subject-arm teaching assignment model.** Unblocks the largest Oversight blocker, and M03's entire Teaching tab.
3. **Extend `GET /v1/dashboard/overview`** with KPI cards 4–6 and the unmarked-class count. Cheapest win: one existing, already-cached call.
4. **`GET /v1/report-cards/readiness`.** Serves all four Oversight KPIs and the blocker list from one computation.
5. **School-scoped `GET /v1/audit/recent`.** The data and indexes are there; only the endpoint and its permission check are missing.
6. **`GET /v1/staff/outstanding`.** Depends on 1 for the approvals column.

Items 1 and 2 are schema changes and should be decided before any of the
endpoint work, because four of the six items above read from them.

---

## What changes on screen when this is wired

The queries above were run against the seeded database. The figures they return
are not the figures the page shows today, because the page is currently computed
from the mockup's own school:

| Component | Shows today | Database has |
|---|---|---|
| Total students | 1,560 | seeded roll |
| Attendance today | 42 arms | **13** class rooms |
| Score submissions | 38 of 54 | 81 result sheets, all `PUBLISHED` |
| Message credits | 8,420 | no `NotificationWallet` row at all |
| Sync depth | 0 pending | 0 — matches |
| Activity | 4 written entries | 159 real audit rows |
| Consent blocker | 6 students | 0 `ConsentRecord` rows |

Two of these need a decision before wiring, not after:

- **`NotificationWallet` has no row**, so the credits card would read empty
  rather than low. Seed one per school, or treat a missing wallet as zero and
  say so on the card.
- **Every result sheet is `PUBLISHED`**, so "38 of 54 · 7 returned" becomes
  "81 of 81 · 0 returned". The submission KPI is only meaningful once the seed
  produces sheets in mixed states.

Wiring a card without fixing its seed turns a demonstrative number into an
empty one, which reads as a bug rather than an empty school.
