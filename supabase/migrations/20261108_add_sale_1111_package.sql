-- 11:11 Sale: 6 sessions for $111, 11 Nov 2026 only (Singapore time).
-- The row stays is_active = true; the web app hides it outside the sale window
-- and the payments API rejects purchases outside the window / second purchases.
-- validity_days = 36500 (~100 years) represents "no validity period".
-- Identified by exact name in the web app (SALE_1111_PACKAGE_NAME) - do not rename.

INSERT INTO packages (name, description, token_count, price_cents, currency, validity_days, class_types, package_type, is_active)
SELECT
  '11:11 Sale - 6 Sessions',
  '6 sessions for $111. One day only. No validity period.',
  6,
  11100,
  'SGD',
  36500,
  ARRAY['all'],
  'all',
  true
WHERE NOT EXISTS (SELECT 1 FROM packages WHERE name = '11:11 Sale - 6 Sessions');
