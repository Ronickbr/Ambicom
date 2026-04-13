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
