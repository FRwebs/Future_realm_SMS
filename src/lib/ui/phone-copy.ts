/**
 * Tight copy for a phone.
 *
 * The parent, teacher and student mobile mockups all end with the same pass over their words ("the last word on mobile text length"): a
 * line under a title that only restates the title is dropped, a note keeps its first clause, a line of facts loses its prose. This is that
 * pass, written once, for the strings that sit under a panel's title, foot and hints. It is a rule about length and shape, not a
 * dictionary — so it works on whatever a page says, and it only ever shortens: anything already short enough comes back unchanged.
 *
 * Used only by the phone drawings of a panel. The laptop keeps every word.
 */

type Rule = "bsub" | "foot" | "rhint" | "note" | "hint" | "tile" | "opt";

const INSTRUCTION = /^(Tap|Open|Click|Choose|Select|Pick|Swipe|Use|Press) /;

/** Split into sentences, but not after an abbreviation or before a lower-case word. */
function sentences(text: string): string[] {
  const parts: string[] = [];
  text.split(/(?<=[.!?][”’")]?)\s+/).forEach((piece) => {
    const previous = parts[parts.length - 1];
    if (previous && (/\b(Mr|Mrs|Ms|Dr|St|No|vs|v|e\.g|i\.e|[A-Z])\.$/.test(previous) || /^[a-z(]/.test(piece))) parts[parts.length - 1] = `${previous} ${piece}`;
    else parts.push(piece);
  });
  return parts;
}

/** End a sentence at its first explanatory turn — an em dash, a semicolon, "because", "so that"... */
function cut(input: string): string {
  let s = input.trim();
  const end = /\?$/.test(s) ? "?" : /\.$/.test(s) ? "." : "";
  const at = (pattern: RegExp, min: number) => {
    const match = pattern.exec(s);
    if (match && match.index >= min) {
      s = s.slice(0, match.index).replace(/[,;:.]$/, "") + end;
      return true;
    }
    return false;
  };
  const dash = s.indexOf(" — ");
  const atDash = dash >= 14 && s.slice(0, dash).split(" ").length >= 4 && at(/ — /, 14);
  if (!atDash && !at(/; /, 16) && !at(/, (so|so that|because|which|and so|rather than|not|never|whatever|while|unless|otherwise|whichever|until|before|since|meaning|leaving)\b/, 18)) {
    at(/ (because|so that|rather than|regardless of|without exception)\b/, 22);
  }
  if ((s.match(/“/g) ?? []).length > (s.match(/”/g) ?? []).length) s = s.replace(/[.,;]?$/, ".”");
  return s;
}

/** The first sentence that says something, leaving out "Tap..." instructions. */
function lead(text: string, wantDigit = false): string {
  let parts = sentences(text);
  const keep = parts.filter((part) => !INSTRUCTION.test(part));
  if (keep.length) parts = keep;
  else return "";
  let first = parts[0];
  if (wantDigit && !/\d/.test(first)) {
    const withDigit = parts.find((part) => /\d/.test(part));
    if (withDigit) first = withDigit;
  }
  const next = parts[parts.indexOf(first) + 1];
  if (first.length < 14 && next) return `${first} ${cut(next)}`;
  return cut(first);
}

/** A line of facts (separated by " · ", or no three lower-case words in a row) rather than a sentence. */
const isData = (s: string) => / · /.test(s) || !/[a-z’]{2,} [a-z’]{2,} [a-z’]{2,}/.test(s);

/** Keep a " · " line's segments while they fit. */
function segments(s: string, max: number): string {
  const parts = s
    .split(" · ")
    .map((piece) => {
      const each = sentences(piece);
      if (each.length < 2) return piece;
      const data = each.filter((sentence) => isData(sentence.replace(/\.$/, "")));
      return data.length ? data.join(" ").replace(/\.$/, "") : piece;
    })
    .map((piece) => (piece.length > 34 && !isData(piece) ? cut(piece.replace(/\.$/, "")) : piece))
    .filter((piece) => piece.length <= 44 || isData(piece));
  let out = parts.shift() ?? "";
  for (const piece of parts) {
    if (`${out} · ${piece}`.length > max && out) break;
    out += ` · ${piece}`;
  }
  if (out.length < 16 && !isData(s.split(" · ")[0])) {
    const sentence = lead(s.replace(/ · /g, " "));
    return sentence.length <= 64 ? sentence : "";
  }
  return out;
}

export function tightCopy(rule: Rule, input: string): string {
  const length = input.length;
  const data = isData(input);
  const instruction = INSTRUCTION.test(input);
  switch (rule) {
    case "bsub": {
      if (data) return segments(input, 72);
      const sentence = lead(input);
      return sentence.length <= 64 ? sentence : "";
    }
    case "foot": {
      if (data && length <= 72) return input;
      const sentence = lead(input);
      return /\d/.test(sentence) && sentence.length <= 64 ? sentence : "";
    }
    case "note": {
      if (length <= 48 && !instruction) return input;
      const sentence = lead(input);
      return sentence.length <= 70 ? sentence : "";
    }
    case "hint": {
      if (data) return segments(input, 56);
      if ((length <= 48 || (length <= 66 && /\d/.test(input))) && !instruction) return input;
      const sentence = lead(input, true);
      return sentence.length <= 64 ? sentence : "";
    }
    case "rhint": {
      if (length <= 52) return input;
      if (data) return segments(input, 52);
      const sentence = lead(input, true);
      return sentence.length <= 52 ? sentence : "";
    }
    case "tile": {
      if (length <= 48) return input;
      if (data) {
        const grouped = segments(input, 40);
        return grouped.length <= 44 ? grouped : "";
      }
      const first = cut(sentences(input)[0]);
      return first.length <= 36 ? first : "";
    }
    case "opt": {
      if (length <= 64) return input;
      if (data) return segments(input, 64);
      const sentence = lead(input, true) || cut(input);
      return sentence.length <= 76 ? sentence : cut(sentence.replace(/, .*$/, "."));
    }
  }
}

/** Which rule a field gets, by its name. Only the words under a panel's title, its foot and its hints are touched. */
const FIELD_RULE: Record<string, Rule> = { sub: "bsub", foot: "foot", note: "note", hint: "rhint" };

/**
 * A copy of the panel with its long supporting lines tightened. Strings under 28 characters, and every other field (titles, labels,
 * values, notices, errors, links), are left exactly as they are.
 */
export function tightPanel<T>(value: T): T {
  const seen = new WeakSet<object>();
  const walk = (node: unknown, depth: number): unknown => {
    if (!node || typeof node !== "object" || depth > 14) return node;
    if (Array.isArray(node)) return node.map((item) => walk(item, depth + 1));
    if (Object.getPrototypeOf(node) !== Object.prototype || seen.has(node)) return node;
    seen.add(node);
    const out: Record<string, unknown> = {};
    for (const [key, inner] of Object.entries(node as Record<string, unknown>)) {
      const rule = FIELD_RULE[key];
      out[key] = typeof inner === "string" ? (rule && inner.length >= 28 ? tightCopy(rule, inner) : inner) : walk(inner, depth + 1);
    }
    return out;
  };
  return walk(value, 0) as T;
}
