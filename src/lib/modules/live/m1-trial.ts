import { apiGet } from "@/lib/api/server";
import type { DrawerSpec, PanelRow } from "@/lib/modules/panels";

/**
 * Where the school stands on its free trial, and on the sample class it arrived with — said at the top of Today, because
 * both are things a new proprietor needs to act on in the first hour and neither belongs in a menu.
 */

export type TrialStatus =
  | { state: "none" }
  | { state: "not-started"; days: number }
  | { state: "running"; daysLeft: number; endsAt: string | null }
  | { state: "ended"; daysLeft: number; endsAt: string | null }
  | { state: "read-only"; lockOn: string; daysToLock: number };

const CLOCK = "M12 7.5V12l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z";

const startDrawer = (days: number): DrawerSpec => ({
  mode: "commit",
  kicker: "Free trial",
  title: `Start your ${days}-day free trial`,
  sub: "Every feature is unlocked for the whole trial. No card is asked for, and nothing is charged at the end.",
  facts: [
    ["Length", `${days} days`, "Counted from today"],
    ["What is unlocked", "Every feature", "Nothing is held back for the trial"],
    ["Cost", "Nothing", "No card required · no charge at the end"],
    ["Messaging credits", "Already in your wallet", "Issued when the school was created"],
  ],
  commitLabel: "Start my free trial",
  commitDone: "Your trial has started",
  commitDoneBody: "The days are counted from now. This banner shows how many are left.",
  submit: { endpoint: "/api/v1/onboarding/trial/start", method: "POST" },
});

export type SampleStatus = { loaded: false } | { loaded: true; students: number; days: number; subjects: number };

export const loadSample = () => apiGet<SampleStatus>("/api/v1/onboarding/sample").catch(() => ({ loaded: false }) as SampleStatus);

/** Removing the sample class: what goes, and what is certain to stay. */
export const clearSampleDrawer = (sample: Extract<SampleStatus, { loaded: true }>): DrawerSpec => ({
  mode: "commit",
  kicker: "Sample class",
  title: "Remove the sample class",
  sub: "Everything the sample class made is listed, so it can be taken out whole — and nothing the school added is touched.",
  facts: [
    ["Students", `${sample.students} sample students`, "Admission numbers begin SMP-"],
    ["Their records", `${sample.days} marked school days · ${sample.subjects} subjects scored`, "Attendance, scores, results and report cards"],
    ["Kept", "Everything else", "Your classes, subjects, grading scale, staff, students and fees"],
    ["Can it come back?", "No", "It is removed for good. The product does not need it to work."],
  ],
  commitLabel: "Remove the sample class",
  commitDone: "The sample class is gone",
  commitDoneBody: "Your school now holds only what you have added.",
  submit: { endpoint: "/api/v1/onboarding/sample/clear", method: "POST" },
});

export async function sampleRow(): Promise<PanelRow | null> {
  const sample = await loadSample();
  if (!sample.loaded) return null;
  return { cols: "1fr", panels: [{ type: "note", tone: "neutral", icon: "M12 8.2v4.6M12 16h.02M12 3.6 21 19.4H3z", title: "You are looking at a sample class", body: `${sample.students} sample students, a term of attendance, scored subjects and published report cards, so you can see the product working before you enter your own. None of it is real, and no message can be sent to it.`, acts: [{ label: "Remove the sample class", drawer: clearSampleDrawer(sample) }] }] };
}

export async function trialRow(): Promise<PanelRow | null> {
  const status = await apiGet<TrialStatus>("/api/v1/onboarding/trial").catch(() => null);
  if (!status || status.state === "none") return null;
  if (status.state === "not-started") {
    return { cols: "1fr", panels: [{ type: "note", tone: "attention", icon: CLOCK, title: "Your free trial has not started", body: `Your school is set up and ready to use. Your ${status.days} free days begin when you start them — nothing is counted until then.`, acts: [{ label: "Start my free trial", primary: true, drawer: startDrawer(status.days) }] }] };
  }
  if (status.state === "running") {
    return { cols: "1fr", panels: [{ type: "note", tone: status.daysLeft <= 5 ? "attention" : "positive", icon: CLOCK, title: `${status.daysLeft} ${status.daysLeft === 1 ? "day" : "days"} left in your free trial`, body: `Every feature is unlocked until ${status.endsAt ? new Date(status.endsAt).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }) : "the trial ends"}. Choose a plan under Subscription & Billing before then to keep going.`, acts: [{ label: "See plans", href: "/subscription-billing/plan" }] }] };
  }
  if (status.state === "read-only") {
    return { cols: "1fr", panels: [{ type: "note", tone: "negative", icon: CLOCK, title: "Your free trial has ended — the school is read-only", body: `Everything can be read and exported, but nothing can be changed. Choose a plan within ${status.daysToLock} ${status.daysToLock === 1 ? "day" : "days"} (by ${new Date(status.lockOn).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}) to switch editing back on. After that the school is locked. Nothing is deleted either way.`, acts: [{ label: "Choose a plan", primary: true, href: "/subscription-billing/plan" }] }] };
  }
  return { cols: "1fr", panels: [{ type: "note", tone: "negative", icon: CLOCK, title: "Your free trial has ended", body: "Choose a plan to keep using every feature. Your records are kept, and nothing has been deleted.", acts: [{ label: "Choose a plan", primary: true, href: "/subscription-billing/plan" }] }] };
}
