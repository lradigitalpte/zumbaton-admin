-- Zumbaton Token Engine Database Schema
-- Run this in Supabase SQL Editor to create all tables

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- USER_PROFILES TABLE (extends auth.users)
-- Core user profile with role-based access control
-- =====================================================
CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email VARCHAR(255) NOT NULL,
  name VARCHAR(200) NOT NULL,
  phone VARCHAR(20),
  avatar_url TEXT,
  role VARCHAR(20) NOT NULL DEFAULT 'user' CHECK (role IN ('super_admin', 'admin', 'instructor', 'user')),
  is_active BOOLEAN DEFAULT true,
  no_show_count INTEGER DEFAULT 0 CHECK (no_show_count >= 0),
  is_flagged BOOLEAN DEFAULT false,
  preferences JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for user profile lookups
CREATE INDEX idx_user_profiles_role ON user_profiles(role);
CREATE INDEX idx_user_profiles_email ON user_profiles(email);
CREATE INDEX idx_user_profiles_active ON user_profiles(is_active) WHERE is_active = true;

-- =====================================================
-- PERMISSIONS TABLE (granular permission definitions)
-- =====================================================
CREATE TABLE IF NOT EXISTS permissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) NOT NULL UNIQUE,
  description TEXT,
  resource VARCHAR(50) NOT NULL,
  action VARCHAR(50) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- ROLE_PERMISSIONS TABLE (maps roles to permissions)
-- =====================================================
CREATE TABLE IF NOT EXISTS role_permissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  role VARCHAR(20) NOT NULL CHECK (role IN ('super_admin', 'admin', 'instructor', 'user')),
  permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(role, permission_id)
);

CREATE INDEX idx_role_permissions_role ON role_permissions(role);

-- =====================================================
-- AUDIT_LOGS TABLE (tracks permission-sensitive actions)
-- =====================================================
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action VARCHAR(100) NOT NULL,
  resource_type VARCHAR(50) NOT NULL,
  resource_id UUID,
  old_values JSONB,
  new_values JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_audit_logs_user ON audit_logs(user_id, created_at DESC);
CREATE INDEX idx_audit_logs_resource ON audit_logs(resource_type, resource_id);
CREATE INDEX idx_audit_logs_action ON audit_logs(action, created_at DESC);

-- =====================================================
-- NOTIFICATION_TEMPLATES TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS notification_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  type VARCHAR(50) NOT NULL UNIQUE,
  name VARCHAR(100) NOT NULL,
  subject VARCHAR(200),
  body_html TEXT NOT NULL,
  body_text TEXT NOT NULL,
  variables JSONB DEFAULT '[]',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- NOTIFICATIONS TABLE (sent notifications log)
-- =====================================================
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  template_id UUID REFERENCES notification_templates(id) ON DELETE SET NULL,
  type VARCHAR(50) NOT NULL,
  channel VARCHAR(20) NOT NULL CHECK (channel IN ('email', 'push', 'sms', 'in_app')),
  subject VARCHAR(200),
  body TEXT NOT NULL,
  data JSONB DEFAULT '{}',
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'delivered', 'failed', 'read')),
  sent_at TIMESTAMPTZ,
  read_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_notifications_user ON notifications(user_id, created_at DESC);
CREATE INDEX idx_notifications_status ON notifications(status) WHERE status = 'pending';
CREATE INDEX idx_notifications_unread ON notifications(user_id, read_at) WHERE read_at IS NULL;

-- =====================================================
-- USER_NOTIFICATION_PREFERENCES TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS user_notification_preferences (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  email_enabled BOOLEAN DEFAULT true,
  push_enabled BOOLEAN DEFAULT true,
  sms_enabled BOOLEAN DEFAULT false,
  booking_reminders BOOLEAN DEFAULT true,
  marketing_emails BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- PUSH_SUBSCRIPTIONS TABLE (for web push)
-- =====================================================
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh_key TEXT NOT NULL,
  auth_key TEXT NOT NULL,
  device_type VARCHAR(20),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_push_subscriptions_user ON push_subscriptions(user_id) WHERE is_active = true;

-- =====================================================
-- PACKAGES TABLE
-- Available token packages that users can purchase
-- MUST BE CREATED BEFORE payments and user_packages
-- =====================================================
CREATE TABLE IF NOT EXISTS packages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) NOT NULL,
  description TEXT,
  token_count INTEGER NOT NULL CHECK (token_count > 0),
  price_cents INTEGER NOT NULL CHECK (price_cents >= 0),
  currency VARCHAR(3) DEFAULT 'USD',
  validity_days INTEGER NOT NULL CHECK (validity_days > 0),
  class_types TEXT[] DEFAULT ARRAY['all'], -- which class types tokens can be used for
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for active packages lookup
CREATE INDEX idx_packages_active ON packages(is_active) WHERE is_active = true;

-- =====================================================
-- PAYMENTS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  package_id UUID REFERENCES packages(id) ON DELETE SET NULL,
  amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
  currency VARCHAR(3) DEFAULT 'USD',
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'succeeded', 'failed', 'refunded', 'partially_refunded')),
  payment_method VARCHAR(50),
  stripe_payment_intent_id VARCHAR(255) UNIQUE,
  stripe_customer_id VARCHAR(255),
  stripe_charge_id VARCHAR(255),
  receipt_url TEXT,
  failure_reason TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_payments_user ON payments(user_id, created_at DESC);
CREATE INDEX idx_payments_stripe ON payments(stripe_payment_intent_id);
CREATE INDEX idx_payments_status ON payments(status);

-- =====================================================
-- INVOICES TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS invoices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  payment_id UUID REFERENCES payments(id) ON DELETE SET NULL,
  invoice_number VARCHAR(50) NOT NULL UNIQUE,
  amount_cents INTEGER NOT NULL CHECK (amount_cents >= 0),
  tax_cents INTEGER DEFAULT 0 CHECK (tax_cents >= 0),
  total_cents INTEGER NOT NULL CHECK (total_cents >= 0),
  currency VARCHAR(3) DEFAULT 'USD',
  status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'issued', 'paid', 'void', 'overdue')),
  pdf_url TEXT,
  issued_at TIMESTAMPTZ,
  due_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_invoices_user ON invoices(user_id, created_at DESC);
CREATE INDEX idx_invoices_number ON invoices(invoice_number);

-- =====================================================
-- STRIPE_CUSTOMERS TABLE (cache stripe customer data)
-- =====================================================
CREATE TABLE IF NOT EXISTS stripe_customers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  stripe_customer_id VARCHAR(255) NOT NULL UNIQUE,
  default_payment_method_id VARCHAR(255),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- USER_STATS TABLE (denormalized for performance)
-- =====================================================
CREATE TABLE IF NOT EXISTS user_stats (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  total_classes_attended INTEGER DEFAULT 0,
  total_classes_booked INTEGER DEFAULT 0,
  total_no_shows INTEGER DEFAULT 0,
  total_late_cancels INTEGER DEFAULT 0,
  total_tokens_purchased INTEGER DEFAULT 0,
  total_tokens_used INTEGER DEFAULT 0,
  total_spent_cents INTEGER DEFAULT 0,
  favorite_class_type VARCHAR(50),
  favorite_instructor_id UUID,
  streak_current INTEGER DEFAULT 0,
  streak_longest INTEGER DEFAULT 0,
  last_class_at TIMESTAMPTZ,
  member_since TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- DAILY_METRICS TABLE (aggregated analytics)
-- =====================================================
CREATE TABLE IF NOT EXISTS daily_metrics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  date DATE NOT NULL,
  metric_type VARCHAR(50) NOT NULL,
  value NUMERIC NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(date, metric_type)
);

CREATE INDEX idx_daily_metrics_date ON daily_metrics(date DESC);
CREATE INDEX idx_daily_metrics_type ON daily_metrics(metric_type, date DESC);

-- =====================================================
-- CLASSES TABLE
-- Individual class sessions that users can book
-- =====================================================
CREATE TABLE IF NOT EXISTS classes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title VARCHAR(200) NOT NULL,
  description TEXT,
  class_type VARCHAR(50) NOT NULL CHECK (class_type IN ('zumba', 'yoga', 'pilates', 'hiit', 'dance', 'strength', 'cardio', 'stretch')),
  level VARCHAR(20) DEFAULT 'all_levels' CHECK (level IN ('beginner', 'intermediate', 'advanced', 'all_levels')),
  instructor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  instructor_name VARCHAR(100),
  scheduled_at TIMESTAMPTZ NOT NULL,
  duration_minutes INTEGER NOT NULL DEFAULT 60 CHECK (duration_minutes > 0),
  capacity INTEGER NOT NULL CHECK (capacity > 0),
  token_cost INTEGER DEFAULT 1 CHECK (token_cost > 0),
  location VARCHAR(200),
  status VARCHAR(20) DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'in-progress', 'completed', 'cancelled')),
  cancellation_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for class lookups
CREATE INDEX idx_classes_scheduled ON classes(scheduled_at);
CREATE INDEX idx_classes_status ON classes(status);
CREATE INDEX idx_classes_instructor ON classes(instructor_id);

-- =====================================================
-- USER_PACKAGES TABLE
-- Token packages purchased by users
-- =====================================================
CREATE TABLE IF NOT EXISTS user_packages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  package_id UUID REFERENCES packages(id) ON DELETE SET NULL,
  tokens_remaining INTEGER NOT NULL CHECK (tokens_remaining >= 0),
  tokens_held INTEGER DEFAULT 0 CHECK (tokens_held >= 0),
  purchased_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  frozen_at TIMESTAMPTZ,
  frozen_until TIMESTAMPTZ,
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'expired', 'depleted', 'frozen', 'refunded')),
  payment_id VARCHAR(255),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT tokens_held_check CHECK (tokens_held <= tokens_remaining)
);

-- Indexes for user package lookups
CREATE INDEX idx_user_packages_user ON user_packages(user_id);
CREATE INDEX idx_user_packages_status ON user_packages(status);
CREATE INDEX idx_user_packages_expiry ON user_packages(expires_at);

-- =====================================================
-- REFUNDS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS refunds (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  payment_id UUID NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
  user_package_id UUID REFERENCES user_packages(id) ON DELETE SET NULL,
  amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
  reason TEXT,
  stripe_refund_id VARCHAR(255),
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'succeeded', 'failed')),
  processed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_refunds_payment ON refunds(payment_id);

-- =====================================================
-- BOOKINGS TABLE
-- Class bookings made by users
-- =====================================================
CREATE TABLE IF NOT EXISTS bookings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  user_package_id UUID REFERENCES user_packages(id) ON DELETE SET NULL,
  tokens_used INTEGER DEFAULT 1 CHECK (tokens_used > 0),
  status VARCHAR(20) DEFAULT 'confirmed' CHECK (status IN ('confirmed', 'waitlist', 'cancelled', 'cancelled-late', 'attended', 'no-show')),
  booked_at TIMESTAMPTZ DEFAULT NOW(),
  cancelled_at TIMESTAMPTZ,
  cancellation_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, class_id) -- one booking per user per class
);

-- Indexes for booking lookups
CREATE INDEX idx_bookings_user ON bookings(user_id);
CREATE INDEX idx_bookings_class ON bookings(class_id);
CREATE INDEX idx_bookings_status ON bookings(status);

-- =====================================================
-- ATTENDANCES TABLE
-- Check-in records for class attendance
-- =====================================================
CREATE TABLE IF NOT EXISTS attendances (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE UNIQUE,
  checked_in_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  checked_in_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  check_in_method VARCHAR(20) DEFAULT 'manual' CHECK (check_in_method IN ('manual', 'qr-code', 'auto', 'admin')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for attendance lookups
CREATE INDEX idx_attendances_booking ON attendances(booking_id);

-- =====================================================
-- TOKEN_TRANSACTIONS TABLE
-- Audit log for all token operations
-- =====================================================
CREATE TABLE IF NOT EXISTS token_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_package_id UUID REFERENCES user_packages(id) ON DELETE SET NULL,
  booking_id UUID REFERENCES bookings(id) ON DELETE SET NULL,
  transaction_type VARCHAR(30) NOT NULL CHECK (transaction_type IN (
    'purchase', 'booking-hold', 'booking-release', 'attendance-consume',
    'no-show-consume', 'late-cancel-consume', 'admin-adjust', 'refund', 'expire'
  )),
  tokens_change INTEGER NOT NULL, -- positive = add, negative = subtract
  tokens_before INTEGER NOT NULL CHECK (tokens_before >= 0),
  tokens_after INTEGER NOT NULL CHECK (tokens_after >= 0),
  description TEXT,
  performed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for transaction lookups
CREATE INDEX idx_token_transactions_user ON token_transactions(user_id);
CREATE INDEX idx_token_transactions_type ON token_transactions(transaction_type);
CREATE INDEX idx_token_transactions_created ON token_transactions(created_at);

-- =====================================================
-- WAITLIST TABLE
-- Waitlist entries for full classes
-- =====================================================
CREATE TABLE IF NOT EXISTS waitlist (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  position INTEGER NOT NULL CHECK (position > 0),
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  notified_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ, -- when notification expires
  status VARCHAR(20) DEFAULT 'waiting' CHECK (status IN ('waiting', 'notified', 'converted', 'expired', 'cancelled')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, class_id) -- one waitlist entry per user per class
);

-- Indexes for waitlist lookups
CREATE INDEX idx_waitlist_class ON waitlist(class_id);
CREATE INDEX idx_waitlist_user ON waitlist(user_id);
CREATE INDEX idx_waitlist_status ON waitlist(status);

-- =====================================================
-- UPDATED_AT TRIGGER
-- Automatically update updated_at timestamp
-- =====================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply trigger to all tables with updated_at
CREATE TRIGGER update_packages_updated_at
  BEFORE UPDATE ON packages
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_classes_updated_at
  BEFORE UPDATE ON classes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_packages_updated_at
  BEFORE UPDATE ON user_packages
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_bookings_updated_at
  BEFORE UPDATE ON bookings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- =====================================================

-- Enable RLS on all tables
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE refunds ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE stripe_customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendances ENABLE ROW LEVEL SECURITY;
ALTER TABLE token_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE waitlist ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- RBAC HELPER FUNCTIONS
-- =====================================================

-- Get user role from profile
CREATE OR REPLACE FUNCTION get_user_role(user_id UUID)
RETURNS VARCHAR AS $$
  SELECT role FROM user_profiles WHERE id = user_id;
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- Check if user is admin or above
CREATE OR REPLACE FUNCTION is_admin_or_above(user_id UUID)
RETURNS BOOLEAN AS $$
  SELECT COALESCE(
    (SELECT role IN ('super_admin', 'admin') FROM user_profiles WHERE id = user_id),
    false
  );
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- Check if user is instructor or above
CREATE OR REPLACE FUNCTION is_instructor_or_above(user_id UUID)
RETURNS BOOLEAN AS $$
  SELECT COALESCE(
    (SELECT role IN ('super_admin', 'admin', 'instructor') FROM user_profiles WHERE id = user_id),
    false
  );
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- Check if user is super admin
CREATE OR REPLACE FUNCTION is_super_admin(user_id UUID)
RETURNS BOOLEAN AS $$
  SELECT COALESCE(
    (SELECT role = 'super_admin' FROM user_profiles WHERE id = user_id),
    false
  );
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- =====================================================
-- USER_PROFILES POLICIES
-- =====================================================

-- Users can view their own profile
CREATE POLICY "Users can view own profile"
  ON user_profiles FOR SELECT
  USING (auth.uid() = id);

-- Admins can view all profiles
CREATE POLICY "Admins can view all profiles"
  ON user_profiles FOR SELECT
  USING (is_admin_or_above(auth.uid()));

-- Users can update their own profile (except role)
CREATE POLICY "Users can update own profile"
  ON user_profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id AND 
    role = (SELECT role FROM user_profiles WHERE id = auth.uid())
  );

-- Admins can update any profile
CREATE POLICY "Admins can update any profile"
  ON user_profiles FOR UPDATE
  USING (is_admin_or_above(auth.uid()));

-- Only super_admin can delete users
CREATE POLICY "Super admin can delete users"
  ON user_profiles FOR DELETE
  USING (is_super_admin(auth.uid()));

-- System can insert profiles (via trigger)
-- This policy allows the trigger function to insert user profiles
CREATE POLICY "System can insert profiles"
  ON user_profiles FOR INSERT
  WITH CHECK (true);

-- =====================================================
-- PACKAGES POLICIES
-- =====================================================

-- Anyone can view active packages
CREATE POLICY "Anyone can view active packages"
  ON packages FOR SELECT
  USING (is_active = true OR is_admin_or_above(auth.uid()));

-- Only admins can create packages
CREATE POLICY "Admins can create packages"
  ON packages FOR INSERT
  WITH CHECK (is_admin_or_above(auth.uid()));

-- Only admins can update packages
CREATE POLICY "Admins can update packages"
  ON packages FOR UPDATE
  USING (is_admin_or_above(auth.uid()));

-- Only admins can delete packages
CREATE POLICY "Admins can delete packages"
  ON packages FOR DELETE
  USING (is_admin_or_above(auth.uid()));

-- =====================================================
-- CLASSES POLICIES
-- =====================================================

-- Anyone can view scheduled classes
CREATE POLICY "Anyone can view classes"
  ON classes FOR SELECT
  USING (status IN ('scheduled', 'in-progress') OR is_admin_or_above(auth.uid()));

-- Instructors can create classes assigned to them
CREATE POLICY "Staff can create classes"
  ON classes FOR INSERT
  WITH CHECK (
    is_admin_or_above(auth.uid()) OR 
    (is_instructor_or_above(auth.uid()) AND instructor_id = auth.uid())
  );

-- Instructors can update their own classes
CREATE POLICY "Staff can update classes"
  ON classes FOR UPDATE
  USING (
    is_admin_or_above(auth.uid()) OR 
    (instructor_id = auth.uid() AND is_instructor_or_above(auth.uid()))
  );

-- Only admins can delete classes
CREATE POLICY "Admins can delete classes"
  ON classes FOR DELETE
  USING (is_admin_or_above(auth.uid()));

-- =====================================================
-- USER_PACKAGES POLICIES
-- =====================================================

-- Users can view their own packages
CREATE POLICY "Users can view own packages"
  ON user_packages FOR SELECT
  USING (user_id = auth.uid());

-- Admins can view all user packages
CREATE POLICY "Admins can view all user packages"
  ON user_packages FOR SELECT
  USING (is_admin_or_above(auth.uid()));

-- System can create user packages (after purchase)
CREATE POLICY "System can create user packages"
  ON user_packages FOR INSERT
  WITH CHECK (user_id = auth.uid() OR is_admin_or_above(auth.uid()));

-- System/Admins can update user packages
CREATE POLICY "System can update user packages"
  ON user_packages FOR UPDATE
  USING (user_id = auth.uid() OR is_admin_or_above(auth.uid()));

-- =====================================================
-- BOOKINGS POLICIES
-- =====================================================

-- Users can view their own bookings
CREATE POLICY "Users can view own bookings"
  ON bookings FOR SELECT
  USING (user_id = auth.uid());

-- Admins can view all bookings
CREATE POLICY "Admins can view all bookings"
  ON bookings FOR SELECT
  USING (is_admin_or_above(auth.uid()));

-- Instructors can view bookings for their classes
CREATE POLICY "Instructors can view class bookings"
  ON bookings FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM classes 
      WHERE classes.id = bookings.class_id 
      AND classes.instructor_id = auth.uid()
    )
  );

-- Users can create their own bookings
CREATE POLICY "Users can create own bookings"
  ON bookings FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Users can update their own bookings (cancel)
CREATE POLICY "Users can update own bookings"
  ON bookings FOR UPDATE
  USING (user_id = auth.uid());

-- Admins can update any booking
CREATE POLICY "Admins can update any booking"
  ON bookings FOR UPDATE
  USING (is_admin_or_above(auth.uid()));

-- Instructors can update bookings for their classes
CREATE POLICY "Instructors can update class bookings"
  ON bookings FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM classes 
      WHERE classes.id = bookings.class_id 
      AND classes.instructor_id = auth.uid()
    )
  );

-- =====================================================
-- ATTENDANCES POLICIES
-- =====================================================

-- Users can view their own attendance
CREATE POLICY "Users can view own attendance"
  ON attendances FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM bookings 
      WHERE bookings.id = attendances.booking_id 
      AND bookings.user_id = auth.uid()
    )
  );

-- Staff can view class attendance
CREATE POLICY "Staff can view class attendance"
  ON attendances FOR SELECT
  USING (
    is_admin_or_above(auth.uid()) OR
    EXISTS (
      SELECT 1 FROM bookings b
      JOIN classes c ON b.class_id = c.id
      WHERE b.id = attendances.booking_id
      AND c.instructor_id = auth.uid()
    )
  );

-- Only staff can create attendance records
CREATE POLICY "Staff can create attendance"
  ON attendances FOR INSERT
  WITH CHECK (is_instructor_or_above(auth.uid()));

-- =====================================================
-- TOKEN_TRANSACTIONS POLICIES
-- =====================================================

-- Users can view their own transactions
CREATE POLICY "Users can view own transactions"
  ON token_transactions FOR SELECT
  USING (user_id = auth.uid());

-- Admins can view all transactions
CREATE POLICY "Admins can view all transactions"
  ON token_transactions FOR SELECT
  USING (is_admin_or_above(auth.uid()));

-- System can create transactions
CREATE POLICY "System can create transactions"
  ON token_transactions FOR INSERT
  WITH CHECK (user_id = auth.uid() OR is_admin_or_above(auth.uid()));

-- =====================================================
-- WAITLIST POLICIES
-- =====================================================

-- Users can view their own waitlist entries
CREATE POLICY "Users can view own waitlist"
  ON waitlist FOR SELECT
  USING (user_id = auth.uid());

-- Admins can view all waitlist entries
CREATE POLICY "Admins can view all waitlist"
  ON waitlist FOR SELECT
  USING (is_admin_or_above(auth.uid()));

-- Users can join waitlist
CREATE POLICY "Users can join waitlist"
  ON waitlist FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Users can update their waitlist (leave)
CREATE POLICY "Users can update own waitlist"
  ON waitlist FOR UPDATE
  USING (user_id = auth.uid());

-- Admins can manage all waitlist
CREATE POLICY "Admins can manage waitlist"
  ON waitlist FOR ALL
  USING (is_admin_or_above(auth.uid()));

-- =====================================================
-- NOTIFICATIONS POLICIES
-- =====================================================

-- Users can view their own notifications
CREATE POLICY "Users can view own notifications"
  ON notifications FOR SELECT
  USING (user_id = auth.uid());

-- Users can update their own notifications (mark read)
CREATE POLICY "Users can update own notifications"
  ON notifications FOR UPDATE
  USING (user_id = auth.uid());

-- System can create notifications
CREATE POLICY "System can create notifications"
  ON notifications FOR INSERT
  WITH CHECK (is_admin_or_above(auth.uid()) OR user_id = auth.uid());

-- =====================================================
-- USER_NOTIFICATION_PREFERENCES POLICIES
-- =====================================================

-- Users can view their own preferences
CREATE POLICY "Users can view own notification prefs"
  ON user_notification_preferences FOR SELECT
  USING (user_id = auth.uid());

-- Users can update their own preferences
CREATE POLICY "Users can update own notification prefs"
  ON user_notification_preferences FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- System can create notification preferences (via trigger)
CREATE POLICY "System can create notification prefs"
  ON user_notification_preferences FOR INSERT
  WITH CHECK (true);

-- =====================================================
-- PAYMENTS POLICIES
-- =====================================================

-- Users can view their own payments
CREATE POLICY "Users can view own payments"
  ON payments FOR SELECT
  USING (user_id = auth.uid());

-- Admins can view all payments
CREATE POLICY "Admins can view all payments"
  ON payments FOR SELECT
  USING (is_admin_or_above(auth.uid()));

-- System can create payments
CREATE POLICY "System can create payments"
  ON payments FOR INSERT
  WITH CHECK (user_id = auth.uid() OR is_admin_or_above(auth.uid()));

-- System can update payments
CREATE POLICY "System can update payments"
  ON payments FOR UPDATE
  USING (is_admin_or_above(auth.uid()));

-- =====================================================
-- INVOICES POLICIES
-- =====================================================

-- Users can view their own invoices
CREATE POLICY "Users can view own invoices"
  ON invoices FOR SELECT
  USING (user_id = auth.uid());

-- Admins can manage all invoices
CREATE POLICY "Admins can manage invoices"
  ON invoices FOR ALL
  USING (is_admin_or_above(auth.uid()));

-- =====================================================
-- USER_STATS POLICIES
-- =====================================================

-- Users can view their own stats
CREATE POLICY "Users can view own stats"
  ON user_stats FOR SELECT
  USING (user_id = auth.uid());

-- Admins can view all stats
CREATE POLICY "Admins can view all stats"
  ON user_stats FOR SELECT
  USING (is_admin_or_above(auth.uid()));

-- System can manage stats (via trigger)
CREATE POLICY "System can manage stats"
  ON user_stats FOR ALL
  USING (true);

-- =====================================================
-- AUDIT_LOGS POLICIES
-- =====================================================

-- Only admins can view audit logs
CREATE POLICY "Admins can view audit logs"
  ON audit_logs FOR SELECT
  USING (is_admin_or_above(auth.uid()));

-- System can create audit logs
CREATE POLICY "System can create audit logs"
  ON audit_logs FOR INSERT
  WITH CHECK (true);

-- =====================================================
-- DAILY_METRICS POLICIES
-- =====================================================

-- Only admins can view metrics
CREATE POLICY "Admins can view metrics"
  ON daily_metrics FOR SELECT
  USING (is_admin_or_above(auth.uid()));

-- System can manage metrics
CREATE POLICY "System can manage metrics"
  ON daily_metrics FOR ALL
  USING (is_admin_or_above(auth.uid()));

-- =====================================================
-- SAMPLE DATA (Optional - for testing)
-- Uncomment to insert sample packages
-- =====================================================

-- INSERT INTO packages (name, description, token_count, price_cents, validity_days, class_types) VALUES
-- ('Trial Pack', 'Perfect for trying out our classes', 3, 2500, 14, ARRAY['all']),
-- ('Starter Pack', 'Great value for regular attendees', 10, 7500, 30, ARRAY['all']),
-- ('Pro Pack', 'Best value for dedicated members', 25, 15000, 60, ARRAY['all']),
-- ('Unlimited Month', 'Unlimited classes for one month', 100, 25000, 30, ARRAY['all']);

-- =====================================================
-- AUTO-CREATE USER PROFILE TRIGGER
-- Creates profile when user signs up via Supabase Auth
-- =====================================================

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Insert user profile
  INSERT INTO public.user_profiles (id, email, name, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.email, ''),
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(COALESCE(NEW.email, 'unknown@example.com'), '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'role', 'user')
  )
  ON CONFLICT (id) DO NOTHING;
  
  -- Also create notification preferences with defaults
  INSERT INTO public.user_notification_preferences (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  
  -- Create user stats record
  INSERT INTO public.user_stats (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log error but don't fail user creation
    RAISE WARNING 'Error in handle_new_user trigger: %', SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger on auth.users insert
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- =====================================================
-- AUDIT LOG FUNCTION
-- Call this to log actions for audit trail
-- =====================================================

CREATE OR REPLACE FUNCTION create_audit_log(
  p_action VARCHAR,
  p_resource_type VARCHAR,
  p_resource_id UUID DEFAULT NULL,
  p_old_values JSONB DEFAULT NULL,
  p_new_values JSONB DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  log_id UUID;
BEGIN
  INSERT INTO audit_logs (user_id, action, resource_type, resource_id, old_values, new_values)
  VALUES (auth.uid(), p_action, p_resource_type, p_resource_id, p_old_values, p_new_values)
  RETURNING id INTO log_id;
  
  RETURN log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- INVOICE NUMBER GENERATOR
-- =====================================================

CREATE OR REPLACE FUNCTION generate_invoice_number()
RETURNS VARCHAR AS $$
DECLARE
  new_number VARCHAR;
  year_part VARCHAR;
  seq_part INTEGER;
BEGIN
  year_part := TO_CHAR(NOW(), 'YYYY');
  
  SELECT COALESCE(MAX(CAST(SUBSTRING(invoice_number FROM 6) AS INTEGER)), 0) + 1
  INTO seq_part
  FROM invoices
  WHERE invoice_number LIKE 'INV-' || year_part || '-%';
  
  new_number := 'INV-' || year_part || '-' || LPAD(seq_part::TEXT, 6, '0');
  
  RETURN new_number;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- VIEWS (for common queries)
-- =====================================================

-- Active user token balances
CREATE OR REPLACE VIEW user_token_balances AS
SELECT 
  user_id,
  SUM(tokens_remaining) as total_tokens,
  SUM(tokens_held) as held_tokens,
  SUM(tokens_remaining) - SUM(tokens_held) as available_tokens,
  MIN(expires_at) as next_expiry,
  COUNT(*) as active_packages
FROM user_packages
WHERE status = 'active' AND expires_at > NOW()
GROUP BY user_id;

-- Upcoming classes with booking counts
CREATE OR REPLACE VIEW upcoming_classes_summary AS
SELECT 
  c.*,
  COUNT(b.id) FILTER (WHERE b.status = 'confirmed') as booked_count,
  c.capacity - COUNT(b.id) FILTER (WHERE b.status = 'confirmed') as spots_available,
  COUNT(w.id) FILTER (WHERE w.status = 'waiting') as waitlist_count
FROM classes c
LEFT JOIN bookings b ON c.id = b.class_id
LEFT JOIN waitlist w ON c.id = w.class_id
WHERE c.scheduled_at > NOW() AND c.status = 'scheduled'
GROUP BY c.id
ORDER BY c.scheduled_at;

-- User profile with stats view
CREATE OR REPLACE VIEW user_profiles_with_stats AS
SELECT 
  up.*,
  us.total_classes_attended,
  us.total_classes_booked,
  us.total_no_shows,
  us.total_tokens_purchased,
  us.total_tokens_used,
  us.total_spent_cents,
  us.streak_current,
  us.streak_longest,
  us.last_class_at,
  utb.total_tokens as current_token_balance,
  utb.available_tokens as current_available_tokens
FROM user_profiles up
LEFT JOIN user_stats us ON up.id = us.user_id
LEFT JOIN user_token_balances utb ON up.id = utb.user_id;

-- Admin dashboard metrics view
CREATE OR REPLACE VIEW admin_dashboard_metrics AS
SELECT
  (SELECT COUNT(*) FROM user_profiles WHERE is_active = true) as total_active_users,
  (SELECT COUNT(*) FROM user_profiles WHERE created_at > NOW() - INTERVAL '30 days') as new_users_30d,
  (SELECT COUNT(*) FROM classes WHERE scheduled_at > NOW() AND status = 'scheduled') as upcoming_classes,
  (SELECT COUNT(*) FROM bookings WHERE status = 'confirmed') as active_bookings,
  (SELECT COALESCE(SUM(amount_cents), 0) FROM payments WHERE status = 'succeeded' AND created_at > NOW() - INTERVAL '30 days') as revenue_30d_cents,
  (SELECT COUNT(*) FROM payments WHERE status = 'succeeded' AND created_at > NOW() - INTERVAL '30 days') as transactions_30d;

-- =====================================================
-- INSERT DEFAULT PERMISSIONS
-- =====================================================

INSERT INTO permissions (name, description, resource, action) VALUES
-- User permissions
('users.view_all', 'View all users', 'users', 'view_all'),
('users.view_own', 'View own profile', 'users', 'view_own'),
('users.edit_all', 'Edit any user', 'users', 'edit_all'),
('users.edit_own', 'Edit own profile', 'users', 'edit_own'),
('users.delete', 'Delete users', 'users', 'delete'),
('users.change_role', 'Change user roles', 'users', 'change_role'),

-- Package permissions
('packages.view', 'View packages', 'packages', 'view'),
('packages.create', 'Create packages', 'packages', 'create'),
('packages.edit', 'Edit packages', 'packages', 'edit'),
('packages.delete', 'Delete packages', 'packages', 'delete'),
('packages.purchase', 'Purchase packages', 'packages', 'purchase'),

-- Class permissions
('classes.view', 'View classes', 'classes', 'view'),
('classes.create', 'Create classes', 'classes', 'create'),
('classes.edit_all', 'Edit any class', 'classes', 'edit_all'),
('classes.edit_own', 'Edit own classes', 'classes', 'edit_own'),
('classes.cancel_all', 'Cancel any class', 'classes', 'cancel_all'),
('classes.cancel_own', 'Cancel own classes', 'classes', 'cancel_own'),

-- Booking permissions
('bookings.view_all', 'View all bookings', 'bookings', 'view_all'),
('bookings.view_own', 'View own bookings', 'bookings', 'view_own'),
('bookings.create', 'Create bookings', 'bookings', 'create'),
('bookings.cancel_all', 'Cancel any booking', 'bookings', 'cancel_all'),
('bookings.cancel_own', 'Cancel own bookings', 'bookings', 'cancel_own'),

-- Attendance permissions
('attendance.view_all', 'View all attendance', 'attendance', 'view_all'),
('attendance.view_own', 'View own attendance', 'attendance', 'view_own'),
('attendance.check_in', 'Check in users', 'attendance', 'check_in'),
('attendance.mark_no_show', 'Mark no-shows', 'attendance', 'mark_no_show'),

-- Token permissions
('tokens.view_all', 'View all token balances', 'tokens', 'view_all'),
('tokens.view_own', 'View own token balance', 'tokens', 'view_own'),
('tokens.adjust', 'Adjust tokens manually', 'tokens', 'adjust'),

-- Analytics permissions
('analytics.view', 'View analytics', 'analytics', 'view'),
('analytics.export', 'Export analytics', 'analytics', 'export'),

-- Settings permissions
('settings.system', 'Manage system settings', 'settings', 'system'),
('settings.gym', 'Manage gym settings', 'settings', 'gym')
ON CONFLICT (name) DO NOTHING;

-- =====================================================
-- ASSIGN PERMISSIONS TO ROLES
-- =====================================================

-- Super Admin gets everything
INSERT INTO role_permissions (role, permission_id)
SELECT 'super_admin', id FROM permissions
ON CONFLICT DO NOTHING;

-- Admin gets most things except system settings and user deletion
INSERT INTO role_permissions (role, permission_id)
SELECT 'admin', id FROM permissions 
WHERE name NOT IN ('users.delete', 'users.change_role', 'settings.system')
ON CONFLICT DO NOTHING;

-- Instructor gets limited permissions
INSERT INTO role_permissions (role, permission_id)
SELECT 'instructor', id FROM permissions 
WHERE name IN (
  'users.view_own', 'users.edit_own',
  'packages.view',
  'classes.view', 'classes.create', 'classes.edit_own', 'classes.cancel_own',
  'bookings.view_own',
  'attendance.view_own', 'attendance.check_in', 'attendance.mark_no_show',
  'tokens.view_own'
)
ON CONFLICT DO NOTHING;

-- User gets basic permissions
INSERT INTO role_permissions (role, permission_id)
SELECT 'user', id FROM permissions 
WHERE name IN (
  'users.view_own', 'users.edit_own',
  'packages.view', 'packages.purchase',
  'classes.view',
  'bookings.view_own', 'bookings.create', 'bookings.cancel_own',
  'attendance.view_own',
  'tokens.view_own'
)
ON CONFLICT DO NOTHING;

-- =====================================================
-- INSERT DEFAULT NOTIFICATION TEMPLATES
-- =====================================================

INSERT INTO notification_templates (type, name, subject, body_html, body_text, variables) VALUES
('booking_confirmation', 'Booking Confirmation', 'Your class is booked! 🎉', 
  '<h1>Booking Confirmed!</h1><p>Hi {{user_name}},</p><p>You''re all set for <strong>{{class_title}}</strong> on {{class_date}} at {{class_time}}.</p><p>Location: {{class_location}}</p><p>See you there!</p>',
  'Booking Confirmed! Hi {{user_name}}, You''re all set for {{class_title}} on {{class_date}} at {{class_time}}. Location: {{class_location}}. See you there!',
  '["user_name", "class_title", "class_date", "class_time", "class_location"]'),

('booking_reminder', 'Class Reminder', 'Reminder: Your class starts in 2 hours ⏰', 
  '<h1>Class Starting Soon!</h1><p>Hi {{user_name}},</p><p>Just a reminder that <strong>{{class_title}}</strong> starts in 2 hours at {{class_time}}.</p><p>Location: {{class_location}}</p>',
  'Class Starting Soon! Hi {{user_name}}, Just a reminder that {{class_title}} starts in 2 hours at {{class_time}}. Location: {{class_location}}',
  '["user_name", "class_title", "class_time", "class_location"]'),

('booking_cancelled', 'Booking Cancelled', 'Your booking has been cancelled',
  '<h1>Booking Cancelled</h1><p>Hi {{user_name}},</p><p>Your booking for <strong>{{class_title}}</strong> on {{class_date}} has been cancelled.</p><p>{{refund_message}}</p>',
  'Booking Cancelled. Hi {{user_name}}, Your booking for {{class_title}} on {{class_date}} has been cancelled. {{refund_message}}',
  '["user_name", "class_title", "class_date", "refund_message"]'),

('waitlist_spot_available', 'Waitlist Spot Available', 'A spot opened up! 🎊',
  '<h1>Good News!</h1><p>Hi {{user_name}},</p><p>A spot just opened up in <strong>{{class_title}}</strong> on {{class_date}}!</p><p>You have 30 minutes to confirm your booking.</p><p><a href="{{confirm_url}}">Confirm Now</a></p>',
  'Good News! Hi {{user_name}}, A spot just opened up in {{class_title}} on {{class_date}}! You have 30 minutes to confirm. Confirm here: {{confirm_url}}',
  '["user_name", "class_title", "class_date", "confirm_url"]'),

('token_balance_low', 'Low Token Balance', 'Running low on tokens ⚠️',
  '<h1>Low Token Balance</h1><p>Hi {{user_name}},</p><p>You only have <strong>{{token_count}}</strong> tokens remaining.</p><p><a href="{{purchase_url}}">Get More Tokens</a></p>',
  'Low Token Balance. Hi {{user_name}}, You only have {{token_count}} tokens remaining. Get more here: {{purchase_url}}',
  '["user_name", "token_count", "purchase_url"]'),

('package_expiring', 'Package Expiring Soon', 'Your tokens expire in 3 days ⚠️',
  '<h1>Tokens Expiring Soon</h1><p>Hi {{user_name}},</p><p>You have <strong>{{token_count}}</strong> tokens expiring on {{expiry_date}}.</p><p>Use them before they expire!</p>',
  'Tokens Expiring Soon. Hi {{user_name}}, You have {{token_count}} tokens expiring on {{expiry_date}}. Use them before they expire!',
  '["user_name", "token_count", "expiry_date"]'),

('payment_successful', 'Payment Received', 'Thank you for your purchase! 🙏',
  '<h1>Payment Successful</h1><p>Hi {{user_name}},</p><p>Thank you for purchasing <strong>{{package_name}}</strong>!</p><p>{{token_count}} tokens have been added to your account.</p><p>Amount: ${{amount}}</p>',
  'Payment Successful. Hi {{user_name}}, Thank you for purchasing {{package_name}}! {{token_count}} tokens have been added. Amount: ${{amount}}',
  '["user_name", "package_name", "token_count", "amount"]'),

('welcome', 'Welcome to Zumbaton', 'Welcome to Zumbaton! 🎉',
  '<h1>Welcome to Zumbaton!</h1><p>Hi {{user_name}},</p><p>We''re excited to have you join our fitness community!</p><p>Get started by browsing our classes and purchasing a token package.</p>',
  'Welcome to Zumbaton! Hi {{user_name}}, We''re excited to have you join our fitness community! Get started by browsing our classes.',
  '["user_name"]')
ON CONFLICT (type) DO NOTHING;
