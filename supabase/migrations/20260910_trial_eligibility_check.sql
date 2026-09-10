-- =====================================================
-- MIGRATION: One trial per person
-- Lets the booking forms check, before payment, whether an
-- email/phone already completed a paid trial booking.
-- =====================================================

create or replace function has_prior_paid_trial(p_email text, p_phone text)
returns boolean
language sql
stable
as $$
  select exists (
    select 1 from payments
    where status = 'succeeded'
      and is_trial_booking = true
      and (
        (
          p_email is not null and length(trim(p_email)) > 0 and lower(trim(p_email)) in (
            lower(trim(metadata->>'guest_email')),
            lower(trim(metadata->>'customer_email'))
          )
        ) or (
          p_phone is not null and length(regexp_replace(p_phone, '[^0-9]', '', 'g')) >= 8 and
          right(regexp_replace(p_phone, '[^0-9]', '', 'g'), 8) in (
            right(regexp_replace(coalesce(metadata->>'guest_phone', ''), '[^0-9]', '', 'g'), 8),
            right(regexp_replace(coalesce(metadata->>'parent_phone', ''), '[^0-9]', '', 'g'), 8),
            right(regexp_replace(coalesce(metadata->>'customer_phone', ''), '[^0-9]', '', 'g'), 8)
          )
        )
      )
  );
$$;
