import { consentTab, loadConsent } from "@/lib/modules/live/m9-consent";
import { guardiansTab, loadFamilies } from "@/lib/modules/live/m9-guardians";
import { loadSubmissionOptions, loadSubmissions, submissionsTab } from "@/lib/modules/live/m9-submissions";
import type { TabContent } from "@/lib/modules/panels";

/**
 * M09 Parents & Guardians, read from `/api/v1/parents-guardians`.
 *
 * Three readings of one family register: the Guardians (one account per family, however many
 * children), what they have sent in, and the consent the school holds for them.
 */
export async function parentsGuardiansLiveTab(tabSlug: string): Promise<TabContent | undefined> {
  if (tabSlug === "guardians") {
    return guardiansTab(await loadFamilies());
  }
  if (tabSlug === "submissions") {
    const [data, options] = await Promise.all([loadSubmissions(), loadSubmissionOptions()]);
    return submissionsTab(data, options);
  }
  if (tabSlug === "consent") return consentTab(await loadConsent());
  return undefined;
}
