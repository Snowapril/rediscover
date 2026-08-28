-- Deleting a folder takes its contents with it.
--
-- Child folders already go, because collections.parent_id cascades. Their scraps
-- did not: the items foreign key only detached them, so emptying a folder tree
-- left its scraps behind in the inbox. Scraps are trashed rather than destroyed,
-- matching what the delete control on a single scrap does, so they stay
-- recoverable and their URLs stay free to scrap again.

create function collections_trash_items() returns trigger
  language plpgsql
  as $$
  begin
    update items
      set deleted_at = now()
      where collection_id = old.id and deleted_at is null;
    return old;
  end;
  $$;

-- Row triggers fire for cascaded deletes too, so removing a folder high in the
-- tree trashes the scraps of every folder beneath it.
create trigger collections_trash_items before delete on collections
  for each row execute function collections_trash_items();
