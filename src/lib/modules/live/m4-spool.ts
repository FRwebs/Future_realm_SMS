export type Section = { title: string; head: string[]; rows: string[][] };
export type Spool = {
  meta: { title: string; subject: string; period: string; from: string; to: string; purpose: string; letterhead: boolean; school: string; generatedAt: string; by: string; marks: number; children: number; format: string };
  sections: Section[];
};
