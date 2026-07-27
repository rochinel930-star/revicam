// Matrice RLS (squelette) — Phase P1 (sécurité).
//
// Déclare le CONTRAT d'accès attendu (rôle × objet × opération) comme une
// donnée versionnée, faisant autorité pour la revue et pour l'extension
// en P2 (matrice multi-programme). Deux niveaux de vérification :
//
//   1. Statique (toujours exécuté) : le contrat est complet et cohérent —
//      chaque table de base « secrète » possède une vue publique associée ;
//      aucune table de base n'accorde de lecture directe à anon.
//   2. Live (opt-in via RLS_LIVE=1) : vérifie le contrat contre la vraie
//      base Supabase. Ignoré par défaut pour garder la CI déterministe et
//      hors-réseau. À activer en local/staging avec les variables d'env.

import { describe, it, expect } from 'vitest';

type Role = 'anon' | 'authenticated' | 'service_role';
type Operation = 'select' | 'insert' | 'update' | 'delete';

interface RegleAcces {
  objet: string;
  estVue: boolean;
  secret: boolean; // table de base à ne jamais exposer côté client
  vuePublique?: string; // vue par laquelle le contenu transite (si secret)
  droits: Record<Role, Operation[]>;
}

// ── Contrat d'accès actuel (P0 + P1) ─────────────────────────────────
// Reflète les migrations 0001–0006 : secret-by-default, accès public
// uniquement via vues, service_role non restreint (contourne la RLS).
const MATRICE: RegleAcces[] = [
  {
    objet: 'lecons',
    estVue: false,
    secret: true,
    vuePublique: 'lecons_public',
    droits: { anon: [], authenticated: [], service_role: ['select', 'insert', 'update', 'delete'] },
  },
  {
    objet: 'lecons_public',
    estVue: true,
    secret: false,
    droits: { anon: ['select'], authenticated: ['select'], service_role: ['select'] },
  },
  {
    objet: 'questions',
    estVue: false,
    secret: true,
    vuePublique: 'questions_public',
    droits: { anon: [], authenticated: [], service_role: ['select', 'insert', 'update', 'delete'] },
  },
  {
    objet: 'questions_public',
    estVue: true,
    secret: false,
    droits: { anon: ['select'], authenticated: ['select'], service_role: ['select'] },
  },
  {
    objet: 'feature_flags',
    estVue: false,
    secret: true,
    vuePublique: 'feature_flags_public',
    droits: { anon: [], authenticated: [], service_role: ['select', 'insert', 'update', 'delete'] },
  },
  {
    objet: 'feature_flags_public',
    estVue: true,
    secret: false,
    droits: { anon: ['select'], authenticated: ['select'], service_role: ['select'] },
  },
];

describe('matrice RLS — cohérence statique du contrat', () => {
  it('déclare au moins une règle pour chaque objet sensible connu', () => {
    const objets = MATRICE.map((r) => r.objet);
    for (const attendu of ['lecons', 'questions', 'feature_flags']) {
      expect(objets).toContain(attendu);
    }
  });

  it('chaque table de base secrète possède une vue publique déclarée et présente', () => {
    const vues = new Set(MATRICE.filter((r) => r.estVue).map((r) => r.objet));
    for (const regle of MATRICE.filter((r) => r.secret)) {
      expect(regle.vuePublique, `${regle.objet} doit référencer une vue`).toBeTruthy();
      expect(vues.has(regle.vuePublique!), `${regle.vuePublique} doit exister`).toBe(true);
    }
  });

  it('aucune table de base secrète n’accorde de lecture directe à anon/authenticated', () => {
    for (const regle of MATRICE.filter((r) => r.secret && !r.estVue)) {
      expect(regle.droits.anon).toEqual([]);
      expect(regle.droits.authenticated).toEqual([]);
    }
  });

  it('les vues publiques n’exposent que la lecture (jamais d’écriture) côté client', () => {
    for (const regle of MATRICE.filter((r) => r.estVue)) {
      expect(regle.droits.anon.every((op) => op === 'select')).toBe(true);
      expect(regle.droits.authenticated.every((op) => op === 'select')).toBe(true);
    }
  });
});

// ── Vérification live (opt-in) ───────────────────────────────────────
const live = process.env.RLS_LIVE === '1';
describe.skipIf(!live)('matrice RLS — vérification live contre Supabase', () => {
  it('anon peut lire chaque vue publique', async () => {
    const { sbPublic } = await import('@/lib/supabase');
    for (const regle of MATRICE.filter((r) => r.estVue)) {
      const { error } = await sbPublic().from(regle.objet).select('*').limit(1);
      expect(error, `lecture de ${regle.objet} via anon`).toBeNull();
    }
  });

  it('anon ne peut PAS lire les tables de base secrètes', async () => {
    const { sbPublic } = await import('@/lib/supabase');
    for (const regle of MATRICE.filter((r) => r.secret && !r.estVue)) {
      const { data, error } = await sbPublic().from(regle.objet).select('*').limit(1);
      // Soit erreur de permission, soit résultat vide (RLS) : jamais de fuite.
      const fuite = !error && Array.isArray(data) && data.length > 0;
      expect(fuite, `${regle.objet} ne doit rien renvoyer à anon`).toBe(false);
    }
  });
});
