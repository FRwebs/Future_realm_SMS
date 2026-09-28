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

Something applied this migration's schema to the database outside the migration
history — `prisma db push`, or DDL run by hand. Either writes the objects
straight to the database and records nothing in `_prisma_migrations`, so by the
time `20260920223920_scheme_of_work_fees_payroll` ran, every enum, table,
column, constraint and index it creates was already there.

So its first statement — `CREATE TYPE "SchemeOfWorkStatus"` — hit an object that
already existed and raised `42710`. Nothing was wrong with the migration. It was
correct against a database whose schema came only from migrations, and
impossible against one that had been changed behind their back.

What the production database actually looks like, read on 2026-09-28:

- 35 rows in `_prisma_migrations`: 34 applied, 1 failed, 0 rolled back. So this
  database **does** have a real migration history, spanning 09-07 to 09-20 — it
  was not built by `db push`. A push happened *partway through* that history and
  landed the scheme-of-work objects early.
- All 5 enums and all 9 tables the migration creates: already present.
- Of the two index renames, only the **post**-rename names exist
  (`…_isActiv_idx`, `…_academicSessio_key`), which is the signature of a `db
  push` — it names indexes from the current schema, so it created them already
  renamed. A half-applied migration would have left the old names.
- `ApprovalRequest` absent, confirming `20260926100515` never ran.

The earlier version of this document claimed the whole database was built by
`db push`. That was wrong, and the 34 applied rows disprove it.

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

Note on where to run this: **Render's Shell tab needs a paid instance type**, and
both services in `render.yaml` are on `plan: free`. So the shell-on-Render route
is not available here — it has to be a client that can reach the external
connection string.

1. Tell Prisma the failed migration did not apply, with production
   `DATABASE_URL` set:

   ```bash
   npx prisma migrate resolve --rolled-back 20260920223920_scheme_of_work_fees_payroll
   ```

   Careful: the Prisma CLI loads `.env` and it **overrides** the shell
   environment, so running this in a checkout that has a local `.env` will
   quietly target localhost and answer `P3012 … not in a failed state`. That
   error means you hit the wrong database, not that the problem is gone.

   With only a SQL client, the equivalent single statement is:

   ```sql
   UPDATE "_prisma_migrations" SET rolled_back_at = now()
    WHERE migration_name = '20260920223920_scheme_of_work_fees_payroll'
      AND finished_at IS NULL;
   ```

   The `finished_at IS NULL` clause confines it to the failed row, so a second
   run updates nothing. Expect `UPDATE 1`.

   `--rolled-back`, not `--applied`. `--applied` marks the migration done and
   never runs it, which asserts all 83 of its statements are already satisfied.
   That now checks out against this database — including the two index renames,
   which are the one part `--applied` would have silently skipped — but
   `--rolled-back` lets the idempotent migration confirm it rather than assuming,
   at the cost of one near-empty pass.

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
