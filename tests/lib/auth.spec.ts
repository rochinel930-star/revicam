// Unitaire fusion anon→compte — Phase P6.

import { describe, it, expect } from 'vitest';
import { planifierFusion, type LeconProgressExistant } from '@/lib/auth';
import type { ProgressLecon } from '@/lib/local';

const U = 'user-1';
function prog(statut: ProgressLecon['statut'], score: number | null = null): ProgressLecon {
  return { statut, meilleur_score_qcm: score, updated_at: '2026-01-01T00:00:00Z' };
}

describe('planifierFusion', () => {
  it('insère les leçons absentes du compte', () => {
    const { inserts, updates } = planifierFusion({ a: prog('terminee', 18) }, [], U);
    expect(inserts).toHaveLength(1);
    expect(updates).toHaveLength(0);
    expect(inserts[0]).toMatchObject({ lecon_id: 'a', user_id: U, statut: 'terminee', meilleur_score_qcm: 18 });
  });

  it('met à jour quand le local est plus avancé (statut ou score)', () => {
    const existant: LeconProgressExistant[] = [{ lecon_id: 'a', statut: 'vue', meilleur_score_qcm: 10 }];
    const { updates } = planifierFusion({ a: prog('terminee', 8) }, existant, U);
    expect(updates).toHaveLength(1);
    expect(updates[0].statut).toBe('terminee'); // statut progressé
    expect(updates[0].meilleur_score_qcm).toBe(10); // score non rétrogradé
  });

  it('ne rétrograde jamais un statut déjà supérieur en compte', () => {
    const existant: LeconProgressExistant[] = [{ lecon_id: 'a', statut: 'terminee', meilleur_score_qcm: 15 }];
    const { inserts, updates } = planifierFusion({ a: prog('vue', 5) }, existant, U);
    expect(inserts).toHaveLength(0);
    expect(updates).toHaveLength(0); // rien à faire : le compte est déjà plus avancé
  });

  it('gère plusieurs leçons mixtes', () => {
    const local = { a: prog('qcm_fait', 12), b: prog('vue'), c: prog('terminee', 20) };
    const existant: LeconProgressExistant[] = [{ lecon_id: 'a', statut: 'vue', meilleur_score_qcm: null }];
    const { inserts, updates } = planifierFusion(local, existant, U);
    expect(inserts.map((r) => r.lecon_id).sort()).toEqual(['b', 'c']);
    expect(updates.map((r) => r.lecon_id)).toEqual(['a']);
  });
});
