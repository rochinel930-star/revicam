// Correction IA des questions à réponse libre — SERVEUR UNIQUEMENT.
// 100 % Gemini (palier « minimal capable » : CHAINE_CORRECTION), avec repli
// multi-modèles. La clé GEMINI_API_KEY ne quitte jamais le serveur.

import type { FeedbackIA } from './types';
import { appelJsonGemini } from './ai/adapters/gemini';
import { CHAINE_CORRECTION } from './ai/gemini-models';

// Règles de correction (cahier des charges §6).
const REGLES_CORRECTEUR = `Tu es un correcteur officiel d'épreuves du secondaire camerounais (MINESEC, approche APC).
Pour chaque réponse d'élève, tu reçois : l'énoncé, le corrigé type, le barème.
Tu rends UNIQUEMENT un JSON strict :
{
  "note": <nombre, granularité 0.25, entre 0 et le barème>,
  "appreciation": "<1-2 phrases en français simple, bienveillantes mais honnêtes>",
  "points_forts": ["..."],
  "points_a_corriger": ["..."]
}
Règles de notation :
- Note le FOND (justesse scientifique, méthode, résultat) avant la forme.
- Accepte les formulations différentes du corrigé si le sens est juste.
- Un résultat juste sans démarche = moitié des points de la question.
- Une démarche juste avec erreur de calcul finale = 75 % des points.
- Réponse hors sujet ou vide = 0, avec appreciation encourageante indiquant quoi réviser.
- Tolère les fautes d'orthographe : ne retire JAMAIS de points pour l'orthographe en matière scientifique.`;

export interface NoteIA extends FeedbackIA {
  note: number;
}

/** Arrondit à 0,25 près et borne entre 0 et le barème. */
function normaliserNote(note: number, bareme: number): number {
  const arrondie = Math.round(note * 4) / 4;
  return Math.min(Math.max(arrondie, 0), bareme);
}

function versNote(data: unknown, bareme: number): NoteIA | null {
  if (typeof data !== 'object' || data === null) return null;
  const d = data as Record<string, unknown>;
  if (typeof d.note !== 'number' || typeof d.appreciation !== 'string') return null;
  return {
    note: normaliserNote(d.note, bareme),
    appreciation: d.appreciation,
    points_forts: Array.isArray(d.points_forts) ? d.points_forts.map(String) : [],
    points_a_corriger: Array.isArray(d.points_a_corriger) ? d.points_a_corriger.map(String) : [],
  };
}

/**
 * Corrige une réponse libre via Gemini (chaîne CORRECTION). Retourne null si la
 * correction est indisponible (clé absente, erreur, JSON invalide après retry)
 * — l'appelant applique alors le repli gracieux (statut correction_partielle).
 */
export async function corrigerReponseLibre(
  enonce: string,
  corrigeType: string,
  bareme: number,
  reponseEleve: string
): Promise<NoteIA | null> {
  if (!process.env.GEMINI_API_KEY) return null;

  const instruction = `${REGLES_CORRECTEUR}

ÉNONCÉ DE LA QUESTION :
${enonce}

CORRIGÉ TYPE (référence du correcteur) :
${corrigeType}

BARÈME : ${bareme} points

RÉPONSE DE L'ÉLÈVE :
${reponseEleve.trim() || '(réponse vide)'}`;

  // 1 tentative + 1 retry si le JSON est invalide.
  for (let essai = 0; essai < 2; essai++) {
    try {
      const rep = await appelJsonGemini(instruction, CHAINE_CORRECTION, 0.2);
      const note = versNote(rep.contenu, bareme);
      if (note) return note;
    } catch (e) {
      console.error(`Correction IA (essai ${essai + 1}) :`, (e as Error)?.message ?? e);
    }
  }
  return null;
}
