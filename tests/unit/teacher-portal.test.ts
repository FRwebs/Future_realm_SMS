import { canTeacherManageAssignedSubject, canUseTeacherPortal, canViewTeacherOversight } from "@/lib/domain/teacher-portal";

describe("teacher portal domain", () => {
  it("keeps the teacher portal scoped to teaching accounts", () => {
    expect(canUseTeacherPortal("TEACHER")).toBe(true);
    expect(canUseTeacherPortal("CLASS_TEACHER")).toBe(true);
    expect(canUseTeacherPortal("SUBJECT_TEACHER")).toBe(true);
    expect(canUseTeacherPortal("PRINCIPAL")).toBe(false);
    expect(canViewTeacherOversight("PRINCIPAL")).toBe(true);
  });

  it("only lets teaching accounts manage their own assigned subjects", () => {
    expect(
      canTeacherManageAssignedSubject({
        role: "TEACHER",
        teacherId: "teacher_a",
        assignedTeacherId: "teacher_a"
      })
    ).toBe(true);

    expect(
      canTeacherManageAssignedSubject({
        role: "CLASS_TEACHER",
        teacherId: "teacher_a",
        assignedTeacherId: "teacher_a"
      })
    ).toBe(true);

    expect(
      canTeacherManageAssignedSubject({
        role: "SUBJECT_TEACHER",
        teacherId: "teacher_a",
        assignedTeacherId: "teacher_a"
      })
    ).toBe(true);

    expect(
      canTeacherManageAssignedSubject({
        role: "TEACHER",
        teacherId: "teacher_a",
        assignedTeacherId: "teacher_b"
      })
    ).toBe(false);

    expect(
      canTeacherManageAssignedSubject({
        role: "PRINCIPAL",
        teacherId: "teacher_a",
        assignedTeacherId: "teacher_a"
      })
    ).toBe(false);
  });
});
