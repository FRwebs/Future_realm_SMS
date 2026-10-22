import type { PanelAction, PanelRow, TabContent } from "@/lib/modules/panels";

/**
 * Admin-built pages a teacher is sent to keep their behaviour; what they link to is filtered to what a teacher holds, so nothing on
 * the page leads to a view that is not theirs. A link is dropped when its words say it is about the whole school, or about an arm
 * they were not named on.
 */
const WHOLE_SCHOOL = /whole.school|whole term|register history|attendance history|attendance trends|choose a different arm|^open (jss|sss|nursery|primary)\b|see who has not|review queue|review submissions|off-app|spool/i;

const keep = (action: PanelAction | null | undefined, extra?: RegExp) => Boolean(action) && !WHOLE_SCHOOL.test(action!.label) && !(extra && extra.test(action!.label));

export function scrubForTeacher<T extends TabContent & { crumb?: { label: string; href: string } }>(content: T, o: { back?: { label: string; href: string }; extra?: RegExp } = {}): T {
  const rows: PanelRow[] = (content.rows ?? []).map((panelRow) => ({
    ...panelRow,
    panels: panelRow.panels.map((panel) => {
      const copy: Record<string, unknown> = { ...panel };
      if (Array.isArray(copy.acts)) copy.acts = (copy.acts as PanelAction[]).filter((action) => keep(action, o.extra));
      if (Array.isArray(copy.cards)) copy.cards = (copy.cards as Array<{ link?: string; href?: string; drawer?: unknown }>).map((card) => (card.link && !keep({ label: card.link }, o.extra) ? { ...card, link: undefined, href: undefined, drawer: undefined } : card));
      return copy as unknown as typeof panel;
    }),
  }));
  return {
    ...content,
    primary: content.primary && keep(content.primary, o.extra) ? content.primary : undefined,
    launchers: (content.launchers ?? []).filter((action) => keep(action, o.extra)),
    ...(content.crumb && o.back ? { crumb: o.back } : {}),
    rows,
  };
}

/** What a teacher's view of a child's record never carries: money, discipline files, record changes made in the registry, publication. */
const NOT_A_TEACHERS = /fee|billed|outstanding|invoice|payment|waiver|balance|discipline|change request|publish|receipt|owing|owed by/i;

type AnyPanel = Record<string, unknown> & { type: string };

export function scrubStudentRecord<T extends TabContent>(content: T, o: { extra?: RegExp } = {}): T {
  const bad = (value: unknown) => typeof value === "string" && (NOT_A_TEACHERS.test(value) || Boolean(o.extra?.test(value)));
  const okAction = (action: { label?: string } | null | undefined) => Boolean(action) && !bad(action!.label);
  const rows: PanelRow[] = [];
  for (const panelRow of content.rows ?? []) {
    const panels = panelRow.panels.flatMap((panel) => {
      const copy: AnyPanel = { ...(panel as unknown as AnyPanel) };
      if (bad(copy.title)) return [];
      if (Array.isArray(copy.cards)) copy.cards = (copy.cards as Array<{ label?: string }>).filter((card) => !bad(card.label));
      if (Array.isArray(copy.facts)) copy.facts = (copy.facts as Array<[string, ...unknown[]]>).filter((fact) => !bad(fact[0]));
      if (Array.isArray(copy.items)) copy.items = (copy.items as Array<{ label?: string }>).filter((item) => !bad(item.label));
      if (Array.isArray(copy.tiles)) copy.tiles = (copy.tiles as Array<{ label?: string }>).filter((tile) => !bad(tile.label));
      if (Array.isArray(copy.acts)) copy.acts = (copy.acts as Array<{ label?: string }>).filter(okAction);
      if (Array.isArray(copy.cards) && !(copy.cards as unknown[]).length) return [];
      return [copy as unknown as typeof panel];
    });
    if (panels.length) rows.push({ cols: panels.length === panelRow.panels.length ? panelRow.cols : panels.map(() => "1fr").join(" "), panels });
  }
  return { ...content, primary: okAction(content.primary) ? content.primary : undefined, launchers: (content.launchers ?? []).filter(okAction), rows };
}
