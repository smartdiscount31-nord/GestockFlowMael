/*
  # Ajout du régime TVA aux factures
  
  1. Modifications
    - Ajout de la colonne `vat_regime` à la table `invoices`
      - Type: text avec check constraint ('normal', 'margin', 'export')
      - Par défaut: 'normal'
      - Description: Détermine le type de facturation et calcul TVA
    
    - Ajout de la colonne `legal_mention` à la table `invoices`
      - Type: text nullable
      - Description: Mention légale spécifique selon le régime TVA
  
  2. Règles métier
    - 'normal': TVA normale (TTC) avec HT/TVA/TTC séparés
    - 'margin': TVA sur marge (biens d'occasion)
    - 'export': Sans TVA (exonération export/DOM-TOM)
  
  3. Sécurité
    - Les politiques RLS existantes s'appliquent automatiquement
*/

-- Ajouter la colonne vat_regime avec valeur par défaut
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'invoices' AND column_name = 'vat_regime'
  ) THEN
    ALTER TABLE invoices 
    ADD COLUMN vat_regime text DEFAULT 'normal' NOT NULL
    CHECK (vat_regime IN ('normal', 'margin', 'export'));
  END IF;
END $$;

-- Ajouter la colonne legal_mention
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'invoices' AND column_name = 'legal_mention'
  ) THEN
    ALTER TABLE invoices 
    ADD COLUMN legal_mention text;
  END IF;
END $$;

-- Créer un index pour optimiser les recherches par régime TVA
CREATE INDEX IF NOT EXISTS idx_invoices_vat_regime 
ON invoices(vat_regime);

-- Ajouter un commentaire explicatif
COMMENT ON COLUMN invoices.vat_regime IS 
'Régime de TVA de la facture: normal (TVA classique HT+TVA=TTC), margin (TVA sur marge biens occasion), export (sans TVA art 262 ter CGI)';

COMMENT ON COLUMN invoices.legal_mention IS 
'Mention légale spécifique affichée sur la facture selon le régime TVA appliqué';
