-- FIX: Handle Value Too Long Error (Truncate Inputs)
-- This version prevents errors by truncating phone and validation fields to schema limits

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
    -- Ensure status fits in VARCHAR(20) if defined as such, though PENDING_VERIFICATION is exactly 20
    COALESCE(new.raw_user_meta_data->>'status', 'PENDING_VERIFICATION'),
    -- Truncate phone to 20 characters to prevent overflow
    LEFT(new.raw_user_meta_data->>'phone', 20)
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

-- Re-create Trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- CLEANUP & SYNC (With truncation safety)
DELETE FROM public.users
WHERE email IN (SELECT email FROM auth.users) 
AND id NOT IN (SELECT id FROM auth.users);

INSERT INTO public.users (id, email, first_name, last_name, role, status, phone)
SELECT 
  au.id, 
  au.email, 
  au.raw_user_meta_data->>'first_name',
  au.raw_user_meta_data->>'last_name',
  COALESCE(au.raw_user_meta_data->>'role', 'CUSTOMER'),
  'PENDING_VERIFICATION',
  LEFT(au.raw_user_meta_data->>'phone', 20)
FROM auth.users au
LEFT JOIN public.users pu ON pu.id = au.id
WHERE pu.id IS NULL
ON CONFLICT (id) DO NOTHING;
