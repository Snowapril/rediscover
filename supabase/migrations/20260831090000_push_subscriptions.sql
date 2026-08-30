-- Where a reminder is delivered when the application is not open.
--
-- One row per browser a person has said yes in, not one per person: the same
-- account signed in on a laptop and a phone is two subscriptions, and each has
-- its own keys.
--
-- The endpoint is the identity a push service gives that installation, so it is
-- unique across the table rather than per user. A browser that is handed to
-- somebody else, or an account switch on a shared machine, would otherwise leave
-- one endpoint owned twice and a notification going to the wrong person.

create table push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles (id) on delete cascade,

  -- The URL the push service listens on for this installation.
  endpoint text not null unique,
  -- The keys the payload is encrypted to, as the browser reported them.
  p256dh text not null,
  auth text not null,

  -- What the browser called itself, so a person can tell their devices apart
  -- when deciding which to stop.
  user_agent text,

  created_at timestamptz not null default now(),
  -- Set when a send succeeds, so a subscription that has not worked in a long
  -- time can be recognised.
  last_delivered_at timestamptz
);

create index push_subscriptions_user_idx on push_subscriptions (user_id);

alter table push_subscriptions enable row level security;

create policy push_subscriptions_select on push_subscriptions for select to authenticated
  using (user_id = (select auth.uid()));
create policy push_subscriptions_insert on push_subscriptions for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy push_subscriptions_update on push_subscriptions for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy push_subscriptions_delete on push_subscriptions for delete to authenticated
  using (user_id = (select auth.uid()));

grant select, insert, update, delete on push_subscriptions to authenticated, service_role;
