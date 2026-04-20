import Link from "next/link";

import { AccessDenied } from "@/components/feedback/access-denied";
import { apiGet } from "@/lib/api/server";
import { canAccessPath, getDefaultPathForRole } from "@/lib/auth/roles";
import { getServerSession } from "@/lib/auth/session";
import { StudentPortalProfileView } from "@/lib/domain/types";
import { formatNigeriaClassName } from "@/lib/school-options";
import { formatDate } from "@/lib/utils/formatters";

export default async function StudentProfilePage() {
  const session = await getServerSession();
  if (!session) return null;
  if (!canAccessPath(session.role, "/portals/student")) {
    return <AccessDenied backHref={getDefaultPathForRole(session.role)} />;
  }

  const profile = await apiGet<StudentPortalProfileView>("/api/v1/student-portal/profile");

  return (
    <div className="grid gap-6">
      <section className="rounded-[2rem] border border-white/50 bg-white/90 p-6 shadow-panel">
        <Link href="/portals/student" className="text-sm font-semibold text-brand-700">Back to student portal</Link>
        <h1 className="mt-3 font-[var(--font-heading)] text-4xl font-bold text-ink">My profile</h1>
        <p className="mt-3 text-sm leading-6 text-ink/68">
          This profile is read-only. Ask the school office to correct restricted biodata, guardian, or medical records.
        </p>
      </section>

      <section className="grid gap-6 xl:grid-cols-3">
        <article className="rounded-[2rem] border border-white/50 bg-white/90 p-6 shadow-panel xl:col-span-2">
          <h2 className="font-[var(--font-heading)] text-2xl font-bold text-ink">{profile.studentName}</h2>
          <div className="mt-5 grid gap-3 text-sm text-ink/72 md:grid-cols-2">
            <p><span className="font-semibold text-ink">Admission number:</span> {profile.admissionNumber}</p>
            <p><span className="font-semibold text-ink">Student number:</span> {profile.studentNumber ?? "Not recorded"}</p>
            <p><span className="font-semibold text-ink">Class:</span> {formatNigeriaClassName(profile.className)}</p>
            <p><span className="font-semibold text-ink">Department / track:</span> {profile.departmentTrack ?? "Not applicable"}</p>
            <p><span className="font-semibold text-ink">Session:</span> {profile.session ?? "Current"}</p>
            <p><span className="font-semibold text-ink">Term:</span> {profile.term ?? "Current"}</p>
            <p><span className="font-semibold text-ink">Date of birth:</span> {profile.dateOfBirth ? formatDate(profile.dateOfBirth) : "Not recorded"}</p>
            <p><span className="font-semibold text-ink">Admission date:</span> {profile.admissionDate ? formatDate(profile.admissionDate) : "Not recorded"}</p>
            <p><span className="font-semibold text-ink">Status:</span> {profile.status}</p>
            <p><span className="font-semibold text-ink">Nationality:</span> {profile.nationality ?? "Not recorded"}</p>
            <p><span className="font-semibold text-ink">State:</span> {profile.stateOfOrigin ?? "Not recorded"}</p>
          </div>
        </article>
        <article className="rounded-[2rem] border border-white/50 bg-white/90 p-6 shadow-panel">
          <h2 className="font-[var(--font-heading)] text-2xl font-bold text-ink">Guardian summary</h2>
          <div className="mt-5 grid gap-3 text-sm text-ink/72">
            <p><span className="font-semibold text-ink">Name:</span> {profile.guardianSummary.name}</p>
            <p><span className="font-semibold text-ink">Relationship:</span> {profile.guardianSummary.relationship ?? "Guardian"}</p>
            <p><span className="font-semibold text-ink">Phone:</span> {profile.guardianSummary.phone ?? "Protected"}</p>
            <p><span className="font-semibold text-ink">Email:</span> {profile.guardianSummary.email ?? "Protected"}</p>
          </div>
        </article>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <article className="rounded-[2rem] border border-white/50 bg-white/90 p-6 shadow-panel">
          <h2 className="font-[var(--font-heading)] text-2xl font-bold text-ink">Enrolled subjects</h2>
          <div className="mt-5 flex flex-wrap gap-2">
            {profile.subjectDetails?.length
              ? profile.subjectDetails.map((subject) => (
                  <span key={subject.id} className="rounded-full bg-sand px-4 py-2 text-sm font-semibold text-ink">
                    {subject.name}
                    {subject.teacherName ? <span className="ml-1 text-ink/50">· {subject.teacherName}</span> : null}
                  </span>
                ))
              : profile.subjects.map((subject) => (
                  <span key={subject} className="rounded-full bg-sand px-4 py-2 text-sm font-semibold text-ink">{subject}</span>
                ))}
            {profile.subjects.length === 0 ? <p className="text-sm text-ink/65">No subject enrollment found for your class yet.</p> : null}
          </div>
        </article>
        <article className="rounded-[2rem] border border-white/50 bg-white/90 p-6 shadow-panel">
          <h2 className="font-[var(--font-heading)] text-2xl font-bold text-ink">Medical summary</h2>
          <div className="mt-5 grid gap-3 text-sm text-ink/72">
            <p><span className="font-semibold text-ink">Blood group:</span> {profile.medical?.bloodGroup ?? "Not recorded"}</p>
            <p><span className="font-semibold text-ink">Genotype:</span> {profile.medical?.genotype ?? "Not recorded"}</p>
            <p><span className="font-semibold text-ink">Allergies:</span> {profile.medical?.allergies ?? "None recorded"}</p>
            <p><span className="font-semibold text-ink">Conditions:</span> {profile.medical?.conditions ?? "None recorded"}</p>
          </div>
        </article>
      </section>
    </div>
  );
}
