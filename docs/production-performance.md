# Making production fast — what is in the code, and what only the hosting can do

The code has done what it can on its own: pages ask the API for less, remember what rarely changes (until the API says it has), send less to the
browser, compress, and are indexed for the reads that scanned. What is left is mostly **where things run and how they are billed**, which the code
cannot change. In order of how much each is likely to matter for people in Nigeria:

## 1. Put the three services near the users (biggest single win)
`render.yaml` places the database, the API and the web app in **Oregon**. A browser in Lagos is roughly 250–300 ms from Oregon on every request,
and a page is several requests. Frankfurt is the nearest Render region (roughly 150–180 ms). Move all three together — a web app in one region and a
database in another pays the distance again on every query.
Moving the database: take a dump (`pg_dump -Fc`, version 18 client for a Render Postgres 18), create the new database, `pg_restore`, then point
`DATABASE_URL`/`DIRECT_URL` at it. `docs/production-migration-recovery.md` covers the migration side.

## 2. Don't let the services sleep
Render's **free** web services stop after about 15 minutes without a request and take 30–60 seconds to wake — the first person of the morning waits
that long. The blueprint has both services (and the database) on `plan: free`. Use **Starter** (always on) for the API and the web app. The free
database also **expires** (30 days, then a 14-day grace period): check what plan the production database is actually on before anything else.
Pinging a free service to keep it awake does not work for two services: the free allowance (750 hours a month) is shared, and two always-on
services need about 1,440.

## 3. Use the private network between the web app and the API
`NEST_API_URL` is the API's public `onrender.com` address, so every server-side call goes out to the internet and back with a fresh TLS handshake.
In the Render dashboard open `futurerealm-api` → **Connect** and use its internal address instead (the comment in `render.yaml` says the same).
The web app also reads the database directly for a few hot paths; that already uses the internal connection string.

## 4. Health check (done in the repo)
`GET /api/health` answers without signing in or touching the database; `render.yaml` now sets it as `healthCheckPath`, so Render restarts a service
that has hung and stops sending traffic to one that is starting. `GET /api/health/db` also asks the database one question — for a person or an
uptime monitor, not for Render's restart decision.

## 5. Measure before the next change
Set `PERF_LOG=1` on `futurerealm-web` for a day. Every server-side call to the API is logged as
`[api] /api/v1/... 200 53ms (started +12847ms)`: the slow ones, and how many a page makes, are the list of what to fix next. The web server's memory
of permissions and teacher profiles is switched off with `FR_NO_SERVER_CACHE=1` — only for comparing, never to leave on.

## 6. Smaller web image (not done; needs a Docker build to verify)
The runtime image copies the whole `node_modules`. `output: "standalone"` in `next.config.ts` plus copying `.next/standalone` shrinks it a great deal
and makes a cold start faster. It has to be tried with a real image build because the web app imports backend service classes directly
(`src/lib/api/direct.ts`).

## After any deploy
Open `/api/health/db` on the API: `{"ok":true,"databaseMs":…}` means the chain works. Migrations run when the API container starts, so a failed
migration shows up there as an API that never comes up while the site stays up.
