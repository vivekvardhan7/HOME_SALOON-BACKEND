-- Comprehensive Admin RLS Policies for HOME BONZENGA
-- This migration adds admin policies for ALL tables to allow admins to view/manage all data

-- Helper function to check if current user is admin
-- This function uses SECURITY DEFINER to bypass RLS when checking admin status
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.users 
    WHERE users.id = auth.uid() 
    AND users.role = 'ADMIN'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- IMPORTANT: Ensure users can ALWAYS view their own profile (this should already exist but adding for safety)
-- This policy must exist BEFORE admin policies to allow the admin check to work
DROP POLICY IF EXISTS "Users can view their own profile" ON users;
CREATE POLICY "Users can view their own profile" ON users
  FOR SELECT USING (auth.uid() = id);

-- ============================================
-- USERS TABLE POLICIES
-- ============================================
-- Drop existing admin policies if they exist
DROP POLICY IF EXISTS "Admins can view all users" ON users;
DROP POLICY IF EXISTS "Admins can update all users" ON users;
DROP POLICY IF EXISTS "Admins can insert users" ON users;
DROP POLICY IF EXISTS "Admins can delete users" ON users;

-- Create comprehensive admin policies for users
CREATE POLICY "Admins can view all users" ON users
  FOR SELECT USING (public.is_admin());

CREATE POLICY "Admins can update all users" ON users
  FOR UPDATE USING (public.is_admin());

CREATE POLICY "Admins can insert users" ON users
  FOR INSERT WITH CHECK (public.is_admin());

CREATE POLICY "Admins can delete users" ON users
  FOR DELETE USING (public.is_admin());

-- ============================================
-- VENDORS TABLE POLICIES
-- ============================================
DROP POLICY IF EXISTS "Admins can view all vendors" ON vendors;
DROP POLICY IF EXISTS "Admins can update all vendors" ON vendors;
DROP POLICY IF EXISTS "Admins can insert vendors" ON vendors;
DROP POLICY IF EXISTS "Admins can delete vendors" ON vendors;

CREATE POLICY "Admins can view all vendors" ON vendors
  FOR SELECT USING (public.is_admin());

CREATE POLICY "Admins can update all vendors" ON vendors
  FOR UPDATE USING (public.is_admin());

CREATE POLICY "Admins can insert vendors" ON vendors
  FOR INSERT WITH CHECK (public.is_admin());

CREATE POLICY "Admins can delete vendors" ON vendors
  FOR DELETE USING (public.is_admin());

-- ============================================
-- BOOKINGS TABLE POLICIES
-- ============================================
DROP POLICY IF EXISTS "Admins can view all bookings" ON bookings;
DROP POLICY IF EXISTS "Admins can update all bookings" ON bookings;
DROP POLICY IF EXISTS "Admins can insert bookings" ON bookings;
DROP POLICY IF EXISTS "Admins can delete bookings" ON bookings;

CREATE POLICY "Admins can view all bookings" ON bookings
  FOR SELECT USING (public.is_admin());

CREATE POLICY "Admins can update all bookings" ON bookings
  FOR UPDATE USING (public.is_admin());

CREATE POLICY "Admins can insert bookings" ON bookings
  FOR INSERT WITH CHECK (public.is_admin());

CREATE POLICY "Admins can delete bookings" ON bookings
  FOR DELETE USING (public.is_admin());

-- ============================================
-- PAYMENTS TABLE POLICIES
-- ============================================
DROP POLICY IF EXISTS "Admins can view all payments" ON payments;
DROP POLICY IF EXISTS "Admins can update all payments" ON payments;
DROP POLICY IF EXISTS "Admins can insert payments" ON payments;
DROP POLICY IF EXISTS "Admins can delete payments" ON payments;

CREATE POLICY "Admins can view all payments" ON payments
  FOR SELECT USING (public.is_admin());

CREATE POLICY "Admins can update all payments" ON payments
  FOR UPDATE USING (public.is_admin());

CREATE POLICY "Admins can insert payments" ON payments
  FOR INSERT WITH CHECK (public.is_admin());

CREATE POLICY "Admins can delete payments" ON payments
  FOR DELETE USING (public.is_admin());

-- ============================================
-- SERVICES TABLE POLICIES
-- ============================================
DROP POLICY IF EXISTS "Admins can view all services" ON services;
DROP POLICY IF EXISTS "Admins can update all services" ON services;
DROP POLICY IF EXISTS "Admins can insert services" ON services;
DROP POLICY IF EXISTS "Admins can delete services" ON services;

CREATE POLICY "Admins can view all services" ON services
  FOR SELECT USING (public.is_admin());

CREATE POLICY "Admins can update all services" ON services
  FOR UPDATE USING (public.is_admin());

CREATE POLICY "Admins can insert services" ON services
  FOR INSERT WITH CHECK (public.is_admin());

CREATE POLICY "Admins can delete services" ON services
  FOR DELETE USING (public.is_admin());

-- ============================================
-- REVIEWS TABLE POLICIES
-- ============================================
DROP POLICY IF EXISTS "Admins can view all reviews" ON reviews;
DROP POLICY IF EXISTS "Admins can update all reviews" ON reviews;
DROP POLICY IF EXISTS "Admins can insert reviews" ON reviews;
DROP POLICY IF EXISTS "Admins can delete reviews" ON reviews;

CREATE POLICY "Admins can view all reviews" ON reviews
  FOR SELECT USING (public.is_admin());

CREATE POLICY "Admins can update all reviews" ON reviews
  FOR UPDATE USING (public.is_admin());

CREATE POLICY "Admins can insert reviews" ON reviews
  FOR INSERT WITH CHECK (public.is_admin());

CREATE POLICY "Admins can delete reviews" ON reviews
  FOR DELETE USING (public.is_admin());

-- ============================================
-- ADDRESSES TABLE POLICIES
-- ============================================
DROP POLICY IF EXISTS "Admins can view all addresses" ON addresses;
DROP POLICY IF EXISTS "Admins can update all addresses" ON addresses;
DROP POLICY IF EXISTS "Admins can insert addresses" ON addresses;
DROP POLICY IF EXISTS "Admins can delete addresses" ON addresses;

CREATE POLICY "Admins can view all addresses" ON addresses
  FOR SELECT USING (public.is_admin());

CREATE POLICY "Admins can update all addresses" ON addresses
  FOR UPDATE USING (public.is_admin());

CREATE POLICY "Admins can insert addresses" ON addresses
  FOR INSERT WITH CHECK (public.is_admin());

CREATE POLICY "Admins can delete addresses" ON addresses
  FOR DELETE USING (public.is_admin());

-- ============================================
-- BOOKING ITEMS TABLE POLICIES
-- ============================================
DROP POLICY IF EXISTS "Admins can view all booking_items" ON booking_items;
DROP POLICY IF EXISTS "Admins can update all booking_items" ON booking_items;
DROP POLICY IF EXISTS "Admins can insert booking_items" ON booking_items;
DROP POLICY IF EXISTS "Admins can delete booking_items" ON booking_items;

CREATE POLICY "Admins can view all booking_items" ON booking_items
  FOR SELECT USING (public.is_admin());

CREATE POLICY "Admins can update all booking_items" ON booking_items
  FOR UPDATE USING (public.is_admin());

CREATE POLICY "Admins can insert booking_items" ON booking_items
  FOR INSERT WITH CHECK (public.is_admin());

CREATE POLICY "Admins can delete booking_items" ON booking_items
  FOR DELETE USING (public.is_admin());

-- ============================================
-- ADDONS TABLE POLICIES
-- ============================================
DROP POLICY IF EXISTS "Admins can view all addons" ON addons;
DROP POLICY IF EXISTS "Admins can update all addons" ON addons;
DROP POLICY IF EXISTS "Admins can insert addons" ON addons;
DROP POLICY IF EXISTS "Admins can delete addons" ON addons;

CREATE POLICY "Admins can view all addons" ON addons
  FOR SELECT USING (public.is_admin());

CREATE POLICY "Admins can update all addons" ON addons
  FOR UPDATE USING (public.is_admin());

CREATE POLICY "Admins can insert addons" ON addons
  FOR INSERT WITH CHECK (public.is_admin());

CREATE POLICY "Admins can delete addons" ON addons
  FOR DELETE USING (public.is_admin());

-- ============================================
-- VENDOR SLOTS TABLE POLICIES
-- ============================================
DROP POLICY IF EXISTS "Admins can view all vendor_slots" ON vendor_slots;
DROP POLICY IF EXISTS "Admins can update all vendor_slots" ON vendor_slots;
DROP POLICY IF EXISTS "Admins can insert vendor_slots" ON vendor_slots;
DROP POLICY IF EXISTS "Admins can delete vendor_slots" ON vendor_slots;

CREATE POLICY "Admins can view all vendor_slots" ON vendor_slots
  FOR SELECT USING (public.is_admin());

CREATE POLICY "Admins can update all vendor_slots" ON vendor_slots
  FOR UPDATE USING (public.is_admin());

CREATE POLICY "Admins can insert vendor_slots" ON vendor_slots
  FOR INSERT WITH CHECK (public.is_admin());

CREATE POLICY "Admins can delete vendor_slots" ON vendor_slots
  FOR DELETE USING (public.is_admin());

-- ============================================
-- AUDIT LOGS TABLE POLICIES
-- ============================================
DROP POLICY IF EXISTS "Admins can view all audit_logs" ON audit_logs;
DROP POLICY IF EXISTS "Admins can update all audit_logs" ON audit_logs;
DROP POLICY IF EXISTS "Admins can insert audit_logs" ON audit_logs;
DROP POLICY IF EXISTS "Admins can delete audit_logs" ON audit_logs;

CREATE POLICY "Admins can view all audit_logs" ON audit_logs
  FOR SELECT USING (public.is_admin());

CREATE POLICY "Admins can update all audit_logs" ON audit_logs
  FOR UPDATE USING (public.is_admin());

CREATE POLICY "Admins can insert audit_logs" ON audit_logs
  FOR INSERT WITH CHECK (public.is_admin());

CREATE POLICY "Admins can delete audit_logs" ON audit_logs
  FOR DELETE USING (public.is_admin());

-- ============================================
-- MANAGER POLICIES (OPTIONAL - for managers to view data)
-- ============================================
-- Helper function to check if current user is manager
CREATE OR REPLACE FUNCTION public.is_manager()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.users 
    WHERE users.id = auth.uid() 
    AND users.role = 'MANAGER'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Managers can view all users (read-only for managers)
DROP POLICY IF EXISTS "Managers can view all users" ON users;
CREATE POLICY "Managers can view all users" ON users
  FOR SELECT USING (public.is_manager());

-- Managers can view all vendors
DROP POLICY IF EXISTS "Managers can view all vendors" ON vendors;
CREATE POLICY "Managers can view all vendors" ON vendors
  FOR SELECT USING (public.is_manager());

-- Managers can update vendors (for approvals)
DROP POLICY IF EXISTS "Managers can update vendors" ON vendors;
CREATE POLICY "Managers can update vendors" ON vendors
  FOR UPDATE USING (public.is_manager());

-- Managers can view all bookings
DROP POLICY IF EXISTS "Managers can view all bookings" ON bookings;
CREATE POLICY "Managers can view all bookings" ON bookings
  FOR SELECT USING (public.is_manager());

-- Managers can view all payments
DROP POLICY IF EXISTS "Managers can view all payments" ON payments;
CREATE POLICY "Managers can view all payments" ON payments
  FOR SELECT USING (public.is_manager());

