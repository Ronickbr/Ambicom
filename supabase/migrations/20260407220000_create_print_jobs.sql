-- Create print_jobs table
CREATE TABLE IF NOT EXISTS public.print_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'dead_letter')),
    payload_type TEXT NOT NULL CHECK (payload_type IN ('zpl', 'png', 'pdf')),
    payload_data TEXT NOT NULL,
    printer_target TEXT NOT NULL,
    attempts INTEGER NOT NULL DEFAULT 0,
    max_attempts INTEGER NOT NULL DEFAULT 5,
    error_history JSONB NOT NULL DEFAULT '[]'::jsonb,
    picked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by UUID REFERENCES auth.users(id)
);

-- Create active_bridges table
CREATE TABLE IF NOT EXISTS public.active_bridges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bridge_name TEXT NOT NULL UNIQUE,
    available_printers JSONB NOT NULL DEFAULT '[]'::jsonb,
    last_heartbeat TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_print_jobs_status ON public.print_jobs(status) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_active_bridges_heartbeat ON public.active_bridges(last_heartbeat);

-- RLS Policies
ALTER TABLE public.print_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.active_bridges ENABLE ROW LEVEL SECURITY;

-- Policies for print_jobs
CREATE POLICY "Authenticated users can insert print jobs" 
ON public.print_jobs FOR INSERT 
WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can select print jobs" 
ON public.print_jobs FOR SELECT 
USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update their print jobs" 
ON public.print_jobs FOR UPDATE 
USING (auth.role() = 'authenticated');

-- Policies for active_bridges
CREATE POLICY "Everyone can select active bridges" 
ON public.active_bridges FOR SELECT 
USING (true);

-- Enable Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.print_jobs;
ALTER PUBLICATION supabase_realtime ADD TABLE public.active_bridges;

-- Function for updated_at
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_print_jobs_updated_at
BEFORE UPDATE ON public.print_jobs
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
