-- Sync existing auth.users to public.users table
-- This migration ensures all users from Supabase Auth are synced to the public.users table
-- Run this if you have users in auth.users but not in public.users

-- Function to sync a single auth user to public.users
CREATE OR REPLACE FUNCTION public.sync_auth_user_to_public()
RETURNS TRIGGER AS $$
BEGIN
  -- Insert user into public.users if they don't exist
  INSERT INTO public.users (id, email, first_name, last_name, role, status, created_at, updated_at)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'first_name', NEW.raw_user_meta_data->>'full_name', 'User'),
    COALESCE(NEW.raw_user_meta_data->>'last_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'role', 'CUSTOMER'),
    'ACTIVE',
    NEW.created_at,
    NOW()
  )
  ON CONFLICT (id) DO UPDATE
  SET 
    email = EXCLUDED.email,
    updated_at = NOW();
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Sync all existing auth.users to public.users
-- This is a one-time operation to sync existing users
DO $$
DECLARE
  auth_user RECORD;
  synced_count INTEGER := 0;
BEGIN
  FOR auth_user IN 
    SELECT id, email, raw_user_meta_data, created_at
    FROM auth.users
    WHERE id NOT IN (SELECT id FROM public.users)
  LOOP
    BEGIN
      INSERT INTO public.users (id, email, first_name, last_name, role, status, created_at, updated_at)
      VALUES (
        auth_user.id,
        auth_user.email,
        COALESCE(auth_user.raw_user_meta_data->>'first_name', auth_user.raw_user_meta_data->>'full_name', 'User'),
        COALESCE(auth_user.raw_user_meta_data->>'last_name', ''),
        COALESCE(auth_user.raw_user_meta_data->>'role', 'CUSTOMER'),
        'ACTIVE',
        auth_user.created_at,
        NOW()
      );
      synced_count := synced_count + 1;
    EXCEPTION WHEN OTHERS THEN
      -- Skip errors (e.g., duplicate key, constraint violations)
      RAISE NOTICE 'Skipped user %: %', auth_user.id, SQLERRM;
    END;
  END LOOP;
  
  RAISE NOTICE 'Synced % users from auth.users to public.users', synced_count;
END $$;

-- Ensure the trigger is set up for future users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.sync_auth_user_to_public();

