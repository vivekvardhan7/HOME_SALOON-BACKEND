CREATE FUNCTION public.get_manager_dashboard_data()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN jsonb_build_object(
    'pending', (
      SELECT count(*) FROM public.vendor
      WHERE status = 'PENDING'
    ),
    'approved', (
      SELECT count(*) FROM public.vendor
      WHERE status = 'APPROVED'
    ),
    'rejected', (
      SELECT count(*) FROM public.vendor
      WHERE status = 'REJECTED'
    ),
    'total', (
      SELECT count(*) FROM public.vendor
    )
  );
END;
$$;
