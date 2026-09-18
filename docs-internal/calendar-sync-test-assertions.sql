-- Run only after the full Mars schema and the calendar-sync migration have
-- been applied to a disposable Supabase project. Every data/config mutation
-- below is rolled back. A successful run returns without an error and emits
-- the notice: CALENDAR SYNC DATABASE ASSERTIONS PASSED.

begin;

do $$
declare
  v_prelaunch_id uuid;
  v_booking_id uuid;
  v_paused_id uuid;
  v_phone_id uuid;
  v_pickup_version bigint;
  v_delivery_version bigint;
  v_launched_at timestamptz;
  v_unauthorized_rejected boolean := false;
begin
  -- Migration starts dormant and cannot backfill existing bookings.
  if (select enabled from public.calendar_sync_config where id = true) then
    raise exception 'expected calendar sync to start disabled';
  end if;
  if (select launched_at is not null from public.calendar_sync_config where id = true) then
    raise exception 'expected launched_at to start null';
  end if;

  insert into public.bookings (
    name, phone, address,
    preferred_pickup_date, preferred_pickup_time,
    preferred_delivery_date, preferred_delivery_time,
    status, booking_source, service_type, service_speed,
    contact_preference, sms_consent, sms_consent_at
  ) values (
    'Prelaunch Test', '2125550100', '1 Prelaunch Way, Brooklyn, NY 11201',
    date '2099-06-10', time '10:00',
    date '2099-06-11', time '14:00',
    'pending', 'website', 'wash_and_fold', 'standard',
    'text', true, now()
  ) returning id into v_prelaunch_id;

  if (select calendar_sync_eligible from public.bookings where id = v_prelaunch_id) then
    raise exception 'prelaunch website booking became eligible';
  end if;
  if (select count(*) from public.calendar_sync_state where booking_id = v_prelaunch_id) <> 0 then
    raise exception 'prelaunch booking unexpectedly created outbox rows';
  end if;

  update public.calendar_sync_config
     set active_calendar_identity = 'https://calendar.test/one/'
   where id = true;
  perform public.enable_calendar_sync();

  select launched_at into v_launched_at
    from public.calendar_sync_config where id = true;
  if v_launched_at is null
     or not (select enabled from public.calendar_sync_config where id = true) then
    raise exception 'enable_calendar_sync did not establish the launch gate';
  end if;

  -- Editing a prelaunch booking after launch must never backfill it.
  update public.bookings
     set status = 'confirmed',
         confirmed_pickup_date = date '2099-06-10',
         confirmed_pickup_time = time '10:00',
         confirmed_delivery_date = date '2099-06-11',
         confirmed_delivery_time = time '14:00'
   where id = v_prelaunch_id;
  if (select calendar_sync_eligible from public.bookings where id = v_prelaunch_id)
     or (select count(*) from public.calendar_sync_state where booking_id = v_prelaunch_id) <> 0 then
    raise exception 'prelaunch booking was backfilled after an edit';
  end if;

  -- A new post-launch website booking is durable-eligible but remains absent
  -- until the existing dashboard confirmation state and times are present.
  insert into public.bookings (
    name, phone, address,
    preferred_pickup_date, preferred_pickup_time,
    preferred_delivery_date, preferred_delivery_time,
    status, booking_source, service_type, service_speed,
    contact_preference, sms_consent, sms_consent_at
  ) values (
    'Calendar Test', '2125550101', '2 Calendar Way, Brooklyn, NY 11201',
    date '2099-07-10', time '10:00',
    date '2099-07-11', time '14:00',
    'pending', 'website', 'wash_and_fold', 'standard',
    'text', true, now()
  ) returning id into v_booking_id;

  if not (select calendar_sync_eligible from public.bookings where id = v_booking_id) then
    raise exception 'post-launch website booking was not eligible';
  end if;
  if (select count(*) from public.calendar_sync_state where booking_id = v_booking_id) <> 2
     or (select count(*) from public.calendar_sync_state where booking_id = v_booking_id and desired_disposition = 'absent') <> 2 then
    raise exception 'pending booking did not create exactly two absent legs';
  end if;

  update public.bookings
     set status = 'confirmed',
         confirmed_pickup_date = date '2099-07-10',
         confirmed_pickup_time = time '10:00',
         confirmed_delivery_date = date '2099-07-11',
         confirmed_delivery_time = time '14:00'
   where id = v_booking_id;

  if (select count(*) from public.calendar_sync_state where booking_id = v_booking_id and desired_disposition = 'active') <> 2
     or (select count(*) from public.calendar_sync_state where booking_id = v_booking_id and (desired_start is null or desired_end is null)) <> 0 then
    raise exception 'confirmed booking did not produce two scheduled active legs';
  end if;

  select desired_version into v_pickup_version
    from public.calendar_sync_state where booking_id = v_booking_id and leg = 'pickup';
  select desired_version into v_delivery_version
    from public.calendar_sync_state where booking_id = v_booking_id and leg = 'delivery';

  update public.bookings
     set confirmed_pickup_time = time '11:00'
   where id = v_booking_id;

  if (select desired_version from public.calendar_sync_state where booking_id = v_booking_id and leg = 'pickup') <> v_pickup_version + 1 then
    raise exception 'pickup reschedule did not increment pickup desired_version';
  end if;
  if (select desired_version from public.calendar_sync_state where booking_id = v_booking_id and leg = 'delivery') <> v_delivery_version then
    raise exception 'pickup-only reschedule incorrectly changed delivery desired_version';
  end if;
  if (select count(*) from public.calendar_sync_state where booking_id = v_booking_id) <> 2 then
    raise exception 'reschedule created duplicate outbox legs';
  end if;

  -- Pausing stops claims only. It cannot delete desired events, erase the
  -- launch boundary, or make new website bookings ineligible.
  update public.calendar_sync_config set enabled = false where id = true;
  update public.bookings set admin_notes = 'changed while paused' where id = v_booking_id;
  if (select count(*) from public.calendar_sync_state where booking_id = v_booking_id and desired_disposition = 'active') <> 2 then
    raise exception 'pause retracted active desired events';
  end if;

  insert into public.bookings (
    name, phone, address,
    preferred_pickup_date, preferred_pickup_time,
    preferred_delivery_date, preferred_delivery_time,
    status, booking_source, service_type, service_speed,
    contact_preference, sms_consent, sms_consent_at
  ) values (
    'Paused Test', '2125550102', '3 Pause Way, Brooklyn, NY 11201',
    date '2099-08-10', time '10:00',
    date '2099-08-11', time '14:00',
    'pending', 'website', 'wash_and_fold', 'standard',
    'text', true, now()
  ) returning id into v_paused_id;
  if not (select calendar_sync_eligible from public.bookings where id = v_paused_id) then
    raise exception 'post-launch website booking created during pause was not eligible';
  end if;

  perform public.enable_calendar_sync();
  if (select launched_at from public.calendar_sync_config where id = true) is distinct from v_launched_at then
    raise exception 'resume changed the durable launch timestamp';
  end if;

  -- Phone bookings are never part of the automated website feed.
  insert into public.bookings (
    name, phone, address,
    preferred_pickup_date, preferred_pickup_time,
    preferred_delivery_date, preferred_delivery_time,
    status, booking_source, service_type, service_speed,
    contact_preference, sms_consent
  ) values (
    'Phone Test', '2125550103', '4 Phone Way, Brooklyn, NY 11201',
    date '2099-09-10', time '10:00',
    date '2099-09-11', time '14:00',
    'pending', 'phone', 'wash_and_fold', 'standard',
    'call', false
  ) returning id into v_phone_id;
  if (select calendar_sync_eligible from public.bookings where id = v_phone_id)
     or (select count(*) from public.calendar_sync_state where booking_id = v_phone_id) <> 0 then
    raise exception 'phone booking entered the automated calendar feed';
  end if;

  -- Calendar replacement retargets active work, while absent rows remain tied
  -- to the calendar where any old resource would actually need deleting.
  update public.calendar_sync_config
     set active_calendar_identity = 'https://calendar.test/two/'
   where id = true;
  if (select count(*) from public.calendar_sync_state where booking_id = v_booking_id and desired_calendar_identity = 'https://calendar.test/two/') <> 2 then
    raise exception 'active calendar switch did not retarget both active legs';
  end if;
  if (select count(*) from public.calendar_sync_state where booking_id = v_paused_id and desired_calendar_identity = 'https://calendar.test/one/') <> 2 then
    raise exception 'calendar switch incorrectly retargeted absent legs';
  end if;

  -- Fulfillment is durable. Cancellation keeps the completed pickup as
  -- historical and removes only the future delivery.
  update public.bookings set status = 'picked_up' where id = v_booking_id;
  if (select desired_disposition from public.calendar_sync_state where booking_id = v_booking_id and leg = 'pickup') <> 'historical' then
    raise exception 'picked-up leg did not become historical';
  end if;
  update public.bookings set status = 'cancelled' where id = v_booking_id;
  if (select desired_disposition from public.calendar_sync_state where booking_id = v_booking_id and leg = 'pickup') <> 'historical'
     or (select desired_disposition from public.calendar_sync_state where booking_id = v_booking_id and leg = 'delivery') <> 'absent' then
    raise exception 'cancellation did not preserve fulfilled pickup/remove future delivery';
  end if;

  -- Hard delete must retain two deletion signals but remove every copied PII
  -- field from both, including a leg that was already absent beforehand.
  delete from public.bookings where id = v_booking_id;
  if (select count(*) from public.calendar_sync_state where booking_id = v_booking_id) <> 2
     or (select count(*) from public.calendar_sync_state where booking_id = v_booking_id and desired_disposition = 'absent') <> 2 then
    raise exception 'hard delete did not retain two absent cleanup signals';
  end if;
  if (select count(*) from public.calendar_sync_state
       where booking_id = v_booking_id
         and (desired_start is not null or desired_end is not null
              or desired_summary is not null or desired_location is not null
              or desired_phone is not null or desired_service_type is not null
              or desired_instructions is not null)) <> 0 then
    raise exception 'hard delete retained denormalized customer data';
  end if;

  -- SECURITY DEFINER claim boundary must reject SQL-editor/no-user sessions.
  begin
    perform * from public.claim_calendar_sync_batch(1, gen_random_uuid(), 120);
  exception when sqlstate '42501' then
    v_unauthorized_rejected := true;
  end;
  if not v_unauthorized_rejected then
    raise exception 'claim RPC did not reject an unauthorized caller';
  end if;

  if not exists (
    select 1 from pg_policies
     where schemaname = 'public' and tablename = 'bookings'
       and policyname = 'calendar worker cannot access bookings'
       and permissive = 'RESTRICTIVE'
  ) then
    raise exception 'restrictive bookings worker policy is missing';
  end if;
  if not exists (
    select 1 from pg_policies
     where schemaname = 'public' and tablename = 'recurring_schedules'
       and policyname = 'calendar worker cannot access recurring schedules'
       and permissive = 'RESTRICTIVE'
  ) then
    raise exception 'restrictive recurring-schedules worker policy is missing';
  end if;

  raise notice 'CALENDAR SYNC DATABASE ASSERTIONS PASSED';
end;
$$;

rollback;

select 'CALENDAR SYNC DATABASE ASSERTIONS PASSED' as result;
