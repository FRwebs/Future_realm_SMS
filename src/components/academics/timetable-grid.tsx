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

function subjectTone(subject: string) {
  const tones = [
    "border-emerald-200 bg-emerald-50 text-emerald-950",
    "border-sky-200 bg-sky-50 text-sky-950",
    "border-amber-200 bg-amber-50 text-amber-950",
    "border-rose-200 bg-rose-50 text-rose-950",
    "border-violet-200 bg-violet-50 text-violet-950",
    "border-cyan-200 bg-cyan-50 text-cyan-950"
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
    <section className="overflow-hidden rounded-[2rem] border border-white/60 bg-white/90 shadow-panel">
      <div className="border-b border-ink/6 px-5 py-4 md:px-6">
        <h2 className="font-[var(--font-heading)] text-2xl font-bold text-ink">{title}</h2>
        <p className="mt-1 text-sm text-ink/62">{description}</p>
      </div>

      {entries.length === 0 ? (
        <div className="p-6 text-sm text-ink/62">{emptyState}</div>
      ) : (
        <div className="overflow-x-auto">
          <div className="min-w-[920px]">
            <div className="grid grid-cols-[150px_repeat(5,minmax(130px,1fr))] border-b border-ink/6 bg-sand/55 text-xs font-bold uppercase tracking-[0.18em] text-ink/45">
              <div className="px-4 py-3">Time</div>
              {days.map((day) => (
                <div key={day} className="border-l border-ink/6 px-4 py-3">
                  {day}
                </div>
              ))}
            </div>
            {nigerianSchoolDay.map((row) =>
              row.kind === "break" ? (
                <div key={row.label} className="grid grid-cols-[150px_1fr] border-b border-ink/6 bg-amber-50/80">
                  <div className="px-4 py-3 text-xs font-semibold text-amber-800">{row.time}</div>
                  <div className="border-l border-amber-100 px-4 py-3 text-center text-xs font-bold uppercase tracking-[0.2em] text-amber-800">
                    {row.label}
                  </div>
                </div>
              ) : (
                <div key={row.label} className="grid grid-cols-[150px_repeat(5,minmax(130px,1fr))] border-b border-ink/6">
                  <div className="bg-sand/35 px-4 py-4">
                    <p className="text-sm font-semibold text-ink">{row.label}</p>
                    <p className="mt-1 text-xs text-ink/55">{row.time}</p>
                  </div>
                  {days.map((day) => {
                    const slot = byDayTime.get(`${day}:${normalize(row.time)}`);
                    return (
                      <div key={`${day}-${row.time}`} className="min-h-28 border-l border-ink/6 p-2">
                        {slot ? (
                          onSelectEntry ? (
                            <button
                              type="button"
                              onClick={() => onSelectEntry(slot)}
                              className={cn(
                                "h-full w-full rounded-2xl border p-3 text-left transition hover:-translate-y-0.5 hover:shadow-md",
                                selectedEntryId === slot.id ? "ring-2 ring-primary-300" : "",
                                subjectTone(slot.subject),
                                compact ? "text-xs" : "text-sm",
                              )}
                            >
                              <p className="font-bold">{slot.subject}</p>
                              {slot.className ? <p className="mt-1 opacity-75">{slot.className}</p> : null}
                              {slot.teacherName ? <p className="mt-1 opacity-75">{slot.teacherName}</p> : null}
                              <p className="mt-2 text-xs opacity-70">{slot.venue}</p>
                            </button>
                          ) : (
                            <div className={cn("h-full rounded-2xl border p-3", subjectTone(slot.subject), compact ? "text-xs" : "text-sm")}>
                              <p className="font-bold">{slot.subject}</p>
                              {slot.className ? <p className="mt-1 opacity-75">{slot.className}</p> : null}
                              {slot.teacherName ? <p className="mt-1 opacity-75">{slot.teacherName}</p> : null}
                              <p className="mt-2 text-xs opacity-70">{slot.venue}</p>
                            </div>
                          )
                        ) : (
                          <div className="flex h-full items-center justify-center rounded-2xl border border-dashed border-ink/8 bg-white/45 text-xs text-ink/35">
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
