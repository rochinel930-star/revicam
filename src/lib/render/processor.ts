// Pipeline de rendu RéviCam — couche unified (remark/rehype).
// Exécuté UNIQUEMENT côté serveur (SSG/ISR) : zéro JavaScript client.
//
// Moteur scientifique de référence de la plateforme. Phases :
//   R1 → maths + chimie (remark-math + rehype-katex + mhchem)  [ACTIF]
//   R2 → assainissement (rehype-sanitize)                       [ACTIF]
//   R5 → blocs pédagogiques natifs (remark-directive)           [à venir]
//
// Étapes (ordre significatif) :
//   remark-parse      → AST Markdown (mdast)
//   remark-gfm        → tableaux, listes de tâches, ~barré~, autoliens
//   remark-math       → reconnaît $…$ (inline) et $$…$$ (display) en nœuds math
//   remark-rehype     → mdast → hast, en laissant passer le HTML brut
//   rehype-raw        → réintègre le HTML brut (SVG inline, <div> d'encadrés)
//   rehype-katex      → math → MathML (sortie 'mathml' : natif navigateur,
//                       AUCUNE webfont, AUCUN style inline, AUCUN JS client)
//   rehype-sanitize   → défense en profondeur : liste blanche stricte
//                       (voir sanitize-schema.ts), autorise le MathML de KaTeX
//   rehype-stringify  → hast → chaîne HTML
//
// ORDRE CRITIQUE : rehype-katex s'exécute APRÈS rehype-raw (les maths issues du
// HTML brut sont couvertes) et AVANT rehype-sanitize (la sortie MathML est
// assainie comme le reste). La chimie \ce{…} est activée par l'import à effet de
// bord de mhchem (patche l'instance KaTeX partagée).
//
// Choix « MathML plutôt que HTML » : le rendu HTML de KaTeX exige les webfonts
// KaTeX (~centaines de kB) et du style inline — incompatibles avec les
// contraintes RéviCam (pas de webfonts, bas débit) et le schéma R2 (pas de
// style). Le MathML est rendu nativement (Chrome/WebView 109+). Compromis :
// sur navigateur très ancien sans MathML, la formule dégrade en texte lisible.

import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import remarkRehype from 'remark-rehype';
import rehypeRaw from 'rehype-raw';
import rehypeKatex from 'rehype-katex';
import rehypeSanitize from 'rehype-sanitize';
import rehypeStringify from 'rehype-stringify';
import 'katex/contrib/mhchem'; // active \ce{…} sur l'instance KaTeX partagée
import { revicamSchema } from './sanitize-schema';

const processor = unified()
  .use(remarkParse)
  .use(remarkGfm)
  .use(remarkMath)
  .use(remarkRehype, { allowDangerousHtml: true })
  .use(rehypeRaw)
  .use(rehypeKatex, { output: 'mathml', strict: false })
  .use(rehypeSanitize, revicamSchema)
  .use(rehypeStringify);

/** Rend un fragment Markdown (+ GFM + maths + HTML brut) en HTML. Synchrone, serveur. */
export function markdownToHtml(src: string): string {
  return String(processor.processSync(src));
}
