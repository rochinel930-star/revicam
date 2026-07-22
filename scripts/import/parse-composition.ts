// Parseur du gabarit composition .json (voir /content/README.md).
import type { CompositionImport, QuestionImport, ImportError } from './types';

export function parseComposition(raw: string, fichier: string, errors: ImportError[]): CompositionImport | null {
  let data: Record<string, unknown>;
  try {
    data = JSON.parse(raw);
  } catch (e) {
    errors.push({ fichier, message: `JSON invalide : ${(e as Error).message}` });
    return null;
  }
  const missing = ['slug', 'titre', 'classe', 'matiere', 'duree_minutes', 'questions'].filter(
    (k) => data[k] === undefined || data[k] === ''
  );
  if (missing.length > 0) {
    errors.push({ fichier, message: `Champs manquants : ${missing.join(', ')}` });
    return null;
  }
  if (!Array.isArray(data.questions) || data.questions.length === 0) {
    errors.push({ fichier, message: `« questions » doit être un tableau non vide` });
    return null;
  }
  const before = errors.length;
  const questions: QuestionImport[] = [];
  (data.questions as Record<string, unknown>[]).forEach((q, i) => {
    const pos = `question ${i + 1}`;
    if (q.type !== 'qcm' && q.type !== 'libre') {
      errors.push({ fichier, message: `${pos} : « type » doit être "qcm" ou "libre"` });
      return;
    }
    if (!q.enonce) {
      errors.push({ fichier, message: `${pos} : « enonce » manquant` });
      return;
    }
    const bareme = Number(q.bareme);
    if (!(bareme > 0)) {
      errors.push({ fichier, message: `${pos} : « bareme » doit être un nombre > 0` });
      return;
    }
    if (q.type === 'qcm') {
      const options = q.options as unknown;
      const bonnes = q.bonnes_reponses as unknown;
      if (!Array.isArray(options) || options.length < 2) {
        errors.push({ fichier, message: `${pos} : un QCM exige au moins 2 « options »` });
        return;
      }
      if (!Array.isArray(bonnes) || bonnes.length === 0) {
        errors.push({ fichier, message: `${pos} : « bonnes_reponses » (indices, base 0) manquant` });
        return;
      }
      if (bonnes.some((b) => !Number.isInteger(b) || b < 0 || b >= options.length)) {
        errors.push({ fichier, message: `${pos} : indice de « bonnes_reponses » hors limites` });
        return;
      }
    } else if (!q.corrige_type) {
      errors.push({ fichier, message: `${pos} : une question « libre » exige « corrige_type » (corrigé type pour la correction IA)` });
      return;
    }
    questions.push({
      type: q.type as 'qcm' | 'libre',
      enonce: String(q.enonce),
      options: q.type === 'qcm' ? (q.options as string[]).map(String) : undefined,
      bonnes_reponses: q.type === 'qcm' ? (q.bonnes_reponses as number[]) : undefined,
      corrige_type: q.type === 'libre' ? String(q.corrige_type) : undefined,
      bareme,
      lecon: q.lecon ? String(q.lecon) : undefined,
    });
  });
  if (errors.length > before) return null;

  const mode = data.mode_affichage === 'une_par_une' ? 'une_par_une' : 'liste';
  return {
    fichier,
    slug: String(data.slug),
    titre: String(data.titre),
    classe: String(data.classe),
    matiere: String(data.matiere),
    duree_minutes: Number(data.duree_minutes),
    mode_affichage: mode,
    publie: data.publie === true,
    questions,
  };
}
