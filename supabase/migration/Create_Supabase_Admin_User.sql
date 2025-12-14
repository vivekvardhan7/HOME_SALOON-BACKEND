-- Create Admin User in Supabase Auth
-- This migration creates the admin user in auth.users (required for Supabase Auth login)
-- Run this in Supabase SQL Editor

-- Note: Supabase Auth passwords are encrypted, so we need to use the Supabase Admin API
-- OR create the user via the dashboard, OR use the auth.users table directly with proper password hashing

-- Option 1: Create admin user using Supabase's auth.users insert (requires service_role key)
-- This should be run via Supabase Admin API or Dashboard

-- Option 2: Create a function that can be called with service_role permissions
-- First, let's check if the user already exists in auth.users
DO $$
DECLARE
  admin_user_id UUID;
  admin_exists BOOLEAN;
BEGIN
  -- Check if admin user exists in auth.users
  SELECT EXISTS(
    SELECT 1 FROM auth.users WHERE email = 'admin@homebonzenga.com'
  ) INTO admin_exists;

  IF NOT admin_exists THEN
    -- Generate a UUID for the admin user
    admin_user_id := gen_random_uuid();
    
    -- Insert into auth.users
    -- Note: This requires SUPERUSER or service_role permissions
    -- Password hash for 'admin123' using Supabase's auth schema
    -- Format: $2a$10$... (bcrypt)
    INSERT INTO auth.users (
      instance_id,
      id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      invited_at,
      confirmation_token,
      confirmation_sent_at,
      recovery_token,
      recovery_sent_at,
      email_change_token_new,
      email_change,
      email_change_sent_at,
      last_sign_in_at,
      raw_app_meta_data,
      raw_user_meta_data,
      is_super_admin,
      created_at,
      updated_at,
      phone,
      phone_confirmed_at,
      phone_change,
      phone_change_token,
      phone_change_sent_at,
      email_change_token_current,
      email_change_confirm_status,
      banned_until,
      reauthentication_token,
      reauthentication_sent_at,
      is_sso_user,
      deleted_at
    ) VALUES (
      '00000000-0000-0000-0000-000000000000', -- instance_id (default)
      admin_user_id,
      'authenticated',
      'authenticated',
      'admin@homebonzenga.com',
      crypt('admin123', gen_salt('bf')), -- Password: admin123
      NOW(), -- email_confirmed_at (auto-confirm)
      NULL,
      '',
      NULL,
      '',
      NULL,
      '',
      '',
      NULL,
      NULL,
      '{"provider": "email", "providers": ["email"]}'::jsonb,
      '{"first_name": "System", "last_name": "Admin", "role": "ADMIN"}'::jsonb,
      false,
      NOW(),
      NOW(),
      NULL,
      NULL,
      '',
      '',
      NULL,
      '',
      0,
      NULL,
      '',
      NULL,
      false,
      NULL
    )
    ON CONFLICT (email) DO NOTHING;

    -- Also ensure the user exists in public.users (via trigger or manual insert)
    INSERT INTO public.users (
      id,
      email,
      first_name,
      last_name,
      role,
      status,
      password,
      created_at,
      updated_at
    ) VALUES (
      admin_user_id,
      'admin@homebonzenga.com',
      'System',
      'Admin',
      'ADMIN',
      'ACTIVE',
      '', -- Password is managed by auth.users
      NOW(),
      NOW()
    )
    ON CONFLICT (id) DO UPDATE SET
      email = EXCLUDED.email,
      first_name = EXCLUDED.first_name,
      last_name = EXCLUDED.last_name,
      role = EXCLUDED.role,
      status = EXCLUDED.status,
      updated_at = NOW();

    RAISE NOTICE 'Admin user created with ID: %', admin_user_id;
  ELSE
    RAISE NOTICE 'Admin user already exists in auth.users';
  END IF;
END $$;

-- Verify the admin user was created
SELECT 
  id,
  email,
  email_confirmed_at,
  created_at,
  raw_user_meta_data->>'role' as role
FROM auth.users
WHERE email = 'admin@homebonzenga.com';

