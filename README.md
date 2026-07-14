# Daily CAT

A personal daily CAT-prep companion. Quant unlocks at 5 am, VARC at noon, LRDI at 6 pm (all IST). Eight AI-generated questions per session, progressive difficulty, streak with a weekly freeze, permanent archive, and spaced-repetition redo of past mistakes.

## Setup

1. Create a free project at supabase.com → Project Settings → Database → copy the two connection strings (pooled + direct) into `.env` (see `.env.example`).
2. Then:

```bash
npm install
cp .env.example .env      # fill in DB URLs + ANTHROPIC_API_KEY
npm run db:push           # one-time: creates the tables in Supabase
npm run dev
```

`db:push` is only needed again if the schema changes — never day-to-day. Daily question generation runs itself via cron.

First open: no sets exist yet, so the app serves the built-in seed-bank sets instantly and generates today's real sets in the background — refresh in a minute.

To generate manually: `curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/generate`

## Deploying

- **Render**: New → Blueprint → pick this repo (`render.yaml`). Set `DATABASE_URL`, `DIRECT_URL`, `ANTHROPIC_API_KEY`, `CRON_SECRET` in the dashboard — same values as local, since Supabase is hosted. For the daily 00:05 IST generation, use a free scheduler like cron-job.org: hit `https://<your-app>.onrender.com/api/cron/generate` daily at 18:35 UTC with header `Authorization: Bearer <CRON_SECRET>`. (Even without a cron, the app self-heals: the first open of the day serves the seed set and generates the real sets in the background.)
- **Vercel** (alternative): `vercel.json` schedules the cron at 18:35 UTC = 00:05 IST automatically.
- **Auth:** none, by design — deploy to a private/unguessable URL. The only protected route is the cron endpoint (`CRON_SECRET`).

## How the pieces fit

- `prisma/schema.prisma` — data model; the comments document the level rule, freeze boundary (Monday 00:00 IST), SR schedule, and the generation lock.
- `lib/generation/` — prompts, Zod validation, independent answer-key verification (Quant/LRDI generate surplus questions; only keys that survive a fresh solve are served).
- `lib/time.ts` — everything is pinned to IST.
- `app/api/cron/generate` — daily generation; every page load also retries failed generation through the same lock, so a bad night self-heals.
