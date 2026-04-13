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
