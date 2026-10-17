import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { PrintControls } from "@/components/modules/print-button";
import { apiGet } from "@/lib/api/server";
import { canOpenModule } from "@/lib/auth/server-access";
import { getServerSession } from "@/lib/auth/session";
import { naira } from "@/lib/modules/live/m10-forms";
import { loadStructure } from "@/lib/modules/live/m10-structures";

export const metadata: Metadata = { title: "Fee structure", description: "What a family on this structure is charged, as it is handed over." };

type SchoolPayload = { record?: { name: string; address: string | null; city: string | null; mainPhone: string | null } };

/** A fee structure as a family would read it: the letterhead, the classes, and every line with its price. */
export default async function PrintStructurePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getServerSession();
  if (!session) redirect("/login");
  if (!(await canOpenModule(session, "M10"))) notFound();
  const [structure, school] = await Promise.all([loadStructure(id).catch(() => null), apiGet<SchoolPayload>("/api/v1/configuration/school-information").catch(() => null)]);
  if (!structure) notFound();
  const groups = ["Termly", "Sessional", "Once"].map((freq) => ({ freq, items: structure.items.filter((item) => item.freq === freq) })).filter((group) => group.items.length);

  return (
    <main className="mx-auto max-w-[820px] bg-white px-8 py-8 text-[#0D2315] print:max-w-none print:px-0 print:py-0">
      <PrintControls backHref={`/fee-management/structures/${id}`} label={`${structure.ref} · ${structure.state}`} />
      <section className="rounded-[12px] border border-[#DEE8E2] p-8 print:rounded-none print:border-0">
        <header className="border-b-2 border-[#0D2315] pb-4">
          <h1 className="text-[18px] font-extrabold">{school?.record?.name ?? "School"}</h1>
          <p className="mt-1 text-[11px] text-[#5F6E65]">{[school?.record?.address, school?.record?.city, school?.record?.mainPhone].filter(Boolean).join(" · ")}</p>
        </header>
        <div className="mt-4 flex items-baseline justify-between gap-4">
          <div>
            <p className="text-[9px] font-bold uppercase tracking-[0.1em] text-[#8C9A92]">Fee structure · {structure.ref}</p>
            <h2 className="mt-1 text-[16px] font-extrabold">{structure.name}</h2>
            <p className="mt-1 text-[11px] text-[#5F6E65]">For {structure.classes.join(", ") || "classes to be confirmed"}{structure.termLabel ? ` · ${structure.termLabel}` : ""}</p>
          </div>
          {structure.state === "Draft" ? <p className="rounded-[8px] border-2 border-[#B8860B] px-3 py-1 text-[12px] font-extrabold tracking-[0.14em] text-[#B8860B]">DRAFT</p> : null}
        </div>
        {groups.map((group) => (
          <table key={group.freq} className="mt-5 w-full overflow-hidden rounded-[9px] border border-[#E6EEE9] text-[11.5px]">
            <thead className="bg-[#F7FAF8] text-[8.5px] uppercase tracking-[0.06em] text-[#8C9A92]">
              <tr>
                <th className="px-3 py-2 text-left">{group.freq === "Termly" ? "Charged each term" : group.freq === "Sessional" ? "Charged once a session" : "Charged once"}</th>
                <th className="px-3 py-2 text-left">Type</th>
                <th className="px-3 py-2 text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {group.items.map((item, index) => (
                <tr key={item.id} className={index % 2 ? "bg-[#FBFDFC]" : ""}>
                  <td className="px-3 py-[7px] font-medium">{item.name}</td>
                  <td className="px-3 py-[7px] text-[#5F6E65]">{item.type}</td>
                  <td className="px-3 py-[7px] text-right font-mono font-bold">{naira(item.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ))}
        <div className="mt-5 grid grid-cols-3 gap-3">
          {[
            ["Compulsory each term", naira(structure.termly)],
            ["Every item, each term", naira(structure.termlyAll)],
            ["Charged once a session", naira(structure.sessional)],
          ].map(([label, value]) => (
            <div key={label} className="rounded-[9px] border border-[#E6EEE9] bg-[#F7FAF8] px-3 py-[10px]">
              <p className="text-[8.5px] font-bold uppercase tracking-[0.07em] text-[#77857C]">{label}</p>
              <p className="mt-1 font-mono text-[15px] font-extrabold">{value}</p>
            </div>
          ))}
        </div>
        <p className="mt-5 border-t border-[#EDF3EF] pt-3 text-[9.5px] leading-[1.55] text-[#8C9A92]">An optional item is billed only to the families who elect it. Discounts and concessions appear as their own line on the invoice.</p>
      </section>
    </main>
  );
}
