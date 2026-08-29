-- Merging one folder into another.
--
-- Three steps that must not be separable: the scraps move, the subfolders move,
-- and the emptied folder is deleted. Run apart, a failure between them leaves a
-- half-merged tree — and worse, deleting a folder that still holds scraps sends
-- them to the trash, so a merge that failed at the wrong moment would look like
-- data loss. As one function it is one transaction.
--
-- SECURITY INVOKER, so row level security applies with the caller's rights: a
-- folder belonging to someone else is not visible, and the guards below report
-- it as missing rather than acting on it.

create function merge_collection(source_id uuid, target_id uuid) returns void
  language plpgsql
  security invoker
  set search_path = ''
  as $$
  declare
    base double precision;
  begin
    if source_id = target_id then
      raise exception 'a folder cannot be merged into itself';
    end if;

    if not exists (select 1 from public.collections where id = source_id) then
      raise exception 'no such folder: %', source_id;
    end if;

    if not exists (select 1 from public.collections where id = target_id) then
      raise exception 'no such folder: %', target_id;
    end if;

    -- Merging into one's own subfolder would leave that subfolder as its own
    -- ancestor once the source is gone.
    if exists (
      with recursive descendants as (
        select id from public.collections where id = source_id
        union all
        select c.id from public.collections c join descendants d on c.parent_id = d.id
      )
      select 1 from descendants where id = target_id
    ) then
      raise exception 'a folder cannot be merged into one of its own subfolders';
    end if;

    update public.items
      set collection_id = target_id
      where collection_id = source_id;

    -- Arriving subfolders are placed after the ones already there, keeping the
    -- order they had among themselves.
    select coalesce(max(position), -1) + 1 into base
      from public.collections where parent_id = target_id;

    update public.collections c
      set parent_id = target_id, position = base + arriving.slot
      from (
        select id, (row_number() over (order by position, name, id) - 1)::double precision as slot
        from public.collections where parent_id = source_id
      ) arriving
      where c.id = arriving.id;

    delete from public.collections where id = source_id;
  end;
  $$;

grant execute on function merge_collection(uuid, uuid) to authenticated;
