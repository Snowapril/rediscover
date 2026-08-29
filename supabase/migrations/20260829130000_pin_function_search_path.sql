-- Pin the search path of the trigger functions.
--
-- Neither set one, so both resolved table names against whatever search path the
-- statement that fired them happened to be running under. Called from a function
-- that pins its own path — as merge_collection does, and as any hardened
-- function should — they failed with "relation does not exist". A function whose
-- behaviour depends on its caller's search path is also the shape that search
-- path injection exploits, so the fix is the same either way: pin it, and name
-- the schema.

create or replace function collections_reject_cycle() returns trigger
  language plpgsql
  set search_path = ''
  as $$
  declare
    ancestor uuid := new.parent_id;
    hops integer := 0;
  begin
    while ancestor is not null loop
      if ancestor = new.id then
        raise exception 'collection % may not be its own ancestor', new.id;
      end if;
      hops := hops + 1;
      if hops > 100 then
        raise exception 'collection tree deeper than 100 levels';
      end if;
      select parent_id into ancestor from public.collections where id = ancestor;
    end loop;
    return new;
  end;
  $$;

create or replace function collections_trash_items() returns trigger
  language plpgsql
  set search_path = ''
  as $$
  begin
    update public.items
      set deleted_at = now()
      where collection_id = old.id and deleted_at is null;
    return old;
  end;
  $$;

create or replace function touch_updated_at() returns trigger
  language plpgsql
  set search_path = ''
  as $$
  begin
    new.updated_at := now();
    return new;
  end;
  $$;
