// Unitaire contexte leçon — Phase P7.

import { describe, it, expect } from 'vitest';
import {
  signatureContenu,
  markdownVersTexte,
  construireContexteLecon,
  contexteVersJsonLd,
} from '@/lib/lesson-context';
import type { Lecon } from '@/lib/types';

const leconBase: Lecon = {
  id: 'l1',
  module_id: 'm1',
  numero: 4,
  titre: 'Grandeurs physiques',
  slug: 'grandeurs',
  duree_lecture_min: 20,
  objectifs: ['Mesurer', 'Convertir'],
  contenu_mdx: '# Cours\nLa relation $E=mc^2$ et <svg><line/></svg> ici.\n:::formule\nW=F·d\n:::',
  essentiel_mdx: '**Retenir** ceci.',
  jeu_bilingue: null,
  qcm: null,
  exercices: null,
  publie: true,
};

describe('lesson-context', () => {
  it('signature est déterministe et change avec le contenu', () => {
    const a = signatureContenu(['x', 'y']);
    const b = signatureContenu(['x', 'y']);
    const c = signatureContenu(['x', 'z']);
    expect(a).toBe(b);
    expect(a).not.toBe(c);
    expect(a).toMatch(/^[0-9a-f]{8}$/);
  });

  it('markdownVersTexte retire maths, HTML et symboles', () => {
    const txt = markdownVersTexte(leconBase.contenu_mdx);
    expect(txt).not.toMatch(/\$/);
    expect(txt).not.toMatch(/<svg/);
    expect(txt).not.toMatch(/[#*]/);
    expect(txt).toContain('Cours');
    expect(txt).toContain('relation');
  });

  it('construit un contexte normalisé complet', () => {
    const ctx = construireContexteLecon({
      lecon: leconBase,
      matiere: 'Physique',
      classe: 'Première D',
      chapitre: 'Module 1 — Mesure',
    });
    expect(ctx.leconId).toBe('l1');
    expect(ctx.objectifs).toHaveLength(2);
    expect(ctx.texteBrut.length).toBeGreaterThan(0);
    expect(ctx.signature).toMatch(/^[0-9a-f]{8}$/);
  });

  it('JSON-LD est un LearningResource gratuit', () => {
    const ctx = construireContexteLecon({
      lecon: leconBase,
      matiere: 'Physique',
      classe: 'Première D',
      chapitre: 'Module 1',
    });
    const ld = contexteVersJsonLd(ctx);
    expect(ld['@type']).toBe('LearningResource');
    expect(ld.isAccessibleForFree).toBe(true);
    expect(ld.teaches).toEqual(['Mesurer', 'Convertir']);
  });
});
