# RéviCam — Notes de version

## v1.0.0-rc.1 — Release Candidate (2026-07-27)

Première Release Candidate industrielle. Regroupe les phases **P1 → P8 (hors P9)**
au-dessus du socle P0 déjà en production. **100 % additive** : aucun changement
cassant, rétro- et forward-compatible. Détails d'exploitation : `docs/DEPLOYMENT.md`.

> **Portée de livraison.** Cette RC est prête localement (portes vertes). La mise
> en production (push, application des migrations, déploiement) relève d'actions
> humaines listées dans `docs/DEPLOYMENT.md` — non exécutées automatiquement.

### Portes de qualité (RC)
- TypeScript : **0 erreur** (`tsc --noEmit`, strict)
- ESLint : **0 erreur** (1 warning intentionnel documenté, TD-001)
- Render guard : **36/36**
- Tests : **167 passés / 2 skipped** (20 fichiers ; unit + intégration PGlite)
- Build : **vert** (33 routes)

### Nouveautés par phase
- **P1 — Durcissement plateforme.** CI bloquante (typecheck, lint, render:check,
  test, build), feature flags (`feature_flags`), observabilité (`/api/health`,
  log corrélé), en-têtes de sécurité (CSP compatible MathML, XFO, Referrer,
  Permissions).
- **P2 — Données V2.** Référentiel configurable 6e→Terminale + examens
  nationaux : `pays/programme/niveau/serie/sequence`, vue canonique `chapitre`,
  versionnage append-only + restauration, backfill Cameroun/MINESEC.
- **P3 — Graphe de connaissances.** `notion/competence/objectif_apc` + jonctions
  + vue de traversée ; repository `graph.ts`.
- **P4 — Ingestion V2.** Pipeline déterministe-first (intake→…→persist),
  staging isolé secret-by-default, API admin (`/api/admin/ingest|promote`),
  file de revue staff ; adaptateur LLM injectable.
- **P5 — Design System + PWA/offline + i18n.** Manifest, service worker,
  page `/offline`, primitives UI, dictionnaire fr/en.
- **P6 — Auth.** Connexion par lien magique, fusion anonyme→compte non bloquante.
- **P7 — Contexte leçon.** Signature de version + ancrage IA + JSON-LD SEO.
- **P8 — Outils IA par leçon.** 5 générateurs validés déterministiquement,
  cache mutualisé (0 IA au runtime élève), notation premium des réponses
  ouvertes (rubrique secrète), détection locale des faiblesses.

### Durcissement Release Candidate
- Frontières d'erreur (`error.tsx`, `global-error.tsx`), page `404`
  personnalisée (`not-found.tsx`), état de chargement (`loading.tsx`).
- Suppression de code mort (`estMdxSain`, `PALIER_GENERATION`, `router`/`Routage`).
- Couverture ajoutée sur la couche feature flags.
- Inventaires d'exploitation (`docs/DEPLOYMENT.md`) + `.env.example` complété.

### Migrations
Ajoute `0006` → `0018` (13 migrations additives). L'environnement de production
n'exécute pour l'instant que `0001` → `0005` (P0). Voir l'inventaire et l'ordre
d'application dans `docs/DEPLOYMENT.md`.

### Limitations connues (non bloquantes pour la RC)
- Génération IA (P4/P8) codée et testée mais **jamais exécutée** : nécessite
  l'enregistrement d'un adaptateur LLM + clés (voir `docs/tech-debt.md` TD-007/009).
- Auth : nécessite la configuration Supabase Auth (redirect, e-mails).
- i18n : infrastructure prête, couverture partielle (offline + auth).
- Non démarré : P9 (SRS), P11 (composition par objectif), P12 (analytics),
  P13/P15.

Voir aussi : `docs/adr/` (0001→0006) et `docs/tech-debt.md`.
