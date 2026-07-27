// Unitaire filtres épreuves — Phase P10.

import { describe, it, expect } from 'vitest';
import {
  construireUrlEpreuves,
  SERIES_DISPONIBLES,
  EXAMENS_NATIONAUX,
} from '@/lib/epreuves-filtres';

describe('construireUrlEpreuves', () => {
  it('sans filtre → /epreuves', () => {
    expect(construireUrlEpreuves({}, {})).toBe('/epreuves');
  });

  it('ajoute un filtre', () => {
    expect(construireUrlEpreuves({}, { type: 'baccalaureat' })).toBe('/epreuves?type=baccalaureat');
  });

  it('combine et patche les filtres existants', () => {
    const url = construireUrlEpreuves({ classe: 'premiere-d', matiere: 'physique' }, { serie: 'D' });
    expect(url).toContain('classe=premiere-d');
    expect(url).toContain('matiere=physique');
    expect(url).toContain('serie=D');
  });

  it('retire un filtre quand la valeur est undefined', () => {
    const url = construireUrlEpreuves({ type: 'bepc', annee: '2024' }, { type: undefined });
    expect(url).not.toContain('type=');
    expect(url).toContain('annee=2024');
  });

  it('expose les séries et examens nationaux du référentiel', () => {
    expect(SERIES_DISPONIBLES).toContain('E');
    expect(EXAMENS_NATIONAUX).toEqual(['bepc', 'probatoire', 'baccalaureat', 'cep']);
  });
});
