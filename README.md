# OzempicAI

Personal health & fitness tracker. Delivered as an installable PWA — bookmark it to your iPhone home screen and it opens full-screen.

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

AWS Amplify Hosting, auto-deploying on push to `main`. Build settings live in `amplify.yml`; this is plain static hosting, not Amplify Gen 2 — there is no `ampx` backend, since Supabase is the backend.

One-time console setup:

1. Amplify → Create new app → GitHub → this repo, branch `main`. Leave the monorepo/app-root setting **empty** — the app lives at the repo root.
2. Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` under Advanced settings. Vite inlines these at build time, so they must be set before the first build; a build without them serves a blank page.
3. Hosting → Rewrites and redirects → add a `200 (Rewrite)` to `/index.html` so deep links resolve:

   ```
   </^[^.]+$|\.(?!(css|gif|ico|jpg|js|png|txt|svg|woff|woff2|ttf|map|json|webmanifest)$)([^.]+$)/>
   ```

4. In Supabase → Authentication → URL Configuration, set Site URL to the deployed origin and add it to Additional Redirect URLs, or signup confirmation emails will point at the old host.

HTTPS + Add-to-Home-Screen on iPhone Safari works once deployed.

## Backend

Supabase. Hosted project for prod; the optional local Docker stack in `supabase/docker-compose.yml` mirrors it. Schema lives in `supabase/migrations/`.

## Theme

Design tokens in `src/theme/tokens.css`. Fraunces (display) + Inter (UI) via Google Fonts in `fonts.css`.

## Migration status

The Swift iOS/macOS targets were retired; see `web-migration-plan.md` for the phased plan to reach full parity in this webapp.
