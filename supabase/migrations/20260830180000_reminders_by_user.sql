-- The inbox asks "what of mine has come due", which every query does under row
-- level security. The index from M0 is keyed on time alone, which suits a future
-- sender sweeping every account at once but makes one person's inbox read rows
-- belonging to everybody before discarding them.
--
-- Both are kept: they answer different questions, and a partial index over the
-- scheduled reminders of a single account is small.

create index reminders_user_due_idx
  on reminders (user_id, remind_at) where status = 'scheduled';
