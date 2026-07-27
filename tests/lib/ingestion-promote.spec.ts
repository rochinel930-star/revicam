// Unitaire mapper de promotion + garde admin — Phase P4.

import { describe, it, expect } from 'vitest';
import { extractionVersBrouillon } from '@/lib/ingestion/promote';
import { verifierAdmin } from '@/lib/admin-auth';
import type { ExtractionEpreuve } from '@/lib/ingestion/types';

const EXTRACTION: ExtractionEpreuve = {
  titre: 'Bac blanc',
  classe: 'premiere-d',
  matiere: 'physique',
  type: 'baccalaureat',
  annee: 2024,
  questions: [
    { ordre: 1, type: 'qcm', enonce_mdx: 'Q1', bareme: 2, options: ['A', 'B', 'C'], bonnes_reponses: [1] },
    { ordre: 2, type: 'libre', enonce_mdx: 'Q2', bareme: 3, corrige_type_mdx: 'corrigé' },
  ],
  provenance: {},
};

describe('extractionVersBrouillon', () => {
  it('produit une composition brouillon (publie=false) + questions', () => {
    const b = extractionVersBrouillon(EXTRACTION, 'deadbeef');
    expect(b.composition.publie).toBe(false);
    expect(b.composition.slug).toBe('ingest-deadbeef');
    expect(b.composition.bareme_total).toBe(5);
    expect(b.questions).toHaveLength(2);
  });

  it('mappe options en id lettres et bonnes réponses', () => {
    const b = extractionVersBrouillon(EXTRACTION, 'x');
    expect(b.questions[0].options).toEqual([
      { id: 'a', texte: 'A' },
      { id: 'b', texte: 'B' },
      { id: 'c', texte: 'C' },
    ]);
    expect(b.questions[0].bonnes_reponses).toEqual(['b']); // index 1 → 'b'
    expect(b.questions[1].options).toBeNull();
  });
});

describe('verifierAdmin', () => {
  const OLD = process.env.ADMIN_API_TOKEN;
  function req(token?: string): Request {
    const h = new Headers();
    if (token) h.set('authorization', `Bearer ${token}`);
    return new Request('http://x/api/admin/ingest', { method: 'POST', headers: h });
  }

  it('désactivé si ADMIN_API_TOKEN absent (503)', () => {
    delete process.env.ADMIN_API_TOKEN;
    const v = verifierAdmin(req('abc'));
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.statut).toBe(503);
  });

  it('refuse un jeton invalide (401)', () => {
    process.env.ADMIN_API_TOKEN = 'secret-attendu';
    const v = verifierAdmin(req('mauvais'));
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.statut).toBe(401);
  });

  it('accepte le bon jeton', () => {
    process.env.ADMIN_API_TOKEN = 'secret-attendu';
    expect(verifierAdmin(req('secret-attendu')).ok).toBe(true);
    process.env.ADMIN_API_TOKEN = OLD;
  });
});
