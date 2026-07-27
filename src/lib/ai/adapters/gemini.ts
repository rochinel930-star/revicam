// Adaptateur LLM Gemini — palier « bon marché » (génération P8 + extraction P4).
//
// Implémente l'interface LlmAdapter avec @google/genai. Modèle par défaut
// « gemini-2.0-flash » (rapide, économique, sortie JSON native). La clé
// GEMINI_API_KEY reste côté serveur/script (jamais dans le client).
//
// La validation déterministe des générateurs (schéma + KaTeX + anti-injection)
// s'applique en aval : une sortie non conforme est rejetée, jamais mise en cache.

import { GoogleGenAI } from '@google/genai';
import type { LlmAdapter, ReponseGeneration, JugementIA } from '@/lib/ai/adapter';
import type { Artefact } from '@/lib/ingestion/types';

// Modèle par défaut : `gemini-flash-latest` (alias flash courant qui dispose
// de quota free tier ; `gemini-2.0-flash` a un quota free tier à 0 sur les
// nouvelles clés AI Studio, et `gemini-2.5-flash` est retiré pour les nouveaux
// utilisateurs — cf. diagnostic ListModels/generateContent). Surchargable via
// GEMINI_MODEL.
const MODELE = process.env.GEMINI_MODEL ?? 'gemini-flash-latest';

let clientMemo: GoogleGenAI | null = null;
function client(): GoogleGenAI {
  if (!clientMemo) clientMemo = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY ?? '' });
  return clientMemo;
}

/** Extrait le premier objet/tableau JSON d'un texte (tolère un habillage). */
function parseJson(texte: string): unknown {
  const t = texte.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
  try {
    return JSON.parse(t);
  } catch {
    const debut = Math.min(
      ...[t.indexOf('{'), t.indexOf('[')].filter((i) => i >= 0).concat([t.length])
    );
    const fin = Math.max(t.lastIndexOf('}'), t.lastIndexOf(']'));
    if (debut < fin) {
      try {
        return JSON.parse(t.slice(debut, fin + 1));
      } catch {
        /* échec → renvoyer null */
      }
    }
    return null;
  }
}

async function appelJson(instruction: string, tentatives = 3): Promise<ReponseGeneration> {
  for (let i = 0; i < tentatives; i++) {
    try {
      const res = await client().models.generateContent({
        model: MODELE,
        contents: instruction,
        config: { responseMimeType: 'application/json', temperature: 0.4 },
      });
      const texte = res.text ?? '';
      return {
        contenu: parseJson(texte),
        cout_tokens: res.usageMetadata?.totalTokenCount ?? 0,
        modele: MODELE,
      };
    } catch (e) {
      const msg = String((e as Error)?.message ?? e);
      // Limites de débit free tier : on patiente puis on réessaie.
      if (i < tentatives - 1 && /\b429\b|RESOURCE_EXHAUSTED/i.test(msg)) {
        await new Promise((r) => setTimeout(r, 15000));
        continue;
      }
      throw e;
    }
  }
  throw new Error('appelJson: tentatives épuisées');
}

export function creerGeminiAdapter(): LlmAdapter {
  return {
    nom: 'gemini',
    disponible: () => Boolean(process.env.GEMINI_API_KEY),

    async generer(instruction: string): Promise<ReponseGeneration> {
      return appelJson(instruction);
    },

    async extraire(texte: string, type: string): Promise<unknown> {
      const prompt =
        `Extrais le contenu suivant (type « ${type} ») en JSON canonique strict, sans commentaire.\n\n${texte}`;
      return (await appelJson(prompt)).contenu;
    },

    async juger(source: string, extraction: unknown): Promise<JugementIA> {
      const prompt =
        `Évalue l'adéquation (grounding) entre le DOCUMENT SOURCE et l'EXTRACTION. ` +
        `Réponds en JSON strict {"score": nombre entre 0 et 1, "commentaire": string}.\n\n` +
        `DOCUMENT SOURCE:\n${source}\n\nEXTRACTION:\n${JSON.stringify(extraction)}`;
      const rep = await appelJson(prompt);
      const c = rep.contenu as { score?: unknown; commentaire?: unknown } | null;
      const score = typeof c?.score === 'number' ? Math.max(0, Math.min(1, c.score)) : 0;
      const commentaire = typeof c?.commentaire === 'string' ? c.commentaire : '';
      return { score, commentaire };
    },

    // OCR multimodal (images/PDF) : à implémenter si l'ingestion binaire est activée.
    async ocr(_artefact: Artefact): Promise<string> {
      throw new Error("OCR Gemini non encore implémenté (ingestion binaire non activée)");
    },
  };
}
