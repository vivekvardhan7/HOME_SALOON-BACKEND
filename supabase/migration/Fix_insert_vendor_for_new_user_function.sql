-- ============================================
-- CHECK: What vendors exist in the database?
-- Run this in Supabase SQL Editor
-- ============================================

-- Step 1: Count total vendors
SELECT COUNT(*) as total_vendors FROM vendor;

-- Step 2: Count by status
SELECT 
  status,
  COUNT(*) as count
FROM vendor
GROUP BY status
ORDER BY status;

-- Step 3: Show all vendors (if any)
SELECT 
  id,
  shopname,
  status,
  user_id,
  created_at
FROM vendor
ORDER BY created_at DESC
LIMIT 20;

-- Step 4: Check if there are any users with role VENDOR
SELECT 
  id,
  email,
  role,
  status
FROM users
WHERE role = 'VENDOR'
LIMIT 10;

-- Step 5: Check if there are users with role MANAGER
SELECT 
  id,
  email,
  role,
  status
FROM users
WHERE role = 'MANAGER'
LIMIT 10;

-- Step 6: Check if vendor records exist but are linked to users
SELECT 
  v.id as vendor_id,
  v.shopname,
  v.status as vendor_status,
  u.id as user_id,
  u.email,
  u.role as user_role
FROM vendor v
LEFT JOIN users u ON v.user_id = u.id
ORDER BY v.created_at DESC
LIMIT 10;

