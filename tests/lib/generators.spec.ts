// Unitaire des générateurs d'artefacts — Phase P8.

import { describe, it, expect } from 'vitest';
import { GENERATEURS } from '@/lib/ai/generators';
import { qcmGenerateur } from '@/lib/ai/generators/qcm';
import { flashcardsGenerateur } from '@/lib/ai/generators/flashcards';
import { vraiFauxGenerateur } from '@/lib/ai/generators/vrai-faux';
import { questionsOuvertesGenerateur } from '@/lib/ai/generators/questions-ouvertes';
import { explicationsGenerateur } from '@/lib/ai/generators/explications';
import type { LessonContext } from '@/lib/lesson-context';

const CTX: LessonContext = {
  leconId: 'l1',
  slug: 'grandeurs',
  titre: 'Grandeurs',
  numero: 1,
  matiere: 'Physique',
  classe: 'Première D',
  chapitre: 'Module 1',
  objectifs: [],
  texteBrut: 'Le cours sur les grandeurs et unités de mesure.',
  signature: 'abcd1234',
};

describe('registre des générateurs', () => {
  it('expose les 5 types P8', () => {
    expect(GENERATEURS.map((g) => g.type).sort()).toEqual(
      ['explications', 'flashcards', 'qcm', 'questions_ouvertes', 'vrai_faux']
    );
  });
  it('chaque générateur produit un prompt non vide', () => {
    for (const g of GENERATEURS) expect(g.construirePrompt(CTX).length).toBeGreaterThan(20);
  });
});

describe('qcm.valider', () => {
  it('accepte un QCM conforme', () => {
    const r = qcmGenerateur.valider([
      { enonce_mdx: 'Combien vaut $E=mc^2$ ?', options: ['a', 'b'], bonnes: [0], explication_mdx: 'car x' },
    ]);
    expect(r.ok).toBe(true);
  });
  it('rejette < 2 options', () => {
    const r = qcmGenerateur.valider([{ enonce_mdx: 'Q', options: ['a'], bonnes: [0] }]);
    expect(r.ok).toBe(false);
  });
  it('rejette une bonne réponse hors bornes', () => {
    const r = qcmGenerateur.valider([{ enonce_mdx: 'Q', options: ['a', 'b'], bonnes: [5] }]);
    expect(r.ok).toBe(false);
  });
  it('rejette des maths invalides', () => {
    const r = qcmGenerateur.valider([{ enonce_mdx: 'Q $\\notacmd$', options: ['a', 'b'], bonnes: [0] }]);
    expect(r.ok).toBe(false);
  });
});

describe('flashcards.valider', () => {
  it('accepte des cartes valides', () => {
    expect(flashcardsGenerateur.valider([{ recto: 'R', verso_mdx: 'Réponse $x$' }]).ok).toBe(true);
  });
  it('rejette un verso manquant', () => {
    expect(flashcardsGenerateur.valider([{ recto: 'R' }]).ok).toBe(false);
  });
});

describe('vrai_faux.valider', () => {
  it('accepte un item valide', () => {
    expect(vraiFauxGenerateur.valider([{ affirmation_mdx: 'A', correct: true, explication_mdx: 'e' }]).ok).toBe(true);
  });
  it('rejette un correct non booléen', () => {
    expect(vraiFauxGenerateur.valider([{ affirmation_mdx: 'A', correct: 'oui' }]).ok).toBe(false);
  });
});

describe('questions_ouvertes.valider', () => {
  it('sépare payload public et rubrique secrète', () => {
    const r = questionsOuvertesGenerateur.valider([
      { question_mdx: 'Explique.', corrige_type_mdx: 'Le corrigé.', bareme: 4 },
    ]);
    expect(r.ok).toBe(true);
    expect(r.payload).toEqual([{ question_mdx: 'Explique.', bareme: 4 }]);
    expect(r.secret).toEqual([{ corrige_type_mdx: 'Le corrigé.', bareme: 4 }]);
  });
  it('rejette un barème ≤ 0', () => {
    expect(
      questionsOuvertesGenerateur.valider([{ question_mdx: 'Q', corrige_type_mdx: 'C', bareme: 0 }]).ok
    ).toBe(false);
  });
});

describe('explications.valider', () => {
  it('accepte une explication valide', () => {
    expect(explicationsGenerateur.valider([{ titre: 'T', corps_mdx: 'Corps $x$' }]).ok).toBe(true);
  });
  it('rejette un titre vide', () => {
    expect(explicationsGenerateur.valider([{ titre: '', corps_mdx: 'C' }]).ok).toBe(false);
  });
});
