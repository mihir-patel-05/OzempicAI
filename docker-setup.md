# Docker Local Supabase Setup

## Services

| Service | Port | Purpose |
|---|---|---|
| `db` | 5432 | PostgreSQL 15 |
| `auth` | 9999 | GoTrue — sign up, sign in, JWT |
| `rest` | 3000 | PostgREST — auto REST API |
| `realtime` | 4000 | WebSocket live data |
| `storage` | 5000 | File/object storage |
| `kong` | **8000** | API gateway — single entry point for the iOS app |
| `studio` | **3001** | Supabase dashboard UI |
| `meta` | 8080 | pg-meta (used internally by Studio) |

---

## First-Time Setup

**1. Create your `.env`**
```bash
cp supabase/.env.example supabase/.env
```

Fill in `supabase/.env` with real values. For `ANON_KEY` and `SERVICE_ROLE_KEY`, generate them using your `JWT_SECRET` at:
https://supabase.com/docs/guides/self-hosting/docker#generate-api-keys

**2. Start all services**
```bash
docker compose -f supabase/docker-compose.yml up -d
```

Postgres will auto-run `supabase/migrations/00001_init_schema.sql` on the first boot (clean volume only).

**3. Open Studio**

Go to `http://localhost:3001` — full Supabase dashboard running locally.

**4. Update `Constants.swift` for local dev**
```swift
static let projectURL = "http://localhost:8000"
static let anonKey    = "<your ANON_KEY from supabase/.env>"
```

---

## Daily Commands

```bash
# Start
docker compose -f supabase/docker-compose.yml up -d

# Stop (keeps data)
docker compose -f supabase/docker-compose.yml down

# View logs
docker compose -f supabase/docker-compose.yml logs -f

# Logs for a specific service (e.g. auth)
docker compose -f supabase/docker-compose.yml logs -f auth

# Check service status
docker compose -f supabase/docker-compose.yml ps
```

---

## Reset (Wipes All Local Data)

```bash
docker compose -f supabase/docker-compose.yml down -v
docker compose -f supabase/docker-compose.yml up -d
```

The `-v` flag removes the named volumes (`db_data`, `storage_data`). On next boot, Postgres runs the migration SQL from scratch.

---

## Switching Between Local and Cloud

`Constants.swift` is gitignored — edit it freely without affecting commits.

| Environment | `projectURL` | `anonKey` |
|---|---|---|
| Local Docker | `http://localhost:8000` | `ANON_KEY` from `supabase/.env` |
| Supabase Cloud | `https://<ref>.supabase.co` | anon key from Supabase dashboard |

---

## File Reference

| File | Purpose |
|---|---|
| `supabase/docker-compose.yml` | Defines all 8 services |
| `supabase/kong.yml` | API gateway routing config |
| `supabase/.env` | Your secrets — **gitignored, never commit** |
| `supabase/.env.example` | Safe template — committed |
| `supabase/migrations/00001_init_schema.sql` | Full DB schema, auto-runs on first boot |
