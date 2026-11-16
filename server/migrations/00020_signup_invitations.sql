-- Only the database owner may issue invitations. No browser/API role can
-- read or mint them, and tokens are stored only as SHA-256 hashes.
create table auth.signup_invitations (
  token_hash text primary key,
  email text not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  used_at timestamptz
);
create index signup_invitations_expiry_idx on auth.signup_invitations(expires_at);
revoke all on auth.signup_invitations from public, anon, authenticated;
