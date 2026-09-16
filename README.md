# OzempicAI

Personal health & fitness tracker. Delivered as an installable PWA — bookmark it to your iPhone home screen and it opens full-screen.

The web app includes email/password authentication, password recovery, a daily dashboard,
calorie/meal tracking, water, exercise, weight and heart-rate logs, meal planning, groceries,
and editable personal goals. Every user-owned table is protected with Supabase Row Level Security.

Vite + React 18 + TypeScript · `@supabase/supabase-js` · `@tanstack/react-query` · `react-router-dom` · `vite-plugin-pwa` (Workbox).

## Setup

```bash
npm install
cp .env.example .env.local   # fill in VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY
npm run dev
```

Open `http://localhost:5173` (or your LAN IP — `--host` is on) in mobile Safari to test the PWA flow.

## Build

```bash
npm run build      # tsc + vite build → dist/
npm run preview    # serve dist locally
npm run typecheck  # tsc --noEmit
```

## Deploy

### Vercel (primary)

Static hosting on Vercel, auto-deploying on push to `main`. Build settings live in
`vercel.json` (framework preset `vite`, build `npm run build`, output `dist`), which also
handles the SPA fallback rewrite (`react-router-dom` uses `BrowserRouter`, so deep links must
resolve to `/index.html`) and the PWA cache headers (hashed `/assets/**` are immutable; the
service-worker/manifest entry points are `no-store` so clients always pick up new deploys).

One-time setup:

1. Vercel → Add New → Project → import this repo. The framework preset, build command,
   output directory, and rewrites are picked up from `vercel.json`; leave the root directory as
   the repo root.
2. Project → Settings → Environment Variables: add `VITE_SUPABASE_URL` and
   `VITE_SUPABASE_ANON_KEY` (all environments). Vite inlines these at build time, so they must
   be set before the first build; a build without them fails fast (`src/lib/supabase.ts`
   throws), so redeploy after adding them.
3. In Supabase → Authentication → URL Configuration, set Site URL to the deployed origin and
   add it (plus any preview domains) to Additional Redirect URLs, or signup confirmation emails
   will point at the old host.

HTTPS + Add-to-Home-Screen on iPhone Safari works once deployed.

Prefer the CLI? `npm i -g vercel`, then `vercel` (preview) or `vercel --prod`.

### AWS Amplify (alternative)

`amplify.yml` is kept for AWS Amplify Hosting. It is plain static hosting, not Amplify Gen 2 —
there is no `ampx` backend, since Supabase is the backend. Set the same two env vars under
Advanced settings and add a `200 (Rewrite)` to `/index.html` for deep links:

```
</^[^.]+$|\.(?!(css|gif|ico|jpg|js|png|txt|svg|woff|woff2|ttf|map|json|webmanifest)$)([^.]+$)/>
```

## Backend

Supabase. Hosted project for prod; the optional local Docker stack in `supabase/docker-compose.yml` mirrors it. Schema lives in `supabase/migrations/`.

For a new hosted project, link the Supabase CLI and apply all ordered migrations:

```bash
supabase link --project-ref your-project-ref
supabase db push
```

Then configure Authentication → URL Configuration with the production Site URL and any
Vercel preview origins. Email/password signups can require confirmation; when enabled, the
login screen tells new users to check their inbox. The auth trigger creates the matching
`public.users` profile as soon as an account is created.

Before release, verify:

- `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` exist in every Vercel environment.
- The migrations are applied, including `weight_logs`, the auth profile trigger, and indexes.
- Supabase Site URL and Redirect URLs include production and preview origins.
- A newly created account can add and delete an entry in each tracker without seeing another user's data.

## Theme

Design tokens in `src/theme/tokens.css`. Fraunces (display) + Inter (UI) via Google Fonts in `fonts.css`.

## Migration status

The Swift iOS/macOS targets were retired; see `web-migration-plan.md` for the phased plan to reach full parity in this webapp.
