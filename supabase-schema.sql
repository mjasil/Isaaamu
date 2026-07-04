-- Run this in Supabase SQL Editor once, before connecting the app.

-- Profiles table, linked 1:1 to Supabase Auth users
create table if not exists profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  username text unique not null,
  role text not null default 'user' check (role in ('user', 'admin')),
  created_at timestamptz default now()
);

-- App-wide content the admin can edit (branding, messages, etc.)
create table if not exists app_content (
  key text primary key,
  value text not null,
  updated_at timestamptz default now()
);

insert into app_content (key, value) values
  ('app_title', 'Isaaamu'),
  ('tagline', 'Small / Big Generator'),
  ('footer_note', 'Random generator · for fun only')
on conflict (key) do nothing;

-- Result history (written by the app, read by users + admin)
create table if not exists result_history (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users(id) on delete cascade,
  result text not null check (result in ('small', 'big')),
  created_at timestamptz default now()
);

-- Row Level Security
alter table profiles enable row level security;
alter table app_content enable row level security;
alter table result_history enable row level security;

-- Profiles: users can read their own row; admins can read/update all
create policy "Users can view own profile" on profiles
  for select using (auth.uid() = id);

create policy "Admins can view all profiles" on profiles
  for select using (
    exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
  );

create policy "Admins can update profiles" on profiles
  for update using (
    exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
  );

-- App content: everyone can read, only admins can write
create policy "Anyone can read app content" on app_content
  for select using (true);

create policy "Admins can update app content" on app_content
  for update using (
    exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
  );

-- Result history: users see their own, admins see all, users can insert their own
create policy "Users can view own history" on result_history
  for select using (auth.uid() = user_id);

create policy "Admins can view all history" on result_history
  for select using (
    exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
  );

create policy "Users can insert own history" on result_history
  for insert with check (auth.uid() = user_id);

-- Auto-create a profile row whenever someone signs up
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, username)
  values (new.id, coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)));
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- To make a user an admin, run this after they sign up once:
-- update profiles set role = 'admin' where username = 'your_username';
