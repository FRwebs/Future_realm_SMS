"use client";

import type { Route } from "next";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  BarChart3,
  Bell,
  Brain,
  Building2,
  CalendarDays,
  Check,
  ChevronRight,
  CreditCard,
  GraduationCap,
  LineChart,
  Lock,
  MessageCircle,
  MessageSquareText,
  Moon,
  PhoneCall,
  Receipt,
  School,
  Send,
  ShieldCheck,
  Sparkles,
  Star,
  Sun,
  TrendingUp,
  Users2,
  Wallet,
  Wifi,
  WifiOff,
  Zap,
} from "lucide-react";

import { useTheme } from "@/components/theme/theme-provider";
import { AccordionGroup } from "@/components/ui/accordion";
import { useToast } from "@/components/ui/toast-provider";
import { cn } from "@/lib/utils/cn";

const navLinks = [
  { label: "Features", href: "#features" },
  { label: "Platform", href: "#platform" },
  { label: "Pricing", href: "#pricing" },
  { label: "FAQ", href: "#faq" },
] as const;

const heroStats = [
  { value: "6", label: "Modules in one platform" },
  { value: "4", label: "Role-based portals" },
  { value: "99.9%", label: "Uptime target" },
  { value: "24/7", label: "Priority support" },
] as const;

const trustLogos = [
  "Hillcrest Academy",
  "Cedar Grove College",
  "Royal Oaks Schools",
  "Greenfield College",
  "Bright Future Schools",
  "Crescent High",
] as const;

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

const platformHighlights = [
  {
    icon: LineChart,
    eyebrow: "Leadership Intelligence",
    title: "See the whole school at a glance",
    description:
      "Live dashboards bring admissions, academics, finance, and attendance into a single command center so leadership decisions are made on evidence, not guesswork.",
    points: ["Enrollment and revenue trends", "Fee collection health", "Academic performance signals"],
  },
  {
    icon: Wallet,
    eyebrow: "Finance & Fees",
    title: "Fee collection that finally reconciles",
    description:
      "Structured fee plans, invoices, receipts, and balances in Naira-native workflows that bursars trust and parents actually understand.",
    points: ["Automated invoices and receipts", "Balance and arrears tracking", "Term and session fee plans"],
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

const trustPillars = [
  { icon: ShieldCheck, title: "Bank-grade security", description: "Role-based access, audit trails, and encrypted data by default." },
  { icon: Wifi, title: "Low-bandwidth ready", description: "Optimized for mobile and resilient during inconsistent connectivity." },
  { icon: Lock, title: "Your data, protected", description: "NDPC-conscious privacy controls and clear data ownership." },
  { icon: Bell, title: "Always in the loop", description: "Announcements and alerts reach parents and staff instantly." },
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

const standoutFeatures = [
  {
    icon: MessageCircle,
    tag: "WhatsApp integration",
    title: "Meet parents where they already are",
    description:
      "Push results, fee reminders, and announcements straight to WhatsApp — the highest open-rate channel Nigerian parents actually check every day.",
    highlights: ["Automated result alerts", "Fee & payment reminders", "Two-way parent messaging"],
    large: true,
  },
  {
    icon: Brain,
    tag: "AI learning recommendations",
    title: "Spot struggling students before it is too late",
    description:
      "AI reads performance and attendance patterns to flag at-risk students early and recommend focused interventions your teachers can act on.",
    highlights: ["Early risk detection", "Personalized study focus", "Class performance insights"],
    large: true,
  },
] as const;

const capabilityChips = [
  { icon: Zap, title: "Automated result computation", description: "CA plus exams roll into report cards instantly — no manual broadsheet maths." },
  { icon: Receipt, title: "Instant fee reconciliation", description: "Payments match invoices automatically so bursars stop chasing balances." },
  { icon: WifiOff, title: "Offline-first workflows", description: "Keep taking attendance and entering scores through weak connectivity." },
  { icon: Send, title: "Bulk SMS, email & in-app", description: "Reach the whole school — or one class — in a couple of clicks." },
] as const;

const pricing = {
  monthly: [
    {
      name: "Basic",
      price: 35000,
      summary: "For growing single-campus schools getting organized for the first time.",
      features: ["Admissions workflow", "Attendance tracking", "Parent portal", "SMS & email alerts", "Basic reports"],
      cta: "Get Started",
      featured: false,
    },
    {
      name: "Standard",
      price: 85000,
      summary: "For established schools that want communication and automation working together.",
      features: [
        "Everything in Basic",
        "WhatsApp parent notifications",
        "Results & broadsheets",
        "Automated result computation",
        "Fee management & reconciliation",
        "Role-based portals",
        "Priority onboarding",
      ],
      cta: "Get Started",
      featured: true,
    },
    {
      name: "Premium",
      price: 160000,
      summary: "For multi-branch institutions that want AI insight and deeper control.",
      features: [
        "Everything in Standard",
        "AI learning recommendations",
        "Executive AI reporting",
        "Multi-campus support",
        "Advanced operations modules",
        "Dedicated success support",
      ],
      cta: "Get Started",
      featured: false,
    },
  ],
  annual: [
    {
      name: "Basic",
      price: 350000,
      summary: "For growing single-campus schools getting organized for the first time.",
      features: ["Admissions workflow", "Attendance tracking", "Parent portal", "SMS & email alerts", "Basic reports"],
      cta: "Get Started",
      featured: false,
    },
    {
      name: "Standard",
      price: 850000,
      summary: "For established schools that want communication and automation working together.",
      features: [
        "Everything in Basic",
        "WhatsApp parent notifications",
        "Results & broadsheets",
        "Automated result computation",
        "Fee management & reconciliation",
        "Role-based portals",
        "Priority onboarding",
      ],
      cta: "Get Started",
      featured: true,
    },
    {
      name: "Premium",
      price: 1600000,
      summary: "For multi-branch institutions that want AI insight and deeper control.",
      features: [
        "Everything in Standard",
        "AI learning recommendations",
        "Executive AI reporting",
        "Multi-campus support",
        "Advanced operations modules",
        "Dedicated success support",
      ],
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

const dashboardBars = [42, 58, 51, 70, 64, 82, 76, 94];

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
      className={cn("motion-safe:animate-[fade-up_640ms_ease-out_both]", className)}
      style={{ animationDelay: `${delay}ms` }}
    >
      {children}
    </section>
  );
}

function formatPrice(amount: number) {
  return `₦${amount.toLocaleString("en-NG")}`;
}

function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isDark = mounted && theme === "dark";

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className="group inline-flex h-10 w-10 items-center justify-center rounded-full border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] text-[var(--color-text-secondary)] transition hover:border-[var(--color-accent-primary)] hover:text-[var(--color-text-accent)]"
      aria-label={`Switch to ${isDark ? "light" : "dark"} mode`}
      title={`Switch to ${isDark ? "light" : "dark"} mode`}
    >
      {isDark ? <Sun className="h-[18px] w-[18px]" /> : <Moon className="h-[18px] w-[18px]" />}
    </button>
  );
}

export function FutureRealmLandingPage() {
  const [billingMode, setBillingMode] = useState<BillingMode>("annual");
  const [newsletterEmail, setNewsletterEmail] = useState("");
  const { showToast } = useToast();

  const plans = useMemo(() => pricing[billingMode], [billingMode]);

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
    <main className="lp-root min-h-screen text-[var(--color-text-primary)]">
      <div className="lp-backdrop" aria-hidden="true">
        <div className="lp-grid" />
        <span className="lp-blob lp-blob-a" />
        <span className="lp-blob lp-blob-b" />
        <span className="lp-blob lp-blob-c" />
      </div>

      {/* Navigation */}
      <header className="sticky top-0 z-50 px-4 pt-4 sm:px-6">
        <nav className="lp-nav mx-auto flex max-w-7xl items-center justify-between gap-4 rounded-full px-3 py-2 pl-4 sm:px-4 sm:py-2.5">
          <Link href="/" className="inline-flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--color-accent-primary)] text-[var(--color-text-inverse)] shadow-[0_8px_18px_var(--color-accent-primary-glow)]">
              <School className="h-[18px] w-[18px]" />
            </span>
            <span className="font-[var(--font-heading)] text-base font-bold tracking-tight text-[var(--color-text-primary)]">
              Future Realm <span className="text-[var(--color-text-accent)]">SMS</span>
            </span>
          </Link>

          <div className="hidden items-center gap-1 lg:flex">
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="rounded-full px-4 py-2 text-sm font-semibold text-[var(--color-text-secondary)] transition hover:bg-[var(--color-bg-overlay)] hover:text-[var(--color-text-primary)]"
              >
                {link.label}
              </a>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Link
              href="/login"
              className="hidden rounded-full px-4 py-2 text-sm font-semibold text-[var(--color-text-primary)] transition hover:text-[var(--color-text-accent)] sm:inline-flex"
            >
              Login
            </Link>
            <Link href="/onboarding" className="btn-primary rounded-full px-4">
              Get Started
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </nav>
      </header>

      <div className="mx-auto flex max-w-7xl flex-col gap-20 px-4 pb-16 pt-14 sm:px-6 md:gap-28 md:pt-20 lg:px-8">
        {/* Hero */}
        <RevealSection className="grid items-center gap-12 lg:grid-cols-[1.05fr_0.95fr]" delay={40}>
          <div className="space-y-7">
            <span className="inline-flex items-center gap-2 rounded-full border border-[var(--color-border-strong)] bg-[var(--color-bg-surface)]/80 px-4 py-1.5 text-[12px] font-semibold text-[var(--color-text-accent)] shadow-[var(--shadow-sm)]">
              <Sparkles className="h-3.5 w-3.5" />
              The operating system for Nigerian schools
            </span>

            <h1 className="font-[var(--font-heading)] text-[2.6rem] font-black leading-[1.04] tracking-tight sm:text-6xl lg:text-[4.1rem]">
              <span className="lp-gradient-text">Run your entire school</span>
              <br />
              from <span className="lp-accent-text">one calm platform</span>
            </h1>

            <p className="max-w-xl text-base leading-8 text-[var(--color-text-secondary)] md:text-lg">
              Admissions, academics, fees, communication, and daily operations — unified for private,
              faith-based, and multi-branch institutions across Nigeria. Less paperwork, more clarity.
            </p>

            <div className="flex flex-wrap items-center gap-3">
              <Link href="/onboarding" className="btn-primary h-12 rounded-full px-6 text-sm">
                Start free
                <ArrowRight className="h-4 w-4" />
              </Link>
              <a href="#platform" className="btn-secondary h-12 rounded-full px-6 text-sm">
                See the platform
                <ChevronRight className="h-4 w-4" />
              </a>
            </div>

            <div className="flex flex-wrap items-center gap-x-6 gap-y-3 pt-2">
              <div className="flex items-center gap-1 text-[var(--color-warning)]">
                {Array.from({ length: 5 }).map((_, index) => (
                  <Star key={index} className="h-4 w-4 fill-current" />
                ))}
                <span className="ml-2 text-sm font-semibold text-[var(--color-text-primary)]">Loved by school teams</span>
              </div>
              <div className="flex items-center gap-2 text-sm font-medium text-[var(--color-text-secondary)]">
                <ShieldCheck className="h-4 w-4 text-[var(--color-text-accent)]" />
                No card required to start
              </div>
            </div>
          </div>

          {/* Product preview */}
          <div className="relative">
            <div className="lp-hero-panel lp-glow lp-float p-4 sm:p-5">
              <div className="flex items-center justify-between gap-3 rounded-2xl border border-[var(--color-border-default)] bg-[var(--color-bg-overlay)]/70 px-4 py-3">
                <div className="flex items-center gap-2.5">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--color-accent-primary)] text-[var(--color-text-inverse)]">
                    <School className="h-4 w-4" />
                  </span>
                  <div>
                    <p className="text-[13px] font-bold text-[var(--color-text-primary)]">Command Center</p>
                    <p className="text-[11px] text-[var(--color-text-secondary)]">Term 2 · 2025/2026</p>
                  </div>
                </div>
                <span className="relative inline-flex items-center gap-2 rounded-full border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] px-3 py-1 text-[11px] font-semibold text-[var(--color-text-secondary)]">
                  <span className="lp-dot-pulse relative h-2 w-2 rounded-full bg-[var(--color-success)]" />
                  Live
                </span>
              </div>

              <div className="mt-4 grid grid-cols-3 gap-3">
                {[
                  { label: "Enrollment", value: "1,284", trend: "+6.2%", icon: Users2 },
                  { label: "Fees collected", value: "92%", trend: "+4.1%", icon: Wallet },
                  { label: "Attendance", value: "96.4%", trend: "+1.8%", icon: CalendarDays },
                ].map((kpi) => {
                  const Icon = kpi.icon;
                  return (
                    <div key={kpi.label} className="rounded-2xl border border-[var(--color-border-default)] bg-[var(--color-bg-surface)]/90 p-3">
                      <Icon className="h-4 w-4 text-[var(--color-text-accent)]" />
                      <p className="mt-3 font-[var(--font-heading)] text-lg font-bold text-[var(--color-text-primary)]">{kpi.value}</p>
                      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--color-text-secondary)]">{kpi.label}</p>
                      <p className="mt-1 inline-flex items-center gap-1 text-[10px] font-semibold text-[var(--color-success)]">
                        <TrendingUp className="h-3 w-3" />
                        {kpi.trend}
                      </p>
                    </div>
                  );
                })}
              </div>

              <div className="mt-3 rounded-2xl border border-[var(--color-border-default)] bg-[var(--color-bg-surface)]/90 p-4">
                <div className="flex items-center justify-between">
                  <p className="text-[12px] font-bold text-[var(--color-text-primary)]">Revenue this term</p>
                  <p className="text-[11px] font-semibold text-[var(--color-text-secondary)]">₦48.2M</p>
                </div>
                <div className="mt-4 flex h-24 items-end gap-2">
                  {dashboardBars.map((height, index) => (
                    <div
                      key={index}
                      className="lp-mini-bar flex-1 rounded-t-md bg-gradient-to-t from-[var(--color-accent-primary)] to-[var(--color-accent-primary-hover)]"
                      style={{ height: `${height}%`, animationDelay: `${index * 70}ms` }}
                    />
                  ))}
                </div>
              </div>
            </div>

            <div className="lp-glass absolute -left-3 bottom-6 hidden items-center gap-3 rounded-2xl px-4 py-3 shadow-[var(--shadow-md)] sm:flex">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--color-accent-primary-dim)] text-[var(--color-text-accent)]">
                <GraduationCap className="h-5 w-5" />
              </span>
              <div>
                <p className="text-[12px] font-bold text-[var(--color-text-primary)]">Results published</p>
                <p className="text-[11px] text-[var(--color-text-secondary)]">JSS 3 · 214 report cards</p>
              </div>
            </div>
          </div>
        </RevealSection>

        {/* Trust marquee */}
        <RevealSection className="space-y-6" delay={100}>
          <p className="text-center text-[11px] font-semibold uppercase tracking-[0.3em] text-[var(--color-text-secondary)]">
            Built for schools that care about getting operations right
          </p>
          <div className="lp-marquee">
            <div className="lp-marquee-track">
              {[...trustLogos, ...trustLogos].map((logo, index) => (
                <span
                  key={`${logo}-${index}`}
                  className="inline-flex items-center gap-2 whitespace-nowrap font-[var(--font-heading)] text-lg font-bold text-[var(--color-text-secondary)] opacity-70"
                >
                  <Building2 className="h-4 w-4" />
                  {logo}
                </span>
              ))}
            </div>
          </div>
        </RevealSection>

        {/* Stats */}
        <RevealSection className="grid grid-cols-2 gap-4 lg:grid-cols-4" delay={120}>
          {heroStats.map((stat) => (
            <div key={stat.label} className="lp-card p-6 text-center">
              <p className="font-[var(--font-heading)] text-4xl font-black text-[var(--color-text-primary)]">{stat.value}</p>
              <p className="mt-2 text-sm font-medium text-[var(--color-text-secondary)]">{stat.label}</p>
            </div>
          ))}
        </RevealSection>

        {/* Features */}
        <RevealSection id="features" className="space-y-10" delay={120}>
          <div className="mx-auto max-w-3xl text-center">
            <p className="section-eyebrow">Everything in one place</p>
            <h2 className="mt-3 font-[var(--font-heading)] text-3xl font-bold tracking-tight text-[var(--color-text-primary)] md:text-5xl">
              The complete toolkit a modern Nigerian school runs on
            </h2>
            <p className="mt-4 text-base leading-7 text-[var(--color-text-secondary)]">
              Purpose-built modules that fit how schools actually work — without forcing your staff into bloated,
              confusing software.
            </p>
          </div>

          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {features.map((feature, index) => {
              const Icon = feature.icon;
              return (
                <article
                  key={feature.title}
                  className="lp-card group p-6 motion-safe:animate-[fade-up_560ms_ease-out_both]"
                  style={{ animationDelay: `${180 + index * 60}ms` }}
                >
                  <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--color-accent-primary-dim)] text-[var(--color-text-accent)] transition group-hover:bg-[var(--color-accent-primary)] group-hover:text-[var(--color-text-inverse)]">
                    <Icon className="h-5 w-5" />
                  </span>
                  <h3 className="mt-5 font-[var(--font-heading)] text-xl font-bold text-[var(--color-text-primary)]">
                    {feature.title}
                  </h3>
                  <p className="mt-3 text-sm leading-7 text-[var(--color-text-secondary)]">{feature.description}</p>
                </article>
              );
            })}
          </div>
        </RevealSection>

        {/* Standout selling points */}
        <RevealSection id="standout" className="space-y-10" delay={130}>
          <div className="mx-auto max-w-3xl text-center">
            <span className="inline-flex items-center gap-2 rounded-full border border-[var(--color-border-strong)] bg-[var(--color-bg-surface)]/80 px-4 py-1.5 text-[12px] font-semibold text-[var(--color-text-accent)] shadow-[var(--shadow-sm)]">
              <Sparkles className="h-3.5 w-3.5" />
              What sets Future Realm apart
            </span>
            <h2 className="mt-4 font-[var(--font-heading)] text-3xl font-bold tracking-tight text-[var(--color-text-primary)] md:text-5xl">
              The features schools switch for
            </h2>
            <p className="mt-4 text-base leading-7 text-[var(--color-text-secondary)]">
              Beyond the basics — the differentiators that turn a school management system into a real advantage.
            </p>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            {standoutFeatures.map((item, index) => {
              const Icon = item.icon;
              return (
                <article
                  key={item.tag}
                  className="lp-card relative overflow-hidden p-8 motion-safe:animate-[fade-up_560ms_ease-out_both]"
                  style={{ animationDelay: `${180 + index * 90}ms` }}
                >
                  <span
                    className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full opacity-60 blur-3xl"
                    style={{ background: "radial-gradient(circle, var(--color-accent-primary-glow), transparent 70%)" }}
                    aria-hidden="true"
                  />
                  <div className="relative flex items-center gap-3">
                    <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--color-accent-primary)] text-[var(--color-text-inverse)] shadow-[0_12px_24px_var(--color-accent-primary-glow)]">
                      <Icon className="h-6 w-6" />
                    </span>
                    <span className="rounded-full bg-[var(--color-accent-primary-dim)] px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--color-text-accent)]">
                      {item.tag}
                    </span>
                  </div>
                  <h3 className="relative mt-6 font-[var(--font-heading)] text-2xl font-bold text-[var(--color-text-primary)]">
                    {item.title}
                  </h3>
                  <p className="relative mt-3 text-sm leading-7 text-[var(--color-text-secondary)]">{item.description}</p>
                  <ul className="relative mt-6 flex flex-wrap gap-2">
                    {item.highlights.map((highlight) => (
                      <li
                        key={highlight}
                        className="inline-flex items-center gap-1.5 rounded-full border border-[var(--color-border-default)] bg-[var(--color-bg-overlay)]/60 px-3 py-1.5 text-xs font-semibold text-[var(--color-text-primary)]"
                      >
                        <Check className="h-3.5 w-3.5 text-[var(--color-text-accent)]" />
                        {highlight}
                      </li>
                    ))}
                  </ul>
                </article>
              );
            })}
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {capabilityChips.map((chip, index) => {
              const Icon = chip.icon;
              return (
                <div
                  key={chip.title}
                  className="lp-card p-6 motion-safe:animate-[fade-up_560ms_ease-out_both]"
                  style={{ animationDelay: `${260 + index * 70}ms` }}
                >
                  <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--color-accent-primary-dim)] text-[var(--color-text-accent)]">
                    <Icon className="h-5 w-5" />
                  </span>
                  <h3 className="mt-4 font-[var(--font-heading)] text-base font-bold text-[var(--color-text-primary)]">{chip.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-[var(--color-text-secondary)]">{chip.description}</p>
                </div>
              );
            })}
          </div>
        </RevealSection>

        {/* Platform highlights */}
        <RevealSection id="platform" className="space-y-10" delay={140}>
          <div className="mx-auto max-w-3xl text-center">
            <p className="section-eyebrow">The platform</p>
            <h2 className="mt-3 font-[var(--font-heading)] text-3xl font-bold tracking-tight text-[var(--color-text-primary)] md:text-5xl">
              One system, complete visibility
            </h2>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            {platformHighlights.map((item, index) => {
              const Icon = item.icon;
              return (
                <article key={item.title} className="lp-card overflow-hidden p-8">
                  <div className="flex items-center gap-3">
                    <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--color-accent-primary)] text-[var(--color-text-inverse)] shadow-[0_10px_20px_var(--color-accent-primary-glow)]">
                      <Icon className="h-5 w-5" />
                    </span>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--color-text-accent)]">{item.eyebrow}</p>
                  </div>
                  <h3 className="mt-6 font-[var(--font-heading)] text-2xl font-bold text-[var(--color-text-primary)]">{item.title}</h3>
                  <p className="mt-3 text-sm leading-7 text-[var(--color-text-secondary)]">{item.description}</p>
                  <ul className="mt-6 grid gap-3">
                    {item.points.map((point) => (
                      <li key={point} className="flex items-center gap-3 text-sm font-medium text-[var(--color-text-primary)]">
                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[var(--color-accent-primary-dim)] text-[var(--color-text-accent)]">
                          <Check className="h-3.5 w-3.5" />
                        </span>
                        {point}
                      </li>
                    ))}
                  </ul>
                  <div
                    className="mt-7 flex items-center justify-between rounded-2xl border border-[var(--color-border-default)] bg-[var(--color-bg-overlay)]/60 px-5 py-4"
                  >
                    {index === 0 ? (
                      <div className="flex w-full items-end gap-1.5">
                        {[40, 62, 48, 74, 58, 88, 70, 96, 82].map((height, barIndex) => (
                          <div
                            key={barIndex}
                            className="lp-mini-bar flex-1 rounded-t bg-gradient-to-t from-[var(--color-accent-primary)] to-[var(--color-accent-primary-hover)]"
                            style={{ height: `${height * 0.6}px`, animationDelay: `${barIndex * 60}ms` }}
                          />
                        ))}
                      </div>
                    ) : (
                      <>
                        <div>
                          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--color-text-secondary)]">Collected this term</p>
                          <p className="mt-1 font-[var(--font-heading)] text-2xl font-black text-[var(--color-text-primary)]">₦48,240,500</p>
                        </div>
                        <span className="inline-flex items-center gap-1 rounded-full bg-[var(--color-success-dim)] px-3 py-1 text-xs font-bold text-[var(--color-success)]">
                          <TrendingUp className="h-3.5 w-3.5" />
                          92% rate
                        </span>
                      </>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        </RevealSection>

        {/* Trust pillars */}
        <RevealSection className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" delay={140}>
          {trustPillars.map((pillar) => {
            const Icon = pillar.icon;
            return (
              <div key={pillar.title} className="lp-card p-6">
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--color-accent-primary-dim)] text-[var(--color-text-accent)]">
                  <Icon className="h-5 w-5" />
                </span>
                <h3 className="mt-4 font-[var(--font-heading)] text-lg font-bold text-[var(--color-text-primary)]">{pillar.title}</h3>
                <p className="mt-2 text-sm leading-6 text-[var(--color-text-secondary)]">{pillar.description}</p>
              </div>
            );
          })}
        </RevealSection>

        {/* How it works */}
        <RevealSection className="space-y-10" delay={160}>
          <div className="mx-auto max-w-3xl text-center">
            <p className="section-eyebrow">How it works</p>
            <h2 className="mt-3 font-[var(--font-heading)] text-3xl font-bold tracking-tight text-[var(--color-text-primary)] md:text-5xl">
              From setup to school-wide control in four steps
            </h2>
          </div>

          <div className="grid gap-5 lg:grid-cols-4">
            {steps.map((step, index) => (
              <article
                key={step.id}
                className="lp-card relative p-6 motion-safe:animate-[fade-up_560ms_ease-out_both]"
                style={{ animationDelay: `${200 + index * 80}ms` }}
              >
                <span className="font-[var(--font-heading)] text-4xl font-black text-[var(--color-accent-primary-dim)]" style={{ WebkitTextStroke: "1px var(--color-accent-primary)" }}>
                  {step.id}
                </span>
                <h3 className="mt-4 font-[var(--font-heading)] text-lg font-bold text-[var(--color-text-primary)]">{step.title}</h3>
                <p className="mt-3 text-sm leading-7 text-[var(--color-text-secondary)]">{step.description}</p>
                {index < steps.length - 1 ? (
                  <ArrowRight className="absolute -right-3 top-1/2 hidden h-5 w-5 -translate-y-1/2 text-[var(--color-border-strong)] lg:block" />
                ) : null}
              </article>
            ))}
          </div>
        </RevealSection>

        {/* Testimonials */}
        <RevealSection className="space-y-10" delay={180}>
          <div className="flex flex-col gap-3 text-center">
            <p className="section-eyebrow">Loved by school leaders</p>
            <h2 className="font-[var(--font-heading)] text-3xl font-bold tracking-tight text-[var(--color-text-primary)] md:text-5xl">
              Clarity, not complexity
            </h2>
            <p className="mx-auto max-w-2xl text-sm leading-7 text-[var(--color-text-secondary)]">
              Illustrative scenarios that reflect the outcomes Nigerian school administrators care about most.
            </p>
          </div>

          <div className="grid gap-5 md:grid-cols-3">
            {testimonials.map((item, index) => (
              <article
                key={item.name}
                className="lp-card flex flex-col p-6 motion-safe:animate-[fade-up_560ms_ease-out_both]"
                style={{ animationDelay: `${220 + index * 80}ms` }}
              >
                <div className="flex items-center gap-1 text-[var(--color-warning)]">
                  {Array.from({ length: 5 }).map((_, starIndex) => (
                    <Star key={starIndex} className="h-4 w-4 fill-current" />
                  ))}
                </div>
                <p className="mt-4 flex-1 text-sm leading-7 text-[var(--color-text-primary)]">“{item.quote}”</p>
                <div className="mt-6 flex items-center gap-3 border-t border-[var(--color-border-default)] pt-5">
                  <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[var(--color-accent-primary)] font-[var(--font-heading)] text-sm font-bold text-[var(--color-text-inverse)]">
                    {item.name.split(" ").slice(-1)[0]?.charAt(0) ?? "S"}
                  </span>
                  <div>
                    <p className="text-sm font-bold text-[var(--color-text-primary)]">{item.name}</p>
                    <p className="text-xs text-[var(--color-text-secondary)]">
                      {item.role} · {item.school}
                    </p>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </RevealSection>

        {/* Pricing */}
        <RevealSection id="pricing" className="space-y-10" delay={200}>
          <div className="flex flex-col items-center gap-6 text-center">
            <div>
              <p className="section-eyebrow">Pricing</p>
              <h2 className="mt-3 font-[var(--font-heading)] text-3xl font-bold tracking-tight text-[var(--color-text-primary)] md:text-5xl">
                Simple pricing for every stage
              </h2>
              <p className="mx-auto mt-4 max-w-2xl text-sm leading-7 text-[var(--color-text-secondary)]">
                Choose the plan that matches your size and operational depth. Annual plans are ideal for schools planning
                around full academic sessions.
              </p>
            </div>

            <div className="inline-flex rounded-full border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] p-1 shadow-[var(--shadow-sm)]">
              {(["monthly", "annual"] as BillingMode[]).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setBillingMode(mode)}
                  className={cn(
                    "rounded-full px-5 py-2 text-sm font-semibold transition",
                    billingMode === mode
                      ? "bg-[var(--color-accent-primary)] text-[var(--color-text-inverse)] shadow-[0_10px_20px_var(--color-accent-primary-glow)]"
                      : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]",
                  )}
                >
                  {mode === "monthly" ? "Monthly" : "Annual"}
                  {mode === "annual" ? <span className="ml-1.5 text-[10px] font-bold text-[var(--color-success)]">Save 2 months</span> : null}
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-3 lg:items-stretch">
            {plans.map((plan, index) => (
              <article
                key={plan.name}
                className={cn(
                  "relative flex flex-col rounded-[1.75rem] border p-7 transition motion-safe:animate-[fade-up_560ms_ease-out_both]",
                  plan.featured
                    ? "border-[var(--color-accent-primary)] bg-[var(--color-bg-surface)] shadow-[0_28px_60px_-24px_var(--color-accent-primary-glow)] lg:-translate-y-3 lg:scale-[1.02]"
                    : "lp-card",
                )}
                style={{ animationDelay: `${240 + index * 80}ms` }}
              >
                {plan.featured ? (
                  <span className="absolute -top-3 left-1/2 inline-flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-[var(--color-accent-primary)] px-4 py-1 text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--color-text-inverse)] shadow-[0_10px_20px_var(--color-accent-primary-glow)]">
                    <Sparkles className="h-3 w-3" />
                    Most popular
                  </span>
                ) : null}

                <div>
                  <p className="font-[var(--font-heading)] text-xl font-bold text-[var(--color-text-primary)]">{plan.name}</p>
                  <p className="mt-2 text-sm leading-6 text-[var(--color-text-secondary)]">{plan.summary}</p>
                </div>

                <div className="mt-6">
                  <p className="font-[var(--font-heading)] text-4xl font-black text-[var(--color-text-primary)]">{formatPrice(plan.price)}</p>
                  <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                    {billingMode === "monthly" ? "per month" : "per year"}
                  </p>
                </div>

                <ul className="mt-6 grid flex-1 gap-3">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-3 text-sm text-[var(--color-text-primary)]">
                      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--color-accent-primary-dim)] text-[var(--color-text-accent)]">
                        <Check className="h-3.5 w-3.5" />
                      </span>
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>

                <div className="mt-8">
                  <Link
                    href="/onboarding"
                    className={cn("h-12 w-full rounded-full text-sm", plan.featured ? "btn-primary" : "btn-secondary")}
                  >
                    {plan.cta}
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
              </article>
            ))}
          </div>
        </RevealSection>

        {/* FAQ */}
        <RevealSection id="faq" className="grid gap-6 lg:grid-cols-[0.85fr_1.15fr]" delay={220}>
          <div className="lp-card p-8">
            <p className="section-eyebrow">FAQ</p>
            <h2 className="mt-3 font-[var(--font-heading)] text-3xl font-bold tracking-tight text-[var(--color-text-primary)] md:text-4xl">
              Questions from school owners and administrators
            </h2>
            <p className="mt-4 text-sm leading-7 text-[var(--color-text-secondary)]">
              Clear answers for schools evaluating digital transformation without losing the realities of Nigerian
              school operations.
            </p>
            <a href="#" className="btn-link mt-6">
              Talk to our team
              <ArrowRight className="h-4 w-4" />
            </a>
          </div>

          <AccordionGroup
            items={faqItems.map((item) => ({
              ...item,
              content: <p className="text-sm leading-7 text-[var(--color-text-secondary)]">{item.content}</p>,
            }))}
            defaultOpenId={faqItems[0].id}
          />
        </RevealSection>

        {/* CTA band */}
        <RevealSection className="lp-cta-band px-6 py-14 text-center md:px-12 md:py-20" delay={240}>
          <span className="inline-flex items-center gap-2 rounded-full border border-[var(--color-border-strong)] bg-[var(--color-bg-surface)]/70 px-4 py-1.5 text-[12px] font-semibold text-[var(--color-text-accent)]">
            <PhoneCall className="h-3.5 w-3.5" />
            Ready when you are
          </span>
          <h2 className="mx-auto mt-6 max-w-3xl font-[var(--font-heading)] text-3xl font-black tracking-tight text-[var(--color-text-primary)] md:text-5xl">
            Give your school the operating system it deserves
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-base leading-7 text-[var(--color-text-secondary)]">
            Set up in minutes and start running admissions, academics, and finance from a single, calm platform.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link href="/onboarding" className="btn-primary h-12 rounded-full px-7 text-sm">
              Start free
              <ArrowRight className="h-4 w-4" />
            </Link>
            <a href="#pricing" className="btn-secondary h-12 rounded-full px-7 text-sm">
              Book a demo
            </a>
          </div>
        </RevealSection>
      </div>

      {/* Footer */}
      <footer className="border-t border-[var(--color-border-default)]">
        <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
          <div className="grid gap-10 lg:grid-cols-[1.2fr_0.8fr_1fr]">
            <div className="space-y-4">
              <div className="inline-flex items-center gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--color-accent-primary)] text-[var(--color-text-inverse)]">
                  <School className="h-5 w-5" />
                </span>
                <div>
                  <p className="font-[var(--font-heading)] text-xl font-bold text-[var(--color-text-primary)]">Future Realm SMS</p>
                  <p className="text-sm text-[var(--color-text-secondary)]">Built for modern Nigerian schools</p>
                </div>
              </div>
              <p className="max-w-md text-sm leading-7 text-[var(--color-text-secondary)]">
                A school management platform for admissions, academics, finance, operations, and communication —
                designed to help school leaders run calmer and smarter institutions.
              </p>
              <div className="grid gap-1.5 text-sm text-[var(--color-text-secondary)]">
                <p>12 Admiralty Way, Lekki Phase 1, Lagos, Nigeria</p>
                <p>+234 800 000 0000 · hello@futurerealm.sms</p>
              </div>
              <div className="flex gap-3 pt-1">
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

            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--color-text-secondary)]">Navigate</p>
              <div className="mt-4 grid gap-2.5">
                {[
                  { label: "Home", href: "/" },
                  { label: "Features", href: "#features" },
                  { label: "Platform", href: "#platform" },
                  { label: "Pricing", href: "#pricing" },
                  { label: "FAQ", href: "#faq" },
                  { label: "Login", href: "/login" },
                ].map((item) =>
                  item.href.startsWith("/") ? (
                    <Link
                      key={item.label}
                      href={item.href as Route}
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
                  ),
                )}
              </div>
            </div>

            <div className="lp-card p-6">
              <p className="font-[var(--font-heading)] text-lg font-bold text-[var(--color-text-primary)]">Join the newsletter</p>
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
                <button type="submit" className="btn-primary h-11 rounded-full px-5">
                  Subscribe
                </button>
              </form>
            </div>
          </div>

          <div className="mt-12 flex flex-col items-center justify-between gap-3 border-t border-[var(--color-border-default)] pt-6 text-sm text-[var(--color-text-secondary)] sm:flex-row">
            <p>© {new Date().getFullYear()} Future Realm SMS. All rights reserved.</p>
            <div className="flex gap-5">
              <a href="#" className="transition hover:text-[var(--color-text-accent)]">Privacy</a>
              <a href="#" className="transition hover:text-[var(--color-text-accent)]">Terms</a>
              <a href="#" className="transition hover:text-[var(--color-text-accent)]">Security</a>
            </div>
          </div>
        </div>
      </footer>
    </main>
  );
}
