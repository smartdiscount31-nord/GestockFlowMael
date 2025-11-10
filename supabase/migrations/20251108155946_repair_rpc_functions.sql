/*
  # Fonctions RPC pour le Module Atelier de Réparation

  ## Description
  Ajout des fonctions RPC nécessaires pour le backend du module atelier:
  - fn_repair_counts() : Compteurs par statut pour tableau kanban
  - Modification de fn_repair_reserve_stock() pour retourner jsonb au lieu de void

  ## 1. Fonction fn_repair_counts
  Retourne les compteurs de tickets par statut pour affichage dans le tableau kanban.
  Utilisé par le front-end pour afficher les badges de comptage sur chaque colonne.

  ## 2. Modification de fn_repair_reserve_stock
  Change le type de retour de void à jsonb pour retourner les détails du mouvement:
  - Quantité réservée
  - Stock restant
  - Identifiant de la réservation créée
  - Timestamp de la réservation

  ## Notes importantes
  - fn_repair_counts() utilise la vue repair_dashboard_counts déjà existante
  - fn_repair_reserve_stock() conserve toute sa logique métier
  - Sécurité: ces fonctions sont accessibles via RLS selon les politiques définies
*/

-- ============================================================================
-- 1. FONCTION: fn_repair_counts
-- ============================================================================

-- Fonction: Retourner les compteurs par statut pour le tableau kanban
CREATE OR REPLACE FUNCTION public.fn_repair_counts()
RETURNS TABLE(
  status text,
  count bigint
) AS $$
BEGIN
  -- Utilise la vue déjà créée repair_dashboard_counts
  RETURN QUERY
  SELECT
    rdc.status,
    rdc.count
  FROM public.repair_dashboard_counts rdc
  ORDER BY
    CASE rdc.status
      WHEN 'quote_todo' THEN 1
      WHEN 'parts_to_order' THEN 2
      WHEN 'waiting_parts' THEN 3
      WHEN 'to_repair' THEN 4
      WHEN 'in_repair' THEN 5
      WHEN 'drying' THEN 6
      WHEN 'ready_to_return' THEN 7
      WHEN 'awaiting_customer' THEN 8
      WHEN 'delivered' THEN 9
      WHEN 'archived' THEN 10
      ELSE 99
    END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Commentaire sur la fonction
COMMENT ON FUNCTION public.fn_repair_counts() IS
'Retourne les compteurs de tickets de réparation par statut pour affichage dans le tableau kanban. Utilise la vue repair_dashboard_counts et ordonne les résultats selon le workflow logique.';

-- ============================================================================
-- 2. MODIFICATION: fn_repair_reserve_stock
-- ============================================================================

-- Drop de l'ancienne fonction qui retourne void
DROP FUNCTION IF EXISTS public.fn_repair_reserve_stock(uuid, uuid, uuid, integer);

-- Recréation avec type de retour jsonb
CREATE OR REPLACE FUNCTION public.fn_repair_reserve_stock(
  p_repair_id uuid,
  p_product_id uuid,
  p_stock_id uuid,
  p_qty integer
)
RETURNS jsonb AS $$
DECLARE
  v_current_stock integer;
  v_repair_item_id uuid;
  v_reservation_id uuid;
  v_result jsonb;
BEGIN
  RAISE NOTICE '[fn_repair_reserve_stock] Début réservation - repair_id: %, product_id: %, stock_id: %, qty: %', p_repair_id, p_product_id, p_stock_id, p_qty;

  -- Vérifier la disponibilité du stock
  SELECT quantity INTO v_current_stock
  FROM public.product_stocks
  WHERE product_id = p_product_id AND stock_id = p_stock_id;

  RAISE NOTICE '[fn_repair_reserve_stock] Stock actuel: %', COALESCE(v_current_stock, 0);

  IF v_current_stock IS NULL OR v_current_stock < p_qty THEN
    RAISE NOTICE '[fn_repair_reserve_stock] ERREUR: Stock insuffisant';
    RAISE EXCEPTION 'Stock insuffisant pour le produit % dans le stock %. Disponible: %, Requis: %',
      p_product_id, p_stock_id, COALESCE(v_current_stock, 0), p_qty;
  END IF;

  -- Décrémenter le stock
  UPDATE public.product_stocks
  SET quantity = quantity - p_qty
  WHERE product_id = p_product_id AND stock_id = p_stock_id;

  RAISE NOTICE '[fn_repair_reserve_stock] Stock décrémenté de % unités', p_qty;

  -- Créer la réservation et récupérer l'ID
  INSERT INTO public.stock_reservations (product_id, stock_id, qty, repair_id, reserved_at, released)
  VALUES (p_product_id, p_stock_id, p_qty, p_repair_id, now(), false)
  RETURNING id INTO v_reservation_id;

  RAISE NOTICE '[fn_repair_reserve_stock] Réservation créée avec ID: %', v_reservation_id;

  -- Marquer l'item de réparation comme réservé
  UPDATE public.repair_items
  SET reserved = true, updated_at = now()
  WHERE repair_id = p_repair_id
    AND product_id = p_product_id
    AND stock_id = p_stock_id;

  RAISE NOTICE '[fn_repair_reserve_stock] Item de réparation marqué comme réservé';

  -- Construire le résultat JSON
  v_result := jsonb_build_object(
    'success', true,
    'reservation_id', v_reservation_id,
    'product_id', p_product_id,
    'stock_id', p_stock_id,
    'qty_reserved', p_qty,
    'stock_remaining', v_current_stock - p_qty,
    'reserved_at', now(),
    'message', format('Stock réservé avec succès: %s unités du produit %s depuis le stock %s', p_qty, p_product_id, p_stock_id)
  );

  RAISE NOTICE '[fn_repair_reserve_stock] Réservation réussie: %', v_result;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Commentaire sur la fonction modifiée
COMMENT ON FUNCTION public.fn_repair_reserve_stock(uuid, uuid, uuid, integer) IS
'Réserve une quantité de stock pour une réparation. Décrémente le stock, crée une entrée dans stock_reservations, et marque repair_items.reserved=true. Retourne un objet JSON avec les détails de la réservation incluant l''ID, la quantité réservée, et le stock restant.';

-- ============================================================================
-- 3. PERMISSIONS
-- ============================================================================

-- Grant EXECUTE sur les fonctions pour les utilisateurs authentifiés
GRANT EXECUTE ON FUNCTION public.fn_repair_counts() TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_repair_reserve_stock(uuid, uuid, uuid, integer) TO authenticated;

-- ============================================================================
-- COMMENTAIRES FINAUX
-- ============================================================================

COMMENT ON FUNCTION public.fn_repair_counts() IS
'RPC: Retourne les compteurs de tickets par statut pour le tableau kanban atelier. Accessible via supabase.rpc(''fn_repair_counts'')';

COMMENT ON FUNCTION public.fn_repair_reserve_stock(uuid, uuid, uuid, integer) IS
'RPC: Réserve du stock pour une réparation et retourne les détails au format JSON. Accessible via supabase.rpc(''fn_repair_reserve_stock'', {p_repair_id, p_product_id, p_stock_id, p_qty})';
