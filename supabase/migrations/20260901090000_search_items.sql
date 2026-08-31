-- Finding a scrap again.
--
-- Two ways of matching, because neither is enough alone.
--
-- Full text search ranks well and knows that a word in a title matters more
-- than the same word in an address. It tokenises on whitespace and punctuation,
-- which suits English and suits Korean written with spaces between words — but
-- Korean attaches particles, so a search for 코드 finds "코드 작성" and misses
-- "코드를". That is not an occasional gap; it is most searches somebody would
-- actually type.
--
-- So a plain substring match runs alongside it, which has no idea what a word is
-- and therefore cannot be defeated by one. It contributes nothing to ranking; it
-- is there so that what was typed is found at all.
--
-- The 'simple' configuration is deliberate over 'english'. Stemming would help
-- English a little and would mangle everything else, and this library is already
-- both.

alter table items
  add column search_text tsvector generated always as (
    setweight(to_tsvector('simple', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(note, '')), 'B') ||
    setweight(to_tsvector('simple', coalesce(excerpt, '')), 'C') ||
    setweight(to_tsvector('simple', coalesce(site_name, '') || ' ' || domain), 'D')
  ) stored,
  add column search_plain text generated always as (
    lower(
      coalesce(title, '') || ' ' || coalesce(note, '') || ' ' ||
      coalesce(excerpt, '') || ' ' || coalesce(site_name, '') || ' ' || domain || ' ' || url
    )
  ) stored;

create index items_search_idx on items using gin (search_text);

-- Trigrams make the substring half fast. Where the extension is unavailable the
-- search still works and simply scans, which at the size a person's own library
-- reaches is not worth refusing to start over.
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_trgm') then
    execute 'create extension if not exists pg_trgm';
    execute 'create index items_search_plain_idx on items using gin (search_plain gin_trgm_ops)';
  end if;
end;
$$;

/*
 * Finds a person's scraps. SECURITY INVOKER, so row level security decides whose
 * — a search that could see another account's library would be a worse failure
 * than one that finds nothing.
 */
create function search_items(query text, max_results integer default 50)
  returns setof items
  language sql
  stable
  security invoker
  set search_path = ''
  as $$
    with asked as (
      select
        nullif(btrim(query), '') as text,
        websearch_to_tsquery('simple', coalesce(nullif(btrim(query), ''), 'zzzznomatch')) as terms,
        -- Escaped, so a query containing % or _ searches for those characters
        -- rather than turning into a wildcard.
        '%' || replace(replace(replace(lower(btrim(query)), '\', '\\'), '%', '\%'), '_', '\_') || '%'
          as pattern
    )
    select i.*
      from public.items i, asked a
     where a.text is not null
       and i.deleted_at is null
       and (i.search_text @@ a.terms or i.search_plain like a.pattern escape '\')
     order by
       ts_rank(i.search_text, a.terms) desc,
       i.created_at desc
     limit greatest(1, least(max_results, 200));
  $$;

grant execute on function search_items(text, integer) to authenticated;
