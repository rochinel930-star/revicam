// Validation déterministe d'un fragment MDX — foyer unique.
//
// Utilisé par le gate d'ingestion (P4) et par les générateurs IA (P8) :
//   - compilation KaTeX de toutes les maths ($…$ / $$…$$, y compris \ce{}) ;
//   - anti-injection : le rendu assaini ne laisse survivre aucun script/handler.
// Retourne la liste des problèmes (codes) ; vide = conforme.

import katex from 'katex';
import 'katex/contrib/mhchem';
import { mdToHtml } from '@/lib/markdown';

export function problemesMdx(mdx: string): string[] {
  const problemes: string[] = [];

  const segments: Array<{ expr: string; display: boolean }> = [];
  for (const m of mdx.matchAll(/\$\$([\s\S]*?)\$\$/g)) segments.push({ expr: m[1], display: true });
  for (const m of mdx.matchAll(/(?<!\$)\$(?!\$)([^$\n]+?)\$/g)) segments.push({ expr: m[1], display: false });
  for (const { expr, display } of segments) {
    try {
      katex.renderToString(expr, { throwOnError: true, output: 'mathml', strict: false, displayMode: display });
    } catch {
      problemes.push(`maths_invalide:${expr.trim().slice(0, 40)}`);
    }
  }

  const html = mdToHtml(mdx);
  if (/<script|onerror=|onload=|javascript:|<iframe/i.test(html)) {
    problemes.push('injection');
  }
  return problemes;
}
