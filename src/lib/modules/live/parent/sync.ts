import { apiGet, observe } from "@/lib/api/server";
import { localContracts } from "@/lib/api/local-contracts.zod";
import { formatDay } from "@/lib/date-format";
import { row } from "@/lib/modules/panels";
import type { DrawerSpec, ListItem, PanelFact, PanelTone } from "@/lib/modules/panels";
import { PW, loadMe } from "@/lib/modules/live/parent/shared";
import type { ParentContent } from "@/lib/modules/live/parent/shared";

type Device = { id: string; device: string; where: string; lastActiveAt: string; startedAt: string; current: boolean };
const when = (iso: string) => formatDay(new Date(iso), { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Africa/Lagos" });

/**
 * What the portal keeps on this phone, said as it is.
 *
 * The portal reads from the school each time a page opens and sends the moment you press send. It does not hold a queue of things to
 * send later, so this page does not pretend to one: it says when what you are looking at was read, which devices are signed in, and
 * that a send needs a connection.
 */
export async function syncPage(): Promise<ParentContent> {
  const [me, devices] = await Promise.all([loadMe(), apiGet(`${PW}/sessions`, observe<Device[]>(localContracts["src/lib/modules/live/parent/sync.ts#49e83e8a"])).catch(() => [] as Device[])]);
  const here = devices.find((device) => device.current) ?? null;
  const facts: PanelFact[] = [
    ["What you are looking at", `Read from ${me.school} at ${me.now}`, "Every page asks the school when it opens, so it is as current as that time", "positive"],
    ["Waiting to send", "Nothing", "A request, an answer or a payment goes the moment you send it", "positive"],
    ["This phone", here ? here.device : "Not recognised", here ? `Signed in since ${when(here.startedAt)}` : "Sign in again if this looks wrong"],
    ["Times", "West Africa Time (GMT+1)", "The school’s times, as the school writes them"],
  ];
  // The mockup's own list, answered honestly: this portal reads each page from the school as it
  // opens and queues nothing, so the line for every send is that it needs a connection.
  const works: PanelFact[] = [
    ["Reading a page you already opened", "Works offline", "Your phone shows the copy it last loaded"],
    ["Attendance, results and what is owed", "Needs a connection", "Each page is read from the school as it opens"],
    ["Explaining an absence, or any request", "Needs a connection", "It is not kept to send later — try again when you are back online"],
    ["Paying fees, or reporting a payment", "Needs a connection", "The same: nothing is queued on this phone"],
    ["Changing your password", "Needs a connection"],
  ];
  const sign = (device: Device): DrawerSpec => ({
    mode: "commit", tone: "attention" as PanelTone, kicker: "Sync and this phone", title: "Sign out of this device?",
    sub: `${device.device} is signed out straight away and will need your password to sign in again.`,
    commitLabel: "Sign out", commitDone: "Signed out", commitDoneBody: `${device.device} is no longer signed in.`,
    submit: { endpoint: `${PW}/sessions/${device.id}/revoke`, method: "POST" },
  });
  const items: ListItem[] = devices.map((device) => ({
    label: device.device, sub: `${device.where || "Place not known"} · last used ${when(device.lastActiveAt)}`,
    ...(device.current ? { pill: "This phone", tone: "positive" as PanelTone } : { viewLabel: "Sign out", drawer: sign(device) }),
  }));
  return {
    eyebrow: "Your account", title: "Sync and this phone", desc: "What this phone shows, and what it is waiting to send.",
    // The phone leads with how things stand, then what works without a connection, the way its mockup does.
    phoneEyebrow: "This phone", phoneTitle: "Up to date", phoneDesc: `Read from ${me.school} at ${me.now}.`,
    rows: [
      row("1fr", [{ type: "facts", title: "Up to date", sub: `Read at ${me.now}.`, per: 2, facts }]),
      row("1fr", [{ type: "facts", title: "What works with no connection", sub: "This portal reads from the school as each page opens.", per: 1, facts: works }]),
      row("1fr", [{ type: "note", tone: "neutral", title: "You need a connection to send", body: "The portal does not save a request for later. If you are offline when you press send, the page says it could not send — try again when you are back online. Nothing leaves your phone until then." }]),
      row("1fr", [{ type: "list", title: "Signed in on", sub: "Sign out anything you do not recognise.", items, empty: "No other device is signed in." }]),
    ],
  };
}
