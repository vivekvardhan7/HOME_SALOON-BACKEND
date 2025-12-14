-- ============================================
-- Fix RLS Policies for Vendors Table
-- ============================================
-- This migration ensures vendors can insert their own data and managers can update vendor status
--
-- TO APPLY THIS MIGRATION:
-- 1. Go to Supabase Dashboard > SQL Editor
-- 2. Copy and paste this entire file
-- 3. Click "Run" to execute
-- 4. Verify the policies were created successfully
--
-- TO VERIFY POLICIES WERE CREATED:
-- Run: SELECT * FROM pg_policies WHERE tablename = 'vendors';
-- ============================================

-- ============================================
-- IMPORTANT: Ensure RLS is enabled on vendors table
-- ============================================
ALTER TABLE vendors ENABLE ROW LEVEL SECURITY;

-- ============================================
-- VENDOR INSERT POLICY
-- ============================================
-- Drop ALL existing insert policies to avoid conflicts
DROP POLICY IF EXISTS "vendors can insert their own data" ON vendors;
DROP POLICY IF EXISTS "Vendors can insert their own vendor profile" ON vendors;

-- Create policy to allow vendors to insert their own row
-- This allows authenticated users to insert a vendor record where user_id matches their auth.uid()
-- This is a permissive policy - it will work alongside admin policies
CREATE POLICY "vendors can insert their own data"
ON vendors
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() IS NOT NULL AND 
  auth.uid() = user_id
);

-- ============================================
-- VENDOR SELECT POLICY (Read own data)
-- ============================================
-- Drop existing policy if it exists
DROP POLICY IF EXISTS "vendor can read own data" ON vendors;
DROP POLICY IF EXISTS "Vendors can view their own vendor profile" ON vendors;

-- Create policy to allow vendors to read their own row
CREATE POLICY "vendor can read own data"
ON vendors
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- ============================================
-- MANAGER UPDATE POLICY (Approve/Reject vendors)
-- ============================================
-- Drop existing manager update policy if it exists
DROP POLICY IF EXISTS "manager can approve vendors" ON vendors;
DROP POLICY IF EXISTS "Managers can update vendors" ON vendors;

-- Create policy to allow managers to update vendor status
-- This checks if the authenticated user has role = 'MANAGER' in the users table
CREATE POLICY "manager can approve vendors"
ON vendors
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE users.id = auth.uid()
    AND UPPER(users.role) = 'MANAGER'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE users.id = auth.uid()
    AND UPPER(users.role) = 'MANAGER'
  )
);

-- ============================================
-- VENDOR UPDATE POLICY (Update own profile)
-- ============================================
-- Drop existing policy if it exists
DROP POLICY IF EXISTS "vendors can update their own data" ON vendors;
DROP POLICY IF EXISTS "Vendors can update their own vendor profile" ON vendors;

-- Create policy to allow vendors to update their own row
-- Note: This allows vendors to update their profile fields
-- Status changes should be restricted at the application level or via triggers
-- The manager policy below allows managers to update any vendor (including status)
CREATE POLICY "vendors can update their own data"
ON vendors
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- ============================================
-- PUBLIC READ POLICY (For approved vendors)
-- ============================================
-- Keep existing public read policy for approved vendors (if it doesn't exist, create it)
DROP POLICY IF EXISTS "Allow public read access for approved vendors" ON vendors;
DROP POLICY IF EXISTS "Public can view approved vendors" ON vendors;

-- Allow authenticated users to view approved vendors
CREATE POLICY "Allow public read access for approved vendors"
ON vendors
FOR SELECT
TO authenticated
USING (UPPER(status) = 'APPROVED');

-- Also allow anonymous/public access to view approved vendors
CREATE POLICY "Public can view approved vendors"
ON vendors
FOR SELECT
TO anon
USING (UPPER(status) = 'APPROVED');

