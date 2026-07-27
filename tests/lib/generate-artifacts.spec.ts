// Unitaire orchestrateur de génération + signature + coût — Phase P8.

import { describe, it, expect } from 'vitest';
import { genererArtefactsLecon } from '@/lib/ai/generate-artifacts';
import { qcmGenerateur } from '@/lib/ai/generators/qcm';
import { questionsOuvertesGenerateur } from '@/lib/ai/generators/questions-ouvertes';
import { NOOP_ADAPTER, type LlmAdapter } from '@/lib/ai/adapter';
import { signatureArtefact } from '@/lib/ai/artifact-signature';
import { estimerCoutEur, sousBudget } from '@/lib/ai/cost';
import type { LessonContext } from '@/lib/lesson-context';

const CTX: LessonContext = {
  leconId: 'l1',
  slug: 's',
  titre: 'T',
  numero: 1,
  matiere: 'Physique',
  classe: 'Première D',
  chapitre: 'Module 1',
  objectifs: [],
  texteBrut: 'cours',
  signature: 'abcd1234',
};

const fakeQcm: LlmAdapter = {
  nom: 'fake',
  disponible: () => true,
  generer: async () => ({
    contenu: [{ enonce_mdx: 'Q?', options: ['a', 'b'], bonnes: [0], explication_mdx: 'x' }],
    cout_tokens: 800,
    modele: 'fake-1',
  }),
};

describe('genererArtefactsLecon', () => {
  it('génère, signe et chiffre un artefact via l’adaptateur', async () => {
    const r = await genererArtefactsLecon(CTX, fakeQcm, [qcmGenerateur]);
    expect(r.artefacts).toHaveLength(1);
    const a = r.artefacts[0];
    expect(a.type).toBe('qcm');
    expect(a.signature).toBe(signatureArtefact('qcm', 'qcm-1', 'abcd1234'));
    expect(a.lesson_version).toBe('abcd1234');
    expect(a.cost_eur).toBeGreaterThan(0);
    expect(a.provenance.adapter).toBe('fake');
    expect(r.coutTotalEur).toBeGreaterThan(0);
  });

  it('range la rubrique en secret pour les questions ouvertes', async () => {
    const fakeQo: LlmAdapter = {
      nom: 'fake',
      disponible: () => true,
      generer: async () => ({ contenu: [{ question_mdx: 'Q', corrige_type_mdx: 'C', bareme: 4 }] }),
    };
    const r = await genererArtefactsLecon(CTX, fakeQo, [questionsOuvertesGenerateur]);
    expect(r.artefacts[0].secret).toEqual([{ corrige_type_mdx: 'C', bareme: 4 }]);
    expect(r.artefacts[0].payload).toEqual([{ question_mdx: 'Q', bareme: 4 }]);
  });

  it('sans adaptateur : erreur adaptateur_indisponible, aucun artefact', async () => {
    const r = await genererArtefactsLecon(CTX, NOOP_ADAPTER, [qcmGenerateur]);
    expect(r.artefacts).toHaveLength(0);
    expect(r.erreurs[0].problemes).toContain('adaptateur_indisponible');
  });

  it('remonte les erreurs de validation sans persister', async () => {
    const fakeMauvais: LlmAdapter = {
      nom: 'fake',
      disponible: () => true,
      generer: async () => ({ contenu: [{ enonce_mdx: 'Q', options: ['a'], bonnes: [0] }] }),
    };
    const r = await genererArtefactsLecon(CTX, fakeMauvais, [qcmGenerateur]);
    expect(r.artefacts).toHaveLength(0);
    expect(r.erreurs).toHaveLength(1);
  });
});

describe('signature & coût', () => {
  it('signature déterministe et sensible à la version', () => {
    const a = signatureArtefact('qcm', 'qcm-1', 'v1');
    expect(a).toBe(signatureArtefact('qcm', 'qcm-1', 'v1'));
    expect(a).not.toBe(signatureArtefact('qcm', 'qcm-1', 'v2'));
    expect(a).not.toBe(signatureArtefact('qcm', 'qcm-2', 'v1'));
  });
  it('estimation de coût et budget', () => {
    expect(estimerCoutEur(0, 'bon_marche')).toBe(0);
    expect(estimerCoutEur(1_000_000, 'premium')).toBeGreaterThan(estimerCoutEur(1_000_000, 'bon_marche'));
    expect(sousBudget(0.01)).toBe(true);
    expect(sousBudget(1)).toBe(false);
  });
});
