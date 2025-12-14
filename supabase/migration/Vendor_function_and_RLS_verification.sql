-- ============================================
-- Verify if insert_vendor_for_new_user function exists
-- ============================================
-- Run this FIRST to check if the function exists
-- ============================================

-- Check if the function exists
SELECT 
  routine_name, 
  routine_type,
  routine_schema
FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_name = 'insert_vendor_for_new_user';

-- If the above query returns NO ROWS, the function doesn't exist
-- You need to run: Fix_Vendor_Registration_Complete.sql

-- Also check RLS status on vendors table
SELECT 
  tablename, 
  rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename = 'vendors';

-- Check existing policies
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies 
WHERE tablename = 'vendors';

