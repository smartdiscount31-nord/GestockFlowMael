-- 20251103_create_stock_movements.sql
-- Traçabilité des entrées/sorties de stock liées aux documents (invoice/credit_note/refund)

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'stock_movements'
  ) THEN
    CREATE TABLE public.stock_movements (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      product_id uuid NOT NULL REFERENCES public.products(id),
      stock_id uuid NOT NULL REFERENCES public.stocks(id),
      qty integer NOT NULL, -- quantité absolue (positive); le sens est donné par operation
      operation text NOT NULL CHECK (operation IN ('IN','OUT')),
      ref_type text NOT NULL CHECK (ref_type IN ('invoice','credit_note','refund')),
      ref_id uuid NOT NULL,
      serial_id uuid NULL,
      created_at timestamptz DEFAULT now(),
      created_by uuid NULL
    );
  END IF;
END
$$;

-- Indexes de performance
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'idx_stock_movements_product_created_at') THEN
    CREATE INDEX idx_stock_movements_product_created_at
      ON public.stock_movements (product_id, created_at DESC);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'idx_stock_movements_ref') THEN
    CREATE INDEX idx_stock_movements_ref
      ON public.stock_movements (ref_type, ref_id);
  END IF;
END
$$;

-- Idempotence optionnelle: empêcher l&#39;insertion de doublons stricts pour une même référence documentaire
-- Décommentez si vous souhaitez un garde-fou au niveau DB.
-- DO $$
-- BEGIN
--   IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'uq_stock_movements_idempotent') THEN
--     CREATE UNIQUE INDEX uq_stock_movements_idempotent
--       ON public.stock_movements (
--         ref_type,
--         ref_id,
--         product_id,
--         stock_id,
--         qty,
--         COALESCE(serial_id, '00000000-0000-0000-0000-000000000000'::uuid)
--       );
--   END IF;
-- END
-- $$;
