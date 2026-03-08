
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Optimized Filters RPC
CREATE OR REPLACE FUNCTION get_inventory_filters()
RETURNS TABLE (brand TEXT, voltage TEXT) AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT p.brand, p.voltage
  FROM products p
  WHERE p.brand IS NOT NULL OR p.voltage IS NOT NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Improvements to Indexes
CREATE INDEX IF NOT EXISTS idx_products_status_created ON products(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_products_brand_model ON products(brand, model);
CREATE INDEX IF NOT EXISTS idx_product_logs_product_id ON product_logs(product_id);
CREATE INDEX IF NOT EXISTS idx_products_internal_serial_year ON products(internal_serial) WHERE internal_serial LIKE '%-202%'; -- Partial index for speed if needed
