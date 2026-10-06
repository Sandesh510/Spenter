-- Passcode lockout: after 5 wrong attempts, the lock is refused for 15 minutes.
-- Run once in the Supabase SQL Editor (after 0001_init.sql).

alter table public.spend_profiles
  add column if not exists pin_failures int not null default 0,
  add column if not exists pin_locked_until timestamptz;
