import { decideNotice, inPersonalQuietHours, kindOfNotice } from "@/lib/staff-notices";

const at = (hhmmUtc: string) => new Date(`2026-10-28T${hhmmUtc}:00Z`);

describe("what a staff member asked to hear about", () => {
  it("reads the kind of a notice from its title, and leaves it unknown when it cannot tell", () => {
    expect(kindOfNotice("A leave is waiting for your approval")).toBe("An approval routed to me");
    expect(kindOfNotice("Approvals · escalated")).toBe("An item escalating past me");
    expect(kindOfNotice("Approvals · returned")).toBe("A returned submission of mine");
    expect(kindOfNotice("Weekly oversight summary")).toBe("Weekly oversight summary");
    expect(kindOfNotice("Your timetable changed")).toBeNull();
  });

  it("delivers everything to someone who has chosen nothing", () => {
    expect(decideNotice(null, { channel: "EMAIL", title: "Weekly oversight summary" })).toBe("deliver");
    expect(decideNotice({}, { channel: "SMS", title: "Anything" })).toBe("deliver");
  });

  it("holds back a kind the person unticked, but never an unrecognised notice", () => {
    const chosen = { notifyAbout: ["An approval routed to me" as const], notifyBy: ["In-app" as const, "Email" as const] };
    expect(decideNotice(chosen, { channel: "IN_APP", title: "Weekly oversight summary" })).toBe("suppress");
    expect(decideNotice(chosen, { channel: "IN_APP", title: "A leave is waiting" })).toBe("deliver");
    expect(decideNotice(chosen, { channel: "IN_APP", title: "Your timetable changed" })).toBe("deliver");
  });

  it("follows the channels the person ticked", () => {
    const chosen = { notifyBy: ["In-app" as const] };
    expect(decideNotice(chosen, { channel: "EMAIL", title: "A leave is waiting" })).toBe("suppress");
    expect(decideNotice(chosen, { channel: "SMS", title: "A leave is waiting" })).toBe("suppress");
    expect(decideNotice(chosen, { channel: "IN_APP", title: "A leave is waiting" })).toBe("deliver");
    expect(decideNotice(chosen, { channel: "WHATSAPP", title: "A leave is waiting" })).toBe("deliver");
  });

  it("never holds back an emergency or a safeguarding alert, whatever was chosen", () => {
    const chosen = { notifyAbout: [], notifyBy: [], quietHours: "19:00 – 07:00 WAT" as const };
    expect(decideNotice(chosen, { channel: "SMS", title: "Emergency broadcast" }, at("22:00"))).toBe("deliver");
    expect(decideNotice(chosen, { channel: "EMAIL", title: "A safeguarding concern has been raised" }, at("22:00"))).toBe("deliver");
    expect(decideNotice(chosen, { channel: "EMAIL", title: "Reminder", urgency: "Urgent" }, at("22:00"))).toBe("deliver");
  });

  it("keeps quiet hours in Lagos time, across midnight, for the messages that interrupt", () => {
    const chosen = { quietHours: "19:00 – 07:00 WAT" as const };
    // 18:30 UTC is 19:30 in Lagos: inside. 05:30 UTC is 06:30 in Lagos: still inside. 07:00 UTC is 08:00 in Lagos: over.
    expect(inPersonalQuietHours(chosen, at("18:30"))).toBe(true);
    expect(inPersonalQuietHours(chosen, at("05:30"))).toBe(true);
    expect(inPersonalQuietHours(chosen, at("07:00"))).toBe(false);
    expect(inPersonalQuietHours({ quietHours: "None" }, at("22:00"))).toBe(false);
    expect(decideNotice(chosen, { channel: "EMAIL", title: "A leave is waiting" }, at("18:30"))).toBe("defer");
    expect(decideNotice(chosen, { channel: "IN_APP", title: "A leave is waiting" }, at("18:30"))).toBe("deliver");
    expect(decideNotice(chosen, { channel: "EMAIL", title: "A leave is waiting" }, at("07:00"))).toBe("deliver");
  });
});
