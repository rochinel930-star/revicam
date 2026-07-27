// Filtres du catalogue d'épreuves — Phase P10.
//
// Logique pure et testable de construction d'URL de filtres combinables
// (partageables). Extraite de la page pour être validée unitairement et
// réutilisée. Alignée sur le référentiel des séries (P2).

export interface FiltresEpreuvesUI {
  classe?: string;
  matiere?: string;
  type?: string;
  annee?: string;
  serie?: string;
  etablissement?: string;
}

/** Séries du référentiel (cf. migration 0014). */
export const SERIES_DISPONIBLES = ['A', 'C', 'D', 'E', 'TI'] as const;

/** Types d'examens nationaux (sous-ensemble « officiel »). */
export const EXAMENS_NATIONAUX = ['bepc', 'probatoire', 'baccalaureat', 'cep'] as const;

/** Construit l'URL /epreuves avec les filtres courants patchés. */
export function construireUrlEpreuves(
  filtres: FiltresEpreuvesUI,
  patch: Partial<FiltresEpreuvesUI>
): string {
  const params = new URLSearchParams();
  const next = { ...filtres, ...patch };
  for (const [k, v] of Object.entries(next)) {
    if (v) params.set(k, v);
  }
  const qs = params.toString();
  return qs ? `/epreuves?${qs}` : '/epreuves';
}
