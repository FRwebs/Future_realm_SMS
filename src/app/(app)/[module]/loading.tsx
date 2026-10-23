import { AppLoadingScreen } from "@/components/feedback/app-loading-screen";

/**
 * Fallback for every School Admin module tab.
 *
 * Nested here rather than left to (app)/loading.tsx because only these routes
 * wear ModuleWorkspace's ink header — the parent, student and account surfaces
 * in this same group use the light `.surface-hero`, and a dark hero skeleton
 * over a light page reads as the wrong page loading.
 */
export default function SchoolModuleLoading() {
  return <AppLoadingScreen scope="school" label="Loading module" />;
}
