// Étape 3 — validation DÉTERMINISTE (le gate). Phase P4.
//
// Aucune IA ici : la vérité est déterministe (l'IA propose, le déterministe
// valide). Contrôles :
//   - structure canonique (champs requis, questions non vides) ;
//   - référentiel (classe/matière/type connus) ;
//   - barèmes (chaque question > 0, somme > 0) ;
//   - QCM cohérents (options ≥ 2, bonnes réponses dans les bornes) ;
//   - compilation KaTeX de toutes les maths ($…$ / $$…$$, y compris \ce{}) ;
//   - anti-injection : le rendu assaini ne laisse passer aucun script/handler.

import { problemesMdx } from '@/lib/render/validate-mdx';
import type { ExtractionEpreuve, Probleme, QuestionExtraite, Referentiel } from './types';

function estObjet(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}

/** Contrôle MDX déterministe (maths KaTeX + anti-injection) → Probleme[]. */
function verifierMdx(mdx: string, champ: string, problemes: Probleme[]): void {
  for (const p of problemesMdx(mdx)) {
    problemes.push({
      code: p.startsWith('maths') ? 'maths_invalide' : 'injection',
      message: p,
      champ,
    });
  }
}

function validerQuestion(q: unknown, i: number, problemes: Probleme[]): QuestionExtraite | null {
  if (!estObjet(q)) {
    problemes.push({ code: 'question_invalide', message: `Question ${i + 1} n'est pas un objet` });
    return null;
  }
  const champ = `questions[${i}]`;
  const enonce = typeof q.enonce_mdx === 'string' ? q.enonce_mdx : '';
  const bareme = typeof q.bareme === 'number' ? q.bareme : NaN;
  const type = q.type === 'qcm' || q.type === 'libre' ? q.type : null;

  if (!enonce.trim()) problemes.push({ code: 'enonce_vide', message: 'Énoncé vide', champ });
  if (!(bareme > 0)) problemes.push({ code: 'bareme_invalide', message: 'Barème ≤ 0 ou absent', champ });
  if (!type) problemes.push({ code: 'type_invalide', message: 'Type de question invalide', champ });

  if (enonce) {
    verifierMdx(enonce, champ, problemes);
  }

  let options: string[] | undefined;
  let bonnes: number[] | undefined;
  if (type === 'qcm') {
    options = Array.isArray(q.options) ? (q.options as unknown[]).filter((o): o is string => typeof o === 'string') : [];
    bonnes = Array.isArray(q.bonnes_reponses)
      ? (q.bonnes_reponses as unknown[]).filter((b): b is number => typeof b === 'number')
      : [];
    if (options.length < 2) problemes.push({ code: 'qcm_options', message: 'QCM : au moins 2 options requises', champ });
    if (bonnes.length === 0) problemes.push({ code: 'qcm_bonnes', message: 'QCM : aucune bonne réponse', champ });
    if (bonnes.some((b) => b < 0 || b >= options!.length)) {
      problemes.push({ code: 'qcm_borne', message: 'QCM : indice de bonne réponse hors bornes', champ });
    }
  }

  const corrige = typeof q.corrige_type_mdx === 'string' ? q.corrige_type_mdx : null;
  if (corrige) {
    verifierMdx(corrige, `${champ}.corrige`, problemes);
  }

  if (!type) return null;
  return {
    ordre: typeof q.ordre === 'number' ? q.ordre : i + 1,
    type,
    enonce_mdx: enonce,
    bareme: bareme > 0 ? bareme : 0,
    options,
    bonnes_reponses: bonnes,
    corrige_type_mdx: corrige,
  };
}

export interface ResultatValidation {
  ok: boolean;
  problemes: Probleme[];
  extraction?: ExtractionEpreuve;
}

/** Valide un payload d'extraction brut contre le référentiel. */
export function valider(payload: unknown, ref: Referentiel): ResultatValidation {
  const problemes: Probleme[] = [];
  if (!estObjet(payload)) {
    return { ok: false, problemes: [{ code: 'payload', message: 'Extraction non structurée' }] };
  }

  const titre = typeof payload.titre === 'string' ? payload.titre.trim() : '';
  const classe = typeof payload.classe === 'string' ? payload.classe : '';
  const matiere = typeof payload.matiere === 'string' ? payload.matiere : '';
  const type = typeof payload.type === 'string' ? payload.type : '';
  const annee = typeof payload.annee === 'number' ? payload.annee : NaN;

  if (!titre) problemes.push({ code: 'titre', message: 'Titre requis', champ: 'titre' });
  if (!ref.classes.includes(classe)) problemes.push({ code: 'classe', message: `Classe inconnue « ${classe} »`, champ: 'classe' });
  if (!ref.matieres.includes(matiere)) problemes.push({ code: 'matiere', message: `Matière inconnue « ${matiere} »`, champ: 'matiere' });
  if (!ref.types.includes(type)) problemes.push({ code: 'type', message: `Type inconnu « ${type} »`, champ: 'type' });
  if (!(annee >= 1990 && annee <= 2100)) problemes.push({ code: 'annee', message: 'Année invalide', champ: 'annee' });

  const brutes = Array.isArray(payload.questions) ? payload.questions : [];
  if (brutes.length === 0) problemes.push({ code: 'questions_vides', message: 'Aucune question' });

  const questions: QuestionExtraite[] = [];
  brutes.forEach((q, i) => {
    const v = validerQuestion(q, i, problemes);
    if (v) questions.push(v);
  });

  const somme = questions.reduce((s, q) => s + q.bareme, 0);
  if (!(somme > 0)) problemes.push({ code: 'bareme_total', message: 'Somme des barèmes nulle' });

  const ok = problemes.length === 0;
  if (!ok) return { ok, problemes };

  return {
    ok,
    problemes,
    extraction: {
      titre,
      classe,
      matiere,
      type,
      annee,
      serie: typeof payload.serie === 'string' ? payload.serie : null,
      session: typeof payload.session === 'string' ? payload.session : null,
      questions,
      provenance: estObjet(payload.provenance) ? (payload.provenance as Record<string, unknown>) : {},
    },
  };
}
