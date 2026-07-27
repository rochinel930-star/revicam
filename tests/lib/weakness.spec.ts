// Unitaire détection de faiblesses — Phase P8.

import { describe, it, expect } from 'vitest';
import { detecterFaiblesses } from '@/lib/weakness';
import type { ProgressLecon } from '@/lib/local';

function p(statut: ProgressLecon['statut'], score: number | null): ProgressLecon {
  return { statut, meilleur_score_qcm: score, updated_at: '2026-01-01T00:00:00Z' };
}

describe('detecterFaiblesses', () => {
  it('retient les leçons évaluées sous le seuil, triées croissant', () => {
    const f = detecterFaiblesses({ a: p('qcm_fait', 8), b: p('terminee', 15), c: p('qcm_fait', 4) });
    expect(f.map((x) => x.leconId)).toEqual(['c', 'a']);
  });

  it('ignore les leçons non évaluées (score null)', () => {
    expect(detecterFaiblesses({ a: p('vue', null) })).toHaveLength(0);
  });

  it('respecte un seuil personnalisé', () => {
    expect(detecterFaiblesses({ a: p('terminee', 13) }, 14)).toHaveLength(1);
    expect(detecterFaiblesses({ a: p('terminee', 13) }, 12)).toHaveLength(0);
  });
});
