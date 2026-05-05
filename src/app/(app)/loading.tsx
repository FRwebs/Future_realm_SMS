import { AppLoadingScreen } from "@/components/feedback/app-loading-screen";

export default function AuthenticatedAppLoading() {
  return <AppLoadingScreen scope="dashboard" label="Loading school workspace" />;
}
