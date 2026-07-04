-- Fixes "infinite recursion detected in policy for relation profiles"
-- Run this once in SQL Editor.

-- A SECURITY DEFINER function bypasses RLS internally, so checking
-- "is this user an admin" no longer re-triggers the policies on profiles.
create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1 from public.profiles where id = auth.uid() and role = 'admin'
  );
$$;

-- Replace the old recursive policies with ones that use the function instead
drop policy if exists "Admins can view all profiles" on profiles;
create policy "Admins can view all profiles" on profiles
  for select using (public.is_admin());

drop policy if exists "Admins can update profiles" on profiles;
create policy "Admins can update profiles" on profiles
  for update using (public.is_admin());

drop policy if exists "Admins can update app content" on app_content;
create policy "Admins can update app content" on app_content
  for update using (public.is_admin());

drop policy if exists "Admins can view all history" on result_history;
create policy "Admins can view all history" on result_history
  for select using (public.is_admin());

-- Allow admins to INSERT new app_content rows too (not just update existing ones),
-- needed for new settings like fixed_link that don't exist yet.
drop policy if exists "Admins can insert app content" on app_content;
create policy "Admins can insert app content" on app_content
  for insert with check (public.is_admin());
