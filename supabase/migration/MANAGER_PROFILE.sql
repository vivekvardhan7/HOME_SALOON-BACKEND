-- Quick fix: Create manager user profile in public.users table
-- Run this in Supabase Dashboard → SQL Editor

-- First, check if manager exists in auth.users
DO $$
DECLARE
  manager_id UUID;
  manager_email TEXT := 'manager@homebonzenga.com';
BEGIN
  -- Get the manager's ID from auth.users
  SELECT id INTO manager_id
  FROM auth.users
  WHERE email = manager_email;
  
  IF manager_id IS NULL THEN
    RAISE NOTICE 'Manager user does not exist in auth.users. Please create it first.';
  ELSE
    RAISE NOTICE 'Manager found in auth.users with ID: %', manager_id;
    
    -- Insert or update the manager profile in public.users
    INSERT INTO public.users (id, email, first_name, last_name, role, status, password, created_at, updated_at)
    VALUES (
      manager_id,
      manager_email,
      'Manager',
      'User',
      'MANAGER',
      'ACTIVE',
      '',
      NOW(),
      NOW()
    )
    ON CONFLICT (id) DO UPDATE SET
      role = 'MANAGER',
      first_name = 'Manager',
      last_name = 'User',
      status = 'ACTIVE',
      updated_at = NOW();
    
    RAISE NOTICE 'Manager profile created/updated successfully in public.users';
  END IF;
END $$;

-- Verify the manager profile exists
SELECT 
  id,
  email,
  first_name,
  last_name,
  role,
  status,
  created_at
FROM public.users
WHERE email = 'manager@homebonzenga.com';

update public.users
set role = 'MANAGER'
where email = 'manager@homebonzenga.com';