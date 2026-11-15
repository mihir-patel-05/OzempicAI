-- The user's IANA timezone (e.g. 'America/New_York'), saved by the web app and
-- the coach. MCP clients don't send one, so their tools read it from here to
-- know what "today" is (docs/mcp-server-plan.md). Null means unknown (UTC).

alter table public.users add column if not exists timezone text;
