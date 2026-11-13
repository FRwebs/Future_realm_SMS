/**
 * The supporting line under a figure on a card.
 *
 * It earns its place by adding something the label and the number do not already say. Anything
 * longer than a glance is cut back to the clauses that do — the rest belongs on the list the card
 * links to. The mockup applies this to every card in the product, on a phone as on a laptop, so a
 * row of cards can never have one of them standing taller than the rest over a long sentence.
 */
export function slimSub(value: string, label?: string): string {
  const text = value.replace(/\s+/g, " ").trim().replace(/\.$/, "");
  // A line that only says what the label already says is not carried at all.
  if (!text || (label && text.toLowerCase() === label.toLowerCase())) return "";
  if (text.length <= 40) return text;

  for (const separator of [" · ", " — ", "; ", ", "]) {
    const parts = text.split(separator);
    if (parts.length > 1 && parts[0]!.length <= 40) {
      let out = parts[0]!;
      for (const part of parts.slice(1)) {
        if (`${out}${separator}${part}`.length > 40) break;
        out += `${separator}${part}`;
      }
      return out;
    }
  }
  return text;
}
