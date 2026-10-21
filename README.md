# Commishop

Your fantasy basketball commissioner desk — power rankings, matchups, and league intel.

**Commishop** connects ESPN Fantasy Basketball leagues and gives commissioners a single place to track live standings, model matchup win probability, and publish locked weekly power rankings with AI write-ups.

## Features

- **ESPN league sync** — Connect public or private leagues (via `espn_s2` / `SWID` cookies); switch between multiple connected leagues
- **Overview desk** — Live standings, matchup week selector, projected scores, category records, and ESPN-style win probabilities
- **Power rankings** — Immutable editions (preseason + post–Match N) with rank movement and 4–5 sentence AI blurbs
- **Shareable exports** — Export rankings cards as PNG or PDF for league chats
- **Scheduled publish** — Daily Vercel Cron job gates on Utah 10am and creates Match N editions when ESPN’s calendar says a matchup ended

## How it works

```
User → Better Auth session
     → tRPC (league.*)
     → Postgres (league credentials + locked ranking editions)
     → ESPN Fantasy adapter (live standings / matchups / power feed)
     → OpenAI (blurbs) on publish / backfill
     → Overview & Power Rankings UI
```

1. **Auth & invite gate** — Better Auth (email/password + optional Google). Signup can be limited with `AUTH_ALLOWED_EMAILS`.
2. **League connection** — Credentials live in Postgres; live ESPN data is fetched on demand through a server-side adapter (shared fetch, overview, power feed, blurb context).
3. **Overview** — Combines league views, matchup projections, win-probability modeling, and NBA scoreboard progress for in-progress games.
4. **Power rankings** — Ranks use an ESPN FF–style formula (`dominance` + average score + margin of victory). Editions are **immutable snapshots**, not live recomputes. Preseason is created lazily; Match N editions are published by cron.
5. **Blurbs** — Structured OpenAI prompts with Zod-validated JSON responses; stored on each ranking entry and backfilled idempotently if missing.

Domain terms (edition, blurb, publish job, etc.) are defined in [`GLOSSARY.md`](./GLOSSARY.md).

## Tech stack

| Layer | Choice |
| --- | --- |
| App | Next.js (App Router), React, TypeScript |
| API | tRPC + TanStack Query |
| Auth | Better Auth |
| Database | PostgreSQL + Drizzle ORM |
| AI | OpenAI (power-ranking blurbs) |
| UI | Tailwind CSS, shadcn / Base UI |
| Hosting | Vercel (Fluid Compute + Cron) |

Scaffolded with [Create T3 App](https://create.t3.gg/); product code lives under `src/app`, `src/server`, and `src/components`.

## Local development

**Prerequisites:** Node.js 22+, Docker (or Podman) for Postgres, and the env vars below.

```bash
cp .env.example .env
# fill in BETTER_AUTH_SECRET, DATABASE_URL, etc.

./start-database.sh   # local Postgres from DATABASE_URL
npm install
npm run db:push
npm run dev
```

| Script | Purpose |
| --- | --- |
| `npm run dev` | Dev server |
| `npm run build` / `start` | Production build & serve |
| `npm run db:generate` / `db:migrate` / `db:push` / `db:studio` | Drizzle Kit |
| `npm test` | Unit tests (`tsx --test`) |
| `npm run check` | ESLint + TypeScript |

### Environment

See [`.env.example`](./.env.example). Required for a full local run:

- `BETTER_AUTH_URL`, `BETTER_AUTH_SECRET`
- `DATABASE_URL`
- `CRON_SECRET` (cron + mock seed routes)
- `OPENAI_API_KEY` (optional — blurbs skip if unset)
- `AUTH_ALLOWED_EMAILS` (optional invite allowlist)
- Google OAuth client ID/secret (optional)

## Project layout

```
src/app/(dashboard)/     Overview & power rankings (auth-gated)
src/app/api/             Auth, tRPC, cron, ESPN logo proxy
src/server/better-auth/  Auth + invite allowlist
src/server/db/           Schema & client
src/server/api/          tRPC routers
src/server/espn/         ESPN adapter, rankings, blurbs, publish job
src/components/          Dashboards, league picker, brand
test/                    Unit tests for ranking math, cron policy, etc.
```
