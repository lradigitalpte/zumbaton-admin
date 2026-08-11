-- Default notification alert recipient settings (editable in Admin > Settings > Notifications)
INSERT INTO public.system_settings (key, value, description)
VALUES (
  'notification_alerts',
  '{"emails": []}'::jsonb,
  'Extra staff emails for payment and booking alert notifications'
)
ON CONFLICT (key) DO NOTHING;
