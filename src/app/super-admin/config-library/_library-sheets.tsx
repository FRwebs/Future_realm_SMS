"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { DetailSheet } from "@/components/data-display/detail-sheet";
import { InlineNotice, useNotice } from "@/components/ui/inline-notice";
import { readCookie, readableError } from "@/lib/modules/submit";
import type { PortabilityFinding } from "@/lib/domain/types";

const BASE = "/api/super-admin/config-library";

async function request<T>(path: string, method: "GET" | "POST" = "GET"): Promise<T> {
  const response = await fetch(`${BASE}${path}`, { method, credentials: "include", headers: { "Content-Type": "application/json", "x-csrf-token": readCookie("fr_csrf") ?? "" }, ...(method === "POST" ? { body: "{}" } : {}) });
  const result = (await response.json().catch(() => ({}))) as { ok?: boolean; data?: T; error?: string };
  if (!response.ok || result.ok === false) throw new Error(readableError(result.error));
  return result.data as T;
}

const SECONDARY = "btn-secondary px-4 text-[11.5px]";

function useLoaded<T>(path: string) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  async function show() {
    setOpen(true);
    setData(null);
    setError(null);
    try {
      setData(await request<T>(path));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "That did not load.");
    }
  }
  return { data, error, open, show, close: () => setOpen(false) };
}

const date = (value: string | null | undefined) => (value ? value.slice(0, 10) : "—");

function Table({ head, rows, empty }: { head: string[]; rows: string[][]; empty: string }) {
  if (!rows.length) return <p className="rounded-[11px] border border-[var(--color-border-default)] p-4 text-[11.5px] text-[var(--color-text-muted)]">{empty}</p>;
  return (
    <div className="overflow-x-auto rounded-[11px] border border-[var(--color-border-default)] bg-white">
      <table className="w-full text-left text-[11.5px]">
        <thead>
          <tr>{head.map((cell) => <th key={cell} className="px-4 py-2 text-[10px] font-bold uppercase tracking-[0.04em] text-[var(--color-text-muted)]">{cell}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={index} className="border-t border-[#F2F7F4]">
              {row.map((cell, column) => <td key={column} className={column === 0 ? "px-4 py-2 font-semibold text-[var(--color-text-primary)]" : "px-4 py-2 text-[var(--color-text-secondary)]"}>{cell}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Every version of one template, with when each took effect and how many schools took it. */
export function VersionHistory({ id, name }: { id: string; name: string }) {
  const sheet = useLoaded<Array<{ id: string; version: string; lifecycle: string; effectiveFrom: string | null; effectiveTo: string | null; schools: number; owner: string | null }>>(`/curricula/${id}/history`);
  return (
    <>
      <button type="button" onClick={sheet.show} className={SECONDARY}>View version history</button>
      <DetailSheet open={sheet.open} onClose={sheet.close} eyebrow="Version history" title={name} subtitle="Every version is kept. A superseded version stays fully usable for classes already assigned to it.">
        {sheet.error ? <p className="text-[11.5px] text-[var(--color-danger)]">{sheet.error}</p> : null}
        {sheet.data ? (
          <Table
            head={["Version", "State", "Effective", "Schools", "Owner"]}
            rows={sheet.data.map((row) => [`v${row.version}`, row.lifecycle.charAt(0) + row.lifecycle.slice(1).toLowerCase(), `${date(row.effectiveFrom)} → ${row.effectiveTo ? date(row.effectiveTo) : "now"}`, row.schools > 0 ? String(row.schools) : "—", row.owner ?? "—"])}
            empty="No other version exists."
          />
        ) : !sheet.error ? <p className="text-[11.5px] text-[var(--color-text-muted)]">Loading…</p> : null}
      </DetailSheet>
    </>
  );
}

/** The schools that took a template or layout, by name. */
export function SchoolsUsing({ path, title, label = "See the schools using it" }: { path: string; title: string; label?: string }) {
  const sheet = useLoaded<Array<{ id: string; name: string }>>(path);
  return (
    <>
      <button type="button" onClick={sheet.show} className={SECONDARY}>{label}</button>
      <DetailSheet open={sheet.open} onClose={sheet.close} eyebrow="Schools" title={title} subtitle="Schools whose setup took a copy of it. A later version never changes a copy they already have.">
        {sheet.error ? <p className="text-[11.5px] text-[var(--color-danger)]">{sheet.error}</p> : null}
        {sheet.data ? <Table head={["School"]} rows={sheet.data.map((school) => [school.name])} empty="No school has taken it yet." /> : !sheet.error ? <p className="text-[11.5px] text-[var(--color-text-muted)]">Loading…</p> : null}
      </DetailSheet>
    </>
  );
}

type Sample = {
  name: string; status: string; sections: string[]; rules: string;
  header: { school: string; term: string; session: string } | null;
  identity: { pupil: string; class: string; admissionNumber: string; daysPresent: string } | null;
  subjects: Array<{ subject: string; ca1: number; ca2: number; exam: number; total: number; grade: string; average: number | null; position: number | null }>;
  cumulative: string | null; domains: string[] | null; comments: { teacher: string; principal: string } | null; feeBalance: string | null; signatures: boolean;
};

/** A sample card built from the layout's own rules, so a reviewer reads what a parent would hold. */
export function CardPreview({ id, name }: { id: string; name: string }) {
  const sheet = useLoaded<Sample>(`/report-card-layouts/${id}/preview`);
  const card = sheet.data;
  const showAverage = card?.subjects.some((row) => row.average !== null);
  const showPosition = card?.subjects.some((row) => row.position !== null);
  return (
    <>
      <button type="button" onClick={sheet.show} className="btn-primary px-4 text-[11.5px]">Preview with sample data</button>
      <DetailSheet open={sheet.open} onClose={sheet.close} width="620px" eyebrow="Sample card" title={name} subtitle="Built from this layout’s own rules, with sample pupils and scores — nothing here belongs to a school.">
        {sheet.error ? <p className="text-[11.5px] text-[var(--color-danger)]">{sheet.error}</p> : null}
        {card ? (
          <div className="grid gap-3 rounded-[11px] border border-[var(--color-border-default)] bg-white p-4 text-[11.5px]">
            {card.header ? <div className="border-b border-[#EDF3EF] pb-2 text-center"><p className="text-[13px] font-bold text-[var(--color-text-primary)]">{card.header.school}</p><p className="text-[var(--color-text-muted)]">{card.header.term} · {card.header.session}</p></div> : null}
            {card.identity ? <p className="text-[var(--color-text-secondary)]"><b className="text-[var(--color-text-primary)]">{card.identity.pupil}</b> · {card.identity.class} · {card.identity.admissionNumber} · present {card.identity.daysPresent} days</p> : null}
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="text-[10px] uppercase tracking-[0.04em] text-[var(--color-text-muted)]"><th className="py-1 pr-2">Subject</th><th className="px-1">CA1</th><th className="px-1">CA2</th><th className="px-1">Exam</th><th className="px-1">Total</th><th className="px-1">Grade</th>{showAverage ? <th className="px-1">Avg</th> : null}{showPosition ? <th className="px-1">Pos</th> : null}</tr>
                </thead>
                <tbody>
                  {card.subjects.map((row) => (
                    <tr key={row.subject} className="border-t border-[#F2F7F4]"><td className="py-1 pr-2 font-semibold">{row.subject}</td><td className="px-1">{row.ca1}</td><td className="px-1">{row.ca2}</td><td className="px-1">{row.exam}</td><td className="px-1 font-semibold">{row.total}</td><td className="px-1">{row.grade}</td>{showAverage ? <td className="px-1">{row.average ?? "—"}</td> : null}{showPosition ? <td className="px-1">{row.position ?? "—"}</td> : null}</tr>
                  ))}
                </tbody>
              </table>
            </div>
            {card.cumulative ? <p className="text-[var(--color-text-secondary)]">Cumulative: {card.cumulative}</p> : null}
            {card.domains ? <p className="text-[var(--color-text-secondary)]">Behaviour: {card.domains.join(" · ")}</p> : null}
            {card.comments ? <p className="text-[var(--color-text-secondary)]">Class teacher: {card.comments.teacher} · Principal: {card.comments.principal}</p> : null}
            {card.feeBalance ? <p className="text-[var(--color-text-secondary)]">Fee balance: {card.feeBalance}</p> : null}
            {card.signatures ? <p className="border-t border-[#EDF3EF] pt-2 text-[var(--color-text-muted)]">Class teacher ______________ &nbsp; Principal ______________</p> : null}
            <p className="text-[10.5px] text-[var(--color-text-muted)]">Rules: {card.rules}</p>
          </div>
        ) : !sheet.error ? <p className="text-[11.5px] text-[var(--color-text-muted)]">Building the sample…</p> : null}
      </DetailSheet>
    </>
  );
}

/** Runs the eight tests against every master still in play, then reloads so the portability table reads the results. */
export function RunPortability({ id, label = "Run the tests" }: { id?: string; label?: string }) {
  const router = useRouter();
  const notice = useNotice();
  const [busy, setBusy] = useState(false);
  async function run() {
    setBusy(true);
    notice.clear();
    try {
      const result = await request<{ passed?: boolean | number; ran?: number; results?: PortabilityFinding[] }>(id ? `/curricula/${id}/portability` : "/portability/run-all", "POST");
      notice.success("Portability tests run", id ? (result.passed ? "All eight passed." : "At least one failed — see the findings.") : `${result.ran ?? 0} masters checked, ${result.passed ?? 0} passed outright.`);
      router.refresh();
    } catch (cause) {
      notice.error("The tests did not run", cause instanceof Error ? cause.message : "Try again.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <span className="inline-flex max-w-full flex-col items-start gap-[8px]">
      <button type="button" onClick={run} disabled={busy} className={SECONDARY}>{busy ? "Running…" : label}</button>
      <InlineNotice notice={notice.notice} onDismiss={notice.clear} compact className="max-w-[420px]" />
    </span>
  );
}
