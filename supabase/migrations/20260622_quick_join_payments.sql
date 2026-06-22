-- Quick Join (pay-first) support
-- Lets a guest pay for the 1-for-1 promo WITHOUT picking a class/date.
-- Staff schedule them afterwards. Such payments are trial payments with a
-- NULL class_id, which the old constraint forbade — relax it here.

ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_user_or_trial_check;

ALTER TABLE payments
ADD CONSTRAINT payments_user_or_trial_check
CHECK (
  (user_id IS NOT NULL) OR (is_trial_booking = true)
);

COMMENT ON CONSTRAINT payments_user_or_trial_check ON payments IS
  'A payment must belong to a user, or be a trial/guest payment (class_id optional for pay-first quick-join leads).';
