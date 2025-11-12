# Guide d'utilisation - Feuille de route

## 📋 Qu'est-ce que la Feuille de route ?

La feuille de route est un système de gestion de tâches hebdomadaires qui vous permet de :
- Planifier vos tâches de la semaine (lundi à vendredi)
- Créer des tâches récurrentes qui reviennent chaque semaine
- Suivre l'avancement de vos tâches avec des statuts visuels
- Recevoir des rappels et bilans quotidiens

---

## 🚀 Démarrage rapide

### 1. Configuration initiale (IMPORTANT)

Avant d'utiliser la feuille de route, vous devez configurer la clé de service Supabase :

1. Allez dans votre **Supabase Dashboard** : https://supabase.com/dashboard
2. Sélectionnez votre projet
3. Allez dans **Settings** > **API**
4. Copiez la clé **service_role key** (attention : ne la partagez jamais !)
5. Ouvrez le fichier `.env` à la racine du projet
6. Décommentez et complétez cette ligne :
   ```
   SUPABASE_SERVICE_ROLE_KEY=votre_clé_service_role_ici
   ```
7. Redémarrez votre serveur de développement

### 2. Accéder à la Feuille de route

Dans le menu de navigation (sidebar gauche), cliquez sur **"Feuille de route"** (icône calendrier 📅)

---

## 🎯 Utilisation

### Vue Kanban (par défaut)

La vue Kanban affiche vos tâches organisées par jour de la semaine :

- **5 colonnes** : une pour chaque jour ouvrable (Lundi à Vendredi)
- Le jour actuel est **surligné en bleu**
- Chaque tâche affiche :
  - Son **heure** (si définie)
  - Son **titre**
  - Un **badge "Hebdo"** si c'est une tâche récurrente

#### Statuts des tâches (codes couleur)

- **Blanc** 🟦 : À faire (todo)
- **Bleu clair** 🟦 : Vu (en cours)
- **Vert clair** 🟩 : Fait (terminé)

### Vue Calendrier

Cliquez sur le bouton **"Calendrier"** pour voir une vue mensuelle :
- Affiche le nombre de tâches par jour
- Vue d'ensemble du mois entier

### Navigation

- **⬅️ Précédent** : Aller à la semaine précédente
- **Aujourd'hui** : Revenir à la semaine actuelle
- **Suivant ➡️** : Aller à la semaine suivante

---

## ➕ Créer des tâches

### Tâche ponctuelle

1. Cliquez sur **"Ajouter"** en haut à droite
2. Remplissez les informations :
   - **Titre** : Nom de la tâche
   - **Date** : Jour précis
   - **Heure de début/fin** (optionnel)
3. Enregistrez

### Tâche récurrente (Hebdo)

Les tâches récurrentes reviennent automatiquement chaque semaine au même jour.

**Exemple d'utilisation :**
- "Réunion d'équipe" tous les lundis à 9h
- "Point client" tous les vendredis à 14h
- "Préparation commandes" tous les mardis à 10h

1. Cliquez sur **"Ajouter"**
2. Sélectionnez **"Tâche hebdomadaire"**
3. Choisissez le **jour de la semaine** (1=Lundi, 5=Vendredi)
4. Donnez un titre et une heure
5. Enregistrez

**Note :** Les tâches récurrentes apparaissent automatiquement dans chaque semaine avec le badge "Hebdo"

---

## ✏️ Modifier une tâche

1. Cliquez sur une tâche dans la vue Kanban
2. Modifiez les informations
3. Pour changer le statut :
   - **À faire** → **Vu** → **Fait**
4. Enregistrez

---

## 🔔 Paramètres et Notifications

Allez dans **Paramètres** > **Feuille de route** pour configurer :

### Rappels par défaut

Choisissez quand être rappelé avant un événement :
- ☐ J-1 (1 jour avant)
- ☐ J-2 (2 jours avant)
- ☐ J-3 (3 jours avant)

### Heure du bilan quotidien

Définissez l'heure à laquelle vous recevez un résumé de votre journée (par défaut : 20h)

### Notifications Telegram (optionnel)

Vous pouvez recevoir vos notifications via Telegram :

#### Mode simple (Bot partagé)
1. Allez dans la section **"Bot Telegram partagé"**
2. Cliquez sur **"Connecter Telegram"**
3. Suivez le lien et envoyez `/start` au bot
4. Activez les notifications

#### Mode avancé (Bot personnel)
Si vous voulez votre propre bot Telegram :

1. Créez un bot avec [@BotFather](https://t.me/botfather) sur Telegram :
   - Envoyez `/newbot`
   - Suivez les instructions
   - Copiez le **token** fourni

2. Dans l'application, section **"Mon bot personnel"** :
   - Entrez le **nom d'utilisateur** de votre bot (ex: @monbot)
   - Collez le **token**
   - Cliquez sur **"Configurer le webhook"**

3. Cliquez sur le lien **"Lier mon chat"**
4. Envoyez `/start` à votre bot
5. Revenez dans l'application et cliquez sur **"Utiliser mon bot"**

---

## 📊 Fonctionnalités automatiques

### Rappels automatiques

Le système génère automatiquement des rappels pour :
- Les événements à venir (selon vos préférences J-1, J-2, J-3)
- Les tâches importantes

### Bilan quotidien

Chaque jour à l'heure définie, vous recevez un résumé :
- Tâches accomplies dans la journée
- Tâches restantes
- Aperçu du lendemain

---

## 💡 Conseils d'utilisation

1. **Créez des tâches récurrentes** pour tout ce qui revient chaque semaine
2. **Utilisez les statuts** pour suivre votre progression :
   - Marquez "Vu" quand vous commencez une tâche
   - Marquez "Fait" quand vous terminez
3. **Définissez des heures** pour les tâches importantes
4. **Consultez la vue Calendrier** pour avoir une vision mensuelle
5. **Activez les notifications** pour ne rien oublier

---

## 🐛 Résolution de problèmes

### La page ne charge pas les données

**Problème :** La page affiche "Chargement..." indéfiniment

**Solution :**
1. Vérifiez que `SUPABASE_SERVICE_ROLE_KEY` est bien configurée dans `.env`
2. Redémarrez le serveur : `npm run dev`
3. Vérifiez la console du navigateur (F12) pour les erreurs

### Les fonctions serverless ne fonctionnent pas

**Problème :** Erreur 401 ou 500 lors de l'ajout de tâches

**Solution :**
1. Vérifiez que vous êtes bien connecté
2. Vérifiez les variables d'environnement dans `.env`
3. Sur Netlify, configurez les variables d'environnement dans le dashboard

### Les notifications ne sont pas envoyées

**Problème :** Pas de rappels ou de bilans

**Solution :**
1. Vérifiez que les notifications sont activées dans les paramètres
2. Vérifiez l'heure du bilan quotidien
3. Si vous utilisez Telegram, vérifiez que le bot est bien connecté

---

## 🔧 Architecture technique

Pour les développeurs :

### Tables Supabase
- `user_settings_roadmap` : Paramètres utilisateur
- `roadmap_templates` : Tâches récurrentes (hebdomadaires)
- `roadmap_entries` : Tâches réelles pour des dates spécifiques
- `events` : Événements calendrier
- `event_reminders` : Configuration des rappels
- `roadmap_notifications` : Notifications générées
- `user_telegram_bots` : Configuration des bots Telegram personnels

### Fonctions Netlify
- `roadmap-week.ts` : GET/POST données hebdomadaires
- `roadmap-template.ts` : Gestion des tâches récurrentes
- `roadmap-event.ts` : Gestion des événements
- `roadmap-month.ts` : Vue calendrier mensuel
- `roadmap-notifications.ts` : Récupération et marquage des notifications
- `roadmap-process-notifications.ts` : Génération automatique (cron horaire)

### Fonction planifiée
Une fonction s'exécute **toutes les heures** pour :
- Vérifier les événements à venir
- Générer les rappels nécessaires
- Envoyer les bilans quotidiens à l'heure configurée

---

## 📞 Support

Si vous rencontrez des problèmes :
1. Consultez la section "Résolution de problèmes"
2. Vérifiez les logs dans la console navigateur (F12)
3. Vérifiez les logs Netlify Functions si déployé

---

**Bon usage de votre feuille de route ! 🚀**
