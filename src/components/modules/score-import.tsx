"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { sendJsonForData } from "@/lib/modules/submit";

type Preview = {
  sheet: { arm: string; subject: string; roll: number };
  matched: number; unchanged: number; changeCount: number; problemCount: number; unmatchedCount: number;
  changes: Array<{ studentId: string; name: string; adm: string; column: string; from: string; to: string }>;
  problems: string[]; unmatched: string[]; ignoredColumns: string[]; missingColumns: string[]; canApply: boolean;
};

const INK = "#0D2315";
const MUTED = "#5F6E65";
const BORDER = "#DEE8E2";

const toBase64 = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("That file could not be read."));
    reader.readAsDataURL(file);
  });

/**
 * Import a sheet's scores from the school's Excel template. Nothing is written until the person has seen every change and says so:
 * the preview lists what each cell would do, and the import goes through the same save a typed score does — as a draft.
 */
export function ScoreImport({ classId, subjectId, back }: { classId: string; subjectId: string; back: string }) {
  const router = useRouter();
  const base = `/api/v1/score-results/enter/${classId}/${subjectId}`;
  const [file, setFile] = useState<{ name: string; data: string } | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ applied: number; children: number } | null>(null);

  async function choose(event: React.ChangeEvent<HTMLInputElement>) {
    const chosen = event.target.files?.[0];
    setPreview(null);
    setDone(null);
    setError(null);
    if (!chosen) return setFile(null);
    setBusy(true);
    try {
      const data = await toBase64(chosen);
      setFile({ name: chosen.name, data });
      setPreview(await sendJsonForData<Preview>(`${base}/import/preview`, "POST", { file: data, name: chosen.name }));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "That file could not be checked.");
    } finally {
      setBusy(false);
    }
  }

  async function apply() {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      setDone(await sendJsonForData<{ applied: number; children: number }>(`${base}/import/apply`, "POST", { file: file.data, name: file.name }));
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Nothing was imported.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-[14px]">
      <section className="rounded-[14px] border bg-white p-5" style={{ borderColor: BORDER }}>
        <p className="text-[12px] font-bold" style={{ color: INK }}>1 · Take the template</p>
        <p className="mt-1 text-[11.5px] leading-[1.6]" style={{ color: MUTED }}>It has every child on this sheet and a column for each component, with what is entered already. Fill it in Excel and save it — as .xlsx or as CSV. A blank cell leaves the score as it is; it never clears one. Type A for absent.</p>
        <a href={`${base}/template`} className="mt-3 inline-flex rounded-[10px] bg-[#0D2315] px-[14px] py-[9px] text-[12px] font-semibold text-white">Download the template</a>
      </section>

      <section className="rounded-[14px] border bg-white p-5" style={{ borderColor: BORDER }}>
        <p className="text-[12px] font-bold" style={{ color: INK }}>2 · Choose your filled-in file</p>
        <input type="file" accept=".xlsx,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={choose} disabled={busy} className="mt-3 block text-[12px]" />
        {busy && !preview ? <p className="mt-3 text-[11.5px]" style={{ color: MUTED }}>Reading the file…</p> : null}
        {error ? <p className="mt-3 text-[12px] font-semibold" style={{ color: "#B23B3B" }}>{error}</p> : null}
      </section>

      {preview ? (
        <section className="rounded-[14px] border bg-white p-5" style={{ borderColor: BORDER }}>
          <p className="text-[12px] font-bold" style={{ color: INK }}>3 · Check what will change · {preview.sheet.subject} · {preview.sheet.arm}</p>
          <p className="mt-1 text-[11.5px] leading-[1.6]" style={{ color: MUTED }}>
            {preview.matched} of {preview.sheet.roll} children matched by admission number · {preview.changeCount} cell{preview.changeCount === 1 ? "" : "s"} would change · {preview.unchanged} already the same.
            {preview.ignoredColumns.length ? ` Columns not on this sheet were ignored: ${preview.ignoredColumns.join(", ")}.` : ""}
            {preview.missingColumns.length ? ` Not in the file, so left alone: ${preview.missingColumns.join(", ")}.` : ""}
          </p>
          {preview.problemCount ? (
            <div className="mt-3 rounded-[10px] border px-3 py-2" style={{ borderColor: "#E8B4B4", background: "#FDF3F3" }}>
              <p className="text-[12px] font-semibold" style={{ color: "#B23B3B" }}>{preview.problemCount} problem{preview.problemCount === 1 ? "" : "s"} — nothing can be imported until they are fixed</p>
              <ul className="mt-1 list-disc pl-4 text-[11.5px]" style={{ color: "#6B2A2A" }}>{preview.problems.map((problem) => <li key={problem}>{problem}</li>)}</ul>
            </div>
          ) : null}
          {preview.unmatchedCount ? (
            <p className="mt-3 text-[11.5px]" style={{ color: "#8A6410" }}>{preview.unmatchedCount} row{preview.unmatchedCount === 1 ? "" : "s"} matched no child on this sheet and are left out, never guessed: {preview.unmatched.join(", ")}{preview.unmatchedCount > preview.unmatched.length ? "…" : ""}</p>
          ) : null}
          {preview.changes.length ? (
            <div className="mt-3 max-h-[320px] overflow-auto rounded-[10px] border" style={{ borderColor: BORDER }}>
              <table className="w-full text-left text-[11.5px]">
                <thead><tr style={{ color: MUTED }}><th className="px-3 py-2">Child</th><th className="px-3 py-2">Component</th><th className="px-3 py-2">Now</th><th className="px-3 py-2">Becomes</th></tr></thead>
                <tbody>
                  {preview.changes.map((change) => (
                    <tr key={`${change.studentId}-${change.column}`} className="border-t" style={{ borderColor: BORDER }}>
                      <td className="px-3 py-[6px]" style={{ color: INK }}>{change.name} <span style={{ color: MUTED }}>· {change.adm}</span></td>
                      <td className="px-3 py-[6px]">{change.column}</td>
                      <td className="px-3 py-[6px]" style={{ color: MUTED }}>{change.from}</td>
                      <td className="px-3 py-[6px] font-semibold" style={{ color: INK }}>{change.to}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
          {done ? (
            <div className="mt-4 rounded-[10px] border px-3 py-3" style={{ borderColor: "#BFE3D0", background: "#EAF6F0" }}>
              <p className="text-[12.5px] font-semibold" style={{ color: "#17714F" }}>Imported {done.applied} score{done.applied === 1 ? "" : "s"} for {done.children} child{done.children === 1 ? "" : "ren"} as a draft.</p>
              <p className="mt-1 text-[11.5px]" style={{ color: "#243B2E" }}>Nothing is submitted. Open the sheet to look it over, then preview and submit it as usual.</p>
              <Link href={back as never} className="mt-2 inline-flex rounded-[10px] bg-[#0D2315] px-[14px] py-[8px] text-[12px] font-semibold text-white">Open the sheet</Link>
            </div>
          ) : (
            <button type="button" onClick={apply} disabled={!preview.canApply || busy} className="mt-4 rounded-[10px] px-[16px] py-[9px] text-[12px] font-semibold text-white disabled:opacity-40" style={{ background: INK }}>
              {busy ? "Importing…" : `Import ${preview.changeCount} score${preview.changeCount === 1 ? "" : "s"} as a draft`}
            </button>
          )}
        </section>
      ) : null}
    </div>
  );
}
