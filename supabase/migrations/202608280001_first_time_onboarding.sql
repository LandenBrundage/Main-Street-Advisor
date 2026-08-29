-- Track the one-time in-app welcome flow without changing existing accounts.
-- Existing profiles are backfilled as complete; profiles created after this
-- migration remain null until the user dismisses or completes the welcome.

alter table public.profiles
  add column if not exists onboarding_completed_at timestamptz;

update public.profiles
set onboarding_completed_at = coalesce(onboarding_completed_at, now())
where onboarding_completed_at is null;
