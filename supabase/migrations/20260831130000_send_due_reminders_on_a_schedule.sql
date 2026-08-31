-- Send what is due, without anybody having the application open.
--
-- The in-app inbox needs no scheduler: a reminder becomes due as time passes, so
-- looking is enough. A notification is the opposite — it exists precisely for
-- when nobody is looking — so something in the database has to wake up.
--
-- pg_cron does the waking and pg_net makes the call, because a cron job cannot
-- reach an edge function by itself. The call is asynchronous: the job's work is
-- to ask, not to wait for delivery to a push service on the other side of the
-- internet.
--
-- Both extensions are taken only if the server has them. A Postgres without them
-- still gets the table and the function; it simply has nothing scheduled, and
-- the application is unharmed because the inbox was never reading from a
-- scheduler. That is what lets this same migration apply to the in-process
-- Postgres the schema tests run against.

do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    execute 'create extension if not exists pg_cron';
  end if;
  if exists (select 1 from pg_available_extensions where name = 'pg_net') then
    execute 'create extension if not exists pg_net';
  end if;
end;
$$;

-- Where the function lives and what authorises the call. Held in the database
-- rather than written into the job, so rotating the key or moving the
-- deployment is an update rather than a migration, and so the key is not sitting
-- in cron.job for anyone with a connection to read.
create table notifier_settings (
  id boolean primary key default true check (id),
  functions_url text not null,
  service_role_key text not null
);

alter table notifier_settings enable row level security;
-- No policies at all: this is for the scheduler, and nothing signed in has any
-- business reading a service role key.

/*
 * Asks the notifier to send whatever has come due. Runs as the job, not as a
 * person, which is why it reads its own credentials rather than being handed
 * them.
 */
create function send_due_reminders() returns void
  language plpgsql
  security definer
  set search_path = ''
  as $$
  declare
    settings public.notifier_settings;
  begin
    select * into settings from public.notifier_settings where id;
    if not found then
      -- Nothing configured yet. Silence rather than an error: an unconfigured
      -- deployment should not fill its logs every minute.
      return;
    end if;

    perform net.http_post(
      url := settings.functions_url || '/notify',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || settings.service_role_key
      ),
      body := '{}'::jsonb,
      timeout_milliseconds := 30000
    );
  end;
  $$;

revoke execute on function send_due_reminders() from public, anon, authenticated;

-- Every five minutes. A reminder is a nudge about something saved days ago, so
-- arriving within five minutes of its moment is punctual; asking more often
-- would be work with nothing to show for it.
do $$
begin
  if exists (select 1 from pg_namespace where nspname = 'cron') then
    perform cron.schedule('send-due-reminders', '*/5 * * * *', 'select public.send_due_reminders()');
  end if;
end;
$$;
