-- rediscover: initial schema.
--
-- Every user-owned table carries `user_id` and is guarded by row level security,
-- so a client holding a user's JWT can only ever reach that user's rows.

create type read_state as enum ('unread', 'reading', 'read');
create type media_type as enum ('article', 'video', 'image', 'pdf', 'link');
create type extract_status as enum ('pending', 'ok', 'failed');
create type script_kind as enum ('sort', 'group');
create type view_layout as enum ('list', 'card', 'grid', 'headline');
create type sort_direction as enum ('asc', 'desc');
create type reminder_status as enum ('scheduled', 'sent', 'dismissed', 'cancelled');

-- Names of the item properties a user may override by hand. Kept in sync with
-- ITEM_PROPERTY_KEYS in @rediscover/core.
create function item_property_keys() returns text[]
  language sql immutable
  as $$ select array[
    'title', 'excerpt', 'thumbnailUrl', 'faviconUrl', 'siteName',
    'author', 'publishedAt', 'readingTimeMin', 'lang', 'mediaType'
  ]::text[] $$;

create function touch_updated_at() returns trigger
  language plpgsql
  as $$
  begin
    new.updated_at := now();
    return new;
  end;
  $$;


-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------

create table profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  avatar_url text,
  default_sort_script_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profiles_touch before update on profiles
  for each row execute function touch_updated_at();

-- Mirror every new auth user into profiles so the rest of the schema can key
-- off a single owner table.
create function handle_new_user() returns trigger
  language plpgsql security definer set search_path = ''
  as $$
  begin
    insert into public.profiles (id, display_name, avatar_url)
    values (
      new.id,
      coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
      new.raw_user_meta_data ->> 'avatar_url'
    )
    on conflict (id) do nothing;
    return new;
  end;
  $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function handle_new_user();


-- ---------------------------------------------------------------------------
-- collections (folders)
-- ---------------------------------------------------------------------------

create table collections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles (id) on delete cascade,
  parent_id uuid references collections (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 200),
  icon text,
  color text,
  -- Fractional ordering among siblings: a folder is placed between two others
  -- by giving it the midpoint of their positions.
  position double precision not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id)
);

create index collections_user_parent_idx on collections (user_id, parent_id, position);

create trigger collections_touch before update on collections
  for each row execute function touch_updated_at();

-- A folder may not become its own ancestor; a cycle would make the recursive
-- tree queries non-terminating.
create function collections_reject_cycle() returns trigger
  language plpgsql
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
      select parent_id into ancestor from collections where id = ancestor;
    end loop;
    return new;
  end;
  $$;

create trigger collections_no_cycle before insert or update of parent_id on collections
  for each row when (new.parent_id is not null) execute function collections_reject_cycle();


-- ---------------------------------------------------------------------------
-- items (scraps)
-- ---------------------------------------------------------------------------

create table items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles (id) on delete cascade,
  collection_id uuid,
  position double precision not null default 0,

  -- The link as saved, plus the comparison-only form used to detect duplicates.
  url text not null check (char_length(url) between 1 and 8192),
  canonical_url text not null,
  domain text not null,

  -- Standardized properties. Effective values: extraction fills them, the user
  -- may override any of them, and `edited_fields` records which.
  title text,
  excerpt text,
  thumbnail_url text,
  favicon_url text,
  site_name text,
  author text,
  published_at timestamptz,
  reading_time_min integer check (reading_time_min >= 0),
  lang text,
  media_type media_type,

  auto_metadata jsonb not null default '{}'::jsonb,
  edited_fields text[] not null default '{}'::text[]
    check (edited_fields <@ item_property_keys()),

  read_state read_state not null default 'unread',
  read_at timestamptz check (read_at is null or read_state <> 'unread'),
  is_important boolean not null default false,

  note text,

  extract_status extract_status not null default 'pending',
  extract_error text,
  extracted_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,

  unique (id, user_id),
  -- A composite reference keeps an item and its folder owned by the same user.
  foreign key (collection_id, user_id) references collections (id, user_id) on delete set null
);

-- One live scrap per canonical URL per user. Hashing keeps the key inside the
-- btree size limit for long URLs; trashed items are excluded so a link can be
-- saved again after deletion.
create unique index items_user_canonical_url_key
  on items (user_id, md5(canonical_url)) where deleted_at is null;

create index items_user_collection_idx
  on items (user_id, collection_id, created_at desc) where deleted_at is null;

create index items_user_unread_idx
  on items (user_id, created_at desc) where deleted_at is null and read_state = 'unread';

create trigger items_touch before update on items
  for each row execute function touch_updated_at();


-- ---------------------------------------------------------------------------
-- tags
-- ---------------------------------------------------------------------------

create table tags (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  created_at timestamptz not null default now(),
  unique (user_id, name),
  unique (id, user_id)
);

create table item_tags (
  item_id uuid not null,
  tag_id uuid not null,
  -- Denormalized so row level security can filter without joining items.
  user_id uuid not null references profiles (id) on delete cascade,
  primary key (item_id, tag_id),
  foreign key (item_id, user_id) references items (id, user_id) on delete cascade,
  foreign key (tag_id, user_id) references tags (id, user_id) on delete cascade
);

create index item_tags_tag_idx on item_tags (tag_id);


-- ---------------------------------------------------------------------------
-- scripts
-- ---------------------------------------------------------------------------

create table scripts (
  id uuid primary key default gen_random_uuid(),
  -- Null for the built-in scripts, which every user can read and fork.
  user_id uuid references profiles (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  kind script_kind not null,
  source text not null check (char_length(source) <= 20000),
  is_builtin boolean not null default false,
  forked_from uuid references scripts (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (is_builtin = (user_id is null)),
  unique (id, user_id)
);

create index scripts_user_idx on scripts (user_id, kind);

create trigger scripts_touch before update on scripts
  for each row execute function touch_updated_at();

alter table profiles
  add constraint profiles_default_sort_script_fkey
  foreign key (default_sort_script_id) references scripts (id) on delete set null;


-- ---------------------------------------------------------------------------
-- views
-- ---------------------------------------------------------------------------

create table views (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles (id) on delete cascade,
  collection_id uuid not null,
  name text not null check (char_length(name) between 1 and 120),
  position double precision not null default 0,
  layout view_layout not null default 'card',
  sort_script_id uuid references scripts (id) on delete set null,
  sort_direction sort_direction not null default 'asc',
  group_script_id uuid references scripts (id) on delete set null,
  filter jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (collection_id, user_id) references collections (id, user_id) on delete cascade
);

create index views_collection_idx on views (user_id, collection_id, position);

create trigger views_touch before update on views
  for each row execute function touch_updated_at();


-- ---------------------------------------------------------------------------
-- reminders
-- ---------------------------------------------------------------------------

create table reminders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles (id) on delete cascade,
  item_id uuid not null,
  remind_at timestamptz not null,
  status reminder_status not null default 'scheduled',
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  foreign key (item_id, user_id) references items (id, user_id) on delete cascade
);

create index reminders_due_idx on reminders (remind_at) where status = 'scheduled';
create index reminders_item_idx on reminders (item_id);
