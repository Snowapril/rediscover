-- Row level security for every user-owned table.
--
-- auth.uid() is wrapped in a scalar subselect so Postgres evaluates it once per
-- query rather than once per row.

alter table profiles   enable row level security;
alter table collections enable row level security;
alter table items      enable row level security;
alter table tags       enable row level security;
alter table item_tags  enable row level security;
alter table scripts    enable row level security;
alter table views      enable row level security;
alter table reminders  enable row level security;

-- profiles: a row is created by the auth trigger, so users may read and update
-- their own but never insert or delete one.
create policy profiles_select on profiles for select to authenticated
  using (id = (select auth.uid()));
create policy profiles_update on profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

create policy collections_select on collections for select to authenticated
  using (user_id = (select auth.uid()));
create policy collections_insert on collections for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy collections_update on collections for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy collections_delete on collections for delete to authenticated
  using (user_id = (select auth.uid()));

create policy items_select on items for select to authenticated
  using (user_id = (select auth.uid()));
create policy items_insert on items for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy items_update on items for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy items_delete on items for delete to authenticated
  using (user_id = (select auth.uid()));

create policy tags_select on tags for select to authenticated
  using (user_id = (select auth.uid()));
create policy tags_insert on tags for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy tags_update on tags for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy tags_delete on tags for delete to authenticated
  using (user_id = (select auth.uid()));

create policy item_tags_select on item_tags for select to authenticated
  using (user_id = (select auth.uid()));
create policy item_tags_insert on item_tags for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy item_tags_delete on item_tags for delete to authenticated
  using (user_id = (select auth.uid()));

-- scripts: built-ins are readable by everyone and writable by no one, so a user
-- changes one by forking it into a row they own.
create policy scripts_select on scripts for select to authenticated
  using (user_id = (select auth.uid()) or is_builtin);
create policy scripts_insert on scripts for insert to authenticated
  with check (user_id = (select auth.uid()) and not is_builtin);
create policy scripts_update on scripts for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()) and not is_builtin);
create policy scripts_delete on scripts for delete to authenticated
  using (user_id = (select auth.uid()));

create policy views_select on views for select to authenticated
  using (user_id = (select auth.uid()));
create policy views_insert on views for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy views_update on views for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy views_delete on views for delete to authenticated
  using (user_id = (select auth.uid()));

create policy reminders_select on reminders for select to authenticated
  using (user_id = (select auth.uid()));
create policy reminders_insert on reminders for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy reminders_update on reminders for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy reminders_delete on reminders for delete to authenticated
  using (user_id = (select auth.uid()));
