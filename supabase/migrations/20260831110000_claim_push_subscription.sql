-- Registering a browser that somebody else registered first.
--
-- A push endpoint identifies a browser installation, not a person, and asking to
-- subscribe twice on one browser returns the same endpoint both times. So when a
-- second account signs in on a shared machine and turns notifications on, the
-- row it needs already exists and belongs to the first account.
--
-- Row level security correctly refuses to let one account update another's row,
-- which leaves an upsert failing. Splitting the endpoint per account instead
-- would be worse than a failure: the first account's reminders would keep being
-- pushed to a browser the second account is now using.
--
-- So the endpoint is handed over. SECURITY DEFINER, because the caller has to
-- remove a row it does not own — but only that one row, identified by an
-- endpoint the caller's own browser just produced, which is the proof that the
-- browser is theirs to claim.

create function claim_push_subscription(
  p_endpoint text,
  p_p256dh text,
  p_auth text,
  p_user_agent text
) returns void
  language plpgsql
  security definer
  set search_path = ''
  as $$
  declare
    claimant uuid := auth.uid();
  begin
    if claimant is null then
      raise exception 'not signed in';
    end if;

    delete from public.push_subscriptions where endpoint = p_endpoint;

    insert into public.push_subscriptions (user_id, endpoint, p256dh, auth, user_agent)
    values (claimant, p_endpoint, p_p256dh, p_auth, p_user_agent);
  end;
  $$;

grant execute on function claim_push_subscription(text, text, text, text) to authenticated;
