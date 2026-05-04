# Database Profiles

This project keeps `.env` as the active runtime file for Prisma, the Nest API, and Next.js.

To switch databases safely without hand-editing `.env`, use database profile files:

- `.env.db.local`
- `.env.db.remote`

Create them from:

- `.env.db.local.example`
- `.env.db.remote.example`

Then switch with:

```bash
npm run db:use:local
npm run db:use:remote
npm run db:which
```

What happens:

- only `DATABASE_URL` and `DIRECT_URL` are swapped inside `.env`
- the rest of your `.env` stays untouched
- `.env.active` is updated with the last selected profile

After switching:

1. restart the API dev server if it is already running
2. rerun Prisma commands against the selected profile if needed

Common workflow:

```bash
cp .env.db.local.example .env.db.local
cp .env.db.remote.example .env.db.remote

# edit the two files with your real connection strings

npm run db:use:local
npx prisma db push
npm run prisma:seed

npm run db:use:remote
```
