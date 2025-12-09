-- Example: How to Add Custom Permissions
-- Run this in Supabase SQL Editor

-- =====================================================
-- STEP 1: Add New Permissions to Database
-- =====================================================

-- Example: Add refund management permissions
INSERT INTO permissions (name, description, resource, action) VALUES
('refunds.view_all', 'View all refund requests', 'refunds', 'view_all'),
('refunds.create', 'Create refund requests', 'refunds', 'create'),
('refunds.approve', 'Approve refund requests', 'refunds', 'approve'),
('refunds.reject', 'Reject refund requests', 'refunds', 'reject'),
('reports.custom', 'Create custom reports', 'reports', 'create'),
('notifications.send', 'Send notifications to users', 'notifications', 'send')
ON CONFLICT (name) DO NOTHING;

-- =====================================================
-- STEP 2: Assign Permissions to Roles
-- =====================================================

-- Give admin refund approval permissions
INSERT INTO role_permissions (role, permission_id)
SELECT 'admin', id FROM permissions 
WHERE name IN ('refunds.view_all', 'refunds.approve', 'reports.custom')
ON CONFLICT DO NOTHING;

-- Give receptionist refund creation permissions
INSERT INTO role_permissions (role, permission_id)
SELECT 'receptionist', id FROM permissions 
WHERE name IN ('refunds.view_all', 'refunds.create', 'notifications.send')
ON CONFLICT DO NOTHING;

-- =====================================================
-- STEP 3: Give Individual User Extra Permissions
-- =====================================================

-- Option: Add custom_permissions JSONB column first
-- ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS custom_permissions JSONB DEFAULT '{}';

-- Give a specific user extra permissions (example)
-- UPDATE user_profiles 
-- SET custom_permissions = '{"refunds": ["approve"], "analytics": ["export"]}'::jsonb
-- WHERE email = 'special.user@zumbaton.com';

-- =====================================================
-- STEP 4: Verify Permissions Were Added
-- =====================================================

-- Check what permissions a role has
SELECT 
    p.name,
    p.description,
    p.resource,
    p.action,
    rp.role
FROM permissions p
JOIN role_permissions rp ON rp.permission_id = p.id
WHERE rp.role = 'admin'
ORDER BY p.resource, p.action;

-- Check all available permissions
SELECT 
    resource,
    action,
    COUNT(*) as permission_count
FROM permissions
GROUP BY resource, action
ORDER BY resource, action;

