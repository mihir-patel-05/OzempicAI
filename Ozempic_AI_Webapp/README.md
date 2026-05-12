# OzempicAI — Mobile Web (PWA)

iPhone-first web companion to the iOS/macOS app. Same Supabase backend, bookmark-to-home-screen install.

## Setup

```bash
cd Ozempic_AI_Webapp
npm install
cp .env.example .env.local   # fill in VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY
npm run dev
```

Open `http://localhost:5173` (or your LAN IP — `--host` is on by default) in mobile Safari to test the PWA flow.

## Build

```bash
npm run build      # tsc + vite build → dist/
npm run preview    # serve dist locally
```

## Deploy

Vercel: connect the repo, set root directory to `Ozempic_AI_Webapp`, and add the two `VITE_SUPABASE_*` env vars in project settings. HTTPS + `Add to Home Screen` on iPhone Safari "just works" once deployed.

## Stack

Vite + React 18 + TypeScript · `@supabase/supabase-js` · `@tanstack/react-query` · `react-router-dom` · `vite-plugin-pwa` (Workbox).

## Theme

Mirrors `OzempicAI/Utilities/Theme.swift`. All tokens live in `src/theme/tokens.css` as CSS variables. Fraunces (display) + Inter (UI) are pulled from Google Fonts in `fonts.css`.
