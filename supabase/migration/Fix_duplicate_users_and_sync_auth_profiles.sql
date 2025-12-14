-- Fix duplicate users and ensure trigger works correctly
-- Run this if you're getting 409 Conflict errors during login

-- Step 1: Check for duplicate users (same email but different IDs)
-- This shouldn't happen normally, but let's clean up if it exists
DO $$
DECLARE
  dup_count INTEGER;
BEGIN
  -- Count duplicate emails
  SELECT COUNT(*) INTO dup_count
  FROM (
    SELECT email, COUNT(*) as cnt
    FROM public.users
    GROUP BY email
    HAVING COUNT(*) > 1
  ) duplicates;
  
  IF dup_count > 0 THEN
    RAISE NOTICE 'Found % duplicate emails. Keeping the one with the most recent updated_at.', dup_count;
    
    -- Delete duplicates, keeping the most recent one
    DELETE FROM public.users
    WHERE id IN (
      SELECT id
      FROM (
        SELECT id, 
               ROW_NUMBER() OVER (PARTITION BY email ORDER BY updated_at DESC) as rn
        FROM public.users
      ) ranked
      WHERE rn > 1
    );
    
    RAISE NOTICE 'Duplicate users removed.';
  ELSE
    RAISE NOTICE 'No duplicate emails found.';
  END IF;
END $$;

-- Step 2: Ensure the trigger function exists and is correct
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Check if user already exists (handle race conditions)
  IF EXISTS (SELECT 1 FROM public.users WHERE id = NEW.id) THEN
    -- User already exists, update if needed
    UPDATE public.users
    SET 
      email = COALESCE(NEW.email, public.users.email),
      updated_at = NOW()
    WHERE id = NEW.id;
    RETURN NEW;
  END IF;
  
  -- Insert new user
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
EXCEPTION
  WHEN unique_violation THEN
    -- User was created by another process, just return
    RETURN NEW;
  WHEN OTHERS THEN
    -- Log error but don't fail the trigger
    RAISE WARNING 'Error in handle_new_user trigger: %', SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 3: Ensure the trigger exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW 
  EXECUTE FUNCTION public.handle_new_user();

-- Step 4: Sync any missing users from auth.users to public.users
-- This ensures all auth users have corresponding public.users records
DO $$
DECLARE
  auth_user RECORD;
  synced_count INTEGER := 0;
BEGIN
  FOR auth_user IN 
    SELECT id, email, raw_user_meta_data, created_at
    FROM auth.users
    WHERE id NOT IN (SELECT id FROM public.users WHERE id IS NOT NULL)
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
      )
      ON CONFLICT (id) DO NOTHING;
      
      synced_count := synced_count + 1;
    EXCEPTION WHEN OTHERS THEN
      -- Skip errors (e.g., constraint violations)
      RAISE NOTICE 'Skipped user %: %', auth_user.id, SQLERRM;
    END;
  END LOOP;
  
  RAISE NOTICE 'Synced % users from auth.users to public.users', synced_count;
END $$;

-- Step 5: Verify RLS policies allow users to insert their own profile
-- This ensures the trigger can run (it uses SECURITY DEFINER so it bypasses RLS)
-- But we should still have the policy for manual inserts
DROP POLICY IF EXISTS "Users can insert their own profile" ON users;
CREATE POLICY "Users can insert their own profile" ON users
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Verify results
DO $$
DECLARE
  auth_count INTEGER;
  public_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO auth_count FROM auth.users;
  SELECT COUNT(*) INTO public_count FROM public.users;
  
  RAISE NOTICE '=== Sync Status ===';
  RAISE NOTICE 'Auth users: %', auth_count;
  RAISE NOTICE 'Public users: %', public_count;
  
  IF auth_count > public_count THEN
    RAISE WARNING 'Some auth users are not synced to public.users. Run sync migration.';
  ELSE
    RAISE NOTICE 'All auth users are synced to public.users.';
  END IF;
END $$;

