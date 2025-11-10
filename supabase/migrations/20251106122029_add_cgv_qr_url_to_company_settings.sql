/*
  # Ajout du champ cgv_qr_url pour le QR code des CGV

  1. Modifications
    - Ajoute le champ `cgv_qr_url` à la table `company_settings`
    - Type: text (URL)
    - Nullable avec valeur par défaut: 'https://smartdiscount31.com/'
    - Permet la configuration dynamique de l'URL des CGV pour la génération du QR code

  2. Notes
    - Ce champ sera utilisé pour générer automatiquement un QR code sur les documents PDF
    - L'URL peut être modifiée via l'interface d'administration
    - Le QR code sera affiché sur la dernière page des documents (factures, devis, avoirs)
*/

-- Ajoute le champ cgv_qr_url si il n'existe pas déjà
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'company_settings' AND column_name = 'cgv_qr_url'
  ) THEN
    ALTER TABLE company_settings 
    ADD COLUMN cgv_qr_url text DEFAULT 'https://smartdiscount31.com/';
    
    COMMENT ON COLUMN company_settings.cgv_qr_url IS 'URL des Conditions Générales de Vente pour la génération du QR code sur les documents PDF';
  END IF;
END $$;