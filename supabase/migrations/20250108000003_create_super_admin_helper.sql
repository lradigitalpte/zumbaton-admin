-- Helper function to create super_admin user from application code
-- This migration adds a function that can be called to create admin users

CREATE OR REPLACE FUNCTION create_admin_user(
    p_email TEXT,
    p_name TEXT,
    p_password TEXT,
    p_role TEXT DEFAULT 'admin'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    new_user_id UUID;
BEGIN
    -- Note: This function can't actually create auth.users directly
    -- You need to use Supabase Admin API (see create-super-admin.js script)
    
    RAISE NOTICE 'To create admin users, use the Node.js script:';
    RAISE NOTICE 'node scripts/create-super-admin.js';
    RAISE NOTICE '';
    RAISE NOTICE 'Or use Supabase Admin API directly.';
    
    RETURN NULL;
END;
$$;

