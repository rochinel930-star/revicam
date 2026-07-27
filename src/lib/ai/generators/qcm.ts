// Générateur QCM — Phase P8. Formatif : bonnes réponses servies à l'élève
// (correction instantanée côté client, comme le QCM de leçon).

import { problemesMdx } from '@/lib/render/validate-mdx';
import type { QcmItem } from '@/lib/types';
import { chaineNonVide, estObjet, estTableau, type Generateur, type ResultatValidationArtefact } from './types';

export const qcmGenerateur: Generateur = {
  type: 'qcm',
  promptVersion: 'qcm-1',
  palier: 'bon_marche',
  construirePrompt(ctx) {
    return [
      `Tu es un professeur de ${ctx.matiere} (${ctx.classe}, Cameroun, APC).`,
      `À partir du cours ci-dessous, rédige 5 questions QCM formatives.`,
      `Réponds UNIQUEMENT en JSON : un tableau d'objets`,
      `{ "enonce_mdx": string, "options": string[3..4], "bonnes": number[], "explication_mdx": string }.`,
      `Les "bonnes" sont les indices (0-based) des bonnes options.`,
      `Utilise $...$ pour les maths. Reste fidèle au cours.`,
      `\nCOURS :\n${ctx.texteBrut}`,
    ].join('\n');
  },
  valider(raw): ResultatValidationArtefact {
    const problemes: string[] = [];
    if (!estTableau(raw) || raw.length === 0) return { ok: false, problemes: ['qcm_vide'] };
    const items: QcmItem[] = [];
    raw.forEach((it, i) => {
      if (!estObjet(it)) return problemes.push(`item_${i}_invalide`);
      const enonce = it.enonce_mdx;
      const options = it.options;
      const bonnes = it.bonnes;
      if (!chaineNonVide(enonce)) problemes.push(`item_${i}_enonce`);
      else problemesMdx(enonce).forEach((p) => problemes.push(`item_${i}_${p}`));
      if (!estTableau(options) || options.length < 2 || !options.every(chaineNonVide)) {
        problemes.push(`item_${i}_options`);
      }
      const b = estTableau(bonnes) ? (bonnes.filter((x) => typeof x === 'number') as number[]) : [];
      if (b.length === 0) problemes.push(`item_${i}_bonnes`);
      if (estTableau(options) && b.some((x) => x < 0 || x >= options.length)) problemes.push(`item_${i}_borne`);
      const explication = chaineNonVide(it.explication_mdx) ? it.explication_mdx : null;
      if (explication) problemesMdx(explication).forEach((p) => problemes.push(`item_${i}_exp_${p}`));
      if (problemes.length === 0) {
        items.push({
          enonce_mdx: enonce as string,
          options: options as string[],
          bonnes: b,
          explication_mdx: explication,
        });
      }
    });
    if (problemes.length > 0) return { ok: false, problemes };
    return { ok: true, problemes, payload: items };
  },
};
