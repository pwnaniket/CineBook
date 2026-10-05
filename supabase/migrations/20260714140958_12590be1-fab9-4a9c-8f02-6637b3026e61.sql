
ALTER TABLE public.show_seats REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.show_seats;
