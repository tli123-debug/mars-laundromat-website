-- Replaces the coarse morning/afternoon/evening windows with specific
-- 30-minute time slots (8:00 AM–8:00 PM). Existing rows are mapped to a
-- representative time for their old window rather than dropped.

alter table public.bookings
  add column preferred_pickup_time time,
  add column preferred_delivery_time time;

update public.bookings set preferred_pickup_time = case preferred_pickup_window
  when 'morning'   then time '09:00'
  when 'afternoon' then time '13:00'
  when 'evening'   then time '18:00'
end;

update public.bookings set preferred_delivery_time = case preferred_delivery_window
  when 'morning'   then time '09:00'
  when 'afternoon' then time '13:00'
  when 'evening'   then time '18:00'
  else null
end;

alter table public.bookings
  alter column preferred_pickup_time set not null;

alter table public.bookings
  drop constraint if exists bookings_pickup_window_check,
  drop constraint if exists bookings_delivery_window_check,
  drop column preferred_pickup_window,
  drop column preferred_delivery_window;

alter table public.bookings
  add constraint bookings_pickup_time_check
    check (preferred_pickup_time >= time '08:00' and preferred_pickup_time <= time '20:00'
           and extract(minute from preferred_pickup_time)::int in (0, 30)),
  add constraint bookings_delivery_time_check
    check (preferred_delivery_time is null
           or (preferred_delivery_time >= time '08:00' and preferred_delivery_time <= time '20:00'
               and extract(minute from preferred_delivery_time)::int in (0, 30)));
