-- Fix permissions and relationships for product_logs table to allow proper joining in Manager Dashboard

-- 1. Rename column user_id to actor_id if it exists
DO $$
BEGIN
  IF EXISTS(SELECT *
    FROM information_schema.columns
    WHERE table_name='product_logs' AND column_name='user_id')
  THEN
      ALTER TABLE "product_logs" RENAME COLUMN "user_id" TO "actor_id";
  END IF;
END $$;

-- 2. Update Foreign Key to point to public.profiles instead of auth.users
-- This allows PostgREST to automatically detect the relationship for joining
ALTER TABLE product_logs
  DROP CONSTRAINT IF EXISTS product_logs_user_id_fkey;

ALTER TABLE product_logs
  DROP CONSTRAINT IF EXISTS product_logs_actor_id_fkey;

ALTER TABLE product_logs
  ADD CONSTRAINT product_logs_actor_id_fkey
  FOREIGN KEY (actor_id)
  REFERENCES profiles(id)
  ON DELETE SET NULL;

-- 3. Add RLS Policies for product_logs (was missing in initial schema)
DROP POLICY IF EXISTS "Logs viewable by authenticated users" ON product_logs;
CREATE POLICY "Logs viewable by authenticated users" ON product_logs
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Logs insertable by authenticated users" ON product_logs;
CREATE POLICY "Logs insertable by authenticated users" ON product_logs
  FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);

-- 4. Add RLS Policies for order_items (also missing)
DROP POLICY IF EXISTS "Order items viewable by authenticated users" ON order_items;
CREATE POLICY "Order items viewable by authenticated users" ON order_items
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Order items manageable by managers" ON order_items;
CREATE POLICY "Order items manageable by managers" ON order_items
  FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('GESTOR', 'ADMIN'))
);