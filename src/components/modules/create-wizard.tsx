"use client";

import Link from "next/link";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { Field, fieldVisible, initialValue } from "@/components/modules/field";
import { buildBody, CommitDone, ConfirmSheet, describe, withSeeds, type CommitResult } from "@/components/modules/module-drawer";
import type { DrawerSpec, FormField } from "@/lib/modules/panels";
import { sendJsonForData } from "@/lib/modules/submit";
import { INK, MUTED } from "@/lib/modules/tones";

const CARD = "min-w-0 overflow-hidden rounded-[14px] border bg-white";
const BORDER = { borderColor: "#DEE8E2" };
const primaryButton = "whitespace-nowrap rounded-[9px] px-[17px] py-[10px] text-[11.5px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50";
const quietButton = "whitespace-nowrap rounded-[9px] border bg-white px-[15px] py-[9px] text-[11.5px] font-semibold";

/**
 * A staged form taken as a page, as the mockup takes enrolling a student and onboarding a member of
 * staff: the stages named across the top and walked in order, what has been entered so far kept in view,
 * and every stage read back — each with a way to go and change it — before anything is written.
 */
export function CreateWizard({ spec }: { spec: DrawerSpec }) {
  const router = useRouter();
  const page = spec.page;
  const steps = useMemo(() => spec.steps ?? [], [spec]);
  const allFields = useMemo(() => steps.flatMap((step) => step.fields), [steps]);
  const [values, setValues] = useState<Record<string, unknown>>(() => Object.fromEntries(allFields.map((field) => [field.label, initialValue(field)])));
  const [index, setIndex] = useState(0);
  const [missing, setMissing] = useState<string[]>([]);
  const [confirm, setConfirm] = useState<"save" | "leave" | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<CommitResult | null | false>(false);

  const last = index === steps.length - 1;
  const step = steps[index];
  const visible = (fields: FormField[]) => fields.filter((field) => fieldVisible(field, values));
  const unanswered = (fields: FormField[]) =>
    visible(fields).filter((field) => {
      if (!field.required) return false;
      const value = values[field.label];
      if (Array.isArray(value)) return value.length === 0;
      return value === undefined || value === null || String(value).trim() === "";
    });
  const dirty = allFields.some((field) => describe(field, values[field.label]) !== describe(field, initialValue(field)));
  const reviewing = step?.title === "Review";

  const readBack = (fields: FormField[]) => visible(fields).filter((field) => field.kind !== "static").map((field): [string, string] => [field.label, describe(field, values[field.label]) || "—"]);

  function advance() {
    const gaps = unanswered(step.fields);
    if (gaps.length) {
      setMissing(gaps.map((field) => field.label));
      return;
    }
    setMissing([]);
    if (last) setConfirm("save");
    else setIndex(index + 1);
  }

  function leave() {
    if (dirty) setConfirm("leave");
    else router.push((page?.back.href ?? "/") as Route);
  }

  async function commit() {
    if (!spec.submit) return;
    setConfirm(null);
    setPending(true);
    setError(null);
    try {
      const answer = await sendJsonForData<CommitResult>(spec.submit.endpoint, spec.submit.method ?? "POST", buildBody(spec.submit, allFields, values, ""));
      setDone(answer && typeof answer === "object" ? answer : null);
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "That did not go through.");
    } finally {
      setPending(false);
    }
  }

  if (done !== false) {
    return (
      <section className={`${CARD} mx-auto w-full max-w-[840px] p-[20px]`} style={BORDER}>
        <div className="grid gap-[14px]">
          <CommitDone spec={spec} result={done} doneTitle={spec.commitDone ?? "Done"} doneBody={spec.commitDoneBody} doneLines={readBack(allFields).filter(([, value]) => value !== "—").slice(0, 4)} />
          <div className="flex flex-wrap justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setValues(Object.fromEntries(allFields.map((field) => [field.label, initialValue(field)])));
                setIndex(0);
                setDone(false);
              }}
              className={quietButton}
              style={{ borderColor: "#CFDDD5", color: "#435048" }}
            >
              Start another
            </button>
            <Link href={(page?.back.href ?? "/") as Route} className={primaryButton} style={{ background: INK }}>
              {page?.back.label ?? "Back"}
            </Link>
          </div>
        </div>
      </section>
    );
  }

  return (
    <div className="mx-auto grid w-full max-w-[840px] gap-[14px]">
      {/* the stages, named, in the order they are walked */}
      <nav aria-label="Stages" className="flex flex-wrap items-center gap-[8px] rounded-[14px] px-[12px] py-[10px]" style={{ background: INK }}>
        {steps.map((entry, i) => {
          const state = i < index ? "done" : i === index ? "now" : "next";
          const pill = (
            <>
              <span
                className="flex h-[17px] w-[17px] flex-none items-center justify-center rounded-full text-[9px] font-extrabold"
                style={{ background: state === "done" ? "#fff" : state === "now" ? "#12796A" : "rgba(255,255,255,0.12)", color: state === "done" ? INK : "#fff" }}
              >
                {state === "done" ? "✓" : i + 1}
              </span>
              {entry.title}
            </>
          );
          const style = { color: state === "next" ? "rgba(255,255,255,0.5)" : "#fff", background: state === "now" ? "rgba(255,255,255,0.14)" : "transparent", border: `1px solid ${state === "now" ? "rgba(255,255,255,0.2)" : "transparent"}` };
          const className = "inline-flex items-center gap-[7px] whitespace-nowrap rounded-full py-[5px] pl-[6px] pr-[12px] text-[11px] font-semibold";
          return state === "done" ? (
            <button key={entry.title} type="button" onClick={() => setIndex(i)} className={className} style={style}>
              {pill}
            </button>
          ) : (
            <span key={entry.title} aria-current={state === "now" ? "step" : undefined} className={className} style={style}>
              {pill}
            </span>
          );
        })}
      </nav>

      {error ? (
        <div className="rounded-[12px] border px-[13px] py-[11px]" style={{ background: "#FDF2F2", borderColor: "#F3D2D2" }}>
          <p className="text-[11.5px] font-semibold leading-[1.5]" style={{ color: "#A32B2B" }}>{error}</p>
        </div>
      ) : null}

      {/* the review reads every earlier stage back, each with a way to change it */}
      {reviewing
        ? steps.slice(0, -1).map((entry, i) => (
            <section key={entry.title} className={CARD} style={BORDER}>
              <header className="flex items-center justify-between gap-3 px-[18px] pt-[14px]">
                <h3 className="text-[12.5px] font-semibold" style={{ color: INK }}>{entry.title}</h3>
                <button type="button" onClick={() => setIndex(i)} className="rounded-[8px] border bg-white px-[10px] py-[5px] text-[10.5px] font-semibold" style={{ borderColor: "#CFDDD5", color: "#435048" }}>
                  Edit this step
                </button>
              </header>
              <dl className="grid gap-x-[16px] gap-y-[10px] px-[18px] pb-[16px] pt-[10px] sm:grid-cols-2">
                {readBack(entry.fields).map(([label, value]) => (
                  <div key={label} className="min-w-0">
                    <dt className="text-[9.5px] font-bold uppercase tracking-[0.06em]" style={{ color: MUTED }}>{label}</dt>
                    <dd className="mt-[3px] text-pretty text-[12px] font-semibold leading-[1.45]" style={{ color: INK }}>{value}</dd>
                  </div>
                ))}
              </dl>
            </section>
          ))
        : null}

      <section className={CARD} style={BORDER}>
        <header className="px-[18px] pt-[15px]">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="text-[13px] font-semibold" style={{ color: INK }}>{reviewing ? "Check this, then create the record" : step.title}</h3>
            <span className="text-[10.5px] font-semibold tabular-nums" style={{ color: MUTED }}>Step {index + 1} of {steps.length}</span>
          </div>
          {step.hint ? <p className="mt-[3px] text-[11px] leading-[1.5]" style={{ color: MUTED }}>{reviewing ? (page?.reviewDesc ?? step.hint) : step.hint}</p> : null}
        </header>
        <div className="grid items-start gap-x-[16px] gap-y-[14px] px-[18px] py-[16px] sm:grid-cols-2">
          {visible(step.fields).map((field) => (
            <div key={field.label} className={field.span === 2 ? "sm:col-span-2" : undefined}>
              <Field field={field} value={values[field.label]} values={values} setValue={(next) => setValues((current) => withSeeds(allFields, current, field, next))} />
              {missing.includes(field.label) ? <p className="mt-[4px] text-[10.5px] font-semibold" style={{ color: "#B23B3B" }}>This is required before you can go on.</p> : null}
            </div>
          ))}
        </div>
        <footer className="flex flex-wrap items-center justify-between gap-x-[14px] gap-y-[10px] px-[18px] py-[13px]" style={{ background: "#FBFDFC", borderTop: "1px solid #EDF3EF" }}>
          <p className="min-w-[160px] flex-1 text-[10.5px] leading-[1.45]" style={{ color: missing.length ? "#B23B3B" : MUTED, fontWeight: missing.length ? 600 : 400 }}>
            {missing.length === 1 ? "One required answer is still missing on this step — it is marked above." : missing.length ? `${missing.length} required answers are still missing on this step — each one is marked above.` : last ? (page?.footNote ?? "Nothing is written until you confirm.") : "Nothing is written until the last step."}
          </p>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <button type="button" onClick={index === 0 ? leave : () => { setMissing([]); setIndex(index - 1); }} className={quietButton} style={{ borderColor: "#CFDDD5", color: "#435048" }}>
              {index === 0 ? "Cancel" : "Back"}
            </button>
            <button type="button" onClick={advance} disabled={pending} className={primaryButton} style={{ background: INK, boxShadow: "0 7px 16px -9px rgba(13,35,21,0.6)" }}>
              {pending ? "Sending…" : last ? (spec.commitLabel ?? "Create") : "Continue"}
            </button>
          </div>
        </footer>
      </section>

      {/* before the review, what has been entered so far; on it, nothing — the stages above say it all */}
      {!reviewing ? (
        <section className={`${CARD} px-[18px] py-[14px]`} style={BORDER}>
          {index > 0 ? (
            <>
              <h3 className="text-[12.5px] font-semibold" style={{ color: INK }}>Entered so far</h3>
              <p className="mt-[2px] text-[10.5px]" style={{ color: MUTED }}>Go back to any step to change it.</p>
              <dl className="mt-[10px] grid gap-x-[16px] gap-y-[9px] sm:grid-cols-2">
                {readBack(steps.slice(0, index).flatMap((entry) => entry.fields)).filter(([, value]) => value !== "—").map(([label, value]) => (
                  <div key={label} className="min-w-0">
                    <dt className="text-[9.5px] font-bold uppercase tracking-[0.06em]" style={{ color: MUTED }}>{label}</dt>
                    <dd className="mt-[2px] text-pretty text-[11.5px] font-semibold leading-[1.4]" style={{ color: INK }}>{value}</dd>
                  </div>
                ))}
              </dl>
            </>
          ) : page ? (
            <>
              <h3 className="text-[12.5px] font-semibold" style={{ color: INK }}>{page.railTitle}</h3>
              <dl className="mt-[10px] grid gap-x-[16px] gap-y-[10px] sm:grid-cols-3">
                {page.rail.map(([title, body]) => (
                  <div key={title} className="min-w-0">
                    <dt className="text-[9.5px] font-bold uppercase tracking-[0.06em]" style={{ color: MUTED }}>{title}</dt>
                    <dd className="mt-[3px] text-pretty text-[11.5px] font-semibold leading-[1.45]" style={{ color: INK }}>{body}</dd>
                  </div>
                ))}
              </dl>
            </>
          ) : null}
        </section>
      ) : null}

      {confirm ? (
        <div className="fixed inset-0 z-[42]">
          <ConfirmSheet
            title={confirm === "leave" ? "Leave without creating?" : `${spec.commitLabel ?? "Create"}?`}
            body={confirm === "leave" ? "What you have entered here will not be kept." : (page?.confirmBody ?? "Nothing is written until you confirm.")}
            ok={confirm === "leave" ? "Leave" : (spec.commitLabel ?? "Create")}
            cancel={confirm === "leave" ? "Stay here" : "Go back"}
            tone={confirm === "leave" ? "attention" : "progress"}
            pending={pending}
            onCancel={() => setConfirm(null)}
            onConfirm={confirm === "leave" ? () => router.push((page?.back.href ?? "/") as Route) : commit}
          />
        </div>
      ) : null}
    </div>
  );
}
