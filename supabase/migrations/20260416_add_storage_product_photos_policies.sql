BEGIN;

DROP POLICY IF EXISTS "product-photos: read" ON storage.objects;
DROP POLICY IF EXISTS "product-photos: insert" ON storage.objects;
DROP POLICY IF EXISTS "product-photos: update" ON storage.objects;
DROP POLICY IF EXISTS "product-photos: delete" ON storage.objects;

CREATE POLICY "product-photos: read" ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'product-photos');

CREATE POLICY "product-photos: insert" ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'product-photos');

CREATE POLICY "product-photos: update" ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'product-photos' AND owner = auth.uid())
WITH CHECK (bucket_id = 'product-photos' AND owner = auth.uid());

CREATE POLICY "product-photos: delete" ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'product-photos' AND owner = auth.uid());

COMMIT;
