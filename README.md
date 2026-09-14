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

Vercel hosts the Vite frontend; Supabase remains the backend. The committed
`vercel.json` selects Vite, publishes `dist/`, preserves client-side routes on
page refresh, and applies safe caching rules for the PWA service worker.

### First deployment

1. Import this repository into Vercel and leave **Root Directory** set to `.`.
2. In **Project Settings → Environment Variables**, add these variables for
   Production and Preview:

   ```text
   VITE_SUPABASE_URL=https://cinvzxkbnntgeygvuhod.supabase.co
   VITE_SUPABASE_ANON_KEY=your-public-anon-or-publishable-key
   ```

   These values are intentionally exposed to the browser. Use only a Supabase
   publishable key or legacy `anon` key—never a secret or `service_role` key.
   The build fails with a clear error when either value is missing.
3. Deploy. Vercel reads the build and routing configuration from `vercel.json`.
4. In **Supabase → Authentication → URL Configuration**:

   - Set **Site URL** to the final Vercel production origin.
   - Add the production origin and `https://*-<team-or-account-slug>.vercel.app/**`
     to **Additional Redirect URLs** if signup should also work on previews.
   - Keep `http://localhost:5173/**` in the redirect list for local development.

The app passes its current origin to Supabase when a user signs up, so confirmation
emails return to the deployment where signup began. Supabase must allow that origin.

### CLI deployment

After the Vercel project and environment variables are configured:

```bash
vercel deploy       # preview
vercel deploy --prod
```

HTTPS + Add-to-Home-Screen on iPhone Safari works once deployed.

## Backend

Supabase. Hosted project for prod; the optional local Docker stack in `supabase/docker-compose.yml` mirrors it. Schema lives in `supabase/migrations/`, applied in filename order — the directory is mounted at `/docker-entrypoint-initdb.d`, so a clean `docker compose up` reproduces the full schema.

The hosted project predates the repository migration history. Treat these files as the
reproducible schema for new environments; do not replay the entire directory against production.
Verify production with schema inspection or `supabase db diff`, and add forward-only migrations
for future changes.

## Theme

Design tokens in `src/theme/tokens.css`. Fraunces (display) + Inter (UI) via Google Fonts in `fonts.css`.

## Migration status

The Swift iOS/macOS targets were retired; see `web-migration-plan.md` for the phased plan to reach full parity in this webapp.
