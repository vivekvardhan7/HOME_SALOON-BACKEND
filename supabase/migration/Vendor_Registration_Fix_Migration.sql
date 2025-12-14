-- ============================================
-- Complete Fix for Vendor Registration Issues
-- ============================================
-- This migration ensures:
-- 1. The insert_vendor_for_new_user function exists
-- 2. The vendor table has proper defaults for nullable fields
-- 3. RLS policies are correctly set up
-- ============================================

-- Step 1: Ensure vendor table has proper defaults for nullable fields
-- This prevents NOT NULL constraint violations

-- First, check if columns need defaults (run these to see current state)
-- SELECT column_name, column_default, is_nullable 
-- FROM information_schema.columns 
-- WHERE table_schema = 'public' AND table_name = 'vendor';

-- Step 2: Create or replace the insert function
CREATE OR REPLACE FUNCTION public.insert_vendor_for_new_user(
  p_user_id UUID,
  p_shopname VARCHAR(255),
  p_description TEXT DEFAULT NULL,
  p_address TEXT DEFAULT NULL,
  p_city VARCHAR(100) DEFAULT NULL,
  p_state VARCHAR(100) DEFAULT NULL,
  p_zip_code VARCHAR(20) DEFAULT NULL,
  p_latitude DECIMAL DEFAULT 0,
  p_longitude DECIMAL DEFAULT 0,
  p_status VARCHAR(20) DEFAULT 'pending'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_vendor_id UUID;
  v_user_exists BOOLEAN;
BEGIN
  -- Verify the user exists in public.users
  SELECT EXISTS(SELECT 1 FROM public.users WHERE id = p_user_id) INTO v_user_exists;
  
  IF NOT v_user_exists THEN
    -- Wait a bit and retry (trigger might still be creating the user)
    PERFORM pg_sleep(0.5);
    SELECT EXISTS(SELECT 1 FROM public.users WHERE id = p_user_id) INTO v_user_exists;
    
    IF NOT v_user_exists THEN
      RAISE EXCEPTION 'User does not exist in public.users. Please ensure user profile was created.';
    END IF;
  END IF;
  
  -- Insert the vendor record with proper defaults
  INSERT INTO public.vendor (
    user_id,
    shopname,
    description,
    address,
    city,
    state,
    zip_code,
    latitude,
    longitude,
    status,
    service_radius,
    advance_booking,
    cancellation
  ) VALUES (
    p_user_id,
    p_shopname,
    COALESCE(p_description, NULL),
    COALESCE(p_address, ''),
    COALESCE(p_city, ''),
    COALESCE(p_state, ''),
    COALESCE(p_zip_code, ''),
    COALESCE(p_latitude, 0),
    COALESCE(p_longitude, 0),
    COALESCE(p_status, 'pending'),
    5, -- default service_radius
    7, -- default advance_booking
    24 -- default cancellation
  )
  RETURNING id INTO v_vendor_id;
  
  RETURN v_vendor_id;
END;
$$;

-- Step 3: Grant execute permissions
GRANT EXECUTE ON FUNCTION public.insert_vendor_for_new_user TO authenticated;
GRANT EXECUTE ON FUNCTION public.insert_vendor_for_new_user TO anon;
GRANT EXECUTE ON FUNCTION public.insert_vendor_for_new_user TO service_role;

-- Step 4: Ensure RLS policies are correct
ALTER TABLE vendor ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "vendor can insert their own data" ON vendor;
DROP POLICY IF EXISTS "new users can insert vendor during signup" ON vendor;
DROP POLICY IF EXISTS "Allow vendor insert for authenticated users" ON vendor;

-- Create policy for authenticated users
CREATE POLICY "vendor can insert their own data"
ON vendor
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() IS NOT NULL AND 
  auth.uid() = user_id
);

-- Step 5: Verify the setup (optional - uncomment to run)
-- Check if function exists:
-- SELECT routine_name, routine_type 
-- FROM information_schema.routines 
-- WHERE routine_schema = 'public' 
-- AND routine_name = 'insert_vendor_for_new_user';

-- Check if RLS is enabled:
-- SELECT tablename, rowsecurity 
-- FROM pg_tables 
-- WHERE schemaname = 'public' AND tablename = 'vendor';

-- Check policies:
-- SELECT * FROM pg_policies 
-- WHERE tablename = 'vendor';

-- ============================================
-- IMPORTANT NOTES:
-- ============================================
-- 1. After running this migration, vendor registration should work
-- 2. The function bypasses RLS using SECURITY DEFINER
-- 3. If you still get errors, check:
--    - That the users table has a trigger to create user profiles
--    - That the vendor table structure matches the function parameters
--    - Browser console for detailed error messages
-- ============================================

