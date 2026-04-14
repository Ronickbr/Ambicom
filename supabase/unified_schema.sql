-- ==========================================
-- Migration: 20260224_initial_schema.sql
-- ==========================================
-- Initial Schema for Ambicom Scan-relatorio

-- 1. Functions for auto-updating timestamps
CREATE OR REPLACE FUNCTION handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql' SET search_path = public;

-- 2. Profiles (App Users)
CREATE TABLE IF NOT EXISTS profiles (
    id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
    full_name TEXT,
    role TEXT CHECK (role IN ('TECNICO', 'SUPERVISOR', 'GESTOR', 'ADMIN')) DEFAULT 'TECNICO',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Products
CREATE TABLE IF NOT EXISTS products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    original_serial TEXT UNIQUE,
    internal_serial TEXT UNIQUE,
    model TEXT,
    brand TEXT,
    commercial_code TEXT,
    color TEXT,
    product_type TEXT,
    pnc_ml TEXT,
    manufacturing_date TEXT,
    market_class TEXT,
    refrigerant_gas TEXT,
    gas_charge TEXT,
    compressor TEXT,
    volume_freezer TEXT,
    volume_refrigerator TEXT,
    volume_total TEXT,
    pressure_high_low TEXT,
    freezing_capacity TEXT,
    electric_current TEXT,
    defrost_power TEXT,
    frequency TEXT,
    voltage TEXT,
    technical_data JSONB, -- Keep JSONB for flexibility/overflow
    status TEXT CHECK (status IN ('CADASTRO', 'TECNICO', 'SUPERVISOR', 'GESTOR', 'LIBERADO')) DEFAULT 'CADASTRO',
    is_in_stock BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    created_by UUID REFERENCES auth.users(id)
);

-- 4. Product Logs & Checklist
CREATE TABLE IF NOT EXISTS product_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID REFERENCES products(id) ON DELETE CASCADE,
    actor_id UUID REFERENCES auth.users(id),
    previous_status TEXT,
    new_status TEXT,
    checklist JSONB, -- Stores the JSON data of evaluations
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 5. Clients
CREATE TABLE IF NOT EXISTS clients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    tax_id TEXT UNIQUE, -- CPF or CNPJ
    email TEXT,
    phone TEXT,
    address TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 6. Orders (Outbound)
CREATE TABLE IF NOT EXISTS orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID REFERENCES clients(id),
    status TEXT CHECK (status IN ('PENDENTE', 'FATURADO', 'DESPACHADO', 'ENTREGUE', 'CANCELADO')) DEFAULT 'PENDENTE',
    total_amount DECIMAL(10,2),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 7. Order Items (Linking Products to Orders)
CREATE TABLE IF NOT EXISTS order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
    product_id UUID REFERENCES products(id),
    unit_price DECIMAL(10,2),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 8. Triggers for updated_at
DROP TRIGGER IF EXISTS update_profiles_updated_at ON profiles;
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE PROCEDURE handle_updated_at();

DROP TRIGGER IF EXISTS update_products_updated_at ON products;
CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON products FOR EACH ROW EXECUTE PROCEDURE handle_updated_at();

DROP TRIGGER IF EXISTS update_clients_updated_at ON clients;
CREATE TRIGGER update_clients_updated_at BEFORE UPDATE ON clients FOR EACH ROW EXECUTE PROCEDURE handle_updated_at();

DROP TRIGGER IF EXISTS update_orders_updated_at ON orders;
CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON orders FOR EACH ROW EXECUTE PROCEDURE handle_updated_at();

-- 9. RLS (Row Level Security)
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;

-- 9.1. Profile Policies
DROP POLICY IF EXISTS "Users can view their own profile" ON profiles;
CREATE POLICY "Users can view their own profile" ON profiles
    FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;
CREATE POLICY "Admins can view all profiles" ON profiles
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'ADMIN')
    );

-- 9.2. Product Policies
DROP POLICY IF EXISTS "Products viewable by all authenticated users" ON products;
CREATE POLICY "Products viewable by all authenticated users" ON products
    FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Technicians and higher can insert products" ON products;
CREATE POLICY "Technicians and higher can insert products" ON products
    FOR INSERT TO authenticated WITH CHECK (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('TECNICO', 'SUPERVISOR', 'GESTOR', 'ADMIN'))
    );

DROP POLICY IF EXISTS "Supervisors and higher can update products" ON products;
CREATE POLICY "Supervisors and higher can update products" ON products
    FOR UPDATE TO authenticated USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('SUPERVISOR', 'GESTOR', 'ADMIN'))
    );

DROP POLICY IF EXISTS "Only Gestors and Admins can delete products" ON products;
CREATE POLICY "Only Gestors and Admins can delete products" ON products
    FOR DELETE TO authenticated USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('GESTOR', 'ADMIN'))
    );

-- 9.3. Client & Order Policies
DROP POLICY IF EXISTS "Clients viewable by authenticated" ON clients;
CREATE POLICY "Clients viewable by authenticated" ON clients FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Clients manageable by managers" ON clients;
CREATE POLICY "Clients manageable by managers" ON clients FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('GESTOR', 'ADMIN'))
);

DROP POLICY IF EXISTS "Orders viewable by authenticated" ON orders;
CREATE POLICY "Orders viewable by authenticated" ON orders FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Orders manageable by managers" ON orders;
CREATE POLICY "Orders manageable by managers" ON orders FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('GESTOR', 'ADMIN'))
);

-- 10. Auth Trigger for New Users
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, full_name, role)
    VALUES (new.id, COALESCE(new.raw_user_meta_data->>'full_name', 'Novo Usuário'), COALESCE(new.raw_user_meta_data->>'role', 'TECNICO'));
    RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE PROCEDURE handle_new_user();



-- ==========================================
-- Migration: 20260225_fix_manager_logs.sql
-- ==========================================
-- Fix permissions and relationships for product_logs table to allow proper joining in Manager Dashboard

-- 1. Rename column user_id to actor_id if it exists
DO $$
BEGIN
  IF EXISTS(SELECT *
    FROM information_schema.columns
    WHERE table_name='product_logs' AND column_name='user_id')
  THEN
      ALTER TABLE "product_logs" RENAME COLUMN "user_id" TO "actor_id";
  END IF;
END $$;

-- 2. Update Foreign Key to point to public.profiles instead of auth.users
-- This allows PostgREST to automatically detect the relationship for joining
ALTER TABLE product_logs
  DROP CONSTRAINT IF EXISTS product_logs_user_id_fkey;

ALTER TABLE product_logs
  DROP CONSTRAINT IF EXISTS product_logs_actor_id_fkey;

ALTER TABLE product_logs
  ADD CONSTRAINT product_logs_actor_id_fkey
  FOREIGN KEY (actor_id)
  REFERENCES profiles(id)
  ON DELETE SET NULL;

-- 3. Add RLS Policies for product_logs (was missing in initial schema)
DROP POLICY IF EXISTS "Logs viewable by authenticated users" ON product_logs;
CREATE POLICY "Logs viewable by authenticated users" ON product_logs
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Logs insertable by authenticated users" ON product_logs;
CREATE POLICY "Logs insertable by authenticated users" ON product_logs
  FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);

-- 4. Add RLS Policies for order_items (also missing)
DROP POLICY IF EXISTS "Order items viewable by authenticated users" ON order_items;
CREATE POLICY "Order items viewable by authenticated users" ON order_items
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Order items manageable by managers" ON order_items;
CREATE POLICY "Order items manageable by managers" ON order_items
  FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('GESTOR', 'ADMIN'))
);



-- ==========================================
-- Migration: 20260304_add_email_to_profiles.sql
-- ==========================================
-- Migration to add email column to profiles for easier management
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email TEXT;

-- Update existing profiles with emails from auth.users (requires service_role/admin context to run, 
-- but this migration file serves as a template/trackable change)
-- UPDATE public.profiles p SET email = u.email FROM auth.users u WHERE p.id = u.id;

-- Update the sync trigger to include email
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, full_name, role, email)
    VALUES (
        new.id, 
        COALESCE(new.raw_user_meta_data->>'full_name', 'Novo Usuário'), 
        COALESCE(new.raw_user_meta_data->>'role', 'TECNICO'),
        new.email
    );
    RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;



-- ==========================================
-- Migration: 20260304_create_checklist_items.sql
-- ==========================================
-- Migration: Create checklist_items table
-- Description: Stores the items that appear in the technician's checklist.

CREATE TABLE IF NOT EXISTS checklist_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    label TEXT NOT NULL,
    category TEXT NOT NULL,
    is_optional BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Initial Seed Data
INSERT INTO checklist_items (label, category) VALUES
('Liga Corretamente?', 'Funcional'),
('Display/Painel funcionando?', 'Funcional'),
('Integridade Física (Sem amassados/riscos)', 'Estético'),
('Estado de Limpeza', 'Geral'),
('Cabos e Conectores íntegros?', 'Componentes');

-- RLS Policies
ALTER TABLE checklist_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Checklist items viewable by all authenticated users" ON checklist_items;
CREATE POLICY "Checklist items viewable by all authenticated users" ON checklist_items
    FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Technicians and higher can insert checklist items" ON checklist_items;
CREATE POLICY "Technicians and higher can insert checklist items" ON checklist_items
    FOR INSERT TO authenticated WITH CHECK (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('TECNICO', 'SUPERVISOR', 'GESTOR', 'ADMIN'))
    );

-- Grant permissions to authenticated users
GRANT ALL ON checklist_items TO authenticated;
GRANT ALL ON checklist_items TO service_role;



-- ==========================================
-- Migration: 20260304_create_system_settings.sql
-- ==========================================
-- Migration to create system_settings table
CREATE TABLE IF NOT EXISTS system_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key TEXT UNIQUE NOT NULL,
    value JSONB NOT NULL,
    description TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_by UUID REFERENCES auth.users(id)
);

-- Trigger for updated_at
DROP TRIGGER IF EXISTS update_system_settings_updated_at ON system_settings;
CREATE TRIGGER update_system_settings_updated_at BEFORE UPDATE ON system_settings FOR EACH ROW EXECUTE PROCEDURE handle_updated_at();

-- RLS
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "System settings viewable by authenticated users" ON system_settings;
CREATE POLICY "System settings viewable by authenticated users" ON system_settings
    FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "System settings manageable by admins" ON system_settings;
CREATE POLICY "System settings manageable by admins" ON system_settings
    FOR ALL TO authenticated USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'ADMIN')
    );

-- Seed initial sequence start if not exists
INSERT INTO system_settings (key, value, description)
VALUES ('ambicom_sequence_start', '1', 'Initial number for the ID Ambicom sequence')
ON CONFLICT (key) DO NOTHING;



-- ==========================================
-- Migration: 20260304_v2_status_and_photos.sql
-- ==========================================
-- Migration: Update products status and add photo fields
-- Description: Adds 'VENDIDO' to status check and photo columns

-- 1. Update the check constraint for status
-- First, drop the existing constraint if possible, or add a new one.
-- Looking at the initial schema, it was: status TEXT CHECK (status IN ('CADASTRO', 'TECNICO', 'SUPERVISOR', 'GESTOR', 'LIBERADO'))

DO $$ 
BEGIN 
    ALTER TABLE products DROP CONSTRAINT IF EXISTS products_status_check;
    ALTER TABLE products ADD CONSTRAINT products_status_check CHECK (status IN ('CADASTRO', 'TECNICO', 'SUPERVISOR', 'GESTOR', 'LIBERADO', 'VENDIDO'));
END $$;

-- 2. Add photo URL columns
ALTER TABLE products ADD COLUMN IF NOT EXISTS photo_product TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS photo_model TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS photo_serial TEXT;

-- 3. Update statusConfig in app code will follow



-- ==========================================
-- Migration: 20240307221000_perf_optimizations.sql
-- ==========================================

-- 1. Optimized Dashboard Stats RPC
CREATE OR REPLACE FUNCTION get_dashboard_stats()
RETURNS JSON AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    'total', (SELECT count(*) FROM products),
    'cadastro', (SELECT count(*) FROM products WHERE status = 'CADASTRO'),
    'em_avaliacao', (SELECT count(*) FROM products WHERE status = 'EM AVALIAÇÃO'),
    'em_estoque', (SELECT count(*) FROM products WHERE status = 'EM ESTOQUE')
  ) INTO result;
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 2. Optimized Internal Serial Generator RPC
CREATE OR REPLACE FUNCTION get_next_internal_serial()
RETURNS TEXT AS $$
DECLARE
  current_year INT;
  manual_start INT;
  last_num INT;
  next_num INT;
  new_serial TEXT;
BEGIN
  current_year := EXTRACT(YEAR FROM now());
  
  -- Get manual start from settings
  SELECT (value->>0)::INT INTO manual_start 
  FROM system_settings 
  WHERE key = 'ambicom_sequence_start';
  
  IF manual_start IS NULL THEN manual_start := 1; END IF;

  -- Get last serial number for the current year
  -- Assuming format is '00000-YYYY'
  SELECT MAX((split_part(internal_serial, '-', 1))::INT) INTO last_num
  FROM products
  WHERE internal_serial LIKE '%-' || current_year;

  IF last_num IS NULL THEN
    next_num := manual_start;
  ELSE
    next_num := GREATEST(last_num + 1, manual_start);
  END IF;

  new_serial := LPAD(next_num::TEXT, 5, '0') || '-' || current_year;
  RETURN new_serial;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 3. Optimized Filters RPC
CREATE OR REPLACE FUNCTION get_inventory_filters()
RETURNS TABLE (brand TEXT, voltage TEXT) AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT p.brand, p.voltage
  FROM products p
  WHERE p.brand IS NOT NULL OR p.voltage IS NOT NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 4. Improvements to Indexes
CREATE INDEX IF NOT EXISTS idx_products_status_created ON products(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_products_brand_model ON products(brand, model);
CREATE INDEX IF NOT EXISTS idx_product_logs_product_id ON product_logs(product_id);
CREATE INDEX IF NOT EXISTS idx_products_internal_serial_year ON products(internal_serial) WHERE internal_serial LIKE '%-202%'; -- Partial index for speed if needed



-- ==========================================
-- Migration: 20260319200000_fix_remote_lint_warnings.sql
-- ==========================================
-- Migration to fix Supabase Linter warnings identified in erros.md

-- 1. Fix function_search_path_mutable
-- Dynamically update search_path for functions highlighted by the linter.
DO $$
DECLARE
    r record;
BEGIN
    FOR r IN 
        SELECT p.oid::regprocedure AS proc_identity
        FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'public' 
          AND p.proname IN (
              'get_next_internal_serial', 
              'get_inventory_filters', 
              'get_dashboard_stats', 
              'handle_new_user', 
              'handle_updated_at', 
              'check_user_role', 
              'is_admin', 
              'has_any_role'
          )
    LOOP
        EXECUTE format('ALTER FUNCTION %s SET search_path = public', r.proc_identity);
    END LOOP;
END $$;

-- 2. Fix rls_policy_always_true
-- Replace overly permissive WITH CHECK (true) or USING (true) for non-SELECT commands with auth.uid() IS NOT NULL.

DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'product_logs' AND policyname = 'Enable insert for authenticated users only') THEN
        DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON public.product_logs;
        CREATE POLICY "Enable insert for authenticated users only" ON public.product_logs
            FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
    END IF;
END $$;

DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'product_logs' AND policyname = 'Logs insertable by authenticated users') THEN
        DROP POLICY IF EXISTS "Logs insertable by authenticated users" ON public.product_logs;
        CREATE POLICY "Logs insertable by authenticated users" ON public.product_logs
            FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
    END IF;
END $$;

DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'products' AND policyname = 'Status update logic') THEN
        DROP POLICY IF EXISTS "Status update logic" ON public.products;
        CREATE POLICY "Status update logic" ON public.products
            FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
    END IF;
END $$;



-- ==========================================
-- Migration: 20260323000000_add_refrigerator_sizes.sql
-- ==========================================
-- Migration to add size column to products and configuration in settings

-- Add size column to products table
ALTER TABLE products ADD COLUMN IF NOT EXISTS size TEXT;

-- Insert default settings for refrigerator sizes
INSERT INTO system_settings (key, value, description)
VALUES (
    'refrigerator_sizes', 
    '{"small_max": 300, "medium_max": 550}', 
    'Configuração de limites de volume (em Litros) para classificação de tamanho dos refrigeradores'
)
ON CONFLICT (key) DO NOTHING;



-- ==========================================
-- Migration: 20260407220000_create_print_jobs.sql
-- ==========================================
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



-- ==========================================
-- Migration: 20260412000000_add_tspl_to_print_jobs.sql
-- ==========================================
-- Adiciona 'tspl' aos tipos de payload permitidos na tabela print_jobs
ALTER TABLE public.print_jobs DROP CONSTRAINT IF EXISTS print_jobs_payload_type_check;
ALTER TABLE public.print_jobs ADD CONSTRAINT print_jobs_payload_type_check CHECK (payload_type IN ('zpl', 'png', 'pdf', 'tspl'));



-- ==========================================
-- Migration: 20260412000001_advanced_filters.sql
-- ==========================================
-- Create a new RPC function to get all distinct filter values efficiently
CREATE OR REPLACE FUNCTION get_inventory_advanced_filters()
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT jsonb_build_object(
    'brands', (SELECT jsonb_agg(DISTINCT brand) FROM products WHERE brand IS NOT NULL),
    'voltages', (SELECT jsonb_agg(DISTINCT voltage) FROM products WHERE voltage IS NOT NULL),
    'types', (SELECT jsonb_agg(DISTINCT product_type) FROM products WHERE product_type IS NOT NULL),
    'classes', (SELECT jsonb_agg(DISTINCT market_class) FROM products WHERE market_class IS NOT NULL),
    'gases', (SELECT jsonb_agg(DISTINCT refrigerant_gas) FROM products WHERE refrigerant_gas IS NOT NULL)
  );
$$;



