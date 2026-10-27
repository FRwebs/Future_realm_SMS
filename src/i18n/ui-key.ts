/** `Class & Timetable` → `class_timetable`: the key a label is filed under in the `ui` messages. */
export const uiKey = (text: string) => text.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
