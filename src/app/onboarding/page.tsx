import Link from "next/link";
import { Rocket, ShieldCheck, Sparkles } from "lucide-react";

import { OnboardingForm } from "@/components/forms/onboarding-form";

export default function OnboardingPage() {
  return (
    <main className="min-h-screen bg-dashboard-grid px-6 py-10 md:px-10 lg:px-16">
      <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[0.95fr_1.05fr]">
        <section
          className="rounded-[2rem] border border-[var(--color-border-strong)] p-8 text-[var(--color-text-inverse)] shadow-panel md:p-10"
          style={{
            background:
              "linear-gradient(180deg, rgb(var(--color-primary-700-rgb)), color-mix(in srgb, rgb(var(--color-primary-700-rgb)) 84%, var(--color-bg-surface)))"
          }}
        >
          <span className="rounded-full bg-white/10 px-4 py-2 text-sm font-semibold text-[color:rgba(255,255,255,0.8)]">
            FutureRealm SMS
          </span>
          <h1 className="mt-6 font-[var(--font-heading)] text-4xl font-extrabold leading-tight text-white md:text-5xl">
            Register your school and start in minutes.
          </h1>
          <p className="mt-4 max-w-xl text-sm leading-7 text-[color:rgba(255,255,255,0.72)]">
            Create your workspace instantly. No sales calls, no manual approval &mdash; your
            school, owner account, and 14-day trial are provisioned automatically the moment you submit this form.
          </p>
          <div className="mt-8 grid gap-4 md:grid-cols-1">
            {[
              { icon: Rocket, title: "Instant provisioning", detail: "Your tenant, owner login, and onboarding checklist are created automatically." },
              { icon: ShieldCheck, title: "Tenant-safe from day one", detail: "Isolated data, signed cookies, and role-based access from the first login." },
              { icon: Sparkles, title: "14-day free trial", detail: "Explore admissions, academics, finance, and communications with no card required." }
            ].map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.title} className="rounded-[1.5rem] bg-white/10 p-5">
                  <Icon className="h-5 w-5 text-amber" />
                  <p className="mt-4 font-semibold text-white">{item.title}</p>
                  <p className="mt-2 text-sm leading-6 text-[color:rgba(255,255,255,0.68)]">{item.detail}</p>
                </div>
              );
            })}
          </div>
        </section>
        <section className="surface-card grid gap-6 rounded-[2rem] p-8 backdrop-blur md:p-10">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.28em] text-[var(--color-text-accent)]">Get started</p>
            <h2 className="mt-3 font-[var(--font-heading)] text-3xl font-bold text-[var(--color-text-primary)]">Register your school</h2>
            <p className="mt-3 text-sm leading-6 text-[var(--color-text-secondary)]">
              Already have a workspace?{" "}
              <Link href="/login" className="font-semibold text-[var(--color-text-accent)] hover:underline">
                Sign in instead
              </Link>
              .
            </p>
          </div>
          <OnboardingForm />
        </section>
      </div>
    </main>
  );
}
