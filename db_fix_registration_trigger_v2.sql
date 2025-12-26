-- FIX: Handle Duplicate Email Error and Fix Trigger
-- This script safely syncs users and fixes the ghost user issue

-- 1. Create Handle New User Function
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, first_name, last_name, role, status, phone)
  VALUES (
    new.id,
    new.email,
    new.raw_user_meta_data->>'first_name',
    new.raw_user_meta_data->>'last_name',
    COALESCE(new.raw_user_meta_data->>'role', 'CUSTOMER'),
    COALESCE(new.raw_user_meta_data->>'status', 'PENDING_VERIFICATION'),
    new.raw_user_meta_data->>'phone'
  )
  ON CONFLICT (id) DO UPDATE SET
    first_name = EXCLUDED.first_name,
    last_name = EXCLUDED.last_name,
    role = EXCLUDED.role,
    status = EXCLUDED.status,
    phone = EXCLUDED.phone;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Create Trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- 3. CLEANUP: Remove "Ghost" users from public.users that have same email but different ID in auth.users
-- This fixes the "duplicate key value violates unique constraint users_email_key" error
DELETE FROM public.users
WHERE email IN (
    SELECT email FROM auth.users
) AND id NOT IN (
    SELECT id FROM auth.users
);

-- 4. Sync missing users (Safe Insert)
INSERT INTO public.users (id, email, first_name, last_name, role, status, phone)
SELECT 
  au.id, 
  au.email, 
  au.raw_user_meta_data->>'first_name',
  au.raw_user_meta_data->>'last_name',
  COALESCE(au.raw_user_meta_data->>'role', 'CUSTOMER'),
  'PENDING_VERIFICATION',
  au.raw_user_meta_data->>'phone'
FROM auth.users au
LEFT JOIN public.users pu ON pu.id = au.id
WHERE pu.id IS NULL
ON CONFLICT (id) DO NOTHING;
