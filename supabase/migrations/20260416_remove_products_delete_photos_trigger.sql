BEGIN;

DROP TRIGGER IF EXISTS trigger_delete_product_photos ON public.products;
DROP FUNCTION IF EXISTS public.delete_product_photos_on_delete();

COMMIT;
