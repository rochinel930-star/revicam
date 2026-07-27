// Étape 6 — scoring. Phase P4.
// Un contenu invalide score 0. Sinon, le score de grounding (0..1) est
// conservé tel quel et accompagne l'artefact en file de revue humaine
// (jamais de promotion automatique : cf. index/persist).

export function scoreFinal(validationOk: boolean, groundingScore: number): number {
  if (!validationOk) return 0;
  return Math.max(0, Math.min(1, groundingScore));
}
