-- 20251103_add_credit_note_linking.sql
-- Lien avoir ↔ ligne de facture + garde-fou quantité remboursée

-- Colonne de liaison (nullable) vers la ligne de facture d&#39;origine
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'credit_note_items'
      AND column_name = 'invoice_item_id'
  ) THEN
    ALTER TABLE public.credit_note_items
      ADD COLUMN invoice_item_id uuid NULL REFERENCES public.invoice_items(id);
  END IF;
END
$$;

-- Fonction de contrôle: somme remboursée ≤ quantité facturée
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc WHERE proname = 'check_credit_note_item_qty'
  ) THEN
    CREATE OR REPLACE FUNCTION public.check_credit_note_item_qty()
    RETURNS trigger
    LANGUAGE plpgsql
    AS $fn$
    DECLARE
      v_invoice_item_qty numeric;
      v_already_refunded numeric;
      v_new_total numeric;
      v_invoice_item_id uuid;
    BEGIN
      v_invoice_item_id := NEW.invoice_item_id;

      -- Si pas de mapping explicite, on laisse passer (cas non mappé)
      IF v_invoice_item_id IS NULL THEN
        RETURN NEW;
      END IF;

      -- Quantité facturée sur la ligne d&#39;origine
      SELECT COALESCE(quantity, 0)::numeric
      INTO v_invoice_item_qty
      FROM public.invoice_items
      WHERE id = v_invoice_item_id;

      -- Total déjà remboursé (hors ligne courante)
      SELECT COALESCE(SUM((cni.qty)::numeric), 0)
      INTO v_already_refunded
      FROM public.credit_note_items cni
      WHERE cni.invoice_item_id = v_invoice_item_id
        AND cni.id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid);

      v_new_total := v_already_refunded + COALESCE(NEW.qty::numeric, 0);

      IF v_new_total > v_invoice_item_qty THEN
        RAISE EXCEPTION
          'Credit note qty (%.2f) exceeds invoiced qty (%.2f) for invoice_item_id=%',
          v_new_total, v_invoice_item_qty, v_invoice_item_id
          USING ERRCODE = '23514';
      END IF;

      RETURN NEW;
    END;
    $fn$;
  END IF;
END
$$;

-- Déclencheur de contrôle à l&#39;insertion/mise à jour
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_check_credit_note_item_qty'
  ) THEN
    CREATE TRIGGER trg_check_credit_note_item_qty
    BEFORE INSERT OR UPDATE ON public.credit_note_items
    FOR EACH ROW
    EXECUTE FUNCTION public.check_credit_note_item_qty();
  END IF;
END
$$;
