import { BookOpen, CheckCircle2 } from "lucide-react";

import { AccordionGroup } from "@/components/ui/accordion";
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
    <AccordionGroup
      items={topics.map((topic) => {
        const readOnlyMode = mode !== "staff";

        return {
          id: topic.id,
          title: (
            <div className="flex min-w-0 items-center gap-3">
              <span
                className={cn(
                  "inline-flex h-8 min-w-8 items-center justify-center rounded-2xl px-2 text-xs font-black",
                  topic.isCovered
                    ? "bg-emerald-600 text-white"
                    : "bg-primary-100 text-primary-800",
                )}
              >
                {topic.isCovered ? <CheckCircle2 className="h-4 w-4" /> : topic.weekNumber}
              </span>
              <span className={cn("truncate", topic.isCovered && "text-emerald-900")}>
                Week {topic.weekNumber}: {topic.topic}
              </span>
            </div>
          ),
          summary: (
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">
                {topic.weekType.toLowerCase()}
              </span>
              {topic.coveredDate ? (
                <span className="text-[12px] font-semibold text-emerald-700">
                  Covered on {new Date(topic.coveredDate).toLocaleDateString("en-NG")}
                  {topic.coveredByName ? ` by ${topic.coveredByName}` : ""}
                </span>
              ) : (
                <span className="text-[12px] text-slate-500">Not yet covered</span>
              )}
            </div>
          ),
          content: (
            <div className="space-y-4">
              {topic.subtopics?.length ? (
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-500">Subtopics</p>
                  <ul className="mt-2 grid gap-1 text-[13px] text-slate-600">
                    {topic.subtopics.map((item) => (
                      <li key={item} className="flex items-start gap-2">
                        <span className="mt-1 text-primary-700">•</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {!readOnlyMode && topic.behaviouralObjectives ? (
                <div className="rounded-2xl border border-primary-100 bg-primary-50/70 p-4">
                  <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-primary-700">Behavioural Objectives</p>
                  <p className="mt-2 whitespace-pre-line text-[13px] leading-6 text-slate-700">{topic.behaviouralObjectives}</p>
                </div>
              ) : null}

              {topic.content && !readOnlyMode ? (
                <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                  <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-500">Content</p>
                  <p className="mt-2 whitespace-pre-line text-[13px] leading-6 text-slate-700">{topic.content}</p>
                </div>
              ) : null}

              {chips(topic.teachingMethods, "border-cyan-200 bg-cyan-50 text-cyan-800")}
              {chips(topic.teachingAids, "border-violet-200 bg-violet-50 text-violet-800")}
              {chips(topic.referenceMaterials, "border-amber-200 bg-amber-50 text-amber-900")}

              {topic.evaluation && !readOnlyMode ? (
                <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-4">
                  <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-amber-700">Evaluation</p>
                  <p className="mt-2 text-[13px] leading-6 text-slate-700">{topic.evaluation}</p>
                </div>
              ) : null}

              {topic.assignment ? (
                <div className="rounded-2xl border border-orange-200 bg-orange-50/80 p-4">
                  <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-orange-700">Assignment</p>
                  <p className="mt-2 text-[13px] leading-6 text-slate-700">{topic.assignment}</p>
                </div>
              ) : null}

              {topic.coverageNotes && !readOnlyMode ? (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                  <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-emerald-700">Coverage Notes</p>
                  <p className="mt-2 text-[13px] leading-6 text-slate-700">{topic.coverageNotes}</p>
                </div>
              ) : null}

              {topic.resources?.length ? (
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-500">Resources</p>
                  <div className="mt-3 grid gap-2">
                    {topic.resources.map((resource) => (
                      <a
                        key={resource.id}
                        href={resource.url ?? resource.filePath ?? "#"}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-[13px] font-semibold text-slate-700 transition hover:border-primary-200 hover:text-primary-700"
                      >
                        <BookOpen className="h-4 w-4" />
                        {resource.title}
                      </a>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          ),
        };
      })}
      defaultOpenId={topics[0]?.id}
    />
  );
}
