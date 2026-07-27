# ADR 0004 — Pipeline d'ingestion V2 (Phase P4)

- **Statut** : Accepté
- **Date** : 2026-07-27
- **Phase** : P4 (WS-AI)
- **Portée** : `src/lib/ingestion/*`, `src/lib/ai/adapter.ts`, migration `0017`,
  routes `/api/admin/{ingest,promote}`, page `/admin/revue`.

## Contexte

Remplacer le spike Gemini par un pipeline industriel : entrée de ressources →
JSON canonique validé → revue humaine → promotion. Contraintes : qualité et
coût IA maîtrisés, secret-by-default, l'IA propose mais ne fait jamais foi.

## Décisions

1. **Étapes déterministes d'abord.** Pipeline `intake → ocr → extract →
   validate → normalize → qc → score → enrich`. Le **gate `validate` est 100 %
   déterministe** (KaTeX compile, somme des barèmes, référentiel, QCM cohérents,
   anti-injection via l'assainisseur) et bloque la chaîne. L'IA n'intervient que
   pour l'OCR/extraction (bon marché) et un jugement de grounding optionnel.
2. **Adaptateur LLM injectable** (`ai/adapter.ts`) : le pipeline ne dépend
   d'aucun fournisseur. Par défaut `NOOP` (indisponible) → les étapes
   déterministes tournent sans clé ni réseau. Les fournisseurs réels s'injectent
   au démarrage serveur. Politique de coût : extraction bon marché, jugement
   premium ciblé, dédup par empreinte en amont.
3. **Staging isolé** (`0017`, tables `ingestion_*`) : le pipeline n'écrit
   **jamais** dans le contenu de production. Secret-by-default (RLS staff).
   Idempotent par `content_hash` (ré-ingestion = 0 doublon).
4. **Promotion = décision humaine.** `aRevoir` toujours vrai. `/api/admin/promote`
   exige `approuve:true`, **re-valide** le gate, puis écrit un **brouillon**
   (`publie=false`) — jamais de publication automatique, corrigés jamais fixés
   par l'IA seule.
5. **Garde d'administration** par jeton serveur (`ADMIN_API_TOKEN`) ; absente →
   administration désactivée (503). Revue staff via RLS navigateur.

## Validation

Tests unitaires (validate, orchestrateur, qc, persist idempotent, promote,
garde admin) + intégration PGlite (schéma staging + secret-by-default staff).

## Non-objectifs (hors P4)

Fournisseurs LLM concrets (Gemini/Anthropic) branchés en prod ; embeddings de
similarité (pgvector) ; UI d'administration avancée — phases ultérieures.
