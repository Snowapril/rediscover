-- Let the inbox have views too.
--
-- A view was tied to a folder, which left the one place every scrap lands first
-- as the one place that could not be sorted or grouped. A null collection means
-- the inbox, the same way it does on items.
--
-- The composite foreign key stays: with MATCH SIMPLE, a row whose collection_id
-- is null satisfies it without being checked, so an inbox view is allowed while
-- a view naming a folder is still held to that folder belonging to the same
-- user.

alter table views alter column collection_id drop not null;

-- One name per folder, so the tabs cannot end up with two views called the same
-- thing. Partial and expression-based because null collection_id would
-- otherwise never collide with itself.
create unique index views_unique_name
  on views (user_id, coalesce(collection_id, '00000000-0000-0000-0000-000000000000'::uuid), lower(name));
