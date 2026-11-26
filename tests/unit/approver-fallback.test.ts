import { anotherDecider, roleIsHeld, waitingOn, type Holder, type Route } from "../../backend/src/modules/approvals/hub.shared";

const route = { approver: "Principal", second: null } as unknown as Route;
const twoStep = { approver: "Bursar", second: "Principal" } as unknown as Route;
const owner: Holder = { id: "owner", role: "PROPRIETOR" };
const principal: Holder = { id: "principal", role: "PRINCIPAL" };
const bursar: Holder = { id: "bursar", role: "BURSAR" };

describe("work sent to a role nobody holds", () => {
  it("names the role when someone holds it", () => {
    expect(waitingOn([owner, principal], route, 1)).toBe("Principal");
    expect(roleIsHeld([owner, principal], "Principal")).toBe(true);
  });

  it("falls back to the Proprietor when the role is vacant, and says so", () => {
    expect(waitingOn([owner], route, 1)).toBe("Proprietor");
    expect(roleIsHeld([owner], "Principal")).toBe(false);
  });

  it("reads each step of a two-step route on its own", () => {
    expect(waitingOn([owner, bursar], twoStep, 1)).toBe("Bursar");
    expect(waitingOn([owner, bursar], twoStep, 2)).toBe("Proprietor");
  });
});

describe("deciding what you asked for", () => {
  it("is allowed only when nobody else could decide it", () => {
    expect(anotherDecider([owner], route, 1, "owner")).toBe(false);
    expect(anotherDecider([owner, principal], route, 1, "owner")).toBe(true);
    expect(anotherDecider([owner, bursar], route, 1, "owner")).toBe(false);
  });

  it("counts the role the step names", () => {
    expect(anotherDecider([owner, bursar], twoStep, 1, "owner")).toBe(true);
  });
});
