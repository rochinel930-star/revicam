// Orchestrateur du pipeline d'ingestion V2 — Phase P4.
//
// Enchaîne les étapes ; un échec de GATE (validation) arrête la chaîne. Ne
// publie JAMAIS : le résultat va en revue humaine (aRevoir = true). La
// persistance staging est optionnelle (fournie par l'appelant).

import { intake } from './intake';
import { ocr } from './ocr';
import { extraire } from './extract';
import { valider } from './validate';
import { normaliser } from './normalize';
import { qc } from './qc';
import { scoreFinal } from './score';
import { enrichir, type NotionConnue } from './enrich';
import type { Artefact, Referentiel, ResultatIngestion, Probleme, EtapePipeline } from './types';

export interface OptionsIngestion {
  referentiel: Referentiel;
  notionsConnues?: NotionConnue[];
}

function echec(hash: string, etape: EtapePipeline, problemes: Probleme[]): ResultatIngestion {
  return { hash, ok: false, etapeEchec: etape, problemes, score: 0, suggestions: [], aRevoir: true };
}

/** Exécute le pipeline sur un artefact et renvoie un résultat pour revue. */
export async function ingerer(artefact: Artefact, opts: OptionsIngestion): Promise<ResultatIngestion> {
  const avecHash = intake(artefact);
  const hash = avecHash.hash!;

  let texte: string;
  try {
    texte = await ocr(avecHash);
  } catch (e) {
    return echec(hash, 'ocr', [{ code: 'ocr', message: (e as Error).message }]);
  }

  let brut: unknown;
  try {
    brut = await extraire(texte, artefact.type);
  } catch (e) {
    return echec(hash, 'extract', [{ code: 'extract', message: (e as Error).message }]);
  }

  const validation = valider(brut, opts.referentiel);
  if (!validation.ok || !validation.extraction) {
    return echec(hash, 'validate', validation.problemes);
  }

  const extraction = normaliser(validation.extraction);
  const resultatQc = await qc(extraction, texte);
  const score = scoreFinal(true, resultatQc.score);
  const suggestions = enrichir(extraction, texte, opts.notionsConnues ?? []);

  return {
    hash,
    ok: true,
    problemes: resultatQc.problemes, // avertissements non bloquants (ex. grounding faible)
    score,
    extraction,
    suggestions,
    aRevoir: true, // TOUJOURS : la promotion est une décision humaine.
  };
}

export * from './types';
