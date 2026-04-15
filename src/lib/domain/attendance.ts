export function getAttendanceRate(records: Array<{ status: string }>) {
  if (!records.length) return 0;
  const presentish = records.filter((record) => ["PRESENT", "LATE", "EXCUSED"].includes(record.status)).length;
  return Number(((presentish / records.length) * 100).toFixed(1));
}

export function summarizeAttendance(records: Array<{ date: string; status: string }>) {
  return records.reduce<Record<string, { present: number; absent: number }>>((accumulator, record) => {
    const key = record.date;
    if (!accumulator[key]) {
      accumulator[key] = { present: 0, absent: 0 };
    }
    if (record.status === "ABSENT") {
      accumulator[key].absent += 1;
    } else {
      accumulator[key].present += 1;
    }
    return accumulator;
  }, {});
}
