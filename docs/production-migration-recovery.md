# Recovering a Render deploy blocked by P3009

## What happened

The deploy of 2026-09-23 failed at `prisma migrate deploy`:

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

It matters *where* that runs. Neither image runs the root `package.json` `build`
script, so this is not a build step: `Dockerfile` runs only `prisma:generate &&
build:web`, and migrations run at **API container start**, from
`backend/Dockerfile`'s `CMD`. So the failing command is the first half of

```
sh -c "npx prisma migrate deploy && node dist/api/backend/src/main.js"
```

`migrate deploy` exits non-zero, the `&&` short-circuits, `node` never runs, and
the API crash-loops. The web service is untouched — nothing in its path runs
migrations. "The API is down but the site is up" is the expected shape of this
failure, not a second bug.

The Render log confirms all of it. The image built fine — `sending cache export
… DONE`, then `==> Deploying…` — and everything below that is container start:

```
09:54:01  Applying migration `20260920223920_scheme_of_work_fees_payroll`
09:54:01  Error: P3018 … type "SchemeOfWorkStatus" already exists
09:54:16  ==> Exited with status 1
09:54:26  Error: P3009 … The `20260920223920…` migration started at 2026-09-23 09:54:01.791672 UTC failed
09:54:37  ==> No open ports detected, continuing to scan...
09:54:51  Error: P3009 …
```

How to recognise it: **`No open ports detected`** is the giveaway. `node` never
bound :4000 because it never ran. And the restarts each report `P3009` rather
than the original `42710` — the first boot is the only one that names the real
cause, so scroll to the *earliest* failure, not the latest.

That log also says `35 migrations found`, because
`20260926100515_approval_request_queue` did not exist yet on 09-23. It was
written three days later and inherited the block.

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

2. Redeploy the API. Its `CMD` runs `prisma migrate deploy`, which re-applies
   `20260920223920` (a near no-op) and then applies the migration it had been
   blocking, `20260926100515_approval_request_queue`.

3. Confirm:

   ```bash
   npx prisma migrate status
   ```

   Expect "Database schema is up to date!" and no failed migrations.

## What was actually done, 2026-09-28

No shell, no SQL client, and the free plan has no Shell tab — so step 1 could not
be run by hand at all. Instead the resolve was put into the API's own start
command, where it runs with production `DATABASE_URL` already in the
environment:

```
CMD ["sh", "-c", "npx prisma migrate resolve --rolled-back 20260920223920_scheme_of_work_fees_payroll || true; npx prisma migrate deploy && node dist/api/backend/src/main.js"]
```

`|| true` carries it: once the row is cleared, later boots get `P3012 … not in a
failed state` and continue to `migrate deploy`. It names one migration, so it
cannot reach another.

**This is temporary and must come out.** Left in, a migration that ever
legitimately failed would be auto-retried on every boot instead of stopping the
deploy — which is the signal you want.

Tested locally against a reproduction of production's state rather than assumed.
`finished_at` was blanked on that migration's row to manufacture the same failure
(`migrate deploy` then returned the same `P3009`), and the chain above was run
against it:

- `Migration … marked as rolled back.`
- `Applying migration 20260920223920_scheme_of_work_fees_payroll` — succeeded
  against a database that already held every object in it
- chain exit code `0`, so `node` would boot
- afterwards: two rows for that migration, the old one `rolled_back_at` set and a
  new one with `finished_at` set; `migrate status` → "Database schema is up to
  date!"; `migrate diff` against `schema.prisma` → "No difference detected."

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
