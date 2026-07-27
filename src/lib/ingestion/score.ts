// Étape 6 — scoring & routage. Phase P4.
// Un contenu invalide score 0. Sinon, le score de grounding pilote le
// routage indicatif (jamais une promotion automatique : cf. index/persist).

export type Routage = 'rejet' | 'revue' | 'revue_prioritaire';

export function scoreFinal(validationOk: boolean, groundingScore: number): number {
  if (!validationOk) return 0;
  return Math.max(0, Math.min(1, groundingScore));
}

/** Route indicative pour la file de revue humaine. */
export function router(score: number): Routage {
  if (score <= 0) return 'rejet';
  if (score >= 0.7) return 'revue'; // haute confiance : revue rapide
  return 'revue_prioritaire'; // confiance moyenne : inspection attentive
}
