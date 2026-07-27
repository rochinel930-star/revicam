# ADR 0005 — Outils IA par leçon (Phase P8)

- **Statut** : Accepté
- **Date** : 2026-07-27
- **Phase** : P8 (WS-AI + WS-FE)
- **Portée** : migration `0018`, `src/lib/ai/{generators,generate-artifacts,
  artifacts-repo,artifacts-persist,prepare-artifacts,cost,artifact-signature}`,
  `src/lib/weakness.ts`, composants `Flashcards/VraiFaux/ExplainPanel/
  QuestionsOuvertes`, routes `/api/lecons/[id]/{artifacts,grade}`, script
  `generate-artifacts`. Dépend de P3/P4/P7.

## Décisions

1. **Génération une fois, à l'écriture ; lecture du cache au runtime.** Les
   artefacts (QCM, flashcards, vrai/faux, questions ouvertes, explications) sont
   générés par script, validés déterministiquement, puis stockés. Le runtime
   élève **ne déclenche aucun appel IA** — il lit `lesson_artifact_public`.
2. **Clé de cache / mutualisation** : `signature = hash(type + prompt_version +
   lesson_version)`, où `lesson_version` est la signature de contenu de P7. Un
   changement de contenu ou de prompt régénère ; tous les élèves partagent la
   même génération (un seul appel payant par leçon).
3. **Secret-by-default** : la table `lesson_artifact` est secrète et porte une
   colonne `secret` (rubriques de correction). Les élèves lisent uniquement la
   **vue publique** (payload, leçons publiées) — jamais `secret`. Les corrigés
   des questions ouvertes ne sont jamais servis avant la réponse.
4. **Validation déterministe** : chaque générateur valide sa sortie LLM
   (structure + KaTeX compile + anti-injection via le foyer `validate-mdx`
   partagé avec l'ingestion). Rien de non conforme n'est mis en cache.
5. **render-at-write** : les composants clients ne reçoivent que du HTML
   pré-rendu côté serveur — aucun moteur de rendu embarqué côté client.
6. **Coût IA** : items = palier « bon marché » (batch, caché) ; notation des
   réponses ouvertes = **premium ciblé**, uniquement à la soumission, via
   `grading.ts` et la rubrique secrète. Budget par leçon (`BUDGET_LECON_EUR`).
7. **Faiblesses = local** : `weakness.ts` détecte les leçons à revoir depuis les
   scores de QCM locaux — aucun appel réseau.
8. **Adaptateur injectable** : la génération passe par l'adaptateur LLM (NOOP par
   défaut). Sans clé, la génération est ignorée proprement ; la validation
   déterministe reste opérante.

## Validation

Tests unitaires (5 générateurs, orchestrateur, signature/coût, faiblesses) +
intégration PGlite (vue publique, secret jamais exposé, mutualisation) +
non-régression du gate d'ingestion refactoré sur le foyer `validate-mdx`.

## Non-objectifs (hors P8)

Fournisseurs LLM concrets branchés en production (génération réelle) ;
personnalisation avancée (P12). Le pipeline et le cache sont prêts ; il reste à
enregistrer un adaptateur et à exécuter `npm run generate`.
