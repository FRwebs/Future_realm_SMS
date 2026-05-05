# Seeded Demo Accounts

All seeded demo accounts use the same default password:

- Password: `FutureRealm123!`

## Platform Accounts

| Role | Email |
| --- | --- |
| Super Admin | `admin@futurerealm.sms` |
| Platform Admin | `platform.admin@futurerealm.sms` |
| Support Agent | `support@futurerealm.sms` |
| Sales Manager | `sales@futurerealm.sms` |
| Finance Manager | `finance@futurerealm.sms` |
| Developer | `developer@futurerealm.sms` |

## School Leadership & Operations

| Role | Email |
| --- | --- |
| Principal | `principal@greenfieldcollege.ng` |
| Proprietor | `proprietor@greenfieldcollege.ng` |
| Administrator | `administrator@greenfieldcollege.ng` |
| Head Teacher | `head.teacher@greenfieldcollege.ng` |
| Vice Principal Academics | `vp.academics@greenfieldcollege.ng` |
| Vice Principal Administration | `vp.admin@greenfieldcollege.ng` |
| Vice Principal Special Duties | `vp.special@greenfieldcollege.ng` |
| Admin Officer | `admin.officer@greenfieldcollege.ng` |
| Admissions Officer | `admissions@greenfieldcollege.ng` |
| Exam Officer | `exam.officer@greenfieldcollege.ng` |
| Head of Department | `hod.science@greenfieldcollege.ng` |
| Accountant / Bursar | `bursar@greenfieldcollege.ng` |
| Guidance Counsellor | `counsellor@greenfieldcollege.ng` |
| Nurse | `nurse@greenfieldcollege.ng` |
| Receptionist / Front Desk | `frontdesk@greenfieldcollege.ng` |
| Librarian | `librarian@greenfieldcollege.ng` |
| Transport Manager | `transport@greenfieldcollege.ng` |
| Hostel Mistress | `hostel@greenfieldcollege.ng` |
| ICT / CBT Admin | `ict@greenfieldcollege.ng` |

## Teachers

| Role | Email |
| --- | --- |
| Teacher | `teacher@greenfieldcollege.ng` |
| Primary Teacher | `teacher.primary@greenfieldcollege.ng` |
| English Teacher | `teacher.english@greenfieldcollege.ng` |
| Class Teacher | `class.teacher@greenfieldcollege.ng` |
| Subject Teacher | `subject.teacher@greenfieldcollege.ng` |

## Fixed Parent Accounts

| Role | Email |
| --- | --- |
| Parent | `parent@greenfieldcollege.ng` |
| Parent | `chinelo.obi@greenfieldcollege.ng` |
| Parent | `salisu.mohammed@greenfieldcollege.ng` |

## Fixed Student Accounts

| Role | Email |
| --- | --- |
| Student | `student@greenfieldcollege.ng` |
| Student | `maryam.yusuf@greenfieldcollege.ng` |
| Student | `amarachi.obi@greenfieldcollege.ng` |
| Student | `ibrahim.salisu@greenfieldcollege.ng` |
| Student | `esther.adewale@greenfieldcollege.ng` |

## Generated Student Portal Accounts

The seed also creates portal users for generated students in each class.

- Current seed size: `10 students per class`
- Student portal email format: ``${normalizedStudentNumber}@students.greenfieldcollege.ng``
- Source in seed: `buildStudentPortalEmail(...)`

Examples:

- `std-cre-01@students.greenfieldcollege.ng`
- `std-nur1-01@students.greenfieldcollege.ng`
- `std-pri4-01@students.greenfieldcollege.ng`
- `std-jss2-01@students.greenfieldcollege.ng`
- `std-ss1-01@students.greenfieldcollege.ng`

## Generated Guardian Portal Accounts

The seed also creates guardian users for seeded guardian records.

- Current seed target: `3 guardian-linked students per class`
- Guardian portal email format: ``${normalizedFirstName-lastName}-${last4Phone}@parents.greenfieldcollege.ng``
- Source in seed: `buildGuardianPortalEmail(...)`

Examples:

- `kemi-adeyemi-0001@parents.greenfieldcollege.ng`
- `amina-okonkwo-0002@parents.greenfieldcollege.ng`
- `adewale-bassey-0003@parents.greenfieldcollege.ng`

## Notes

- All accounts in this file use the same password: `FutureRealm123!`
- The generated student and guardian account counts now reflect the reduced seed size:
  - `10 students per class`
  - `3 guardian-linked students per class`
- If the seed rules change later, this file should be updated alongside `prisma/seed.ts`.
