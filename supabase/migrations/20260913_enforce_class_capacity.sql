-- =====================================================
-- MIGRATION: Enforce class capacity atomically
--
-- Every booking path (member bookings, course bookings, guest
-- trial bookings, duo-trial reservations, the payment webhook,
-- and admin lead-booking) checks capacity in application code
-- with a separate "select count(*)" before the insert/update.
-- Two concurrent requests for the last spot can both pass that
-- check before either write lands, causing overbooking.
--
-- This adds a trigger that re-checks capacity inside the same
-- transaction as the write, while holding a row lock on the
-- class so concurrent attempts serialize instead of racing.
-- =====================================================

create or replace function enforce_booking_capacity()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_capacity integer;
  v_occupied integer;
begin
  -- Lock the class row so concurrent confirmations for the same
  -- class serialize on this trigger instead of racing each other.
  select capacity into v_capacity
  from classes
  where id = new.class_id
  for update;

  if v_capacity is null then
    return new; -- class not found; the FK constraint will reject the row
  end if;

  select count(*) into v_occupied
  from bookings
  where class_id = new.class_id
    and status in ('confirmed', 'attended')
    and id <> new.id;

  if v_occupied >= v_capacity then
    raise exception 'This class is full' using errcode = 'P0001';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_enforce_booking_capacity on bookings;

create trigger trg_enforce_booking_capacity
  before insert or update on bookings
  for each row
  when (new.status in ('confirmed', 'attended'))
  execute function enforce_booking_capacity();
