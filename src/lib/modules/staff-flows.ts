/**
 * The processes Staff & Access runs as sequences — who decides a leave request, how an
 * appraisal cycle runs, how a payroll run is released. A process is data here, not a
 * paragraph: each stage names who acts, what they may do, how long they have and what
 * happens if they do nothing, so a school can say its own sequence rather than work
 * around ours. Shared by the API (which reads the stages to route a request) and the
 * screens (which show and edit them).
 */

export type FlowStageData = {
  name: string;
  who: string;
  does: string;
  scope: string;
  win: string;
  silence: string;
  notify: string[];
};

export type FlowId = "leave" | "appraisal" | "payrun";

export type FlowDefinition = {
  id: FlowId;
  noun: string;
  plainLabel: string;
  whoOpts: string[];
  doesOpts: string[];
  scopeOpts: string[];
  winOpts: string[];
  silenceOpts: string[];
  stages: FlowStageData[];
  presets: Array<{ label: string; stages: FlowStageData[] | null; append?: FlowStageData }>;
  rules: string[];
};

const stage = (name: string, who: string, does: string, scope: string, win: string, silence: string, notify: string[]): FlowStageData => ({ name, who, does, scope, win, silence, notify });

const leaveStages = [
  stage("Cover check", "The head of department", "Confirms cover only", "Every request", "2 working days", "Escalate to the next stage", ["Nobody"]),
  stage("Decision", "The Principal", "Approves, declines or returns it", "Up to 10 days, in term time", "3 working days", "Escalate to the next stage", ["The requester"]),
  stage("Final say", "The Proprietor", "Approves or declines", "Above 10 days", "No limit", "Remind daily", ["The requester", "The Bursary"]),
];

const appraisalStages = [
  stage("Published", "The Principal", "Opens the cycle", "Everyone", "No limit", "Nothing publishes until it is done", ["Everyone in the cycle"]),
  stage("Self-assessment", "Each staff member", "Self-rates against each KPI", "Everyone", "10 working days", "The manager’s rating stands", ["Their line manager"]),
  stage("Manager review", "Their line manager", "Rates them and writes the review", "Everyone", "10 working days", "Remind daily", ["The Principal"]),
  stage("Moderation", "The Principal", "Moderates across departments", "Everyone", "5 working days", "Nothing publishes until it is done", ["Nobody"]),
  stage("Outcome shared", "Their line manager", "Shares the outcome", "Everyone", "5 working days", "Remind daily", ["The staff member"]),
  stage("Closed", "The Principal", "Closes the cycle", "Everyone", "No limit", "Remind daily", ["Everyone in the cycle"]),
];

const payrunStages = [
  stage("Built", "The Bursar", "Builds the run", "Every run", "No limit", "Remind daily", ["Nobody"]),
  stage("Checked", "The Bursar", "Checks it line by line", "Every run", "2 working days", "Remind daily", ["The Principal"]),
  stage("Approved", "The Proprietor", "Approves the total", "Every run", "2 working days", "Remind daily", ["The Bursar"]),
  stage("Released", "The Bursar", "Releases it to the bank", "Every run", "1 working day", "Remind daily", ["Everyone paid on it"]),
];

export const PROCESS_FLOWS: Record<FlowId, FlowDefinition> = {
  leave: {
    id: "leave",
    noun: "request",
    plainLabel: "How a request is approved",
    whoOpts: ["The head of department", "The Principal", "The Proprietor", "Their line manager", "The Bursar", "The Exam Officer", "The school administrator", "A named person"],
    doesOpts: ["Confirms cover only", "Approves or declines", "Approves, declines or returns it", "Approves within their limit", "Comments only", "Notified only"],
    scopeOpts: ["Every request", "Up to 10 days, in term time", "Above 10 days", "Unpaid leave", "Maternity and paternity", "Term-time only", "No cover arranged", "Teachers only"],
    winOpts: ["1 working day", "2 working days", "3 working days", "5 working days", "No limit"],
    silenceOpts: ["Escalate to the next stage", "Remind daily", "Return it to the requester", "Approve it automatically"],
    stages: leaveStages,
    presets: [
      { label: "Principal only", stages: [stage("Decision", "The Principal", "Approves, declines or returns it", "Every request", "3 working days", "Remind daily", ["The requester"])] },
      {
        label: "Cover, then Principal",
        stages: [
          stage("Cover check", "The head of department", "Confirms cover only", "Every request", "2 working days", "Escalate to the next stage", ["Nobody"]),
          stage("Decision", "The Principal", "Approves or declines", "Every request", "3 working days", "Remind daily", ["The requester"]),
        ],
      },
      { label: "Three stages · the default", stages: null },
    ],
    rules: ["Nobody approves their own leave", "A request already in flight keeps the sequence it started on", "Cover is read from the timetable, never ticked by hand", "Unpaid leave always reaches the Bursary"],
  },
  appraisal: {
    id: "appraisal",
    noun: "cycle",
    plainLabel: "How a cycle runs",
    whoOpts: ["The Principal", "Each staff member", "Their line manager", "The head of department", "The Proprietor", "A moderation panel", "Nobody — automatic"],
    doesOpts: ["Opens the cycle", "Self-rates against each KPI", "Rates them and writes the review", "Moderates across departments", "Shares the outcome", "Signs it off", "Closes the cycle"],
    scopeOpts: ["Everyone", "Teaching staff", "Leadership", "Support staff", "Below target", "Above target"],
    winOpts: ["5 working days", "10 working days", "15 working days", "The whole term", "No limit"],
    silenceOpts: ["Move on without it", "Remind daily", "Nothing publishes until it is done", "The manager’s rating stands"],
    stages: appraisalStages,
    presets: [
      {
        label: "Manager review only",
        stages: [
          stage("Published", "The Principal", "Opens the cycle", "Everyone", "No limit", "Nothing publishes until it is done", ["Everyone in the cycle"]),
          stage("Manager review", "Their line manager", "Rates them and writes the review", "Everyone", "10 working days", "Remind daily", ["The Principal"]),
          stage("Outcome shared", "Their line manager", "Shares the outcome", "Everyone", "5 working days", "Remind daily", ["The staff member"]),
        ],
      },
      { label: "Add a Proprietor sign-off", stages: null, append: stage("Signed off", "The Proprietor", "Signs it off", "Below target", "5 working days", "Remind daily", ["The Principal"]) },
      { label: "Six stages · the default", stages: null },
    ],
    rules: ["A KPI set whose weights do not total 100 cannot be published", "Staff see their running figures all term, not at review", "Automatic KPIs are read from the product, never typed", "Moderation compares departments before any outcome is shared"],
  },
  payrun: {
    id: "payrun",
    noun: "run",
    plainLabel: "How a run is released",
    whoOpts: ["The Bursar", "The Principal", "The Proprietor", "The school administrator", "Nobody — automatic"],
    doesOpts: ["Builds the run", "Checks it line by line", "Approves the total", "Releases it to the bank", "Confirms the bank has paid", "Notified only"],
    scopeOpts: ["Every run", "Above the usual total", "With an off-cycle payment", "With a new starter", "With unpaid leave on it"],
    winOpts: ["1 working day", "2 working days", "3 working days", "No limit"],
    silenceOpts: ["Remind daily", "Escalate to the next stage", "Return it to the Bursar"],
    stages: payrunStages,
    presets: [
      {
        label: "Bursar builds, Proprietor approves",
        stages: [
          stage("Built", "The Bursar", "Builds the run", "Every run", "No limit", "Remind daily", ["Nobody"]),
          stage("Approved", "The Proprietor", "Approves the total", "Every run", "2 working days", "Remind daily", ["The Bursar"]),
        ],
      },
      { label: "Four stages · the default", stages: null },
    ],
    rules: ["Nobody approves a run they built", "A released run is never edited — a correction is a named variation next run", "PAYE, pension and NHF are read from the statutory profile"],
  },
};

export function isFlowId(value: string): value is FlowId {
  return value === "leave" || value === "appraisal" || value === "payrun";
}

/** The three words a stage card ends on, for what happens when the clock runs out. */
export const SILENCE_SHORT: Record<string, string> = {
  "Escalate to the next stage": "then moves on",
  "Remind daily": "then reminds daily",
  "Return it to the requester": "then returns to them",
  "Approve it automatically": "then auto-approves",
  "Move on without it": "then moves on",
  "Nothing publishes until it is done": "blocks publishing",
  "The manager’s rating stands": "manager rating stands",
  "Return it to the Bursar": "then returns to the Bursar",
};

export function flowPlain(stages: FlowStageData[]): string {
  if (!stages.length) return "No stages — nothing would ever be decided.";
  const whos: string[] = [];
  for (const item of stages) {
    const who = item.who.replace(/^The /, "");
    if (who && !whos.includes(who)) whos.push(who);
  }
  const held = whos.length === 1 ? `Held by ${whos[0]}` : `Held by ${whos.slice(0, -1).join(", ")} and ${whos[whos.length - 1]}`;
  const timed = stages.filter((item) => /working day|term/.test(item.win)).length;
  const auto = stages.filter((item) => /automatic/i.test(item.silence)).length;
  const timing = timed === stages.length ? "every stage timed" : timed === 0 ? "no stage timed" : `${timed} of ${stages.length} timed`;
  return `${held}  ·  ${timing}${auto ? "  ·  one stage approves itself" : ""}`;
}
