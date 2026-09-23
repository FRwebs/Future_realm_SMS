import type { DrawerSpec, PanelFact } from "@/lib/modules/panels";

/**
 * The decisions waiting on the administrator.
 *
 * One decision, one definition. Command Center lists them under "My actions"
 * and Approvals lists them under "Waiting on me" — opening either lands on the
 * same drawer with the same facts, because a record has to read the same
 * wherever it is reached from.
 */

export type Decision = {
  id: string;
  /** How Command Center's "My actions" names it. */
  shortTitle: string;
  shortSub: string;
  /** How the Approvals queue names it. */
  queueTitle: string;
  queueSub: string;
  type: string;
  requester: string;
  requesterRole: string;
  /** What is held up while this is undecided. */
  blocking: string;
  blockingTone?: "negative" | "attention" | "neutral";
  age: string;
  ageTone?: "negative" | "attention" | "neutral";
  facts: PanelFact[];
  commitLabel: string;
  commitDone: string;
  commitDoneBody: string;
};

export const decisions: Decision[] = [
  {
    id: "score-correction-chemistry",
    shortTitle: "Chemistry SSS 2A — score correction",
    shortSub: "Requested by Mr Ibrahim Danladi",
    queueTitle: "Chemistry SSS 2A · score 29 → 51",
    queueSub: "Evidence attached · escalates in 2 days",
    type: "Score correction",
    requester: "Mr Samuel Adeyemi",
    requesterRole: "Sciences · Exam Officer",
    blocking: "1 teacher · 34 cards",
    blockingTone: "negative",
    age: "3 days",
    facts: [
      ["Request", "Change Tunde Ogunlesi's Chemistry examination score from 29 to 51"],
      [
        "Reason",
        "“Question 6 was marked out of 5 instead of 15. Three other scripts were affected and corrected before submission; this one was missed.”",
      ],
      ["Evidence", "Scanned script pages 3–4 attached"],
      [
        "His other scores this term",
        "Mathematics 54 · English 57 · Physics 49 · Biology 56",
        "A 29 is far from his own pattern",
      ],
      [
        "Class average in Chemistry",
        "58.4",
        "The corrected 51 sits below average, which is consistent",
      ],
      ["Downstream effect", "34 report cards in JSS 2A are blocked until this is decided"],
      ["Consequence if approved", "No card has been published, so no revision notice is needed"],
      [
        "Second approval",
        "Not required",
        "Score corrections need one approver under your routing",
      ],
    ],
    commitLabel: "Approve the correction",
    commitDone: "Correction approved",
    commitDoneBody:
      "The score is now 51, the sheet is final, and the 34 blocked cards in JSS 2A can generate.",
  },
  {
    id: "waiver-okonkwo",
    shortTitle: "Fee waiver — Okonkwo family",
    shortSub: "Bursar · ₦182,000 · hardship",
    queueTitle: "Okonkwo family · full waiver, ₦182,000",
    queueSub: "Father deceased · verified by the Bursar",
    type: "Waiver",
    requester: "Mrs Chinelo Obi",
    requesterRole: "Bursar",
    blocking: "1 family",
    age: "19 days",
    ageTone: "negative",
    facts: [
      ["Request", "Waive the full term's fee of ₦182,000 for the Okonkwo children"],
      ["Reason", "Father deceased. Hardship verified by the Bursar."],
      ["Evidence", "Death certificate and a letter from the mother, attached"],
      ["Children affected", "2 · SSS 2A and JSS 1B"],
      ["Second approval", "Required · Proprietor", "Fee waivers above ₦50,000 need two"],
      [
        "If it keeps waiting",
        "The family has been in arrears for 19 days",
        "Delay in this category costs a family most",
      ],
    ],
    commitLabel: "Approve the waiver",
    commitDone: "Waiver approved",
    commitDoneBody:
      "It is with the Proprietor for the second approval. The family has not been told yet.",
  },
  {
    id: "results-jss3-broadsheet",
    shortTitle: "JSS 3 broadsheet — approve for publication",
    shortSub: "Exam Officer · Mrs Folake Adeniyi",
    queueTitle: "JSS 3 broadsheet · approve for publication",
    queueSub: "112 cards wait on this decision",
    type: "Results",
    requester: "Mrs Folake Adeniyi",
    requesterRole: "Exam Officer",
    blocking: "112 cards",
    blockingTone: "negative",
    age: "2 days",
    facts: [
      ["Request", "Approve the JSS 3 broadsheet so its report cards can be published"],
      ["Scope", "JSS 3A, 3B and 3C · 112 students"],
      ["Second approval", "Required · Proprietor", "Publication is irreversible"],
      [
        "Irreversible?",
        "Yes — once published, a correction becomes a revision notice",
        "A family will already have seen the first version",
      ],
    ],
    commitLabel: "Approve for publication",
    commitDone: "Broadsheet approved",
    commitDoneBody:
      "It is with the Proprietor for the second approval. Nothing has reached a family yet.",
  },
  {
    id: "record-change-dob",
    shortTitle: "Date of birth change — Chioma Adebayo",
    shortSub: "Form master · evidence attached",
    queueTitle: "Chioma Adebayo · date of birth change",
    queueSub: "Birth certificate attached by the guardian",
    type: "Record change",
    requester: "Mrs Folake Adeniyi",
    requesterRole: "Form master",
    blocking: "—",
    age: "1 day",
    facts: [
      ["Request", "Correct the recorded date of birth"],
      ["From", "12 March 2011"],
      ["To", "12 March 2012"],
      ["Evidence", "Birth certificate attached by the guardian"],
      ["Why it matters", "The recorded date feeds the transcript and the WAEC entry file"],
      ["Both values kept", "Always", "The old value is never overwritten in the log"],
    ],
    commitLabel: "Approve the change",
    commitDone: "Record change approved",
    commitDoneBody:
      "The date of birth is corrected, the old value is kept in the log, and the guardian has been told.",
  },
  {
    id: "access-grace-etim",
    shortTitle: "New staff account — Grace Etim",
    shortSub: "Head of Department · Sciences",
    queueTitle: "Grace Etim · new staff account",
    queueSub: "Head of Department · Sciences",
    type: "Access",
    requester: "Mr Samuel Adeyemi",
    requesterRole: "Exam Officer",
    blocking: "—",
    age: "4 days",
    facts: [
      ["Request", "Create a staff account for Grace Etim"],
      ["Role template", "Head of Department · Sciences"],
      [
        "What that grants",
        "8 of 16 modules, her department only",
        "Approval of score sheets, nothing else",
      ],
      ["Data scope", "Their department"],
      ["Sensitive groups", "None", "Those are never inherited from a role"],
    ],
    commitLabel: "Approve the account",
    commitDone: "Account approved",
    commitDoneBody:
      "Grace Etim can sign in, with exactly what the Head of Department template grants and nothing more.",
  },
  {
    id: "communication-debtor-reminder",
    shortTitle: "Bulk reminder to 214 debtor families",
    shortSub: "Bursar · ₦3,210 in credits",
    queueTitle: "Fee reminder to 214 debtor families",
    queueSub: "Above the 150-recipient threshold",
    type: "Communication",
    requester: "Mrs Chinelo Obi",
    requesterRole: "Bursar",
    blocking: "—",
    age: "6 hours",
    facts: [
      ["Request", "Send a fee reminder to 214 families in arrears"],
      ["Why it needs approval", "Above the 150-recipient threshold"],
      ["Cost", "₦3,210 in SMS credits", "Charged on send, not on approval"],
      ["What each family sees", "Their own balance only", "Nothing about anyone else"],
    ],
    commitLabel: "Approve the send",
    commitDone: "Send approved",
    commitDoneBody:
      "The reminder has gone to 214 families, each showing only their own balance. ₦3,210 in credits was used.",
  },
];

/** The drawer a decision opens, wherever it is reached from. */
export function decisionDrawer(decision: Decision): DrawerSpec {
  return {
    mode: "commit",
    kicker: `Approvals · ${decision.type}`,
    title: decision.queueTitle,
    sub: "The context needed to judge it — not just the change.",
    facts: [
      ["Requested by", decision.requester, decision.requesterRole],
      ["Waiting", decision.age],
      ...decision.facts,
      [
        "Who may decide",
        "You",
        "Nobody can approve their own submission, whatever the route says",
      ],
    ],
    commitLabel: decision.commitLabel,
    commitNote:
      "Approving releases whatever is blocked behind it. The decision is logged under your name.",
    commitDone: decision.commitDone,
    commitDoneBody: decision.commitDoneBody,
  };
}

export function decisionById(id: string): Decision {
  return decisions.find((decision) => decision.id === id) ?? decisions[0]!;
}
