// Générateur Flashcards — Phase P8. Recto (question/terme) / verso (réponse).

import { problemesMdx } from '@/lib/render/validate-mdx';
import type { Flashcard } from '@/lib/types';
import { chaineNonVide, estObjet, estTableau, type Generateur, type ResultatValidationArtefact } from './types';

export const flashcardsGenerateur: Generateur = {
  type: 'flashcards',
  promptVersion: 'flashcards-1',
  palier: 'bon_marche',
  construirePrompt(ctx) {
    return [
      `Professeur de ${ctx.matiere} (${ctx.classe}). À partir du cours, crée 8 flashcards de révision.`,
      `JSON UNIQUEMENT : tableau de { "recto": string, "verso_mdx": string }.`,
      `Recto = question courte ou terme ; verso_mdx = réponse concise (maths en $...$).`,
      `\nCOURS :\n${ctx.texteBrut}`,
    ].join('\n');
  },
  valider(raw): ResultatValidationArtefact {
    const problemes: string[] = [];
    if (!estTableau(raw) || raw.length === 0) return { ok: false, problemes: ['flashcards_vide'] };
    const cartes: Flashcard[] = [];
    raw.forEach((it, i) => {
      if (!estObjet(it)) return problemes.push(`carte_${i}_invalide`);
      if (!chaineNonVide(it.recto)) problemes.push(`carte_${i}_recto`);
      if (!chaineNonVide(it.verso_mdx)) problemes.push(`carte_${i}_verso`);
      else problemesMdx(it.verso_mdx).forEach((p) => problemes.push(`carte_${i}_${p}`));
      if (problemes.length === 0) cartes.push({ recto: it.recto as string, verso_mdx: it.verso_mdx as string });
    });
    if (problemes.length > 0) return { ok: false, problemes };
    return { ok: true, problemes, payload: cartes };
  },
};
