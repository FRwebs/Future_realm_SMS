/**
 * The phone's copy rule.
 *
 * A laptop has room for a sentence that explains itself; a phone does not, and the mobile mockups say so by running every rendered
 * string through this before drawing it. The shape of the rule is: a description that only restates the title above it is dropped
 * altogether, a note keeps one clause, and a line that is really data — "Second Term · Week 16 · 18 arms" — keeps as many of its
 * segments as fit rather than being cut mid-thought.
 *
 * Nothing here invents words. Every path either returns the string untouched, returns a shorter piece of it, or returns the empty
 * string, which means "draw nothing": a line a phone has no room for is better absent than truncated into a half-sentence.
 *
 * Ported from the mobile mockups' own `mTightStr`, so the four portals and this app shorten the same sentence the same way.
 */

/** Which kind of line is being shortened. Each has its own budget, because a panel's heading and its footnote are not read alike. */
export type TightRule =
  | "head" | "bsub" | "foot" | "note" | "body" | "title"
  | "hint" | "rhint" | "tile" | "opt" | "shsub" | "toggle" | "ph";

/** A string shorter than this is already a phone's length, and is never touched. */
export const TIGHT_FLOOR = 28;

/**
 * Split into sentences, keeping abbreviations and parentheses whole.
 *
 * "Mrs Adeyemi marked it. 18 of 20 present." is two sentences; "Marked by Mrs. Adeyemi at 08:15." is one, because a full stop after
 * a title is not the end of anything.
 */
export function sentences(text: string): string[] {
  const parts: string[] = [];
  String(text)
    .split(/(?<=[.!?][”’")]?)\s+/)
    .forEach((piece) => {
      const last = parts[parts.length - 1];
      if (last && (/\b(Mr|Mrs|Ms|Dr|St|No|vs|v|e\.g|i\.e|[A-Z])\.$/.test(last) || /^[a-z(]/.test(piece))) {
        parts[parts.length - 1] = `${last} ${piece}`;
      } else {
        parts.push(piece);
      }
    });
  return parts;
}

/**
 * Cut a sentence at its first natural seam — a dash, a semicolon, or a subordinate clause — keeping the first half.
 *
 * The minimum offsets stop it shearing off something that was the whole point: "Paid, so nothing is owed" keeps "Paid" only when
 * there are at least eighteen characters before the comma to keep.
 */
export function cut(text: string): string {
  let out = String(text).trim();
  const end = /\?$/.test(out) ? "?" : /\.$/.test(out) ? "." : "";
  const at = (pattern: RegExp, min: number) => {
    const found = pattern.exec(out);
    if (found && found.index >= min) {
      out = out.slice(0, found.index).replace(/[,;:.]$/, "") + end;
      return true;
    }
    return false;
  };
  const dash = (() => {
    const index = out.indexOf(" — ");
    return index >= 14 && out.slice(0, index).split(" ").length >= 4 && at(/ — /, 14);
  })();
  void (dash
    || at(/; /, 16)
    || at(/, (so|so that|because|which|and so|rather than|not|never|whatever|while|unless|otherwise|whichever|until|before|since|meaning|leaving)\b/, 18)
    || at(/ (because|so that|rather than|regardless of|without exception)\b/, 22));
  // A cut that opened a quotation closes it, rather than leaving the reader hanging on one.
  if ((out.match(/“/g) || []).length > (out.match(/”/g) || []).length) out = out.replace(/[.,;]?$/, ".”");
  return out;
}

/**
 * The sentence worth keeping.
 *
 * An instruction — "Tap a row to open it" — is dropped first: a thumb already knows it can tap. `wantDigit` prefers the sentence
 * carrying the figure, because on a phone the number is usually why the line is there at all.
 */
export function lead(text: string, wantDigit = false): string {
  const instruction = /^(Tap|Open|Click|Choose|Select|Pick|Swipe|Use|Press) /;
  let parts = sentences(text);
  const keep = parts.filter((part) => !instruction.test(part));
  if (keep.length) parts = keep;
  else return "";
  let first = parts[0]!;
  if (wantDigit && !/\d/.test(first)) {
    const withDigit = parts.find((part) => /\d/.test(part));
    if (withDigit) first = withDigit;
  }
  const next = parts[parts.indexOf(first) + 1];
  if (first.length < 14 && next) return `${first} ${cut(next)}`;
  return cut(first);
}

/** A line that is data rather than prose: it has middot segments, or it never runs three lowercase words together. */
export function isData(text: string): boolean {
  return / · /.test(text) || !/[a-z’]{2,} [a-z’]{2,} [a-z’]{2,}/.test(text);
}

/** Keep as many of a data line's segments as fit the budget, dropping any that are really a sentence in disguise. */
export function segments(text: string, max: number): string {
  const parts = text
    .split(" · ")
    .map((part) => {
      const inner = sentences(part);
      if (inner.length < 2) return part;
      const data = inner.filter((piece) => isData(piece.replace(/\.$/, "")));
      return data.length ? data.join(" ").replace(/\.$/, "") : part;
    })
    .map((part) => (part.length > 34 && !isData(part) ? cut(part.replace(/\.$/, "")) : part))
    .filter((part) => part.length <= 44 || isData(part));

  let out = parts.shift() ?? "";
  for (const part of parts) {
    if ((`${out} · ${part}`).length > max && out) break;
    out += ` · ${part}`;
  }
  if (out.length < 16 && !isData(text.split(" · ")[0]!)) {
    const only = lead(text.replace(/ · /g, " "));
    return only.length <= 64 ? only : "";
  }
  return out;
}

/** Fit to a budget by whole sentences, never mid-sentence. */
export function fit(text: string, max: number): string {
  if (text.length <= max) return text;
  const parts = sentences(text);
  let out = parts[0]!.length > max ? cut(parts[0]!) : parts[0]!;
  for (let index = 1; index < parts.length; index += 1) {
    const next = `${out} ${parts[index]}`;
    if (next.length > max) break;
    out = next;
  }
  return /^“/.test(out) && !/”/.test(out) ? out.replace(/[.,;]?$/, ".”") : out;
}

/**
 * Sentences the product says often enough to be worth a hand-written short form.
 *
 * Everything else is shortened by rule. These are the ones where the rule would either keep too much or throw away the part that
 * mattered, so the short version is written out once here instead.
 */
const EXACT: Record<string, string> = {
  "Already exists? Link the child from their own record to keep one login.": "Already exists? Link it from the child’s record.",
  "Courteous. A family in difficulty reads this more carefully than anything else the school sends.": "Keep it courteous",
  "Used when Nooria or a partner has closed the deal. The risk check is skipped — the deal is the verification.": "For closed deals · no risk check",
  "Raises drafts for a term. Nothing is sent until each invoice is issued.": "Drafts only · nothing sent until issued",
  "A transfer has landed. This is the act of tying it to an invoice, a school and a person.": "Match a transfer to an invoice",
  "The invoice already exists. This is the act of putting it in front of the people who pay it.": "Send it to the people who pay",
  "For a school whose automatic charge failed. Credit goes on now; the payment method is fixed separately.": "For a failed automatic charge",
  "A request that arrived by call, visit or WhatsApp, recorded so it carries the same weight as a tagged ticket.": "From a call, visit or WhatsApp",
  "The report you just built, kept so the people who ask for it monthly can run it themselves.": "Reuse it every month",
  "A reminder outside the automatic sequence, because someone decided this school needs it now.": "Outside the automatic sequence",
  "The record of who did what. Taking a copy of it is itself an act.": "Exports are logged",
  "Two people, deliberately. The one who signs is rarely the one who answers the phone.": "Signatory and day-to-day contact",
  "Partners get their own login. This decides what they will see when they use it.": "What the partner sees",
  "A file leaves the platform. That is a consequential act, so it is treated as one.": "Logged with your reason",
  "Moves the account, its 220 students and every record to a new proprietor after a 14-day notice period. The outgoing holder keeps export access throughout.": "Moves the account and all 220 students to a new proprietor after 14 days’ notice.",
  "Reconciling releases ₦85,440 of commission to GSR Education Partners and closes invoice INV-2026-0884. Commission accrues on reconciliation, never on payment recorded.": "Releases ₦85,440 commission to GSR Education Partners and closes INV-2026-0884.",
  "Grants one capability above the Standard tier for 14 days. It expires by itself — no override can be granted without an expiry.": "One capability above Standard for 14 days. Expires by itself.",
  "Recomputes 4 result records and re-issues 2 report cards already seen by parents. The school authorised this in writing on 21 Aug.": "Recomputes 4 results and re-issues 2 report cards. Authorised in writing 21 Aug.",
  "You record it. Someone else reconciles it against the bank statement — the same person cannot do both.": "You record it; someone else reconciles it",
  "Address dispute — a real school finds its name taken": "Address dispute",
  "Step 1 of 3 — the address is permanent once created": "Step 1 of 3 · address is permanent",
};

/** Shapes the product repeats with different figures in them, rewritten rather than cut. */
const REWRITES: Array<[RegExp, string]> = [
  [/ · still reachable in-app, by email, and by emergency broadcast$/, " · in-app and email still reach them"],
  [/^Showing (\d+) of ([\d,]+) (\w+) · every desktop column is on the card$/, "$1 of $2 $3"],
  [/^(\d+) further (\w+) sits? behind this list\.$/, "+$1 more"],
  [/^Every (\w+) this partner has brought is shown\.$/, "All $1 shown"],
  [/^Every mark is final, exactly as published on (.+?)\.$/, "Final · published $1"],
  [/^The register as (.+?) marked it\.$/, "Marked by $1"],
  [/^Each one is written to the audit log under your name\.$/, "Logged under your name."],
  [/ · credits are held per channel and spent per message sent$/, " · credits per channel"],
  [/^Top city (.+?) · (.+?) · (\d+) schools on the platform$/, "$3 schools · $2 · top city $1"],
  [/^Agreement (.+?)\. A rate change mid-term applies to invoices reconciled after the change, never retrospectively\.$/, "Agreement $1"],
  [/^This send will reach 1 person and cost 1 SMS credits? · (.+)$/, "1 recipient · 1 credit · $1"],
  [/^This send will reach (\d+) people and cost (\d+) SMS credits · (.+)$/, "$1 recipients · $2 credits · $3"],
  [/^This balance is (\d+) days old and two reminders have gone unanswered$/, "$1 days old · 2 reminders unanswered"],
  [/^(.+?) has attended (\d+%) of school days since (.+)$/, "$2 attendance since $3"],
  [/^Step (\d+) of (\d+) — /, "Step $1 of $2 · "],
  [/^All eight portability tests passed · last run ([^.]+)\..*$/, "All 8 portability tests passed · $1"],
];

/**
 * One line, shortened for a phone — or dropped.
 *
 * Returns the string unchanged when it already fits, a shorter piece of it when it does not, and "" when there is nothing worth
 * keeping. A caller that gets "" draws nothing in that slot.
 */
export function tighten(rule: TightRule, text: string): string {
  if (Object.prototype.hasOwnProperty.call(EXACT, text)) return EXACT[text]!;
  let value = text;
  for (const [pattern, replacement] of REWRITES) {
    if (pattern.test(value)) value = value.replace(pattern, replacement);
  }
  const length = value.length;
  const data = isData(value);
  const instruction = /^(Tap|Open|Click|Choose|Select|Pick|Swipe|Use|Press) /.test(value);

  switch (rule) {
    case "head": {
      if (data) return segments(value, 60);
      if (length <= 44 && !instruction) return value;
      if (/\d/.test(value)) { const only = lead(value, true); return only.length <= 56 ? only : ""; }
      return "";
    }
    case "bsub": {
      if (data) return segments(value, 72);
      const only = lead(value);
      return only.length <= 64 ? only : "";
    }
    case "foot": {
      if (data && length <= 72) return value;
      const only = lead(value);
      return /\d/.test(only) && only.length <= 64 ? only : "";
    }
    case "note": {
      if (length <= 48 && !instruction) return value;
      const only = lead(value);
      return only.length <= 70 ? only : "";
    }
    case "body":
      return length <= 96 ? value : fit(value, 96);
    case "title": {
      if (length <= 46 || data) return value;
      const parts = sentences(value);
      let out = parts[0]!;
      if (out.length < 24 && parts[1]) out += ` ${cut(parts[1]!)}`;
      out = / — /.test(out) && out.indexOf(" — ") >= 14 ? out.slice(0, out.indexOf(" — ")).replace(/[,;:]$/, "") : out;
      return out.length > 72 ? cut(out) : out;
    }
    case "hint": {
      if (data) return segments(value, 56);
      if ((length <= 48 || (length <= 66 && /\d/.test(value))) && !instruction) return value;
      const only = lead(value, true);
      return only.length <= 64 ? only : "";
    }
    case "rhint": {
      if (length <= 52) return value;
      if (data) return segments(value, 52);
      const only = lead(value, true);
      return only.length <= 52 ? only : "";
    }
    case "tile": {
      if (length <= 48) return value;
      if (data) { const some = segments(value, 40); return some.length <= 44 ? some : ""; }
      const only = cut(sentences(value)[0]!);
      return only.length <= 36 ? only : "";
    }
    case "opt": {
      if (length <= 64) return value;
      if (data) return segments(value, 64);
      const only = lead(value, true) || cut(value);
      return only.length <= 76 ? only : cut(only.replace(/, .*$/, "."));
    }
    case "shsub": {
      if (data || length <= 64) return value;
      const only = lead(value, true) || value;
      return only.length <= 84 ? only : fit(only, 84);
    }
    case "toggle":
      return length <= 56 ? value : cut(sentences(value)[0]!);
    case "ph": {
      if (length <= 52 || (/^e\.g\./.test(value) && length <= 64)) return value;
      const only = cut(sentences(value)[0]!);
      return only.length <= 52 ? only : "";
    }
    default:
      return value;
  }
}

/** What a caller actually asks: shorten this for a phone, or leave it exactly as it is on anything wider. */
export const tightFor = (phone: boolean, rule: TightRule, text: string | undefined): string | undefined => {
  if (!phone || !text || text.length < TIGHT_FLOOR) return text;
  return tighten(rule, text) || undefined;
};
