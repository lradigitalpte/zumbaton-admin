-- Migration: Add all missing permissions based on UI actions audit
-- Date: 2025-01-08
-- Description: Adds ~40 missing permissions for user management, staff, attendance, packages, waitlist, refunds, payments, invoices, rooms, and notifications

-- =====================================================
-- ENSURE ROLE CONSTRAINTS INCLUDE ALL ROLES
-- =====================================================
-- Update user_profiles CHECK constraint if needed
ALTER TABLE user_profiles 
DROP CONSTRAINT IF EXISTS user_profiles_role_check;

ALTER TABLE user_profiles
ADD CONSTRAINT user_profiles_role_check 
CHECK (role IN ('super_admin', 'admin', 'instructor', 'staff', 'receptionist', 'user'));

-- Update role_permissions CHECK constraint if needed
ALTER TABLE role_permissions 
DROP CONSTRAINT IF EXISTS role_permissions_role_check;

ALTER TABLE role_permissions
ADD CONSTRAINT role_permissions_role_check 
CHECK (role IN ('super_admin', 'admin', 'instructor', 'staff', 'receptionist', 'user'));

-- =====================================================
-- ADD MISSING USER PERMISSIONS
-- =====================================================
INSERT INTO permissions (name, description, resource, action) VALUES
-- Additional user management permissions
('users.flag', 'Flag a user for review', 'users', 'flag'),
('users.unflag', 'Remove flag from user', 'users', 'unflag'),
('users.suspend', 'Suspend user account', 'users', 'suspend'),
('users.activate', 'Activate user account', 'users', 'activate'),
('users.reset_password', 'Reset user password', 'users', 'reset_password'),
('users.view_notes', 'View user notes', 'users', 'view_notes'),
('users.edit_notes', 'Edit user notes', 'users', 'edit_notes')

ON CONFLICT (name) DO NOTHING;

-- =====================================================
-- ADD STAFF RESOURCE PERMISSIONS
-- =====================================================
INSERT INTO permissions (name, description, resource, action) VALUES
('staff.view', 'View staff members', 'staff', 'view'),
('staff.create', 'Create staff accounts', 'staff', 'create'),
('staff.edit', 'Edit staff information', 'staff', 'edit'),
('staff.delete', 'Delete staff accounts', 'staff', 'delete'),
('staff.suspend', 'Suspend staff account', 'staff', 'suspend'),
('staff.reset_password', 'Reset staff password', 'staff', 'reset_password')

ON CONFLICT (name) DO NOTHING;

-- =====================================================
-- ADD MISSING ATTENDANCE PERMISSIONS
-- =====================================================
INSERT INTO permissions (name, description, resource, action) VALUES
('attendance.excuse', 'Excuse no-show and refund token', 'attendance', 'excuse'),
('attendance.penalize', 'Penalize no-show without refund', 'attendance', 'penalize'),
('attendance.resolve', 'Resolve no-show without action', 'attendance', 'resolve')

ON CONFLICT (name) DO NOTHING;

-- =====================================================
-- ADD MISSING PACKAGE PERMISSIONS
-- =====================================================
INSERT INTO permissions (name, description, resource, action) VALUES
('packages.activate', 'Activate package', 'packages', 'activate'),
('packages.deactivate', 'Deactivate package', 'packages', 'deactivate')

ON CONFLICT (name) DO NOTHING;

-- =====================================================
-- ADD WAITLIST PERMISSIONS
-- =====================================================
INSERT INTO permissions (name, description, resource, action) VALUES
('waitlist.view_all', 'View all waitlist entries', 'waitlist', 'view_all'),
('waitlist.view_own', 'View own waitlist entries', 'waitlist', 'view_own'),
('waitlist.manage', 'Manage waitlist (join, leave, confirm)', 'waitlist', 'manage')

ON CONFLICT (name) DO NOTHING;

-- =====================================================
-- ADD REFUND PERMISSIONS
-- =====================================================
INSERT INTO permissions (name, description, resource, action) VALUES
('refunds.view_all', 'View all refunds', 'refunds', 'view_all'),
('refunds.create', 'Create refund requests', 'refunds', 'create'),
('refunds.approve', 'Approve refunds', 'refunds', 'approve')

ON CONFLICT (name) DO NOTHING;

-- =====================================================
-- ADD PAYMENT PERMISSIONS
-- =====================================================
INSERT INTO permissions (name, description, resource, action) VALUES
('payments.view_all', 'View all payments', 'payments', 'view_all')

ON CONFLICT (name) DO NOTHING;

-- =====================================================
-- ADD INVOICE PERMISSIONS
-- =====================================================
INSERT INTO permissions (name, description, resource, action) VALUES
('invoices.view_all', 'View all invoices', 'invoices', 'view_all'),
('invoices.create', 'Create invoices', 'invoices', 'create')

ON CONFLICT (name) DO NOTHING;

-- =====================================================
-- ADD ROOM PERMISSIONS
-- =====================================================
INSERT INTO permissions (name, description, resource, action) VALUES
('rooms.view', 'View rooms/studios', 'rooms', 'view'),
('rooms.create', 'Create rooms/studios', 'rooms', 'create'),
('rooms.edit', 'Edit rooms/studios', 'rooms', 'edit'),
('rooms.delete', 'Delete rooms/studios', 'rooms', 'delete')

ON CONFLICT (name) DO NOTHING;

-- =====================================================
-- ADD NOTIFICATION PERMISSIONS
-- =====================================================
INSERT INTO permissions (name, description, resource, action) VALUES
('notifications.send', 'Send notifications', 'notifications', 'send'),
('notifications.view_all', 'View all notifications', 'notifications', 'view_all'),
('notifications.manage_templates', 'Manage notification templates', 'notifications', 'manage_templates')

ON CONFLICT (name) DO NOTHING;

-- =====================================================
-- UPDATE ROLE PERMISSIONS - SUPER ADMIN
-- Super admin gets all permissions automatically via SELECT * FROM permissions
-- =====================================================
INSERT INTO role_permissions (role, permission_id)
SELECT 'super_admin', id FROM permissions
WHERE name IN (
  'users.flag', 'users.unflag', 'users.suspend', 'users.activate', 'users.reset_password', 'users.view_notes', 'users.edit_notes',
  'staff.view', 'staff.create', 'staff.edit', 'staff.delete', 'staff.suspend', 'staff.reset_password',
  'attendance.excuse', 'attendance.penalize', 'attendance.resolve',
  'packages.activate', 'packages.deactivate',
  'waitlist.view_all', 'waitlist.view_own', 'waitlist.manage',
  'refunds.view_all', 'refunds.create', 'refunds.approve',
  'payments.view_all',
  'invoices.view_all', 'invoices.create',
  'rooms.view', 'rooms.create', 'rooms.edit', 'rooms.delete',
  'notifications.send', 'notifications.view_all', 'notifications.manage_templates'
)
ON CONFLICT DO NOTHING;

-- =====================================================
-- UPDATE ROLE PERMISSIONS - ADMIN
-- =====================================================
INSERT INTO role_permissions (role, permission_id)
SELECT 'admin', id FROM permissions
WHERE name IN (
  'users.flag', 'users.unflag', 'users.suspend', 'users.activate', 'users.reset_password', 'users.view_notes', 'users.edit_notes',
  'staff.view', 'staff.create', 'staff.edit', 'staff.reset_password',
  'attendance.excuse', 'attendance.penalize', 'attendance.resolve',
  'packages.activate', 'packages.deactivate',
  'waitlist.view_all', 'waitlist.view_own', 'waitlist.manage',
  'refunds.view_all', 'refunds.create', 'refunds.approve',
  'payments.view_all',
  'invoices.view_all', 'invoices.create',
  'rooms.view', 'rooms.create', 'rooms.edit', 'rooms.delete',
  'notifications.send', 'notifications.view_all', 'notifications.manage_templates'
)
ON CONFLICT DO NOTHING;

-- =====================================================
-- UPDATE ROLE PERMISSIONS - STAFF
-- =====================================================
INSERT INTO role_permissions (role, permission_id)
SELECT 'staff', id FROM permissions
WHERE name IN (
  'users.flag', 'users.unflag', 'users.view_notes', 'users.edit_notes',
  'attendance.excuse', 'attendance.penalize', 'attendance.resolve',
  'packages.view',
  'waitlist.view_all', 'waitlist.manage',
  'rooms.view'
)
ON CONFLICT DO NOTHING;

-- =====================================================
-- UPDATE ROLE PERMISSIONS - RECEPTIONIST
-- =====================================================
INSERT INTO role_permissions (role, permission_id)
SELECT 'receptionist', id FROM permissions
WHERE name IN (
  'users.flag', 'users.view_notes',
  'attendance.excuse', 'attendance.penalize', 'attendance.resolve',
  'waitlist.view_all', 'waitlist.manage',
  'rooms.view'
)
ON CONFLICT DO NOTHING;

-- =====================================================
-- UPDATE ROLE PERMISSIONS - INSTRUCTOR
-- =====================================================
INSERT INTO role_permissions (role, permission_id)
SELECT 'instructor', id FROM permissions
WHERE name IN (
  'attendance.excuse', 'attendance.penalize', 'attendance.resolve',
  'waitlist.view_own'
)
ON CONFLICT DO NOTHING;

-- =====================================================
-- UPDATE ROLE PERMISSIONS - USER
-- =====================================================
INSERT INTO role_permissions (role, permission_id)
SELECT 'user', id FROM permissions
WHERE name IN (
  'waitlist.view_own', 'waitlist.manage'
)
ON CONFLICT DO NOTHING;

-- Verify the changes
SELECT 
    resource,
    COUNT(*) as permission_count
FROM permissions
GROUP BY resource
ORDER BY resource;

-- Expected output: Should show all resources with their permission counts

