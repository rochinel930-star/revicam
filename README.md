# RéviCam — plateforme de révision scolaire (Cameroun)

> « Le seul site où l'élève camerounais lit son cours, compose comme en salle
> d'examen, et reçoit sa note immédiatement — gratuitement. »

Plateforme web de révision pour le secondaire au Cameroun, à commencer par la
**Première D** (préparation au Probatoire D). Trois piliers :

1. **📄 Épreuves** — catalogue filtrable (classe, série, matière, type, année,
   établissement), consultation/téléchargement PDF, et pont « Composer cette
   épreuve » vers le pilier 3.
2. **📘 Cours & Fiches** — cours structurés conformes à l'Approche Par
   Compétences (APC) du MINESEC : objectifs, cours, essentiel imprimable, jeu
   bilingue FR/EN, QCM auto-corrigé, exercices type examen.
3. **✍️ Salle de Composition** — composition en ligne avec chrono officiel,
   sauvegarde automatique anti-coupure, **correction hybride** (QCM par règle +
   réponses libres corrigées par IA), note /20, diagnostic « leçons à réviser »
   et partage WhatsApp.

100 % gratuit, sans inscription obligatoire. Progression stockée en
`localStorage` (identifiant anonyme) ; comptes optionnels prévus pour la V2.

## Stack

Next.js 16 (App Router) · TypeScript strict · Tailwind CSS 4 · Supabase
(PostgreSQL + RLS + Storage) · API Anthropic Claude (`claude-sonnet-4-6`, côté
serveur) · déploiement Vercel.

Contraintes tenues : mobile-first 360 px, police système (zéro webfont), aucune
vidéo/image décorative (schémas en SVG inline), First Load JS < 150 kB par page,
pages de cours en SSG/ISR.

## Installation

### 1. Prérequis

- Node.js 20+ et npm
- Un projet Supabase (les migrations sont dans `supabase/migrations/`)
- Une clé API Anthropic (console.anthropic.com)

### 2. Dépendances

```bash
npm install
```

### 3. Variables d'environnement

Copier `.env.example` en `.env.local` et renseigner :

```bash
cp .env.example .env.local
```

| Variable | Rôle | Exposée au client ? |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | URL du projet Supabase | oui |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | clé anon (RLS active) | oui |
| `SUPABASE_SERVICE_ROLE_KEY` | clé service — correction & import | **NON, secrète** |
| `ANTHROPIC_API_KEY` | correction IA des réponses libres | **NON, secrète** |

⚠️ Sans `ANTHROPIC_API_KEY`, la plateforme fonctionne : les QCM sont notés et les
réponses rédigées passent en statut *correction partielle* (repli gracieux).

### 4. Base de données

Les migrations SQL (`supabase/migrations/0001_init.sql`, `0002_…`) créent le
schéma complet, les politiques RLS, la vue publique `questions_public` (qui
exclut `bonnes_reponses` et `corrige_type_mdx`) et le bucket Storage `epreuves`.
Les appliquer via le tableau de bord Supabase (SQL Editor) ou la CLI Supabase.

### 5. Contenu

Le contenu (leçons, compositions, épreuves) vit dans `/content` et s'importe
sans toucher au code :

```bash
npm run import              # écrit dans Supabase (exige SUPABASE_SERVICE_ROLE_KEY)
npm run import -- --dry-run # valide seulement
npm run import -- --sql seed.sql  # génère le SQL à coller dans le dashboard
```

Voir **[`content/README.md`](content/README.md)** — le contrat des 3 gabarits
(leçon `.mdx`, composition `.json`, épreuves `.csv`).

### 6. Développement

```bash
npm run dev     # http://localhost:3000
npm run build   # build de production
npm run lint    # ESLint
```

## Déploiement (Vercel)

1. Pousser le repo sur GitHub.
2. Importer le repo dans Vercel (framework détecté : Next.js).
3. Renseigner les 4 variables d'environnement ci-dessus dans Vercel
   (Settings → Environment Variables). Les deux clés secrètes ne doivent
   **jamais** porter le préfixe `NEXT_PUBLIC_`.
4. Chaque `git push` redéploie automatiquement.

**Workflow d'ajout de contenu après livraison** : déposer un fichier au format
gabarit dans `/content` → `npm run import` → `git push` → Vercel redéploie → le
contenu est en ligne. Zéro code touché.

## Sécurité — invariants garantis

- La clé `service_role` et la clé Anthropic restent **exclusivement côté serveur**
  (routes `/api/*` et script d'import).
- Les bonnes réponses et corrigés types des compositions ne transitent **jamais**
  vers le client avant remise de la copie : le client ne lit que la vue
  `questions_public`. (Le QCM formatif des leçons, lui, contient volontairement
  ses réponses pour la correction instantanée — c'est un outil d'apprentissage,
  pas une épreuve notée.)
- Chaque tentative n'est accessible qu'à son `anon_id` (ou son compte).

## Structure

```
src/
  app/            routes (accueil, /epreuves, /cours, /composition, /api, …)
  components/     composants React réutilisables (QcmPlayer, SessionClient, …)
  lib/            supabase, queries, markdown, grading (IA), types, local
content/          contenu importable (leçons, compositions, épreuves) + README
scripts/import/   pipeline npm run import (parseurs + writers idempotents)
supabase/migrations/  schéma SQL reproductible
```
