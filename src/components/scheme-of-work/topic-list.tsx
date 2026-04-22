import { BookOpen, CheckCircle2 } from "lucide-react";

import type { SchemeOfWorkTopicView } from "@/lib/domain/types";
import { cn } from "@/lib/utils/cn";

function chips(items?: string[], tone = "border-ink/10 bg-white text-ink/65") {
  if (!items?.length) return null;
  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {items.map((item) => (
        <span key={item} className={cn("rounded-full border px-2.5 py-1 text-[0.7rem] font-semibold", tone)}>
          {item}
        </span>
      ))}
    </div>
  );
}

export function SchemeOfWorkTopicList({
  topics,
  mode = "staff",
}: {
  topics: SchemeOfWorkTopicView[];
  mode?: "staff" | "student" | "parent";
}) {
  return (
    <div className="grid gap-3">
      {topics.map((topic) => {
        const readOnlyMode = mode !== "staff";
        return (
          <article
            key={topic.id}
            className={cn(
              "rounded-[1.5rem] border p-5 shadow-[0_14px_36px_rgba(18,33,23,0.05)]",
              topic.isCovered ? "border-emerald-200 bg-emerald-50/60" : "border-white/70 bg-white/90"
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={cn(
                      "inline-flex h-8 min-w-8 items-center justify-center rounded-2xl px-2 text-xs font-black",
                      topic.isCovered ? "bg-emerald-600 text-white" : "bg-brand-100 text-brand-900"
                    )}
                  >
                    {topic.isCovered ? <CheckCircle2 className="h-4 w-4" /> : topic.weekNumber}
                  </span>
                  <span className="rounded-full border border-ink/10 bg-sand/55 px-2.5 py-1 text-[0.68rem] font-bold uppercase tracking-[0.18em] text-ink/55">
                    {topic.weekType.toLowerCase()}
                  </span>
                </div>
                <h3 className={cn("mt-3 text-lg font-bold text-ink", topic.isCovered && "text-emerald-900")}>
                  Week {topic.weekNumber}: {topic.topic}
                </h3>
                {topic.coveredDate ? (
                  <p className="mt-2 text-xs font-semibold text-emerald-700">
                    Covered on {new Date(topic.coveredDate).toLocaleDateString("en-NG")}
                    {topic.coveredByName ? ` by ${topic.coveredByName}` : ""}
                  </p>
                ) : null}
              </div>
            </div>

            {topic.subtopics?.length ? (
              <div className="mt-4">
                <p className="text-[0.72rem] font-bold uppercase tracking-[0.2em] text-ink/45">Subtopics</p>
                <ul className="mt-2 grid gap-1 text-sm text-ink/72">
                  {topic.subtopics.map((item) => (
                    <li key={item} className="flex items-start gap-2">
                      <span className="mt-1 text-brand-700">•</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {!readOnlyMode && topic.behaviouralObjectives ? (
              <div className="mt-4 rounded-2xl border border-brand-100 bg-brand-50/70 p-4">
                <p className="text-[0.72rem] font-bold uppercase tracking-[0.2em] text-brand-700">Behavioural Objectives</p>
                <p className="mt-2 whitespace-pre-line text-sm leading-6 text-ink/75">{topic.behaviouralObjectives}</p>
              </div>
            ) : null}

            {topic.content && !readOnlyMode ? (
              <div className="mt-4 rounded-2xl border border-ink/8 bg-sand/45 p-4">
                <p className="text-[0.72rem] font-bold uppercase tracking-[0.2em] text-ink/45">Content</p>
                <p className="mt-2 whitespace-pre-line text-sm leading-6 text-ink/75">{topic.content}</p>
              </div>
            ) : null}

            {chips(topic.teachingMethods, "border-cyan-200 bg-cyan-50 text-cyan-800")}
            {chips(topic.teachingAids, "border-violet-200 bg-violet-50 text-violet-800")}
            {chips(topic.referenceMaterials, "border-amber-200 bg-amber-50 text-amber-900")}

            {topic.evaluation && !readOnlyMode ? (
              <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50/70 p-4">
                <p className="text-[0.72rem] font-bold uppercase tracking-[0.2em] text-amber-700">Evaluation</p>
                <p className="mt-2 text-sm leading-6 text-ink/75">{topic.evaluation}</p>
              </div>
            ) : null}

            {topic.assignment ? (
              <div className="mt-4 rounded-2xl border border-orange-200 bg-orange-50/80 p-4">
                <p className="text-[0.72rem] font-bold uppercase tracking-[0.2em] text-orange-700">Assignment</p>
                <p className="mt-2 text-sm leading-6 text-ink/75">{topic.assignment}</p>
              </div>
            ) : null}

            {topic.coverageNotes && !readOnlyMode ? (
              <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                <p className="text-[0.72rem] font-bold uppercase tracking-[0.2em] text-emerald-700">Coverage Notes</p>
                <p className="mt-2 text-sm leading-6 text-ink/75">{topic.coverageNotes}</p>
              </div>
            ) : null}

            {topic.resources?.length ? (
              <div className="mt-4">
                <p className="text-[0.72rem] font-bold uppercase tracking-[0.2em] text-ink/45">Resources</p>
                <div className="mt-3 grid gap-2">
                  {topic.resources.map((resource) => (
                    <a
                      key={resource.id}
                      href={resource.url ?? resource.filePath ?? "#"}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-2 rounded-2xl border border-ink/10 bg-white px-4 py-3 text-sm font-semibold text-ink/72 transition hover:border-brand-200 hover:text-brand-800"
                    >
                      <BookOpen className="h-4 w-4" />
                      {resource.title}
                    </a>
                  ))}
                </div>
              </div>
            ) : null}
          </article>
        );
      })}
    </div>
  );
}
