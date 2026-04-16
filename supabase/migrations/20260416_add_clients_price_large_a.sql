ALTER TABLE public.clients
ADD COLUMN IF NOT EXISTS price_large_a numeric DEFAULT 0;
