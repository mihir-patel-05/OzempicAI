-- OAuth 2.1 authorization server for the MCP endpoint (docs/mcp-server-plan.md).
--
-- These live in the auth schema next to auth.sessions: only the API, connecting
-- as the database owner, reads them. The `authenticated` role has no grants
-- here, so tool code running under row level security can never see a token.
-- Secrets, codes and tokens are stored only as sha256 hashes.

-- Apps that registered themselves through Dynamic Client Registration (RFC 7591).
create table if not exists auth.oauth_clients (
  client_id                  text primary key,
  client_secret_hash         text,
  client_name                text not null,
  redirect_uris              text[] not null,
  token_endpoint_auth_method text not null
    check (token_endpoint_auth_method in ('none', 'client_secret_post', 'client_secret_basic')),
  created_at                 timestamptz not null default now(),
  check ((token_endpoint_auth_method = 'none') = (client_secret_hash is null))
);

-- One connection between a user and an app. Profile → Connected AI apps lists
-- these, and Disconnect revokes one (and with it every token it issued).
create table if not exists auth.oauth_grants (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  client_id    text not null references auth.oauth_clients(client_id) on delete cascade,
  scopes       text[] not null,
  resource     text not null,
  created_at   timestamptz not null default now(),
  last_used_at timestamptz,
  -- Pushed forward on every refresh; the connection lapses when it passes.
  expires_at   timestamptz not null,
  revoked_at   timestamptz
);
create index if not exists oauth_grants_user_idx on auth.oauth_grants (user_id);

-- Single-use authorization codes, bound to the client, redirect URI, PKCE
-- challenge and resource they were issued for.
create table if not exists auth.oauth_codes (
  code_hash      text primary key,
  client_id      text not null references auth.oauth_clients(client_id) on delete cascade,
  user_id        uuid not null references auth.users(id) on delete cascade,
  redirect_uri   text not null,
  scopes         text[] not null,
  code_challenge text not null,
  resource       text not null,
  expires_at     timestamptz not null,
  used_at        timestamptz,
  -- The connection the code was exchanged for, so a replayed code can revoke it.
  grant_id       uuid references auth.oauth_grants(id) on delete cascade,
  created_at     timestamptz not null default now()
);

-- Access and refresh tokens. A refresh token is rotated (rotated_at) when it
-- is used; presenting it again later revokes the whole connection.
create table if not exists auth.oauth_tokens (
  token_hash text primary key,
  grant_id   uuid not null references auth.oauth_grants(id) on delete cascade,
  kind       text not null check (kind in ('access', 'refresh')),
  expires_at timestamptz not null,
  rotated_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists oauth_tokens_grant_idx on auth.oauth_tokens (grant_id);
