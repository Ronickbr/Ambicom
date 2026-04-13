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
