-- Run this in Supabase → SQL Editor → New query → Run
-- Project: https://hqzxlitlibxltvsrqhnj.supabase.co

-- Demo profile per authenticated user
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  demo_balance numeric not null default 25000,
  portfolio_config jsonb,
  updated_at timestamptz not null default now()
);

-- Holdings in demo portfolio (one row per asset)
create table if not exists public.portfolio_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  asset_id text not null,
  asset_data jsonb not null,
  created_at timestamptz not null default now(),
  unique (user_id, asset_id)
);

alter table public.profiles enable row level security;
alter table public.portfolio_items enable row level security;

create policy "profiles_select_own"
  on public.profiles for select
  using (auth.uid() = id);

create policy "profiles_insert_own"
  on public.profiles for insert
  with check (auth.uid() = id);

create policy "profiles_update_own"
  on public.profiles for update
  using (auth.uid() = id);

create policy "portfolio_select_own"
  on public.portfolio_items for select
  using (auth.uid() = user_id);

create policy "portfolio_insert_own"
  on public.portfolio_items for insert
  with check (auth.uid() = user_id);

create policy "portfolio_update_own"
  on public.portfolio_items for update
  using (auth.uid() = user_id);

create policy "portfolio_delete_own"
  on public.portfolio_items for delete
  using (auth.uid() = user_id);

-- Auto-create profile when a user signs up
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, demo_balance, portfolio_config)
  values (new.id, new.email, 25000, null)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
