import { execFile } from "child_process";
import { createHash } from "crypto";
import { createReadStream } from "fs";
import { mkdir, readdir, stat, unlink } from "fs/promises";
import path from "path";
import { promisify } from "util";

import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { AuditAction, type Prisma } from "@prisma/client";

import { prisma } from "../../../../src/lib/db/prisma";
import { sendEmail } from "../../../../src/lib/integrations/mailer";

const run = promisify(execFile);

/**
 * A backup is a file somebody could restore from — so this makes one with pg_dump, hashes it, checks that pg_restore can
 * read it, and (when asked) restores it into an empty scratch database and counts what came back. Each of those is
 * recorded only if it actually happened. Nothing here is a number made up to look like a backup.
 */

const OK_STATUS = "SUCCESS";

/** pg_dump wants a plain connection string; Prisma's own `?schema=` is not one. */
function connection(name?: string) {
  const raw = (process.env.DATABASE_URL ?? "").split("\n").find((line) => line.trim() && !line.trim().startsWith("#")) ?? "";
  const url = new URL(raw.trim().replace(/^"|"$/g, ""));
  url.searchParams.delete("schema");
  if (name) url.pathname = `/${name}`;
  return url.toString();
}

export const backupDirectory = () => path.resolve(process.env.BACKUP_DIR ?? "backups");

/**
 * pg_dump refuses to read a newer server than itself, so the client tools must match the server's major version. The
 * server says which it is; the tools are looked for beside it (PG_BIN, Homebrew, Debian), then on the PATH.
 */
async function toolsFor(): Promise<(tool: string) => string> {
  const [{ version }] = await prisma.$queryRaw<Array<{ version: string }>>`select current_setting('server_version_num') as version`;
  const major = String(Math.floor(Number(version) / 10000));
  const candidates = [process.env.PG_BIN, `/opt/homebrew/opt/postgresql@${major}/bin`, `/usr/local/opt/postgresql@${major}/bin`, `/usr/lib/postgresql/${major}/bin`, `/Applications/Postgres.app/Contents/Versions/${major}/bin`].filter((dir): dir is string => Boolean(dir));
  for (const dir of candidates) {
    try {
      await stat(path.join(dir, "pg_dump"));
      return (tool) => path.join(dir, tool);
    } catch {
      // not here
    }
  }
  return (tool) => tool;
}

async function sha256(file: string) {
  return new Promise<string>((resolve, reject) => {
    const hash = createHash("sha256");
    createReadStream(file).on("data", (chunk) => hash.update(chunk)).on("end", () => resolve(hash.digest("hex"))).on("error", reject);
  });
}

type Options = { verify: boolean; restoreTest: boolean; reason?: string; actorId?: string | null };

@Injectable()
export class BackupService implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger("Backup");
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  onModuleInit() {
    if (process.env.BACKUP_SCHEDULER !== "on") return;
    // Once a day, in the small hours: if the last good backup is more than 23 hours old, make one.
    this.timer = setInterval(() => void this.dueCheck().catch((error) => this.log.error(error)), 30 * 60_000);
    this.timer.unref();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  private async dueCheck() {
    const last = await prisma.backupRecord.findFirst({ where: { status: OK_STATUS }, orderBy: { startedAt: "desc" } });
    if (!last || Date.now() - last.startedAt.getTime() > 23 * 3_600_000) await this.backup({ verify: true, restoreTest: false, reason: "Scheduled daily backup", actorId: null });
  }

  /** Make a backup now. Returns the record, whatever happened — a failed backup is recorded as failed, with why. */
  async backup(options: Options) {
    if (this.running) throw new Error("A backup is already running.");
    this.running = true;
    const startedAt = new Date();
    const record = await prisma.backupRecord.create({ data: { scope: "FULL_DATABASE", status: "RUNNING", startedAt, reason: options.reason ?? null, startedById: options.actorId ?? null, region: process.env.BACKUP_REGION ?? "This server" } });
    const notes: string[] = [];
    let written: string | null = null;
    try {
      await mkdir(backupDirectory(), { recursive: true });
      const bin = await toolsFor();
      const file = path.join(backupDirectory(), `futurerealm-${startedAt.toISOString().replace(/[:.]/g, "-")}.dump`);
      await run(bin("pg_dump"), ["--format=custom", "--no-owner", "--file", file, connection()], { maxBuffer: 64 * 1024 * 1024 }).catch((error: NodeJS.ErrnoException) => {
        throw new Error(error.code === "ENOENT" ? "pg_dump is not installed on this server, so no backup could be made." : `pg_dump failed: ${String((error as { stderr?: string }).stderr ?? error.message).slice(0, 300)}`);
      });
      written = file;
      const size = (await stat(file)).size;
      const hash = await sha256(file);
      let verifiedAt: Date | null = null;
      if (options.verify) {
        const listing = await run(bin("pg_restore"), ["--list", file], { maxBuffer: 64 * 1024 * 1024 }).catch((error) => { throw new Error(`The archive could not be read back: ${String((error as { stderr?: string }).stderr ?? "").slice(0, 200)}`); });
        const entries = listing.stdout.split("\n").filter((line) => line && !line.startsWith(";")).length;
        if (entries < 5) throw new Error("The archive read back with almost nothing in it.");
        verifiedAt = new Date();
        notes.push(`${entries} objects read back`);
      }
      let restoreResult: string | null = null;
      let restoreTestedAt: Date | null = null;
      if (options.restoreTest) {
        restoreResult = await this.restoreTest(file, bin);
        restoreTestedAt = new Date();
        notes.push(restoreResult);
      }
      const done = await prisma.backupRecord.update({ where: { id: record.id }, data: { status: OK_STATUS, sizeMb: Math.round((size / 1_048_576) * 100) / 100, location: file, sha256: hash, verifiedAt, restoreTestedAt, restoreResult, endedAt: new Date(), note: notes.join(" · ") || null } });
      await this.prune();
      await this.tell(done, true);
      return done;
    } catch (error) {
      const message = error instanceof Error ? error.message : "The backup failed.";
      // A half-written file is not a backup, so it is not kept to be mistaken for one.
      await unlink(path.join(backupDirectory(), `futurerealm-${startedAt.toISOString().replace(/[:.]/g, "-")}.dump`)).catch(() => undefined);
      void written;
      const failed = await prisma.backupRecord.update({ where: { id: record.id }, data: { status: "FAILED", endedAt: new Date(), note: message } });
      await prisma.securityIncident.create({ data: { type: "BACKUP_FAILED", severity: "HIGH", status: "DETECTED", description: `A database backup failed: ${message}` } }).catch(() => undefined);
      await this.tell(failed, false);
      return failed;
    } finally {
      this.running = false;
    }
  }

  /** Restores the dump into an empty scratch database, counts what came back against what is there now, and drops it. */
  private async restoreTest(file: string, bin: (tool: string) => string): Promise<string> {
    const scratch = `frtest_${Date.now().toString(36)}`;
    try {
      await run(bin("createdb"), [scratch, "--maintenance-db", connection()]).catch((error) => { throw new Error(`A restore test could not start: ${String((error as { stderr?: string }).stderr ?? error.message).slice(0, 160)}`); });
      await run(bin("pg_restore"), ["--no-owner", "--exit-on-error", "-d", connection(scratch), file], { maxBuffer: 64 * 1024 * 1024 }).catch((error) => { throw new Error(`The restore test failed: ${String((error as { stderr?: string }).stderr ?? error.message).slice(0, 200)}`); });
      const count = async (url: string) => Number((await run(bin("psql"), [url, "-At", "-c", 'select (select count(*) from "School") + (select count(*) from "User") + (select count(*) from "Student")'])).stdout.trim());
      const [restored, live] = await Promise.all([count(connection(scratch)), count(connection())]);
      if (restored === 0 && live > 0) throw new Error("The restore test came back empty.");
      return `Restore test passed: ${restored.toLocaleString()} records restored into an empty database (${live.toLocaleString()} live)`;
    } finally {
      await run(bin("dropdb"), ["--if-exists", scratch, "--maintenance-db", connection()]).catch(() => undefined);
    }
  }

  /** Old dump files go; the records stay. */
  private async prune() {
    const keep = Number(process.env.BACKUP_KEEP_DAYS ?? 14) * 86_400_000;
    for (const name of await readdir(backupDirectory()).catch(() => [] as string[])) {
      if (!name.endsWith(".dump")) continue;
      const file = path.join(backupDirectory(), name);
      if (Date.now() - (await stat(file)).mtimeMs > keep) await unlink(file).catch(() => undefined);
    }
  }

  private async tell(record: { status: string; sizeMb: number | null; location: string | null; note: string | null; startedAt: Date }, ok: boolean) {
    const team = await prisma.user.findMany({ where: { role: { in: ["PLATFORM_OWNER", "DEVELOPER", "PLATFORM_ADMIN", "SUPER_ADMIN"] }, isActive: true, deletedAt: null }, select: { email: true } });
    await Promise.all(team.map((member) => sendEmail({ to: member.email, subject: ok ? "Database backup completed" : "Database backup FAILED", text: `${ok ? "A full-database backup finished." : "A full-database backup failed."}\n\nStarted: ${record.startedAt.toISOString()}\n${record.sizeMb !== null ? `Size: ${record.sizeMb} MB\n` : ""}${record.location ? `File: ${record.location}\n` : ""}${record.note ? `Detail: ${record.note}\n` : ""}` }).catch(() => undefined)));
    await prisma.auditLog.create({ data: { schoolId: null, actorId: null, action: AuditAction.SETTINGS_UPDATE, entityType: "BackupRecord", entityId: "backup", metadata: { summary: ok ? "Database backup completed" : "Database backup failed", note: record.note } as Prisma.InputJsonValue } });
  }
}
