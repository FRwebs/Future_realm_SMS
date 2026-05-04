import { ShieldCheck, Smartphone, Users } from "lucide-react";

import { LoginForm } from "@/components/forms/login-form";

export default function LoginPage() {
  return (
    <main className="min-h-screen bg-dashboard-grid px-6 py-10 md:px-10 lg:px-16">
      <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[0.95fr_1.05fr]">
        <section className="rounded-[2rem] border border-white/50 bg-ink p-8 text-white shadow-panel md:p-10">
          <span className="rounded-full bg-white/10 px-4 py-2 text-sm font-semibold text-white/80">
            FutureRealm SMS
          </span>
          <h1 className="mt-6 font-[var(--font-heading)] text-4xl font-extrabold leading-tight md:text-5xl">
            Secure access for school leaders, staff, parents, and students.
          </h1>
          <p className="mt-4 max-w-xl text-sm leading-7 text-white/72">
            Sign in to manage attendance, results, finance operations, communication workflows,
            and every day-to-day responsibility across the school.
          </p>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {[
              { icon: ShieldCheck, title: "Tenant-safe auth", detail: "Signed cookies, CSRF token, and RBAC guards." },
              { icon: Smartphone, title: "Mobile-friendly", detail: "Portals and admin views remain usable on small screens." },
              { icon: Users, title: "Real school roles", detail: "Principal, teacher, bursar, parent, and student journeys." }
            ].map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.title} className="rounded-[1.5rem] bg-white/10 p-5">
                  <Icon className="h-5 w-5 text-amber" />
                  <p className="mt-4 font-semibold">{item.title}</p>
                  <p className="mt-2 text-sm leading-6 text-white/68">{item.detail}</p>
                </div>
              );
            })}
          </div>
        </section>
        <section className="grid gap-6 rounded-[2rem] border border-white/50 bg-white/90 p-8 shadow-panel md:p-10">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.28em] text-brand-700">Sign in</p>
            <h2 className="mt-3 font-[var(--font-heading)] text-3xl font-bold text-ink">School portal access</h2>
            <p className="mt-3 text-sm leading-6 text-ink/68">
              Enter your school-issued credentials to continue.
            </p>
          </div>
          <LoginForm />
        </section>
      </div>
    </main>
  );
}
