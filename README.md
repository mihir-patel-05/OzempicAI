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

Vercel — connect the repo, set root directory to `.` (was `Ozempic_AI_Webapp` before the migration), add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in project env vars. HTTPS + Add-to-Home-Screen on iPhone Safari works once deployed.

## Backend

Supabase. Hosted project for prod; the optional local Docker stack in `supabase/docker-compose.yml` mirrors it. Schema lives in `supabase/migrations/`.

## Theme

Design tokens in `src/theme/tokens.css`. Fraunces (display) + Inter (UI) via Google Fonts in `fonts.css`.

## Migration status

The Swift iOS/macOS targets were retired; see `web-migration-plan.md` for the phased plan to reach full parity in this webapp.
