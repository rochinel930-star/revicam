// Promotion : extraction validée → brouillon de contenu. Phase P4.
//
// Transformation PURE et testable d'une extraction canonique en lignes de
// contenu (composition + questions), TOUJOURS `publie = false`. La promotion
// est déclenchée par un humain ; l'IA n'a jamais fixé les corrigés seule.

import type { ExtractionEpreuve } from './types';

const OPTION_IDS = 'abcdefghijklmnopqrstuvwxyz';

export interface BrouillonComposition {
  composition: {
    slug: string;
    titre: string;
    matiere: string;
    classe: string;
    duree_minutes: number;
    bareme_total: number;
    mode_affichage: 'liste';
    publie: false;
  };
  questions: Array<{
    ordre: number;
    type: 'qcm' | 'libre';
    enonce_mdx: string;
    options: { id: string; texte: string }[] | null;
    bonnes_reponses: string[] | null;
    corrige_type_mdx: string | null;
    bareme: number;
  }>;
}

/** Convertit une extraction en brouillon de composition (publie=false). */
export function extractionVersBrouillon(extraction: ExtractionEpreuve, hash: string): BrouillonComposition {
  const baremeTotal = extraction.questions.reduce((s, q) => s + q.bareme, 0);
  return {
    composition: {
      slug: `ingest-${hash}`,
      titre: extraction.titre,
      matiere: extraction.matiere,
      classe: extraction.classe,
      duree_minutes: 60,
      bareme_total: baremeTotal,
      mode_affichage: 'liste',
      publie: false,
    },
    questions: extraction.questions.map((q, i) => ({
      ordre: i + 1,
      type: q.type,
      enonce_mdx: q.enonce_mdx,
      options: q.options ? q.options.map((texte, j) => ({ id: OPTION_IDS[j], texte })) : null,
      bonnes_reponses: q.bonnes_reponses ? q.bonnes_reponses.map((j) => OPTION_IDS[j]) : null,
      corrige_type_mdx: q.corrige_type_mdx ?? null,
      bareme: q.bareme,
    })),
  };
}
