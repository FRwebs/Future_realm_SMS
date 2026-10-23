/** The layout a school has adopted, as the report card reads it. */
export const REPORT_LAYOUT = { resource: "report-layout", code: "CURRENT" } as const;
export type AdoptedLayout = {
  layoutId: string;
  name: string;
  version: number;
  adoptedAt: string;
  spec: { sections?: Record<string, boolean>; positionRule?: string; averaging?: string; gradingDisplay?: string };
};

