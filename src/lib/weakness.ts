// Détection LOCALE des faiblesses — Phase P8 (algorithme local, 0 IA).
//
// À partir de la progression locale (scores de QCM formatifs), identifie les
// leçons à revoir en priorité. Pur et déterministe : aucun appel réseau, aucun
// coût. Alimente la remédiation (« à revoir ») côté élève.

import type { ProgressLecon } from './local';

export interface Faiblesse {
  leconId: string;
  score: number;
}

/** Seuil de maîtrise (règle Probatoire : 10/20). */
export const SEUIL_MAITRISE = 10;

/**
 * Leçons dont le meilleur score de QCM est sous le seuil, triées de la plus
 * faible à la moins faible (priorité de révision). Les leçons non évaluées
 * (score null) ne sont pas des faiblesses : ce sont des leçons « à faire ».
 */
export function detecterFaiblesses(
  progress: Record<string, ProgressLecon>,
  seuil: number = SEUIL_MAITRISE
): Faiblesse[] {
  return Object.entries(progress)
    .filter(([, p]) => p.meilleur_score_qcm !== null && (p.meilleur_score_qcm as number) < seuil)
    .map(([leconId, p]) => ({ leconId, score: p.meilleur_score_qcm as number }))
    .sort((a, b) => a.score - b.score);
}
