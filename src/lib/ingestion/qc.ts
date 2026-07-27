// Étape 5 — contrôle qualité / grounding. Phase P4.
//
// Grounding DÉTERMINISTE : mesure le recouvrement lexical entre les énoncés
// extraits et le document source (une extraction hallucinée aurait un faible
// recouvrement). Un juge LLM (premium, ciblé) peut affiner le score s'il est
// disponible — mais ne remplace jamais le signal déterministe.

import { adapterActif } from '@/lib/ai/adapter';
import type { ExtractionEpreuve, Probleme } from './types';

const SEUIL_GROUNDING = 0.3;

function tokens(s: string): string[] {
  return (s.toLowerCase().match(/\p{L}{4,}/gu) ?? []) as string[];
}

export interface ResultatQc {
  score: number;
  problemes: Probleme[];
}

export async function qc(extraction: ExtractionEpreuve, source: string): Promise<ResultatQc> {
  const src = source.toLowerCase();
  let couverts = 0;
  let total = 0;
  for (const q of extraction.questions) {
    const ts = tokens(q.enonce_mdx);
    total += ts.length;
    couverts += ts.filter((t) => src.includes(t)).length;
  }
  let score = total === 0 ? 0 : couverts / total;

  const problemes: Probleme[] = [];
  if (score < SEUIL_GROUNDING) {
    problemes.push({ code: 'grounding_faible', message: 'Ancrage lexical faible au document source' });
  }

  const ad = adapterActif();
  if (ad.disponible() && ad.juger) {
    try {
      const j = await ad.juger(source, extraction);
      score = (score + Math.max(0, Math.min(1, j.score))) / 2;
    } catch {
      /* le juge LLM est optionnel : on garde le score déterministe */
    }
  }
  return { score, problemes };
}
