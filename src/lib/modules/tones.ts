import type { PanelTone } from "@/lib/modules/panels";

/**
 * The mockup's status palette, verbatim.
 *
 * Each tone is [background, text, dot, border]. A state shows in the numeral
 * colour and in small accents — never in the box itself, so a row of cards can
 * never read as a row of different components.
 *
 * These are literals rather than theme tokens because they are the mockup's own
 * semantic vocabulary: the same amber means "attention" in Attendance and in
 * Fee Management, and it has to match across the product.
 */
export type ToneSwatch = {
  /** Tint behind a chip or pill. */
  bg: string;
  /** Text and icon stroke. */
  fg: string;
  /** The small status dot. */
  dot: string;
  /** Border around a chip. */
  bd: string;
};

export const toneSwatches: Record<PanelTone, ToneSwatch> = {
  neutral: { bg: "#F2F7F4", fg: "#5F6E65", dot: "#9FB8A7", bd: "#E4EDE8" },
  progress: { bg: "#EBF1FA", fg: "#2A5A96", dot: "#4A83CE", bd: "#DCE7F5" },
  submitted: { bg: "#EEEDFA", fg: "#4A44A0", dot: "#6B62CE", bd: "#E1DFF4" },
  positive: { bg: "#EAF6F0", fg: "#17714F", dot: "#22A06B", bd: "#CFE4DB" },
  attention: { bg: "#FDF6E7", fg: "#8A6410", dot: "#D99A0B", bd: "#F2E4C6" },
  // The mockup calls this "critical".
  negative: { bg: "#FDF3F3", fg: "#B23B3B", dot: "#DB5555", bd: "#F3E0E0" },
  withheld: { bg: "#F5F0FA", fg: "#6B4E9E", dot: "#8B6FC4", bd: "#E7DDF2" },
  sensitive: { bg: "#FBF2EC", fg: "#94553A", dot: "#C07A55", bd: "#F0DDD0" },
  offline: { bg: "#F4F6F5", fg: "#5A6862", dot: "#8A9A92", bd: "#E2E8E5" },
  vendor: { bg: "#F0F4FC", fg: "#3A4E86", dot: "#5B72B8", bd: "#DBE3F3" },
};

export function toneOf(tone: PanelTone | undefined, fallback: PanelTone = "neutral"): ToneSwatch {
  return toneSwatches[tone ?? fallback] ?? toneSwatches.neutral;
}

/** The ink the mockup uses for every figure that has no state of its own. */
export const INK = "#0D2315";
/** The mockup's muted label colour. */
export const MUTED = "#67766D";
/** Hairline around a card, and the colour it takes on hover. */
export const CARD_BORDER = "#DEE8E2";
export const CARD_BORDER_HOVER = "#BFDCD1";
