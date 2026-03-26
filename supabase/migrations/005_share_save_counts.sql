-- ============================================================
-- 005: Add share tracking + save/share counts on posts
-- ============================================================

-- ──────────────────────────────────────────
-- SHARES table (tracks each share action)
-- ──────────────────────────────────────────
create table public.shares (
  id         uuid default uuid_generate_v4() primary key,
  user_id    uuid references public.profiles(id) on delete cascade,
  post_id    uuid references public.posts(id) on delete cascade not null,
  created_at timestamptz not null default now()
);

create index shares_post_idx on public.shares (post_id);
create index shares_user_idx on public.shares (user_id, created_at desc);

-- RLS
alter table public.shares enable row level security;

create policy "Anyone can view share counts"
  on public.shares for select
  using (true);

create policy "Authenticated users can insert shares"
  on public.shares for insert
  with check (auth.uid() = user_id);

-- ──────────────────────────────────────────
-- Add count columns to posts
-- ──────────────────────────────────────────
alter table public.posts
  add column save_count  integer not null default 0,
  add column share_count integer not null default 0;

-- ──────────────────────────────────────────
-- Triggers to maintain counts
-- ──────────────────────────────────────────

-- Save count: increment on insert, decrement on delete
create or replace function public.update_save_count()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if TG_OP = 'INSERT' then
    update public.posts
    set save_count = save_count + 1
    where id = NEW.post_id;
    return NEW;
  elsif TG_OP = 'DELETE' then
    update public.posts
    set save_count = greatest(save_count - 1, 0)
    where id = OLD.post_id;
    return OLD;
  end if;
  return null;
end;
$$;

create trigger on_save_inserted
  after insert on public.saves
  for each row execute function public.update_save_count();

create trigger on_save_deleted
  after delete on public.saves
  for each row execute function public.update_save_count();

-- Share count: increment on insert
create or replace function public.update_share_count()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  update public.posts
  set share_count = share_count + 1
  where id = NEW.post_id;
  return NEW;
end;
$$;

create trigger on_share_inserted
  after insert on public.shares
  for each row execute function public.update_share_count();

-- ──────────────────────────────────────────
-- Backfill existing save counts
-- ──────────────────────────────────────────
update public.posts p
set save_count = (
  select count(*) from public.saves s where s.post_id = p.id
);
