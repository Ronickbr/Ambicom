-- Adiciona 'tspl' aos tipos de payload permitidos na tabela print_jobs
ALTER TABLE public.print_jobs DROP CONSTRAINT IF EXISTS print_jobs_payload_type_check;
ALTER TABLE public.print_jobs ADD CONSTRAINT print_jobs_payload_type_check CHECK (payload_type IN ('zpl', 'png', 'pdf', 'tspl'));
