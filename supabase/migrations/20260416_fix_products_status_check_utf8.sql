BEGIN;

UPDATE public.products
SET status = 'EM AVALIAÇÃO'
WHERE status = 'EM AVALIA├ç├âO';

ALTER TABLE public.products
DROP CONSTRAINT IF EXISTS products_status_check;

ALTER TABLE public.products
ADD CONSTRAINT products_status_check
CHECK (
  status = ANY (
    ARRAY[
      'CADASTRO'::text,
      'EM AVALIAÇÃO'::text,
      'EM ESTOQUE'::text,
      'VENDIDO'::text,
      'RECUSADO'::text,
      'LIBERADO'::text,
      'TECNICO'::text,
      'SUPERVISOR'::text,
      'GESTOR'::text,
      'REPROVADO'::text
    ]
  )
);

COMMIT;
