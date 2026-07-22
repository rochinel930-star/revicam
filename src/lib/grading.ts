// Correction IA des questions à réponse libre — SERVEUR UNIQUEMENT.
// La clé Anthropic ne quitte jamais le serveur.

import Anthropic from '@anthropic-ai/sdk';
import type { FeedbackIA } from './types';

// Prompt système de correction — implémenté tel quel (cahier des charges §6).
const SYSTEME_CORRECTEUR = `Tu es un correcteur officiel d'épreuves du secondaire camerounais (MINESEC, approche APC).
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

function parserJson(texte: string, bareme: number): NoteIA | null {
  // Tolérer un éventuel habillage ```json ... ```
  const nettoye = texte.replace(/^\s*```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '');
  const debut = nettoye.indexOf('{');
  const fin = nettoye.lastIndexOf('}');
  if (debut === -1 || fin === -1) return null;
  try {
    const data = JSON.parse(nettoye.slice(debut, fin + 1));
    if (typeof data.note !== 'number' || typeof data.appreciation !== 'string') return null;
    return {
      note: normaliserNote(data.note, bareme),
      appreciation: data.appreciation,
      points_forts: Array.isArray(data.points_forts) ? data.points_forts.map(String) : [],
      points_a_corriger: Array.isArray(data.points_a_corriger) ? data.points_a_corriger.map(String) : [],
    };
  } catch {
    return null;
  }
}

/**
 * Corrige une réponse libre via Claude. Retourne null si la correction est
 * indisponible (clé absente, erreur API, JSON invalide après retry) — l'appelant
 * applique alors le repli gracieux (statut correction_partielle).
 */
export async function corrigerReponseLibre(
  enonce: string,
  corrigeType: string,
  bareme: number,
  reponseEleve: string
): Promise<NoteIA | null> {
  if (!process.env.ANTHROPIC_API_KEY) return null;

  const client = new Anthropic();
  const contenu = `ÉNONCÉ DE LA QUESTION :
${enonce}

CORRIGÉ TYPE (référence du correcteur) :
${corrigeType}

BARÈME : ${bareme} points

RÉPONSE DE L'ÉLÈVE :
${reponseEleve.trim() || '(réponse vide)'}`;

  // 1 tentative + 1 retry si le JSON est invalide (le SDK gère déjà les
  // retries réseau/429/5xx de son côté).
  for (let essai = 0; essai < 2; essai++) {
    try {
      const message = await client.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 1024,
        system: SYSTEME_CORRECTEUR,
        messages: [{ role: 'user', content: contenu }],
      });
      const texte = message.content
        .filter((b) => b.type === 'text')
        .map((b) => b.text)
        .join('');
      const resultat = parserJson(texte, bareme);
      if (resultat) return resultat;
    } catch (e) {
      console.error(`Correction IA (essai ${essai + 1}) :`, e);
    }
  }
  return null;
}
