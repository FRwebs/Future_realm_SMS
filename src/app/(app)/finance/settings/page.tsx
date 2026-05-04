import { AccessDenied } from "@/components/feedback/access-denied";
import { FinanceSettingsStudio } from "@/components/finance/finance-settings-studio";
import { apiGet } from "@/lib/api/server";
import { getDefaultPathForRole } from "@/lib/auth/roles";
import { canAccessServerPath } from "@/lib/auth/server-access";
import { getServerSession } from "@/lib/auth/session";
import { FinanceSettingsView } from "@/lib/domain/types";

export default async function FinanceSettingsPage() {
  const session = await getServerSession();
  if (!session) return null;
  if (!(await canAccessServerPath(session, "/finance/settings"))) {
    return <AccessDenied backHref={getDefaultPathForRole(session.role)} />;
  }

  const settings = await apiGet<FinanceSettingsView>("/api/v1/bursary/settings");

  return <FinanceSettingsStudio settings={settings} />;
}
