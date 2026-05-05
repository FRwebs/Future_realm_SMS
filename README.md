# FutureRealm SMS

Production-minded School Management System for Nigerian schools, built with a Next.js frontend and a NestJS + TypeScript backend, powered by Prisma/PostgreSQL, role-based portals, finance workflows, admissions, attendance, grading, communication tools, and mobile-friendly dashboards.

## Stack

- Frontend: Next.js App Router, TypeScript, Tailwind CSS
- Backend: NestJS + TypeScript with modular controllers, guards, and services
- Database: PostgreSQL with Prisma ORM
- Auth: Secure signed session cookies with CSRF token support and RBAC
- Storage: S3-compatible abstraction with local mock fallback
- Payments: Paystack and Flutterwave adapter architecture
- Reporting: PDF report card generation
- Testing: Vitest and Playwright
- Deployment: Docker, docker-compose, GitHub Actions CI

## Project Structure

```text
.
├── prisma/
│   ├── schema.prisma
│   └── seed.ts
├── src/
│   ├── app/
│   │   ├── (app)/                 # Protected admin and portal screens
│   │   ├── api-docs/              # Links to Nest Swagger docs
│   │   └── login/                 # Authentication entry screen
│   ├── components/
│   │   ├── dashboard/
│   │   ├── data-display/
│   │   ├── forms/
│   │   ├── layout/
│   │   └── portals/
│   ├── hooks/
│   │   └── use-offline-draft-queue.ts
│   ├── lib/
│   │   ├── auth/
│   │   ├── db/
│   │   ├── demo/
│   │   ├── domain/
│   │   ├── integrations/
│   │   ├── pdf/
│   │   ├── uploads/
│   │   └── utils/
├── backend/
│   ├── src/
│   │   ├── auth/                  # Session, roles, CSRF guards
│   │   ├── common/                # API exception filter
│   │   └── modules/               # Nest controllers and services
│   └── Dockerfile
├── tests/
│   ├── unit/
│   ├── integration/
│   └── e2e/
├── Dockerfile
├── docker-compose.yml
└── .github/workflows/ci.yml
```

## Architecture Summary

- Multi-tenant design begins at the `School` model and flows through academic, finance, operational, and communication tables with `schoolId` ownership on domain records.
- Next.js handles the web experience while NestJS owns the backend API surface under `/api/v1`.
- The web app reaches Nest through a rewrite proxy, so browser requests keep a same-origin `/api/...` shape without Next implementing the backend itself.
- A signed cookie session plus CSRF token protects browser flows. Middleware guards private routes and propagates request context.
- Demo mode is included for local product exploration without a live database. Production mode uses Prisma-backed services.
- Offline-first draft capability is implemented on attendance and grading forms through a local queue that can sync later.
- Nigerian school workflows are reflected in session/term structures, Naira formatting, and WAEC/NECO-style grading helpers.

## Core Features

- Admissions management with configurable cycles, intake, document checks, fee verification, screening, principal decision, offer issuance, acceptance, financial clearance, enrollment conversion, audit history, reporting, and offer PDFs
- Student portal with student-scoped dashboard, profile, attendance, published results, timetable, fees, announcements, notifications, and library/hostel/transport summaries
- Parent/guardian portal with guardian-scoped multi-child switching, attendance, published results, fee balances, timetable/calendar, announcements, notifications, and read-only profile views
- Student information system overview with guardian, attendance, and balance context
- Daily attendance capture with absence alerts and offline draft queue
- Academics result entry with WAEC-style grade resolution and report card PDF output
- Finance invoicing, fee structures, payment allocation, receipts, discounts/waivers, installment plans, arrears reporting, and payment gateway initialization/verification architecture
- Announcement broadcasting for internal communication
- Parent, teacher, and student portal experiences
- Analytics dashboard with risk flags and operational summaries
- Seeded transport, hostel, library, and integration configuration data in Prisma
- Nest Swagger UI and JSON docs under `/api/docs` and `/api/docs-json`

## Setup Instructions

1. Copy `.env.example` to `.env`.
2. Install dependencies:

```bash
npm install
```

3. Start PostgreSQL with Docker:

```bash
docker-compose up -d db
```

4. Run Prisma migrations or push the Prisma schema locally.

For this workspace, no existing `prisma/migrations` history is present, so local development uses:

```bash
npx prisma db push
```

If you introduce a migration baseline later, use:

```bash
npx prisma migrate dev --name init
```

5. Seed demo data:

```bash
npm run prisma:seed
```

6. Start both frontend and backend:

```bash
npm run dev
```

7. Open [http://localhost:3000](http://localhost:3000)

## Demo Credentials

- Super Admin: `admin@futurerealm.sms`
- Principal: `principal@greenfieldcollege.ng`
- Admin Officer: `admin.officer@greenfieldcollege.ng`
- Admissions Officer: `admissions@greenfieldcollege.ng`
- Teachers: `teacher@greenfieldcollege.ng`, `teacher.primary@greenfieldcollege.ng`, `teacher.english@greenfieldcollege.ng`
- Bursar: `bursar@greenfieldcollege.ng`
- Parents: `parent@greenfieldcollege.ng`, `chinelo.obi@greenfieldcollege.ng`, `salisu.mohammed@greenfieldcollege.ng`
- Students: `student@greenfieldcollege.ng`, `maryam.yusuf@greenfieldcollege.ng`, `amarachi.obi@greenfieldcollege.ng`, `ibrahim.salisu@greenfieldcollege.ng`, `esther.adewale@greenfieldcollege.ng`
- Password for all demo users: `FutureRealm123!`

## API Surface

- `POST /api/v1/auth/login`
- `POST /api/v1/auth/logout`
- `GET /api/v1/auth/session`
- `GET /api/v1/dashboard/overview`
- `GET/POST /api/v1/admissions`
- `GET /api/v1/admissions/metrics`
- `GET/PUT /api/v1/admissions/settings`
- `GET /api/v1/admissions/:applicationId`
- `POST /api/v1/admissions/:applicationId/submit`
- `POST /api/v1/admissions/:applicationId/review`
- `POST /api/v1/admissions/:applicationId/request-documents`
- `POST /api/v1/admissions/:applicationId/verify-fee`
- `POST /api/v1/admissions/:applicationId/schedule-screening`
- `POST /api/v1/admissions/:applicationId/screening-result`
- `POST /api/v1/admissions/:applicationId/recommend`
- `POST /api/v1/admissions/:applicationId/decision`
- `POST /api/v1/admissions/:applicationId/issue-offer`
- `POST /api/v1/admissions/:applicationId/accept-offer`
- `POST /api/v1/admissions/:applicationId/decline-offer`
- `POST /api/v1/admissions/:applicationId/financial-clearance`
- `POST /api/v1/admissions/:applicationId/enroll`
- `GET /api/v1/admissions/:applicationId/offer-letter`
- `GET/POST /api/v1/students`
- `GET /api/v1/student-portal/dashboard`
- `GET /api/v1/student-portal/profile`
- `GET /api/v1/student-portal/attendance`
- `GET /api/v1/student-portal/results`
- `GET /api/v1/student-portal/timetable`
- `GET /api/v1/student-portal/assignments`
- `GET /api/v1/student-portal/fees`
- `GET /api/v1/student-portal/announcements`
- `GET /api/v1/student-portal/notifications`
- `GET /api/v1/student-portal/services`
- `GET /api/v1/parent-portal/dashboard`
- `GET /api/v1/parent-portal/children`
- `GET /api/v1/parent-portal/children/:studentId`
- `GET /api/v1/parent-portal/children/:studentId/attendance`
- `GET /api/v1/parent-portal/children/:studentId/results`
- `GET /api/v1/parent-portal/children/:studentId/fees`
- `GET /api/v1/parent-portal/children/:studentId/timetable`
- `GET /api/v1/parent-portal/announcements`
- `GET /api/v1/parent-portal/notifications`
- `GET /api/v1/parent-portal/profile`
- `GET/POST /api/v1/attendance`
- `GET/POST /api/v1/academics/grades`
- `GET/POST /api/v1/finance/invoices`
- `GET /api/v1/finance/dashboard`
- `GET/POST /api/v1/finance/fee-structures`
- `GET /api/v1/finance/invoices/:invoiceId`
- `POST /api/v1/finance/invoices/generate`
- `GET /api/v1/finance/payments`
- `POST /api/v1/finance/payments`
- `POST /api/v1/finance/payments/manual`
- `POST /api/v1/finance/payments/verify`
- `POST /api/v1/finance/discounts`
- `POST /api/v1/finance/waivers`
- `GET/POST /api/v1/finance/installment-plans`
- `GET /api/v1/finance/reports/export`
- `GET/POST /api/v1/communications/announcements`
- `GET /api/v1/reports/report-card/:studentId`
- `GET /api/docs`
- `GET /api/docs-json`

## Testing

```bash
npm run test
npm run test:e2e
```

## Deployment Notes

- Vercel is now supported for both the Next frontend and the Nest API on the same domain.
- The Nest backend is exposed through the Vercel serverless entry at [api/[...path].ts](/Users/victoryakubu/Desktop/futurerealm/school%20management%20system/api/%5B...path%5D.ts), so production requests keep the same `/api/v1/...` shape as local development.
- Local development still uses the Next rewrite proxy to `http://127.0.0.1:4000`, but Vercel automatically disables that rewrite so requests do not bounce back to localhost.
- Use a managed PostgreSQL instance in production.
- Replace mock S3 and payment settings with real credentials in environment variables.
- Deploy behind HTTPS so secure cookies remain enabled.
- Add centralized logging, metrics, and background workers for outbound notifications in production.
- For multi-school SaaS deployments, add tenant-aware subdomain routing and database row policies.

## Vercel Setup

1. Create a Vercel project from this repository.
2. Keep the default build command:

```bash
npm run build
```

3. Set these required environment variables in Vercel:

```bash
DATABASE_URL=...
DIRECT_URL=...
APP_URL=https://your-domain.example
JWT_SECRET=replace-with-a-long-random-secret
DEFAULT_SCHOOL_SLUG=greenfield-college
DEMO_MODE=false
```

4. Do not set `NEST_API_URL` in Vercel unless you intentionally want the frontend to call a different external API host.
5. If you use preview deployments, Vercel preview URLs are automatically accepted by the backend CORS and `APP_URL` fallback logic.
6. Run Prisma against your production database before the first live login:

```bash
npx prisma db push
npm run prisma:seed
```

7. After deployment, verify:
   - `/login`
   - `/api/v1/auth/session`
   - `/api/docs`
   - one protected page such as `/dashboard`

## Known Limitations

- Transport, hostel, library, HR, and timetable modules are represented in the schema and seed data, but their full CRUD UI is not yet surfaced.
- Payment adapters currently use robust mock behavior, interface boundaries, and verification hooks rather than live Paystack/Flutterwave HTTP calls or signed webhooks.
- File upload validation/storage is modeled and abstracted, but the admissions document upload UI still needs a dedicated multipart screen.
- Student assignment submission remains read-only/empty until a dedicated Assignment and Submission data model is added.
- Parent communication is currently limited to announcements and notifications because no full ticketing/appointment module exists yet.
- Prisma migration creation is blocked in this non-interactive environment because the project has no existing migration baseline; the local database was updated with `npx prisma db push`.
- Some production hardening tasks such as background job queues and full observability dashboards still need completion.

## Recommended Next Production Steps

1. Generate and commit Prisma SQL migrations from the current schema.
2. Add background job processing for notifications, fee reminders, and report publishing.
3. Expand the UI for HR, hostel, library, timetable, and transport modules already modeled in the database.
4. Replace mock payment and notification adapters with sandbox and then live integrations.
5. Add stronger audit reporting, export jobs, and full E2E coverage across multi-role workflows.
