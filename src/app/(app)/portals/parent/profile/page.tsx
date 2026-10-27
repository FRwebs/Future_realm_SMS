import Link from "next/link";
import type { Route } from "next";
import { getTranslations } from "next-intl/server";

import { TableCard } from "@/components/data-display/table-card";
import { AccessDenied } from "@/components/feedback/access-denied";
import { PanelRows } from "@/components/modules/panel-renderer";
import { LOCALES } from "@/i18n/locales";
import { apiGet } from "@/lib/api/server";
import { canAccessPath, getDefaultPathForRole } from "@/lib/auth/roles";
import { getServerSession } from "@/lib/auth/session";
import { languagePanel, type AccountWords, type MyProfile } from "@/lib/modules/account";
import { row } from "@/lib/modules/panels";
import { ParentProfileView } from "@/lib/domain/types";
import { formatNigeriaClassName } from "@/lib/school-options";

export default async function ParentProfilePage() {
  const session = await getServerSession();
  if (!session) return null;
  if (!canAccessPath(session.role, "/portals/parent")) {
    return <AccessDenied backHref={getDefaultPathForRole(session.role)} />;
  }

  const [profile, mine] = await Promise.all([
    apiGet<ParentProfileView>("/api/v1/parent-portal/profile"),
    apiGet<MyProfile>("/api/v1/profile/me").catch(() => ({}) as MyProfile),
  ]);
  const t = await getTranslations("shell.account");
  const words: AccountWords = {
    language: t("language"), languageSub: t("languageSub"), languageHint: LOCALES.length > 1 ? t("languageHint") : t("languageHintOff"),
    saved: t("savedLanguage"), save: t("saveLanguage"),
  };

  return (
    <div className="portal-page">
      <section className="surface-hero p-6 md:p-7">
        <Link href={"/portals/parent" as Route} className="text-[13px] font-semibold text-(--color-text-accent)">Back to parent portal</Link>
        <h1 className="mt-3 font-(--font-heading) text-[26px] font-black text-(--color-text-primary)">Parent profile</h1>
        <p className="mt-2 text-[13px] leading-6 text-(--color-text-secondary)">
          Contact details are read-only unless the school enables profile update requests.
        </p>
      </section>
      <section className="surface-card p-6">
        <h2 className="font-(--font-heading) text-[18px] font-bold text-(--color-text-primary)">{profile.parentName}</h2>
        <div className="mt-5 grid gap-3 text-[13px] text-(--color-text-secondary) md:grid-cols-2">
          <p><span className="font-semibold text-(--color-text-primary)">Relationship:</span> {profile.relationship ?? "Guardian"}</p>
          <p><span className="font-semibold text-(--color-text-primary)">Phone:</span> {profile.phone ?? "Not recorded"}</p>
          <p><span className="font-semibold text-(--color-text-primary)">Email:</span> {profile.email ?? "Not recorded"}</p>
          <p><span className="font-semibold text-(--color-text-primary)">Address:</span> {profile.address ?? "Not recorded"}</p>
          <p><span className="font-semibold text-(--color-text-primary)">SMS enabled:</span> {profile.canReceiveSms ? "Yes" : "No"}</p>
          <p><span className="font-semibold text-(--color-text-primary)">Email enabled:</span> {profile.canReceiveEmail ? "Yes" : "No"}</p>
        </div>
      </section>
      <PanelRows rows={[row("1fr", [languagePanel(mine, words)])]} />
      <TableCard
        title="Linked children"
        description="Students attached to this guardian profile."
        items={profile.linkedChildren}
        columns={[
          { key: "studentName", header: "Student", render: (item) => item.studentName },
          { key: "admissionNumber", header: "Admission no.", render: (item) => item.admissionNumber },
          { key: "className", header: "Class", render: (item) => formatNigeriaClassName(item.className) }
        ]}
      />
    </div>
  );
}
