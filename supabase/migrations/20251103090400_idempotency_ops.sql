-- 20251103_idempotency_ops.sql
-- Table d&#39;idempotence pour éviter les doubles publications d&#39;opérations critiques

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'idempotency_ops'
  ) THEN
    CREATE TABLE public.idempotency_ops (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      idempotency_key uuid NOT NULL UNIQUE,
      ref_type text NOT NULL,  -- ex: 'invoice' | 'credit_note' | 'refund'
      ref_id uuid NOT NULL,
      created_at timestamptz DEFAULT now()
    );
  END IF;
END
$$;

-- Index pour requêtes rapides par référence
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'idx_idempotency_ops_ref') THEN
    CREATE INDEX idx_idempotency_ops_ref
      ON public.idempotency_ops (ref_type, ref_id);
  END IF;
END
$$;
