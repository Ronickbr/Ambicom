-- Migration: Adicionar campos para layout de PDF e preços diferenciados
-- Data: 2026-04-17

-- 1. Adicionar has_water_dispenser à tabela products
ALTER TABLE public.products 
ADD COLUMN IF NOT EXISTS has_water_dispenser BOOLEAN DEFAULT FALSE;

-- 2. Adicionar price_large_a à tabela clients
ALTER TABLE public.clients 
ADD COLUMN IF NOT EXISTS price_large_a NUMERIC(10,2) DEFAULT 0;

-- Comentários para documentação no banco
COMMENT ON COLUMN public.products.has_water_dispenser IS 'Indica se o produto (refrigerador) possui dispenser de água, afetando a classificação de tamanho.';
COMMENT ON COLUMN public.clients.price_large_a IS 'Preço diferenciado para produtos de tamanho Grande/A (Grande com dispenser de água).';
