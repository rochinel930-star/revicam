// Unitaire de l'orchestrateur + étapes — Phase P4.

import { describe, it, expect, afterEach } from 'vitest';
import { ingerer } from '@/lib/ingestion';
import { intake, estDoublon } from '@/lib/ingestion/intake';
import { qc } from '@/lib/ingestion/qc';
import { persister, type PersisteurStaging } from '@/lib/ingestion/persist';
import { enregistrerAdapter, reinitialiserAdapter } from '@/lib/ai/adapter';
import type { Artefact, ExtractionEpreuve, Referentiel, ResultatIngestion } from '@/lib/ingestion/types';

const REF: Referentiel = { classes: ['premiere-d'], matieres: ['physique'], types: ['baccalaureat'] };

const EXTRACTION = {
  titre: 'Bac blanc',
  classe: 'premiere-d',
  matiere: 'physique',
  type: 'baccalaureat',
  annee: 2024,
  questions: [
    { ordre: 1, type: 'qcm', enonce_mdx: 'Vitesse et acceleration du mobile ?', bareme: 2, options: ['Oui', 'Non'], bonnes_reponses: [0] },
  ],
};

function artefactJson(): Artefact {
  return { type: 'epreuve', source: 'test.json', mime: 'application/json', contenu: JSON.stringify(EXTRACTION) };
}

afterEach(() => reinitialiserAdapter());

describe('intake', () => {
  it('produit une empreinte stable (idempotence)', () => {
    const a = intake(artefactJson());
    const b = intake(artefactJson());
    expect(a.hash).toBe(b.hash);
    expect(estDoublon(a.hash!, new Set([b.hash!]))).toBe(true);
  });
});

describe('ingerer (JSON canonique, sans IA)', () => {
  it('valide et prépare pour revue (jamais publié)', async () => {
    const r = await ingerer(artefactJson(), { referentiel: REF });
    expect(r.ok).toBe(true);
    expect(r.aRevoir).toBe(true);
    expect(r.extraction?.titre).toBe('Bac blanc');
    expect(r.score).toBeGreaterThan(0);
  });

  it('échoue au gate de validation sur extraction invalide', async () => {
    const mauvais = { ...artefactJson(), contenu: JSON.stringify({ ...EXTRACTION, matiere: 'inconnue' }) };
    const r = await ingerer(mauvais, { referentiel: REF });
    expect(r.ok).toBe(false);
    expect(r.etapeEchec).toBe('validate');
  });

  it('échoue à l’OCR pour un binaire sans adaptateur', async () => {
    const bin: Artefact = { type: 'epreuve', source: 's.pdf', mime: 'application/pdf', contenu: 'JVBERi0=' };
    const r = await ingerer(bin, { referentiel: REF });
    expect(r.etapeEchec).toBe('ocr');
  });

  it('utilise l’adaptateur injecté pour extraire un texte non-JSON', async () => {
    enregistrerAdapter({
      nom: 'fake',
      disponible: () => true,
      extraire: async () => EXTRACTION,
    });
    const txt: Artefact = { type: 'epreuve', source: 's.txt', mime: 'text/plain', contenu: 'énoncé libre non structuré' };
    const r = await ingerer(txt, { referentiel: REF });
    expect(r.ok).toBe(true);
  });
});

describe('qc — grounding déterministe', () => {
  it('score haut quand les énoncés proviennent de la source', async () => {
    const ext = EXTRACTION as unknown as ExtractionEpreuve;
    const r = await qc(ext, 'Vitesse et acceleration du mobile étudié.');
    expect(r.score).toBeGreaterThan(0.5);
  });
  it('signale un ancrage faible quand la source est étrangère', async () => {
    const ext = EXTRACTION as unknown as ExtractionEpreuve;
    const r = await qc(ext, 'Texte totalement différent parlant de poésie.');
    expect(r.problemes.some((p) => p.code === 'grounding_faible')).toBe(true);
  });
});

describe('persister — staging idempotent', () => {
  it('n’insère pas deux fois le même hash', async () => {
    const memoire = { jobs: new Set<string>(), creations: 0 };
    const fake: PersisteurStaging = {
      jobExistant: async (h) => memoire.jobs.has(h),
      creerJob: async () => { memoire.creations++; return 'job-1'; },
      creerArtefact: async () => {},
      creerExtraction: async () => {},
      creerRevue: async () => {},
    };
    const result: ResultatIngestion = { hash: 'abc', ok: true, problemes: [], score: 1, suggestions: [], aRevoir: true };
    const art = artefactJson();
    const p1 = await persister(result, art, art.contenu, fake);
    memoire.jobs.add('abc'); // simulate the row now exists
    const p2 = await persister(result, art, art.contenu, fake);
    expect(p1.doublon).toBe(false);
    expect(p2.doublon).toBe(true);
    expect(memoire.creations).toBe(1);
  });
});
