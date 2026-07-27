// Générateur Questions ouvertes — Phase P8.
// La QUESTION est publique ; la RUBRIQUE de correction (corrigé type) est
// SECRÈTE (server-only) et sert à la notation premium après réponse.

import { problemesMdx } from '@/lib/render/validate-mdx';
import type { QuestionOuverte, RubriqueOuverte } from '@/lib/types';
import { estObjet, estTableau, chaineNonVide, type Generateur, type ResultatValidationArtefact } from './types';

export const questionsOuvertesGenerateur: Generateur = {
  type: 'questions_ouvertes',
  promptVersion: 'questions_ouvertes-1',
  palier: 'bon_marche',
  construirePrompt(ctx) {
    return [
      `Professeur de ${ctx.matiere} (${ctx.classe}, APC). Crée 3 questions ouvertes type examen à partir du cours.`,
      `JSON UNIQUEMENT : tableau de { "question_mdx": string, "corrige_type_mdx": string, "bareme": number }.`,
      `Le corrigé type servira de référence de correction (il ne sera pas montré à l'élève avant sa réponse).`,
      `\nCOURS :\n${ctx.texteBrut}`,
    ].join('\n');
  },
  valider(raw): ResultatValidationArtefact {
    const problemes: string[] = [];
    if (!estTableau(raw) || raw.length === 0) return { ok: false, problemes: ['qo_vide'] };
    const publiques: QuestionOuverte[] = [];
    const secrets: RubriqueOuverte[] = [];
    raw.forEach((it, i) => {
      if (!estObjet(it)) return problemes.push(`qo_${i}_invalide`);
      const question = it.question_mdx;
      const corrige = it.corrige_type_mdx;
      const bareme = typeof it.bareme === 'number' ? it.bareme : NaN;
      if (!chaineNonVide(question)) problemes.push(`qo_${i}_question`);
      else problemesMdx(question).forEach((p) => problemes.push(`qo_${i}_${p}`));
      if (!chaineNonVide(corrige)) problemes.push(`qo_${i}_corrige`);
      else problemesMdx(corrige).forEach((p) => problemes.push(`qo_${i}_corr_${p}`));
      if (!(bareme > 0)) problemes.push(`qo_${i}_bareme`);
      if (problemes.length === 0) {
        publiques.push({ question_mdx: question as string, bareme });
        secrets.push({ corrige_type_mdx: corrige as string, bareme });
      }
    });
    if (problemes.length > 0) return { ok: false, problemes };
    return { ok: true, problemes, payload: publiques, secret: secrets };
  },
};
