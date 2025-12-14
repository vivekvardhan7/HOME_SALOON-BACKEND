-- Sync user roles between public.users and auth.users
-- Adds/updates the "role" field inside auth.users.raw_user_meta_data so it is visible in Supabase Auth UI

-- 1. Backfill existing auth user metadata from public.users
UPDATE auth.users au
SET raw_user_meta_data = COALESCE(au.raw_user_meta_data, '{}'::jsonb) || jsonb_build_object('role', pu.role)
FROM public.users pu
WHERE au.id = pu.id
  AND pu.role IS NOT NULL
  AND (au.raw_user_meta_data->>'role') IS DISTINCT FROM pu.role;

-- 2. Create helper function to sync changes whenever public.users.role is inserted/updated
CREATE OR REPLACE FUNCTION public.sync_user_role_to_auth()
RETURNS trigger AS $$
BEGIN
  UPDATE auth.users
  SET raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || jsonb_build_object('role', NEW.role)
  WHERE id = NEW.id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Attach trigger to keep auth metadata in sync
DROP TRIGGER IF EXISTS update_auth_user_role ON public.users;
CREATE TRIGGER update_auth_user_role
AFTER INSERT OR UPDATE OF role ON public.users
FOR EACH ROW EXECUTE FUNCTION public.sync_user_role_to_auth();
