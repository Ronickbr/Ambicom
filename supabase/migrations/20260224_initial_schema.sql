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
