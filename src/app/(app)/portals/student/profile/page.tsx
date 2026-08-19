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
    <div className="portal-page">
      <section className="surface-hero p-6 md:p-7">
        <Link href="/portals/student" className="text-[13px] font-semibold text-[var(--color-text-accent)]">Back to student portal</Link>
        <h1 className="mt-3 font-[var(--font-heading)] text-[26px] font-black text-[var(--color-text-primary)]">My profile</h1>
        <p className="mt-2 text-[13px] leading-6 text-[var(--color-text-secondary)]">
          This profile is read-only. Ask the school office to correct restricted biodata, guardian, or medical records.
        </p>
      </section>

      <section className="grid gap-5 xl:grid-cols-3">
        <article className="surface-card p-6 xl:col-span-2">
          <h2 className="font-[var(--font-heading)] text-[18px] font-bold text-[var(--color-text-primary)]">{profile.studentName}</h2>
          <div className="mt-5 grid gap-3 text-[13px] text-[var(--color-text-secondary)] md:grid-cols-2">
            <p><span className="font-semibold text-[var(--color-text-primary)]">Admission number:</span> {profile.admissionNumber}</p>
            <p><span className="font-semibold text-[var(--color-text-primary)]">Student number:</span> {profile.studentNumber ?? "Not recorded"}</p>
            <p><span className="font-semibold text-[var(--color-text-primary)]">Class:</span> {formatNigeriaClassName(profile.className)}</p>
            <p><span className="font-semibold text-[var(--color-text-primary)]">Department / track:</span> {profile.departmentTrack ?? "Not applicable"}</p>
            <p><span className="font-semibold text-[var(--color-text-primary)]">Session:</span> {profile.session ?? "Current"}</p>
            <p><span className="font-semibold text-[var(--color-text-primary)]">Term:</span> {profile.term ?? "Current"}</p>
            <p><span className="font-semibold text-[var(--color-text-primary)]">Date of birth:</span> {profile.dateOfBirth ? formatDate(profile.dateOfBirth) : "Not recorded"}</p>
            <p><span className="font-semibold text-[var(--color-text-primary)]">Admission date:</span> {profile.admissionDate ? formatDate(profile.admissionDate) : "Not recorded"}</p>
            <p><span className="font-semibold text-[var(--color-text-primary)]">Status:</span> {profile.status}</p>
            <p><span className="font-semibold text-[var(--color-text-primary)]">Nationality:</span> {profile.nationality ?? "Not recorded"}</p>
            <p><span className="font-semibold text-[var(--color-text-primary)]">State:</span> {profile.stateOfOrigin ?? "Not recorded"}</p>
          </div>
        </article>
        <article className="surface-card p-6">
          <h2 className="font-[var(--font-heading)] text-[18px] font-bold text-[var(--color-text-primary)]">Guardian summary</h2>
          <div className="mt-5 grid gap-3 text-[13px] text-[var(--color-text-secondary)]">
            <p><span className="font-semibold text-[var(--color-text-primary)]">Name:</span> {profile.guardianSummary.name}</p>
            <p><span className="font-semibold text-[var(--color-text-primary)]">Relationship:</span> {profile.guardianSummary.relationship ?? "Guardian"}</p>
            <p><span className="font-semibold text-[var(--color-text-primary)]">Phone:</span> {profile.guardianSummary.phone ?? "Protected"}</p>
            <p><span className="font-semibold text-[var(--color-text-primary)]">Email:</span> {profile.guardianSummary.email ?? "Protected"}</p>
          </div>
        </article>
      </section>

      <section className="grid gap-5 xl:grid-cols-2">
        <article className="surface-card p-6">
          <h2 className="font-[var(--font-heading)] text-[18px] font-bold text-[var(--color-text-primary)]">Enrolled subjects</h2>
          <div className="mt-5 flex flex-wrap gap-2">
            {profile.subjectDetails?.length
              ? profile.subjectDetails.map((subject) => (
                  <span key={subject.id} className="rounded-full bg-[var(--color-bg-subtle)] px-4 py-2 text-[13px] font-semibold text-[var(--color-text-primary)]">
                    {subject.name}
                    {subject.teacherName ? <span className="ml-1 text-[var(--color-text-muted)]">· {subject.teacherName}</span> : null}
                  </span>
                ))
              : profile.subjects.map((subject) => (
                  <span key={subject} className="rounded-full bg-[var(--color-bg-subtle)] px-4 py-2 text-[13px] font-semibold text-[var(--color-text-primary)]">{subject}</span>
                ))}
            {profile.subjects.length === 0 ? <p className="text-[13px] text-[var(--color-text-secondary)]">No subject enrollment found for your class yet.</p> : null}
          </div>
        </article>
        <article className="surface-card p-6">
          <h2 className="font-[var(--font-heading)] text-[18px] font-bold text-[var(--color-text-primary)]">Medical summary</h2>
          <div className="mt-5 grid gap-3 text-[13px] text-[var(--color-text-secondary)]">
            <p><span className="font-semibold text-[var(--color-text-primary)]">Blood group:</span> {profile.medical?.bloodGroup ?? "Not recorded"}</p>
            <p><span className="font-semibold text-[var(--color-text-primary)]">Genotype:</span> {profile.medical?.genotype ?? "Not recorded"}</p>
            <p><span className="font-semibold text-[var(--color-text-primary)]">Allergies:</span> {profile.medical?.allergies ?? "None recorded"}</p>
            <p><span className="font-semibold text-[var(--color-text-primary)]">Conditions:</span> {profile.medical?.conditions ?? "None recorded"}</p>
          </div>
        </article>
      </section>
    </div>
  );
}
