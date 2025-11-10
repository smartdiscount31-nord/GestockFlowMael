# Module Agenda - Documentation Technique

## Vue d'ensemble

Le module Agenda est un système complet de gestion des tâches de la feuille de route et des rendez-vous, avec un système de rappels automatiques et un popup prioritaire pour les événements importants.

## Architecture

### Base de données (Supabase)

Trois tables principales :

1. **`agenda_events`** : Table unifiée pour tous les événements
   - `source` : 'roadmap' ou 'rdv'
   - `status` : 'a_faire', 'en_cours', 'fait', 'vu'
   - `important` : booléen pour déclencher le popup
   - `project` : catégorie optionnelle (App, IA, Formation, etc.)
   - `custom_reminders` : configuration des rappels (par défaut : 24h, 2h, now)
   - `archived` : soft delete pour conformité

2. **`agenda_reminders_queue`** : File d'attente des rappels à envoyer
   - Contrainte UNIQUE(event_id, type, run_at) pour idempotence
   - `delivered` : statut de livraison
   - `attempt` : nombre de tentatives

3. **`agenda_reminders_log`** : Historique des rappels envoyés
   - `user_action` : action prise (vu, reporte, fait, ignore)
   - Traçabilité complète

### Backend (Netlify Functions)

#### Gestion des événements
- **agenda-events-list** : Liste avec filtres (date, source, statut, projet, recherche)
- **agenda-events-create** : Création d'un nouvel événement
- **agenda-events-update** : Mise à jour (recréation des rappels si date modifiée)
- **agenda-events-delete** : Archivage soft delete

#### Système de rappels
- **agenda-reminders-run** (cron */5 min) :
  - Vérifie la queue et envoie les rappels dus
  - Crée des notifications normales ou importantes
  - Planifie une relance +15min pour les rappels importants

- **agenda-daily-summary** (cron 18:00 UTC = 19h Paris hiver) :
  - Génère le récapitulatif quotidien des tâches non terminées
  - Notification groupée avec actions (reporter, marquer fait)

#### Actions utilisateur
- **agenda-reminder-action** : Gère les actions sur rappels importants (vu, reporter 1h, fait)
- **agenda-daily-summary-action** : Actions groupées sur le digest quotidien

### Frontend (React + TypeScript)

#### Pages
- **`/src/pages/Agenda.tsx`** : Page principale avec 3 vues (Jour, Semaine, Mois)
  - Vue Semaine par défaut sur desktop
  - Vue Jour par défaut sur mobile avec swipe
  - Rechargement automatique toutes les 60 secondes

#### Composants
- **AgendaEventCard** : Carte d'affichage d'un événement
  - Pastille de statut colorée
  - Tag source (📌 Roadmap / 📅 RDV)
  - Indicateur importance

- **AgendaFilters** : Système de filtrage
  - Type, statut, projet, recherche textuelle
  - Extraction automatique des projets existants

- **AgendaDrawer** : Modal d'édition
  - Drawer latéral sur desktop, plein écran sur mobile
  - Support ESC pour fermer
  - Validation des champs

- **ImportantReminderPopup** : Popup de rappel prioritaire
  - Focus-trap implémenté
  - Non bloquant mais ESC autorisé
  - 3 actions : Vu, Reporter 1h, Fait
  - Animation de bordure pulsante

## Flux de fonctionnement

### Création d'un événement
1. Utilisateur crée un événement via le formulaire
2. Insertion dans `agenda_events`
3. Trigger PostgreSQL crée automatiquement les rappels dans `agenda_reminders_queue`

### Système de rappels
1. Cron `agenda-reminders-run` s'exécute toutes les 5 minutes (UTC)
2. Charge les rappels où `run_at <= now() AND delivered = false`
3. Pour chaque rappel :
   - Vérifie que l'événement n'est pas "fait"
   - Crée une notification dans la table `notifications`
   - Si `important = true` : ajoute metadata `is_important_reminder`
   - Marque le rappel comme `delivered = true`
   - Log dans `agenda_reminders_log`
   - Si important : planifie relance +15min (type: retry_15m)

### Popup de rappel important
1. Frontend détecte les notifications avec `metadata.is_important_reminder = true`
2. Affiche le popup `ImportantReminderPopup`
3. L'utilisateur prend une action (vu, reporter, fait)
4. Appelle `agenda-reminder-action` qui :
   - Met à jour le statut de l'événement
   - Annule la relance +15min planifiée
   - Marque la notification comme lue
   - Log l'action utilisateur

### Digest quotidien 19h
1. Cron `agenda-daily-summary` s'exécute à 18:00 UTC (19h Paris hiver)
2. Calcule la date du jour en Europe/Paris
3. Pour chaque utilisateur ayant des tâches non terminées :
   - Crée une notification de type `agenda_daily_summary`
   - Liste tous les événements concernés
   - Metadata contient les IDs des événements
4. Actions disponibles dans la notification :
   - Reporter à demain : déplace les événements + recrée les rappels
   - Marquer fait : change le statut + supprime les rappels
   - Ouvrir détails : redirige vers l'agenda

## Raccourcis clavier

- **Espace** : Cycle entre les statuts (à faire → en cours → fait)
- **V** : Bascule "vu" (rendez-vous uniquement)
- **ESC** : Ferme le drawer/popup

## Responsive Design

- **Desktop** : Vue Semaine, drawer latéral
- **Mobile** : Vue Jour, modal plein écran, swipe gauche/droite
- Tous les boutons ≥ 44px pour le tactile
- Breakpoint Tailwind : `md:` (768px)

## Statuts et règles métier

### Roadmap
- Cycle : `a_faire` → `en_cours` → `fait`
- Statut "vu" non disponible
- Rappels stoppés si statut = `fait`

### Rendez-vous (RDV)
- Cycle : `a_faire` → `en_cours` → `fait`
- Statut "vu" disponible (ne stoppe pas les rappels)
- Rappels continuent après "vu", stoppés après "fait"

## Sécurité

- **RLS activé** sur toutes les tables
- Chaque utilisateur voit uniquement ses événements
- Service role utilisé pour les opérations backend
- Tokens JWT vérifiés sur chaque requête
- Soft delete (archivage) pour conformité et traçabilité

## Performance

- Fenêtre de chargement : ±30 jours autour de la date actuelle
- Lazy loading des événements
- Filtres mémorisés dans sessionStorage
- Rechargement automatique toutes les 60s (non bloquant)
- Index PostgreSQL sur dates, statuts, user_id

## Configuration

### Variables d'environnement (.env)
```
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=xxx
SUPABASE_SERVICE_ROLE_KEY=xxx
```

### Crons Netlify (netlify.toml)
```toml
[functions."agenda-reminders-run"]
  schedule = "*/5 * * * *"

[functions."agenda-daily-summary"]
  schedule = "0 18 * * *"  # 19h Paris hiver
```

## Logs et débogage

Tous les composants et fonctions incluent des `console.log` explicites :
- `[Agenda]` : Page principale
- `[AgendaEventCard]` : Cartes d'événements
- `[AgendaDrawer]` : Modal d'édition
- `[ImportantReminderPopup]` : Popup de rappel
- `[agenda-events-list]` : Backend list
- `[agenda-reminders-run]` : Backend rappels
- etc.

## Améliorations futures possibles

1. Configuration des rappels par utilisateur (préférences)
2. Synchronisation avec calendriers externes (Google Calendar, Outlook)
3. Partage d'événements entre utilisateurs
4. Pièces jointes aux événements
5. Récurrence des événements (hebdomadaire, mensuel)
6. Notifications push navigateur
7. Export iCal
8. Vue Timeline graphique

## Support et maintenance

- Les rappels sont idempotents (UNIQUE constraint)
- Les actions groupées sont idempotentes
- Pas de suppression dure : archivage uniquement
- Historique complet des rappels et actions
- Tous les timestamps en UTC, conversion Europe/Paris pour le digest

## Tests recommandés

1. Créer un événement important → vérifier popup après rappel
2. Tester actions : vu, reporter, fait
3. Vérifier relance +15min si aucune action
4. Tester digest 19h avec plusieurs tâches
5. Actions groupées : reporter/marquer fait
6. Vérifier responsive mobile
7. Tester les filtres et la recherche
8. Vérifier soft delete et conformité
9. Tester les raccourcis clavier
10. Vérifier les logs dans toutes les fonctions
