-- Searching with something other than words.
--
-- "Unread, in Reading, saved before July" is a search somebody would make with
-- no text in it at all, and the first version of this refused it: a blank query
-- returned nothing. So text is now one input among several, and a search runs as
-- long as *something* narrows it. What is still refused is a search that narrows
-- nothing — asking for everything is browsing, and the folder views already do
-- that better than a result list can.
--
-- Scope is a kind plus an id rather than a nullable id, because a null folder
-- already means the inbox everywhere else in this schema, and "the inbox" and
-- "anywhere" are different questions.

drop function if exists search_items(text, integer);

create function search_items(
  query text default '',
  scope text default 'all',
  collection uuid default null,
  include_subfolders boolean default false,
  states read_state[] default null,
  kinds media_type[] default null,
  flagged_only boolean default false,
  saved_after timestamptz default null,
  saved_before timestamptz default null,
  max_results integer default 50
)
  returns setof items
  language sql
  stable
  security invoker
  set search_path = ''
  as $$
    with recursive
    asked as (
      select
        nullif(btrim(query), '') as text,
        websearch_to_tsquery('simple', coalesce(nullif(btrim(query), ''), 'zzzznomatch')) as terms,
        '%' || replace(replace(replace(lower(btrim(query)), '\', '\\'), '%', '\%'), '_', '\_') || '%'
          as pattern
    ),
    -- The folder itself, then everything filed beneath it. Walked here rather
    -- than in the client because the client would need the whole tree to work it
    -- out, and the answer is one column.
    scope_folders as (
      select c.id from public.collections c where include_subfolders and c.id = collection
      union all
      select c.id
        from public.collections c
        join scope_folders s on c.parent_id = s.id
    )
    select i.*
      from public.items i, asked a
     where i.deleted_at is null
       -- Something has to narrow it. Text, a folder, a state, a kind, a flag or
       -- a date will do; nothing at all will not.
       and (
         a.text is not null
         or scope <> 'all'
         or states is not null
         or kinds is not null
         or flagged_only
         or saved_after is not null
         or saved_before is not null
       )
       and (
         a.text is null
         or i.search_text @@ a.terms
         or i.search_plain like a.pattern escape '\'
       )
       and (
         scope = 'all'
         or (scope = 'inbox' and i.collection_id is null)
         or (
           scope = 'folder'
           and (
             i.collection_id = collection
             or (include_subfolders and i.collection_id in (select id from scope_folders))
           )
         )
       )
       and (states is null or i.read_state = any (states))
       and (kinds is null or i.media_type = any (kinds))
       and (not flagged_only or i.is_important)
       and (saved_after is null or i.created_at >= saved_after)
       and (saved_before is null or i.created_at < saved_before)
     order by
       -- Relevance only means something when words were given; otherwise the
       -- most recently saved is the useful order.
       case when a.text is null then 0 else ts_rank(i.search_text, a.terms) end desc,
       i.created_at desc
     limit greatest(1, least(max_results, 200));
  $$;

grant execute on function search_items(
  text, text, uuid, boolean, read_state[], media_type[], boolean, timestamptz, timestamptz, integer
) to authenticated;
