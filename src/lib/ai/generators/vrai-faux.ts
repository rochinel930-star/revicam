// Générateur Vrai/Faux — Phase P8. Affirmation + valeur de vérité + explication.

import { problemesMdx } from '@/lib/render/validate-mdx';
import type { VraiFauxItem } from '@/lib/types';
import { chaineNonVide, estObjet, estTableau, type Generateur, type ResultatValidationArtefact } from './types';

export const vraiFauxGenerateur: Generateur = {
  type: 'vrai_faux',
  promptVersion: 'vrai_faux-1',
  palier: 'bon_marche',
  construirePrompt(ctx) {
    return [
      `Professeur de ${ctx.matiere} (${ctx.classe}). Crée 6 affirmations Vrai/Faux à partir du cours.`,
      `JSON UNIQUEMENT : tableau de { "affirmation_mdx": string, "correct": boolean, "explication_mdx": string }.`,
      `Varie le vrai et le faux. Explique brièvement pourquoi.`,
      `\nCOURS :\n${ctx.texteBrut}`,
    ].join('\n');
  },
  valider(raw): ResultatValidationArtefact {
    const problemes: string[] = [];
    if (!estTableau(raw) || raw.length === 0) return { ok: false, problemes: ['vf_vide'] };
    const items: VraiFauxItem[] = [];
    raw.forEach((it, i) => {
      if (!estObjet(it)) return problemes.push(`vf_${i}_invalide`);
      if (!chaineNonVide(it.affirmation_mdx)) problemes.push(`vf_${i}_affirmation`);
      else problemesMdx(it.affirmation_mdx).forEach((p) => problemes.push(`vf_${i}_${p}`));
      if (typeof it.correct !== 'boolean') problemes.push(`vf_${i}_correct`);
      const explication = chaineNonVide(it.explication_mdx) ? it.explication_mdx : null;
      if (explication) problemesMdx(explication).forEach((p) => problemes.push(`vf_${i}_exp_${p}`));
      if (problemes.length === 0) {
        items.push({ affirmation_mdx: it.affirmation_mdx as string, correct: it.correct as boolean, explication_mdx: explication });
      }
    });
    if (problemes.length > 0) return { ok: false, problemes };
    return { ok: true, problemes, payload: items };
  },
};
