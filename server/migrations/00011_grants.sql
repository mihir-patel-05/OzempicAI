-- Belt and braces for the default privileges set in 00000_platform.sql: make
-- sure every application table is reachable by `authenticated`, with row level
-- security deciding which rows. Rerun-safe.
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;
