-- Birthday wishes: dedupe so the daily job and the manual Send button
-- never wish the same member twice for one birthday.

ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS last_birthday_wish_year INT,
  ADD COLUMN IF NOT EXISTS last_birthday_wish_at TIMESTAMPTZ;

COMMENT ON COLUMN public.user_profiles.last_birthday_wish_year IS
  'Calendar year of the birthday the member was last wished for (Asia/Singapore).';
COMMENT ON COLUMN public.user_profiles.last_birthday_wish_at IS
  'When the last birthday wish email was sent.';
