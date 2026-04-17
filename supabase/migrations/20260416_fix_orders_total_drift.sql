BEGIN;

CREATE OR REPLACE FUNCTION public.recalculate_order_total(p_order_id uuid)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_total numeric := 0;
BEGIN
    SELECT COALESCE(SUM(oi.unit_price), 0)
      INTO v_total
      FROM public.order_items oi
     WHERE oi.order_id = p_order_id;

    UPDATE public.orders
       SET total_amount = v_total
     WHERE id = p_order_id;

    RETURN v_total;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_order_total_from_items()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_order_id uuid;
BEGIN
    v_order_id := COALESCE(NEW.order_id, OLD.order_id);

    IF v_order_id IS NOT NULL THEN
        PERFORM public.recalculate_order_total(v_order_id);
    END IF;

    RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trigger_sync_order_total_from_items ON public.order_items;
CREATE TRIGGER trigger_sync_order_total_from_items
AFTER INSERT OR UPDATE OR DELETE ON public.order_items
FOR EACH ROW
EXECUTE FUNCTION public.sync_order_total_from_items();

GRANT EXECUTE ON FUNCTION public.recalculate_order_total(uuid) TO authenticated;

COMMIT;
