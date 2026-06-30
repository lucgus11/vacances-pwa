# 🌴 L'Ardoise des Vacances

PWA familiale collaborative – Planning • Idées • Billets hors ligne • Galerie photos

---

## 🚀 Déploiement en 5 étapes

### 1. Créer le projet Supabase

1. Allez sur [supabase.com](https://supabase.com) → **New Project**
2. Notez votre **Project URL** et **anon/public key** (Settings > API)
3. Dans **SQL Editor**, copiez-collez le contenu de `supabase/schema.sql` et exécutez-le
4. Dans **Storage**, créez deux buckets :
   - `tickets` (accès public : OUI)
   - `photos` (accès public : OUI)

### 2. Configurer les clés

Ouvrez `public/env.js` et remplacez :

```js
window.ENV = {
  SUPABASE_URL: 'https://VOTRE_PROJECT_ID.supabase.co',  // ← votre URL
  SUPABASE_ANON_KEY: 'VOTRE_ANON_KEY_PUBLIQUE',          // ← votre clé anon
};
```

### 3. Définir le mot de passe famille initial

Le mot de passe par défaut dans `schema.sql` est le hash SHA-256 de `vacances2025`.

Pour définir votre propre mot de passe initial :
1. Calculez le SHA-256 de votre mot de passe (ex: sur [sha256.online](https://sha256.online))
2. Dans Supabase SQL Editor :
   ```sql
   UPDATE config SET value = 'VOTRE_HASH_SHA256' WHERE key = 'password_hash';
   ```
3. **Ou** : changez le mot de passe directement depuis l'app (⚙️ Paramètres) après le premier login avec `vacances2025`

### 4. Pousser sur GitHub

```bash
git init
git add .
git commit -m "🌴 L'Ardoise des Vacances – initial commit"
git remote add origin https://github.com/VOTRE_USER/ardoise-vacances.git
git push -u origin main
```

### 5. Déployer sur Vercel

1. [vercel.com](https://vercel.com) → **Add New Project** → importer votre repo GitHub
2. **Framework Preset** : `Other`
3. **Root Directory** : laisser vide (le `vercel.json` à la racine configure tout)
4. Cliquez **Deploy** 🚀

> ⚠️ Ne commitez jamais `public/env.js` avec vos vraies clés.  
> Pour plus de sécurité, utilisez les **Environment Variables** Vercel et générez `env.js` via un build script.

---

## 📱 Installer la PWA sur mobile

1. Ouvrez l'URL Vercel dans **Safari (iPhone)** ou **Chrome (Android)**
2. iOS : bouton Partager → **"Sur l'écran d'accueil"**
3. Android : menu ⋮ → **"Installer l'application"**

---

## 🏗️ Structure du projet

```
ardoise-vacances/
├── public/
│   ├── index.html          # App shell
│   ├── sw.js               # Service Worker (offline + cache billets)
│   ├── manifest.json       # PWA manifest
│   ├── env.js              # Clés Supabase (NE PAS committer !)
│   ├── icons/
│   │   ├── icon-192.png
│   │   └── icon-512.png
│   └── src/
│       ├── css/app.css
│       └── js/
│           ├── app.js              # Orchestrateur principal
│           └── modules/
│               ├── supabase.js     # Client Supabase (REST)
│               ├── auth.js         # Authentification famille
│               ├── planning.js     # L'Ardoise (planning par moments)
│               ├── ideas.js        # Anti-indécision + roulette
│               ├── tickets.js      # Billets & QR codes (offline)
│               ├── photos.js       # Galerie partagée
│               └── ui.js           # Toast, modals, upload progress
├── supabase/
│   └── schema.sql          # Schéma BDD complet
├── vercel.json             # Config déploiement Vercel
└── README.md
```

---

## 🔐 Sécurité & Authentification

- **1 mot de passe global** par vacances, hashé en SHA-256, stocké dans Supabase
- Le hash est mis en cache localement pour la vérification hors ligne
- Changement de mot de passe depuis ⚙️ Paramètres (pour les nouvelles vacances)
- Aucun compte utilisateur requis : juste prénom + mot de passe famille

---

## 📴 Mode Hors Ligne

| Fonctionnalité | Hors ligne |
|---|---|
| Voir le planning | ✅ (cache localStorage) |
| Voir les idées | ✅ (cache localStorage) |
| Afficher les billets/QR | ✅ (cache Service Worker) |
| Voir les photos | ✅ (cache Service Worker) |
| Ajouter/modifier | ❌ (nécessite connexion) |

---

## 🎨 Personnalisation

- **Couleurs** : modifiez les variables dans `tailwind.config` dans `index.html`
- **Icônes** : remplacez `public/icons/icon-192.png` et `icon-512.png` par vos propres icônes
- **Nom** : changez le nom des vacances depuis l'app (⚙️ Paramètres)

---

## 🧑‍💻 Développement local

```bash
# Serveur simple avec Python
python3 -m http.server 3000 --directory public

# Ou avec Node.js
npx serve public
```

Puis ouvrez `http://localhost:3000`

> Les Service Workers nécessitent HTTPS ou localhost pour fonctionner.
