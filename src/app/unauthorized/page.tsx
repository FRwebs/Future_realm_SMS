import type { Metadata } from "next";

import { AccessDenied } from "@/components/feedback/access-denied";
import { getDefaultPathForRole } from "@/lib/auth/roles";
import { getServerSession } from "@/lib/auth/session";

export const metadata: Metadata = {
  title: "Not Authorized | FutureRealm SMS",
  description: "You do not have permission to open this route.",
};

export default async function UnauthorizedPage({
  searchParams,
}: {
  searchParams?: Promise<{ from?: string }>;
}) {
  const session = await getServerSession();
  const params = (await searchParams) ?? {};
  const attemptedPath = typeof params.from === "string" ? params.from : undefined;
  const backHref = session ? getDefaultPathForRole(session.role) : "/login";
  const backLabel = session ? "Open my workspace" : "Go to login";

  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,rgba(248,250,252,0.98),rgba(255,255,255,0.96))] px-4 py-8 md:px-6 md:py-10">
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-5xl items-center justify-center">
        <AccessDenied
          title="You are not authorized to open this page"
          detail={
            attemptedPath
              ? `Your account signed in successfully, but it does not have permission to open ${attemptedPath}. Use a route available to your role, or ask an administrator to review your access.`
              : "Your account signed in successfully, but it does not currently have permission to open this page. Use a route available to your role, or ask an administrator to review your access."
          }
          backHref={backHref}
          backLabel={backLabel}
          showHomeLink={!session}
        />
      </div>
    </main>
  );
}
