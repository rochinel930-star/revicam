// Suite vitest du moteur de rendu — Phase P1 (tests bloquants).
//
// Miroir framework-de la garde `render:check`, alimenté par le MÊME foyer
// de cas (src/lib/render/render-cases.ts). Aucune duplication d'assertions.

import { describe, it, expect } from 'vitest';
import { mdToHtml } from '@/lib/markdown';
import { CAS_RENDU } from '@/lib/render/render-cases';

describe('mdToHtml — cas de rendu (foyer partagé)', () => {
  it.each(CAS_RENDU.map((c) => [c.nom, c] as const))('%s', (_nom, cas) => {
    const html = mdToHtml(cas.entree);
    expect(cas.verifier(html)).toBe(true);
  });
});
