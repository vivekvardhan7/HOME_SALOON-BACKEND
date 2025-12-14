-- ============================================================================
-- FIX ADMIN USER ROLE - Update metadata and profile
-- ============================================================================
-- Run this in Supabase SQL Editor to fix the admin user role
-- ============================================================================

-- STEP 1: Update user metadata in auth.users to include ADMIN role
UPDATE auth.users
SET raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || '{
  "first_name": "System",
  "last_name": "Admin",
  "role": "ADMIN"
}'::jsonb
WHERE email = 'admin@homebonzenga.com';

-- STEP 2: Verify the metadata was updated
SELECT 
  id,
  email,
  email_confirmed_at IS NOT NULL as email_confirmed,
  raw_user_meta_data->>'role' as role,
  raw_user_meta_data->>'first_name' as first_name,
  raw_user_meta_data->>'last_name' as last_name,
  raw_user_meta_data
FROM auth.users
WHERE email = 'admin@homebonzenga.com';

-- STEP 3: Update profile in public.users (user already exists, so just update)
UPDATE public.users
SET 
  first_name = COALESCE((SELECT raw_user_meta_data->>'first_name' FROM auth.users WHERE email = 'admin@homebonzenga.com'), 'System'),
  last_name = COALESCE((SELECT raw_user_meta_data->>'last_name' FROM auth.users WHERE email = 'admin@homebonzenga.com'), 'Admin'),
  role = COALESCE(UPPER((SELECT raw_user_meta_data->>'role' FROM auth.users WHERE email = 'admin@homebonzenga.com')), 'ADMIN'),
  status = 'ACTIVE',
  updated_at = NOW()
WHERE email = 'admin@homebonzenga.com';

-- STEP 4: Verify profile exists with ADMIN role
SELECT 
  id,
  email,
  first_name,
  last_name,
  UPPER(role) as role,
  status
FROM public.users
WHERE email = 'admin@homebonzenga.com';

-- ============================================================================
-- EXPECTED RESULT:
-- - auth.users.raw_user_meta_data should contain: {"role": "ADMIN", "first_name": "System", "last_name": "Admin"}
-- - public.users.role should be "ADMIN"
-- ============================================================================

