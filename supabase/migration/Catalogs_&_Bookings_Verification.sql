-- =====================================================
-- VERIFICATION SCRIPT
-- Run this after setup-catalog-tables.sql to verify everything is set up correctly
-- =====================================================

-- Check if service_catalog table exists and has correct structure
SELECT 
  'service_catalog' as table_name,
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'service_catalog'
ORDER BY ordinal_position;

-- Check if product_catalog table exists and has correct structure
SELECT 
  'product_catalog' as table_name,
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'product_catalog'
ORDER BY ordinal_position;

-- Check if booking_type column exists in bookings table
SELECT 
  'bookings' as table_name,
  column_name,
  data_type,
  column_default
FROM information_schema.columns
WHERE table_name = 'bookings' 
AND column_name = 'booking_type';

-- Check indexes
SELECT 
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename IN ('service_catalog', 'product_catalog', 'bookings')
AND indexname LIKE '%catalog%' OR indexname LIKE '%booking_type%'
ORDER BY tablename, indexname;

-- Check RLS policies
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
WHERE tablename IN ('service_catalog', 'product_catalog')
ORDER BY tablename, policyname;

-- Check row counts
SELECT 
  'service_catalog' as table_name,
  COUNT(*) as total_rows,
  COUNT(*) FILTER (WHERE is_active = true) as active_rows,
  COUNT(*) FILTER (WHERE is_active = false) as inactive_rows
FROM service_catalog
UNION ALL
SELECT 
  'product_catalog' as table_name,
  COUNT(*) as total_rows,
  COUNT(*) FILTER (WHERE is_active = true) as active_rows,
  COUNT(*) FILTER (WHERE is_active = false) as inactive_rows
FROM product_catalog;

-- Check booking_type distribution
SELECT 
  booking_type,
  COUNT(*) as count
FROM bookings
GROUP BY booking_type
ORDER BY booking_type;

-- Test queries (should work if RLS is set up correctly)
-- These will only work if you're authenticated as an admin user
SELECT 'Testing admin read access...' as test;
SELECT COUNT(*) as service_count FROM service_catalog;
SELECT COUNT(*) as product_count FROM product_catalog;

SELECT '✅ Verification complete! Check the results above.' as status;

