import { TableCard } from "@/components/data-display/table-card";
import { TeacherPortalView } from "@/lib/domain/types";
import { formatDate } from "@/lib/utils/formatters";

export function TeacherPortalDashboard({ portal }: { portal: TeacherPortalView }) {
  return (
    <div className="grid gap-6">
      <section className="rounded-[2rem] border border-white/50 bg-white/90 p-6 shadow-panel">
        <p className="text-sm font-semibold uppercase tracking-[0.28em] text-brand-700">Teacher Portal</p>
        <h1 className="mt-3 font-[var(--font-heading)] text-4xl font-bold text-ink">{portal.headline}</h1>
        <p className="mt-3 text-sm leading-6 text-ink/68">
          {portal.teacherName} can review assigned classes, mark attendance, enter scores, manage assignments, and follow the current teaching week from one responsive portal.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          {[
            { label: "My classes", href: "/portals/teacher/classes" },
            { label: "Mark attendance", href: "/portals/teacher/attendance" },
            { label: "Enter scores", href: "/portals/teacher/scores" },
            { label: "Scheme of work", href: "/portals/teacher/curriculum" },
            { label: "Clock in/out", href: "/portals/teacher/staff-attendance" },
            { label: "Training", href: "/portals/teacher/training" },
            { label: "Assignments", href: "/portals/teacher/assignments" },
            { label: "Timetable", href: "/portals/teacher/timetable" }
          ].map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="rounded-full bg-ink px-5 py-3 text-sm font-semibold text-white transition hover:bg-brand-800"
            >
              {item.label}
            </a>
          ))}
        </div>
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {portal.stats.map((stat) => (
            <article key={stat.label} className="rounded-[1.5rem] bg-sand/65 p-5">
              <p className="text-sm text-ink/55">{stat.label}</p>
              <p className="mt-3 font-[var(--font-heading)] text-3xl font-bold text-ink">{stat.value}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <TableCard
          title="Weekly teaching timetable"
          description="All scheduled teaching slots for the current week."
          items={portal.weeklyTimetable}
          columns={[
            { key: "day", header: "Day", render: (item) => item.day },
            { key: "time", header: "Time", render: (item) => item.time },
            {
              key: "subject",
              header: "Subject",
              render: (item) => (
                <div>
                  <p className="font-semibold text-ink">{item.subject}</p>
                  <p className="text-xs text-ink/55">{item.className}</p>
                </div>
              )
            },
            { key: "venue", header: "Venue", render: (item) => item.venue }
          ]}
        />
        <TableCard
          title="Assigned classes"
          description="Operational overview for classes, pending scores, and next actions."
          items={portal.assignedClasses}
          columns={[
            {
              key: "className",
              header: "Class",
              render: (item) => (
                <div>
                  <p className="font-semibold text-ink">{item.className}</p>
                  <p className="text-xs text-ink/55">{item.subject}</p>
                </div>
              )
            },
            { key: "learners", header: "Learners", render: (item) => item.learners },
            { key: "pendingScores", header: "Pending", render: (item) => item.pendingScores },
            { key: "nextAction", header: "Next action", render: (item) => item.nextAction }
          ]}
        />
      </section>

      {(portal.assignments?.length ?? 0) > 0 || (portal.notifications?.length ?? 0) > 0 ? (
        <section className="grid gap-6 xl:grid-cols-2">
          <TableCard
            title="Assignments"
            description="Recently created learning tasks and submission counts."
            items={portal.assignments ?? []}
            columns={[
              {
                key: "title",
                header: "Task",
                render: (item) => (
                  <div>
                    <p className="font-semibold text-ink">{item.title}</p>
                    <p className="text-xs text-ink/55">{item.className} / {item.subject}</p>
                  </div>
                )
              },
              { key: "dueAt", header: "Due", render: (item) => formatDate(item.dueAt) },
              { key: "status", header: "Status", render: (item) => item.status },
              { key: "submissions", header: "Submissions", render: (item) => item.submissionsCount }
            ]}
          />
          <TableCard
            title="Notifications"
            description="Recent teaching-related alerts available to your account."
            items={portal.notifications ?? []}
            columns={[
              { key: "title", header: "Notification", render: (item) => item.title },
              { key: "channel", header: "Channel", render: (item) => item.channel },
              { key: "sentAt", header: "Sent", render: (item) => (item.sentAt ? formatDate(item.sentAt) : "-") }
            ]}
          />
        </section>
      ) : null}

      <section className="rounded-[2rem] border border-white/50 bg-white/90 p-6 shadow-panel">
        <h2 className="font-[var(--font-heading)] text-2xl font-bold text-ink">Recent activity</h2>
        <div className="mt-5 grid gap-4">
          {portal.recentActivity.map((item) => (
            <article key={item.id} className="rounded-[1.5rem] border border-ink/8 bg-sand/55 p-5">
              <div className="flex items-center justify-between gap-4">
                <p className="font-semibold text-ink">{item.title}</p>
                <span className="text-xs uppercase tracking-[0.24em] text-ink/35">{item.time}</span>
              </div>
              <p className="mt-3 text-sm leading-6 text-ink/68">{item.detail}</p>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
