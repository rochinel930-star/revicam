// Suite vitest anti-injection — Phase P1 (sécurité).
//
// Vérifie l'assainissement R2 (défense en profondeur) sur les charges
// hostiles réellement plausibles dans du contenu Markdown/HTML importé.
// Alimenté par le sous-ensemble `tag === 'securite'` du foyer partagé,
// enrichi de vecteurs d'injection supplémentaires propres à la sécurité.

import { describe, it, expect } from 'vitest';
import { mdToHtml } from '@/lib/markdown';
import { CAS_RENDU } from '@/lib/render/render-cases';

const casSecurite = CAS_RENDU.filter((c) => c.tag === 'securite');

describe('assainissement — cas du foyer partagé', () => {
  it.each(casSecurite.map((c) => [c.nom, c] as const))('%s', (_nom, cas) => {
    const html = mdToHtml(cas.entree);
    expect(cas.verifier(html)).toBe(true);
  });
});

describe('assainissement — vecteurs d’injection additionnels', () => {
  it('neutralise un <a> avec protocole data: exécutable', () => {
    const h = mdToHtml('[x](data:text/html,<script>alert(1)</script>)');
    expect(/<script/i.test(h)).toBe(false);
  });

  it('supprime un handler onclick sur un élément autorisé', () => {
    const h = mdToHtml('<div onclick="alert(1)">clic</div>');
    expect(/onclick/i.test(h)).toBe(false);
  });

  it('supprime une balise <style> injectée', () => {
    const h = mdToHtml('<style>*{display:none}</style>Texte visible.');
    expect(/<style/i.test(h)).toBe(false);
    expect(/Texte visible\./.test(h)).toBe(true);
  });

  it('ne laisse passer aucun attribut on* même en casse mixte', () => {
    const h = mdToHtml('<img src=x OnErRoR=alert(1)>');
    expect(/on\w+=/i.test(h)).toBe(false);
  });

  it('préserve le contenu légitime tout en retirant la charge', () => {
    const h = mdToHtml('Avant <script>alert(1)</script> après.');
    expect(/Avant/.test(h)).toBe(true);
    expect(/après/.test(h)).toBe(true);
    expect(/alert\(1\)/.test(h)).toBe(false);
  });
});
