-- Row snapshots for the activity feed's Undo (docs/mcp-server-plan.md §4.2).
-- before: the rows a write changed or removed, as they were.
-- after:  the rows it inserted or changed, as it left them.
-- Undo puts `before` back, but only while every row still matches `after`,
-- so it never overwrites a change the user made later. Rows written before
-- this migration have neither and can't be undone.

alter table public.agent_activity
  add column if not exists before jsonb,
  add column if not exists after jsonb;
