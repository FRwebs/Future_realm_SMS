import { BookOpen, CheckCircle2 } from "lucide-react";

import { AccordionGroup } from "@/components/ui/accordion";
import type { SchemeOfWorkTopicView } from "@/lib/domain/types";
import { cn } from "@/lib/utils/cn";

function chips(items?: string[], tone = "border-(--color-border-default) bg-(--color-bg-surface) text-(--color-text-muted)") {
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
                    ? "bg-(--color-success) text-white"
                    : "bg-(--color-accent-primary-dim) text-(--color-text-accent)",
                )}
              >
                {topic.isCovered ? <CheckCircle2 className="h-4 w-4" /> : topic.weekNumber}
              </span>
              <span className={cn("truncate", topic.isCovered && "text-(--color-success)")}>
                Week {topic.weekNumber}: {topic.topic}
              </span>
            </div>
          ),
          summary: (
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-(--color-border-default) bg-(--color-bg-subtle) px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-(--color-text-muted)">
                {topic.weekType.toLowerCase()}
              </span>
              {topic.coveredDate ? (
                <span className="text-[12px] font-semibold text-(--color-success)">
                  Covered on {new Date(topic.coveredDate).toLocaleDateString("en-NG")}
                  {topic.coveredByName ? ` by ${topic.coveredByName}` : ""}
                </span>
              ) : (
                <span className="text-[12px] text-(--color-text-muted)">Not yet covered</span>
              )}
            </div>
          ),
          content: (
            <div className="space-y-4">
              {topic.subtopics?.length ? (
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-(--color-text-muted)">Subtopics</p>
                  <ul className="mt-2 grid gap-1 text-[13px] text-(--color-text-secondary)">
                    {topic.subtopics.map((item) => (
                      <li key={item} className="flex items-start gap-2">
                        <span className="mt-1 text-(--color-text-accent)">•</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {!readOnlyMode && topic.behaviouralObjectives ? (
                <div className="rounded-[10px] border border-(--color-border-default) bg-(--color-accent-primary-dim) p-4">
                  <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-(--color-text-accent)">Behavioural Objectives</p>
                  <p className="mt-2 whitespace-pre-line text-[13px] leading-6 text-(--color-text-secondary)">{topic.behaviouralObjectives}</p>
                </div>
              ) : null}

              {topic.content && !readOnlyMode ? (
                <div className="rounded-[10px] border border-(--color-border-default) bg-(--color-bg-subtle) p-4">
                  <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-(--color-text-muted)">Content</p>
                  <p className="mt-2 whitespace-pre-line text-[13px] leading-6 text-(--color-text-secondary)">{topic.content}</p>
                </div>
              ) : null}

              {chips(topic.teachingMethods, "border-(--color-info) bg-(--color-info-dim) text-(--color-info)")}
              {chips(topic.teachingAids, "border-(--color-accent-primary) bg-(--color-accent-primary-dim) text-(--color-text-accent)")}
              {chips(topic.referenceMaterials, "border-(--color-warning) bg-(--color-warning-dim) text-(--color-warning)")}

              {topic.evaluation && !readOnlyMode ? (
                <div className="rounded-[10px] border border-(--color-warning) bg-(--color-warning-dim) p-4">
                  <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-(--color-warning)">Evaluation</p>
                  <p className="mt-2 text-[13px] leading-6 text-(--color-text-secondary)">{topic.evaluation}</p>
                </div>
              ) : null}

              {topic.assignment ? (
                <div className="rounded-[10px] border border-(--color-gold) bg-(--color-gold-dim) p-4">
                  <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-(--color-gold)">Assignment</p>
                  <p className="mt-2 text-[13px] leading-6 text-(--color-text-secondary)">{topic.assignment}</p>
                </div>
              ) : null}

              {topic.coverageNotes && !readOnlyMode ? (
                <div className="rounded-[10px] border border-(--color-success) bg-(--color-success-dim) p-4">
                  <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-(--color-success)">Coverage Notes</p>
                  <p className="mt-2 text-[13px] leading-6 text-(--color-text-secondary)">{topic.coverageNotes}</p>
                </div>
              ) : null}

              {topic.resources?.length ? (
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-(--color-text-muted)">Resources</p>
                  <div className="mt-3 grid gap-2">
                    {topic.resources.map((resource) => (
                      <a
                        key={resource.id}
                        href={resource.url ?? resource.filePath ?? "#"}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-2 rounded-[10px] border border-(--color-border-default) bg-(--color-bg-surface) px-4 py-3 text-[13px] font-semibold text-(--color-text-secondary) transition hover:border-(--color-accent-primary) hover:text-(--color-text-accent)"
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
