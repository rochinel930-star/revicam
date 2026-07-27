// Adaptateur LLM Gemini — 100 % Gemini, routage multi-modèles économique.
//
// Génération/tâches bon marché → CHAINE_ECO ; correction → CHAINE_CORRECTION
// (cf. gemini-models.ts, carte établie par preuves). Repli automatique sur
// quota (429) ou modèle retiré (404) : on passe au modèle suivant de la chaîne.
// La clé GEMINI_API_KEY reste côté serveur/script.

import { GoogleGenAI } from '@google/genai';
import type { LlmAdapter, ReponseGeneration, JugementIA } from '@/lib/ai/adapter';
import type { Artefact } from '@/lib/ingestion/types';
import { CHAINE_ECO } from '@/lib/ai/gemini-models';

let clientMemo: GoogleGenAI | null = null;
function client(): GoogleGenAI {
  if (!clientMemo) clientMemo = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY ?? '' });
  return clientMemo;
}

/** Extrait le premier objet/tableau JSON d'un texte (tolère un habillage). */
export function parseJson(texte: string): unknown {
  const t = texte.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
  try {
    return JSON.parse(t);
  } catch {
    const idxs = [t.indexOf('{'), t.indexOf('[')].filter((i) => i >= 0);
    const debut = idxs.length ? Math.min(...idxs) : -1;
    const fin = Math.max(t.lastIndexOf('}'), t.lastIndexOf(']'));
    if (debut >= 0 && debut < fin) {
      try {
        return JSON.parse(t.slice(debut, fin + 1));
      } catch {
        /* échec */
      }
    }
    return null;
  }
}

const RE_REPLI = /\b429\b|RESOURCE_EXHAUSTED|\b404\b|NOT_FOUND/i;

/**
 * Appelle Gemini en JSON en essayant chaque modèle de la chaîne ; passe au
 * suivant sur quota/retrait, remonte toute autre erreur. Réutilisable
 * (génération ET correction).
 */
export async function appelJsonGemini(
  instruction: string,
  chaine: string[],
  temperature = 0.4
): Promise<ReponseGeneration> {
  let derniere: unknown;
  for (const model of chaine) {
    try {
      const res = await client().models.generateContent({
        model,
        contents: instruction,
        config: { responseMimeType: 'application/json', temperature },
      });
      return {
        contenu: parseJson(res.text ?? ''),
        cout_tokens: res.usageMetadata?.totalTokenCount ?? 0,
        modele: model,
      };
    } catch (e) {
      derniere = e;
      if (RE_REPLI.test(String((e as Error)?.message ?? e))) continue; // modèle suivant
      throw e;
    }
  }
  throw derniere ?? new Error('appelJsonGemini : aucun modèle disponible dans la chaîne');
}

export function creerGeminiAdapter(): LlmAdapter {
  return {
    nom: 'gemini',
    disponible: () => Boolean(process.env.GEMINI_API_KEY),

    async generer(instruction: string): Promise<ReponseGeneration> {
      return appelJsonGemini(instruction, CHAINE_ECO, 0.4);
    },

    async extraire(texte: string, type: string): Promise<unknown> {
      const prompt = `Extrais le contenu suivant (type « ${type} ») en JSON canonique strict, sans commentaire.\n\n${texte}`;
      return (await appelJsonGemini(prompt, CHAINE_ECO, 0.2)).contenu;
    },

    async juger(source: string, extraction: unknown): Promise<JugementIA> {
      const prompt =
        `Évalue l'adéquation (grounding) entre le DOCUMENT SOURCE et l'EXTRACTION. ` +
        `Réponds en JSON strict {"score": nombre entre 0 et 1, "commentaire": string}.\n\n` +
        `DOCUMENT SOURCE:\n${source}\n\nEXTRACTION:\n${JSON.stringify(extraction)}`;
      const rep = await appelJsonGemini(prompt, CHAINE_ECO, 0.2);
      const c = rep.contenu as { score?: unknown; commentaire?: unknown } | null;
      const score = typeof c?.score === 'number' ? Math.max(0, Math.min(1, c.score)) : 0;
      const commentaire = typeof c?.commentaire === 'string' ? c.commentaire : '';
      return { score, commentaire };
    },

    async ocr(_artefact: Artefact): Promise<string> {
      throw new Error('OCR Gemini non encore implémenté (ingestion binaire non activée)');
    },
  };
}
