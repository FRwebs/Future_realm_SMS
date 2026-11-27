import { Prisma, type PrismaClient } from "@prisma/client";

/**
 * The sample class stays out of the school's real figures.
 *
 * A school can load a sample class at signup — thirty pupils with a term of attendance, scores and report cards — to see the product working.
 * It is made of ordinary rows, so every list, count and average the school reads would otherwise include it: a thirteenth class level, thirty
 * more pupils on the roll, thirty "published" cards, a register nobody marks. This reads the sample's own manifest (what it created is listed
 * so it can be removed whole) and leaves those rows out of every list and every total, for every model that holds a class, a level or a
 * pupil, in one place — not a filter remembered by each screen.
 *
 * What it does not do: a query that names a sample row itself (its own page, its own roster) is answered as asked, and so is any request whose
 * address names the sample, so the class can still be looked at on its own pages. Reading one row by its id is never changed.
 */

declare global {
  var __prismaSampleFilter__: boolean | undefined;
  /** The sample's ids as the process last read them — read by the web layer to see whether a request is about the sample. */
  var __sampleIds__: (() => string[]) | undefined;
  /** Whether the request being served is about the sample, and so sees it. */
  var __includeSample__: (() => boolean) | undefined;
  var __forgetSample__: (() => void) | undefined;
}

type Sets = { rooms: Set<string>; levels: Set<string>; students: Set<string>; all: string[] };
type Rule = { field: string; of: "rooms" | "levels" | "students"; /** An optional column: a row with nothing in it is not the sample, and SQL's NOT IN would drop it. */ optional: boolean };

const LISTS = new Set(["findMany", "findFirst", "findFirstOrThrow", "count", "aggregate", "groupBy"]);
const TTL = 30_000;

let sets: Sets | null = null;
let readAt = 0;
let rules: Map<string, Rule[]> | null = null;

function rulesOf(): Map<string, Rule[]> {
  if (rules) return rules;
  rules = new Map();
  for (const model of Prisma.dmmf.datamodel.models) {
    const found: Rule[] = [];
    if (model.name === "ClassLevel") found.push({ field: "id", of: "levels", optional: false });
    else if (model.name === "ClassRoom") found.push({ field: "id", of: "rooms", optional: false });
    else if (model.name === "Student") found.push({ field: "id", of: "students", optional: false });
    for (const field of model.fields) {
      if (field.kind !== "scalar" || field.isList) continue;
      const optional = !field.isRequired;
      if (field.name === "classId" || field.name === "currentClassId") found.push({ field: field.name, of: "rooms", optional });
      else if (field.name === "classLevelId") found.push({ field: field.name, of: "levels", optional });
      else if (field.name === "studentId") found.push({ field: field.name, of: "students", optional });
    }
    if (found.length) rules.set(model.name, found);
  }
  return rules;
}

async function read(client: PrismaClient): Promise<Sets> {
  if (sets && Date.now() - readAt < TTL) return sets;
  const rows = await client.configurationItem.findMany({ where: { resource: "sample-data", code: "manifest", deletedAt: null }, select: { data: true } });
  const next: Sets = { rooms: new Set(), levels: new Set(), students: new Set(), all: [] };
  for (const row of rows) {
    const data = (row.data ?? {}) as { classId?: string; levelId?: string; studentIds?: string[] };
    if (data.classId) next.rooms.add(data.classId);
    if (data.levelId) next.levels.add(data.levelId);
    for (const id of data.studentIds ?? []) next.students.add(id);
  }
  next.all = [...next.rooms, ...next.levels, ...next.students];
  sets = next;
  readAt = Date.now();
  return next;
}

export function installSampleFilter(client: PrismaClient) {
  if (globalThis.__prismaSampleFilter__) return;
  globalThis.__prismaSampleFilter__ = true;
  globalThis.__sampleIds__ = () => sets?.all ?? [];
  globalThis.__forgetSample__ = () => { sets = null; readAt = 0; };

  client.$use(async (params, next) => {
    const model = params.model;
    if (!model || !LISTS.has(params.action) || model === "ConfigurationItem") return next(params);
    const mine = rulesOf().get(model);
    if (!mine) return next(params);
    if (globalThis.__includeSample__?.()) return next(params);

    const known = await read(client);
    if (!known.all.length) return next(params);

    const args = (params.args ?? {}) as { where?: Record<string, unknown> };
    // A query that names a sample row is about the sample: it is answered as it was asked.
    const asked = args.where ? JSON.stringify(args.where) : "";
    if (asked && known.all.some((id) => asked.includes(id))) return next(params);

    const leave = mine
      .map((rule) => ({ rule, ids: [...known[rule.of]] }))
      .filter((entry) => entry.ids.length)
      .map((entry) => (entry.rule.optional ? { OR: [{ [entry.rule.field]: null }, { [entry.rule.field]: { notIn: entry.ids } }] } : { [entry.rule.field]: { notIn: entry.ids } }));
    if (!leave.length) return next(params);
    params.args = { ...args, where: args.where ? { AND: [args.where, ...leave] } : { AND: leave } };
    return next(params);
  });
}
