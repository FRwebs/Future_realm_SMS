# Recovering a Render deploy blocked by P3009

## What happened

The deploy of 2026-09-26 failed in `npm run build`, at `prisma migrate deploy`:

```
Error: P3018 A migration failed to apply.
Migration name: 20260920223920_scheme_of_work_fees_payroll
Database error code: 42710
Database error: ERROR: type "SchemeOfWorkStatus" already exists
```

Every deploy after that failed earlier and with a different error:

```
Error: P3009 migrate found failed migrations in the target database
```

Two separate problems, in sequence.

## Why it failed

The Render database was not built by the migration history. It was built with
`prisma db push`, which writes the schema straight to the database and records
nothing in `_prisma_migrations`. By the time
`20260920223920_scheme_of_work_fees_payroll` was written, that database already
held every enum, table, column, constraint and index the migration creates.

So the migration's first statement — `CREATE TYPE "SchemeOfWorkStatus"` — hit an
object that was already there and raised `42710`. Nothing was wrong with the
migration; it was correct against a database built from migrations, and
impossible against a database built by `db push`.

Prisma then wrote a row into `_prisma_migrations` with `finished_at` null and a
`logs` value holding the error. That row is what `P3009` reports. Prisma will
not apply *any* migration while a failed row is present, which is why the
failure outlived the cause: it blocked
`20260926100515_approval_request_queue` too, a migration that would have
applied without complaint.

## The fix, already in the repo

`20260920223920_scheme_of_work_fees_payroll/migration.sql` is now idempotent.
Each statement converges on the same end state whether the object is there or
not:

| Statement kind | Guard |
|---|---|
| `CREATE TYPE` (5) | `DO` block catching `duplicate_object` — Postgres has no `IF NOT EXISTS` for types |
| `ADD CONSTRAINT` (35) | `DO` block catching `duplicate_object`, `duplicate_table` |
| `ALTER INDEX … RENAME TO` (2) | `DO` block catching `undefined_table`, `undefined_object`, `duplicate_table` — either the old name is gone or the new one is taken, and both mean the rename already happened |
| `CREATE TABLE` (9), `CREATE INDEX` (24), `ADD COLUMN` (13) | `IF NOT EXISTS` |
| `DROP INDEX` (1) | `IF EXISTS` |

Verified three ways:

- Applied twice in a row against a database that already holds every object.
  Both runs clean, output is nothing but `… already exists, skipping` notices.
- Replayed the whole history — all 36 migrations, in order — into an empty
  database. Clean.
- `prisma migrate diff` from that freshly migrated database to
  `schema.prisma`: **No difference detected.** The guards do not change the
  schema a fresh install ends up with.

## Recovery, on production

The failed row has to be cleared by hand. `migrate deploy` refuses to do
anything while it is there, so no amount of redeploying will clear it.

1. Tell Prisma the failed migration did not apply. From a shell with production
   `DATABASE_URL` set — Render's shell on either service, or locally against the
   external connection string:

   ```bash
   npx prisma migrate resolve --rolled-back 20260920223920_scheme_of_work_fees_payroll
   ```

   `--rolled-back`, not `--applied`. `--applied` marks the migration done and
   never runs it, which asserts that every one of its 83 statements is already
   satisfied — including the two index renames. That is probably true (a `db
   push` would have created those indexes under their final names) but nothing
   here has checked it against that database. `--rolled-back` lets the
   now-idempotent migration run and settle it either way, at the cost of one
   near-empty pass.

2. Redeploy. `npm run build` runs `prisma migrate deploy`, which re-applies
   `20260920223920` (a near no-op, converging the two index names) and then
   applies the migration it had been blocking,
   `20260926100515_approval_request_queue`.

3. Confirm:

   ```bash
   npx prisma migrate status
   ```

   Expect "Database schema is up to date!" and no failed migrations.

## Avoiding the next one

`prisma db push` on a database that later receives migrations produces exactly
this failure, and produces it *later*, on a deploy, rather than at the moment of
the mistake. Production should only ever be changed by `prisma migrate deploy`.

If a database has already been pushed to, baseline it before its first
migration rather than waiting for a collision:

```bash
npx prisma migrate resolve --applied <every_migration_already_reflected_in_the_schema>
```

`db push` remains the right tool for a local database being reshaped quickly. It
is not a deploy step.
