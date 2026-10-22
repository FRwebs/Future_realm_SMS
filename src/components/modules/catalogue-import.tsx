"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { sendJsonForData } from "@/lib/modules/submit";

type Preview = {
  entries: Array<{ curriculum: string; subject: string; stage: string; term: number; topics: number; replaces: boolean }>;
  entryCount: number; topicCount: number; replaceCount: number; problems: string[]; problemCount: number; canApply: boolean;
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

/** Load a curriculum's outlines from the Excel template. The preview lists every outline before anything is written. */
export function CatalogueImport({ base, templateHref, who }: { base: string; templateHref: string; who: string }) {
  const router = useRouter();
  const [file, setFile] = useState<{ name: string; data: string } | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ entries: number; topics: number } | null>(null);

  async function choose(event: React.ChangeEvent<HTMLInputElement>) {
    const chosen = event.target.files?.[0];
    setPreview(null); setDone(null); setError(null);
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
    setBusy(true); setError(null);
    try {
      setDone(await sendJsonForData<{ entries: number; topics: number }>(`${base}/import/apply`, "POST", { file: file.data, name: file.name }));
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Nothing was loaded.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="grid gap-3 rounded-[14px] border bg-white p-5" style={{ borderColor: BORDER }}>
      <div>
        <p className="text-[12px] font-bold" style={{ color: INK }}>Load a curriculum from Excel</p>
        <p className="mt-1 text-[11.5px] leading-[1.6]" style={{ color: MUTED }}>
          One row per week: curriculum, subject, stage (e.g. JSS 1), term (1–3), week, topic, sub-topics separated by semicolons. {who} An outline for a subject, stage and term that is already loaded is replaced by the file’s.
        </p>
        <a href={templateHref} className="mt-2 inline-flex rounded-[10px] border px-[12px] py-[7px] text-[11.5px] font-semibold" style={{ borderColor: "#CFDDD5", color: "#435048" }}>Download the template</a>
      </div>
      <input type="file" accept=".xlsx,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={choose} disabled={busy} className="block text-[12px]" />
      {busy && !preview ? <p className="text-[11.5px]" style={{ color: MUTED }}>Reading the file…</p> : null}
      {error ? <p className="text-[12px] font-semibold" style={{ color: "#B23B3B" }}>{error}</p> : null}
      {preview ? (
        <div>
          <p className="text-[11.5px]" style={{ color: MUTED }}>{preview.entryCount} outline{preview.entryCount === 1 ? "" : "s"} · {preview.topicCount} topics · {preview.replaceCount} would replace one already loaded.</p>
          {preview.problemCount ? (
            <div className="mt-2 rounded-[10px] border px-3 py-2" style={{ borderColor: "#E8B4B4", background: "#FDF3F3" }}>
              <p className="text-[12px] font-semibold" style={{ color: "#B23B3B" }}>{preview.problemCount} problem{preview.problemCount === 1 ? "" : "s"} — nothing can be loaded until they are fixed</p>
              <ul className="mt-1 list-disc pl-4 text-[11.5px]" style={{ color: "#6B2A2A" }}>{preview.problems.map((problem) => <li key={problem}>{problem}</li>)}</ul>
            </div>
          ) : (
            <div className="mt-2 max-h-[220px] overflow-auto rounded-[10px] border" style={{ borderColor: BORDER }}>
              <table className="w-full text-left text-[11.5px]">
                <thead><tr style={{ color: MUTED }}><th className="px-3 py-2">Curriculum</th><th className="px-3 py-2">Subject</th><th className="px-3 py-2">Stage</th><th className="px-3 py-2">Term</th><th className="px-3 py-2">Topics</th><th className="px-3 py-2" /></tr></thead>
                <tbody>
                  {preview.entries.map((entry) => (
                    <tr key={`${entry.curriculum}${entry.subject}${entry.stage}${entry.term}`} className="border-t" style={{ borderColor: BORDER }}>
                      <td className="px-3 py-[6px]">{entry.curriculum}</td><td className="px-3 py-[6px]" style={{ color: INK }}>{entry.subject}</td><td className="px-3 py-[6px]">{entry.stage}</td><td className="px-3 py-[6px]">{entry.term}</td><td className="px-3 py-[6px]">{entry.topics}</td>
                      <td className="px-3 py-[6px]" style={{ color: "#8A6410" }}>{entry.replaces ? "Replaces" : ""}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {done ? (
            <p className="mt-3 text-[12.5px] font-semibold" style={{ color: "#17714F" }}>Loaded {done.entries} outline{done.entries === 1 ? "" : "s"} · {done.topics} topics.</p>
          ) : (
            <button type="button" onClick={apply} disabled={!preview.canApply || busy} className="mt-3 rounded-[10px] px-[16px] py-[9px] text-[12px] font-semibold text-white disabled:opacity-40" style={{ background: INK }}>{busy ? "Loading…" : `Load ${preview.entryCount} outline${preview.entryCount === 1 ? "" : "s"}`}</button>
          )}
        </div>
      ) : null}
    </section>
  );
}
