-- ============================================
-- Verify Vendor RLS Policies
-- ============================================
-- Run this query to verify all policies were created successfully
-- ============================================

-- Check all policies on vendors table
SELECT 
  policyname,
  cmd as operation,
  roles,
  qual as using_expression,
  with_check as with_check_expression
FROM pg_policies 
WHERE tablename = 'vendors'
ORDER BY cmd, policyname;

-- Expected policies:
-- 1. "vendors can insert their own data" (INSERT)
-- 2. "vendor can read own data" (SELECT)
-- 3. "manager can approve vendors" (UPDATE)
-- 4. "vendors can update their own data" (UPDATE)
-- 5. "Allow public read access for approved vendors" (SELECT)
-- 6. "Public can view approved vendors" (SELECT)

-- Also check if RLS is enabled
SELECT 
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename = 'vendors';

-- Should show: rls_enabled = true

