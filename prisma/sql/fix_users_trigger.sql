-- Function to handle new user creation from Supabase Auth
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.users (id, email, first_name, last_name, password, role, status, created_at, updated_at)
  VALUES (
    new.id,
    new.email,
    COALESCE(new.raw_user_meta_data->>'firstName', new.raw_user_meta_data->>'first_name', 'Unknown'),
    COALESCE(new.raw_user_meta_data->>'lastName', new.raw_user_meta_data->>'last_name', 'User'),
    'managed_by_auth', -- Placeholder password as actual auth is handled by Supabase
    COALESCE(new.raw_user_meta_data->>'role', 'CUSTOMER'),
    'ACTIVE',
    COALESCE(new.created_at, now()),
    now()
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    updated_at = now();
  RETURN new;
END;
$$;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Create the trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- Backfill script: Insert missing users from auth.users into public.users
INSERT INTO public.users (id, email, first_name, last_name, password, role, status, created_at, updated_at)
SELECT
  id,
  email,
  COALESCE(raw_user_meta_data->>'firstName', raw_user_meta_data->>'first_name', 'Unknown'),
  COALESCE(raw_user_meta_data->>'lastName', raw_user_meta_data->>'last_name', 'User'),
  'managed_by_auth',
  COALESCE(raw_user_meta_data->>'role', 'CUSTOMER'),
  'ACTIVE',
  created_at,
  now()
FROM auth.users
WHERE id NOT IN (SELECT id FROM public.users);
