/** The shape of a class as the classes list endpoint returns it. */
type TeacherSummary = { id: string; name: string; email?: string | null; phone?: string | null; avatar?: string | null };

export type ClassListItem = {
  id: string;
  name: string;
  shortName: string;
  level: string;
  section?: string | null;
  category: "Early Years" | "Primary" | "Junior Secondary" | "Senior Secondary" | "Other";
  arm?: string | null;
  capacity: number;
  room?: string | null;
  studentCount: number;
  student_count: number;
  displayOrder: number;
  classTeacher: TeacherSummary | null;
  class_teacher: TeacherSummary | null;
  assistantClassTeacher: TeacherSummary | null;
  assistant_class_teacher: TeacherSummary | null;
};

export type PaginatedResponse<T> = {
  data: T[];
  total: number;
};
