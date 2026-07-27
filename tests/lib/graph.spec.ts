// Unitaire du repository graphe — Phase P3.
//
// Vérifie que src/lib/graph.ts construit les bonnes requêtes et mappe
// correctement les résultats, via un stub du client Supabase (aucun réseau).

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Stub chaînable minimal du client sbPublic ────────────────────────
type Handler = (table: string) => { data: unknown; error: unknown };
let handler: Handler;

vi.mock('@/lib/supabase', () => ({
  sbPublic: () => {
    let table = '';
    const builder: Record<string, unknown> = {};
    const chain = () => builder;
    builder.from = (t: string) => { table = t; return builder; };
    builder.select = chain;
    builder.eq = chain;
    builder.in = chain;
    builder.maybeSingle = () => handler(table);
    // rendre l'objet "thenable" pour `await query`
    builder.then = (resolve: (v: unknown) => void) => resolve(handler(table));
    return builder;
  },
}));

import { getNotionsDeLecon, getCompetencesDeLecon, getChaineNotion } from '@/lib/graph';

beforeEach(() => {
  handler = () => ({ data: [], error: null });
});

describe('graph.ts — repository', () => {
  it('getNotionsDeLecon mappe les notions imbriquées', async () => {
    handler = (table) =>
      table === 'lecon_notion'
        ? { data: [{ notion: { id: 'n1', code: 'u', nom: 'Unités' } }], error: null }
        : { data: [], error: null };
    const notions = await getNotionsDeLecon('l1');
    expect(notions).toEqual([{ id: 'n1', code: 'u', nom: 'Unités' }]);
  });

  it('getCompetencesDeLecon déduplique les compétences', async () => {
    handler = (table) => {
      if (table === 'lecon_notion') {
        return { data: [{ notion: { id: 'n1' } }, { notion: { id: 'n2' } }], error: null };
      }
      if (table === 'notion_competence') {
        return {
          data: [
            { competence: { id: 'c1', nom: 'Mesurer' } },
            { competence: { id: 'c1', nom: 'Mesurer' } },
          ],
          error: null,
        };
      }
      return { data: [], error: null };
    };
    const comps = await getCompetencesDeLecon('l1');
    expect(comps).toHaveLength(1);
    expect(comps[0].id).toBe('c1');
  });

  it('getChaineNotion renvoie la ligne de traversée', async () => {
    handler = (table) =>
      table === 'v_notion_chaine'
        ? { data: { notion_id: 'n1', pays_code: 'CM' }, error: null }
        : { data: null, error: null };
    const chaine = await getChaineNotion('n1');
    expect(chaine?.pays_code).toBe('CM');
  });

  it('propage les erreurs Supabase', async () => {
    handler = () => ({ data: null, error: new Error('boom') });
    await expect(getNotionsDeLecon('l1')).rejects.toThrow('boom');
  });
});
