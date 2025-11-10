/*
  # Ajout du champ SIREN aux paramètres de société

  ## Description
  Cette migration ajoute le champ `siren` à la table `company_settings` pour stocker
  le numéro SIREN de l'entreprise (9 chiffres en France).

  ## Modifications
  1. Ajout de la colonne `siren` (text, nullable) à la table `company_settings`
     - Ce champ stockera le numéro SIREN de l'entreprise
     - Format libre pour permettre différents formats d'affichage (avec ou sans espaces)

  ## Notes
  - Le champ est nullable pour ne pas bloquer les utilisateurs existants
  - Les champs email, phone, siret existent déjà dans la table
  - Aucune modification de sécurité RLS nécessaire (déjà configurée)
*/

-- Ajout du champ siren si il n'existe pas déjà
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'company_settings' AND column_name = 'siren'
  ) THEN
    ALTER TABLE company_settings ADD COLUMN siren text;
    
    RAISE NOTICE 'Colonne siren ajoutée à company_settings';
  ELSE
    RAISE NOTICE 'Colonne siren existe déjà dans company_settings';
  END IF;
END $$;
