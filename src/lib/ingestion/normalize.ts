// Étape 4 — normalisation canonique. Phase P4.
// Trim, renumérotation séquentielle des questions (ordre 1..n).

import type { ExtractionEpreuve } from './types';

export function normaliser(e: ExtractionEpreuve): ExtractionEpreuve {
  return {
    ...e,
    titre: e.titre.trim(),
    questions: e.questions.map((q, i) => ({
      ...q,
      ordre: i + 1,
      enonce_mdx: q.enonce_mdx.trim(),
      corrige_type_mdx: q.corrige_type_mdx ? q.corrige_type_mdx.trim() : q.corrige_type_mdx ?? null,
    })),
  };
}
