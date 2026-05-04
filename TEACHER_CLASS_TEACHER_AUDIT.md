# Teacher & Class Teacher Portal Audit

## Summary

The codebase already contains a meaningful teacher foundation, but it is split across:

- a lightweight `teacher-portal` module for dashboard, attendance, timetable, scores, tasks, announcements, and notifications
- stronger generic school modules such as `timetable`, `attendance`, `scheme-of-work`, `academics`, `teachers`, and `classes`

That means the portal is not starting from zero. The main gap is not absence of capability, but fragmentation and thin teacher-facing UX.

## Backend audit

### Present

- Teacher portal role guard exists:
  - `backend/src/modules/teacher-portal/teacher-portal.controller.ts`
  - roles allowed: `TEACHER`, `CLASS_TEACHER`, `SUBJECT_TEACHER`
- Teacher portal service exists:
  - `backend/src/modules/teacher-portal/teacher-portal.service.ts`
- Timetable module exists with richer teacher timetable data and conflict detection:
  - `backend/src/modules/timetable/timetable.controller.ts`
  - `backend/src/modules/timetable/timetable.service.ts`
- General attendance module exists:
  - `backend/src/modules/attendance/attendance.controller.ts`
  - `backend/src/modules/attendance/attendance.service.ts`
- Scheme of work module exists:
  - `backend/src/modules/scheme-of-work/*`
- Teacher directory/profile module exists:
  - `backend/src/modules/teachers/*`
- Assessment score entry and broadsheet/result workflow exist in academics:
  - `backend/src/modules/academics/academics.service.ts`
- Class teacher detection already exists through class ownership:
  - `classTeacherId`
  - `assistantClassTeacherId`
- Seed data includes teacher, class teacher, and subject teacher records:
  - `prisma/seed.ts`

### Partially present

- Attendance:
  - teacher portal supports single-record marking and bulk daily class register
  - current bulk register is biased toward class-teacher morning attendance
  - subject/period attendance exists at single-record level, but not as a first-class bulk teacher workflow
- Timetable:
  - generic timetable module has richer data than the teacher portal currently exposes
  - teacher portal currently flattens timetable into minimal `day/time/subject/class/venue`
- Scores:
  - teacher portal score entry exists and is usable
  - spreadsheet-grade experience is frontend-only and not yet aligned to configurable CA components
- Assignments:
  - teacher task creation/listing exists
  - richer grading/submission lifecycle from the spec is not present in teacher portal endpoints
- Class teacher logic:
  - supported structurally through class assignments
  - not fully modeled as a dedicated portal experience

### Missing or incomplete versus requested spec

- No dedicated `/api/v1/teacher/*` namespace yet; current namespace is `/api/v1/teacher-portal/*`
- No teacher profile aggregate model matching the requested `teacher_profiles` schema
- No dedicated `attendance_sessions` / `attendance_records` teacher workflow schema as specified
- No period-aware attendance session API with draft/submitted lifecycle
- No dedicated parent-teacher messaging backend for threaded conversations
- No dedicated teacher resource library backend matching the requested schema
- No dedicated welfare flag API under teacher portal
- No dedicated class-teacher dashboard endpoint
- No explicit audit log surfaced from teacher actions in teacher portal flows
- No PDF generation path for teacher timetable / attendance register from the teacher portal
- Dual-role detection is incomplete:
  - current session model is single-role based
  - class-teacher capability is inferred through class ownership, not a true simultaneous role composition layer

## Frontend audit

### Present

- Teacher portal root page exists:
  - `src/app/(app)/portals/teacher/page.tsx`
- Teacher dashboard exists:
  - `src/components/portals/teacher-portal-dashboard.tsx`
- Teacher attendance page exists and is already fairly advanced:
  - `src/app/(app)/portals/teacher/attendance/page.tsx`
  - `src/app/(app)/portals/teacher/attendance/_client.tsx`
- Teacher timetable page exists:
  - `src/app/(app)/portals/teacher/timetable/page.tsx`
  - `src/components/portals/teacher-timetable-workspace.tsx`
- My classes page exists:
  - `src/app/(app)/portals/teacher/classes/page.tsx`
- Score entry page exists:
  - `src/app/(app)/portals/teacher/scores/page.tsx`
  - `src/app/(app)/portals/teacher/scores/_client.tsx`
- Assignments page exists:
  - `src/app/(app)/portals/teacher/assignments/page.tsx`
  - `src/app/(app)/portals/teacher/assignments/_client.tsx`
- Teacher announcements / notifications / profile pages exist

### Partially present

- Attendance marking UX is already much stronger than a placeholder, but still does not fully support:
  - smart current-period auto-context
  - class-vs-subject attendance mode as first-class flows
  - period-aware bulk submission
- Timetable page has a useful day-focused workspace, but still lacks:
  - real current-period state detection
  - richer live status treatment
  - stronger weekly intelligence / list views / today status
- Class teacher experience is spread across generic teacher pages rather than a dedicated nested workspace

### Missing or incomplete versus requested spec

- No nested teacher IA for:
  - attendance subsections
  - content subsections
  - dedicated class-teacher workspace
- No dedicated class teacher dashboard route
- No class register route distinct from general attendance
- No teacher resource library route
- No parent message center route
- No class welfare route
- No report card comments route inside teacher portal
- No dedicated lesson notes page matching the premium spec
- No teacher-side student profile route

## Recommended implementation focus

### Highest priority

1. Upgrade teacher attendance so it supports both:
   - class-teacher morning register
   - subject/period attendance for assigned teaching periods
2. Upgrade teacher timetable so it exposes:
   - current / next / past period states
   - stronger day and week guidance
3. Introduce a nested class-teacher workspace under the teacher portal

### Safe architectural approach

- Reuse the existing `teacher-portal` module instead of creating a second teacher backend
- Reuse the stronger generic `timetable` and `academics` logic where possible
- Extend existing domain types rather than fork parallel teacher-only types
- Keep dark/light mode and shell conventions fully aligned with the global design system
