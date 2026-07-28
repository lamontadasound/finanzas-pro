-- ══════════════════════════════════════════════════════════════════
-- Inversiones: factura de compra (Storage). Solo ADD, nunca DROP.
-- Ejecutar manualmente en el SQL Editor de Supabase tras revisión.
-- ══════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────
-- 1. STORAGE — bucket privado para las facturas de inversiones
-- ─────────────────────────────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public)
VALUES ('investment-invoices', 'investment-invoices', false)
ON CONFLICT (id) DO NOTHING;

-- Políticas explícitas por operación sobre storage.objects, limitadas al bucket.
DROP POLICY IF EXISTS "investment_invoices_select" ON storage.objects;
DROP POLICY IF EXISTS "investment_invoices_insert" ON storage.objects;
DROP POLICY IF EXISTS "investment_invoices_update" ON storage.objects;
DROP POLICY IF EXISTS "investment_invoices_delete" ON storage.objects;

CREATE POLICY "investment_invoices_select" ON storage.objects
  FOR SELECT USING (bucket_id = 'investment-invoices');

CREATE POLICY "investment_invoices_insert" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'investment-invoices');

CREATE POLICY "investment_invoices_update" ON storage.objects
  FOR UPDATE USING (bucket_id = 'investment-invoices') WITH CHECK (bucket_id = 'investment-invoices');

CREATE POLICY "investment_invoices_delete" ON storage.objects
  FOR DELETE USING (bucket_id = 'investment-invoices');

-- ─────────────────────────────────────────────────────────────────
-- 2. VERIFICACIÓN FINAL
-- ─────────────────────────────────────────────────────────────────
SELECT id, public FROM storage.buckets WHERE id = 'investment-invoices';
SELECT policyname FROM pg_policies WHERE tablename = 'objects' AND policyname LIKE 'investment_invoices%';
