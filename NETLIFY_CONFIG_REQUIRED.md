# Configuration Netlify Requise - Action Immédiate

## ⚠️ PROBLÈME IDENTIFIÉ

Le module Roadmap (Feuille de route) ne fonctionne pas car une variable d'environnement critique est manquante dans Netlify.

## ✅ SOLUTION - Variables d'environnement à configurer

### Étape 1: Récupérer la clé service_role depuis Supabase

1. Aller dans **Supabase Dashboard**: https://supabase.com/dashboard
2. Sélectionner votre projet: `yyynmkbhzghxqvlcmpqx`
3. Naviguer vers: **Settings** → **API** → **Project API keys**
4. Copier la valeur de `service_role` (commence par `eyJ...`)

### Étape 2: Ajouter la variable dans Netlify

1. Aller dans **Netlify Dashboard**: https://app.netlify.com
2. Sélectionner votre site Gestock Flow
3. Naviguer vers: **Site settings** → **Environment variables** → **Visual editor**
4. Cliquer sur **Add a variable**
5. Remplir:
   - **Key**: `SUPABASE_SERVICE_ROLE_KEY`
   - **Value**: [coller la clé service_role copiée depuis Supabase]
   - **Scopes**: Cocher **Functions and deploy** UNIQUEMENT (PAS Build)
6. Cliquer sur **Save**

### Étape 3: Redéployer le site

1. Dans Netlify, aller dans l'onglet **Deploys**
2. Cliquer sur **Trigger deploy** → **Deploy site**
3. Attendre la fin du déploiement (2-3 minutes)

## 🔍 Vérification après déploiement

### Test 1: Vérifier l'absence d'erreur ui_preferences

1. Ouvrir l'application Gestock Flow
2. Ouvrir DevTools (F12) → Console
3. Recharger la page (Ctrl+Shift+R)
4. Vérifier qu'il n'y a plus d'erreur `relation "public.ui_preferences" does not exist`

### Test 2: Vérifier le module Roadmap

1. Se connecter à l'application
2. Naviguer vers **Paramètres** → **Feuille de route**
3. La page doit se charger correctement (pas de loading infini)
4. Vérifier dans la Console: `[RoadmapSettings] Data loaded: {...}`

### Test 3: Tester une fonction roadmap

Ouvrir DevTools Console et exécuter:

```javascript
// Récupérer le token d'auth
const token = JSON.parse(localStorage.getItem('sb-yyynmkbhzghxqvlcmpqx-auth-token'))?.access_token;

// Tester l'endpoint roadmap-week
fetch('/.netlify/functions/roadmap-week?week_start=2025-11-11', {
  headers: { 'Authorization': `Bearer ${token}` }
})
.then(r => r.json())
.then(d => console.log('✅ Roadmap fonctionne:', d))
.catch(e => console.error('❌ Erreur:', e));
```

**Résultat attendu**: JSON avec `week_start`, `days[]`, `summary`

## 📋 Checklist complète

- [ ] Clé service_role récupérée depuis Supabase Dashboard
- [ ] Variable `SUPABASE_SERVICE_ROLE_KEY` ajoutée dans Netlify
- [ ] Scope configuré sur "Functions and deploy" uniquement
- [ ] Site redéployé via Netlify
- [ ] Application rechargée (Ctrl+Shift+R)
- [ ] Plus d'erreur "ui_preferences" en Console
- [ ] Page Paramètres → Feuille de route se charge correctement
- [ ] Test JavaScript en Console réussit

## ⚠️ Notes de sécurité

- **JAMAIS** préfixer `SUPABASE_SERVICE_ROLE_KEY` avec `VITE_` (exposerait la clé au client)
- Le scope doit être **Functions only**, PAS Build (évite l'inclusion dans le bundle)
- Cette clé donne un accès administrateur complet à la base de données
- Ne jamais la committer dans git ou la partager publiquement

## 🛠️ Dépannage

### Erreur "Missing Supabase environment variables" dans les logs Netlify Functions

**Cause**: La variable `SUPABASE_SERVICE_ROLE_KEY` n'est pas configurée ou mal scopée

**Solution**: Vérifier dans Netlify → Environment variables que:
1. La variable existe
2. Le scope inclut "Functions"
3. Redéployer le site

### Page Roadmap reste en loading infini

**Cause**: Les fonctions Netlify échouent silencieusement

**Solution**:
1. Vérifier les logs: Netlify → Functions → roadmap-week → View logs
2. Chercher des erreurs de type 500
3. Vérifier que `SUPABASE_SERVICE_ROLE_KEY` est bien configurée

### Erreur 401 "Unauthorized" lors des appels API

**Cause**: Token utilisateur expiré ou invalide

**Solution**: Se déconnecter puis se reconnecter à l'application

## 📞 Support

Si les problèmes persistent après avoir suivi ces étapes:

1. Vérifier les logs Netlify Functions: Netlify → Functions → roadmap-* → View logs
2. Vérifier la console DevTools pour des erreurs JavaScript
3. Vérifier que la migration Supabase `ui_preferences` est bien appliquée: Supabase Studio → Database → Migrations

---

**Date de création**: 2025-11-12
**Dernière mise à jour**: 2025-11-12
