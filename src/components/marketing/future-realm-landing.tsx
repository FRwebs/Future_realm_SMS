"use client";

import type { Route } from "next";
import Link from "next/link";
import { useEffect, useState } from "react";
import {
  Building2,
  Camera,
  Check,
  ClipboardList,
  CreditCard,
  MessageSquareText,
  Minus,
  Plus,
  School,
} from "lucide-react";

import { useToast } from "@/components/ui/toast-provider";
import { cn } from "@/lib/utils/cn";

const INK = "#0d2315";
const TEAL = "#12796a";

const navLinks = [
  { label: "Home", href: "#top" },
  { label: "Features", href: "#features" },
  { label: "Pricing", href: "#pricing" },
  { label: "FAQ", href: "#faq" },
] as const;

const heroKpis = [
  { label: "Attendance", value: "96.2%", dark: false },
  { label: "Fees collected", value: "₦4.2M", dark: false },
  { label: "Active students", value: "1,284", dark: true },
] as const;

const trustPlaces = ["Lagos", "Abuja", "Port Harcourt", "Ibadan"] as const;

const bandStats = [
  { value: "14 days", detail: "Keeps working with no internet, then syncs" },
  { value: "1 day", detail: "From signup to first attendance register" },
  { value: "3 terms", detail: "Nigerian session structure built in, not bolted on" },
  { value: "Every edit", detail: "Score changes carry an approver and a timestamp" },
] as const;

const pillars = [
  { title: "Admissions", subtitle: "Application to enrollment" },
  { title: "Academics", subtitle: "Results, periods, attendance" },
  { title: "Finance", subtitle: "Fees, invoices, receipts" },
  { title: "Communication", subtitle: "Parent and staff visibility" },
] as const;

interface FeatureCard {
  span: 1 | 2;
  bg: string;
  title: string;
  desc: string;
  photoCaption?: string;
  icon?: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
}

const featureCards: FeatureCard[] = [
  {
    span: 2,
    bg: "#f3f7f4",
    title: "Student enrollment",
    desc: "Handle inquiry to admission with digital forms, screening workflows and clean onboarding built for Nigerian schools.",
    photoCaption: "Admissions officer welcoming a parent",
  },
  {
    span: 1,
    bg: "#f3f7f4",
    icon: ClipboardList,
    title: "Attendance tracking",
    desc: "Capture daily class and staff attendance with follow-up alerts, without slowing teachers down.",
  },
  {
    span: 1,
    bg: "#f3f7f4",
    icon: Check,
    title: "Result management",
    desc: "CA scores, exams, broadsheets and report cards with WAEC and NECO-friendly workflows.",
  },
  {
    span: 1,
    bg: "#eaf0ec",
    icon: CreditCard,
    title: "Fee payment",
    desc: "Invoices, balances, receipts and structured fee plans with Naira-native payment experiences.",
  },
  {
    span: 1,
    bg: "#f3f7f4",
    icon: ClipboardList,
    title: "Timetable management",
    desc: "Coordinate classes, teachers and periods, with conflicts caught automatically.",
  },
  {
    span: 2,
    bg: "#f3f7f4",
    title: "Parent portal",
    desc: "Give parents visibility into fees, attendance, announcements and published results from a mobile-friendly portal.",
    photoCaption: "Parent checking the app on a mobile phone",
  },
];

const offlinePoints = [
  { title: "Works for 14 days offline", desc: "A full fortnight of attendance and scores held safely on device." },
  { title: "Conflict-safe sync", desc: "Two teachers, one record — the system resolves it and shows you what changed." },
  { title: "Low-data by design", desc: "Built to run on a modest phone bundle, not office fibre." },
  { title: "Nothing silently lost", desc: "Every pending record is visible and counted until it lands." },
] as const;

const howItWorks = [
  { n: "01", title: "Register your school", desc: "Create your workspace and define the structure that matches your campus, sections and academic sessions." },
  { n: "02", title: "Set up school operations", desc: "Add classes, staff, subjects, fees and permissions using workflows your school already understands." },
  { n: "03", title: "Manage daily activity", desc: "Run admissions, attendance, results, fees and communication from one reliable operating system." },
  { n: "04", title: "Track outcomes clearly", desc: "Monitor finances, academic performance and school activity with dashboards built for leadership decisions." },
] as const;

const roleTabs = [
  {
    label: "For proprietors",
    title: "See the whole business, not just one class",
    points: [
      "Real-time revenue and enrollment across every branch",
      "Staff performance and attendance in one view",
      "Custom reports for board and investor updates",
    ],
    panelLabel: "Leadership view · Second Term",
    rows: [
      { label: "Fee collection", value: "88%", pct: 88 },
      { label: "Enrollment vs target", value: "96%", pct: 96 },
      { label: "Staff attendance", value: "94%", pct: 94 },
      { label: "Results approved", value: "72%", pct: 72 },
    ],
  },
  {
    label: "For teachers",
    title: "Less admin, more teaching",
    points: [
      "Mark attendance and grades from your phone",
      "Auto-generated report card drafts",
      "Direct messaging with parents, logged for you",
    ],
    panelLabel: "My classes · JSS2 Gold",
    rows: [
      { label: "Attendance marked today", value: "32 / 32", pct: 100 },
      { label: "Scores submitted", value: "9 / 11", pct: 82 },
      { label: "Report drafts ready", value: "28 / 42", pct: 67 },
      { label: "Parent replies pending", value: "3", pct: 18 },
    ],
  },
  {
    label: "For parents",
    title: "Know what's happening, without asking",
    points: [
      "Live fee balance and payment history",
      "Instant alerts on attendance and grades",
      "One thread for every message from the school",
    ],
    panelLabel: "Chidinma · JSS2 Gold",
    rows: [
      { label: "Fees paid this term", value: "100%", pct: 100 },
      { label: "Attendance this term", value: "96%", pct: 96 },
      { label: "Term average", value: "78.4%", pct: 78 },
      { label: "Subjects published", value: "8 / 11", pct: 73 },
    ],
  },
] as const;

const parentPoints = [
  { title: "Live fee balance", rest: " — what is owed, what was paid, and the receipt for it." },
  { title: "Attendance the same day", rest: " — not a surprise at the end of term." },
  { title: "Results when the school publishes", rest: " — never before approval." },
  { title: "SMS for families without smartphones", rest: " — no parent is left out." },
] as const;

const testimonials = [
  {
    quote: "We closed our accounts office spreadsheet the week we switched. Fee collection is up 30%.",
    name: "Funmi Adebayo",
    role: "Proprietress, Crestwood Schools, Lagos",
  },
  {
    quote: "The result and attendance workflows feel like they were built by people who understand real Nigerian school operations.",
    name: "Tunde Okafor",
    role: "Admin Head, Grace Int'l Academy, Abuja",
  },
  {
    quote: "Parents finally stop calling the front desk — and our leadership has one place to review academics, payments and communication.",
    name: "Chiamaka Nwosu",
    role: "Vice Principal, Bright Path College",
  },
] as const;

const trustCards = [
  { title: "NDPC-aligned", desc: "Lawful basis, retention limits and deletion requests handled as process, not paperwork." },
  { title: "Full audit trail", desc: "Every score change and fee adjustment carries who, when and why — permanently." },
  { title: "Role-based access", desc: "A class teacher sees their class. A bursar sees fees. Nobody sees everything by accident." },
  { title: "Your data leaves with you", desc: "Export every record in a standard format at any time. No hostage-taking." },
] as const;

interface Plan {
  name: string;
  desc: string;
  price: string;
  cta: string;
  popular: boolean;
  features: string[];
}

interface PublicPlan {
  slug: string;
  name: string;
  plan: string;
  monthlyPrice: number;
  annualPrice: number;
  includedModules: string[];
}

// Marketing copy for each tier — pricing itself is fetched live from
// /api/v1/onboarding/plans (backed by PlatformSubscriptionPlan) so an
// admin's pricing changes in Super Admin > Feature & Tier Config show up
// here, in onboarding, and anywhere else that reads the same source.
const planCopy: Record<string, { desc: string; cta: string; popular: boolean; features: string[] }> = {
  Basic: {
    desc: "For growing single-campus schools getting organized for the first time.",
    cta: "Get started",
    popular: false,
    features: ["Admissions workflow", "Attendance tracking", "Parent portal", "Basic reports"],
  },
  Standard: {
    desc: "For established schools running academics, finance and communication in one place.",
    cta: "Get started",
    popular: true,
    features: ["Everything in Basic", "Results & broadsheets", "Fee management", "Role-based portals", "Priority onboarding"],
  },
  Premium: {
    desc: "For multi-branch institutions that need deeper control, visibility and premium support.",
    cta: "Talk to sales",
    popular: false,
    features: ["Everything in Standard", "Multi-campus support", "Advanced operations modules", "Executive reporting", "Dedicated success support"],
  },
};

const fallbackPlans: Plan[] = Object.entries(planCopy).map(([name, copy]) => ({ name, price: "—", ...copy }));

function formatNaira(amount: number) {
  return `₦${amount.toLocaleString("en-NG")}`;
}

const faqs = [
  {
    q: "Does FutureRealm support WAEC and NECO-style result workflows?",
    a: "Yes — FutureRealm is built around Nigerian grading realities, supporting continuous assessment, exam scores, broadsheets and report cards that align with WAEC and NECO reporting structures.",
  },
  {
    q: "Can we manage more than one school branch?",
    a: "Yes, especially on the Premium plan, which is built for multi-campus institutions with centralized oversight.",
  },
  {
    q: "Does it work well when internet connectivity is unstable?",
    a: "Yes. FutureRealm is built with low-bandwidth realities in mind — attendance and grading work offline and sync automatically once a connection is available.",
  },
  {
    q: "Will parents be able to see fees, attendance and results?",
    a: "Yes, through the parent portal, from day one of your rollout.",
  },
  {
    q: "Can your team help with setup and onboarding for our staff?",
    a: "Yes — hands-on onboarding support is included as part of every plan's rollout.",
  },
] as const;

function ImagePlaceholder({ caption, className }: { caption: string; className?: string }) {
  return (
    <div
      className={cn("relative flex items-end overflow-hidden rounded-[20px] bg-[#f3f7f4]", className)}
      style={{ backgroundImage: "linear-gradient(155deg, #eaf0ec 0%, #f7faf8 60%, #ffffff 100%)" }}
      role="img"
      aria-label={caption}
    >
      <Camera className="absolute right-5 top-5 h-5 w-5 text-[#cfddd5]" strokeWidth={1.6} />
      <span className="m-4 rounded-full bg-white/80 px-3 py-1.5 text-[11px] font-medium text-[#77857c]">{caption}</span>
    </div>
  );
}

function RevealSection({
  children,
  className,
  delay = 0,
  id,
  style,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  id?: string;
  style?: React.CSSProperties;
}) {
  return (
    <section
      id={id}
      className={cn("motion-safe:animate-[fade-up_640ms_ease-out_both]", className)}
      style={{ ...style, animationDelay: `${delay}ms` }}
    >
      {children}
    </section>
  );
}

export function FutureRealmLandingPage() {
  const [activeTab, setActiveTab] = useState(0);
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [newsletterEmail, setNewsletterEmail] = useState("");
  const [plans, setPlans] = useState<Plan[]>(fallbackPlans);
  const { showToast } = useToast();

  useEffect(() => {
    let cancelled = false;
    fetch("/api/v1/onboarding/plans")
      .then((response) => response.json())
      .then((body: { data?: PublicPlan[] }) => {
        if (cancelled || !body.data || body.data.length === 0) return;
        const live = body.data
          .filter((item) => planCopy[item.name])
          .map((item) => ({ name: item.name, price: formatNaira(item.annualPrice), ...planCopy[item.name] }));
        if (live.length > 0) setPlans(live);
      })
      .catch(() => {
        // Keep the fallback copy — the pricing section still renders, just not live-updated.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const tab = roleTabs[activeTab];

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
      description: "We will share FutureRealm SMS updates, demos, and rollout news with you.",
    });
    setNewsletterEmail("");
  }

  return (
    <main id="top" className="min-h-screen bg-white text-[#0d2315]" style={{ fontFamily: "'Inter', sans-serif" }}>
      {/* Navigation */}
      <div className="mx-auto flex max-w-[1360px] items-center justify-between px-6 py-[22px] sm:px-14">
        <Link href="/" className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-[9px]" style={{ background: INK }}>
            <School className="h-4 w-4 text-white" />
          </span>
          <span className="font-[var(--font-heading)] text-base font-extrabold" style={{ color: INK }}>
            FutureRealm <span style={{ color: TEAL }}>SMS</span>
          </span>
        </Link>
        <div className="hidden items-center gap-9 lg:flex">
          {navLinks.map((link) => (
            <a key={link.href} href={link.href} className="text-[15px] font-medium" style={{ color: INK }}>
              {link.label}
            </a>
          ))}
        </div>
        <div className="flex items-center gap-[18px]">
          <Link href="/login" className="hidden whitespace-nowrap text-[15px] font-medium sm:inline-flex" style={{ color: INK }}>
            Sign in
          </Link>
          <Link
            href="/onboarding"
            className="whitespace-nowrap rounded-full px-[22px] py-[11px] text-sm font-semibold text-white"
            style={{ background: INK }}
          >
            Sign up
          </Link>
        </div>
      </div>

      {/* Hero */}
      <RevealSection className="mx-auto grid max-w-[1360px] items-center gap-10 px-6 pb-10 pt-12 sm:px-14 lg:grid-cols-[1fr_0.95fr]">
        <div>
          <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-[#d3dfd7] bg-[#eaf0ec] py-[7px] pl-2 pr-3.5">
            <span className="flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-bold text-white" style={{ background: INK }}>
              ✓
            </span>
            <span className="text-[13px] font-semibold text-[#17604f]">Built for Nigerian schools · NDPC-compliant</span>
          </div>
          <h1 className="mb-[22px] font-[var(--font-heading)] text-[42px] font-bold leading-[1.06] tracking-[-0.03em] sm:text-[52px] lg:text-[60px]">
            Run your school on <span style={{ color: TEAL }}>one clear system</span>, not six spreadsheets.
          </h1>
          <p className="mb-8 max-w-[520px] text-[17px] leading-[1.6] text-[#435048] sm:text-lg">
            Admissions, academics, fees and communication — one modern operating system built for private,
            faith-based and multi-branch schools across Nigeria.
          </p>
          <div className="mb-10 flex flex-wrap items-center gap-4">
            <Link
              href="/onboarding"
              className="rounded-full px-7 py-4 text-[15px] font-semibold text-white shadow-[0_12px_24px_-8px_rgba(13,35,21,0.55)]"
              style={{ background: INK }}
            >
              Start free trial
            </Link>
            <a href="#features" className="flex items-center gap-2.5 py-4 text-[15px] font-semibold" style={{ color: INK }}>
              <span className="flex h-[38px] w-[38px] items-center justify-center rounded-full border-[1.5px]" style={{ borderColor: INK }}>
                <svg width="11" height="12" viewBox="0 0 11 12" fill={INK}>
                  <path d="M10.5 6 0 12V0z" />
                </svg>
              </span>
              Watch 90s demo
            </a>
          </div>
          <div className="flex flex-wrap items-center gap-7">
            <span className="text-[13px] text-[#77857c]">Trusted by school groups across</span>
            <div className="flex flex-wrap gap-[18px]">
              {trustPlaces.map((place) => (
                <span key={place} className="font-[var(--font-heading)] text-sm font-semibold text-[#435048]">
                  {place}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="relative h-[440px] sm:h-[520px]">
          <div className="absolute right-0 top-0 w-[94%] overflow-hidden rounded-[18px] border border-[#dce6df] bg-white shadow-[0_40px_80px_-24px_rgba(23,20,38,0.25)]">
            <div className="flex items-center gap-1.5 border-b border-[#e3ece6] px-[18px] py-3.5">
              <span className="h-[9px] w-[9px] rounded-full bg-[#d3dfd7]" />
              <span className="h-[9px] w-[9px] rounded-full bg-[#d3dfd7]" />
              <span className="h-[9px] w-[9px] rounded-full bg-[#d3dfd7]" />
              <span className="ml-3 font-[var(--font-heading)] text-[11px] text-[#9fb8a7]">app.futurerealm.school/dashboard</span>
            </div>
            <div className="flex">
              <div className="flex w-14 flex-col items-center gap-4 border-r border-[#e3ece6] bg-[#f3f7f4] py-4">
                <span className="h-[26px] w-[26px] rounded-[7px]" style={{ background: INK }} />
                <span className="h-[18px] w-[18px] rounded-md bg-[#d3dfd7]" />
                <span className="h-[18px] w-[18px] rounded-md bg-[#d3dfd7]" />
                <span className="h-[18px] w-[18px] rounded-md bg-[#d3dfd7]" />
              </div>
              <div className="flex-1 p-5">
                <p className="mb-3.5 font-[var(--font-heading)] text-sm font-semibold">Term overview</p>
                <div className="mb-4 grid grid-cols-3 gap-2.5">
                  {heroKpis.map((kpi) => (
                    <div
                      key={kpi.label}
                      className="rounded-[10px] p-3"
                      style={{ background: kpi.dark ? INK : "#eaf0ec" }}
                    >
                      <p className="mb-1.5 text-[10px]" style={{ color: kpi.dark ? "#9fb8a7" : "#77857c" }}>
                        {kpi.label}
                      </p>
                      <p className="font-[var(--font-heading)] text-lg font-bold" style={{ color: kpi.dark ? "#fff" : INK }}>
                        {kpi.value}
                      </p>
                    </div>
                  ))}
                </div>
                <div className="mb-3.5 flex h-[90px] items-end gap-1.5 rounded-[10px] bg-[#f6f9f7] p-2.5 px-1">
                  {[40, 65, 50, 85, 60, 72].map((h, i) => (
                    <div
                      key={i}
                      className="lp-mini-bar w-full rounded"
                      style={{ height: `${h}%`, background: i === 3 ? INK : "#d3dfd7", animationDelay: `${i * 70}ms` }}
                    />
                  ))}
                </div>
                <div className="flex flex-col gap-2">
                  <div className="h-2.5 w-full rounded bg-[#e3ece6]" />
                  <div className="h-2.5 w-4/5 rounded bg-[#e3ece6]" />
                </div>
              </div>
            </div>
          </div>
          <div className="absolute bottom-2.5 left-0 hidden w-[230px] rounded-[14px] border border-[#dce6df] bg-white p-4 shadow-[0_24px_48px_-16px_rgba(23,20,38,0.2)] sm:block">
            <div className="mb-2.5 flex items-center gap-2.5">
              <span className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full bg-[#eaf0ec]">
                <MessageSquareText className="h-4 w-4" style={{ color: INK }} strokeWidth={1.9} />
              </span>
              <div>
                <p className="text-xs font-semibold">Parent notified</p>
                <p className="text-[11px] text-[#77857c]">Fee reminder · SMS + push</p>
              </div>
            </div>
            <p className="rounded-lg bg-[#f3f7f4] px-2.5 py-2 text-[11px] text-[#77857c]">
              &quot;Term 2 balance of ₦45,000 is due Friday.&quot;
            </p>
          </div>
        </div>
      </RevealSection>

      {/* Campus photo strip */}
      <div className="mx-auto max-w-[1360px] px-6 pt-8 sm:px-14">
        <ImagePlaceholder caption="Students and teachers on a Nigerian school campus" className="h-[280px] sm:h-[380px]" />
      </div>

      {/* Stat band */}
      <RevealSection className="mt-16 py-14" style={{ background: INK }}>
        <div className="mx-auto grid max-w-[1360px] grid-cols-2 gap-6 px-6 sm:px-14 lg:grid-cols-4">
          {bandStats.map((stat, index) => (
            <div
              key={stat.value}
              className={cn(
                "pr-6",
                index < bandStats.length - 1 && "border-r border-[rgba(255,255,255,0.14)]",
              )}
            >
              <p className="font-[var(--font-heading)] text-[32px] font-extrabold leading-none tracking-[-0.02em] text-white sm:text-[40px]">
                {stat.value}
              </p>
              <p className="mt-2.5 text-sm leading-[1.5] text-[#eaf0ec]">{stat.detail}</p>
            </div>
          ))}
        </div>
      </RevealSection>

      {/* Pillars */}
      <RevealSection className="px-6 py-24 sm:px-14">
        <div className="mx-auto max-w-[1360px]">
          <div className="mx-auto mb-14 max-w-[640px] text-center">
            <p className="mb-3.5 text-[13px] font-bold uppercase tracking-[0.06em]" style={{ color: INK }}>
              School operations command
            </p>
            <h2 className="font-[var(--font-heading)] text-[32px] font-bold leading-[1.12] tracking-[-0.02em] sm:text-[40px]">
              One reliable operating system
            </h2>
          </div>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {pillars.map((pillar) => (
              <div key={pillar.title} className="rounded-[18px] border border-[#e3ece6] bg-[#f3f7f4] p-7">
                <span className="mb-[18px] flex h-[42px] w-[42px] items-center justify-center rounded-xl" style={{ background: INK }}>
                  <Building2 className="h-[18px] w-[18px] text-white" strokeWidth={1.9} />
                </span>
                <p className="mb-2 font-[var(--font-heading)] text-lg font-semibold">{pillar.title}</p>
                <p className="text-[13.5px] text-[#435048]">{pillar.subtitle}</p>
              </div>
            ))}
          </div>
        </div>
      </RevealSection>

      {/* Features */}
      <RevealSection id="features" className="mx-auto max-w-[1360px] px-6 pb-24 sm:px-14">
        <div className="mb-14 max-w-[640px]">
          <p className="mb-3.5 text-[13px] font-bold uppercase tracking-[0.06em]" style={{ color: INK }}>
            Key features
          </p>
          <h2 className="font-[var(--font-heading)] text-[32px] font-bold leading-[1.12] tracking-[-0.02em] sm:text-[40px]">
            Everything a modern Nigerian school needs to run well
          </h2>
          <p className="mt-4 text-[15.5px] text-[#435048]">
            Structured to support daily operations without forcing staff into bloated workflows.
          </p>
        </div>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {featureCards.map((feature) => {
            const Icon = feature.icon;
            return (
              <div
                key={feature.title}
                className={cn("overflow-hidden rounded-[20px] border border-[#e3ece6]", feature.span === 2 && "sm:col-span-2")}
                style={{ background: feature.bg }}
              >
                {feature.photoCaption ? (
                  <ImagePlaceholder caption={feature.photoCaption} className="h-[180px] rounded-none" />
                ) : null}
                <div className="p-7">
                  {Icon ? (
                    <span
                      className="mb-5 flex h-11 w-11 items-center justify-center rounded-xl"
                      style={{ background: feature.bg === "#eaf0ec" ? "#fff" : INK }}
                    >
                      <Icon className="h-[18px] w-[18px]" style={{ color: feature.bg === "#eaf0ec" ? INK : "#fff" }} />
                    </span>
                  ) : null}
                  <p className="mb-2.5 font-[var(--font-heading)] text-[19px] font-semibold">{feature.title}</p>
                  <p className="text-[14.5px] leading-[1.55] text-[#435048]">{feature.desc}</p>
                </div>
              </div>
            );
          })}
        </div>
      </RevealSection>

      {/* Offline-first */}
      <RevealSection className="px-6 py-24 sm:px-14" style={{ background: INK }}>
        <div className="mx-auto grid max-w-[1360px] items-center gap-14 lg:grid-cols-2">
          <div>
            <div className="mb-[26px] inline-flex items-center gap-2 rounded-full border border-[rgba(255,255,255,0.16)] bg-[rgba(255,255,255,0.09)] px-3.5 py-[7px]">
              <span className="h-[7px] w-[7px] rounded-full" style={{ background: "#3ee08a" }} />
              <span className="text-[12.5px] font-semibold text-white">Why schools stay</span>
            </div>
            <h2 className="mb-5 font-[var(--font-heading)] text-[32px] font-bold leading-[1.12] tracking-[-0.02em] text-white sm:text-[40px]">
              The power goes out. The register still opens.
            </h2>
            <p className="mb-[34px] max-w-[520px] text-[16.5px] leading-[1.65] text-[#eaf0ec]">
              Most school software assumes a stable connection. Yours does not have one. FutureRealm stores the
              working day on the device, so teachers mark attendance and enter scores whether or not there is
              network — then reconciles everything the moment a connection returns.
            </p>
            <div className="grid grid-cols-1 gap-[22px] sm:grid-cols-2">
              {offlinePoints.map((point) => (
                <div key={point.title} className="border-t border-[rgba(255,255,255,0.16)] pt-4">
                  <p className="mb-1.5 text-sm font-semibold text-white">{point.title}</p>
                  <p className="text-[13px] leading-[1.5] text-[#9fb8a7]">{point.desc}</p>
                </div>
              ))}
            </div>
          </div>
          <ImagePlaceholder
            caption="A Nigerian teacher marking attendance on a tablet in a classroom"
            className="h-[340px] sm:h-[430px]"
          />
        </div>
      </RevealSection>

      {/* Fees & payments */}
      <RevealSection className="px-6 py-24 sm:px-14">
        <div className="mx-auto max-w-[1360px]">
          <div className="mb-[52px] max-w-[680px]">
            <p className="mb-3.5 text-[13px] font-bold uppercase tracking-[0.06em]" style={{ color: TEAL }}>
              Fees &amp; payments
            </p>
            <h2 className="font-[var(--font-heading)] text-[32px] font-bold leading-[1.12] tracking-[-0.02em] sm:text-[40px]">
              Money in, reconciled, receipted — without the bursar chasing paper
            </h2>
            <p className="mt-4 text-base leading-[1.6] text-[#435048]">
              Parents pay the way they already pay. Every naira lands against a student, a term and an invoice
              automatically.
            </p>
          </div>
          <div className="grid gap-6 lg:grid-cols-[1.15fr_1fr]">
            <div className="rounded-[20px] border border-[#e3ece6] bg-[#f3f7f4] p-[34px]">
              <div className="grid gap-[26px] sm:grid-cols-2">
                {[
                  { title: "Card, transfer or USSD", desc: "Naira-native rails parents already trust, plus bank transfer for the ones who prefer it." },
                  { title: "Auto-reconciliation", desc: "Payments match themselves to the right student and term. No end-of-day spreadsheet." },
                  { title: "Part-payment plans", desc: "Structured instalments with balances parents can see, so fewer calls reach the front desk." },
                  { title: "Instant receipts", desc: "Issued the moment payment clears, with a permanent record on both sides." },
                ].map((item) => (
                  <div key={item.title}>
                    <p className="mb-2 font-[var(--font-heading)] text-[15.5px] font-bold">{item.title}</p>
                    <p className="text-[13.5px] leading-[1.55] text-[#435048]">{item.desc}</p>
                  </div>
                ))}
              </div>
              <div className="mt-[30px] flex flex-wrap items-center gap-[22px] border-t border-[#dce6df] pt-6">
                <span className="text-[12.5px] text-[#77857c]">Settles through</span>
                <div className="flex flex-wrap gap-3">
                  {["Paystack", "Flutterwave", "Bank transfer"].map((rail) => (
                    <span key={rail} className="rounded-[9px] border border-[#dce6df] bg-white px-4 py-2.5 text-[13px] font-semibold text-[#435048]">
                      {rail}
                    </span>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex flex-col justify-between rounded-[20px] p-[34px] text-white" style={{ background: INK }}>
              <div>
                <p className="mb-2.5 text-[12.5px] text-[#9fb8a7]">Collection rate, this term</p>
                <p className="font-[var(--font-heading)] text-[52px] font-extrabold leading-none tracking-[-0.02em]">88%</p>
                <div className="my-5 h-[9px] overflow-hidden rounded-full bg-[rgba(255,255,255,0.16)]">
                  <div className="h-full rounded-full" style={{ width: "88%", background: "#3ee08a" }} />
                </div>
                <p className="text-[13px] text-[#eaf0ec]">₦412M of ₦468M expected</p>
              </div>
              <div className="mt-[30px] flex flex-col gap-3.5">
                {[
                  { label: "Outstanding", value: "₦56.0M" },
                  { label: "Receipts issued today", value: "22" },
                  { label: "vs last term", value: "+4 pts", accent: true },
                ].map((row) => (
                  <div key={row.label} className="flex items-center justify-between border-t border-[rgba(255,255,255,0.16)] pt-3.5">
                    <span className="text-[13px] text-[#eaf0ec]">{row.label}</span>
                    <span
                      className="font-[var(--font-heading)] text-[15px] font-bold"
                      style={{ color: row.accent ? "#3ee08a" : "#fff" }}
                    >
                      {row.value}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </RevealSection>

      {/* How it works */}
      <RevealSection className="px-6 py-24 sm:px-14" style={{ background: "#eaf0ec" }}>
        <div className="mx-auto max-w-[1360px]">
          <div className="mx-auto mb-14 max-w-[640px] text-center">
            <p className="mb-3.5 text-[13px] font-bold uppercase tracking-[0.06em]" style={{ color: TEAL }}>
              How it works
            </p>
            <h2 className="font-[var(--font-heading)] text-[32px] font-bold leading-[1.12] tracking-[-0.02em] sm:text-[40px]">
              Get your school running in four simple steps
            </h2>
          </div>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {howItWorks.map((step) => (
              <div key={step.n}>
                <span
                  className="mb-5 flex h-[52px] w-[52px] items-center justify-center rounded-full font-[var(--font-heading)] text-[17px] font-bold text-white"
                  style={{ background: INK }}
                >
                  {step.n}
                </span>
                <p className="mb-2 font-[var(--font-heading)] text-[17px] font-semibold">{step.title}</p>
                <p className="text-[13.5px] leading-[1.55] text-[#435048]">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </RevealSection>

      {/* Role tabs */}
      <RevealSection className="px-6 py-24 sm:px-14">
        <div className="mx-auto max-w-[1360px]">
          <h2 className="mb-3 text-center font-[var(--font-heading)] text-[32px] font-bold leading-[1.12] tracking-[-0.02em] sm:text-[40px]">
            Built differently for every role
          </h2>
          <p className="mb-11 text-center text-base text-[#435048]">The same data, three purpose-built views.</p>
          <div className="mb-11 flex flex-wrap justify-center gap-2.5">
            {roleTabs.map((t, index) => (
              <button
                key={t.label}
                type="button"
                onClick={() => setActiveTab(index)}
                className="rounded-full border px-[22px] py-3 text-sm font-semibold transition"
                style={{
                  background: activeTab === index ? INK : "#fff",
                  color: activeTab === index ? "#fff" : "#435048",
                  borderColor: activeTab === index ? INK : "#dce6df",
                }}
              >
                {t.label}
              </button>
            ))}
          </div>
          <div className="mx-auto max-w-[1040px] rounded-[22px] border border-[#dce6df] bg-white p-2 shadow-[0_30px_60px_-30px_rgba(23,20,38,0.2)]">
            <div className="grid min-h-[320px] gap-8 rounded-2xl bg-[#f3f7f4] p-9 sm:grid-cols-2">
              <div>
                <p className="mb-3.5 font-[var(--font-heading)] text-[22px] font-semibold">{tab.title}</p>
                {tab.points.map((point) => (
                  <div key={point} className="mb-3 flex items-start gap-2.5">
                    <span
                      className="mt-0.5 flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full text-[10px] text-white"
                      style={{ background: INK }}
                    >
                      ✓
                    </span>
                    <span className="text-[14.5px] leading-[1.5] text-[#435048]">{point}</span>
                  </div>
                ))}
              </div>
              <div className="rounded-[14px] border border-[#dce6df] bg-white p-5">
                <p className="mb-4 text-[11px] font-bold uppercase tracking-[0.06em] text-[#77857c]">{tab.panelLabel}</p>
                <div className="flex flex-col gap-3">
                  {tab.rows.map((row) => (
                    <div key={row.label}>
                      <div className="mb-[7px] flex items-baseline justify-between gap-3">
                        <span className="text-[12.5px] text-[#435048]">{row.label}</span>
                        <span className="font-[var(--font-heading)] text-sm font-bold">{row.value}</span>
                      </div>
                      <div className="h-[7px] overflow-hidden rounded-full bg-[#edf3ef]">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${row.pct}%`,
                            background: row.pct >= 90 ? "#22a06b" : row.pct >= 60 ? TEAL : "#d9a22c",
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </RevealSection>

      {/* For parents */}
      <RevealSection className="px-6 py-24 sm:px-14" style={{ background: "#eaf0ec" }}>
        <div className="mx-auto grid max-w-[1360px] items-center gap-16 lg:grid-cols-[0.85fr_1fr]">
          <ImagePlaceholder caption="A Nigerian parent holding a phone, warm and candid" className="h-[340px] sm:h-[460px]" />
          <div>
            <p className="mb-3.5 text-[13px] font-bold uppercase tracking-[0.06em]" style={{ color: TEAL }}>
              For parents
            </p>
            <h2 className="mb-5 font-[var(--font-heading)] text-[32px] font-bold leading-[1.12] tracking-[-0.02em] sm:text-[40px]">
              The front desk stops being a call centre
            </h2>
            <p className="mb-8 max-w-[520px] text-[16.5px] leading-[1.65] text-[#435048]">
              Most calls a school takes are four questions: what do I owe, was my child in school, what did they
              score, and what did I miss. Parents answer all four themselves — in the language of a phone, not a
              portal.
            </p>
            <div className="flex flex-col gap-4">
              {parentPoints.map((point) => (
                <div key={point.title} className="flex items-start gap-3.5">
                  <span
                    className="mt-px flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full"
                    style={{ background: INK }}
                  >
                    <Check className="h-[11px] w-[11px] text-white" strokeWidth={3.2} />
                  </span>
                  <p className="text-[15px] leading-[1.5]">
                    <span className="font-semibold">{point.title}</span>
                    <span className="text-[#435048]">{point.rest}</span>
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </RevealSection>

      {/* Testimonials */}
      <RevealSection className="px-6 py-24 sm:px-14">
        <div className="mx-auto max-w-[1360px]">
          <h2 className="mb-3 text-center font-[var(--font-heading)] text-[32px] font-bold leading-[1.12] tracking-[-0.02em] sm:text-[40px]">
            Trusted by school leaders across Nigeria
          </h2>
          <p className="mb-12 text-center text-base text-[#435048]">Heads of school don&apos;t go back to spreadsheets.</p>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {testimonials.map((item) => (
              <div key={item.name} className="rounded-[18px] border border-[#e3ece6] bg-[#f7faf8] p-[30px]">
                <p className="mb-3.5 font-[var(--font-heading)] text-[38px] font-extrabold leading-[0.7] text-[#cfddd5]">&ldquo;</p>
                <p className="mb-6 text-[15.5px] leading-[1.62]">{item.quote}</p>
                <div className="flex items-center gap-3">
                  <span
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full font-[var(--font-heading)] text-sm font-bold text-white"
                    style={{ background: INK }}
                  >
                    {item.name
                      .split(" ")
                      .map((word) => word[0])
                      .join("")
                      .slice(0, 2)
                      .toUpperCase()}
                  </span>
                  <div>
                    <p className="text-[13.5px] font-semibold">{item.name}</p>
                    <p className="text-[12.5px] text-[#77857c]">{item.role}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </RevealSection>

      {/* Trust & compliance */}
      <RevealSection className="border-t border-[#e3ece6] px-6 py-24 sm:px-14" style={{ background: "#f3f7f4" }}>
        <div className="mx-auto max-w-[1360px]">
          <div className="mb-[52px] max-w-[680px]">
            <p className="mb-3.5 text-[13px] font-bold uppercase tracking-[0.06em]" style={{ color: TEAL }}>
              Trust &amp; compliance
            </p>
            <h2 className="font-[var(--font-heading)] text-[32px] font-bold leading-[1.12] tracking-[-0.02em] sm:text-[40px]">
              You are holding children&apos;s records. We treat that seriously.
            </h2>
            <p className="mt-4 text-base leading-[1.6] text-[#435048]">
              FutureRealm is built to the Nigeria Data Protection Commission&apos;s requirements, with the audit
              trail a school needs when a parent disputes something.
            </p>
          </div>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {trustCards.map((card) => (
              <div key={card.title} className="rounded-[18px] border border-[#e3ece6] bg-white p-7">
                <p className="mb-2.5 font-[var(--font-heading)] text-base font-bold">{card.title}</p>
                <p className="text-[13.5px] leading-[1.55] text-[#435048]">{card.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </RevealSection>

      {/* Pricing */}
      <RevealSection id="pricing" className="px-6 py-24 sm:px-14" style={{ background: INK }}>
        <div className="mx-auto max-w-[1360px]">
          <div className="mb-12 text-center">
            <h2 className="font-[var(--font-heading)] text-[32px] font-bold leading-[1.12] tracking-[-0.02em] text-white sm:text-[40px]">
              Pricing that grows with your school
            </h2>
            <p className="mx-auto mt-2.5 max-w-[520px] text-base text-[#9fb8a7]">
              Choose the plan that matches your size and operational depth. Billed per academic year.
            </p>
          </div>
          <div className="grid gap-6 lg:grid-cols-3">
            {plans.map((plan) => (
              <div
                key={plan.name}
                className="rounded-[20px] p-8"
                style={
                  plan.popular
                    ? { background: "#fff", boxShadow: "0 30px 60px -20px rgba(0,0,0,0.5)", transform: "scale(1.03)" }
                    : { background: "#fff", border: "1px solid #e3ece6" }
                }
              >
                {plan.popular ? (
                  <span
                    className="mb-3.5 inline-block rounded-full px-3 py-[5px] text-[11px] font-bold uppercase tracking-[0.04em] text-white"
                    style={{ background: INK }}
                  >
                    Most popular
                  </span>
                ) : null}
                <p className="mb-2 font-[var(--font-heading)] text-lg font-semibold">{plan.name}</p>
                <p className="mb-5 min-h-9 text-[13px] text-[#435048]">{plan.desc}</p>
                <div className="mb-6 flex items-baseline gap-1.5">
                  <span className="font-[var(--font-heading)] text-[32px] font-bold">{plan.price}</span>
                  <span className="text-[13px] text-[#435048]">/year</span>
                </div>
                <Link
                  href="/onboarding"
                  className="block rounded-full py-[13px] text-center text-sm font-semibold"
                  style={{ background: "#f3f7f4", color: INK }}
                >
                  {plan.cta}
                </Link>
                <div className="my-6 h-px bg-[#e3ece6]" />
                <div className="flex flex-col gap-3">
                  {plan.features.map((feature) => (
                    <div key={feature} className="flex items-start gap-2.5">
                      <span className="mt-px text-[13px]" style={{ color: TEAL }}>✓</span>
                      <span className="text-[13.5px] leading-[1.4] text-[#435048]">{feature}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </RevealSection>

      {/* FAQ */}
      <RevealSection id="faq" className="mx-auto max-w-[820px] px-6 py-24 sm:px-14">
        <h2 className="mb-3 text-center font-[var(--font-heading)] text-[32px] font-bold leading-[1.12] tracking-[-0.02em] sm:text-[40px]">
          Questions schools ask before switching
        </h2>
        <p className="mb-10 text-center text-[15px] text-[#435048]">
          Clear answers, without losing the realities of Nigerian school operations.
        </p>
        <div className="divide-y divide-[#dce6df]">
          {faqs.map((faq, index) => {
            const open = openFaq === index;
            return (
              <div key={faq.q} className="py-[22px]">
                <button
                  type="button"
                  onClick={() => setOpenFaq(open ? null : index)}
                  className="flex w-full items-center justify-between gap-5 text-left"
                >
                  <span className="text-base font-semibold">{faq.q}</span>
                  <span className="shrink-0" style={{ color: INK }}>
                    {open ? <Minus className="h-5 w-5" /> : <Plus className="h-5 w-5" />}
                  </span>
                </button>
                {open ? (
                  <p className="mt-3.5 max-w-[640px] text-[14.5px] leading-[1.6] text-[#435048]">{faq.a}</p>
                ) : null}
              </div>
            );
          })}
        </div>
      </RevealSection>

      {/* Bottom campus photo */}
      <div className="mx-auto max-w-[1360px] px-6 pb-10 sm:px-14">
        <ImagePlaceholder caption="Wide shot of a Nigerian school assembly or campus grounds" className="h-[220px] sm:h-[300px]" />
      </div>

      {/* CTA band */}
      <div className="mx-auto max-w-[1360px] px-6 pb-24 sm:px-14">
        <div className="relative overflow-hidden rounded-[28px] px-6 py-[70px] text-center sm:px-14" style={{ background: INK }}>
          <span className="pointer-events-none absolute -right-16 -top-16 h-[220px] w-[220px] rounded-full bg-[rgba(255,255,255,0.12)]" />
          <span className="pointer-events-none absolute -bottom-20 -left-10 h-[180px] w-[180px] rounded-full bg-[rgba(255,255,255,0.1)]" />
          <h2 className="relative mb-4 font-[var(--font-heading)] text-[32px] font-bold leading-[1.12] tracking-[-0.02em] text-white sm:text-[40px]">
            Ready to run a calmer school office?
          </h2>
          <p className="relative mb-8 text-base text-[#eaf0ec]">Set up in a day. Free for your first 14 days.</p>
          <div className="relative inline-flex flex-wrap justify-center gap-3.5">
            <Link
              href="/onboarding"
              className="whitespace-nowrap rounded-full px-[30px] py-4 text-[15px] font-semibold shadow-[0_10px_28px_-10px_rgba(0,0,0,0.45)]"
              style={{ background: "#fff", color: INK }}
            >
              Start free trial
            </Link>
            <a
              href="#pricing"
              className="whitespace-nowrap rounded-full border border-[rgba(255,255,255,0.3)] px-[30px] py-4 text-[15px] font-semibold text-white"
              style={{ background: "rgba(255,255,255,0.15)" }}
            >
              Talk to sales
            </a>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-[#e3ece6] px-6 pt-14 sm:px-14">
        <div className="mx-auto max-w-[1360px]">
          <div className="mb-6 grid gap-10 border-b border-[#e3ece6] pb-10 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
            <div>
              <div className="mb-4 flex items-center gap-2.5">
                <span className="flex h-8 w-8 items-center justify-center rounded-[9px]" style={{ background: INK }}>
                  <School className="h-4 w-4 text-white" />
                </span>
                <span className="font-[var(--font-heading)] text-base font-extrabold">FutureRealm SMS</span>
              </div>
              <p className="mb-[18px] max-w-[260px] text-[13.5px] leading-[1.6] text-[#77857c]">
                A school management platform for admissions, academics, finance and communication — built to help
                school leaders run calmer, smarter institutions.
              </p>
              <p className="text-[13px] leading-[1.8] text-[#435048]">
                12 Admiralty Way, Lekki Phase 1, Lagos
                <br />
                +234 800 000 0000
                <br />
                hello@futurerealm.sms
              </p>
            </div>
            <div>
              <p className="mb-4 text-xs font-bold uppercase tracking-[0.05em] text-[#77857c]">Product</p>
              <div className="flex flex-col gap-[11px] text-sm">
                <a href="#features" style={{ color: INK }}>Features</a>
                <a href="#pricing" style={{ color: INK }}>Pricing</a>
                <a href="#" style={{ color: INK }}>Parent app</a>
                <a href="#" style={{ color: INK }}>Report cards</a>
              </div>
            </div>
            <div>
              <p className="mb-4 text-xs font-bold uppercase tracking-[0.05em] text-[#77857c]">Company</p>
              <div className="flex flex-col gap-[11px] text-sm">
                <a href="#" style={{ color: INK }}>About</a>
                <a href="#" style={{ color: INK }}>Careers</a>
                <a href="#" style={{ color: INK }}>Contact</a>
                <Link href={"/login" as Route} style={{ color: INK }}>Login</Link>
              </div>
            </div>
            <div>
              <p className="mb-4 text-xs font-bold uppercase tracking-[0.05em] text-[#77857c]">Stay updated</p>
              <p className="mb-3 text-[13px] text-[#435048]">Launch notes and rollout insights for school leaders.</p>
              <form onSubmit={handleNewsletterSubmit} className="flex gap-2">
                <input
                  type="email"
                  value={newsletterEmail}
                  onChange={(event) => setNewsletterEmail(event.target.value)}
                  placeholder="you@school.edu.ng"
                  className="flex-1 rounded-[9px] border border-[#e3ece6] bg-[#f3f7f4] px-3 py-2.5 text-[13px] outline-none placeholder:text-[#9fb8a7]"
                />
                <button type="submit" className="whitespace-nowrap rounded-[9px] px-4 py-2.5 text-[13px] font-semibold text-white" style={{ background: INK }}>
                  Join
                </button>
              </form>
            </div>
          </div>
          <div className="flex flex-col items-center justify-between gap-3 pb-7 text-[13px] text-[#77857c] sm:flex-row">
            <p>© {new Date().getFullYear()} FutureRealm SMS. All rights reserved.</p>
            <div className="flex items-center gap-2">
              <span className="flex h-4 w-4 items-center justify-center rounded border border-[#d3dfd7] bg-[#eaf0ec] text-[9px]" style={{ color: INK }}>
                ✓
              </span>
              NDPC compliant
            </div>
          </div>
        </div>
      </footer>
    </main>
  );
}
