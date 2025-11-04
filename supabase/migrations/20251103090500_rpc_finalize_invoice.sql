-- 20251103_rpc_finalize_invoice.sql
-- RPC finalize_invoice: finalise une facture (sorties stock + mouvements) avec idempotence

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'finalize_invoice') THEN
    CREATE OR REPLACE FUNCTION public.finalize_invoice(
      p_invoice_id uuid,
      p_user uuid,
      p_idempotency_key uuid
    )
    RETURNS jsonb
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path = public
    AS $$
    DECLARE
      v_invoice record;
      v_item record;
      v_effective_product uuid;
      v_is_serial boolean;
      v_serial_id uuid;
      v_qty numeric;
      v_stock_id uuid;
      v_current_qty integer;
      v_now timestamptz := now();
      v_out jsonb := '[]'::jsonb;
      v_movement_id uuid;
    BEGIN
      -- Idempotence: si déjà exécuté avec la même clé pour cette facture, on retourne un statut neutre
      IF EXISTS (
        SELECT 1 FROM public.idempotency_ops
        WHERE idempotency_key = p_idempotency_key
          AND ref_type = 'invoice'
          AND ref_id = p_invoice_id
      ) THEN
        RETURN jsonb_build_object('status','idempotent','invoice_id',p_invoice_id);
      END IF;

      -- Verrouiller la facture en 'draft'
      SELECT * INTO v_invoice
      FROM public.invoices
      WHERE id = p_invoice_id
      FOR UPDATE;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'Invoice not found: %', p_invoice_id;
      END IF;

      IF v_invoice.status IS DISTINCT FROM 'draft' THEN
        RETURN jsonb_build_object('status','skipped','reason','not_draft','invoice_id',p_invoice_id);
      END IF;

      -- Parcourir les lignes
      FOR v_item IN
        SELECT ii.*
        FROM public.invoice_items ii
        WHERE ii.invoice_id = p_invoice_id
      LOOP
        v_qty := COALESCE(v_item.quantity::numeric, 0);
        IF v_qty <= 0 THEN
          CONTINUE;
        END IF;

        -- Résoudre produit effectif (miroir -> parent) + détecter sérialisé
        SELECT
          CASE
            WHEN (p.parent_id IS NOT NULL AND p.serial_number IS NULL) THEN p.parent_id
            ELSE p.id
          END AS effective_product_id,
          (p.serial_number IS NOT NULL) AS is_serial,
          p.id AS original_product_id
        INTO v_effective_product, v_is_serial, v_serial_id
        FROM public.products p
        WHERE p.id = v_item.product_id;

        -- Choix du dépôt: celui avec plus de quantité, sinon premier dépôt existant
        SELECT sp.stock_id, sp.quantite::int
        INTO v_stock_id, v_current_qty
        FROM public.stock_produit sp
        WHERE sp.produit_id = v_effective_product
        ORDER BY sp.quantite DESC
        LIMIT 1;

        IF v_stock_id IS NULL THEN
          SELECT s.id INTO v_stock_id
          FROM public.stocks s
          ORDER BY s.created_at NULLS LAST, s.name
          LIMIT 1;
        END IF;

        IF v_stock_id IS NULL THEN
          RAISE EXCEPTION 'No stock location available for product %', v_effective_product;
        END IF;

        -- Contrôle & décrément
        IF v_is_serial THEN
          -- Attendu: une seule unité
          SELECT COALESCE(sp.quantite,0) INTO v_current_qty
          FROM public.stock_produit sp
          WHERE sp.produit_id = v_effective_product AND sp.stock_id = v_stock_id;

          IF v_current_qty < 1 THEN
            RAISE EXCEPTION 'Serialized item not available in stock (product %, stock %)', v_effective_product, v_stock_id;
          END IF;

          UPDATE public.stock_produit
             SET quantite = COALESCE(quantite,0) - 1, updated_at = v_now
           WHERE produit_id = v_effective_product AND stock_id = v_stock_id;

          INSERT INTO public.stock_movements(product_id, stock_id, qty, operation, ref_type, ref_id, serial_id, created_at, created_by)
          VALUES (v_effective_product, v_stock_id, 1, 'OUT', 'invoice', p_invoice_id, v_serial_id, v_now, p_user)
          RETURNING id INTO v_movement_id;

          v_out := v_out || jsonb_build_object('movement_id', v_movement_id, 'product_id', v_effective_product, 'stock_id', v_stock_id, 'qty', 1, 'serial_id', v_serial_id);
        ELSE
          -- Non sérialisé
          SELECT COALESCE(sp.quantite,0) INTO v_current_qty
          FROM public.stock_produit sp
          WHERE sp.produit_id = v_effective_product AND sp.stock_id = v_stock_id;

          IF v_current_qty < v_qty THEN
            RAISE EXCEPTION 'Insufficient stock for product %, needed=%, available=%', v_effective_product, v_qty, v_current_qty;
          END IF;

          UPDATE public.stock_produit
             SET quantite = COALESCE(quantite,0) - v_qty::int, updated_at = v_now
           WHERE produit_id = v_effective_product AND stock_id = v_stock_id;

          INSERT INTO public.stock_movements(product_id, stock_id, qty, operation, ref_type, ref_id, serial_id, created_at, created_by)
          VALUES (v_effective_product, v_stock_id, v_qty::int, 'OUT', 'invoice', p_invoice_id, NULL, v_now, p_user)
          RETURNING id INTO v_movement_id;

          v_out := v_out || jsonb_build_object('movement_id', v_movement_id, 'product_id', v_effective_product, 'stock_id', v_stock_id, 'qty', v_qty::int);
        END IF;
      END LOOP;

      -- Passage de statut (cohérent avec la contrainte existante)
      UPDATE public.invoices
         SET status = 'sent'
       WHERE id = p_invoice_id;

      -- Idempotence: enregistrer l&#39;opération
      INSERT INTO public.idempotency_ops(idempotency_key, ref_type, ref_id)
      VALUES (p_idempotency_key, 'invoice', p_invoice_id);

      RETURN jsonb_build_object('status','ok','invoice_id',p_invoice_id,'movements',v_out);
    END;
    $$;
  END IF;
END
$$;

-- Autorisations d&#39;exécution (adapter selon vos rôles)
GRANT EXECUTE ON FUNCTION public.finalize_invoice(uuid, uuid, uuid) TO authenticated;
