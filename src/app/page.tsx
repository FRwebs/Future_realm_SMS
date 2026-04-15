import Link from "next/link";
import { ArrowRight, BadgeCheck, Building2, ShieldCheck, Smartphone } from "lucide-react";

const highlights = [
  "Admissions to graduation workflows",
  "WAEC/NECO-friendly grading and report cards",
  "Fees, invoicing, and payment gateway abstractions",
  "Offline draft support for attendance and scores"
];

export default function HomePage() {
  return (
    <main className="min-h-screen bg-dashboard-grid px-6 py-10 md:px-10 lg:px-16">
      <div className="mx-auto flex max-w-7xl flex-col gap-10">
        <section className="grid gap-8 rounded-[2rem] border border-white/60 bg-white/85 p-8 shadow-panel backdrop-blur md:grid-cols-[1.2fr_0.8fr] md:p-12">
          <div className="space-y-6">
            <span className="inline-flex rounded-full bg-brand-100 px-4 py-2 text-sm font-semibold text-brand-800">
              FutureRealm SMS for Nigerian Schools
            </span>
            <div className="space-y-4">
              <h1 className="font-[var(--font-heading)] text-4xl font-extrabold tracking-tight text-ink md:text-6xl">
                One school platform for admissions, academics, finance, and parent engagement.
              </h1>
              <p className="max-w-2xl text-base leading-7 text-ink/75 md:text-lg">
                Built for private schools, public schools, and multi-campus groups with tenancy,
                audit trails, mobile responsiveness, low-bandwidth support, and Nigerian grading
                and fee workflows.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/login"
                className="inline-flex items-center gap-2 rounded-full bg-ink px-5 py-3 text-sm font-semibold text-white transition hover:bg-brand-800"
              >
                Launch demo
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
            <ul className="grid gap-3 md:grid-cols-2">
              {highlights.map((item) => (
                <li key={item} className="flex items-start gap-3 rounded-2xl bg-sand/60 p-4 text-sm text-ink/75">
                  <BadgeCheck className="mt-0.5 h-5 w-5 text-brand-600" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="grid gap-4 rounded-[1.75rem] bg-ink p-6 text-white">
            <div className="rounded-[1.5rem] bg-white/10 p-5">
              <p className="text-sm uppercase tracking-[0.3em] text-white/60">Design pillars</p>
              <div className="mt-4 grid gap-4">
                <div className="rounded-2xl bg-white/10 p-4">
                  <Building2 className="mb-3 h-5 w-5 text-amber" />
                  <p className="text-lg font-bold">Multi-tenant SaaS</p>
                  <p className="mt-1 text-sm text-white/70">
                    Single school or campus group support with row-level tenant isolation.
                  </p>
                </div>
                <div className="rounded-2xl bg-white/10 p-4">
                  <Smartphone className="mb-3 h-5 w-5 text-amber" />
                  <p className="text-lg font-bold">Mobile-first portals</p>
                  <p className="mt-1 text-sm text-white/70">
                    Parents, teachers, and students can use the platform comfortably on phones.
                  </p>
                </div>
                <div className="rounded-2xl bg-white/10 p-4">
                  <ShieldCheck className="mb-3 h-5 w-5 text-amber" />
                  <p className="text-lg font-bold">Security-minded</p>
                  <p className="mt-1 text-sm text-white/70">
                    RBAC, audit trails, input validation, secure cookies, and integration
                    abstractions.
                  </p>
                </div>
              </div>
            </div>
            <p className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm leading-6 text-white/75">
              Demo accounts are seeded for super admin, principal, teacher, bursar, parent, and
              student users so you can explore the role-based experience quickly.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
