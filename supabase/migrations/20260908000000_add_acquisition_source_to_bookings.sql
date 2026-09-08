-- Acquisition source tracking. Adds one nullable text column to
-- public.bookings so a booking can (optionally) record how the customer
-- discovered Mars Laundromat. Purely additive: the column is nullable with
-- no default, so every existing row stays NULL, and no existing column,
-- constraint, generated expression, or RLS policy is touched.
begin;

-- acquisition_source is customer-submitted, optional metadata — the same
-- treatment service_type and dry_cleaning_item_description already get
-- (freely settable by anon on INSERT, bounded only by this CHECK, not by
-- the anon INSERT policy's WITH CHECK allowlist below). It is deliberately
-- NOT booking_source: that column already means how the booking record
-- itself was created (website vs. phone vs. system-generated recurring)
-- and keeps that meaning untouched. acquisition_source instead means how
-- the original customer found out about Mars in the first place.
alter table public.bookings
  add column acquisition_source text;

-- Text + CHECK (not a Postgres enum) so a new source can be added later
-- with a simple constraint change instead of an enum migration. Keep this
-- list in sync with ACQUISITION_SOURCES in src/lib/acquisition-source.ts —
-- add a new value to both together.
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

-- No RLS policy change, intentionally. acquisition_source is not added to
-- the anon INSERT policy's WITH CHECK allowlist (its current definition,
-- most recently altered in
-- supabase/migrations/20260830000000_recurring_pickups_v1.sql, is an
-- exhaustive list of the STAFF-ONLY columns anon must not be able to set —
-- everything else, like service_type and dry_cleaning_item_description
-- before it, is already freely settable by anon on INSERT, bounded only by
-- its own column-level CHECK). acquisition_source gets exactly that same
-- treatment: the CHECK constraint above is what keeps it safe, not a policy
-- change. The existing "authenticated can update bookings" policy is
-- already unconditional (using (true) with check (true)), so the admin
-- correction control added in Checkpoint 2 needs no policy change either.
--
-- No index: this business does not query at a scale where one is useful
-- yet, per the product spec.

commit;
