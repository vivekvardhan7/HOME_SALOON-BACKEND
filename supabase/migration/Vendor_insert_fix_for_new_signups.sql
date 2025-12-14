

CREATE OR REPLACE FUNCTION public.insert_vendor_for_new_user(
  p_user_id      uuid,
  p_shopname     varchar(255),
  p_description  text         DEFAULT NULL,
  p_address      text         DEFAULT NULL,
  p_city         varchar(100) DEFAULT NULL,
  p_state        varchar(100) DEFAULT NULL,
  p_zip_code     varchar(20)  DEFAULT NULL,
  p_latitude     numeric      DEFAULT 0,
  p_longitude    numeric      DEFAULT 0,
  p_status       varchar(20)  DEFAULT 'PENDING' -- use uppercase to match CHECK constraint
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_vendor_id   uuid;
  v_user_exists boolean;
BEGIN
  -- Ensure user exists in public.users
  SELECT EXISTS(SELECT 1 FROM public.users WHERE id = p_user_id)
  INTO v_user_exists;

  IF NOT v_user_exists THEN
    PERFORM pg_sleep(0.5);
    SELECT EXISTS(SELECT 1 FROM public.users WHERE id = p_user_id)
    INTO v_user_exists;

    IF NOT v_user_exists THEN
      RAISE EXCEPTION 'User does not exist in public.users. Please ensure user profile was created.';
    END IF;
  END IF;

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
    p_description,
    p_address,
    p_city,
    p_state,
    p_zip_code,
    COALESCE(p_latitude, 0),
    COALESCE(p_longitude, 0),
    COALESCE(p_status, 'PENDING'),
    5,   -- default service_radius
    7,   -- default advance_booking
    24   -- default cancellation
  )
  RETURNING id INTO v_vendor_id;

  RETURN v_vendor_id;
END;
$$;

-- IMPORTANT: only allow secure roles (e.g. service role backend), not anon directly
GRANT EXECUTE ON FUNCTION public.insert_vendor_for_new_user TO authenticated;
REVOKE EXECUTE ON FUNCTION public.insert_vendor_for_new_user FROM anon;

-- ============================================
-- 2) Simplified INSERT policy on public.vendor
-- ============================================

-- Drop any previous vendor-insert policies that may be wrong
DROP POLICY IF EXISTS "vendors can insert their own data" ON public.vendor;
DROP POLICY IF EXISTS "new users can insert vendors during signup" ON public.vendor;
DROP POLICY IF EXISTS "Allow vendor insert for owner" ON public.vendor;

-- Simple policy: allow authenticated users to insert when auth.uid() == user_id
CREATE POLICY "Allow vendor insert for owner"
ON public.vendor
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Ensure RLS is enabled on vendor table
ALTER TABLE public.vendor ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 3) Optional verification queries (run manually if you want)
-- ============================================
-- Check if RLS is enabled:
-- SELECT tablename, rowsecurity
-- FROM pg_tables
-- WHERE schemaname = 'public' AND tablename = 'vendor';
--
-- Check if the function exists:
-- SELECT routine_name, routine_type
-- FROM information_schema.routines
-- WHERE routine_schema = 'public'
--   AND routine_name = 'insert_vendor_for_new_user';
--
-- Check if the policy exists:
-- SELECT * FROM pg_policies
-- WHERE schemaname = 'public'
--   AND tablename = 'vendor'
--   AND policyname = 'Allow vendor insert for owner';