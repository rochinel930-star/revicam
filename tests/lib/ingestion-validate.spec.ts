// Unitaire du gate de validation — Phase P4.

import { describe, it, expect } from 'vitest';
import { valider } from '@/lib/ingestion/validate';
import type { Referentiel } from '@/lib/ingestion/types';

const REF: Referentiel = {
  classes: ['premiere-d'],
  matieres: ['physique'],
  types: ['baccalaureat', 'sequentielle'],
};

function payloadValide() {
  return {
    titre: 'Bac blanc Physique',
    classe: 'premiere-d',
    matiere: 'physique',
    type: 'baccalaureat',
    annee: 2024,
    questions: [
      { ordre: 1, type: 'qcm', enonce_mdx: 'Relation $E=mc^2$ ?', bareme: 2, options: ['Oui', 'Non'], bonnes_reponses: [0] },
      { ordre: 2, type: 'libre', enonce_mdx: 'Explique la mesure.', bareme: 3, corrige_type_mdx: 'La mesure $x$.' },
    ],
  };
}

describe('valider — cas conforme', () => {
  it('accepte une extraction canonique valide', () => {
    const r = valider(payloadValide(), REF);
    expect(r.ok).toBe(true);
    expect(r.extraction?.questions).toHaveLength(2);
  });
});

describe('valider — rejets déterministes', () => {
  it('rejette un titre manquant', () => {
    const p = { ...payloadValide(), titre: '' };
    const r = valider(p, REF);
    expect(r.ok).toBe(false);
    expect(r.problemes.some((x) => x.code === 'titre')).toBe(true);
  });

  it('rejette une classe / matière / type hors référentiel', () => {
    const r = valider({ ...payloadValide(), classe: 'inconnue', matiere: 'x', type: 'zzz' }, REF);
    expect(r.problemes.map((p) => p.code)).toEqual(expect.arrayContaining(['classe', 'matiere', 'type']));
  });

  it('rejette un barème ≤ 0', () => {
    const p = payloadValide();
    p.questions[0].bareme = 0;
    const r = valider(p, REF);
    expect(r.problemes.some((x) => x.code === 'bareme_invalide')).toBe(true);
  });

  it('rejette des maths KaTeX invalides', () => {
    const p = payloadValide();
    p.questions[0].enonce_mdx = 'Soit $\\notacommande x$ ici.';
    const r = valider(p, REF);
    expect(r.problemes.some((x) => x.code === 'maths_invalide')).toBe(true);
  });

  it('rejette un QCM sans assez d’options', () => {
    const p = payloadValide();
    p.questions[0].options = ['Seule'];
    const r = valider(p, REF);
    expect(r.problemes.some((x) => x.code === 'qcm_options')).toBe(true);
  });

  it('rejette une liste de questions vide', () => {
    const r = valider({ ...payloadValide(), questions: [] }, REF);
    expect(r.problemes.some((x) => x.code === 'questions_vides')).toBe(true);
  });

  it('accepte le \\ce{} de mhchem (chimie)', () => {
    const p = payloadValide();
    p.questions[0].enonce_mdx = 'Équation : $\\ce{2H2 + O2 -> 2H2O}$ ?';
    const r = valider(p, REF);
    expect(r.ok).toBe(true);
  });
});
