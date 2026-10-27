"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type Overview = {
  person: { name: string; email: string };
  partner: { name: string; code: string | null; tier: string | null; territory: string | null };
  schools: Array<{ name: string; location: string; tier: string; tenureMonths: number; state: string; commission: number }>;
  deals: Array<{ prospect: string; location: string | null; registeredAt: string; validUntil: string; status: string; daysLeft: number }>;
  commission: { accrued: number; statements: Array<{ ref: string; period: string; net: number; status: string; dueAt: string; settledAt: string | null }> };
};

const naira = (value: number) => `₦${Math.round(value).toLocaleString("en-NG")}`;
const day = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
const label = (value: string) => value.charAt(0) + value.slice(1).toLowerCase().replaceAll("_", " ");

function Panel({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) {
  return (
    <section className="overflow-hidden rounded-[14px] border border-[#DEE8E2] bg-white">
      <div className="px-5 pb-3 pt-4">
        <h2 className="text-[14px] font-semibold text-[#0D2315]">{title}</h2>
        {sub ? <p className="mt-1 text-[11.5px] text-[#5f6e65]">{sub}</p> : null}
      </div>
      {children}
    </section>
  );
}

function Table({ head, rows, empty }: { head: string[]; rows: React.ReactNode[][]; empty: string }) {
  if (rows.length === 0) return <p className="px-5 pb-5 text-[12.5px] text-[#5f6e65]">{empty}</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-left">
        <thead>
          <tr>{head.map((h) => <th key={h} className="whitespace-nowrap border-b border-[#E6EEE9] bg-[#F7FAF8] px-5 py-[11px] text-[10.5px] font-semibold uppercase tracking-[0.05em] text-[#5f6e65]">{h}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={index} className="text-[12.5px] text-[#435048]">
              {row.map((cell, cellIndex) => <td key={cellIndex} className="border-b border-[#F2F7F4] px-5 py-[13px]">{cell}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function PartnerDashboard() {
  const router = useRouter();
  const [data, setData] = useState<Overview | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    void fetch("/api/partner-portal/overview", { credentials: "include" }).then(async (response) => {
      if (response.status === 401) return router.replace("/partner/login");
      const body = (await response.json()) as { data?: Overview };
      if (!response.ok || !body.data) return setFailed(true);
      setData(body.data);
    }).catch(() => setFailed(true));
  }, [router]);

  async function signOut() {
    await fetch("/api/partner-portal/logout", { method: "POST", credentials: "include" });
    router.replace("/partner/login");
  }

  if (failed) return <p className="p-10 text-[13px] text-[#B23B3B]">The portal could not be reached. Try again in a moment.</p>;
  if (!data) return <p className="p-10 text-[13px] text-[#5f6e65]">Loading…</p>;

  const active = data.schools.filter((school) => school.state === "ACTIVE").length;
  const openDeals = data.deals.filter((deal) => deal.status === "REGISTERED");
  return (
    <div className="mx-auto grid max-w-[1100px] gap-[14px] px-6 py-8">
      <header className="relative overflow-hidden rounded-[20px] bg-[#0D2315] px-[27px] py-[24px] text-white">
        <div className="relative flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-[9.5px] font-bold uppercase tracking-[0.15em] text-white/55">Partner portal{data.partner.tier ? ` · ${data.partner.tier}` : ""}</p>
            <h1 className="mt-2 font-[var(--font-heading)] text-[26px] font-extrabold tracking-[-0.028em]">{data.partner.name}</h1>
            <p className="mt-2 text-[12px] text-white/60">Reference code {data.partner.code ?? "not yet issued"}{data.partner.territory ? ` · ${data.partner.territory}` : ""} · signed in as {data.person.name}</p>
          </div>
          <button type="button" onClick={signOut} className="rounded-full bg-white px-[18px] py-[11px] text-[11.5px] font-semibold text-[#0D2315]">Sign out</button>
        </div>
      </header>

      <section className="grid gap-3 md:grid-cols-4">
        {[
          ["Schools you brought", String(data.schools.length), `${active} active`],
          ["Open registrations", String(openDeals.length), "Valid for 90 days each"],
          ["Commission accrued", naira(data.commission.accrued), "Not yet on a statement"],
          ["Statements", String(data.commission.statements.length), `${data.commission.statements.filter((s) => s.status === "SETTLED").length} settled`]
        ].map(([title, value, detail]) => (
          <article key={title} className="rounded-[14px] border border-[#DEE8E2] bg-white px-[18px] py-4">
            <p className="text-[10.5px] font-semibold uppercase tracking-[0.05em] text-[#5f6e65]">{title}</p>
            <p className="mt-[11px] font-[var(--font-body)] text-[23px] font-extrabold tracking-[-0.03em] text-[#0D2315]">{value}</p>
            <p className="mt-[7px] text-[11.5px] text-[#5f6e65]">{detail}</p>
          </article>
        ))}
      </section>

      <Panel title="Your schools" sub="The schools registered to you that signed up in the window — name, tier, tenure and state, and what each has earned you">
        <Table
          head={["School", "Tier", "Tenure", "State", "Commission earned"]}
          empty="No school has signed up through one of your registrations yet."
          rows={data.schools.map((school) => [<div key="n"><p className="font-semibold text-[#0D2315]">{school.name}</p><p className="text-[11.5px] text-[#5f6e65]">{school.location || "—"}</p></div>, label(school.tier), `${school.tenureMonths} month${school.tenureMonths === 1 ? "" : "s"}`, label(school.state), naira(school.commission)])}
        />
      </Panel>

      <Panel title="Registered deals" sub="First valid registration wins. A window closing is shown here, so you do not have to ask us">
        <Table
          head={["Prospect school", "Registered", "Valid until", "Status"]}
          empty="You have not registered a deal yet."
          rows={data.deals.map((deal) => [<div key="p"><p className="font-semibold text-[#0D2315]">{deal.prospect}</p><p className="text-[11.5px] text-[#5f6e65]">{deal.location ?? "—"}</p></div>, day(deal.registeredAt), deal.status === "REGISTERED" ? `${day(deal.validUntil)} · ${Math.max(0, deal.daysLeft)} days left` : "—", label(deal.status)])}
        />
      </Panel>

      <Panel title="Statements" sub="What was earned in each period, and when it was settled">
        <Table
          head={["Statement", "Period", "Net commission", "Status", "Settled"]}
          empty="No statement has been issued yet. Commission accrues only when a school’s payment is reconciled."
          rows={data.commission.statements.map((statement) => [statement.ref, statement.period, naira(statement.net), label(statement.status), statement.settledAt ? day(statement.settledAt) : `Due ${day(statement.dueAt)}`])}
        />
      </Panel>

      <p className="px-1 text-[11.5px] leading-[1.6] text-[#5f6e65]">This portal never shows student, staff or guardian data, or what a school pays. Questions about a figure go to your partner manager.</p>
    </div>
  );
}
