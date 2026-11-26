import { apiGet, observe } from "@/lib/api/server";
import { localContracts } from "@/lib/api/local-contracts.zod";
import { formatDay } from "@/lib/date-format";
import { row } from "@/lib/modules/panels";
import type { DrawerSpec, ListItem, PanelFact, PanelTone } from "@/lib/modules/panels";
import { SW } from "@/lib/api/student-workspace";
import { loadMe } from "@/lib/modules/live/student/shared";
import type { StudentContent } from "@/lib/modules/live/student/shared";

type Device = { id: string; device: string; where: string; lastActiveAt: string; startedAt: string; current: boolean };

const when = (iso: string) => formatDay(new Date(iso), { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Africa/Lagos" });

/**
 * What this phone is showing, and what it can do without a connection.
 *
 * The mockup imagines a student's hand-in sitting in a queue on the phone until the network comes back, timestamped at the moment
 * they pressed send. This portal does not do that: a hand-in needs a connection and says so if it cannot reach the school, and
 * nothing is held back to send later. So the page says what is true — when this page was read, which devices are signed in, and
 * which of these things need a connection — rather than drawing a queue that would always be empty.
 */
export async function syncPage(): Promise<StudentContent> {
  const [me, devices] = await Promise.all([
    loadMe(),
    apiGet(`${SW}/sessions`, observe<Device[]>(localContracts["src/lib/modules/live/student/sync.ts#49e83e8a"])).catch(() => [] as Device[]),
  ]);
  const here = devices.find((device) => device.current) ?? null;

  const standing: PanelFact[] = [
    ["What you are looking at", `Read from ${me.school} at ${me.now}`, "Every page asks the school when it opens, so it is as current as that time", "positive"],
    ["Waiting to send", "Nothing", "A hand-in or a question goes the moment you send it", "positive"],
    ["This phone", here ? here.device : "Not recognised", here ? `Signed in since ${when(here.startedAt)}` : "Sign in again if this looks wrong"],
    ["Times", "West Africa Time (GMT+1)", "Your school’s times, as the school writes them"],
  ];

  // The mockup's own list, answered honestly: what this portal can and cannot do without a connection.
  const works: PanelFact[] = [
    ["Reading a page you already opened", "Works offline", "Your phone shows the copy it last loaded"],
    ["Today, your timetable and your marks", "Needs a connection", "Each page is read from the school as it opens"],
    ["Handing in work", "Needs a connection", "It is not kept to send later — try again when you are back online"],
    ["Asking a teacher", "Needs a connection", "The same: nothing is queued on this phone"],
    ["Changing your password", "Needs a connection"],
  ];

  const sign = (device: Device): DrawerSpec => ({
    mode: "commit", tone: "attention" as PanelTone, kicker: "Sync and this phone", title: "Sign out of this device?",
    sub: `${device.device} is signed out straight away and will need your password to sign in again.`,
    commitLabel: "Sign out", commitDone: "Signed out", commitDoneBody: `${device.device} is no longer signed in.`,
    submit: { endpoint: `${SW}/sessions/${device.id}/revoke`, method: "POST" },
  });

  const items: ListItem[] = devices.map((device) => ({
    label: device.device,
    sub: `${device.where || "Place not known"} · last used ${when(device.lastActiveAt)}`,
    ...(device.current ? { pill: "This phone", tone: "positive" as PanelTone } : { viewLabel: "Sign out", drawer: sign(device) }),
  }));

  return {
    eyebrow: "This phone", title: "Sync and this phone", desc: "What this phone is showing, and what needs a connection.",
    phoneEyebrow: "This phone", phoneTitle: "Up to date", phoneDesc: `Read from ${me.school} at ${me.now}.`,
    rows: [
      row("1fr", [{ type: "facts", title: "Up to date", sub: `Read at ${me.now}.`, per: 2, facts: standing }]),
      row("1fr", [{ type: "facts", title: "What works with no connection", sub: "This portal reads from your school as each page opens.", per: 1, facts: works }]),
      row("1fr", [{ type: "note", tone: "neutral", title: "Nothing waits on this phone", body: "If you press send with no connection, the page tells you it could not send and keeps what you wrote on screen. Send it again when you are back online — it is not lost, and it is not quietly sitting in a queue either." }]),
      row("1fr", [{ type: "list", title: "Signed in on", sub: "Sign out anything you do not recognise.", items, empty: "No other device is signed in." }]),
    ],
  };
}
