import { Prisma } from "@prisma/client";

import { installSampleFilter } from "@/lib/db/sample-filter";

type Params = { model?: string; action: string; args?: { where?: Record<string, unknown> } };
type Middleware = (params: Params, next: (params: Params) => Promise<unknown>) => Promise<unknown>;

const ROOM = "room_sample", LEVEL = "level_sample", PUPIL = "pupil_sample";

/** A stand-in for the client: it hands the middleware the sample's manifest, and records what the real query would have been. */
function client(manifest: unknown[]) {
  let middleware!: Middleware;
  const fake = {
    $use: (fn: Middleware) => { middleware = fn; },
    configurationItem: { findMany: async () => manifest },
  };
  globalThis.__prismaSampleFilter__ = undefined;
  installSampleFilter(fake as never);
  return async (params: Params) => {
    let seen: Params | null = null;
    await middleware(params, async (next) => { seen = next; return null; });
    return seen as Params | null;
  };
}
const withSample = [{ data: { classId: ROOM, levelId: LEVEL, studentIds: [PUPIL] } }];

describe("keeping the sample class out of the real figures", () => {
  afterEach(() => { globalThis.__includeSample__ = undefined; globalThis.__prismaSampleFilter__ = undefined; globalThis.__forgetSample__?.(); });

  it("leaves the sample out of every list and total of a model that holds a class, a level or a pupil", async () => {
    const run = client(withSample);
    const rooms = await run({ model: "ClassRoom", action: "findMany", args: { where: { schoolId: "s1" } } });
    expect(JSON.stringify(rooms!.args!.where)).toContain(ROOM);
    expect(JSON.stringify((await run({ model: "ClassLevel", action: "count", args: { where: { schoolId: "s1" } } }))!.args!.where)).toContain(LEVEL);
    expect(JSON.stringify((await run({ model: "Student", action: "groupBy", args: { where: { schoolId: "s1" } } }))!.args!.where)).toContain(PUPIL);
    // a model that only points at a class: attendance, sheets, cards
    expect(JSON.stringify((await run({ model: "ReportCard", action: "count", args: { where: { schoolId: "s1" } } }))!.args!.where)).toContain(ROOM);
  });

  it("does not drop a row that points at no class at all — NOT IN would, and a fee structure for every class would vanish", async () => {
    const run = client(withSample);
    const where = (await run({ model: "ReportCard", action: "findMany", args: { where: { schoolId: "s1" } } }))!.args!.where as { AND: unknown[] };
    const optional = Prisma.dmmf.datamodel.models.flatMap((model) => model.fields.filter((field) => field.name === "classId" && !field.isRequired).map(() => model.name));
    expect(optional.length).toBeGreaterThan(0);
    const model = optional[0]!;
    const filtered = (await run({ model, action: "findMany", args: { where: {} } }))!.args!.where as { AND: Array<Record<string, unknown>> };
    expect(JSON.stringify(filtered.AND)).toContain('"classId":null');
    expect(where.AND).toBeDefined();
  });

  it("answers a query that names the sample, and a request about the sample, as asked", async () => {
    const run = client(withSample);
    const named = await run({ model: "Student", action: "findMany", args: { where: { currentClassId: ROOM } } });
    expect(named!.args!.where).toEqual({ currentClassId: ROOM });
    globalThis.__includeSample__ = () => true;
    const open = await run({ model: "ClassRoom", action: "findMany", args: { where: { schoolId: "s1" } } });
    expect(open!.args!.where).toEqual({ schoolId: "s1" });
  });

  it("changes nothing for a school with no sample, and never touches a write or a read by id", async () => {
    const none = client([]);
    expect((await none({ model: "ClassRoom", action: "findMany", args: { where: { schoolId: "s1" } } }))!.args!.where).toEqual({ schoolId: "s1" });
    const run = client(withSample);
    expect((await run({ model: "Student", action: "findUnique", args: { where: { id: "x" } } }))!.args!.where).toEqual({ id: "x" });
    expect((await run({ model: "Student", action: "deleteMany", args: { where: { schoolId: "s1" } } }))!.args!.where).toEqual({ schoolId: "s1" });
  });
});
