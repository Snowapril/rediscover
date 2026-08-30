-- Folders can be pinned to the top.
--
-- A timestamp rather than a flag: it says when, which gives the shelf a stable
-- order for free. Ordering pinned folders by name or position would reshuffle
-- them whenever one is renamed or moved, and the shelf is exactly the place a
-- person builds muscle memory about.

alter table collections add column pinned_at timestamptz;

-- The shelf is read on every render of the sidebar, and is almost always a
-- handful of rows out of many.
create index collections_pinned_idx
  on collections (user_id, pinned_at) where pinned_at is not null;
