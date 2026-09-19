-- Add Reddit to the optional acquisition-source allowlist. The column already
-- exists; this migration only widens its CHECK constraint so existing rows and
-- every unrelated booking rule remain unchanged.
begin;

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
        'reddit',
        'meta_ads',
        'apartment_flyer',
        'storefront',
        'referral',
        'existing_customer',
        'other'
      )
    );

commit;
