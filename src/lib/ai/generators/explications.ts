// Générateur Explications — Phase P8. Reformulations pédagogiques des points
// clés du cours (« explique autrement »).

import { problemesMdx } from '@/lib/render/validate-mdx';
import type { Explication } from '@/lib/types';
import { chaineNonVide, estObjet, estTableau, type Generateur, type ResultatValidationArtefact } from './types';

export const explicationsGenerateur: Generateur = {
  type: 'explications',
  promptVersion: 'explications-1',
  palier: 'bon_marche',
  construirePrompt(ctx) {
    return [
      `Professeur de ${ctx.matiere} (${ctx.classe}). Explique autrement les 4 points les plus difficiles du cours.`,
      `JSON UNIQUEMENT : tableau de { "titre": string, "corps_mdx": string }.`,
      `Langage simple, analogies concrètes du quotidien camerounais. Maths en $...$.`,
      `\nCOURS :\n${ctx.texteBrut}`,
    ].join('\n');
  },
  valider(raw): ResultatValidationArtefact {
    const problemes: string[] = [];
    if (!estTableau(raw) || raw.length === 0) return { ok: false, problemes: ['exp_vide'] };
    const items: Explication[] = [];
    raw.forEach((it, i) => {
      if (!estObjet(it)) return problemes.push(`exp_${i}_invalide`);
      if (!chaineNonVide(it.titre)) problemes.push(`exp_${i}_titre`);
      if (!chaineNonVide(it.corps_mdx)) problemes.push(`exp_${i}_corps`);
      else problemesMdx(it.corps_mdx).forEach((p) => problemes.push(`exp_${i}_${p}`));
      if (problemes.length === 0) items.push({ titre: it.titre as string, corps_mdx: it.corps_mdx as string });
    });
    if (problemes.length > 0) return { ok: false, problemes };
    return { ok: true, problemes, payload: items };
  },
};
