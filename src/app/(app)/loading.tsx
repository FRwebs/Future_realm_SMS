import { AppLoadingScreen } from "@/components/feedback/app-loading-screen";

/**
 * Fallback for the non-module routes in this group — the parent and student
 * portals, my-children, account.
 *
 * Content-only, like every fallback under a mounted shell: DashboardShell is
 * rendered by this group's layout and stays put while `{children}` is swapped,
 * so anything drawn here sits *inside* the real sidebar and topbar.
 */
export default function AuthenticatedAppLoading() {
  return <AppLoadingScreen scope="portal" label="Loading school workspace" />;
}
