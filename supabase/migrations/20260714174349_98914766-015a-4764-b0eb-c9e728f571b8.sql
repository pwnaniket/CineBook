
REVOKE EXECUTE ON FUNCTION public.sim_target_occupancy(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sim_step_show(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sim_step_all() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sim_seed_all() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sim_step_all() TO postgres;
GRANT EXECUTE ON FUNCTION public.sim_seed_all() TO postgres;
