-- 20251103_rpc_process_credit_note.sql
-- RPC process_credit_note: ré-entrée stock + mouvements (IN) pour un avoir publié

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'process_credit_note') THEN
    CREATE OR REPLACE FUNCTION public.process_credit_note(
      p_credit_note_id uuid,
      p_user uuid
    )
    RETURNS jsonb
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path = public
    AS $$
    DECLARE
      v_cn record;
      v_item record;
      v_effective_product uuid;
      v_is_serial boolean;
      v_stock_id uuid;
      v_now timestamptz := now();
      v_in jsonb := '[]'::jsonb;
      v_movement_id uuid;
    BEGIN
      -- Verrouiller l&#39;avoir
      SELECT * INTO v_cn
      FROM public.credit_notes
      WHERE id = p_credit_note_id
      FOR UPDATE;
      IF NOT FOUND THEN
        RAISE EXCEPTION 'Credit note not found: %', p_credit_note_id;
      END IF;

      -- Parcourir les lignes de l&#39;avoir
      FOR v_item IN
        SELECT cni.*
        FROM public.credit_note_items cni
        WHERE cni.credit_note_id = p_credit_note_id
      LOOP
        -- Résoudre produit effectif (miroir -> parent) + sérialisé
        SELECT
          CASE
            WHEN (p.parent_id IS NOT NULL AND p.serial_number IS NULL) THEN p.parent_id
            ELSE p.id
          END AS effective_product_id,
          (p.serial_number IS NOT NULL) AS is_serial
        INTO v_effective_product, v_is_serial
        FROM public.products p
        WHERE p.id = COALESCE(v_item.product_id, (SELECT ii.product_id FROM public.invoice_items ii WHERE ii.id = v_item.invoice_item_id));

        -- Choisir un dépôt (celui ayant déjà des quantités, sinon premier)
        SELECT sp.stock_id
        INTO v_stock_id
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

        -- Incrémenter le stock (1 si sérialisé, sinon qty de la ligne)
        IF v_is_serial THEN
          UPDATE public.stock_produit
             SET quantite = COALESCE(quantite,0) + 1, updated_at = v_now
           WHERE produit_id = v_effective_product AND stock_id = v_stock_id;
          IF NOT FOUND THEN
            INSERT INTO public.stock_produit(produit_id, stock_id, quantite, created_at, updated_at)
            VALUES (v_effective_product, v_stock_id, 1, v_now, v_now);
          END IF;

          INSERT INTO public.stock_movements(product_id, stock_id, qty, operation, ref_type, ref_id, serial_id, created_at, created_by)
          VALUES (v_effective_product, v_stock_id, 1, 'IN', 'credit_note', p_credit_note_id, NULL, v_now, p_user)
          RETURNING id INTO v_movement_id;

          v_in := v_in || jsonb_build_object('movement_id', v_movement_id, 'product_id', v_effective_product, 'stock_id', v_stock_id, 'qty', 1);
        ELSE
          UPDATE public.stock_produit
             SET quantite = COALESCE(quantite,0) + (v_item.qty::int), updated_at = v_now
           WHERE produit_id = v_effective_product AND stock_id = v_stock_id;
          IF NOT FOUND THEN
            INSERT INTO public.stock_produit(produit_id, stock_id, quantite, created_at, updated_at)
            VALUES (v_effective_product, v_stock_id, v_item.qty::int, v_now, v_now);
          END IF;

          INSERT INTO public.stock_movements(product_id, stock_id, qty, operation, ref_type, ref_id, serial_id, created_at, created_by)
          VALUES (v_effective_product, v_stock_id, v_item.qty::int, 'IN', 'credit_note', p_credit_note_id, NULL, v_now, p_user)
          RETURNING id INTO v_movement_id;

          v_in := v_in || jsonb_build_object('movement_id', v_movement_id, 'product_id', v_effective_product, 'stock_id', v_stock_id, 'qty', v_item.qty::int);
        END IF;
      END LOOP;

      RETURN jsonb_build_object('status','ok','credit_note_id',p_credit_note_id,'movements',v_in);
    END;
    $$;
  END IF;
END
$$;

GRANT EXECUTE ON FUNCTION public.process_credit_note(uuid, uuid) TO authenticated;
