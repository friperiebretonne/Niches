# Niches

Base de référence des modèles de vêtements : recherche par photo d'annonce Vinted ou par mot-clé,
avec prix neuf, prix de revente en très bon état et prix d'achat maximum (revente ÷ 2,2).

## Fonctionnement

- **Application web** (React + Vite), utilisable sur ordinateur, tablette et téléphone, installable sur l'écran d'accueil.
- **Supabase** : base Postgres (fiches), stockage des photos (bucket privé) et connexion par e-mail / mot de passe.
- **Recherche photo** : chaque photo est convertie en empreinte visuelle (modèle CLIP `Xenova/clip-vit-base-patch32`)
  directement dans le navigateur, puis comparée aux empreintes stockées (pgvector). Aucun coût par recherche.
  Le modèle (~90 Mo) est téléchargé une fois par appareil puis gardé en cache.
- **Recherche texte** : tolérante aux accents et aux fautes de frappe (pg_trgm + unaccent).
- Les photos sont compressées en WebP (~900 px) avant envoi : 3 000 fiches tiennent dans l'offre gratuite Supabase.

## Mise en place

### 1. Supabase

1. Créer un compte sur <https://supabase.com> puis un projet (région Europe, ex. Paris).
2. **SQL Editor > New query** : coller le contenu de [`supabase/schema.sql`](supabase/schema.sql) et cliquer sur **Run**.
3. **Authentication > Users > Add user > Create new user** : saisir votre e-mail et un mot de passe (cocher *Auto Confirm User*).
4. **Authentication > Sign In / Providers** : désactiver *Allow new users to sign up* (personne d'autre ne pourra créer de compte).
5. **Project Settings > API** : noter la *Project URL* et la clé publique *anon* (elle peut être publique, les données sont protégées par la connexion).

### 2. Vercel

1. Créer un compte sur <https://vercel.com> avec GitHub, puis **Add New > Project** et importer ce dépôt.
2. Dans **Environment Variables**, ajouter `VITE_SUPABASE_URL` et `VITE_SUPABASE_ANON_KEY` (valeurs de l'étape 1.5).
3. **Deploy**. L'adresse du site s'affiche à la fin.

### Développement local

```bash
cp .env.example .env.local   # puis renseigner les deux valeurs
npm install
npm run dev
```

## Réglages utiles

- Seuil de ressemblance photo : `min_similarity` dans `search_items_image` (`supabase/schema.sql`, 0,72 par défaut).
- Libellés « Très proche / Proche / Ressemblant » : `similarityLabel` dans `src/lib/format.ts`.
- Diviseur du prix d'achat max : colonne `max_buy_price` (SQL) et `MAX_BUY_DIVISOR` (`src/lib/format.ts`).
