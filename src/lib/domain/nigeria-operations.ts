export type StaffAttendanceStatus = "PRESENT" | "ABSENT" | "LATE" | "EXCUSED" | "ON_LEAVE" | "OFFICIAL_DUTY";
export type CurriculumProgressStatus = "NOT_STARTED" | "IN_PROGRESS" | "TAUGHT" | "COMPLETED";
export type TrainingParticipantStatus = "INVITED" | "ATTENDED" | "ABSENT" | "COMPLETED" | "OVERDUE";

export function normalizeSchoolDay(date = new Date()) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

export function minutesFromTime(value: string) {
  const [hours = "0", minutes = "0"] = value.split(":");
  return Number(hours) * 60 + Number(minutes);
}

export function resolveClockInStatus(params: {
  clockInAt: Date;
  resumptionTime: string;
  graceMinutes: number;
}): StaffAttendanceStatus {
  const clockMinutes = params.clockInAt.getHours() * 60 + params.clockInAt.getMinutes();
  const latestOnTime = minutesFromTime(params.resumptionTime) + params.graceMinutes;
  return clockMinutes <= latestOnTime ? "PRESENT" : "LATE";
}

export function calculateTotalMinutes(checkInAt?: Date | null, checkOutAt?: Date | null) {
  if (!checkInAt || !checkOutAt) return undefined;
  if (checkOutAt.getTime() < checkInAt.getTime()) return undefined;
  return Math.round((checkOutAt.getTime() - checkInAt.getTime()) / 60000);
}

export function calculateCurriculumCompletion(topics: Array<{ progressStatus: CurriculumProgressStatus }>) {
  if (topics.length === 0) return 0;
  const completed = topics.filter((topic) => topic.progressStatus === "COMPLETED" || topic.progressStatus === "TAUGHT").length;
  return Number(((completed / topics.length) * 100).toFixed(1));
}

export function calculateTrainingCompliance(participants: Array<{ status: TrainingParticipantStatus; mandatory?: boolean }>) {
  const mandatory = participants.filter((participant) => participant.mandatory !== false);
  if (mandatory.length === 0) return 100;
  const completed = mandatory.filter((participant) => participant.status === "COMPLETED").length;
  return Number(((completed / mandatory.length) * 100).toFixed(1));
}
