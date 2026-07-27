# ADR 0003 — Modèle de données V2 (Phase P2)

- **Statut** : Accepté
- **Date** : 2026-07-27
- **Phase** : P2 (Engineering Execution Bible) — WS-DATA, goulot officiel
- **Portée** : migrations `0007`→`0014`, `src/lib/types.ts`, suite d'intégration
  base (`tests/db/*`), seed `supabase/seeds/terminale-c.sql`. Aucune nouvelle
  architecture applicative.

## Contexte

Le schéma P0 est mono-programme (Cameroun / Première D). P2 le fait passer au
référentiel configurable **6e→Terminale** et **multi-pays**, avec examens
nationaux (BEPC / Probatoire / Baccalauréat) et versionnage de contenu, sous
contraintes dures : **migrations additives uniquement, rétro- et
forward-compatibilité, secret-by-default, zéro régression, zéro dette
volontaire**.

## Décisions

### 1. Référentiel V2 (nouvelles tables)
`pays`, `programme(config jsonb)`, `niveau`, `serie`, `sequence`,
`content_version`, `staff`. Tout objet de contenu porte un `programme_id`
(propagé par trigger, cf. §4). « Ajouter une classe / série / pays = insérer
des lignes » — jamais dupliquer du schéma (prouvé par `seeds/terminale-c.sql`).

### 2. `chapitre` = vue canonique, `modules` = table physique
Le pipeline d'import écrit dans `modules` via `upsert/onConflict` ; transformer
`modules` en vue casserait l'import. **Décision** : `modules` reste la table
physique (foyer unique), et `chapitre` est exposé comme **vue canonique
additive et auto-modifiable** au-dessus de `modules` (colonnes canoniques +
`programme_id`, `sequence_id`). Foyer physique unique, deux noms → aucune
duplication. Rétro-compatible (l'existant lit `modules`), forward-compatible
(le neuf lit `chapitre`). *(Inverse de la formulation littérale « table
chapitre + vue modules » de la Bible, mais seule variante réellement additive
et zéro-régression ; l'intention — chapitre canonique, modules opérationnel —
est intégralement respectée.)*

### 3. Colonnes de rattachement additives et nullable
`classes(programme_id, niveau_id, serie_id)`, `modules(programme_id,
sequence_id)`, `lecons(chapitre_id, current_version_id)`,
`epreuves(serie_id, programme_id, session)`, `compositions(programme_id,
serie_id)`. Toutes **nullable** → les inserts existants (import) restent
valides. Backfill en `0014`.

### 4. Triggers de défaut (zéro régression de l'import)
`fn_default_programme_from_classe()` (modules/epreuves/compositions) et
`fn_default_chapitre_from_module()` (lecons) remplissent les nouvelles colonnes
à l'insertion. L'import, qui ne connaît pas ces colonnes, continue de
fonctionner **sans modification**.

### 5. Examens : élargissement du CHECK `type`
`epreuves.type` accepte désormais `bepc/probatoire/baccalaureat/cep` en plus des
valeurs P0. Élargir l'ensemble autorisé est **additif au sens des données**
(aucune ligne invalidée, aucun consommateur cassé).

### 6. Versionnage append-only + restauration
`content_version` (hash, chaînage parent, statut, snapshot, provenance) est
**immuable** (trigger interdisant UPDATE/DELETE). `fn_snapshot_lecon()` crée une
version ; `fn_restore_lecon_version()` réapplique un état passé **et** enregistre
une nouvelle version (historique traçable). DoD « restauration de version
testée » : `tests/db/schema.spec.ts`.

### 7. Sécurité (secret-by-default + moindre privilège)
Référentiel = lecture publique (RLS + `select using(true)`, patron identique à
`classes/matieres`). `content_version` = secret (lecture `is_staff()` seulement ;
écriture service_role ; grant anon révoqué). `staff` + `is_staff()`
(SECURITY DEFINER) matérialisent le rôle applicatif. Grants explicites de
moindre privilège en `0013`.

## Validation

Suite d'intégration **PGlite** (`tests/db/`) : applique 0001→0014 dans un vrai
Postgres en mémoire (schémas/rôles Supabase émulés) et prouve additivité, RLS,
vues de compatibilité, triggers, versionnage — reproductible en CI, sans toucher
la base de production.

## Non-objectifs (hors P2)

- Bascule des pages vers la vue `chapitre` et lectures programme/série : reportée
  aux **phases consommatrices** (P7/P10) — l'introduire maintenant créerait du
  code mort et casserait la prod tant que les migrations ne sont pas appliquées
  (cf. `docs/tech-debt.md` TD-005).
- Application des migrations à la base de production : étape d'exploitation
  externe (cf. TD-006).
