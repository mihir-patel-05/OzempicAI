-- AI coach conversations (docs/ai-coach-integration-plan.md §3.2).
--
-- ai_messages.content holds the exact Anthropic content blocks for each turn,
-- including thinking and tool blocks. They are sent back to the API unchanged
-- and append-only, so rows are never edited; a new chat is a new conversation.

create table if not exists public.ai_conversations (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.users(id) on delete cascade,
  title       text not null default 'New chat',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  -- Target of ai_messages' composite foreign key below.
  unique (id, user_id)
);

create table if not exists public.ai_messages (
  id                uuid primary key default gen_random_uuid(),
  conversation_id   uuid not null,
  user_id           uuid not null references public.users(id) on delete cascade,
  position          int  not null,
  role              text not null check (role in ('user', 'assistant', 'system')),
  content           jsonb not null,
  input_tokens      int,
  output_tokens     int,
  cache_read_tokens int,
  created_at        timestamptz not null default now(),
  unique (conversation_id, position),
  -- A message's owner must be its conversation's owner. Foreign key checks
  -- ignore row level security, so without this a user could attach a row to
  -- someone else's conversation under their own user_id.
  foreign key (conversation_id, user_id)
    references public.ai_conversations (id, user_id) on delete cascade
);

create index if not exists ai_conversations_user_idx
  on public.ai_conversations (user_id, updated_at desc);
create index if not exists ai_messages_user_idx
  on public.ai_messages (user_id);

alter table public.ai_conversations enable row level security;
alter table public.ai_messages      enable row level security;

drop policy if exists "ai_conversations: own" on public.ai_conversations;
drop policy if exists "ai_messages: own"      on public.ai_messages;
create policy "ai_conversations: own" on public.ai_conversations
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "ai_messages: own" on public.ai_messages
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

grant select, insert, update, delete on public.ai_conversations, public.ai_messages to authenticated;
