// Logique de coût IA — Phase P8.
//
// Matérialise la politique de coût (contrainte dure) : router chaque tâche
// vers le palier le moins cher capable, budgéter, alerter. Tarifs indicatifs
// (EUR / 1M tokens) pour l'estimation — ajustables sans changer l'appelant.

export type Palier = 'sans_ia' | 'local' | 'embeddings' | 'bon_marche' | 'premium';

const TARIFS_EUR_PAR_MTOKEN: Record<Palier, number> = {
  sans_ia: 0,
  local: 0,
  embeddings: 0.02,
  bon_marche: 0.3, // OCR/extraction/génération d'items (batch, caché)
  premium: 9, // notation de réponse ouverte, composition ciblée
};

/** Plafond indicatif de coût de génération par leçon (tous artefacts). */
export const BUDGET_LECON_EUR = 0.05;

export function estimerCoutEur(tokens: number, palier: Palier): number {
  const eur = (Math.max(0, tokens) / 1_000_000) * TARIFS_EUR_PAR_MTOKEN[palier];
  return Math.round(eur * 1e6) / 1e6;
}

export function sousBudget(coutEurTotal: number, budget: number = BUDGET_LECON_EUR): boolean {
  return coutEurTotal <= budget;
}
