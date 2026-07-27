# ADR 0006 — Release Candidate 1 (durcissement & préparation au déploiement)

- **Statut** : Accepté
- **Date** : 2026-07-27
- **Phase** : Release engineering (post-P8)
- **Portée** : durcissement UI d'erreur, nettoyage, couverture, documentation
  d'exploitation. Aucune nouvelle fonctionnalité produit.

## Contexte

Les phases P1→P8 sont développées et validées localement. Avant toute mise en
production, le dépôt doit atteindre un état industriel : gracieux en cas
d'erreur, sans code mort, documenté pour l'exploitation, avec des portes de
qualité vertes.

## Décisions

1. **Frontières d'erreur & états** : ajout de `app/error.tsx`,
   `app/global-error.tsx`, `app/not-found.tsx`, `app/loading.tsx` pour remplacer
   les écrans par défaut de Next par une expérience de marque et sûre. Aucun
   impact sur les chemins de succès.
2. **Suppression de code mort** : retrait de `estMdxSain`
   (`render/validate-mdx`), `PALIER_GENERATION` (`ai/cost`) et `router`/`Routage`
   (`ingestion/score`) — exports jamais référencés. Réduit la surface et une
   duplication de mapping de paliers.
3. **Couverture de la couche flags** : ajout de `tests/lib/flags.spec.ts`
   (résolution env > table > défaut). Cela justifie et verrouille le contrat de
   la migration `feature_flags` (0006) et de `getFlagRemote`.
4. **Inventaires d'exploitation** : `docs/DEPLOYMENT.md` (migrations, variables
   d'environnement, secrets, prérequis Supabase/Vercel/GitHub, checklists
   déploiement/rollback/post-déploiement, actions humaines), `RELEASE-NOTES.md`,
   `.env.example` complété (`NEXT_PUBLIC_SITE_URL`, `ADMIN_API_TOKEN`, flags).

## Conséquences

- État industriel : working tree propre, portes vertes, documentation
  d'exploitation complète.
- La mise en production reste un ensemble d'**actions humaines** explicitement
  listées (push, migrations distantes, secrets, déploiement) — non automatisées.

## Non-objectifs

Aucune fonctionnalité produit nouvelle ; aucune action distante (push, merge,
déploiement, migrations sur base distante, secrets).
