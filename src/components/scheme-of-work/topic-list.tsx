import { BookOpen, CheckCircle2 } from "lucide-react";

import { AccordionGroup } from "@/components/ui/accordion";
import type { SchemeOfWorkTopicView } from "@/lib/domain/types";
import { cn } from "@/lib/utils/cn";

function chips(items?: string[], tone = "border-[var(--color-border-default)] bg-[var(--color-bg-surface)] text-[var(--color-text-muted)]") {
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
                    ? "bg-[var(--color-success)] text-white"
                    : "bg-[var(--color-accent-primary-dim)] text-[var(--color-text-accent)]",
                )}
              >
                {topic.isCovered ? <CheckCircle2 className="h-4 w-4" /> : topic.weekNumber}
              </span>
              <span className={cn("truncate", topic.isCovered && "text-[var(--color-success)]")}>
                Week {topic.weekNumber}: {topic.topic}
              </span>
            </div>
          ),
          summary: (
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-[var(--color-border-default)] bg-[var(--color-bg-subtle)] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--color-text-muted)]">
                {topic.weekType.toLowerCase()}
              </span>
              {topic.coveredDate ? (
                <span className="text-[12px] font-semibold text-[var(--color-success)]">
                  Covered on {new Date(topic.coveredDate).toLocaleDateString("en-NG")}
                  {topic.coveredByName ? ` by ${topic.coveredByName}` : ""}
                </span>
              ) : (
                <span className="text-[12px] text-[var(--color-text-muted)]">Not yet covered</span>
              )}
            </div>
          ),
          content: (
            <div className="space-y-4">
              {topic.subtopics?.length ? (
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[var(--color-text-muted)]">Subtopics</p>
                  <ul className="mt-2 grid gap-1 text-[13px] text-[var(--color-text-secondary)]">
                    {topic.subtopics.map((item) => (
                      <li key={item} className="flex items-start gap-2">
                        <span className="mt-1 text-[var(--color-text-accent)]">•</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {!readOnlyMode && topic.behaviouralObjectives ? (
                <div className="rounded-[10px] border border-[var(--color-border-default)] bg-[var(--color-accent-primary-dim)] p-4">
                  <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[var(--color-text-accent)]">Behavioural Objectives</p>
                  <p className="mt-2 whitespace-pre-line text-[13px] leading-6 text-[var(--color-text-secondary)]">{topic.behaviouralObjectives}</p>
                </div>
              ) : null}

              {topic.content && !readOnlyMode ? (
                <div className="rounded-[10px] border border-[var(--color-border-default)] bg-[var(--color-bg-subtle)] p-4">
                  <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[var(--color-text-muted)]">Content</p>
                  <p className="mt-2 whitespace-pre-line text-[13px] leading-6 text-[var(--color-text-secondary)]">{topic.content}</p>
                </div>
              ) : null}

              {chips(topic.teachingMethods, "border-[var(--color-info)] bg-[var(--color-info-dim)] text-[var(--color-info)]")}
              {chips(topic.teachingAids, "border-[var(--color-accent-primary)] bg-[var(--color-accent-primary-dim)] text-[var(--color-text-accent)]")}
              {chips(topic.referenceMaterials, "border-[var(--color-warning)] bg-[var(--color-warning-dim)] text-[var(--color-warning)]")}

              {topic.evaluation && !readOnlyMode ? (
                <div className="rounded-[10px] border border-[var(--color-warning)] bg-[var(--color-warning-dim)] p-4">
                  <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[var(--color-warning)]">Evaluation</p>
                  <p className="mt-2 text-[13px] leading-6 text-[var(--color-text-secondary)]">{topic.evaluation}</p>
                </div>
              ) : null}

              {topic.assignment ? (
                <div className="rounded-[10px] border border-[var(--color-gold)] bg-[var(--color-gold-dim)] p-4">
                  <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[var(--color-gold)]">Assignment</p>
                  <p className="mt-2 text-[13px] leading-6 text-[var(--color-text-secondary)]">{topic.assignment}</p>
                </div>
              ) : null}

              {topic.coverageNotes && !readOnlyMode ? (
                <div className="rounded-[10px] border border-[var(--color-success)] bg-[var(--color-success-dim)] p-4">
                  <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[var(--color-success)]">Coverage Notes</p>
                  <p className="mt-2 text-[13px] leading-6 text-[var(--color-text-secondary)]">{topic.coverageNotes}</p>
                </div>
              ) : null}

              {topic.resources?.length ? (
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[var(--color-text-muted)]">Resources</p>
                  <div className="mt-3 grid gap-2">
                    {topic.resources.map((resource) => (
                      <a
                        key={resource.id}
                        href={resource.url ?? resource.filePath ?? "#"}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-2 rounded-[10px] border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] px-4 py-3 text-[13px] font-semibold text-[var(--color-text-secondary)] transition hover:border-[var(--color-accent-primary)] hover:text-[var(--color-text-accent)]"
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
