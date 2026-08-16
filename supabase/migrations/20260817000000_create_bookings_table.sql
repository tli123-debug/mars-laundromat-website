create table if not exists public.bookings (
  id                          uuid primary key default gen_random_uuid(),
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now(),

  -- customer-submitted
  name                        text not null,
  phone                       text not null,
  address                     text not null,
  preferred_pickup_date       date not null,
  preferred_pickup_window     text not null,
  preferred_delivery_date     date,
  preferred_delivery_window   text,
  special_instructions        text,

  -- staff-managed
  status                      text not null default 'pending',
  admin_notes                 text,

  constraint bookings_status_check
    check (status in ('pending', 'confirmed', 'completed', 'cancelled')),
  constraint bookings_pickup_window_check
    check (preferred_pickup_window in ('morning', 'afternoon', 'evening')),
  constraint bookings_delivery_window_check
    check (preferred_delivery_window is null
           or preferred_delivery_window in ('morning', 'afternoon', 'evening'))
);

create index if not exists bookings_status_idx     on public.bookings (status);
create index if not exists bookings_created_at_idx on public.bookings (created_at desc);

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists bookings_set_updated_at on public.bookings;
create trigger bookings_set_updated_at
  before update on public.bookings
  for each row execute function public.set_updated_at();

alter table public.bookings enable row level security;

drop policy if exists "anon can create pending bookings" on public.bookings;
drop policy if exists "authenticated can read bookings" on public.bookings;
drop policy if exists "authenticated can update bookings" on public.bookings;

-- Public can INSERT only — and only ever as 'pending'. The publishable key is
-- embedded in the client bundle and is inherently public, so RLS (not app code)
-- is the real security boundary: this WITH CHECK blocks a hand-crafted direct
-- REST call from pre-setting status to 'confirmed'/'completed'.
create policy "anon can create pending bookings"
  on public.bookings for insert
  to anon
  with check (status = 'pending');

-- Any authenticated user is a trusted admin (single small business, no
-- per-tenant ownership model) — policies are role-scoped only.
create policy "authenticated can read bookings"
  on public.bookings for select
  to authenticated
  using (true);

create policy "authenticated can update bookings"
  on public.bookings for update
  to authenticated
  using (true)
  with check (true);

-- No delete policy for any role: deletes are only possible from the
-- Supabase dashboard/SQL editor, never through the app.
