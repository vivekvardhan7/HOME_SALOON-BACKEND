-- Fix Google OAuth Authentication for HOME BONZENGA
-- This migration fixes the trigger function to properly handle Google OAuth user creation
-- Run this in Supabase SQL Editor

-- Step 1: Update the trigger function to properly handle Google OAuth metadata
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  first_name_val TEXT;
  last_name_val TEXT;
  full_name_val TEXT;
  avatar_val TEXT;
  role_val TEXT;
BEGIN
  -- Extract role from metadata (default to CUSTOMER)
  role_val := COALESCE(
    NEW.raw_user_meta_data->>'role',
    'CUSTOMER'
  );
  
  -- Extract avatar/picture from Google OAuth metadata
  avatar_val := COALESCE(
    NEW.raw_user_meta_data->>'picture',
    NEW.raw_user_meta_data->>'avatar',
    NULL
  );
  
  -- Google OAuth provides: given_name, family_name, and sometimes name (full name)
  -- Try to get first_name and last_name from Google-specific fields
  first_name_val := COALESCE(
    NEW.raw_user_meta_data->>'given_name',
    NEW.raw_user_meta_data->>'first_name',
    NULL
  );
  
  last_name_val := COALESCE(
    NEW.raw_user_meta_data->>'family_name',
    NEW.raw_user_meta_data->>'last_name',
    NULL
  );
  
  -- If we have a full name but no separate first/last, try to split it
  full_name_val := COALESCE(
    NEW.raw_user_meta_data->>'name',
    NEW.raw_user_meta_data->>'full_name',
    NULL
  );
  
  -- If we have full_name but no first_name, try to split it
  IF first_name_val IS NULL AND full_name_val IS NOT NULL THEN
    -- Split by space - take first word as first name, rest as last name
    first_name_val := SPLIT_PART(full_name_val, ' ', 1);
    IF array_length(string_to_array(full_name_val, ' '), 1) > 1 THEN
      last_name_val := SUBSTRING(full_name_val FROM LENGTH(first_name_val) + 2);
    ELSE
      last_name_val := '';
    END IF;
  END IF;
  
  -- Default values if still null
  first_name_val := COALESCE(first_name_val, 'User');
  last_name_val := COALESCE(last_name_val, '');
  
  -- Insert or update user profile
  -- Use ON CONFLICT to handle cases where user already exists (re-login scenario)
  INSERT INTO public.users (
    id,
    email,
    first_name,
    last_name,
    role,
    status,
    avatar,
    created_at,
    updated_at
  )
  VALUES (
    NEW.id,
    NEW.email,
    first_name_val,
    last_name_val,
    role_val,
    'ACTIVE',
    avatar_val,
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    first_name = COALESCE(EXCLUDED.first_name, users.first_name),
    last_name = COALESCE(EXCLUDED.last_name, users.last_name),
    avatar = COALESCE(EXCLUDED.avatar, users.avatar),
    updated_at = NOW();
  
  RETURN NEW;
EXCEPTION
  WHEN unique_violation THEN
    -- User already exists, update instead
    UPDATE public.users SET
      email = NEW.email,
      first_name = COALESCE(first_name_val, users.first_name),
      last_name = COALESCE(last_name_val, users.last_name),
      avatar = COALESCE(avatar_val, users.avatar),
      updated_at = NOW()
    WHERE id = NEW.id;
    RETURN NEW;
  WHEN OTHERS THEN
    -- Log error but don't fail the auth signup
    RAISE WARNING 'Error creating user profile: %', SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 2: Ensure the trigger exists and is properly configured
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Step 3: Ensure RLS policies allow the trigger to work (should already exist, but verify)
-- The SECURITY DEFINER function should bypass RLS, but let's ensure policies are correct

-- Grant necessary permissions to the function
GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL ON public.users TO postgres, service_role;

-- Step 4: Ensure users table has all required columns
DO $$
BEGIN
  -- Add avatar column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'users' 
    AND column_name = 'avatar'
  ) THEN
    ALTER TABLE public.users ADD COLUMN avatar TEXT;
  END IF;
  
  -- Ensure email is unique
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'users_email_key'
  ) THEN
    ALTER TABLE public.users ADD CONSTRAINT users_email_key UNIQUE (email);
  END IF;
END $$;

-- Step 5: Create a helper function to manually sync existing auth.users to public.users
-- This can be used if any users were created before the trigger was fixed
CREATE OR REPLACE FUNCTION public.sync_existing_auth_users()
RETURNS INTEGER AS $$
DECLARE
  synced_count INTEGER := 0;
  auth_user RECORD;
BEGIN
  -- Loop through all auth.users that don't have a corresponding public.users entry
  FOR auth_user IN
    SELECT au.id, au.email, au.raw_user_meta_data
    FROM auth.users au
    LEFT JOIN public.users pu ON au.id = pu.id
    WHERE pu.id IS NULL
  LOOP
    BEGIN
      INSERT INTO public.users (
        id,
        email,
        first_name,
        last_name,
        role,
        status,
        avatar,
        created_at,
        updated_at
      )
      VALUES (
        auth_user.id,
        auth_user.email,
        COALESCE(
          auth_user.raw_user_meta_data->>'given_name',
          auth_user.raw_user_meta_data->>'first_name',
          SPLIT_PART(COALESCE(
            auth_user.raw_user_meta_data->>'name',
            auth_user.raw_user_meta_data->>'full_name',
            'User'
          ), ' ', 1)
        ),
        COALESCE(
          auth_user.raw_user_meta_data->>'family_name',
          auth_user.raw_user_meta_data->>'last_name',
          CASE 
            WHEN array_length(string_to_array(COALESCE(
              auth_user.raw_user_meta_data->>'name',
              auth_user.raw_user_meta_data->>'full_name',
              ''
            ), ' '), 1) > 1 
            THEN SUBSTRING(COALESCE(
              auth_user.raw_user_meta_data->>'name',
              auth_user.raw_user_meta_data->>'full_name',
              ''
            ) FROM LENGTH(SPLIT_PART(COALESCE(
              auth_user.raw_user_meta_data->>'name',
              auth_user.raw_user_meta_data->>'full_name',
              ''
            ), ' ', 1)) + 2)
            ELSE ''
          END
        ),
        COALESCE(auth_user.raw_user_meta_data->>'role', 'CUSTOMER'),
        'ACTIVE',
        COALESCE(
          auth_user.raw_user_meta_data->>'picture',
          auth_user.raw_user_meta_data->>'avatar',
          NULL
        ),
        NOW(),
        NOW()
      )
      ON CONFLICT (id) DO NOTHING;
      
      synced_count := synced_count + 1;
    EXCEPTION
      WHEN OTHERS THEN
        RAISE WARNING 'Failed to sync user %: %', auth_user.email, SQLERRM;
    END;
  END LOOP;
  
  RETURN synced_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 6: Run the sync function to fix any existing users
SELECT public.sync_existing_auth_users() as synced_users_count;

-- Verification queries (run these to check if everything is set up correctly)
-- Uncomment and run to verify:

-- Check if trigger exists
-- SELECT trigger_name, event_manipulation, event_object_table, action_statement
-- FROM information_schema.triggers
-- WHERE trigger_name = 'on_auth_user_created';

-- Check if function exists
-- SELECT proname, prosrc
-- FROM pg_proc
-- WHERE proname = 'handle_new_user';

-- Check for users without profiles (should return 0 rows)
-- SELECT au.id, au.email
-- FROM auth.users au
-- LEFT JOIN public.users pu ON au.id = pu.id
-- WHERE pu.id IS NULL;

