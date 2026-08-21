import type { PortalTimetableEntry } from "@/lib/domain/types";
import { cn } from "@/lib/utils/cn";

const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

const nigerianSchoolDay = [
  { kind: "lesson", label: "Period 1", time: "07:45 - 08:25" },
  { kind: "lesson", label: "Period 2", time: "08:25 - 09:05" },
  { kind: "lesson", label: "Period 3", time: "09:05 - 09:45" },
  { kind: "break", label: "Short break", time: "09:45 - 10:05" },
  { kind: "lesson", label: "Period 4", time: "10:05 - 10:45" },
  { kind: "lesson", label: "Period 5", time: "10:45 - 11:25" },
  { kind: "lesson", label: "Period 6", time: "11:25 - 12:05" },
  { kind: "break", label: "Lunch break", time: "12:05 - 12:45" },
  { kind: "lesson", label: "Period 7", time: "12:45 - 13:25" },
  { kind: "lesson", label: "Period 8", time: "13:25 - 14:05" }
];

function normalize(value: string) {
  return value.replace(/\s+/g, " ").trim().toLowerCase();
}

function subjectTone(subject: string): { background: string; color: string; borderColor: string } {
  const tones = [
    { background: "var(--color-success-dim)", color: "var(--color-success)", borderColor: "var(--color-success)" },
    { background: "var(--color-info-dim)", color: "var(--color-info)", borderColor: "var(--color-info)" },
    { background: "var(--color-warning-dim)", color: "var(--color-warning)", borderColor: "var(--color-warning)" },
    { background: "var(--color-danger-dim)", color: "var(--color-danger)", borderColor: "var(--color-danger)" },
    {
      background: "var(--color-accent-primary-dim)",
      color: "var(--color-text-accent)",
      borderColor: "var(--color-accent-primary)"
    },
    { background: "var(--color-bg-subtle)", color: "var(--color-text-secondary)", borderColor: "var(--color-border-default)" }
  ];
  const index = Array.from(subject).reduce((total, char) => total + char.charCodeAt(0), 0) % tones.length;
  return tones[index];
}

type TimetableGridProps = {
  title: string;
  description: string;
  entries: PortalTimetableEntry[];
  emptyState: string;
  compact?: boolean;
  onSelectEntry?: (entry: PortalTimetableEntry) => void;
  selectedEntryId?: string | null;
};

export function TimetableGrid({ title, description, entries, emptyState, compact = false, onSelectEntry, selectedEntryId }: TimetableGridProps) {
  const byDayTime = new Map(entries.map((entry) => [`${entry.day}:${normalize(entry.time)}`, entry]));

  return (
    <section className="surface-card overflow-hidden">
      <div className="border-b border-[var(--color-border-default)] px-5 py-4 md:px-6">
        <h2 className="text-[18px] font-bold text-[var(--color-text-primary)]">{title}</h2>
        <p className="mt-1 text-sm text-[var(--color-text-secondary)]">{description}</p>
      </div>

      {entries.length === 0 ? (
        <div className="p-6 text-sm text-[var(--color-text-secondary)]">{emptyState}</div>
      ) : (
        <div className="overflow-x-auto">
          <div className="min-w-[920px]">
            <div className="grid grid-cols-[150px_repeat(5,minmax(130px,1fr))] border-b border-[var(--color-border-default)] bg-[var(--color-bg-subtle)] text-xs font-bold uppercase tracking-[0.18em] text-[var(--color-text-muted)]">
              <div className="px-4 py-3">Time</div>
              {days.map((day) => (
                <div key={day} className="border-l border-[var(--color-border-default)] px-4 py-3">
                  {day}
                </div>
              ))}
            </div>
            {nigerianSchoolDay.map((row) =>
              row.kind === "break" ? (
                <div
                  key={row.label}
                  className="grid grid-cols-[150px_1fr] border-b border-[var(--color-border-default)]"
                  style={{ background: "var(--color-warning-dim)" }}
                >
                  <div className="px-4 py-3 text-xs font-semibold" style={{ color: "var(--color-warning)" }}>
                    {row.time}
                  </div>
                  <div
                    className="border-l px-4 py-3 text-center text-xs font-bold uppercase tracking-[0.2em]"
                    style={{ borderColor: "var(--color-warning-dim)", color: "var(--color-warning)" }}
                  >
                    {row.label}
                  </div>
                </div>
              ) : (
                <div key={row.label} className="grid grid-cols-[150px_repeat(5,minmax(130px,1fr))] border-b border-[var(--color-border-default)]">
                  <div className="bg-[var(--color-bg-subtle)] px-4 py-4">
                    <p className="text-sm font-semibold text-[var(--color-text-primary)]">{row.label}</p>
                    <p className="mt-1 text-xs text-[var(--color-text-muted)]">{row.time}</p>
                  </div>
                  {days.map((day) => {
                    const slot = byDayTime.get(`${day}:${normalize(row.time)}`);
                    return (
                      <div key={`${day}-${row.time}`} className="min-h-28 border-l border-[var(--color-border-default)] p-2">
                        {slot ? (
                          onSelectEntry ? (
                            <button
                              type="button"
                              onClick={() => onSelectEntry(slot)}
                              className={cn(
                                "h-full w-full rounded-[10px] border p-3 text-left transition hover:-translate-y-0.5 hover:shadow-md",
                                selectedEntryId === slot.id ? "ring-2 ring-[var(--color-accent-primary)]" : "",
                                compact ? "text-xs" : "text-sm",
                              )}
                              style={subjectTone(slot.subject)}
                            >
                              <p className="font-bold">{slot.subject}</p>
                              {slot.className ? <p className="mt-1 opacity-75">{slot.className}</p> : null}
                              {slot.teacherName ? <p className="mt-1 opacity-75">{slot.teacherName}</p> : null}
                              <p className="mt-2 text-xs opacity-70">{slot.venue}</p>
                            </button>
                          ) : (
                            <div
                              className={cn("h-full rounded-[10px] border p-3", compact ? "text-xs" : "text-sm")}
                              style={subjectTone(slot.subject)}
                            >
                              <p className="font-bold">{slot.subject}</p>
                              {slot.className ? <p className="mt-1 opacity-75">{slot.className}</p> : null}
                              {slot.teacherName ? <p className="mt-1 opacity-75">{slot.teacherName}</p> : null}
                              <p className="mt-2 text-xs opacity-70">{slot.venue}</p>
                            </div>
                          )
                        ) : (
                          <div className="flex h-full items-center justify-center rounded-[10px] border border-dashed border-[var(--color-border-default)] bg-[var(--color-bg-subtle)] text-xs text-[var(--color-text-muted)]">
                            Free
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )
            )}
          </div>
        </div>
      )}
    </section>
  );
}
