-- ============================================
-- BORED GAME — Supabase Schema
-- ============================================

-- Enable UUID generation
create extension if not exists "uuid-ossp";

-- ============================================
-- PROFILES
-- ============================================
-- Each user picks a name and a color. That's it.
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 30),
  color text not null default '#FF6B6B',
  created_at timestamptz not null default now()
);

-- ============================================
-- BOREDOM TOGGLES
-- ============================================
-- A boredom lasts 6 hours, then auto-expires.
-- turbo = faster animation on friends' screens.
create table public.boredom_toggles (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  is_bored boolean not null default true,
  turbo boolean not null default false,
  toggled_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '2 hours')
);

-- Index for quick lookups of active boredoms
create index idx_boredom_active on public.boredom_toggles (user_id, expires_at desc);

-- ============================================
-- FRIENDSHIPS
-- ============================================
-- Bidirectional: when you add someone, they see you too.
-- status: 'pending' | 'accepted'
create table public.friendships (
  id uuid primary key default uuid_generate_v4(),
  requester_id uuid not null references public.profiles(id) on delete cascade,
  addressee_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at timestamptz not null default now(),
  -- prevent duplicate friend requests
  unique (requester_id, addressee_id),
  -- can't friend yourself
  check (requester_id != addressee_id)
);

create index idx_friendships_addressee on public.friendships (addressee_id, status);
create index idx_friendships_requester on public.friendships (requester_id, status);

-- ============================================
-- BORED BOARD (leaderboard view)
-- ============================================
-- Counts total boredom toggles per user. This is a view, not a table,
-- so it's always up to date with no extra maintenance.
create view public.bored_board as
select
  p.id as user_id,
  p.display_name,
  p.color,
  count(bt.id)::int as total_boredoms,
  -- also track if they're currently bored
  bool_or(bt.is_bored and bt.expires_at > now()) as currently_bored
from public.profiles p
left join public.boredom_toggles bt on bt.user_id = p.id
group by p.id, p.display_name, p.color
order by total_boredoms desc;

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================
alter table public.profiles enable row level security;
alter table public.boredom_toggles enable row level security;
alter table public.friendships enable row level security;

-- Profiles: anyone can read, only you can update yours
create policy "Profiles are viewable by everyone"
  on public.profiles for select using (true);

create policy "Users can update own profile"
  on public.profiles for update using (auth.uid() = id);

create policy "Users can insert own profile"
  on public.profiles for insert with check (auth.uid() = id);

-- Boredom toggles: friends can see yours, only you can create
create policy "Boredom visible to friends"
  on public.boredom_toggles for select using (
    user_id = auth.uid()
    or exists (
      select 1 from public.friendships f
      where f.status = 'accepted'
      and (
        (f.requester_id = auth.uid() and f.addressee_id = boredom_toggles.user_id)
        or (f.addressee_id = auth.uid() and f.requester_id = boredom_toggles.user_id)
      )
    )
  );

create policy "Users can insert own boredom"
  on public.boredom_toggles for insert with check (auth.uid() = user_id);

create policy "Users can update own boredom"
  on public.boredom_toggles for update using (auth.uid() = user_id);

-- Friendships: you can see your own, create requests, update if you're the addressee
create policy "Users see own friendships"
  on public.friendships for select using (
    auth.uid() = requester_id or auth.uid() = addressee_id
  );

create policy "Users can send friend requests"
  on public.friendships for insert with check (auth.uid() = requester_id);

create policy "Addressee can accept/reject"
  on public.friendships for update using (auth.uid() = addressee_id);

create policy "Either party can unfriend"
  on public.friendships for delete using (
    auth.uid() = requester_id or auth.uid() = addressee_id
  );

-- ============================================
-- REALTIME
-- ============================================
-- Enable realtime subscriptions on the tables that matter
alter publication supabase_realtime add table public.boredom_toggles;
alter publication supabase_realtime add table public.friendships;

-- ============================================
-- HELPER FUNCTION: Toggle boredom
-- ============================================
-- Call this from the client. It inserts a new toggle
-- and returns the new state.
create or replace function public.toggle_boredom(turbo_mode boolean default false)
returns public.boredom_toggles as $$
declare
  current_toggle public.boredom_toggles;
  new_toggle public.boredom_toggles;
begin
  -- Check if user is currently bored (has active non-expired toggle)
  select * into current_toggle
  from public.boredom_toggles
  where user_id = auth.uid()
    and is_bored = true
    and expires_at > now()
  order by toggled_at desc
  limit 1;

  if current_toggle.id is not null then
    -- Currently bored → turn it off
    update public.boredom_toggles
    set is_bored = false
    where id = current_toggle.id
    returning * into new_toggle;
  else
    -- Not bored → toggle on, create new record
    insert into public.boredom_toggles (user_id, is_bored, turbo, expires_at)
    values (auth.uid(), true, turbo_mode, now() + interval '2 hours')
    returning * into new_toggle;
  end if;

  return new_toggle;
end;
$$ language plpgsql security definer;
