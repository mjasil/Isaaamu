-- Run this once Supabase is back up (via connector or SQL Editor)
create table if not exists push_tokens (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users(id) on delete cascade,
  token text not null unique,
  created_at timestamptz default now()
);

alter table push_tokens enable row level security;

create policy "Users can insert own token" on push_tokens
  for insert with check (auth.uid() = user_id);

create policy "Users can view own token" on push_tokens
  for select using (auth.uid() = user_id);

create policy "Admins can view all tokens" on push_tokens
  for select using (public.is_admin());
