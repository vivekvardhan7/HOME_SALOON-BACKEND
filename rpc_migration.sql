-- RPC Functions for Transaction Simulation (or placeholder)
-- PostgREST/Supabase HTTP requests are stateless, so 'begin', 'commit', 'rollback' 
-- via RPC do not actually control a transaction across multiple requests.
-- However, these functions are defined to prevent client-side errors if the code calls them.

CREATE OR REPLACE FUNCTION public.begin()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  -- No-op for REST
  NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.commit()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  -- No-op for REST
  NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.rollback()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  -- No-op for REST
  NULL;
END;
$$;

-- Grant permissions to authenticated users (and anon if needed)
GRANT EXECUTE ON FUNCTION public.begin TO authenticated;
GRANT EXECUTE ON FUNCTION public.commit TO authenticated;
GRANT EXECUTE ON FUNCTION public.rollback TO authenticated;
GRANT EXECUTE ON FUNCTION public.begin TO anon;
GRANT EXECUTE ON FUNCTION public.commit TO anon;
GRANT EXECUTE ON FUNCTION public.rollback TO anon;
