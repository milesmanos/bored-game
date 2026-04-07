-- ============================================
-- BORED GAME — Stored boredom counts
-- ============================================
-- Store an all-time boredom count on profiles so the home screen counter
-- doesn't depend on recomputing from timestamps every load.
-- The client counts live and syncs at critical moments (toggle off,
-- open leaderboard, page unload).

-- Add column
alter table public.profiles
  add column if not exists boredom_count bigint not null default 0;

-- ============================================
-- Backfill existing users from boredom_toggles
-- ============================================
-- Uses the same timestamp math as get_bored_board('all')
update public.profiles p
set boredom_count = coalesce(sub.total, 0)
from (
  select
    bt.user_id,
    sum(
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
    )::bigint as total
  from public.boredom_toggles bt
  group by bt.user_id
) sub
where p.id = sub.user_id;

-- ============================================
-- RPC: sync_boredom_count
-- ============================================
-- Client calls this to persist the live-counted value.
create or replace function public.sync_boredom_count(count bigint)
returns void as $$
begin
  update public.profiles
  set boredom_count = count
  where id = auth.uid();
end;
$$ language plpgsql security definer;
