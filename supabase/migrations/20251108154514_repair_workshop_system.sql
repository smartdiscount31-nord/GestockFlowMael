/*
  # Système de Gestion Atelier et Prise en Charge

  ## Description
  Création du système complet de gestion d'atelier avec prise en charge des appareils,
  réservation de pièces (stock tampon), historisation des statuts, rappels automatiques
  et archivage des dossiers.

  ## 1. Nouvelles Tables

  ### repair_tickets
  Dossier de prise en charge d'un appareil client pour réparation
  - `id` (uuid, primary key)
  - `customer_id` (uuid, references customers.id) - Client propriétaire de l'appareil
  - `device_brand` (text) - Marque de l'appareil (ex: Apple, Samsung)
  - `device_model` (text) - Modèle de l'appareil (ex: iPhone 12, Galaxy S21)
  - `device_color` (text) - Couleur de l'appareil
  - `imei` (text, nullable) - Numéro IMEI
  - `serial_number` (text, nullable) - Numéro de série
  - `pin_code` (text, nullable) - Code PIN si fourni par le client
  - `issue_description` (text) - Description du problème/panne
  - `power_state` (text) - État d'alimentation: 'ok', 'lcd_off', 'no_sign'
  - `status` (text) - Statut du dossier: 'quote_todo', 'parts_to_order', 'waiting_parts',
                      'to_repair', 'in_repair', 'drying', 'ready_to_return',
                      'awaiting_customer', 'delivered', 'archived'
  - `assigned_tech` (uuid, references profiles.id) - Technicien assigné
  - `cgv_accepted_at` (timestamptz, nullable) - Date d'acceptation des CGV
  - `signature_url` (text, nullable) - URL de la signature du client
  - `invoice_id` (uuid, references invoices.id) - Facture associée
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

  ### repair_items
  Pièces et composants nécessaires pour une réparation
  - `id` (uuid, primary key)
  - `repair_id` (uuid, references repair_tickets.id) - Dossier de réparation
  - `product_id` (uuid, references products.id) - Pièce/produit utilisé
  - `quantity` (integer) - Quantité nécessaire
  - `purchase_price` (numeric, nullable) - Prix d'achat de la pièce
  - `vat_regime` (text, nullable) - Régime TVA: 'normal', 'margin'
  - `supplier_name` (text, nullable) - Nom du fournisseur
  - `expected_date` (date, nullable) - Date de réception prévue
  - `stock_id` (uuid, references stocks.id) - Stock d'où provient la pièce
  - `reserved` (boolean) - Indique si le stock est réservé
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

  ### repair_media
  Médias associés à un dossier de réparation (photos, vidéos, schémas, signature)
  - `id` (uuid, primary key)
  - `repair_id` (uuid, references repair_tickets.id) - Dossier de réparation
  - `kind` (text) - Type de média: 'photo', 'video', 'diagram', 'signature'
  - `file_url` (text) - URL du fichier dans le storage
  - `created_at` (timestamptz)

  ### repair_status_history
  Historique des changements de statut d'un dossier de réparation
  - `id` (uuid, primary key)
  - `repair_id` (uuid, references repair_tickets.id) - Dossier de réparation
  - `old_status` (text) - Ancien statut
  - `new_status` (text) - Nouveau statut
  - `changed_by` (uuid, nullable) - Utilisateur ayant effectué le changement
  - `changed_at` (timestamptz) - Date du changement
  - `note` (text, nullable) - Note ou commentaire associé

  ### repair_reminders
  Rappels et tâches programmées pour un dossier de réparation
  - `id` (uuid, primary key)
  - `repair_id` (uuid, references repair_tickets.id) - Dossier de réparation
  - `remind_at` (timestamptz) - Date/heure du rappel
  - `message` (text) - Message du rappel
  - `created_by` (uuid, nullable) - Utilisateur créateur du rappel
  - `done` (boolean) - Indique si le rappel a été traité
  - `created_at` (timestamptz)

  ### stock_reservations
  Réservations de stock pour les pièces en cours de réparation (stock tampon)
  - `id` (uuid, primary key)
  - `product_id` (uuid, references products.id) - Produit réservé
  - `stock_id` (uuid, references stocks.id) - Emplacement de stock
  - `qty` (integer) - Quantité réservée
  - `repair_id` (uuid, references repair_tickets.id) - Dossier de réparation
  - `reserved_at` (timestamptz) - Date de réservation
  - `released` (boolean) - Indique si la réservation a été libérée

  ## 2. Vues Métier

  ### repair_dashboard_counts
  Compteurs par statut pour le tableau de bord atelier

  ### repair_parts_to_order
  Liste des pièces à commander (non réservées ou stock insuffisant)

  ## 3. Fonctions Métier

  ### fn_repair_reserve_stock(p_repair_id, p_product_id, p_stock_id, p_qty)
  Réserve une quantité de stock pour une réparation
  - Vérifie la disponibilité du stock
  - Décrémente product_stocks.quantity
  - Crée une entrée dans stock_reservations
  - Marque repair_items.reserved = true
  - Lève une exception si stock insuffisant

  ### fn_repair_release_reservations(p_repair_id)
  Libère toutes les réservations d'un dossier de réparation
  - Marque stock_reservations.released = true
  - Ne remet PAS le stock en quantité (déjà décrémenté à la réservation)

  ### fn_repair_archive_if_invoiced()
  Archive automatiquement un dossier facturé
  - Déclenché après UPDATE de invoice_id sur repair_tickets
  - Vérifie status in ('ready_to_return', 'delivered')
  - Passe le statut à 'archived'
  - Libère les réservations de stock

  ### fn_repair_create_notification_on_reminder()
  Crée une notification dans la table notifications lors de l'ajout d'un rappel

  ## 4. Triggers

  - `fn_repair_set_updated_at` - Met à jour repair_tickets.updated_at
  - `fn_repair_log_status` - Enregistre les changements de statut dans l'historique
  - `fn_repair_auto_reserve_on_item_insert` - Réserve automatiquement le stock lors de l'ajout d'une pièce
  - `fn_repair_archive_if_invoiced` - Archive automatiquement si facturé
  - `fn_repair_create_notification_on_reminder` - Crée une notification lors d'un rappel

  ## 5. Index et Contraintes

  - Index sur repair_tickets(status, customer_id)
  - Index sur repair_items(repair_id)
  - Index sur stock_reservations(repair_id)
  - Index sur repair_status_history(repair_id)
  - Index sur repair_reminders(repair_id, remind_at, done)
  - Contrainte UNIQUE partielle sur repair_items(repair_id, product_id, stock_id)

  ## 6. Sécurité RLS

  - Lecture: tous les utilisateurs authentifiés (staff)
  - Écriture repair_tickets/repair_items: roles 'MAGASIN', 'ADMIN', 'ADMIN_FULL'
  - Archivage: roles 'ADMIN', 'ADMIN_FULL'
  - Gestion rappels: tous les utilisateurs authentifiés
*/

-- ============================================================================
-- 1. CRÉATION DES TABLES
-- ============================================================================

-- Table repair_tickets: Dossiers de prise en charge atelier
CREATE TABLE IF NOT EXISTS public.repair_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE RESTRICT,
  device_brand text NOT NULL,
  device_model text NOT NULL,
  device_color text,
  imei text,
  serial_number text,
  pin_code text,
  issue_description text NOT NULL,
  power_state text NOT NULL CHECK (power_state IN ('ok', 'lcd_off', 'no_sign')),
  status text NOT NULL CHECK (status IN (
    'quote_todo', 'parts_to_order', 'waiting_parts', 'to_repair',
    'in_repair', 'drying', 'ready_to_return', 'awaiting_customer',
    'delivered', 'archived'
  )) DEFAULT 'quote_todo',
  assigned_tech uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  cgv_accepted_at timestamptz,
  signature_url text,
  invoice_id uuid REFERENCES public.invoices(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Table repair_items: Pièces nécessaires pour une réparation
CREATE TABLE IF NOT EXISTS public.repair_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  repair_id uuid NOT NULL REFERENCES public.repair_tickets(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  quantity integer NOT NULL DEFAULT 1 CHECK (quantity > 0),
  purchase_price numeric(12,2),
  vat_regime text CHECK (vat_regime IN ('normal', 'margin')),
  supplier_name text,
  expected_date date,
  stock_id uuid REFERENCES public.stocks(id) ON DELETE SET NULL,
  reserved boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Table repair_media: Photos, vidéos, schémas et signatures
CREATE TABLE IF NOT EXISTS public.repair_media (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  repair_id uuid NOT NULL REFERENCES public.repair_tickets(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('photo', 'video', 'diagram', 'signature')),
  file_url text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Table repair_status_history: Historique des changements de statut
CREATE TABLE IF NOT EXISTS public.repair_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  repair_id uuid NOT NULL REFERENCES public.repair_tickets(id) ON DELETE CASCADE,
  old_status text,
  new_status text NOT NULL,
  changed_by uuid,
  changed_at timestamptz NOT NULL DEFAULT now(),
  note text
);

-- Table repair_reminders: Rappels et tâches programmées
CREATE TABLE IF NOT EXISTS public.repair_reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  repair_id uuid NOT NULL REFERENCES public.repair_tickets(id) ON DELETE CASCADE,
  remind_at timestamptz NOT NULL,
  message text NOT NULL,
  created_by uuid,
  done boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Table stock_reservations: Réservations de stock tampon
CREATE TABLE IF NOT EXISTS public.stock_reservations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  stock_id uuid NOT NULL REFERENCES public.stocks(id) ON DELETE RESTRICT,
  qty integer NOT NULL CHECK (qty > 0),
  repair_id uuid REFERENCES public.repair_tickets(id) ON DELETE CASCADE,
  reserved_at timestamptz NOT NULL DEFAULT now(),
  released boolean NOT NULL DEFAULT false
);

-- ============================================================================
-- 2. CRÉATION DES INDEX
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_repair_tickets_status ON public.repair_tickets(status);
CREATE INDEX IF NOT EXISTS idx_repair_tickets_customer_id ON public.repair_tickets(customer_id);
CREATE INDEX IF NOT EXISTS idx_repair_tickets_assigned_tech ON public.repair_tickets(assigned_tech);
CREATE INDEX IF NOT EXISTS idx_repair_items_repair_id ON public.repair_items(repair_id);
CREATE INDEX IF NOT EXISTS idx_repair_items_product_id ON public.repair_items(product_id);
CREATE INDEX IF NOT EXISTS idx_repair_media_repair_id ON public.repair_media(repair_id);
CREATE INDEX IF NOT EXISTS idx_repair_status_history_repair_id ON public.repair_status_history(repair_id);
CREATE INDEX IF NOT EXISTS idx_repair_reminders_repair_id ON public.repair_reminders(repair_id);
CREATE INDEX IF NOT EXISTS idx_repair_reminders_remind_at ON public.repair_reminders(remind_at) WHERE done = false;
CREATE INDEX IF NOT EXISTS idx_stock_reservations_repair_id ON public.stock_reservations(repair_id);
CREATE INDEX IF NOT EXISTS idx_stock_reservations_product_stock ON public.stock_reservations(product_id, stock_id) WHERE released = false;

-- Contrainte d'unicité partielle: une seule ligne par combinaison (repair_id, product_id, stock_id)
CREATE UNIQUE INDEX IF NOT EXISTS idx_repair_items_unique_combo
ON public.repair_items(repair_id, product_id, stock_id);

-- ============================================================================
-- 3. CRÉATION DES VUES MÉTIER
-- ============================================================================

-- Vue repair_dashboard_counts: Compteurs par statut pour le tableau de bord
CREATE OR REPLACE VIEW public.repair_dashboard_counts AS
SELECT
  status,
  COUNT(*) as count
FROM public.repair_tickets
GROUP BY status;

-- Vue repair_parts_to_order: Pièces à commander
CREATE OR REPLACE VIEW public.repair_parts_to_order AS
SELECT
  ri.id,
  ri.repair_id,
  rt.customer_id,
  c.name as customer_name,
  ri.product_id,
  p.name as product_name,
  p.sku as product_sku,
  ri.quantity,
  ri.supplier_name,
  ri.expected_date,
  ri.reserved,
  COALESCE(ps.quantity, 0) as stock_available,
  rt.status as repair_status
FROM public.repair_items ri
JOIN public.repair_tickets rt ON ri.repair_id = rt.id
JOIN public.customers c ON rt.customer_id = c.id
JOIN public.products p ON ri.product_id = p.id
LEFT JOIN public.product_stocks ps ON ps.product_id = ri.product_id AND ps.stock_id = ri.stock_id
WHERE
  ri.reserved = false
  AND (
    COALESCE(ps.quantity, 0) = 0
    OR rt.status IN ('parts_to_order', 'waiting_parts')
  );

-- ============================================================================
-- 4. CRÉATION DES FONCTIONS MÉTIER
-- ============================================================================

-- Fonction: Réserver du stock pour une réparation
CREATE OR REPLACE FUNCTION public.fn_repair_reserve_stock(
  p_repair_id uuid,
  p_product_id uuid,
  p_stock_id uuid,
  p_qty integer
)
RETURNS void AS $$
DECLARE
  v_current_stock integer;
  v_repair_item_id uuid;
BEGIN
  -- Vérifier la disponibilité du stock
  SELECT quantity INTO v_current_stock
  FROM public.product_stocks
  WHERE product_id = p_product_id AND stock_id = p_stock_id;

  IF v_current_stock IS NULL OR v_current_stock < p_qty THEN
    RAISE EXCEPTION 'Stock insuffisant pour le produit % dans le stock %. Disponible: %, Requis: %',
      p_product_id, p_stock_id, COALESCE(v_current_stock, 0), p_qty;
  END IF;

  -- Décrémenter le stock
  UPDATE public.product_stocks
  SET quantity = quantity - p_qty
  WHERE product_id = p_product_id AND stock_id = p_stock_id;

  -- Créer la réservation
  INSERT INTO public.stock_reservations (product_id, stock_id, qty, repair_id, reserved_at, released)
  VALUES (p_product_id, p_stock_id, p_qty, p_repair_id, now(), false);

  -- Marquer l'item de réparation comme réservé
  UPDATE public.repair_items
  SET reserved = true
  WHERE repair_id = p_repair_id
    AND product_id = p_product_id
    AND stock_id = p_stock_id;

  RAISE NOTICE 'Stock réservé avec succès: % unités du produit % depuis le stock %',
    p_qty, p_product_id, p_stock_id;
END;
$$ LANGUAGE plpgsql;

-- Fonction: Libérer les réservations d'un dossier de réparation
CREATE OR REPLACE FUNCTION public.fn_repair_release_reservations(
  p_repair_id uuid
)
RETURNS void AS $$
BEGIN
  -- Marquer toutes les réservations comme libérées
  UPDATE public.stock_reservations
  SET released = true
  WHERE repair_id = p_repair_id AND released = false;

  RAISE NOTICE 'Réservations libérées pour le dossier de réparation %', p_repair_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 5. CRÉATION DES TRIGGERS
-- ============================================================================

-- Trigger: Mise à jour automatique de updated_at sur repair_tickets
CREATE OR REPLACE FUNCTION public.fn_repair_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_repair_tickets_updated_at
BEFORE UPDATE ON public.repair_tickets
FOR EACH ROW
EXECUTE FUNCTION public.fn_repair_set_updated_at();

-- Trigger: Mise à jour automatique de updated_at sur repair_items
CREATE TRIGGER trigger_repair_items_updated_at
BEFORE UPDATE ON public.repair_items
FOR EACH ROW
EXECUTE FUNCTION public.fn_repair_set_updated_at();

-- Trigger: Historisation automatique des changements de statut
CREATE OR REPLACE FUNCTION public.fn_repair_log_status()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.repair_status_history (
      repair_id,
      old_status,
      new_status,
      changed_by,
      changed_at
    ) VALUES (
      NEW.id,
      OLD.status,
      NEW.status,
      auth.uid(),
      now()
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_repair_log_status
AFTER UPDATE OF status ON public.repair_tickets
FOR EACH ROW
EXECUTE FUNCTION public.fn_repair_log_status();

-- Trigger: Réservation automatique du stock lors de l'ajout d'une pièce
CREATE OR REPLACE FUNCTION public.fn_repair_auto_reserve_on_item_insert()
RETURNS TRIGGER AS $$
BEGIN
  -- Si un stock_id est fourni, tenter de réserver automatiquement
  IF NEW.stock_id IS NOT NULL AND NEW.reserved = false THEN
    BEGIN
      PERFORM public.fn_repair_reserve_stock(
        NEW.repair_id,
        NEW.product_id,
        NEW.stock_id,
        NEW.quantity
      );
    EXCEPTION
      WHEN OTHERS THEN
        RAISE WARNING 'Impossible de réserver automatiquement le stock pour repair_item %: %', NEW.id, SQLERRM;
    END;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_repair_auto_reserve_on_item_insert
AFTER INSERT ON public.repair_items
FOR EACH ROW
EXECUTE FUNCTION public.fn_repair_auto_reserve_on_item_insert();

-- Trigger: Archivage automatique si facturé
CREATE OR REPLACE FUNCTION public.fn_repair_archive_if_invoiced()
RETURNS TRIGGER AS $$
BEGIN
  -- Si invoice_id vient d'être défini et statut approprié
  IF NEW.invoice_id IS NOT NULL AND OLD.invoice_id IS NULL THEN
    IF NEW.status IN ('ready_to_return', 'delivered') THEN
      -- Passer en archived
      UPDATE public.repair_tickets
      SET status = 'archived'
      WHERE id = NEW.id;

      -- Libérer les réservations
      PERFORM public.fn_repair_release_reservations(NEW.id);

      RAISE NOTICE 'Dossier de réparation % archivé et réservations libérées', NEW.id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_repair_archive_if_invoiced
AFTER UPDATE OF invoice_id ON public.repair_tickets
FOR EACH ROW
EXECUTE FUNCTION public.fn_repair_archive_if_invoiced();

-- Trigger: Créer une notification lors de l'ajout d'un rappel
CREATE OR REPLACE FUNCTION public.fn_repair_create_notification_on_reminder()
RETURNS TRIGGER AS $$
DECLARE
  v_customer_name text;
  v_device_model text;
BEGIN
  -- Récupérer les infos du dossier de réparation
  SELECT c.name, rt.device_model
  INTO v_customer_name, v_device_model
  FROM public.repair_tickets rt
  JOIN public.customers c ON rt.customer_id = c.id
  WHERE rt.id = NEW.repair_id;

  -- Créer une notification si la table existe
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'notifications') THEN
    INSERT INTO public.notifications (
      user_id,
      type,
      title,
      message,
      created_at,
      read
    ) VALUES (
      COALESCE(NEW.created_by, auth.uid()),
      'reminder',
      'Rappel Atelier',
      format('Rappel pour %s - %s: %s', v_customer_name, v_device_model, NEW.message),
      now(),
      false
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_repair_create_notification_on_reminder
AFTER INSERT ON public.repair_reminders
FOR EACH ROW
EXECUTE FUNCTION public.fn_repair_create_notification_on_reminder();

-- ============================================================================
-- 6. SÉCURITÉ RLS
-- ============================================================================

-- Activer RLS sur toutes les tables
ALTER TABLE public.repair_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.repair_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.repair_media ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.repair_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.repair_reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_reservations ENABLE ROW LEVEL SECURITY;

-- Politique: Lecture pour tous les utilisateurs authentifiés (staff)
CREATE POLICY "Staff can read all repair tickets"
  ON public.repair_tickets
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Staff can read all repair items"
  ON public.repair_items
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Staff can read all repair media"
  ON public.repair_media
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Staff can read repair status history"
  ON public.repair_status_history
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Staff can read repair reminders"
  ON public.repair_reminders
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Staff can read stock reservations"
  ON public.stock_reservations
  FOR SELECT
  TO authenticated
  USING (true);

-- Politique: Écriture repair_tickets pour MAGASIN, ADMIN, ADMIN_FULL
CREATE POLICY "Magasin and admins can insert repair tickets"
  ON public.repair_tickets
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND role IN ('MAGASIN', 'ADMIN', 'ADMIN_FULL')
    )
  );

CREATE POLICY "Magasin and admins can update repair tickets"
  ON public.repair_tickets
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND role IN ('MAGASIN', 'ADMIN', 'ADMIN_FULL')
    )
  );

-- Politique: Écriture repair_items pour MAGASIN, ADMIN, ADMIN_FULL
CREATE POLICY "Magasin and admins can manage repair items"
  ON public.repair_items
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND role IN ('MAGASIN', 'ADMIN', 'ADMIN_FULL')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND role IN ('MAGASIN', 'ADMIN', 'ADMIN_FULL')
    )
  );

-- Politique: Écriture repair_media pour MAGASIN, ADMIN, ADMIN_FULL
CREATE POLICY "Magasin and admins can manage repair media"
  ON public.repair_media
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND role IN ('MAGASIN', 'ADMIN', 'ADMIN_FULL')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND role IN ('MAGASIN', 'ADMIN', 'ADMIN_FULL')
    )
  );

-- Politique: Écriture repair_reminders pour tous les utilisateurs authentifiés
CREATE POLICY "All authenticated users can manage reminders"
  ON public.repair_reminders
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Politique: Suppression repair_tickets pour ADMIN et ADMIN_FULL uniquement
CREATE POLICY "Only admins can delete repair tickets"
  ON public.repair_tickets
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND role IN ('ADMIN', 'ADMIN_FULL')
    )
  );

-- Politique: Gestion stock_reservations via fonctions uniquement
CREATE POLICY "Stock reservations managed by functions"
  ON public.stock_reservations
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- COMMENTAIRES SUR LES TABLES
-- ============================================================================

COMMENT ON TABLE public.repair_tickets IS 'Dossiers de prise en charge atelier avec suivi complet du cycle de vie de la réparation';
COMMENT ON TABLE public.repair_items IS 'Pièces et composants nécessaires pour chaque réparation avec gestion de stock tampon';
COMMENT ON TABLE public.repair_media IS 'Photos, vidéos, schémas et signatures associés aux dossiers de réparation';
COMMENT ON TABLE public.repair_status_history IS 'Historique complet de tous les changements de statut des dossiers';
COMMENT ON TABLE public.repair_reminders IS 'Rappels et tâches programmées pour le suivi des réparations';
COMMENT ON TABLE public.stock_reservations IS 'Réservations de stock tampon pour les pièces en cours de réparation';

COMMENT ON COLUMN public.repair_tickets.status IS 'Statut du dossier: quote_todo (devis à faire), parts_to_order (pièces à commander), waiting_parts (attente pièces), to_repair (à réparer), in_repair (en réparation), drying (séchage), ready_to_return (prêt à rendre), awaiting_customer (attente client), delivered (livré), archived (archivé)';
COMMENT ON COLUMN public.repair_tickets.power_state IS 'État d''alimentation de l''appareil: ok (s''allume normalement), lcd_off (écran éteint), no_sign (aucun signe de vie)';
COMMENT ON COLUMN public.repair_items.reserved IS 'Indique si le stock a été réservé (décrémenté) pour cette pièce';
COMMENT ON COLUMN public.stock_reservations.released IS 'Indique si la réservation a été libérée (archivage du dossier)';
