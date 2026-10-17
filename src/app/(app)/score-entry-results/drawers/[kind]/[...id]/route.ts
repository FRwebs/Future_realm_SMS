import { NextResponse } from "next/server";

import { apiGet } from "@/lib/api/server";
import { SR } from "@/lib/modules/live/m5-forms";
import type { Explain } from "@/lib/modules/live/m5-types";
import type { DrawerSpec, PanelFact } from "@/lib/modules/panels";

/** The explanation behind one number, prepared when it is asked for: read from what was stored, never recomputed to taste. */
export async function GET(_request: Request, { params }: { params: Promise<{ kind: string; id: string[] }> }) {
  const { kind, id } = await params;
  try {
    const [classId, studentId, subjectId] = id;
    const data = await apiGet<Explain>(`${SR}/results/${encodeURIComponent(classId)}/${encodeURIComponent(studentId)}/explain${kind === "subject" && subjectId ? `?subject=${encodeURIComponent(subjectId)}` : ""}`);
    if (data.kind === "subject") {
      const facts: PanelFact[] = [
        ...data.lines.map((line): PanelFact => [line.name, line.value === null ? "Nothing entered" : line.value === "Absent" ? "Absent" : `${line.value} of ${line.max} · weight ${line.weight}%`, line.at ? `Entered ${line.at}${line.by ? ` by ${line.by}` : ""}${line.corrected ? ` · corrected ${line.corrected}×` : ""}` : line.value === "Absent" ? "Excluded from the total — never scored zero" : "Not counted — never scored zero"]),
        ["Total", data.total === null ? "—" : `${data.total}`, "Sum across the components that were entered"],
        ["Grade", data.grade ? `${data.grade.label} · ${data.grade.remark}` : "—", data.grade ? `${data.grade.min}–${Math.floor(data.grade.max)}${data.grade.gpa !== null ? ` · grade point ${data.grade.gpa}` : ""}` : ""],
        ["Position", data.pos ? `${data.ordinal} of ${data.outOf} in ${data.arm}` : "Not ranked", data.levelPos ? `${data.levelPos} of ${data.levelOutOf} in ${data.level}` : ""],
        ["Teacher", data.teacher ?? "—", `Sheet ${data.state.toLowerCase()}${data.approvedBy ? ` · approved by ${data.approvedBy}${data.approvedAt ? ` on ${data.approvedAt}` : ""}` : ""}`],
        ["Framework", data.frameworkAt ? `Pinned on ${data.frameworkAt}` : "In force today", "The rules in force when the sheet was begun"],
        ["Corrections", data.corrections.length ? data.corrections.map((entry) => `${entry.component} ${entry.from ?? "blank"} → ${entry.to < 0 ? "absent" : entry.to} (${entry.status.toLowerCase()})`).join("; ") : "None", data.corrections.length ? "" : "The value has never changed since entry"],
      ];
      return NextResponse.json({ mode: "view", kicker: "Explain this result", title: `${data.student.name} · ${data.subject} · ${data.total ?? "—"} of 100`, sub: "This reads what was stored when the result was entered. It is not recalculated now, so it cannot drift from the figure the family already holds.", facts, tone: "positive", readOnly: true } satisfies Partial<DrawerSpec>);
    }
    const facts: PanelFact[] = [
      ...data.lines.map((line): PanelFact => [line.name, line.total === null ? "No total" : String(line.total), line.why]),
      ["Sum of the subjects that count", String(data.sum), `${data.count} ${data.count === 1 ? "subject" : "subjects"}`],
      ["Average", data.average === null ? "—" : `${data.sum} ÷ ${data.count} = ${data.average}`, "The mean of the subjects that count"],
      ["Grade", data.grade ?? "—", `${data.scheme} · ${data.bands.map((band) => `${band.label} ${band.min}–${Math.floor(band.max)}`).join(" · ")}`],
      ["Position", data.pos ? `${data.pos} of ${data.outOf} in ${data.arm}` : "Not ranked", "Ties share the position"],
    ];
    return NextResponse.json({ mode: "view", kicker: "Explain this result", title: `${data.student.name} · ${data.term}`, sub: "Every subject that went into the average, and every one that was left out and why.", facts, tone: "positive", readOnly: true } satisfies Partial<DrawerSpec>);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "That could not be explained." }, { status: 403 });
  }
}
