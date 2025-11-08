# Backend Atelier de Réparation - Implémentation Complète

## Vue d'ensemble

Ce document décrit l'implémentation complète du backend pour le module Atelier de Réparation, incluant les fonctions RPC Supabase et les fonctions Netlify.

## Architecture

### Base de données (Supabase)

Le système s'appuie sur les tables suivantes (créées via migration `20251108154514_repair_workshop_system.sql`):

- `repair_tickets` - Dossiers de prise en charge
- `repair_items` - Pièces nécessaires pour chaque réparation
- `repair_media` - Photos, vidéos, signature
- `repair_status_history` - Historique des changements de statut
- `repair_reminders` - Rappels programmés
- `stock_reservations` - Réservations de stock tampon

### Fonctions RPC Supabase

**Migration:** `supabase/migrations/20251108155946_repair_rpc_functions.sql`

#### 1. `fn_repair_counts()`
- **Description:** Retourne les compteurs de tickets par statut pour le tableau kanban
- **Type de retour:** TABLE(status text, count bigint)
- **Utilisation:** Affichage des badges de comptage sur chaque colonne du kanban
- **Appel:** `supabase.rpc('fn_repair_counts')`

#### 2. `fn_repair_reserve_stock(p_repair_id, p_product_id, p_stock_id, p_qty)`
- **Description:** Réserve du stock pour une réparation
- **Type de retour:** jsonb avec détails de la réservation
- **Actions:**
  - Vérifie la disponibilité du stock
  - Décrémente product_stocks.quantity
  - Crée une entrée dans stock_reservations
  - Marque repair_items.reserved = true
- **Retour:** `{ success, reservation_id, qty_reserved, stock_remaining, message }`
- **Erreur:** Exception si stock insuffisant

#### 3. `fn_repair_release_reservations(p_repair_id)`
- **Description:** Libère toutes les réservations d'un dossier
- **Actions:** Marque stock_reservations.released = true
- **Note:** Ne réincrémente PAS le stock (déjà décrémenté lors de la réservation)

---

## Fonctions Netlify

Toutes les fonctions sont dans `/netlify/functions/`

### 1. repairs-create-intake.ts

**Endpoint:** POST `/repairs-create-intake`

**Description:** Crée un nouveau dossier de prise en charge atelier

**Payload:**
```json
{
  "customer_id": "uuid",
  "device_brand": "Apple",
  "device_model": "iPhone 14 Pro",
  "device_color": "Deep Purple",
  "imei": "123456789012345",
  "serial_number": "C5G2X9L3P1",
  "pin_code": "1234",
  "issue_description": "Écran fissuré",
  "power_state": "ok|lcd_off|no_sign",
  "assigned_tech": "uuid",
  "cgv_accepted": true,
  "signature_base64": "base64_string",
  "photos_base64": ["base64_string1", "base64_string2"]
}
```

**Permissions:** MAGASIN, ADMIN, ADMIN_FULL

**Actions:**
- Crée le ticket de réparation
- Upload signature vers app-assets bucket
- Upload photos vers app-assets bucket
- Crée les entrées repair_media

**Retour:**
```json
{
  "ok": true,
  "data": {
    "ticket": {...},
    "signature_url": "https://...",
    "uploaded_photos": ["https://...", "https://..."]
  }
}
```

---

### 2. repairs-attach-part.ts

**Endpoint:** POST `/repairs-attach-part`

**Description:** Attache une pièce à un ticket et réserve le stock

**Payload:**
```json
{
  "repair_id": "uuid",
  "product_id": "uuid",
  "stock_id": "uuid",
  "quantity": 1,
  "purchase_price": 85.50,
  "vat_regime": "normal|margin"
}
```

**Permissions:** MAGASIN, ADMIN, ADMIN_FULL

**Actions:**
- Vérifie l'existence du ticket, produit et stock
- Crée/met à jour repair_items
- Appelle `fn_repair_reserve_stock` pour réserver
- Retourne toutes les réservations du ticket

**Retour:**
```json
{
  "ok": true,
  "data": {
    "repair_item": {...},
    "reservation": {...},
    "all_reservations": [...]
  }
}
```

**Erreurs:**
- 422 INSUFFICIENT_STOCK si stock insuffisant

---

### 3. repairs-mark-to-order.ts

**Endpoint:** POST `/repairs-mark-to-order`

**Description:** Marque des pièces comme à commander (sans stock)

**Payload:**
```json
{
  "repair_id": "uuid",
  "product_id": "uuid",
  "quantity": 1,
  "supplier_name": "iFixit",
  "purchase_price": 85.50,
  "vat_regime": "normal"
}
```

**Permissions:** MAGASIN, ADMIN, ADMIN_FULL

**Actions:**
- Crée/met à jour repair_items avec reserved=false et stock_id=null
- Change le statut du ticket en 'parts_to_order'

**Retour:**
```json
{
  "ok": true,
  "data": {
    "repair_item": {...},
    "items_to_order": [...]
  }
}
```

---

### 4. repairs-order-batch.ts

**Endpoint:** POST `/repairs-order-batch`

**Description:** Traite les commandes groupées de pièces

**Payload:**
```json
{
  "items": [
    {
      "repair_id": "uuid",
      "product_id": "uuid",
      "supplier_name": "iFixit",
      "expected_date": "2024-12-31",
      "purchase_price": 85.50,
      "vat_regime": "normal",
      "quantity": 1
    }
  ]
}
```

**Permissions:** MAGASIN, ADMIN, ADMIN_FULL

**Actions:**
- Met à jour chaque repair_items avec infos fournisseur
- Change le statut des tickets en 'waiting_parts'
- Calcule le coût total

**Retour:**
```json
{
  "ok": true,
  "data": {
    "processed": 10,
    "success": 9,
    "errors": 1,
    "tickets_updated": 5,
    "total_cost_estimate": "1250.75",
    "results": [...]
  }
}
```

---

### 5. repairs-status-update.ts

**Endpoint:** POST `/repairs-status-update`

**Description:** Change le statut d'un ticket avec validations métier

**Payload:**
```json
{
  "repair_id": "uuid",
  "new_status": "ready_to_return",
  "note": "Réparation terminée"
}
```

**Statuts valides:**
- quote_todo
- parts_to_order
- waiting_parts
- to_repair
- in_repair
- drying
- ready_to_return
- awaiting_customer
- delivered
- archived

**Permissions:** MAGASIN, ADMIN, ADMIN_FULL

**Validations métier:**
- `ready_to_return` ou `to_repair`: Toutes les pièces doivent être réservées
- `archived`: Doit avoir une facture ou être en statut 'delivered'

**Actions:**
- Vérifie les conditions
- Met à jour le statut
- Trigger automatique crée l'entrée dans repair_status_history

**Retour:**
```json
{
  "ok": true,
  "data": {
    "ticket": {...},
    "history": [...],
    "message": "Statut changé de 'in_repair' à 'ready_to_return'"
  }
}
```

**Erreurs:**
- 409 NO_PARTS / PARTS_NOT_RESERVED / CANNOT_ARCHIVE

---

### 6. repairs-generate-invoice.ts

**Endpoint:** POST `/repairs-generate-invoice`

**Description:** Génère un draft de facture à partir d'un ticket

**Payload:**
```json
{
  "repair_id": "uuid"
}
```

**Permissions:** MAGASIN, ADMIN, ADMIN_FULL

**Conditions:**
- Ticket en statut 'ready_to_return' ou 'delivered'
- Au moins une pièce attachée

**Actions:**
- Crée une invoice en mode draft
- Crée les invoice_items basés sur repair_items
- Lie repair_tickets.invoice_id
- **Ne modifie PAS les stocks** (déjà décrémentés)

**Retour:**
```json
{
  "ok": true,
  "data": {
    "invoice": {...},
    "invoice_id": "uuid",
    "invoice_url": "/invoices/uuid",
    "message": "Facture draft créée"
  }
}
```

**Erreurs:**
- 409 INVALID_STATUS / NO_ITEMS

---

### 7. repairs-archive.ts

**Endpoint:** POST `/repairs-archive`

**Description:** Archive un ticket terminé et libère les réservations

**Payload:**
```json
{
  "repair_id": "uuid"
}
```

**Permissions:** ADMIN, ADMIN_FULL uniquement

**Conditions:**
- invoice_id défini OU statut 'delivered'

**Actions:**
- Appelle `fn_repair_release_reservations`
- Change le statut en 'archived'

**Retour:**
```json
{
  "ok": true,
  "data": {
    "ticket": {...},
    "reservations_released": 3,
    "history": [...],
    "message": "Ticket archivé, 3 réservations libérées"
  }
}
```

**Erreurs:**
- 409 CANNOT_ARCHIVE

---

### 8. repairs-ticket-pdf.ts

**Endpoint:** POST `/repairs-ticket-pdf`

**Description:** Génère les PDF pour tickets de réparation

**Payload:**
```json
{
  "repair_id": "uuid",
  "format": "both|a4|dymo"
}
```

**Formats:**
- `a4`: Fiche complète A4 avec logo, infos, photos, signature, QR CGV
- `dymo`: Étiquette petit format (62x29mm) pour coller sur l'appareil
- `both`: Les deux formats (défaut)

**Actions:**
- Génère le(s) PDF avec jsPDF
- Upload vers app-assets bucket
- Retourne les URLs publiques

**Retour:**
```json
{
  "ok": true,
  "data": {
    "ticket_id": "uuid",
    "a4_pdf_url": "https://...",
    "dymo_label_url": "https://...",
    "message": "PDF(s) générés"
  }
}
```

---

### 9. repairs-daily-17h-digest.ts (Scheduled)

**Type:** Fonction scheduled (cron)

**Schedule:** Tous les jours à 16:00 UTC (17:00 Paris hiver)

**Configuration:** `netlify.toml`

**Description:** Envoie un digest quotidien des pièces à commander

**Actions:**
- Interroge la vue `repair_parts_to_order`
- Groupe par fournisseur
- Calcule le coût total
- Crée des notifications pour MAGASIN, ADMIN, ADMIN_FULL

**Payload notification:**
```json
{
  "type": "repair_parts_alert",
  "title": "Pièces à commander (5)",
  "message": "5 pièces à commander pour 1250€...",
  "metadata": {
    "date": "2024-11-08",
    "total_parts": 5,
    "total_cost_estimate": "1250.75",
    "suppliers": [...]
  }
}
```

---

## Configuration

### Variables d'environnement

Requises dans Netlify:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (pour scheduled functions)

### Scheduled Functions

Configurées dans `netlify.toml`:
```toml
[functions."repairs-daily-17h-digest"]
  schedule = "0 16 * * *"
```

Pour modifier l'heure, ajoutez la variable `DAILY_ALERT_CRON` (format cron).

---

## Sécurité

### Validation des rôles

Toutes les fonctions vérifient:
1. Token JWT valide
2. Utilisateur authentifié
3. Rôle autorisé (MAGASIN, ADMIN, ADMIN_FULL)

Exception: repairs-archive nécessite ADMIN ou ADMIN_FULL uniquement

### RLS (Row Level Security)

Les politiques RLS sont définies dans la migration initiale du système:
- Lecture: tous les utilisateurs authentifiés
- Écriture tickets/items: MAGASIN, ADMIN, ADMIN_FULL
- Suppression: ADMIN, ADMIN_FULL
- Gestion réservations: via fonctions RPC uniquement

---

## Format des réponses

### Succès
```json
{
  "ok": true,
  "data": {...}
}
```

### Erreur
```json
{
  "ok": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Message en français"
  }
}
```

### Codes HTTP

- 200: Succès
- 400: Requête invalide
- 401: Non authentifié
- 403: Non autorisé
- 404: Ressource introuvable
- 409: Conflit métier (workflow)
- 422: Validation métier échouée (ex: stock insuffisant)
- 500: Erreur serveur

---

## Workflow Atelier

### États du ticket

1. **quote_todo** → Devis à faire
2. **parts_to_order** → Pièces à commander
3. **waiting_parts** → En attente de pièces
4. **to_repair** → À réparer (pièces prêtes)
5. **in_repair** → En réparation
6. **drying** → Séchage (pour réparations liquides)
7. **ready_to_return** → Prêt à rendre
8. **awaiting_customer** → Attente client
9. **delivered** → Livré
10. **archived** → Archivé

### Flux typique

1. Création ticket → `repairs-create-intake`
2. Attacher pièces → `repairs-attach-part` (réserve stock)
3. Si pas de stock → `repairs-mark-to-order`
4. Commander groupé → `repairs-order-batch`
5. Changer statut → `repairs-status-update`
6. Générer facture → `repairs-generate-invoice`
7. Archiver → `repairs-archive`
8. Générer PDF → `repairs-ticket-pdf`

---

## Tests et Validation

Le projet compile sans erreur:
```bash
npm run build
✓ built in 22.03s
```

Toutes les fonctions Netlify sont créées:
- repairs-create-intake.ts
- repairs-attach-part.ts
- repairs-mark-to-order.ts
- repairs-order-batch.ts
- repairs-status-update.ts
- repairs-generate-invoice.ts
- repairs-archive.ts
- repairs-ticket-pdf.ts
- repairs-daily-17h-digest.ts

Migration SQL créée:
- 20251108155946_repair_rpc_functions.sql

---

## Logs et Débogage

Toutes les fonctions incluent des `console.log` détaillés:
- Début/fin de traitement
- Validation des paramètres
- Étapes principales
- Erreurs avec contexte

Les fonctions RPC utilisent `RAISE NOTICE` pour les logs SQL.

---

## Prochaines étapes

1. Tester les fonctions via Postman ou curl
2. Implémenter le front-end React
3. Ajouter des tests unitaires
4. Configurer les alertes de monitoring
5. Documenter les endpoints dans Swagger/OpenAPI

---

## Support

Pour toute question ou problème, vérifiez:
1. Les logs Netlify Functions
2. Les logs Supabase (PostgreSQL)
3. Les politiques RLS
4. Les variables d'environnement

---

**Date de création:** 2025-11-08
**Version:** 1.0
**Auteur:** Backend Implementation Team
