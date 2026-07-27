// Unitaire feature flags — Phase P1 (couverture RC).
// Vérifie la résolution env > table > défaut (getFlag + getFlagRemote).

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

let dbResult: { data: unknown; error: unknown };

vi.mock('@/lib/supabase', () => ({
  sbPublic: () => {
    const builder: Record<string, unknown> = {};
    const chain = () => builder;
    builder.from = chain;
    builder.select = chain;
    builder.eq = chain;
    builder.maybeSingle = () => dbResult;
    return builder;
  },
}));

import { getFlag, getFlagRemote, FLAG_DEFAULTS } from '@/lib/flags';

beforeEach(() => {
  dbResult = { data: null, error: null };
  delete process.env.FLAG_HEALTH_VERBOSE;
});
afterEach(() => {
  delete process.env.FLAG_HEALTH_VERBOSE;
});

describe('getFlag (env > défaut)', () => {
  it('retourne la valeur par défaut du registre', () => {
    expect(getFlag('health_verbose')).toBe(FLAG_DEFAULTS.health_verbose);
  });
  it('applique une surcharge d’environnement', () => {
    process.env.FLAG_HEALTH_VERBOSE = '0';
    expect(getFlag('health_verbose')).toBe(false);
    process.env.FLAG_HEALTH_VERBOSE = 'on';
    expect(getFlag('health_verbose')).toBe(true);
  });
});

describe('getFlagRemote (env > table > défaut)', () => {
  it('prend la surcharge en base quand présente', async () => {
    dbResult = { data: { enabled: false }, error: null };
    expect(await getFlagRemote('health_verbose')).toBe(false);
  });
  it('retombe sur le défaut en cas d’erreur base', async () => {
    dbResult = { data: null, error: new Error('boom') };
    expect(await getFlagRemote('health_verbose')).toBe(FLAG_DEFAULTS.health_verbose);
  });
  it('l’environnement a la priorité sur la base', async () => {
    process.env.FLAG_HEALTH_VERBOSE = '0';
    dbResult = { data: { enabled: true }, error: null };
    expect(await getFlagRemote('health_verbose')).toBe(false);
  });
});
