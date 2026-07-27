# ADR 0002 — Durcissement de la plateforme (Phase P1)

- **Statut** : Accepté
- **Date** : 2026-07-27
- **Phase** : P1 (Engineering Execution Bible)
- **Portée** : CI, tests, feature flags, observabilité, en-têtes de sécurité,
  registre de dette. Aucun changement d'architecture produit.

## Contexte

P0 est en production (`main = e34b771`) mais la fabrique manque des garde-fous
qui conditionnent toute évolution sûre : pas de portes bloquantes automatisées,
pas de suite de tests exécutable, pas de bascule de comportement sans
redéploiement, pas de trace corrélée, pas d'en-têtes de sécurité HTTP. P1 comble
ce socle sans toucher au périmètre fonctionnel.

## Décisions

1. **CI bloquante** (`.github/workflows/ci.yml`) — enchaîne `typecheck`, `lint`,
   `render:check`, `test` (vitest), `build`, sur push et PR vers `main`. La
   protection de branche doit exiger le job `build` avant merge.
2. **Tests** — introduction de **vitest** (`vitest.config.ts`, alias `@/`).
   Les cas de rendu sont extraits dans un **foyer unique**
   (`src/lib/render/render-cases.ts`) consommé à la fois par `render:check` et
   par la suite vitest — pas de duplication d'assertions. Suites sécurité :
   anti-injection et squelette de matrice RLS (vérifications live opt-in).
3. **Feature flags** (`src/lib/flags.ts` + migration `0006_feature_flags.sql`) —
   défauts au code (foyer unique), surcharge par env puis par base. Résolution
   `env > table > défaut`. Table verrouillée RLS, lecture publique via la vue
   `feature_flags_public` (contrat secret-by-default). Flag pilote
   `health_verbose`.
4. **Observabilité** (`src/lib/log.ts`, `GET /api/health`) — log structuré JSON
   corrélé par `request_id` ; endpoint de santé vérifiant la base (via vue
   publique) et la configuration de l'adaptateur LLM (sans appel réseau).
   Réponse 200/503, en-tête `x-request-id`.
5. **En-têtes de sécurité** (`next.config.ts`) — CSP compatible MathML (sortie
   KaTeX pure, aucune webfont), `frame-ancestors 'none'`, X-Frame-Options,
   Referrer-Policy, Permissions-Policy, X-Content-Type-Options.

## Conséquences

- Toute régression sur le rendu, les types, le lint ou la sécurité de rendu est
  attrapée avant merge.
- Un comportement peut être basculé sans redéploiement (env ou table).
- Dette assumée tracée dans `docs/tech-debt.md` (TD-002 à TD-004).

## Non-objectifs (hors P1)

Auth, données V2, ingestion, middleware CSP à nonce, matrice RLS live en CI :
reportés aux phases dédiées (voir Execution Bible).
