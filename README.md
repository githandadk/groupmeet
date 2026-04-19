# Group Tools

A mobile-first suite of lightweight group coordination tools. No accounts, no installs — just shareable links.

## Features

- **Find a Time** — Group availability finder for picking a meeting time across attendees and timezones.
- **Sign-Up Sheet** — Coordinate volunteers/items across one or more days with quantity slots.
- **Potluck** — Crowdsource what people are bringing to a shared meal.
- **Meal Train** — Organize meals for a family or person in need over a recurring schedule.
- **Group Poll** — Quick multiple-choice polls with shareable results.

Each tool produces a unique shareable URL plus an admin URL for the organizer.

## Getting Started

Install dependencies and start the dev server:

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser.

## Environment

Copy the relevant secrets into `.env.local`:

- `NEXT_PUBLIC_SUPABASE_URL` — Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Supabase anon key
- `SUPABASE_SERVICE_ROLE_KEY` — Supabase service-role key (required by server routes)
- `SUPERADMIN_SECRET` — shared secret for the `/superadmin` dashboard. Generate with `openssl rand -hex 32`.

## Tech

- Next.js 14 (App Router)
- Supabase (Postgres + RPC)
- Tailwind CSS

## Deploy

Deploys cleanly on Vercel. Make sure all environment variables above are set in the Vercel project settings.
