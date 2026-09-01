-- A nudge about something forgotten.
--
-- Reminders only fire on scraps somebody thought to set one on, and nobody sets
-- a reminder on the thing they have forgotten. The library this was written
-- against holds 281 unread scraps, 251 of them over a year old, and not one
-- reminder — which is not a gap in the feature so much as a description of the
-- problem.
--
-- The obvious version of this is a disaster: a notification per forgotten scrap
-- is 279 notifications, and the reader would turn the whole thing off within a
-- minute. So the budget is fixed rather than proportional. One scrap, once a
-- week, no matter how large the backlog. The nudge's job is to bring somebody
-- back, not to enumerate what they are behind on — the Today list does the
-- enumerating, once they are here.
--
-- Off unless asked for. A reminder was requested for a particular scrap; this
-- was not requested at all, and sending it uninvited is how a useful nudge
-- becomes something to be silenced.

alter table profiles
  add column nudge_enabled boolean not null default false,
  add column last_nudged_at timestamptz;

-- When this scrap was last put forward, so the same one is not raised week after
-- week while the rest of the library stays buried.
alter table items add column nudged_at timestamptz;

create index items_nudge_candidates_idx
  on items (user_id, nudged_at nulls first, created_at)
  where deleted_at is null and read_state <> 'read';

/*
 * Picks one forgotten scrap for a person and records that it was raised, in one
 * statement so a second call cannot pick the same one before the first has
 * finished sending.
 *
 * Returns nothing when they have not asked for nudges, have been nudged
 * recently, or have nothing old enough to be worth raising.
 */
create function claim_nudge(
  p_user uuid,
  stale_after interval default interval '30 days',
  cooldown interval default interval '7 days'
) returns setof items
  language plpgsql
  security definer
  set search_path = ''
  as $$
  declare
    chosen public.items;
  begin
    perform 1
       from public.profiles
      where id = p_user
        and nudge_enabled
        and (last_nudged_at is null or last_nudged_at < now() - cooldown);
    if not found then
      return;
    end if;

    -- Never raised beats raised long ago, and among equals the one that has been
    -- waiting longest — the scrap closest to never being read at all.
    select * into chosen
      from public.items
     where user_id = p_user
       and deleted_at is null
       and read_state <> 'read'
       and created_at < now() - stale_after
       and (nudged_at is null or nudged_at < now() - interval '90 days')
     order by nudged_at nulls first, created_at
     limit 1;

    if not found then
      return;
    end if;

    update public.items set nudged_at = now() where id = chosen.id;
    update public.profiles set last_nudged_at = now() where id = p_user;

    return query select * from public.items where id = chosen.id;
  end;
  $$;

revoke execute on function claim_nudge(uuid, interval, interval) from public, anon, authenticated;
grant execute on function claim_nudge(uuid, interval, interval) to service_role;
