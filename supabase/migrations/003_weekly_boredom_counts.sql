-- ============================================
-- BORED GAME — Timestamp-computed boredom counts
-- ============================================
-- Compute boredom counts from timestamps. Zero writes during a session.
-- Normal rate: 1 boredom per 200ms (5/sec)
-- Turbo rate:  1 boredom per 40ms  (25/sec)

-- Add columns to boredom_toggles
alter table public.boredom_toggles
  add column if not exists turbo_started_at timestamptz,
  add column if not exists ended_at timestamptz;

-- ============================================
-- Update toggle_boredom to record ended_at
-- ============================================
create or replace function public.toggle_boredom(turbo_mode boolean default false)
returns public.boredom_toggles as $$
declare
  current_toggle public.boredom_toggles;
  new_toggle public.boredom_toggles;
begin
  select * into current_toggle
  from public.boredom_toggles
  where user_id = auth.uid()
    and is_bored = true
    and expires_at > now()
  order by toggled_at desc
  limit 1;

  if current_toggle.id is not null then
    -- Currently bored → turn it off, record when
    update public.boredom_toggles
    set is_bored = false, ended_at = now()
    where id = current_toggle.id
    returning * into new_toggle;
  else
    -- Not bored → toggle on
    insert into public.boredom_toggles (user_id, is_bored, turbo, expires_at)
    values (auth.uid(), true, turbo_mode, now() + interval '2 hours')
    returning * into new_toggle;
  end if;

  return new_toggle;
end;
$$ language plpgsql security definer;

-- ============================================
-- Drop old view if it exists
-- ============================================
drop view if exists public.bored_board;

-- ============================================
-- RPC: get_bored_board(period)
-- ============================================
-- Returns leaderboard data filtered by time period.
-- period: 'daily', 'weekly', 'monthly', 'yearly', 'all'
create or replace function public.get_bored_board(period text default 'weekly')
returns table (
  user_id uuid,
  display_name text,
  color text,
  total_boredoms int,
  currently_bored boolean
) as $$
declare
  since timestamptz;
begin
  since := case period
    when 'daily'   then date_trunc('day', now())
    when 'weekly'  then date_trunc('week', now())
    when 'monthly' then date_trunc('month', now())
    when 'yearly'  then date_trunc('year', now())
    when 'all'     then '1970-01-01'::timestamptz
    else date_trunc('week', now())
  end;

  return query
  select
    p.id as user_id,
    p.display_name,
    p.color,
    coalesce(sum(
      case
        when bt.turbo_started_at is not null then
          greatest(0, floor(extract(epoch from (bt.turbo_started_at - bt.toggled_at)) * 5))
          +
          greatest(0, floor(extract(epoch from (
            least(
              bt.turbo_started_at + interval '30 minutes',
              case
                when bt.is_bored and bt.expires_at > now() then now()
                when bt.ended_at is not null then bt.ended_at
                else bt.expires_at
              end
            )
            - bt.turbo_started_at
          )) * 25))
          +
          greatest(0,
            case
              when (bt.turbo_started_at + interval '30 minutes') <
                   (case
                      when bt.is_bored and bt.expires_at > now() then now()
                      when bt.ended_at is not null then bt.ended_at
                      else bt.expires_at
                    end)
              then floor(extract(epoch from (
                (case
                   when bt.is_bored and bt.expires_at > now() then now()
                   when bt.ended_at is not null then bt.ended_at
                   else bt.expires_at
                 end)
                - (bt.turbo_started_at + interval '30 minutes')
              )) * 5)
              else 0
            end
          )
        else
          greatest(0, floor(extract(epoch from (
            (case
               when bt.is_bored and bt.expires_at > now() then now()
               when bt.ended_at is not null then bt.ended_at
               else bt.expires_at
             end)
            - bt.toggled_at
          )) * 5))
      end
    ), 0)::int as total_boredoms,
    bool_or(bt.is_bored and bt.expires_at > now()) as currently_bored
  from public.profiles p
  left join public.boredom_toggles bt
    on bt.user_id = p.id
    and bt.toggled_at >= since
  group by p.id, p.display_name, p.color
  order by total_boredoms desc;
end;
$$ language plpgsql security definer;

-- ============================================
-- RPC: set_turbo_started
-- ============================================
create or replace function public.set_turbo_started()
returns void as $$
begin
  update public.boredom_toggles
  set turbo_started_at = now(), turbo = true
  where user_id = auth.uid()
    and is_bored = true
    and expires_at > now()
    and turbo_started_at is null;
end;
$$ language plpgsql security definer;
