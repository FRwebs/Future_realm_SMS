"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  BarChart3,
  Building2,
  CalendarDays,
  Check,
  ChevronRight,
  CreditCard,
  GraduationCap,
  MessageSquareText,
  Moon,
  PhoneCall,
  School,
  ShieldCheck,
  Sun,
  Users2,
} from "lucide-react";

import { useTheme } from "@/components/theme/theme-provider";
import { AccordionGroup } from "@/components/ui/accordion";
import { useToast } from "@/components/ui/toast-provider";
import { cn } from "@/lib/utils/cn";

const features = [
  {
    icon: Users2,
    title: "Student enrollment",
    description:
      "Handle inquiry to admission with digital forms, screening workflows, and clean student onboarding built for Nigerian schools.",
  },
  {
    icon: CalendarDays,
    title: "Attendance tracking",
    description:
      "Capture daily class attendance, staff presence, and follow-up alerts without slowing teachers down during busy school mornings.",
  },
  {
    icon: GraduationCap,
    title: "Result management",
    description:
      "Manage CA scores, exams, broadsheets, and report cards with WAEC and NECO-friendly academic workflows.",
  },
  {
    icon: CreditCard,
    title: "Fee payment",
    description:
      "Track invoices, balances, receipts, and structured fee plans with Naira-native payment experiences for parents and bursars.",
  },
  {
    icon: BarChart3,
    title: "Timetable management",
    description:
      "Coordinate classes, teachers, periods, and conflicts from one organized timetable system for the full school.",
  },
  {
    icon: MessageSquareText,
    title: "Parent portal",
    description:
      "Give parents visibility into fees, attendance, announcements, and published results from a mobile-friendly portal.",
  },
] as const;

const steps = [
  {
    id: "01",
    title: "Register your school",
    description: "Create your workspace and define the structure that matches your campus, sections, and academic sessions.",
  },
  {
    id: "02",
    title: "Set up school operations",
    description: "Add classes, staff, subjects, fees, and permissions using the same workflows your school already understands.",
  },
  {
    id: "03",
    title: "Manage daily activity",
    description: "Run admissions, attendance, results, fees, and communication from one reliable operating system.",
  },
  {
    id: "04",
    title: "Track outcomes clearly",
    description: "Monitor finances, academic performance, and school activity with dashboards built for leadership decisions.",
  },
] as const;

const testimonials = [
  {
    quote:
      "Future Realm SMS helped us move from scattered spreadsheets to a calm, structured school workflow. Our admissions and fee tracking became far easier to manage.",
    name: "Mrs. Ifeoma Nwosu",
    role: "Proprietress",
    school: "Hillcrest Academy, Abuja",
  },
  {
    quote:
      "The result and attendance workflows feel like they were designed by people who understand real Nigerian school operations. Our staff settled in quickly.",
    name: "Mr. Ayo Balogun",
    role: "Principal",
    school: "Cedar Grove College, Lagos",
  },
  {
    quote:
      "Parents appreciate the visibility, and our leadership team finally has one place to review academics, payments, and communication without chasing paper trails.",
    name: "Dr. Zainab Sule",
    role: "Head of School",
    school: "Royal Oaks Schools, Kano",
  },
] as const;

const pricing = {
  monthly: [
    {
      name: "Basic",
      price: 35000,
      summary: "For growing single-campus schools getting organized for the first time.",
      features: ["Admissions workflow", "Attendance tracking", "Parent portal", "Basic reports"],
      cta: "Get Started",
      featured: false,
    },
    {
      name: "Standard",
      price: 85000,
      summary: "For established schools running academics, finance, and communication in one place.",
      features: ["Everything in Basic", "Results and broadsheets", "Fee management", "Role-based portals", "Priority onboarding"],
      cta: "Get Started",
      featured: true,
    },
    {
      name: "Premium",
      price: 160000,
      summary: "For multi-branch institutions that need deeper control, visibility, and premium support.",
      features: ["Everything in Standard", "Multi-campus support", "Advanced operations modules", "Executive reporting", "Dedicated success support"],
      cta: "Get Started",
      featured: false,
    },
  ],
  annual: [
    {
      name: "Basic",
      price: 350000,
      summary: "For growing single-campus schools getting organized for the first time.",
      features: ["Admissions workflow", "Attendance tracking", "Parent portal", "Basic reports"],
      cta: "Get Started",
      featured: false,
    },
    {
      name: "Standard",
      price: 850000,
      summary: "For established schools running academics, finance, and communication in one place.",
      features: ["Everything in Basic", "Results and broadsheets", "Fee management", "Role-based portals", "Priority onboarding"],
      cta: "Get Started",
      featured: true,
    },
    {
      name: "Premium",
      price: 1600000,
      summary: "For multi-branch institutions that need deeper control, visibility, and premium support.",
      features: ["Everything in Standard", "Multi-campus support", "Advanced operations modules", "Executive reporting", "Dedicated success support"],
      cta: "Get Started",
      featured: false,
    },
  ],
} as const;

const faqItems = [
  {
    id: "faq-waec",
    title: "Can Future Realm SMS support WAEC and NECO-style result workflows?",
    summary: "Yes, it is designed around Nigerian grading realities.",
    content:
      "The platform supports continuous assessment, exam score entry, broadsheets, report cards, and result workflows that align well with WAEC and NECO-oriented school reporting structures.",
  },
  {
    id: "faq-branches",
    title: "Can we manage more than one school branch?",
    summary: "Yes, especially on higher plans.",
    content:
      "Future Realm SMS is built with multi-tenant and multi-campus scenarios in mind, making it suitable for school groups that want branch-level structure with leadership visibility.",
  },
  {
    id: "faq-offline",
    title: "Does it work well when internet quality is unstable?",
    summary: "It is built with low-bandwidth realities in mind.",
    content:
      "The product is optimized for mobile and practical school use, and some workflows are designed to be more resilient during inconsistent connectivity so staff can keep moving.",
  },
  {
    id: "faq-parents",
    title: "Will parents be able to see fees, attendance, and results?",
    summary: "Yes, through the parent portal.",
    content:
      "Parents can be given access to a dedicated portal where they can monitor attendance, view published results, track fee balances, and stay updated through announcements and notifications.",
  },
  {
    id: "faq-onboarding",
    title: "Can your team help with setup and onboarding for our staff?",
    summary: "Yes, onboarding is part of the rollout experience.",
    content:
      "From configuration to data setup and team orientation, the rollout can be structured to match the size and operational maturity of your school.",
  },
] as const;

type BillingMode = keyof typeof pricing;

function RevealSection({
  children,
  className,
  delay = 0,
  id,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  id?: string;
}) {
  return (
    <section
      id={id}
      className={cn(
        "motion-safe:translate-y-4 motion-safe:animate-[fade-up_560ms_ease-out_both]",
        className,
      )}
      style={{ animationDelay: `${delay}ms` }}
    >
      {children}
    </section>
  );
}

function formatPrice(amount: number) {
  return `₦${amount.toLocaleString("en-NG")}`;
}

export function FutureRealmLandingPage() {
  const [billingMode, setBillingMode] = useState<BillingMode>("annual");
  const [newsletterEmail, setNewsletterEmail] = useState("");
  const [mounted, setMounted] = useState(false);
  const { theme, toggleTheme } = useTheme();
  const { showToast } = useToast();

  const plans = useMemo(() => pricing[billingMode], [billingMode]);

  useEffect(() => {
    setMounted(true);
  }, []);

  function handleNewsletterSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!newsletterEmail.trim() || !newsletterEmail.includes("@")) {
      showToast({
        variant: "error",
        title: "Enter a valid email",
        description: "Please provide a working email address so we can share product updates.",
      });
      return;
    }

    showToast({
      variant: "success",
      title: "You are on the list",
      description: "We will share Future Realm SMS updates, demos, and rollout news with you.",
    });
    setNewsletterEmail("");
  }

  return (
    <main className="min-h-screen bg-dashboard-grid px-4 py-6 sm:px-6 md:px-10 lg:px-16">
      <div className="mx-auto flex max-w-7xl flex-col gap-6 md:gap-8">
        <RevealSection className="surface-hero page-shell-enter relative p-6 md:p-10" delay={40}>
          <div className="mb-6 flex items-start justify-between gap-4">
            <div className="inline-flex items-center gap-3 rounded-full border border-[var(--color-border-strong)] bg-[var(--color-bg-overlay)] px-4 py-2 text-[12px] font-semibold text-[var(--color-text-accent)] shadow-[var(--shadow-sm)]">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--color-accent-primary)] text-[var(--color-text-inverse)]">
                <School className="h-4 w-4" />
              </span>
              <span>Future Realm SMS</span>
            </div>

            <button
              type="button"
              onClick={toggleTheme}
              className="group inline-flex h-12 items-center gap-3 rounded-full border border-[var(--color-border-default)] bg-[var(--color-bg-surface)]/92 px-2.5 py-1.5 text-sm font-semibold text-[var(--color-text-primary)] shadow-[var(--shadow-sm)] transition hover:border-[var(--color-border-strong)] hover:bg-[var(--color-bg-elevated)]"
              aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
              title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
            >
              <span className="relative flex h-8 w-[4.5rem] items-center rounded-full border border-[var(--color-border-default)] bg-[var(--color-bg-overlay)] px-1">
                <span
                  className={cn(
                    "absolute top-1/2 h-6 w-6 -translate-y-1/2 rounded-full bg-[var(--color-accent-primary)] shadow-[0_8px_18px_var(--color-accent-primary-glow)] transition-all duration-300 ease-out",
                    mounted ? (theme === "dark" ? "translate-x-[2.1rem]" : "translate-x-0") : "translate-x-0",
                  )}
                />
                <span className="relative z-10 flex w-full items-center justify-between px-[1px]">
                  <span
                    className={cn(
                      "flex h-6 w-6 items-center justify-center transition-colors duration-200",
                      mounted && theme === "light"
                        ? "text-[var(--color-text-inverse)]"
                        : "text-[var(--color-text-secondary)] group-hover:text-[var(--color-text-accent)]",
                    )}
                  >
                    <Sun className="h-3.5 w-3.5" />
                  </span>
                  <span
                    className={cn(
                      "flex h-6 w-6 items-center justify-center transition-colors duration-200",
                      mounted && theme === "dark"
                        ? "text-[var(--color-text-inverse)]"
                        : "text-[var(--color-text-secondary)] group-hover:text-[var(--color-text-accent)]",
                    )}
                  >
                    <Moon className="h-3.5 w-3.5" />
                  </span>
                </span>
              </span>
              <span className="hidden min-w-[5.5rem] text-left sm:inline">
                {mounted ? (theme === "dark" ? "Dark mode" : "Light mode") : "Theme"}
              </span>
            </button>
          </div>

          <div className="grid gap-8 lg:grid-cols-[1.15fr_0.85fr] lg:items-center">
            <div className="space-y-6">
              <div className="space-y-4">
                <p className="section-eyebrow">Built for Nigerian Schools</p>
                <h1 className="max-w-4xl font-[var(--font-heading)] text-4xl font-black tracking-tight text-[var(--color-text-primary)] sm:text-5xl lg:text-6xl">
                  Empowering Nigerian Schools with Smarter Management
                </h1>
                <p className="max-w-2xl text-base leading-7 text-[var(--color-text-secondary)] md:text-lg">
                  Run admissions, academics, fees, communication, and daily operations from one
                  modern platform designed for private schools, faith-based schools, and multi-branch
                  institutions across Nigeria.
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                <Link href="/onboarding" className="btn-primary rounded-full px-5">
                  Get Started
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <a href="#pricing" className="btn-secondary rounded-full px-5">
                  Book a Demo
                  <ChevronRight className="h-4 w-4" />
                </a>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                {[
                  { label: "Multi-role portals", value: "Students, parents, teachers, leadership" },
                  { label: "School-ready finance", value: "Invoices, receipts, Naira-native billing" },
                  { label: "Academic confidence", value: "Attendance, broadsheets, report cards" },
                ].map((item) => (
                  <div
                    key={item.label}
                    className="rounded-[1.4rem] border border-[var(--color-border-default)] bg-[var(--color-bg-surface)]/88 p-4 shadow-[var(--shadow-sm)]"
                  >
                    <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--color-text-accent)]">
                      {item.label}
                    </p>
                    <p className="mt-2 text-sm leading-6 text-[var(--color-text-secondary)]">{item.value}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid gap-4">
              <div className="rounded-[1.8rem] border border-[var(--color-border-strong)] bg-[var(--color-bg-surface)]/90 p-5 shadow-[var(--shadow-md)]">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[var(--color-text-accent)]">
                      School Operations Command
                    </p>
                    <h2 className="mt-2 font-[var(--font-heading)] text-2xl font-bold text-[var(--color-text-primary)]">
                      One reliable operating system
                    </h2>
                  </div>
                  <span className="rounded-full bg-[var(--color-accent-primary-dim)] px-3 py-1 text-[11px] font-semibold text-[var(--color-text-accent)]">
                    Lagos-ready
                  </span>
                </div>

                <div className="mt-5 grid gap-3">
                  {[
                    {
                      title: "Admissions",
                      subtitle: "Application to enrollment",
                      icon: Building2,
                    },
                    {
                      title: "Academics",
                      subtitle: "Results, timetables, attendance",
                      icon: GraduationCap,
                    },
                    {
                      title: "Finance",
                      subtitle: "Fees, invoices, and receipts",
                      icon: CreditCard,
                    },
                    {
                      title: "Communication",
                      subtitle: "Parent and staff visibility",
                      icon: PhoneCall,
                    },
                  ].map((item, index) => {
                    const Icon = item.icon;
                    return (
                      <div
                        key={item.title}
                        className="flex items-center gap-4 rounded-[1.35rem] border border-[var(--color-border-default)] bg-[var(--color-bg-overlay)]/70 p-4 motion-safe:animate-[fade-up_520ms_ease-out_both]"
                        style={{ animationDelay: `${160 + index * 90}ms` }}
                      >
                        <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--color-accent-primary)] text-[var(--color-text-inverse)] shadow-[0_10px_20px_var(--color-accent-primary-glow)]">
                          <Icon className="h-5 w-5" />
                        </span>
                        <div>
                          <p className="font-semibold text-[var(--color-text-primary)]">{item.title}</p>
                          <p className="text-sm text-[var(--color-text-secondary)]">{item.subtitle}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="rounded-[1.7rem] border border-[var(--color-border-default)] bg-[var(--color-bg-surface)]/88 p-5 shadow-[var(--shadow-sm)]">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-[var(--color-text-primary)]">Trusted for real school workflows</p>
                    <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                      From morning attendance to end-of-term reporting, every step feels purposeful.
                    </p>
                  </div>
                  <ShieldCheck className="h-6 w-6 text-[var(--color-text-accent)]" />
                </div>
              </div>
            </div>
          </div>
        </RevealSection>

        <RevealSection id="features" className="grid gap-4" delay={120}>
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="section-eyebrow">Key Features</p>
              <h2 className="mt-2 font-[var(--font-heading)] text-3xl font-bold text-[var(--color-text-primary)] md:text-4xl">
                Everything a modern Nigerian school needs to run well
              </h2>
            </div>
            <p className="max-w-2xl text-sm leading-6 text-[var(--color-text-secondary)]">
              The platform is structured to support daily school operations without forcing staff into bloated workflows.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {features.map((feature, index) => {
              const Icon = feature.icon;
              return (
                <article
                  key={feature.title}
                  className="surface-card rounded-[1.7rem] p-5 motion-safe:animate-[fade-up_520ms_ease-out_both]"
                  style={{ animationDelay: `${180 + index * 70}ms` }}
                >
                  <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--color-accent-primary-dim)] text-[var(--color-text-accent)]">
                    <Icon className="h-5 w-5" />
                  </span>
                  <h3 className="mt-4 font-[var(--font-heading)] text-2xl font-bold text-[var(--color-text-primary)]">
                    {feature.title}
                  </h3>
                  <p className="mt-3 text-sm leading-7 text-[var(--color-text-secondary)]">
                    {feature.description}
                  </p>
                </article>
              );
            })}
          </div>
        </RevealSection>

        <RevealSection className="surface-card rounded-[1.9rem] p-6 md:p-8" delay={180}>
          <div className="flex flex-col gap-3">
            <p className="section-eyebrow">How It Works</p>
            <h2 className="font-[var(--font-heading)] text-3xl font-bold text-[var(--color-text-primary)] md:text-4xl">
              From setup to school-wide control in four clear steps
            </h2>
          </div>

          <div className="mt-8 grid gap-4 lg:grid-cols-4">
            {steps.map((step, index) => (
              <article
                key={step.id}
                className="relative overflow-hidden rounded-[1.6rem] border border-[var(--color-border-default)] bg-[var(--color-bg-overlay)]/68 p-5 motion-safe:animate-[fade-up_540ms_ease-out_both]"
                style={{ animationDelay: `${220 + index * 90}ms` }}
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[var(--color-text-accent)]">
                    Step {step.id}
                  </span>
                  <span className="rounded-full border border-[var(--color-border-strong)] px-3 py-1 text-xs font-semibold text-[var(--color-text-primary)]">
                    {index < steps.length - 1 ? "Next" : "Launch"}
                  </span>
                </div>
                <h3 className="mt-6 font-[var(--font-heading)] text-2xl font-bold text-[var(--color-text-primary)]">
                  {step.title}
                </h3>
                <p className="mt-3 text-sm leading-7 text-[var(--color-text-secondary)]">{step.description}</p>
              </article>
            ))}
          </div>
        </RevealSection>

        <RevealSection className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]" delay={240}>
          <div className="surface-card rounded-[1.8rem] p-6 md:p-8">
            <p className="section-eyebrow">Testimonials</p>
            <h2 className="mt-3 font-[var(--font-heading)] text-3xl font-bold text-[var(--color-text-primary)] md:text-4xl">
              School leaders want clarity, not complexity
            </h2>
            <p className="mt-4 text-sm leading-7 text-[var(--color-text-secondary)]">
              These fictional examples reflect the kinds of outcomes Nigerian school administrators care about most.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            {testimonials.map((item, index) => (
              <article
                key={item.name}
                className="surface-card rounded-[1.7rem] p-5 motion-safe:animate-[fade-up_540ms_ease-out_both]"
                style={{ animationDelay: `${260 + index * 90}ms` }}
              >
                <p className="text-sm leading-7 text-[var(--color-text-secondary)]">“{item.quote}”</p>
                <div className="mt-5 border-t border-[var(--color-border-default)] pt-4">
                  <p className="font-semibold text-[var(--color-text-primary)]">{item.name}</p>
                  <p className="text-sm text-[var(--color-text-secondary)]">
                    {item.role} · {item.school}
                  </p>
                </div>
              </article>
            ))}
          </div>
        </RevealSection>

        <RevealSection id="pricing" className="surface-hero rounded-[2rem] p-6 md:p-8" delay={300}>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="section-eyebrow">Pricing</p>
              <h2 className="mt-3 font-[var(--font-heading)] text-3xl font-bold text-[var(--color-text-primary)] md:text-4xl">
                Simple pricing for schools at different stages
              </h2>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-[var(--color-text-secondary)]">
                Choose the plan that matches your current size and operational depth. Annual plans are ideal for schools planning around full academic sessions.
              </p>
            </div>

            <div className="inline-flex rounded-full border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] p-1 shadow-[var(--shadow-sm)]">
              {(["monthly", "annual"] as BillingMode[]).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setBillingMode(mode)}
                  className={cn(
                    "rounded-full px-4 py-2 text-sm font-semibold transition",
                    billingMode === mode
                      ? "bg-[var(--color-accent-primary)] text-[var(--color-text-inverse)] shadow-[0_10px_20px_var(--color-accent-primary-glow)]"
                      : "text-[var(--color-text-secondary)]",
                  )}
                >
                  {mode === "monthly" ? "Monthly" : "Annual"}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-8 grid gap-4 xl:grid-cols-3">
            {plans.map((plan, index) => (
              <article
                key={plan.name}
                className={cn(
                  "rounded-[1.8rem] border p-6 shadow-[var(--shadow-sm)] motion-safe:animate-[fade-up_560ms_ease-out_both]",
                  plan.featured
                    ? "border-[var(--color-accent-primary)] bg-[var(--color-bg-surface)] shadow-[0_18px_40px_var(--color-accent-primary-glow)]"
                    : "border-[var(--color-border-default)] bg-[var(--color-bg-surface)]/88",
                )}
                style={{ animationDelay: `${320 + index * 90}ms` }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-[var(--font-heading)] text-2xl font-bold text-[var(--color-text-primary)]">
                      {plan.name}
                    </p>
                    <p className="mt-2 text-sm leading-6 text-[var(--color-text-secondary)]">{plan.summary}</p>
                  </div>
                  {plan.featured ? (
                    <span className="rounded-full bg-[var(--color-accent-primary-dim)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--color-text-accent)]">
                      Popular
                    </span>
                  ) : null}
                </div>

                <div className="mt-6">
                  <p className="font-[var(--font-heading)] text-4xl font-black text-[var(--color-text-primary)]">
                    {formatPrice(plan.price)}
                  </p>
                  <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                    {billingMode === "monthly" ? "per month" : "per year"}
                  </p>
                </div>

                <ul className="mt-6 grid gap-3">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-3 text-sm text-[var(--color-text-secondary)]">
                      <span className="mt-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-[var(--color-accent-primary-dim)] text-[var(--color-text-accent)]">
                        <Check className="h-3.5 w-3.5" />
                      </span>
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>

                <div className="mt-7">
                  <Link href="/onboarding" className={plan.featured ? "btn-primary w-full rounded-full" : "btn-secondary w-full rounded-full"}>
                    {plan.cta}
                  </Link>
                </div>
              </article>
            ))}
          </div>
        </RevealSection>

        <RevealSection id="faq" className="grid gap-4 lg:grid-cols-[0.85fr_1.15fr]" delay={360}>
          <div className="surface-card rounded-[1.8rem] p-6 md:p-8">
            <p className="section-eyebrow">FAQ</p>
            <h2 className="mt-3 font-[var(--font-heading)] text-3xl font-bold text-[var(--color-text-primary)] md:text-4xl">
              Common questions from school owners and administrators
            </h2>
            <p className="mt-4 text-sm leading-7 text-[var(--color-text-secondary)]">
              Clear answers for schools evaluating digital transformation without losing the realities of Nigerian school operations.
            </p>
          </div>

          <AccordionGroup
            items={faqItems.map((item) => ({
              ...item,
              content: <p className="text-sm leading-7 text-[var(--color-text-secondary)]">{item.content}</p>,
            }))}
            defaultOpenId={faqItems[0].id}
          />
        </RevealSection>

        <RevealSection className="surface-card rounded-[1.9rem] p-6 md:p-8" delay={420}>
          <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr]">
            <div className="space-y-4">
              <div className="inline-flex items-center gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--color-accent-primary)] text-[var(--color-text-inverse)]">
                  <School className="h-5 w-5" />
                </span>
                <div>
                  <p className="font-[var(--font-heading)] text-2xl font-bold text-[var(--color-text-primary)]">Future Realm SMS</p>
                  <p className="text-sm text-[var(--color-text-secondary)]">Built for modern Nigerian schools</p>
                </div>
              </div>

              <p className="max-w-xl text-sm leading-7 text-[var(--color-text-secondary)]">
                A school management platform for admissions, academics, finance, operations, and communication, designed to help school leaders run calmer and smarter institutions.
              </p>

              <div className="grid gap-2 text-sm text-[var(--color-text-secondary)]">
                <p>12 Admiralty Way, Lekki Phase 1, Lagos, Nigeria</p>
                <p>+234 800 000 0000</p>
                <p>hello@futurerealm.sms</p>
              </div>

              <div className="flex gap-3">
                {["Instagram", "LinkedIn", "X"].map((item) => (
                  <a
                    key={item}
                    href="#"
                    className="inline-flex h-10 items-center justify-center rounded-full border border-[var(--color-border-default)] px-4 text-sm font-semibold text-[var(--color-text-secondary)] transition hover:border-[var(--color-accent-primary)] hover:text-[var(--color-text-accent)]"
                  >
                    {item}
                  </a>
                ))}
              </div>
            </div>

            <div className="grid gap-6 md:grid-cols-[0.7fr_1.3fr]">
              <div className="grid gap-2">
                {[
                  { label: "Home", href: "/" },
                  { label: "Features", href: "#features" },
                  { label: "Pricing", href: "#pricing" },
                  { label: "FAQ", href: "#faq" },
                  { label: "Login", href: "/login" },
                ].map((item) => (
                  item.href.startsWith("/") ? (
                    <Link
                      key={item.label}
                      href={item.href}
                      className="text-sm font-medium text-[var(--color-text-secondary)] transition hover:text-[var(--color-text-accent)]"
                    >
                      {item.label}
                    </Link>
                  ) : (
                    <a
                      key={item.label}
                      href={item.href}
                      className="text-sm font-medium text-[var(--color-text-secondary)] transition hover:text-[var(--color-text-accent)]"
                    >
                      {item.label}
                    </a>
                  )
                ))}
              </div>

              <div className="rounded-[1.6rem] border border-[var(--color-border-default)] bg-[var(--color-bg-overlay)]/72 p-5">
                <p className="font-[var(--font-heading)] text-2xl font-bold text-[var(--color-text-primary)]">
                  Join the newsletter
                </p>
                <p className="mt-2 text-sm leading-6 text-[var(--color-text-secondary)]">
                  Get launch notes, product updates, and rollout insights for school leaders.
                </p>
                <form onSubmit={handleNewsletterSubmit} className="mt-4 flex flex-col gap-3 sm:flex-row">
                  <input
                    type="email"
                    value={newsletterEmail}
                    onChange={(event) => setNewsletterEmail(event.target.value)}
                    placeholder="Enter your email"
                    className="h-11 flex-1 rounded-full border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] px-4 text-sm text-[var(--color-text-primary)] outline-none transition focus:border-[var(--color-border-focus)]"
                  />
                  <button type="submit" className="btn-primary rounded-full px-5">
                    Subscribe
                  </button>
                </form>
              </div>
            </div>
          </div>
        </RevealSection>
      </div>
    </main>
  );
}
