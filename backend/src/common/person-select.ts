import type { Prisma } from "@prisma/client";

/**
 * What a query may carry of the people around a record, when the record itself is what leaves the API.
 *
 * `include: { user: true }` returns every column of the user: date of birth, home address, next of kin, a password hash. A page that
 * shows a name gets all of that, and so does anyone who can open the network tab. These are the narrow shapes; widen one only for a
 * page that reads the extra field, and say which.
 */

/** Who someone is, and nothing else about them. */
export const personName = { id: true, firstName: true, lastName: true } satisfies Prisma.UserSelect;

/** A person on a list that is also a way to reach them (a host, a reviewer, a teacher to contact). */
export const personContact = { id: true, firstName: true, lastName: true, email: true, phone: true } satisfies Prisma.UserSelect;

/** A student as a line on someone else's record: who they are and which arm they sit in. No birth date, address or medical detail. */
export const studentCard = {
  id: true,
  admissionNumber: true,
  firstName: true,
  middleName: true,
  lastName: true,
  photoUrl: true,
  status: true,
  currentClassId: true,
  currentClass: { select: { id: true, name: true, arm: true } },
  user: { select: personName }
} satisfies Prisma.StudentSelect;

/** A member of staff as a line on someone else's record. No emergency contact, pay band or notes. */
export const staffCard = {
  id: true,
  employeeNo: true,
  designation: true,
  departmentId: true,
  department: { select: { id: true, name: true } },
  user: { select: personName }
} satisfies Prisma.StaffProfileSelect;

/** A guardian as a line on someone else's record: a name and a number to ring. No address, safeguarding note or second contact. */
export const guardianCard = {
  id: true,
  firstName: true,
  lastName: true,
  phone: true,
  relationship: true
} satisfies Prisma.GuardianSelect;
