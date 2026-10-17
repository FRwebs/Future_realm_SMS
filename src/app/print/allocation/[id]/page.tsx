import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { PrintControls } from "@/components/modules/print-button";
import { apiGet } from "@/lib/api/server";
import { getServerSession } from "@/lib/auth/session";
import type { FeeStructureView } from "@/lib/domain/types";
import { canOpenModule } from "@/lib/auth/server-access";

export const metadata: Metadata = {
  title: "Allocation list",
  description: "What a class needs for a term, as it is handed to a family.",
};

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ prices?: string }>;
};

type SchoolPayload = { record?: { name: string; motto: string | null; address: string | null; city: string | null; mainPhone: string | null; primaryColor: string | null } };

const naira = (value: number) => `₦${Math.round(value).toLocaleString("en-NG")}`;

/**
 * An allocation as a family receives it: the school's name, the list by category,
 * and — when the school chose to — what each line costs. It is a page rather than
 * a generated file because a page prints, saves as PDF, and can be corrected and
 * printed again in the time it takes to say what was wrong.
 */
export default async function PrintAllocationPage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const { prices } = await searchParams;
  const withPrices = prices === "1";

  const session = await getServerSession();
  if (!session) redirect("/login");
  if (!(await canOpenModule(session, "M02"))) notFound();

  const [structures, school] = await Promise.all([
    apiGet<FeeStructureView[]>("/api/v1/finance/fee-structures").catch(() => [] as FeeStructureView[]),
    apiGet<SchoolPayload>("/api/v1/configuration/school-information").catch(() => null),
  ]);

  const lists =
    id === "all"
      ? (structures ?? []).filter((item) => item.listState === "PUBLISHED" && item.items.length > 0)
      : (structures ?? []).filter((item) => item.id === id);
  if (!lists.length) notFound();

  const schoolName = school?.record?.name ?? "School";
  const place = [school?.record?.address, school?.record?.city].filter(Boolean).join(", ");

  return (
    <main className="mx-auto max-w-[820px] bg-white px-8 py-8 text-[#0D2315] print:max-w-none print:px-0 print:py-0">
      <PrintControls
        backHref={id === "all" ? "/school-configuration/allocations" : `/school-configuration/allocations/${id}`}
        label={`${lists.length} list${lists.length === 1 ? "" : "s"} · ${withPrices ? "with prices" : "without prices"}`}
      />
      {lists.map((list) => {
        const items = list.items.filter((item) => item.isActive);
        const categories = Array.from(new Set(items.map((item) => item.category ?? "Other")));
        const required = items.filter((item) => !item.isOptional && item.audience !== "BOARDERS" && item.audience !== "DAY");
        const requiredTotal = required.reduce((sum, item) => sum + item.amount, 0);
        const optionalTotal = items.filter((item) => item.isOptional).reduce((sum, item) => sum + item.amount, 0);
        return (
          <article key={list.id} className="mb-10 break-after-page last:mb-0 last:break-after-auto">
            <header className="border-b-2 border-[#0D2315] pb-4">
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#6B7A71]">{schoolName}</p>
              <h1 className="mt-1 text-[24px] font-extrabold leading-tight">{list.name}</h1>
              <p className="mt-1 text-[12.5px] text-[#435048]">
                {[list.className ?? "Every class", list.term, list.session].filter(Boolean).join(" · ")}
              </p>
              {place ? <p className="mt-0.5 text-[11.5px] text-[#6B7A71]">{place}</p> : null}
            </header>

            {categories.map((category) => {
              const rows = items.filter((item) => (item.category ?? "Other") === category);
              const subtotal = rows.reduce((sum, item) => sum + item.amount, 0);
              return (
                <section key={category} className="mt-5 break-inside-avoid">
                  <h2 className="mb-1.5 flex items-baseline justify-between text-[13px] font-bold">
                    <span>{category}</span>
                    {withPrices ? <span className="text-[12px] font-semibold text-[#435048]">{naira(subtotal)}</span> : null}
                  </h2>
                  <table className="w-full border-collapse text-[12px]">
                    <thead>
                      <tr className="border-b border-[#CFDDD5] text-left text-[10.5px] uppercase tracking-[0.06em] text-[#6B7A71]">
                        <th className="py-1.5 pr-3 font-semibold">Item</th>
                        <th className="py-1.5 pr-3 font-semibold">Where to buy it</th>
                        <th className="py-1.5 pr-3 text-right font-semibold">Qty</th>
                        {withPrices ? <th className="py-1.5 pr-3 text-right font-semibold">Unit</th> : null}
                        {withPrices ? <th className="py-1.5 text-right font-semibold">Total</th> : null}
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((item) => (
                        <tr key={item.id} className="border-b border-[#EDF3EF] align-top">
                          <td className="py-1.5 pr-3">
                            <span className="font-semibold">{item.label}</span>
                            {item.isOptional ? <span className="ml-1.5 text-[10.5px] text-[#6B7A71]">optional</span> : null}
                            {item.audience === "BOARDERS" ? <span className="ml-1.5 text-[10.5px] text-[#6B7A71]">boarders only</span> : null}
                            {item.audience === "DAY" ? <span className="ml-1.5 text-[10.5px] text-[#6B7A71]">day students only</span> : null}
                            {item.note ? <span className="block text-[11px] text-[#6B7A71]">{item.note}</span> : null}
                          </td>
                          <td className="py-1.5 pr-3 text-[#435048]">{item.source ?? "—"}</td>
                          <td className="py-1.5 pr-3 text-right tabular-nums">{item.quantity ?? 1}</td>
                          {withPrices ? (
                            <td className="py-1.5 pr-3 text-right tabular-nums">
                              {item.showPrice === false ? "—" : naira(item.unitAmount ?? item.amount)}
                            </td>
                          ) : null}
                          {withPrices ? (
                            <td className="py-1.5 text-right font-semibold tabular-nums">
                              {item.showPrice === false ? "—" : naira(item.amount)}
                            </td>
                          ) : null}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </section>
              );
            })}

            {withPrices ? (
              <footer className="mt-5 flex flex-wrap items-baseline justify-between gap-3 border-t-2 border-[#0D2315] pt-3 text-[13px]">
                <span className="font-bold">Required for every child</span>
                <span className="font-extrabold tabular-nums">{naira(requiredTotal)}</span>
                {optionalTotal ? (
                  <span className="basis-full text-[11.5px] text-[#6B7A71]">
                    Optional items add up to {naira(optionalTotal)} if a family takes them all.
                  </span>
                ) : null}
              </footer>
            ) : null}

            {list.familyNote ? <p className="mt-4 text-[12px] italic text-[#435048]">{list.familyNote}</p> : null}
            {list.ownerName ? (
              <p className="mt-3 text-[11.5px] text-[#6B7A71]">Questions about this list: {list.ownerName}.</p>
            ) : null}
          </article>
        );
      })}
    </main>
  );
}
