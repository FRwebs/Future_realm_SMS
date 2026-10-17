import { notFound } from "next/navigation";

import { AccessDenied } from "@/components/feedback/access-denied";
import { ModuleWorkspace } from "@/components/modules/module-workspace";
import { VerifyPayment } from "@/components/modules/verify-payment";
import { canOpenModule } from "@/lib/auth/server-access";
import { getServerSession } from "@/lib/auth/session";
import { apiGet } from "@/lib/api/server";
import { SB } from "@/lib/modules/live/m11-forms";

/** The pages Subscription & Billing opens from its tabs: where a payment lands, and where an export is taken. */

async function allowed() {
  const session = await getServerSession();
  if (!session) return null;
  return await canOpenModule(session, "M11");
}

export async function PaymentReturnView({ reference }: { reference?: string }) {
  const ok = await allowed();
  if (ok === null) return null;
  if (!ok) return <AccessDenied backHref="/command-center/today" />;
  return (
    <ModuleWorkspace eyebrow="Subscription & Billing" title="Your payment" description="Checking with the payment provider what happened." rows={[]} back={{ label: "Back to the Plan", href: "/subscription-billing/plan" }}>
      <VerifyPayment reference={reference ?? ""} />
    </ModuleWorkspace>
  );
}

type Grant = { token: string; datasets: Array<{ name: string; rows: number }>; expiresAt: string; downloadedAt: string | null };

export async function ExportView({ token }: { token: string }) {
  const ok = await allowed();
  if (ok === null) return null;
  if (!ok) return <AccessDenied backHref="/command-center/today" />;
  const grant = await apiGet<Grant>(`${SB}/account/export/${encodeURIComponent(token)}`).catch(() => null);
  if (!grant) notFound();
  return (
    <ModuleWorkspace
      eyebrow="Subscription & Billing"
      title="Your full export"
      description={`${grant.datasets.length} datasets, each a CSV that Excel opens. It lapses on ${new Date(grant.expiresAt).toLocaleString("en-GB", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" })}.`}
      rows={[
        {
          cols: "1fr",
          panels: [
            {
              type: "list",
              title: "Download each dataset",
              sub: "Taking any one of them counts as delivering the export, which is what unblocks closure. Every download is logged.",
              items: grant.datasets.map((dataset) => ({ label: dataset.name, sub: `${dataset.rows.toLocaleString("en-NG")} rows`, pill: grant.downloadedAt ? "Downloaded" : "Ready", tone: "positive" as const, viewLabel: "Download", href: `${SB}/account/export/${encodeURIComponent(token)}/${encodeURIComponent(dataset.name)}` })),
            },
          ],
        },
      ]}
      back={{ label: "Back to the Account", href: "/subscription-billing/account" }}
    />
  );
}
