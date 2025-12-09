-- Enable real-time replication for notifications table
-- This allows Supabase real-time subscriptions to work

-- Enable replication for notifications table
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;

-- Note: If the publication doesn't exist, you may need to create it first:
-- CREATE PUBLICATION supabase_realtime FOR TABLE notifications;

-- Verify RLS policies allow users to see their own notifications
-- (This should already be set up, but we'll ensure it exists)

-- Ensure users can only see their own notifications via RLS
-- The existing RLS policies should handle this, but we'll add a comment for reference:
-- Users should be able to SELECT their own notifications (already handled by RLS)
-- Real-time subscriptions respect RLS policies automatically

