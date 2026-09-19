-- ROLLBACK REFERENCE ONLY. Do not run automatically.
--
-- This restores the prior acquisition-source allowlist. It intentionally
-- refuses to run while any booking is attributed to Reddit, because silently
-- rewriting those rows to another source would destroy attribution data.
-- Before a deliberate rollback, inspect/export affected rows with:
--
--   select id, created_at, acquisition_source
--   from public.bookings
--   where acquisition_source = 'reddit'
--   order by created_at;

begin;

do $$
begin
  if exists (
    select 1
    from public.bookings
    where acquisition_source = 'reddit'
  ) then
    raise exception
      'Rollback blocked: bookings still use acquisition_source=reddit. Export and deliberately reclassify them first.';
  end if;
end
$$;

alter table public.bookings
  drop constraint if exists bookings_acquisition_source_check;

alter table public.bookings
  add constraint bookings_acquisition_source_check
    check (
      acquisition_source is null
      or acquisition_source in (
        'google_ads',
        'google_business',
        'google_search_maps',
        'nextdoor',
        'facebook_instagram',
        'meta_ads',
        'apartment_flyer',
        'storefront',
        'referral',
        'existing_customer',
        'other'
      )
    );

commit;
