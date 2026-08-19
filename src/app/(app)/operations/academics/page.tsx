import { CanDo } from "@/components/auth/permission-provider";
import { TableCard } from "@/components/data-display/table-card";
import { ResourceActionDialog } from "@/components/forms/resource-action-dialog";
import { apiGet } from "@/lib/api/server";

type SubjectRef = { name: string; code?: string | null };
type ClassRef = { name: string; arm?: string | null };
type UserRef = { firstName: string; lastName: string; email: string };

type LessonPlan = {
  id: string;
  weekNumber: number;
  topic: string;
  objectives: string;
  status: string;
  teacher: UserRef;
  subject: SubjectRef;
  classRoom?: ClassRef | null;
};

type Question = {
  id: string;
  assessmentType: string;
  question: string;
  difficulty: string;
  status: string;
  subject: SubjectRef;
  teacher?: UserRef | null;
};

type Material = {
  id: string;
  title: string;
  status: string;
  subject: SubjectRef;
  classRoom?: ClassRef | null;
};

function userLabel(user?: UserRef | null) {
  return user ? `${user.firstName} ${user.lastName}` : "Unassigned";
}

function classLabel(classRoom?: ClassRef | null) {
  return classRoom ? `${classRoom.name}${classRoom.arm ? ` ${classRoom.arm}` : ""}` : "All applicable classes";
}

async function safeList<T>(path: string) {
  try {
    return await apiGet<T[]>(path);
  } catch {
    return [];
  }
}

export default async function AcademicOperationsPage() {
  const [lessonPlans, questions, materials] = await Promise.all([
    safeList<LessonPlan>("/api/v1/operations/lesson-plans"),
    safeList<Question>("/api/v1/operations/question-bank"),
    safeList<Material>("/api/v1/operations/learning-materials")
  ]);

  return (
    <div className="portal-page">
      <section className="surface-hero p-6 md:p-7">
        <p className="section-eyebrow">
          Academic controls
        </p>
        <div className="mt-3 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="font-[var(--font-heading)] text-[26px] font-black text-[var(--color-text-primary)]">
              Lesson Plans, Question Bank & Materials
            </h1>
            <p className="mt-3 max-w-3xl text-[13px] leading-6 text-[var(--color-text-secondary)]">
              HODs and VP Academics can review weekly lesson plans and moderate question bank items before exams.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <CanDo permission="lesson_plans.create">
              <ResourceActionDialog
                triggerLabel="Submit Lesson Plan"
                title="Submit lesson plan"
                description="Create a weekly lesson plan for HOD or VP Academics review."
                endpoint="/api/v1/operations/lesson-plans"
                fields={[
                  { name: "subjectId", label: "Subject ID", required: true },
                  { name: "classId", label: "Class ID" },
                  { name: "termId", label: "Term ID" },
                  { name: "academicSessionId", label: "Academic session ID" },
                  { name: "weekNumber", label: "Week number", type: "number", min: 1, max: 20, required: true },
                  { name: "topic", label: "Topic", required: true },
                  { name: "objectives", label: "Learning objectives", type: "textarea", required: true },
                  { name: "resources", label: "Resources", type: "textarea" },
                  { name: "status", label: "Status", type: "select", defaultValue: "SUBMITTED", options: ["DRAFT", "SUBMITTED"].map((value) => ({ label: value, value })) }
                ]}
                submitLabel="Save Lesson Plan"
              />
            </CanDo>
            <CanDo permission="question_bank.create">
              <ResourceActionDialog
                triggerLabel="Add Question"
                title="Add question bank item"
                description="Store a test, practical, or exam question for moderation."
                endpoint="/api/v1/operations/question-bank"
                fields={[
                  { name: "subjectId", label: "Subject ID", required: true },
                  { name: "classId", label: "Class ID" },
                  { name: "assessmentType", label: "Assessment type", required: true, defaultValue: "Test" },
                  { name: "question", label: "Question", type: "textarea", required: true },
                  { name: "answerGuide", label: "Answer guide", type: "textarea" },
                  { name: "difficulty", label: "Difficulty", type: "select", defaultValue: "MEDIUM", options: ["EASY", "MEDIUM", "HARD"].map((value) => ({ label: value, value })) },
                  { name: "status", label: "Status", type: "select", defaultValue: "SUBMITTED", options: ["DRAFT", "SUBMITTED"].map((value) => ({ label: value, value })) }
                ]}
                submitLabel="Save Question"
              />
            </CanDo>
          </div>
        </div>
      </section>

      <TableCard
        title="Lesson Plan Review Queue"
        description="Weekly plans submitted by class and subject teachers."
        items={lessonPlans}
        emptyState="No lesson plans have been submitted."
        columns={[
          { key: "week", header: "Week", render: (item) => `Week ${item.weekNumber}` },
          { key: "topic", header: "Topic", render: (item) => <span className="font-semibold text-[var(--color-text-primary)]">{item.topic}</span> },
          { key: "subject", header: "Subject", render: (item) => item.subject.name },
          { key: "class", header: "Class", render: (item) => classLabel(item.classRoom) },
          { key: "teacher", header: "Teacher", render: (item) => userLabel(item.teacher) },
          { key: "status", header: "Status", render: (item) => <span className="rounded-full bg-[var(--color-accent-primary-dim)] px-3 py-1 text-xs font-semibold text-[var(--color-text-accent)]">{item.status}</span> }
        ]}
      />

      <div className="grid gap-6 xl:grid-cols-2">
        <TableCard
          title="Question Bank"
          description="Moderated exam, test, practical, and quiz items."
          items={questions}
          emptyState="No question bank items yet."
          columns={[
            { key: "type", header: "Type", render: (item) => item.assessmentType },
            { key: "question", header: "Question", render: (item) => item.question },
            { key: "subject", header: "Subject", render: (item) => item.subject.name },
            { key: "status", header: "Status", render: (item) => item.status }
          ]}
        />
        <TableCard
          title="Learning Materials"
          description="Published and draft resources available to students where permitted."
          items={materials}
          emptyState="No learning materials uploaded."
          columns={[
            { key: "title", header: "Title", render: (item) => <span className="font-semibold text-[var(--color-text-primary)]">{item.title}</span> },
            { key: "subject", header: "Subject", render: (item) => item.subject.name },
            { key: "class", header: "Class", render: (item) => classLabel(item.classRoom) },
            { key: "status", header: "Status", render: (item) => item.status }
          ]}
        />
      </div>
    </div>
  );
}
