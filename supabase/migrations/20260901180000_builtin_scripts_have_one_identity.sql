-- Give the built-in scripts a stable identity, and remove the copies.
--
-- They were seeded with gen_random_uuid(), so every replay of the migrations
-- minted new ids for the same ten scripts. That was harmless until a reset
-- started restoring a copy of the data afterwards: the restored rows carried the
-- ids from before the reset, the freshly seeded rows carried new ones, nothing
-- collided, and both survived. Four such cycles left four of everything in the
-- Sort and Group menus.
--
-- The fix is identity rather than cleanup. A built-in is one script per kind and
-- name, so saying that in a constraint means a restore that carries them along
-- conflicts and is skipped, instead of quietly doubling the list.
--
-- References are repointed before the copies go. The foreign keys clear
-- themselves on delete, so removing a duplicate first would silently reset
-- whichever view or profile happened to be pointing at that copy.

with survivors as (
  select distinct on (kind, name) id, kind, name
    from scripts
   where is_builtin
   order by kind, name, created_at, id
),
duplicates as (
  select s.id as doomed, v.id as keeper
    from scripts s
    join survivors v on v.kind = s.kind and v.name = s.name
   where s.is_builtin and s.id <> v.id
)
update views v
   set sort_script_id = coalesce((select keeper from duplicates where doomed = v.sort_script_id), v.sort_script_id),
       group_script_id = coalesce((select keeper from duplicates where doomed = v.group_script_id), v.group_script_id)
 where v.sort_script_id in (select doomed from duplicates)
    or v.group_script_id in (select doomed from duplicates);

with survivors as (
  select distinct on (kind, name) id, kind, name
    from scripts
   where is_builtin
   order by kind, name, created_at, id
),
duplicates as (
  select s.id as doomed, v.id as keeper
    from scripts s
    join survivors v on v.kind = s.kind and v.name = s.name
   where s.is_builtin and s.id <> v.id
)
update profiles p
   set default_sort_script_id = (select keeper from duplicates where doomed = p.default_sort_script_id)
 where p.default_sort_script_id in (select doomed from duplicates);

with survivors as (
  select distinct on (kind, name) id, kind, name
    from scripts
   where is_builtin
   order by kind, name, created_at, id
),
duplicates as (
  select s.id as doomed, v.id as keeper
    from scripts s
    join survivors v on v.kind = s.kind and v.name = s.name
   where s.is_builtin and s.id <> v.id
)
update scripts f
   set forked_from = (select keeper from duplicates where doomed = f.forked_from)
 where f.forked_from in (select doomed from duplicates);

delete from scripts s
 where s.is_builtin
   and s.id <> (
     select v.id
       from scripts v
      where v.is_builtin and v.kind = s.kind and v.name = s.name
      order by v.created_at, v.id
      limit 1
   );

create unique index scripts_builtin_identity on scripts (kind, name) where is_builtin;
